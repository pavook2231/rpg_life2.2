#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${BASE_URL:-http://127.0.0.1:8000}"
EMAIL="${EMAIL:-}"
PASSWORD="${PASSWORD:-}"

if [[ -z "$EMAIL" || -z "$PASSWORD" ]]; then
  echo "Usage:"
  echo "  EMAIL=you@example.com PASSWORD='secret' [BASE_URL=http://127.0.0.1:8000] bash scripts/smoke_api.sh"
  exit 1
fi

pass() { echo "[PASS] $1"; }
fail() { echo "[FAIL] $1"; exit 1; }

json_get() {
  local key="$1"
  python3 - "$key" <<'PY'
import json,sys
key = sys.argv[1]
payload = json.load(sys.stdin)
node = payload
for part in key.split("."):
    if isinstance(node, dict) and part in node:
        node = node[part]
    else:
        print("")
        sys.exit(0)
print(node if node is not None else "")
PY
}

echo "== RPG Life API smoke =="
echo "BASE_URL=$BASE_URL"
echo

health="$(curl -fsS "$BASE_URL/healthz")" || fail "healthz unreachable"
ready="$(curl -fsS "$BASE_URL/readyz")" || fail "readyz unreachable"
echo "$health" | grep -q '"status":"ok"' || fail "healthz not ok"
echo "$ready" | grep -q '"status":"ok"' || fail "readyz not ok"
pass "healthz/readyz"

login_json="$(curl -fsS -X POST "$BASE_URL/api/v1/auth/login" -H "Content-Type: application/json" -d "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}")" || fail "auth/login request failed"
status="$(printf '%s' "$login_json" | json_get status)"
[[ "$status" == "success" || "$status" == "ok" ]] || fail "auth/login status=$status"
TOKEN="$(printf '%s' "$login_json" | json_get data.tokens.access_token)"
[[ -n "$TOKEN" ]] || fail "access token missing"
pass "auth/login"

auth_header=(-H "Authorization: Bearer $TOKEN")

profile_json="$(curl -fsS "${auth_header[@]}" "$BASE_URL/api/v1/profile")" || fail "profile failed"
echo "$profile_json" | grep -q '"status":"success"\|"status":"ok"' || fail "profile bad status"
pass "profile"

bootstrap_json="$(curl -fsS "${auth_header[@]}" "$BASE_URL/api/v1/bootstrap")" || fail "bootstrap failed"
echo "$bootstrap_json" | grep -q '"status":"success"\|"status":"ok"' || fail "bootstrap bad status"
pass "bootstrap"

friends_json="$(curl -fsS "${auth_header[@]}" "$BASE_URL/api/v1/social/friends?page=1&page_size=10")" || fail "friends failed"
echo "$friends_json" | grep -q '"items"' || fail "friends payload invalid"
pass "friends list"

requests_json="$(curl -fsS "${auth_header[@]}" "$BASE_URL/api/v1/social/friends/requests?status=pending")" || fail "friend requests failed"
echo "$requests_json" | grep -q '"items"' || fail "friend requests payload invalid"
pass "friends requests"

lb_global_json="$(curl -fsS "${auth_header[@]}" "$BASE_URL/api/v1/leaderboard?scope=global&metric=power&period=all_time&page=1&limit=20")" || fail "leaderboard global failed"
echo "$lb_global_json" | grep -q '"items"' || fail "leaderboard global payload invalid"
pass "leaderboard global"

lb_friends_json="$(curl -fsS "${auth_header[@]}" "$BASE_URL/api/v1/leaderboard/friends?metric=power&period=all_time&page=1&limit=20")" || fail "leaderboard friends failed"
echo "$lb_friends_json" | grep -q '"items"' || fail "leaderboard friends payload invalid"
pass "leaderboard friends"

shop_json="$(curl -fsS "${auth_header[@]}" "$BASE_URL/api/v1/shop")" || fail "shop failed"
echo "$shop_json" | grep -q '"items"' || fail "shop payload invalid"
pass "shop"

inventory_json="$(curl -fsS "${auth_header[@]}" "$BASE_URL/api/v1/inventory?page=1&limit=20&sort=acquired_at")" || fail "inventory failed"
echo "$inventory_json" | grep -q '"items"' || fail "inventory payload invalid"
pass "inventory"

audit_json="$(curl -fsS "${auth_header[@]}" "$BASE_URL/api/v1/admin/audit/events?page=1&page_size=5" || true)"
if echo "$audit_json" | grep -q '"items"'; then
  pass "admin audit endpoint"
else
  echo "[INFO] admin audit endpoint skipped or forbidden for this user"
fi

echo
echo "Smoke completed successfully."

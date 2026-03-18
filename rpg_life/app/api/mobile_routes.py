from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy.orm import Session
from fastapi.responses import HTMLResponse, RedirectResponse
from urllib.parse import quote, urlsplit, urlunsplit
import base64
import html
import hashlib
import hmac
import json
import time

from app import auth
from app.api.dependencies import enforce_rate_limit
from app.core.config import (
    COOKIE_SAMESITE,
    COOKIE_SECURE,
    PUBLIC_BASE_URL,
    SECRET_KEY,
    SOCIAL_AUTH_REDIRECT_SCHEME,
    TELEGRAM_AUTH_ENABLED,
    TELEGRAM_BOT_USERNAME,
    TELEGRAM_BOT_USERNAME_RAW,
    VK_AUTH_APP_ID,
    VK_AUTH_ENABLED,
    VK_AUTH_MAX_AGE_SECONDS,
)
from app.core.database import get_db
from app.core.responses import success_response
from app.models import User
from app.schemas import (
    ChallengeCreateSchema,
    ChangePasswordSchema,
    InventoryActionSchema,
    LoginRequestSchema,
    SocialAuthExchangeSchema,
    PushDeviceRegisterSchema,
    PushDeviceUnregisterSchema,
    QuestCreate,
    GoalSelectSchema,
    QuestReplaceSchema,
    RecoverAccountSchema,
    RefreshTokenSchema,
    ProfileUpdateSchema,
    ShopPurchaseSchema,
    StepsSyncSchema,
    UserCreate,
)
from app.services import auth_service, character_service, mobile_service, multiplayer_service, notification_service, quest_service

router = APIRouter(prefix="/api/v1", tags=["РњРѕР±РёР»СЊРЅРѕРµ API"])
VK_OAUTH_COOKIE_NAME = "vk_oauth_flow"


def _sign_bridge_cookie(payload: dict) -> str:
    encoded_payload = base64.urlsafe_b64encode(json.dumps(payload, separators=(",", ":")).encode("utf-8")).decode("utf-8").rstrip("=")
    signature = hmac.new(SECRET_KEY.encode("utf-8"), encoded_payload.encode("utf-8"), hashlib.sha256).hexdigest()
    return f"{encoded_payload}.{signature}"


def _verify_bridge_cookie(raw_value: str | None) -> dict | None:
    if not raw_value or "." not in raw_value:
        return None

    encoded_payload, received_signature = raw_value.rsplit(".", 1)
    expected_signature = hmac.new(SECRET_KEY.encode("utf-8"), encoded_payload.encode("utf-8"), hashlib.sha256).hexdigest()
    if not hmac.compare_digest(received_signature, expected_signature):
        return None

    padding = "=" * (-len(encoded_payload) % 4)
    try:
        decoded_payload = base64.urlsafe_b64decode(f"{encoded_payload}{padding}")
        payload = json.loads(decoded_payload.decode("utf-8"))
    except Exception:
        return None

    return payload if isinstance(payload, dict) else None


def _external_url_for(request: Request, route_name: str) -> str:
    internal_url = urlsplit(str(request.url_for(route_name)))
    if PUBLIC_BASE_URL:
        public_base = urlsplit(PUBLIC_BASE_URL)
        return urlunsplit((public_base.scheme or internal_url.scheme, public_base.netloc or internal_url.netloc, internal_url.path, internal_url.query, internal_url.fragment))

    forwarded_proto = request.headers.get("x-forwarded-proto", "").split(",", 1)[0].strip()
    forwarded_host = request.headers.get("x-forwarded-host", "").split(",", 1)[0].strip()
    forwarded_port = request.headers.get("x-forwarded-port", "").split(",", 1)[0].strip()

    scheme = forwarded_proto or internal_url.scheme
    host = forwarded_host or request.headers.get("host", "").strip() or internal_url.netloc

    if forwarded_port and host and ":" not in host and forwarded_port not in {"80", "443"}:
        host = f"{host}:{forwarded_port}"

    return urlunsplit((scheme, host, internal_url.path, internal_url.query, internal_url.fragment))


@router.get("/auth/telegram/bridge", summary="Telegram auth bridge", include_in_schema=False)
async def auth_telegram_bridge(request: Request):
    query_string = request.url.query
    target_base = f"{SOCIAL_AUTH_REDIRECT_SCHEME}://auth/telegram"

    if not query_string:
        return RedirectResponse(url=f"{target_base}?error=telegram_auth_payload_missing", status_code=302)

    if "hash=" not in query_string:
        return RedirectResponse(url=f"{target_base}?error=telegram_auth_hash_missing", status_code=302)

    return RedirectResponse(url=f"{target_base}?init_data={quote(query_string, safe='')}", status_code=302)


@router.get("/auth/telegram/login", summary="Telegram login page", include_in_schema=False)
async def auth_telegram_login_page(request: Request):
    bridge_url = _external_url_for(request, "auth_telegram_bridge")
    app_link = f"{SOCIAL_AUTH_REDIRECT_SCHEME}://auth/telegram"

    if not TELEGRAM_AUTH_ENABLED:
        return HTMLResponse(
            """
            <!doctype html>
            <html lang="ru">
              <head>
                <meta charset="utf-8" />
                <meta name="viewport" content="width=device-width, initial-scale=1" />
                <title>Telegram Sign-in</title>
                <style>
                  body { margin: 0; font-family: Arial, sans-serif; background: #0f172a; color: #e5e7eb; }
                  .shell { min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 24px; }
                  .card { width: 100%; max-width: 520px; background: rgba(15, 23, 42, 0.92); border: 1px solid rgba(148, 163, 184, 0.25); border-radius: 24px; padding: 28px; }
                  h1 { margin: 0 0 12px; font-size: 28px; }
                  p { margin: 0; line-height: 1.5; color: #cbd5e1; }
                  code { background: rgba(15, 23, 42, 0.8); padding: 2px 6px; border-radius: 6px; color: #f8fafc; }
                </style>
              </head>
              <body>
                <main class="shell">
                  <section class="card">
                    <h1>Telegram sign-in is disabled</h1>
                    <p>Enable <code>TELEGRAM_AUTH_ENABLED=true</code> and set both <code>TELEGRAM_BOT_TOKEN</code> and <code>TELEGRAM_BOT_USERNAME</code> on the server.</p>
                  </section>
                </main>
              </body>
            </html>
            """,
            status_code=503,
        )

    if not TELEGRAM_BOT_USERNAME:
        if TELEGRAM_BOT_USERNAME_RAW:
            return HTMLResponse(
                """
                <!doctype html>
                <html lang="ru">
                  <head>
                    <meta charset="utf-8" />
                    <meta name="viewport" content="width=device-width, initial-scale=1" />
                    <title>Telegram Sign-in</title>
                    <style>
                      body { margin: 0; font-family: Arial, sans-serif; background: #0f172a; color: #e5e7eb; }
                      .shell { min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 24px; }
                      .card { width: 100%; max-width: 520px; background: rgba(15, 23, 42, 0.92); border: 1px solid rgba(148, 163, 184, 0.25); border-radius: 24px; padding: 28px; }
                      h1 { margin: 0 0 12px; font-size: 28px; }
                      p { margin: 0 0 12px; line-height: 1.5; color: #cbd5e1; }
                      code { background: rgba(15, 23, 42, 0.8); padding: 2px 6px; border-radius: 6px; color: #f8fafc; }
                    </style>
                  </head>
                  <body>
                    <main class="shell">
                      <section class="card">
                        <h1>Telegram bot username has invalid format</h1>
                        <p><code>TELEGRAM_BOT_USERNAME</code> should point to a Telegram bot username such as <code>rpglife_auth_bot</code>.</p>
                        <p>You can also use <code>@rpglife_auth_bot</code> or <code>https://t.me/rpglife_auth_bot</code>; the backend will normalize those values after restart.</p>
                      </section>
                    </main>
                  </body>
                </html>
                """,
                status_code=503,
            )

        return HTMLResponse(
            """
            <!doctype html>
            <html lang="ru">
              <head>
                <meta charset="utf-8" />
                <meta name="viewport" content="width=device-width, initial-scale=1" />
                <title>Telegram Sign-in</title>
                <style>
                  body { margin: 0; font-family: Arial, sans-serif; background: #0f172a; color: #e5e7eb; }
                  .shell { min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 24px; }
                  .card { width: 100%; max-width: 520px; background: rgba(15, 23, 42, 0.92); border: 1px solid rgba(148, 163, 184, 0.25); border-radius: 24px; padding: 28px; }
                  h1 { margin: 0 0 12px; font-size: 28px; }
                  p { margin: 0; line-height: 1.5; color: #cbd5e1; }
                  code { background: rgba(15, 23, 42, 0.8); padding: 2px 6px; border-radius: 6px; color: #f8fafc; }
                </style>
              </head>
              <body>
                <main class="shell">
                  <section class="card">
                    <h1>Telegram bot username is missing</h1>
                    <p>Add <code>TELEGRAM_BOT_USERNAME</code> to the server environment and restart the backend.</p>
                  </section>
                </main>
              </body>
            </html>
            """,
            status_code=503,
        )

    html = f"""
    <!doctype html>
    <html lang="ru">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>RPG Life Telegram Sign-in</title>
        <style>
          :root {{
            color-scheme: dark;
          }}
          body {{
            margin: 0;
            min-height: 100vh;
            font-family: Arial, sans-serif;
            background:
              radial-gradient(circle at top, rgba(249, 115, 22, 0.14), transparent 38%),
              linear-gradient(180deg, #0f172a 0%, #111827 100%);
            color: #f8fafc;
          }}
          .shell {{
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 24px;
          }}
          .card {{
            width: 100%;
            max-width: 560px;
            background: rgba(15, 23, 42, 0.9);
            border: 1px solid rgba(148, 163, 184, 0.22);
            border-radius: 24px;
            padding: 28px;
            box-shadow: 0 30px 80px rgba(2, 6, 23, 0.5);
          }}
          .eyebrow {{
            margin: 0 0 12px;
            color: #f59e0b;
            font-size: 14px;
            font-weight: 700;
            letter-spacing: 0.08em;
            text-transform: uppercase;
          }}
          h1 {{
            margin: 0 0 12px;
            font-size: 32px;
            line-height: 1.1;
          }}
          p {{
            margin: 0 0 16px;
            color: #cbd5e1;
            line-height: 1.6;
          }}
          .widget {{
            margin: 24px 0;
            display: flex;
            justify-content: center;
          }}
          .hint {{
            padding: 14px 16px;
            border-radius: 16px;
            background: rgba(30, 41, 59, 0.65);
            color: #cbd5e1;
            font-size: 14px;
          }}
          code {{
            background: rgba(15, 23, 42, 0.9);
            color: #f8fafc;
            padding: 2px 6px;
            border-radius: 6px;
          }}
          a {{
            color: #38bdf8;
          }}
        </style>
      </head>
      <body>
        <main class="shell">
          <section class="card">
            <p class="eyebrow">RPG Life</p>
            <h1>Вход через Telegram</h1>
            <p>Нажми кнопку ниже, подтверди вход в Telegram, и мы автоматически вернём тебя в приложение по deep link <code>{app_link}</code>.</p>
            <div class="widget">
              <script async src="https://telegram.org/js/telegram-widget.js?22"
                data-telegram-login="{TELEGRAM_BOT_USERNAME}"
                data-size="large"
                data-auth-url="{bridge_url}"
                data-request-access="write">
              </script>
            </div>
            <div class="hint">
              Если кнопка Telegram не появляется, проверь в <a href="https://t.me/BotFather" target="_blank" rel="noreferrer">BotFather</a>, что домен авторизации у бота совпадает с текущим HTTPS-доменом приложения.
            </div>
          </section>
        </main>
      </body>
    </html>
    """
    return HTMLResponse(html)


@router.get("/auth/vk/login", summary="VK ID login redirect", include_in_schema=False)
async def auth_vk_login_page(request: Request):
    if not VK_AUTH_ENABLED:
        return HTMLResponse(
            """
            <!doctype html>
            <html lang="ru">
              <head>
                <meta charset="utf-8" />
                <meta name="viewport" content="width=device-width, initial-scale=1" />
                <title>VK ID Sign-in</title>
                <style>
                  body { margin: 0; font-family: Arial, sans-serif; background: #0f172a; color: #e5e7eb; }
                  .shell { min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 24px; }
                  .card { width: 100%; max-width: 520px; background: rgba(15, 23, 42, 0.92); border: 1px solid rgba(148, 163, 184, 0.25); border-radius: 24px; padding: 28px; }
                  h1 { margin: 0 0 12px; font-size: 28px; }
                  p { margin: 0; line-height: 1.5; color: #cbd5e1; }
                  code { background: rgba(15, 23, 42, 0.8); padding: 2px 6px; border-radius: 6px; color: #f8fafc; }
                </style>
              </head>
              <body>
                <main class="shell">
                  <section class="card">
                    <h1>VK ID sign-in is disabled</h1>
                    <p>Enable <code>VK_AUTH_ENABLED=true</code> and set <code>VK_AUTH_APP_ID</code> on the server.</p>
                  </section>
                </main>
              </body>
            </html>
            """,
            status_code=503,
        )

    if not VK_AUTH_APP_ID:
        return HTMLResponse(
            """
            <!doctype html>
            <html lang="ru">
              <head>
                <meta charset="utf-8" />
                <meta name="viewport" content="width=device-width, initial-scale=1" />
                <title>VK ID Sign-in</title>
                <style>
                  body { margin: 0; font-family: Arial, sans-serif; background: #0f172a; color: #e5e7eb; }
                  .shell { min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 24px; }
                  .card { width: 100%; max-width: 520px; background: rgba(15, 23, 42, 0.92); border: 1px solid rgba(148, 163, 184, 0.25); border-radius: 24px; padding: 28px; }
                  h1 { margin: 0 0 12px; font-size: 28px; }
                  p { margin: 0; line-height: 1.5; color: #cbd5e1; }
                  code { background: rgba(15, 23, 42, 0.8); padding: 2px 6px; border-radius: 6px; color: #f8fafc; }
                </style>
              </head>
              <body>
                <main class="shell">
                  <section class="card">
                    <h1>VK ID app id is missing</h1>
                    <p>Add <code>VK_AUTH_APP_ID</code> to the server environment and restart the backend.</p>
                  </section>
                </main>
              </body>
            </html>
            """,
            status_code=503,
        )

    callback_url = _external_url_for(request, "auth_vk_callback")
    browser_flow = auth_service.create_vk_browser_login(callback_url)
    authorize_url = browser_flow["authorize_url"]
    response = HTMLResponse(
        f"""
        <!doctype html>
        <html lang="ru">
          <head>
            <meta charset="utf-8" />
            <meta name="viewport" content="width=device-width, initial-scale=1" />
            <title>VK ID Sign-in</title>
            <style>
              body {{ margin: 0; font-family: Arial, sans-serif; background: #0f172a; color: #e5e7eb; }}
              .shell {{ min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 24px; }}
              .card {{ width: 100%; max-width: 560px; background: rgba(15, 23, 42, 0.92); border: 1px solid rgba(148, 163, 184, 0.25); border-radius: 24px; padding: 28px; box-shadow: 0 30px 80px rgba(2, 6, 23, 0.5); }}
              h1 {{ margin: 0 0 12px; font-size: 30px; }}
              p {{ margin: 0 0 14px; line-height: 1.6; color: #cbd5e1; }}
              .button {{ display: inline-flex; align-items: center; justify-content: center; margin-top: 12px; padding: 14px 18px; border-radius: 14px; background: #2563eb; color: #eff6ff; text-decoration: none; font-weight: 700; }}
              .hint {{ margin-top: 18px; font-size: 14px; color: #94a3b8; }}
            </style>
          </head>
          <body>
            <main class="shell">
              <section class="card">
                <h1>Переходим в VK ID</h1>
                <p>Сейчас откроем страницу входа VK ID, а после подтверждения автоматически вернём тебя в приложение.</p>
                <p>Если переход не начался сам, нажми кнопку ниже.</p>
                <a class="button" href="{html.escape(authorize_url, quote=True)}" rel="noreferrer">Продолжить через VK ID</a>
                <p class="hint">Эта страница помогает браузеру сначала сохранить служебную cookie-сессию входа, а уже потом уйти в VK.</p>
              </section>
            </main>
            <script>
              window.setTimeout(function () {{
                window.location.replace({json.dumps(authorize_url)});
              }}, 150);
            </script>
          </body>
        </html>
        """,
        status_code=200,
    )
    response.set_cookie(
        key=VK_OAUTH_COOKIE_NAME,
        value=_sign_bridge_cookie(
            {
                "state": browser_flow["state"],
                "code_verifier": browser_flow["code_verifier"],
                "created_at": int(time.time()),
            }
        ),
        max_age=VK_AUTH_MAX_AGE_SECONDS,
        httponly=True,
        secure=COOKIE_SECURE,
        samesite=COOKIE_SAMESITE,
        path="/",
    )
    return response


@router.get("/auth/vk/callback", summary="VK ID callback", include_in_schema=False)
async def auth_vk_callback(
    request: Request,
    code: str | None = Query(None),
    state: str | None = Query(None),
    device_id: str | None = Query(None),
    error: str | None = Query(None),
    error_description: str | None = Query(None),
    db: Session = Depends(get_db),
):
    target_base = f"{SOCIAL_AUTH_REDIRECT_SCHEME}://auth/vk"
    signed_cookie = request.cookies.get(VK_OAUTH_COOKIE_NAME)
    flow_cookie = _verify_bridge_cookie(signed_cookie)

    if error:
        response = RedirectResponse(url=f"{target_base}?error={quote(error_description or error, safe='')}", status_code=302)
        response.delete_cookie(VK_OAUTH_COOKIE_NAME, path="/")
        return response

    if not flow_cookie:
        response = RedirectResponse(url=f"{target_base}?error=vk_auth_cookie_missing", status_code=302)
        response.delete_cookie(VK_OAUTH_COOKIE_NAME, path="/")
        return response

    if int(time.time()) - int(flow_cookie.get("created_at") or 0) > VK_AUTH_MAX_AGE_SECONDS:
        response = RedirectResponse(url=f"{target_base}?error=vk_auth_session_expired", status_code=302)
        response.delete_cookie(VK_OAUTH_COOKIE_NAME, path="/")
        return response

    expected_state = str(flow_cookie.get("state") or "").strip()
    code_verifier = str(flow_cookie.get("code_verifier") or "").strip()
    if not code or not device_id or not state or not code_verifier:
        response = RedirectResponse(url=f"{target_base}?error=vk_auth_payload_missing", status_code=302)
        response.delete_cookie(VK_OAUTH_COOKIE_NAME, path="/")
        return response

    if state != expected_state:
        response = RedirectResponse(url=f"{target_base}?error=vk_auth_state_mismatch", status_code=302)
        response.delete_cookie(VK_OAUTH_COOKIE_NAME, path="/")
        return response

    callback_url = _external_url_for(request, "auth_vk_callback")
    try:
        ticket = auth_service.complete_vk_browser_login(
            db,
            code=code,
            device_id=device_id,
            state=state,
            code_verifier=code_verifier,
            redirect_uri=callback_url,
        )
        response = RedirectResponse(url=f"{target_base}?ticket={quote(ticket, safe='')}", status_code=302)
    except Exception as error_obj:
        message = getattr(error_obj, "detail", "vk_auth_failed")
        response = RedirectResponse(url=f"{target_base}?error={quote(str(message), safe='')}", status_code=302)

    response.delete_cookie(VK_OAUTH_COOKIE_NAME, path="/")
    return response


@router.get("", summary="РљРѕСЂРµРЅСЊ API")
async def api_root():
    return success_response({"service": "RPG Life API", "status": "ok"}, "API РґРѕСЃС‚СѓРїРЅРѕ")


@router.post(
    "/auth/login",
    summary="Р’С…РѕРґ",
    description="РђСѓС‚РµРЅС‚РёС„РёРєР°С†РёСЏ РїРѕР»СЊР·РѕРІР°С‚РµР»СЏ Рё РІС‹РґР°С‡Р° access/refresh JWT С‚РѕРєРµРЅРѕРІ РґР»СЏ РјРѕР±РёР»СЊРЅРѕРіРѕ РєР»РёРµРЅС‚Р°.",
)
async def auth_login(request: Request, payload: LoginRequestSchema, db: Session = Depends(get_db)):
    await enforce_rate_limit(request, bucket="mobile-login", limit=10, window_seconds=60)
    return success_response(auth_service.login_user_tokens(db, payload.email, payload.password), "Р’С…РѕРґ РІС‹РїРѕР»РЅРµРЅ")


@router.post(
    "/auth/register",
    summary="Р РµРіРёСЃС‚СЂР°С†РёСЏ",
    description="Р РµРіРёСЃС‚СЂР°С†РёСЏ РЅРѕРІРѕРіРѕ РїРѕР»СЊР·РѕРІР°С‚РµР»СЏ Рё РІС‹РґР°С‡Р° access/refresh JWT С‚РѕРєРµРЅРѕРІ.",
)
async def auth_register(request: Request, payload: UserCreate, db: Session = Depends(get_db)):
    await enforce_rate_limit(request, bucket="mobile-register", limit=5, window_seconds=300)
    return success_response(auth_service.register_user_tokens(db, payload), "Р РµРіРёСЃС‚СЂР°С†РёСЏ РІС‹РїРѕР»РЅРµРЅР°", status_code=201)


@router.post(
    "/auth/refresh",
    summary="РћР±РЅРѕРІР»РµРЅРёРµ access С‚РѕРєРµРЅР°",
    description="РћР±РјРµРЅ РІР°Р»РёРґРЅРѕРіРѕ refresh С‚РѕРєРµРЅР° РЅР° РЅРѕРІСѓСЋ РїР°СЂСѓ С‚РѕРєРµРЅРѕРІ.",
)
async def auth_refresh(request: Request, payload: RefreshTokenSchema, db: Session = Depends(get_db)):
    await enforce_rate_limit(request, bucket="mobile-refresh", limit=20, window_seconds=300)
    return success_response(auth_service.refresh_access_token(db, payload.refresh_token), "РўРѕРєРµРЅ РѕР±РЅРѕРІР»РµРЅ")


@router.get("/auth/providers", summary="Available social auth providers")
async def auth_providers():
    return success_response({"providers": auth_service.get_social_auth_providers()}, "Social auth providers loaded")


@router.post("/auth/social", summary="Social auth sign-in")
async def auth_social(request: Request, payload: SocialAuthExchangeSchema, db: Session = Depends(get_db)):
    await enforce_rate_limit(request, bucket=f"mobile-social-{payload.provider}", limit=10, window_seconds=60)
    return success_response(
        auth_service.authenticate_social_mobile(
            db,
            payload.provider,
            id_token=payload.id_token,
            access_token=payload.access_token,
            authorization_code=payload.authorization_code,
            init_data=payload.init_data,
            bridge_ticket=payload.bridge_ticket,
        ),
        "Social auth completed",
    )


@router.post("/auth/change-password", summary="Change password")
async def auth_change_password(
    payload: ChangePasswordSchema,
    db: Session = Depends(get_db),
    current_user: User = Depends(auth.get_current_user),
):
    return success_response(
        auth_service.change_password(db, current_user, payload.current_password, payload.new_password),
        "Password updated",
    )


@router.post("/auth/recover-account", summary="Recover account")
async def auth_recover_account(request: Request, payload: RecoverAccountSchema, db: Session = Depends(get_db)):
    await enforce_rate_limit(request, bucket="mobile-recover", limit=5, window_seconds=900)
    return success_response(auth_service.recover_account(db, payload.email), "Recovery request received")


@router.get("/profile", summary="РџСЂРѕС„РёР»СЊ РїРѕР»СЊР·РѕРІР°С‚РµР»СЏ")
async def get_profile(db: Session = Depends(get_db), current_user: User = Depends(auth.get_current_user)):
    return success_response(mobile_service.get_profile(db, current_user))


@router.get("/bootstrap", summary="Core bootstrap payload for mobile app")
async def get_bootstrap(db: Session = Depends(get_db), current_user: User = Depends(auth.get_current_user)):
    return success_response(mobile_service.get_bootstrap_payload(db, current_user))


@router.post("/notifications/devices/register", summary="Register push device")
async def register_notification_device(
    payload: PushDeviceRegisterSchema,
    db: Session = Depends(get_db),
    current_user: User = Depends(auth.get_current_user),
):
    return success_response(
        notification_service.register_push_device(db, current_user, payload),
        "Push device registered",
    )


@router.post("/notifications/devices/unregister", summary="Unregister push device")
async def unregister_notification_device(
    payload: PushDeviceUnregisterSchema,
    db: Session = Depends(get_db),
    current_user: User = Depends(auth.get_current_user),
):
    return success_response(
        notification_service.unregister_push_device(db, current_user, payload.push_token),
        "Push device unregistered",
    )


@router.get("/character/profile", summary="РџСЂРѕС„РёР»СЊ РїРµСЂСЃРѕРЅР°Р¶Р°")
async def get_character_profile(db: Session = Depends(get_db), current_user: User = Depends(auth.get_current_user)):
    return success_response(mobile_service.get_character_profile(db, current_user))


@router.post("/steps/sync", summary="Sync today's steps from device")
async def sync_steps(
    payload: StepsSyncSchema,
    db: Session = Depends(get_db),
    current_user: User = Depends(auth.get_current_user),
):
    return success_response(mobile_service.sync_today_steps(db, current_user, payload.steps, payload.day_started_at, payload.source))


@router.get("/quests/daily", summary="Р•Р¶РµРґРЅРµРІРЅС‹Рµ Р·Р°РґР°РЅРёСЏ")
async def get_daily_quests(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    sort: str = "created_at",
    bucket: str | None = Query(default=None, pattern="^(daily|weekly|long_term)$"),
    db: Session = Depends(get_db),
    current_user: User = Depends(auth.get_current_user),
):
    return success_response(mobile_service.get_daily_quests(db, current_user, page, limit, sort, bucket))


@router.post("/quests/regenerate-today", summary="Regenerate today's quests")
async def regenerate_today_quests(
    db: Session = Depends(get_db),
    current_user: User = Depends(auth.get_current_user),
):
    return success_response(
        mobile_service.regenerate_today_quests(db, current_user),
        "Today's quests regenerated",
    )


@router.post("/quests/regenerate-ai", summary="Regenerate quests by AI assistant")
async def regenerate_ai_quests(
    db: Session = Depends(get_db),
    current_user: User = Depends(auth.get_current_user),
):
    return success_response(
        quest_service.regenerate_ai_goal_quests(db, current_user),
        "AI quests regenerated",
    )


@router.get("/goals/templates", summary="Goal cards and term templates")
async def get_goal_templates():
    return success_response(quest_service.get_goal_templates())


@router.get("/goals/current", summary="Current goal state")
async def get_current_goal(
    db: Session = Depends(get_db),
    current_user: User = Depends(auth.get_current_user),
):
    return success_response(quest_service.get_goal_state(db, current_user))


@router.post("/goals/select", summary="Select or change active goal")
async def select_goal(
    payload: GoalSelectSchema,
    db: Session = Depends(get_db),
    current_user: User = Depends(auth.get_current_user),
):
    return success_response(
        quest_service.select_goal(
            db,
            current_user,
            payload.goal_type,
            payload.goal_term_months,
            payload.start_new_cycle,
        ),
        "Goal selected",
    )


@router.get("/inventory", summary="РРЅРІРµРЅС‚Р°СЂСЊ")
async def get_inventory(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    sort: str = "acquired_at",
    db: Session = Depends(get_db),
    current_user: User = Depends(auth.get_current_user),
):
    return success_response(mobile_service.get_inventory(db, current_user, page, limit, sort))


@router.post("/inventory/equip", summary="Р­РєРёРїРёСЂРѕРІР°С‚СЊ РїСЂРµРґРјРµС‚")
async def equip_inventory_item(
    payload: InventoryActionSchema,
    db: Session = Depends(get_db),
    current_user: User = Depends(auth.get_current_user),
):
    return success_response(
        mobile_service.equip_item(db, current_user, payload.inventory_id, payload.slot or "", payload.class_progress_id),
        "РџСЂРµРґРјРµС‚ СЌРєРёРїРёСЂРѕРІР°РЅ",
    )


@router.get("/rewards/summary", summary="РЎРІРѕРґРєР° РЅР°РіСЂР°Рґ")
async def get_rewards_summary(db: Session = Depends(get_db), current_user: User = Depends(auth.get_current_user)):
    return success_response(mobile_service.get_rewards_summary(db, current_user))


@router.get("/challenges", summary="РСЃРїС‹С‚Р°РЅРёСЏ")
async def get_challenges(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    sort: str = "created_at",
    status: str | None = None,
    activity_type: str | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(auth.get_current_user),
):
    return success_response(mobile_service.get_challenges(db, current_user, page, limit, status, activity_type, sort))


@router.get("/leaderboard", summary="РўР°Р±Р»РёС†Р° Р»РёРґРµСЂРѕРІ")
async def get_leaderboard(
    scope: str = Query("global", pattern="^(global|friends)$"),
    metric: str = Query("level"),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(auth.get_current_user),
):
    return success_response(mobile_service.get_leaderboard(db, current_user, scope, metric, page, limit))


@router.get("/events", summary="РЎРѕР±С‹С‚РёСЏ")
async def get_events(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    sort: str = "start_at",
    event_type: str | None = None,
    status: str | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(auth.get_current_user),
):
    return success_response(mobile_service.get_events(db, page, limit, sort, event_type, status))


@router.get("/achievements", summary="Р”РѕСЃС‚РёР¶РµРЅРёСЏ")
async def get_achievements(db: Session = Depends(get_db), current_user: User = Depends(auth.get_current_user)):
    return success_response(mobile_service.get_achievements(db, current_user))


@router.get("/shop", summary="РњР°РіР°Р·РёРЅ")
async def get_shop(db: Session = Depends(get_db), current_user: User = Depends(auth.get_current_user)):
    return success_response(mobile_service.get_shop(db, current_user))


@router.post("/shop/refresh", summary="Refresh shop")
async def refresh_shop(db: Session = Depends(get_db), current_user: User = Depends(auth.get_current_user)):
    return success_response(mobile_service.refresh_shop(db, current_user), "Shop refreshed")


@router.post("/shop/buy", summary="РљСѓРїРёС‚СЊ РїСЂРµРґРјРµС‚")
async def buy_shop_item(
    payload: ShopPurchaseSchema,
    db: Session = Depends(get_db),
    current_user: User = Depends(auth.get_current_user),
):
    return success_response(mobile_service.buy_shop_item(db, current_user, payload.item_id), "РџРѕРєСѓРїРєР° РІС‹РїРѕР»РЅРµРЅР°")


@router.get("/character/equipment", summary="РћР±Р·РѕСЂ СЌРєРёРїРёСЂРѕРІРєРё")
async def get_equipment_overview(db: Session = Depends(get_db), current_user: User = Depends(auth.get_current_user)):
    return success_response(mobile_service.get_equipment_overview(db, current_user))


@router.get("/inventory/{inventory_id}", summary="Р”РµС‚Р°Р»Рё РїСЂРµРґРјРµС‚Р°")
async def get_inventory_item_detail(
    inventory_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(auth.get_current_user),
):
    return success_response(mobile_service.get_inventory_item_detail(db, current_user, inventory_id))


@router.post("/inventory/sell", summary="РџСЂРѕРґР°С‚СЊ РїСЂРµРґРјРµС‚")
async def sell_inventory_item(
    payload: InventoryActionSchema,
    db: Session = Depends(get_db),
    current_user: User = Depends(auth.get_current_user),
):
    return success_response(mobile_service.sell_inventory_item(db, current_user, payload.inventory_id), "РџСЂРµРґРјРµС‚ РїСЂРѕРґР°РЅ")


@router.post("/inventory/unequip", summary="РЎРЅСЏС‚СЊ РїСЂРµРґРјРµС‚")
async def unequip_inventory_item(
    payload: InventoryActionSchema,
    db: Session = Depends(get_db),
    current_user: User = Depends(auth.get_current_user),
):
    return success_response(mobile_service.unequip_inventory_item(db, current_user, payload.inventory_id), "РџСЂРµРґРјРµС‚ СЃРЅСЏС‚")


@router.post("/quests", summary="РЎРѕР·РґР°С‚СЊ РїРѕР»СЊР·РѕРІР°С‚РµР»СЊСЃРєРѕРµ Р·Р°РґР°РЅРёРµ")
async def create_custom_quest(
    payload: QuestCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(auth.get_current_user),
):
    return success_response(quest_service.create_custom_quest(db, current_user, payload), "Р—Р°РґР°РЅРёРµ СЃРѕР·РґР°РЅРѕ", status_code=201)


@router.post("/quests/{quest_id}/complete", summary="Р—Р°РІРµСЂС€РёС‚СЊ Р·Р°РґР°РЅРёРµ")
async def complete_quest(
    quest_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(auth.get_current_user),
):
    return success_response(quest_service.complete_quest(db, current_user.id, quest_id), "Р—Р°РґР°РЅРёРµ РІС‹РїРѕР»РЅРµРЅРѕ")


@router.post("/quests/{quest_id}/accept", summary="Accept quest from swipe card")
async def accept_goal_quest(
    quest_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(auth.get_current_user),
):
    return success_response(quest_service.accept_goal_quest(db, current_user, quest_id), "Quest accepted")


@router.post("/quests/{quest_id}/replace", summary="Replace quest from swipe card")
async def replace_goal_quest(
    quest_id: int,
    payload: QuestReplaceSchema,
    db: Session = Depends(get_db),
    current_user: User = Depends(auth.get_current_user),
):
    return success_response(
        quest_service.replace_goal_quest(db, current_user, quest_id, payload.source),
        "Quest replaced",
    )


@router.post("/quests/{quest_id}/delete", summary="РЈРґР°Р»РёС‚СЊ Р·Р°РґР°РЅРёРµ")
async def delete_quest(
    quest_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(auth.get_current_user),
):
    return success_response(quest_service.delete_quest(db, current_user.id, quest_id), "Р—Р°РґР°РЅРёРµ СѓРґР°Р»РµРЅРѕ")


@router.post("/rewards/daily-bonus/claim", summary="Р—Р°Р±СЂР°С‚СЊ РµР¶РµРґРЅРµРІРЅС‹Р№ Р±РѕРЅСѓСЃ")
async def claim_daily_bonus(db: Session = Depends(get_db), current_user: User = Depends(auth.get_current_user)):
    return success_response(quest_service.claim_daily_bonus(db, current_user.id), "Р‘РѕРЅСѓСЃ РїРѕР»СѓС‡РµРЅ")


@router.post("/rewards/weekly-goal/claim", summary="Claim weekly goal reward")
async def claim_weekly_goal_reward(db: Session = Depends(get_db), current_user: User = Depends(auth.get_current_user)):
    return success_response(mobile_service.claim_weekly_goal_reward(db, current_user), "Weekly reward claimed")


@router.post("/rewards/seasonal-goal/claim", summary="Claim seasonal goal reward")
async def claim_seasonal_goal_reward(db: Session = Depends(get_db), current_user: User = Depends(auth.get_current_user)):
    return success_response(mobile_service.claim_seasonal_goal_reward(db, current_user), "Seasonal reward claimed")


@router.post("/profile/update", summary="РћР±РЅРѕРІРёС‚СЊ РїСЂРѕС„РёР»СЊ")
async def update_profile(
    payload: ProfileUpdateSchema,
    db: Session = Depends(get_db),
    current_user: User = Depends(auth.get_current_user),
):
    return success_response(character_service.update_profile(db, current_user.id, payload), "РџСЂРѕС„РёР»СЊ РѕР±РЅРѕРІР»РµРЅ")


@router.post("/challenges", summary="РЎРѕР·РґР°С‚СЊ РїСѓР±Р»РёС‡РЅРѕРµ РёСЃРїС‹С‚Р°РЅРёРµ")
async def create_challenge(
    payload: ChallengeCreateSchema,
    db: Session = Depends(get_db),
    current_user: User = Depends(auth.get_current_user),
):
    return success_response(multiplayer_service.create_challenge(db, current_user.id, payload), "РСЃРїС‹С‚Р°РЅРёРµ СЃРѕР·РґР°РЅРѕ", status_code=201)


@router.post("/challenges/{challenge_id}/join", summary="РџСЂРёСЃРѕРµРґРёРЅРёС‚СЊСЃСЏ Рє РёСЃРїС‹С‚Р°РЅРёСЋ")
async def join_challenge(
    challenge_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(auth.get_current_user),
):
    return success_response(multiplayer_service.join_challenge(db, challenge_id, current_user.id), "РЈС‡Р°СЃС‚РёРµ РїРѕРґС‚РІРµСЂР¶РґРµРЅРѕ")


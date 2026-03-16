from __future__ import annotations

import json
import logging
import re
from typing import Any

from sqlalchemy.orm import Session

from app.core.config import (
    OLLAMA_API_KEY,
    OLLAMA_BASE_URL,
    OLLAMA_QUEST_MODEL,
    OLLAMA_QUEST_TIMEOUT_SECONDS,
    OPENAI_API_KEY,
    OPENAI_BASE_URL,
    OPENAI_QUEST_MODEL,
    OPENAI_QUEST_REWRITE_ENABLED,
    OPENAI_QUEST_TIMEOUT_SECONDS,
    QUEST_TEXT_PROVIDER,
)
from app.goals import get_goal_info
from app.models import Quest, User

logger = logging.getLogger(__name__)

_NUMBER_RE = re.compile(r"\d+(?:[.,]\d+)?")

_REWRITE_SCHEMA = {
    "type": "object",
    "properties": {
        "items": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "template_key": {"type": "string"},
                    "title": {"type": "string"},
                    "description": {"type": "string"},
                },
                "required": ["template_key", "title", "description"],
                "additionalProperties": False,
            },
        }
    },
    "required": ["items"],
    "additionalProperties": False,
}


def is_enabled() -> bool:
    if not OPENAI_QUEST_REWRITE_ENABLED:
        return False
    provider = _resolve_provider()
    if provider == "openai":
        return bool(OPENAI_API_KEY)
    if provider == "ollama":
        return bool(OLLAMA_BASE_URL) and bool(OLLAMA_QUEST_MODEL)
    return False


def _resolve_provider() -> str:
    value = str(QUEST_TEXT_PROVIDER or "").strip().lower()
    if value in {"openai", "ollama", "free"}:
        return value
    return "free"


def _target_language(user: User) -> str:
    preference = str(getattr(user, "language_preference", "ru") or "ru").strip().lower()
    return "en" if preference == "en" else "ru"


def _recent_style_hints(db: Session, user: User, limit: int = 5) -> list[dict[str, str]]:
    rows = (
        db.query(Quest)
        .filter(Quest.user_id == user.id, Quest.is_custom == True)
        .order_by(Quest.created_at.desc())
        .limit(limit)
        .all()
    )
    hints: list[dict[str, str]] = []
    for quest in rows:
        title = str(getattr(quest, "title", "") or "").strip()
        description = str(getattr(quest, "description", "") or "").strip()
        if not title and not description:
            continue
        hints.append({"title": title, "description": description})
    return hints


def _build_prompt(*, user: User, phase: int, level: int, quests: list[dict], style_hints: list[dict[str, str]]) -> str:
    goal = get_goal_info(user.selected_goal_type)
    target_language = _target_language(user)
    request_payload = {
        "language": target_language,
        "goal": {
            "id": user.selected_goal_type,
            "title": goal["title"],
            "phase": phase,
            "level": level,
            "term_months": int(getattr(user, "goal_term_months", 6) or 6),
        },
        "user": {
            "name": getattr(user, "name", None),
            "streak_context": "low" if level <= 3 else "growing" if level <= 8 else "strong",
        },
        "style_hints": style_hints,
        "quests": [
            {
                "template_key": quest["template_key"],
                "title": quest["title"],
                "description": quest["description"],
                "difficulty": quest.get("difficulty"),
                "objective_type": quest.get("objective_type"),
                "target_value": quest.get("target_value"),
            }
            for quest in quests
        ],
    }
    return (
        "You rewrite quest copy for RPG Life.\n"
        "Return JSON only.\n"
        "Rules:\n"
        "- Keep the same number of quests and the same template_key values.\n"
        "- Rewrite only title and description.\n"
        "- Preserve meaning, numbers, amounts, time, distance, and targets exactly.\n"
        "- Keep titles compact and punchy.\n"
        "- Keep descriptions short, supportive, and clear.\n"
        "- Do not mention AI, prompts, models, or rewriting.\n"
        "- Match the target language from the payload.\n"
        "- If style_hints exist, softly mirror that tone without copying them.\n\n"
        f"Payload:\n{json.dumps(request_payload, ensure_ascii=False)}"
    )


def _extract_response_text(payload: dict[str, Any]) -> str | None:
    output_text = payload.get("output_text")
    if isinstance(output_text, str) and output_text.strip():
        return output_text.strip()

    for output_item in payload.get("output", []) or []:
        if not isinstance(output_item, dict):
            continue
        for content_item in output_item.get("content", []) or []:
            if not isinstance(content_item, dict):
                continue
            text_value = content_item.get("text")
            if isinstance(text_value, str) and text_value.strip():
                return text_value.strip()
            if isinstance(text_value, dict):
                nested = text_value.get("value")
                if isinstance(nested, str) and nested.strip():
                    return nested.strip()
    return None


def _extract_chat_content(payload: dict[str, Any]) -> str | None:
    choices = payload.get("choices")
    if not isinstance(choices, list) or not choices:
        return None
    first = choices[0]
    if not isinstance(first, dict):
        return None
    message = first.get("message")
    if not isinstance(message, dict):
        return None
    content = message.get("content")
    if isinstance(content, str) and content.strip():
        return content.strip()
    return None


def _extract_json_block(raw_text: str) -> str:
    stripped = (raw_text or "").strip()
    if stripped.startswith("```"):
        stripped = re.sub(r"^```(?:json)?\s*", "", stripped, flags=re.IGNORECASE)
        stripped = re.sub(r"\s*```$", "", stripped)
    start = stripped.find("{")
    end = stripped.rfind("}")
    if start >= 0 and end > start:
        return stripped[start : end + 1]
    return stripped


def _normalized_numbers(value: str) -> list[str]:
    return [token.replace(",", ".") for token in _NUMBER_RE.findall(str(value or ""))]


def _is_rewrite_safe(original: dict, rewritten: dict) -> bool:
    title = str(rewritten.get("title", "") or "").strip()
    description = str(rewritten.get("description", "") or "").strip()
    if not title or not description:
        return False
    if len(title) > 96 or len(description) > 220:
        return False

    original_numbers = _normalized_numbers(f"{original.get('title', '')} {original.get('description', '')}")
    rewritten_numbers = _normalized_numbers(f"{title} {description}")
    return original_numbers == rewritten_numbers


def _request_rewrites(prompt: str) -> dict[str, Any] | None:
    try:
        import httpx
    except ModuleNotFoundError:
        logger.warning("OpenAI quest rewrite skipped because httpx is not installed in the runtime")
        return None

    provider = _resolve_provider()
    raw_text: str | None = None
    try:
        with httpx.Client(
            timeout=OPENAI_QUEST_TIMEOUT_SECONDS if provider == "openai" else OLLAMA_QUEST_TIMEOUT_SECONDS
        ) as client:
            if provider == "openai":
                response = client.post(
                    f"{OPENAI_BASE_URL}/responses",
                    headers={
                        "Authorization": f"Bearer {OPENAI_API_KEY}",
                        "Content-Type": "application/json",
                    },
                    json={
                        "model": OPENAI_QUEST_MODEL,
                        "input": prompt,
                        "text": {
                            "format": {
                                "type": "json_schema",
                                "name": "goal_quest_rewrites",
                                "schema": _REWRITE_SCHEMA,
                            }
                        },
                    },
                )
                response.raise_for_status()
                payload = response.json()
                raw_text = _extract_response_text(payload)
            elif provider == "ollama":
                headers = {"Content-Type": "application/json"}
                if OLLAMA_API_KEY:
                    headers["Authorization"] = f"Bearer {OLLAMA_API_KEY}"
                response = client.post(
                    f"{OLLAMA_BASE_URL}/chat/completions",
                    headers=headers,
                    json={
                        "model": OLLAMA_QUEST_MODEL,
                        "temperature": 0.3,
                        "messages": [
                            {
                                "role": "system",
                                "content": (
                                    "You rewrite quest copy for RPG Life. Return strict JSON object with key "
                                    "'items' and fields template_key, title, description for each item."
                                ),
                            },
                            {"role": "user", "content": prompt},
                        ],
                    },
                )
                response.raise_for_status()
                payload = response.json()
                raw_text = _extract_chat_content(payload)
            else:
                return None
    except Exception:
        logger.exception("Quest rewrite request failed for provider=%s", provider)
        return None

    if not raw_text:
        logger.warning("Quest rewrite returned no parseable text for provider=%s", provider)
        return None

    try:
        return json.loads(_extract_json_block(raw_text))
    except json.JSONDecodeError:
        logger.exception("Quest rewrite returned invalid JSON for provider=%s", provider)
        return None


def rewrite_generated_quests(
    db: Session,
    user: User,
    quests: list[dict],
    *,
    phase: int,
    level: int,
    blocked_titles: set[str] | None = None,
) -> list[dict]:
    if not is_enabled() or not quests:
        return quests

    style_hints = _recent_style_hints(db, user)
    prompt = _build_prompt(user=user, phase=phase, level=level, quests=quests, style_hints=style_hints)
    payload = _request_rewrites(prompt)
    if not payload:
        return quests

    rewritten_items = payload.get("items")
    if not isinstance(rewritten_items, list):
        logger.warning("OpenAI quest rewrite payload has no items array")
        return quests

    rewritten_by_key: dict[str, dict] = {}
    for item in rewritten_items:
        if not isinstance(item, dict):
            continue
        template_key = str(item.get("template_key", "") or "").strip()
        if not template_key:
            continue
        rewritten_by_key[template_key] = item

    result: list[dict] = []
    used_titles: set[str] = {str(title or "").strip().lower() for title in (blocked_titles or set()) if str(title or "").strip()}
    for quest in quests:
        template_key = str(quest.get("template_key", "") or "").strip()
        candidate = rewritten_by_key.get(template_key)
        if candidate and _is_rewrite_safe(quest, candidate):
            rewritten_title = str(candidate["title"]).strip()
            normalized_title = rewritten_title.lower()
            if normalized_title not in used_titles:
                updated = dict(quest)
                updated["title"] = rewritten_title
                updated["description"] = str(candidate["description"]).strip()
                result.append(updated)
                used_titles.add(normalized_title)
                continue
        result.append(quest)
        used_titles.add(str(quest.get("title", "") or "").strip().lower())

    return result

from __future__ import annotations

from datetime import date, datetime
from typing import Any

from .models import Item


def repair_mojibake(value: str | None) -> str | None:
    if not isinstance(value, str) or not value:
        return value

    markers = ("Р", "С", "р", "вЂ", "пїЅ", "Ѓ", "Ћ", "™")
    if not any(marker in value for marker in markers):
        return value

    for encoding in ("cp1251", "latin1"):
        try:
            repaired = value.encode(encoding).decode("utf-8")
        except (UnicodeEncodeError, UnicodeDecodeError):
            continue
        if repaired and repaired != value:
            return repaired
    return value


def normalize_nested_strings(payload: Any) -> Any:
    if isinstance(payload, dict):
        return {key: normalize_nested_strings(value) for key, value in payload.items()}
    if isinstance(payload, list):
        return [normalize_nested_strings(value) for value in payload]
    if isinstance(payload, (datetime, date)):
        return payload.isoformat()
    if isinstance(payload, str):
        return repair_mojibake(payload)
    return payload


def normalize_item_model(item: Item) -> Item:
    for field in (
        "name",
        "description",
        "type",
        "subclass",
        "slot",
        "rarity",
        "icon",
        "set_name",
        "required_class",
    ):
        value = getattr(item, field, None)
        fixed = repair_mojibake(value)
        if fixed != value:
            setattr(item, field, fixed)
    return item

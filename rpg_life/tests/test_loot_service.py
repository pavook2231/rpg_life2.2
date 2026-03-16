import pytest

from app.loot_service import roll_level_up_loot
from app.models import Item, User


def _create_user(session, email: str) -> User:
    user = User(email=email, hashed_password="hashed", is_active=True)
    session.add(user)
    session.commit()
    session.refresh(user)
    return user


def _create_item(session, *, name: str, rarity: str, required_level: int = 1) -> Item:
    item = Item(
        name=name,
        description=f"{rarity} item",
        type="accessory",
        slot="ring",
        rarity=rarity,
        required_level=required_level,
        is_unique=False,
    )
    session.add(item)
    session.commit()
    session.refresh(item)
    return item


def test_roll_level_up_loot_no_drop_without_luck_bonus(db_session, monkeypatch: pytest.MonkeyPatch) -> None:
    user = _create_user(db_session, "loot-base@example.com")
    _create_item(db_session, name="Common Ring", rarity="common")

    monkeypatch.setattr("app.loot_service.random.random", lambda: 0.31)

    result = roll_level_up_loot(db_session, user.id, level=1, loot_bonus=0.0)

    assert result is None


def test_roll_level_up_loot_drop_chance_increases_with_luck_bonus(db_session, monkeypatch: pytest.MonkeyPatch) -> None:
    user = _create_user(db_session, "loot-lucky@example.com")
    _create_item(db_session, name="Common Ring", rarity="common")

    monkeypatch.setattr("app.loot_service.random.random", lambda: 0.31)
    monkeypatch.setattr("app.loot_service.random.uniform", lambda _a, _b: 10.0)

    result = roll_level_up_loot(db_session, user.id, level=1, loot_bonus=0.20)

    assert result is not None
    assert result["rarity"] == "common"


def test_roll_level_up_loot_can_upgrade_rarity_with_high_luck(db_session, monkeypatch: pytest.MonkeyPatch) -> None:
    user = _create_user(db_session, "loot-upgrade@example.com")
    _create_item(db_session, name="Common Ring", rarity="common")
    _create_item(db_session, name="Uncommon Ring", rarity="uncommon")

    sequence = iter([0.0, 0.05, 0.95])
    monkeypatch.setattr("app.loot_service.random.random", lambda: next(sequence))
    monkeypatch.setattr("app.loot_service.random.uniform", lambda _a, _b: 1.0)

    result = roll_level_up_loot(db_session, user.id, level=1, loot_bonus=0.60)

    assert result is not None
    assert result["name"] == "Uncommon Ring"
    assert result["rarity"] == "uncommon"

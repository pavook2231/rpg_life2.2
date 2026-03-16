import pytest

from app.beta_content import CHEST_CATALOG
from app.models import User, UserClassProgress, UserInventory
from app.schemas.beta_schema import ChestOpenSchema
from app.services import beta_service, inventory_service
from app.items_data import ITEMS


def _create_user(session, email: str) -> User:
    user = User(email=email, hashed_password="hashed", is_active=True)
    session.add(user)
    session.commit()
    session.refresh(user)
    return user


def _create_progress(session, user_id: int, crystals: int = 500) -> UserClassProgress:
    progress = UserClassProgress(
        user_id=user_id,
        class_name="mage",
        display_name="Mage",
        is_unlocked=True,
        crystals=crystals,
    )
    session.add(progress)
    session.commit()
    session.refresh(progress)
    return progress


def test_shop_item_selection_rules(db_session):
    user = _create_user(db_session, "shop@example.com")
    _create_progress(db_session, user.id)

    context = inventory_service.get_shop_context(db_session, user)
    items = context["items"]

    # the mobile shop now exposes the full catalog for each type so players
    # can browse every asset-backed item in one place.  ensure duplicates are
    # gone and each type count matches the catalog.
    ids = [it["id"] for it in items]
    assert len(ids) == len(set(ids))

    counts: dict[str, int] = {}
    for it in items:
        counts[it.get("type", "")] = counts.get(it.get("type", ""), 0) + 1
    expected_counts: dict[str, int] = {}
    for item in ITEMS:
        item_type = item.get("type")
        if item_type:
            expected_counts[item_type] = expected_counts.get(item_type, 0) + 1
    expected_counts["chest"] = len(CHEST_CATALOG)

    for t, expected in expected_counts.items():
        assert counts.get(t, 0) == expected, f"expected {expected} items for type {t}, got {counts.get(t, 0)}"

    # no unexpected types
    for t in counts:
        if t:
            assert t in expected_counts

    # sanity: the catalog spans both low and high level entries
    levels_present = {it.get("required_level") for it in items}
    assert 1 in levels_present
    assert max(levels_present) >= 20


def test_shop_chest_purchase_adds_chest_to_inventory(db_session):
    user = _create_user(db_session, "shop-chest@example.com")
    progress = _create_progress(db_session, user.id, crystals=500)

    context = inventory_service.get_shop_context(db_session, user)
    chest = next(item for item in context["items"] if item.get("type") == "chest" and item.get("chest_name") == "COMMON_CHEST")
    before_inventory = db_session.query(UserInventory).filter(UserInventory.user_id == user.id).count()

    result = inventory_service.buy_shop_item(db_session, user, chest["id"])

    db_session.refresh(progress)
    after_inventory = db_session.query(UserInventory).filter(UserInventory.user_id == user.id).count()

    assert result["ok"] is True
    assert result["kind"] == "chest"
    assert result["chest_name"] == "COMMON_CHEST"
    assert result["inventory_id"]
    assert result["chest_item"]["name"]
    assert after_inventory == before_inventory + 1
    assert progress.crystals == 500 - chest["price_crystals"]


def test_shop_catalog_prioritizes_items_for_current_class(db_session):
    user = _create_user(db_session, "shop-archer@example.com")
    _create_progress(db_session, user.id, crystals=500).class_name = "archer"
    db_session.commit()

    context = inventory_service.get_shop_context(db_session, user)
    weapons = [item for item in context["items"] if item.get("type") == "weapon"]

    bow_index = next(index for index, item in enumerate(weapons) if item.get("subclass") == "bow")
    staff_index = next(index for index, item in enumerate(weapons) if item.get("subclass") == "staff")

    assert bow_index < staff_index


def test_inventory_chest_opens_without_second_purchase_charge(db_session, monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setattr(beta_service, "_draw_rarity", lambda: "rare")
    monkeypatch.setattr(beta_service.random, "choice", lambda items: items[0])

    user = _create_user(db_session, "shop-chest-open@example.com")
    progress = _create_progress(db_session, user.id, crystals=500)

    context = inventory_service.get_shop_context(db_session, user)
    chest = next(item for item in context["items"] if item.get("type") == "chest" and item.get("chest_name") == "COMMON_CHEST")

    purchase_result = inventory_service.buy_shop_item(db_session, user, chest["id"])
    db_session.refresh(progress)
    crystals_after_purchase = progress.crystals

    result = beta_service.open_chest(db_session, user, ChestOpenSchema(inventory_id=purchase_result["inventory_id"]))

    db_session.refresh(progress)

    assert result["opened_from_inventory"] is True
    assert result["item"]["name"]
    assert progress.crystals == crystals_after_purchase
    assert db_session.query(UserInventory).filter(UserInventory.user_id == user.id, UserInventory.id == purchase_result["inventory_id"]).count() == 0


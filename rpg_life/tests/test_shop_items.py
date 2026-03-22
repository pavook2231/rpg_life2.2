import pytest
from fastapi import HTTPException

from app.beta_content import CHEST_CATALOG
from app.models import CharacterEquipment, User, UserClassProgress, UserInventory
from app.schemas.beta_schema import ChestOpenSchema
from app.services import beta_service, inventory_service, mobile_service
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


def test_shop_item_can_be_equipped_unequipped_and_sold(db_session) -> None:
    user = _create_user(db_session, "shop-equip-sell@example.com")
    progress = _create_progress(db_session, user.id, crystals=500)

    context = inventory_service.get_shop_context(db_session, user)
    armor = next(item for item in context["items"] if item.get("id") == 1101)

    result = inventory_service.buy_shop_item(db_session, user, armor["id"])
    assert result["ok"] is True
    assert result["kind"] == "item"

    inventory_item = (
        db_session.query(UserInventory)
        .filter(UserInventory.user_id == user.id)
        .order_by(UserInventory.id.desc())
        .first()
    )
    assert inventory_item is not None

    equip_result = inventory_service.equip_inventory_item(db_session, user, inventory_item.id, "chest", progress.id)
    detail_after_equip = inventory_service.get_inventory_item_detail(db_session, user, inventory_item.id)

    assert equip_result["ok"] is True
    assert detail_after_equip["is_equipped"] is True

    with pytest.raises(HTTPException) as sell_exc:
        inventory_service.sell_inventory_item(db_session, user, inventory_item.id)

    assert sell_exc.value.status_code == 400

    unequip_result = inventory_service.unequip_inventory_item(db_session, user, inventory_item.id)
    detail_after_unequip = inventory_service.get_inventory_item_detail(db_session, user, inventory_item.id)

    assert unequip_result["ok"] is True
    assert detail_after_unequip["is_equipped"] is False

    sell_result = inventory_service.sell_inventory_item(db_session, user, inventory_item.id)

    assert sell_result["ok"] is True
    assert sell_result["sell_price"] > 0
    assert db_session.query(UserInventory).filter(UserInventory.id == inventory_item.id).count() == 0


def test_shop_item_stats_stay_consistent_after_purchase_and_equip(db_session) -> None:
    user = _create_user(db_session, "shop-consistency@example.com")
    progress = _create_progress(db_session, user.id, crystals=2_000)
    progress.class_name = "warrior"
    progress.display_name = "Warrior"
    progress.level = 12
    db_session.commit()

    context = inventory_service.get_shop_context(db_session, user)
    shop_item = next(item for item in context["items"] if item.get("id") == 205)

    purchase_result = inventory_service.buy_shop_item(db_session, user, shop_item["id"])
    assert purchase_result["ok"] is True

    inventory_item = (
        db_session.query(UserInventory)
        .filter(UserInventory.user_id == user.id)
        .order_by(UserInventory.id.desc())
        .first()
    )
    assert inventory_item is not None

    detail_before_equip = inventory_service.get_inventory_item_detail(db_session, user, inventory_item.id)
    equip_result = inventory_service.equip_inventory_item(db_session, user, inventory_item.id, "main_hand", progress.id)
    equipment_context = inventory_service.build_character_inventory_context(db_session, user, None)

    assert equip_result["ok"] is True
    assert detail_before_equip["item"]["strength_bonus"] == shop_item["stats"]["strength_bonus"]
    assert detail_before_equip["item"]["stamina_bonus"] == shop_item["stats"]["stamina_bonus"]
    assert detail_before_equip["weapon_stats"]["damage_min"] == shop_item["weapon_stats"]["damage_min"]
    assert detail_before_equip["weapon_stats"]["damage_max"] == shop_item["weapon_stats"]["damage_max"]

    equipped_main_hand = equipment_context["equipment"]["main_hand"]
    assert equipped_main_hand["inventory_id"] == inventory_item.id
    assert equipped_main_hand["item"].strength_bonus == shop_item["stats"]["strength_bonus"]
    assert equipped_main_hand["item"].stamina_bonus == shop_item["stats"]["stamina_bonus"]
    assert equipped_main_hand["weapon_stats"].damage_min == shop_item["weapon_stats"]["damage_min"]
    assert equipped_main_hand["weapon_stats"].damage_max == shop_item["weapon_stats"]["damage_max"]


def test_inventory_list_payload_keeps_top_level_item_stats_consistent(db_session) -> None:
    user = _create_user(db_session, "shop-inventory-payload@example.com")
    progress = _create_progress(db_session, user.id, crystals=2_000)
    progress.class_name = "warrior"
    progress.display_name = "Warrior"
    progress.level = 12
    db_session.commit()

    context = inventory_service.get_shop_context(db_session, user)
    shop_item = next(item for item in context["items"] if item.get("id") == 205)
    purchase_result = inventory_service.buy_shop_item(db_session, user, shop_item["id"])

    assert purchase_result["ok"] is True

    inventory_payload = inventory_service.get_inventory_payload(db_session, user)
    inventory_entry = inventory_payload["inventory"][0]
    detail_payload = inventory_service.get_inventory_item_detail(db_session, user, inventory_entry["id"])

    assert inventory_entry["item"]["strength_bonus"] == shop_item["stats"]["strength_bonus"]
    assert inventory_entry["item"]["stamina_bonus"] == shop_item["stats"]["stamina_bonus"]
    assert inventory_entry["weapon_stats"]["damage_min"] == shop_item["weapon_stats"]["damage_min"]
    assert inventory_entry["weapon_stats"]["damage_max"] == shop_item["weapon_stats"]["damage_max"]
    assert inventory_entry["weapon_stats"]["damage_min"] == detail_payload["weapon_stats"]["damage_min"]
    assert inventory_entry["weapon_stats"]["damage_max"] == detail_payload["weapon_stats"]["damage_max"]


def test_crit_bonus_stays_consistent_between_shop_inventory_and_character(db_session) -> None:
    user = _create_user(db_session, "shop-crit-consistency@example.com")
    progress = _create_progress(db_session, user.id, crystals=2_000)
    progress.class_name = "archer"
    progress.display_name = "Archer"
    progress.level = 20
    db_session.commit()

    context = inventory_service.get_shop_context(db_session, user)
    shop_item = next(item for item in context["items"] if item.get("id") == 1205)

    purchase_result = inventory_service.buy_shop_item(db_session, user, shop_item["id"])
    assert purchase_result["ok"] is True

    inventory_item = (
        db_session.query(UserInventory)
        .filter(UserInventory.user_id == user.id)
        .order_by(UserInventory.id.desc())
        .first()
    )
    assert inventory_item is not None

    detail_payload = inventory_service.get_inventory_item_detail(db_session, user, inventory_item.id)
    inventory_payload = inventory_service.get_inventory_payload(db_session, user)
    equip_result = inventory_service.equip_inventory_item(db_session, user, inventory_item.id, "head", progress.id)
    equipment_payload = mobile_service.get_equipment_overview(db_session, user)

    assert equip_result["ok"] is True
    assert shop_item["required_class"] == "archer"
    assert shop_item["agility_bonus"] == shop_item["stats"]["agility_bonus"]
    assert shop_item["critical_bonus"] == shop_item["stats"]["critical_bonus"]
    assert detail_payload["item"]["critical_bonus"] == shop_item["stats"]["critical_bonus"]
    assert detail_payload["item"].get("strength_bonus", 0) == shop_item["stats"].get("strength_bonus", 0)
    assert detail_payload["item"].get("stamina_bonus", 0) == shop_item["stats"].get("stamina_bonus", 0)
    assert detail_payload["item"]["price_crystals"] == shop_item["price_crystals"]
    assert detail_payload["item"]["required_class"] == shop_item["required_class"]
    assert detail_payload["item"]["stats"]["critical_bonus"] == shop_item["stats"]["critical_bonus"]
    assert inventory_payload["inventory"][0]["item"]["critical_bonus"] == shop_item["stats"]["critical_bonus"]
    assert inventory_payload["inventory"][0]["item"]["price_crystals"] == shop_item["price_crystals"]
    assert inventory_payload["inventory"][0]["item"]["required_class"] == shop_item["required_class"]
    equipped_head = next(entry for entry in equipment_payload["equipment"] if entry["slot"] == "head")
    assert equipped_head["item"]["critical_bonus"] == shop_item["stats"]["critical_bonus"]
    assert equipped_head["item"]["agility_bonus"] == shop_item["stats"]["agility_bonus"]
    assert equipped_head["item"]["price_crystals"] == shop_item["price_crystals"]
    assert equipped_head["item"]["required_class"] == shop_item["required_class"]
    assert equipped_head["item"]["stats"]["critical_bonus"] == shop_item["stats"]["critical_bonus"]


def test_equipping_two_hand_weapon_clears_off_hand_and_returns_item_to_bag(db_session) -> None:
    user = _create_user(db_session, "shop-two-hand@example.com")
    progress = _create_progress(db_session, user.id, crystals=2_000)
    progress.class_name = "warrior"
    progress.display_name = "Warrior"
    progress.level = 12
    db_session.commit()

    inventory_service.buy_shop_item(db_session, user, 101)
    inventory_service.buy_shop_item(db_session, user, 205)

    inventory_rows = (
        db_session.query(UserInventory)
        .filter(UserInventory.user_id == user.id)
        .order_by(UserInventory.id.asc())
        .all()
    )
    off_hand_item = inventory_rows[0]
    two_hand_item = inventory_rows[-1]

    off_hand_result = inventory_service.equip_inventory_item(db_session, user, off_hand_item.id, "off_hand", progress.id)
    two_hand_result = inventory_service.equip_inventory_item(db_session, user, two_hand_item.id, "main_hand", progress.id)
    off_hand_detail = inventory_service.get_inventory_item_detail(db_session, user, off_hand_item.id)
    two_hand_detail = inventory_service.get_inventory_item_detail(db_session, user, two_hand_item.id)
    equipment_row = (
        db_session.query(CharacterEquipment)
        .filter(CharacterEquipment.user_id == user.id, CharacterEquipment.class_progress_id == progress.id)
        .one()
    )
    equipment_context = inventory_service.build_character_inventory_context(db_session, user, None)
    bag_ids = {item.id for item in equipment_context["bag_items"]}

    assert off_hand_result["ok"] is True
    assert two_hand_result["ok"] is True
    assert equipment_row.main_hand_id == two_hand_item.id
    assert equipment_row.off_hand_id is None
    assert two_hand_detail["is_equipped"] is True
    assert off_hand_detail["is_equipped"] is False
    assert "off_hand" not in equipment_context["equipment"]
    assert off_hand_item.id in bag_ids


def test_build_character_context_prunes_stale_off_hand_reference(db_session) -> None:
    user = _create_user(db_session, "shop-stale-slot@example.com")
    progress = _create_progress(db_session, user.id, crystals=500)

    equipment_row = CharacterEquipment(user_id=user.id, class_progress_id=progress.id, off_hand_id=999999)
    db_session.add(equipment_row)
    db_session.commit()

    context = inventory_service.build_character_inventory_context(db_session, user, None)
    db_session.refresh(equipment_row)

    assert context["equipment"] == {}
    assert equipment_row.off_hand_id is None


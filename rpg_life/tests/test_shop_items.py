import pytest
from fastapi import HTTPException
from datetime import timedelta

from app.beta_content import CHEST_CATALOG
from app.core.dates import utc_now
from app import item_service
from app import shop_runtime
from app.models import CharacterEquipment, Item, User, UserClassProgress, UserInventory
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


def test_shop_context_exposes_healer_services_with_stateful_availability(db_session):
    user = _create_user(db_session, "shop-services@example.com")
    progress = _create_progress(db_session, user.id, crystals=500)
    progress.level = 5
    progress.max_health = 200
    progress.current_health = 120
    progress.reward_penalty_percent = 0.0
    progress.penalty_quests_remaining = 0
    progress.wounded_until = None
    db_session.commit()

    healthy_context = inventory_service.get_shop_context(db_session, user)
    services = {service["key"]: service for service in healthy_context["services"]}

    assert set(services.keys()) == {"bandage", "full_heal", "wound_cure"}
    assert services["bandage"]["id"] == -9101
    assert services["full_heal"]["id"] == -9102
    assert services["wound_cure"]["id"] == -9103
    assert services["bandage"]["price_crystals"] == 60
    assert services["full_heal"]["price_crystals"] == 95
    assert services["wound_cure"]["price_crystals"] == 135
    assert services["bandage"]["available"] is True
    assert services["full_heal"]["available"] is True
    assert services["wound_cure"]["available"] is False
    assert services["wound_cure"]["unavailable_reason"] == "Hero is not wounded"

    progress.current_health = 40
    progress.reward_penalty_percent = 0.25
    progress.penalty_quests_remaining = 2
    progress.wounded_until = utc_now() + timedelta(hours=2)
    db_session.commit()

    wounded_context = inventory_service.get_shop_context(db_session, user)
    wounded_services = {service["key"]: service for service in wounded_context["services"]}

    assert wounded_services["bandage"]["available"] is False
    assert wounded_services["full_heal"]["available"] is False
    assert wounded_services["wound_cure"]["available"] is True


def test_shop_service_bandage_purchase_restores_partial_health_and_spends_gold(db_session):
    user = _create_user(db_session, "shop-bandage@example.com")
    progress = _create_progress(db_session, user.id, crystals=500)
    progress.level = 5
    progress.max_health = 200
    progress.current_health = 100
    progress.reward_penalty_percent = 0.0
    progress.penalty_quests_remaining = 0
    progress.wounded_until = None
    db_session.commit()

    result = inventory_service.buy_shop_item(db_session, user, -9101)

    db_session.refresh(progress)
    assert result["ok"] is True
    assert result["kind"] == "service"
    assert result["service_key"] == "bandage"
    assert result["health"]["current_health"] == 170
    assert progress.current_health == 170
    assert progress.crystals == 440


def test_shop_service_wound_cure_clears_penalty_and_restores_full_health(db_session):
    user = _create_user(db_session, "shop-wound-cure@example.com")
    progress = _create_progress(db_session, user.id, crystals=500)
    progress.level = 5
    progress.max_health = 180
    progress.current_health = 36
    progress.reward_penalty_percent = 0.25
    progress.penalty_quests_remaining = 3
    progress.wounded_until = utc_now() + timedelta(hours=12)
    db_session.commit()

    result = inventory_service.buy_shop_item(db_session, user, -9103)

    db_session.refresh(progress)
    assert result["ok"] is True
    assert result["kind"] == "service"
    assert result["service_key"] == "wound_cure"
    assert result["health"]["is_wounded"] is False
    assert progress.current_health == 180
    assert progress.reward_penalty_percent == 0.0
    assert progress.penalty_quests_remaining == 0
    assert progress.wounded_until is None
    assert progress.crystals == 365


def test_shop_service_purchase_rejects_unavailable_or_unknown_service(db_session):
    user = _create_user(db_session, "shop-service-errors@example.com")
    progress = _create_progress(db_session, user.id, crystals=500)
    progress.level = 5
    progress.max_health = 150
    progress.current_health = 150
    progress.reward_penalty_percent = 0.0
    progress.penalty_quests_remaining = 0
    progress.wounded_until = None
    db_session.commit()

    with pytest.raises(HTTPException) as unavailable_exc:
        inventory_service.buy_shop_item(db_session, user, -9101)
    assert unavailable_exc.value.status_code == 400
    assert "Health is already full" in unavailable_exc.value.detail

    with pytest.raises(HTTPException) as unknown_exc:
        inventory_service.buy_shop_item(db_session, user, -9199)
    assert unknown_exc.value.status_code == 400


def test_mobile_shop_payload_and_buy_alias_support_services(db_session):
    user = _create_user(db_session, "shop-mobile-services@example.com")
    progress = _create_progress(db_session, user.id, crystals=500)
    progress.level = 6
    progress.max_health = 220
    progress.current_health = 110
    progress.reward_penalty_percent = 0.0
    progress.penalty_quests_remaining = 0
    progress.wounded_until = None
    db_session.commit()

    payload = mobile_service.get_shop(db_session, user)
    assert "services" in payload
    assert len(payload["services"]) == 3
    assert payload["services"][0]["id"] < 0

    purchase_payload = mobile_service.buy_shop_item(db_session, user, -9102)
    assert purchase_payload["kind"] == "service"
    assert purchase_payload["service_key"] == "full_heal"
    assert purchase_payload["health"]["current_health"] == purchase_payload["health"]["max_health"]


def test_shop_context_exposes_extra_shop_catalogs_and_tabs(db_session):
    user = _create_user(db_session, "shop-extra-catalogs@example.com")
    progress = _create_progress(db_session, user.id, crystals=2_000)
    progress.class_name = "warrior"
    progress.level = 12
    db_session.commit()

    inventory_service.buy_shop_item(db_session, user, 205)
    context = inventory_service.get_shop_context(db_session, user)

    assert len(context["services"]) == 3
    assert len(context["xp_scrolls"]) == 5
    assert len(context["quest_contracts"]) == 3
    assert len(context["weapon_enchants"]) == 4
    assert [entry["key"] for entry in context["catalog_tabs"]] == [
        "equipment",
        "xp_scrolls",
        "contracts",
        "enchants",
        "services",
    ]


def test_shop_xp_scroll_purchase_grants_xp_and_spends_gold(db_session):
    user = _create_user(db_session, "shop-scroll@example.com")
    progress = _create_progress(db_session, user.id, crystals=500)
    progress.current_xp = 0
    db_session.commit()

    before_gold = progress.crystals
    result = inventory_service.buy_shop_item(db_session, user, -9201)
    db_session.refresh(progress)

    assert result["ok"] is True
    assert result["kind"] == "xp_scroll"
    assert result["scroll_key"] == "xp_scroll_100"
    assert result["xp_gained"] == 100
    assert result["new_xp"] == progress.current_xp
    assert progress.crystals == before_gold - int(shop_runtime.XP_SCROLL_BY_ID[-9201]["price_crystals"])


def test_shop_contract_purchase_activates_cached_bonus(db_session):
    user = _create_user(db_session, "shop-contract@example.com")
    progress = _create_progress(db_session, user.id, crystals=1_000)
    db_session.commit()

    before_gold = progress.crystals
    result = inventory_service.buy_shop_item(db_session, user, -9301)
    db_session.refresh(progress)
    active_contract = shop_runtime.get_active_contract(user.id)

    assert result["ok"] is True
    assert result["kind"] == "contract"
    assert result["contract"]["key"] == "contract_adventurer"
    assert result["contract"]["remaining_quests"] == 3
    assert active_contract is not None
    assert active_contract["key"] == "contract_adventurer"
    assert progress.crystals == before_gold - int(shop_runtime.QUEST_CONTRACT_BY_ID[-9301]["price_crystals"])


def test_shop_weapon_enchant_purchase_applies_to_selected_weapon(db_session):
    user = _create_user(db_session, "shop-enchant@example.com")
    progress = _create_progress(db_session, user.id, crystals=3_000)
    progress.class_name = "warrior"
    progress.level = 12
    db_session.commit()

    shop_context = inventory_service.get_shop_context(db_session, user)
    weapon_entry = next(item for item in shop_context["items"] if item.get("id") == 205)
    inventory_service.buy_shop_item(db_session, user, 205)
    weapon_inventory = (
        db_session.query(UserInventory)
        .filter(UserInventory.user_id == user.id, UserInventory.item_id == 205)
        .order_by(UserInventory.id.desc())
        .first()
    )
    assert weapon_inventory is not None

    db_session.refresh(progress)
    before_gold = progress.crystals
    result = inventory_service.buy_shop_item(db_session, user, -9401, target_inventory_id=weapon_inventory.id)
    db_session.refresh(progress)
    enchant_payload = shop_runtime.get_weapon_enchant_for_inventory(user.id, weapon_inventory.id)

    assert result["ok"] is True
    assert result["kind"] == "enchant"
    assert result["target_inventory_id"] == weapon_inventory.id
    assert result["target_weapon_name"]
    assert enchant_payload is not None
    assert enchant_payload["key"] == "enchant_might"
    expected_spent = int(shop_runtime.WEAPON_ENCHANT_BY_ID[-9401]["price_crystals"])
    assert progress.crystals == before_gold - expected_spent
    assert int(weapon_entry["price_crystals"]) > 0


def test_shop_purchase_idempotency_replays_without_double_charge(db_session):
    user = _create_user(db_session, "shop-idempotency@example.com")
    progress = _create_progress(db_session, user.id, crystals=500)
    db_session.commit()

    request_id = "shop-buy-req-001"
    first = inventory_service.buy_shop_item(db_session, user, -9201, client_request_id=request_id)
    second = inventory_service.buy_shop_item(db_session, user, -9201, client_request_id=request_id)
    db_session.refresh(progress)

    assert first["kind"] == "xp_scroll"
    assert first["idempotency_replayed"] is False
    assert second["kind"] == "xp_scroll"
    assert second["idempotency_replayed"] is True
    assert second["client_request_id"] == request_id
    assert progress.crystals == 500 - int(shop_runtime.XP_SCROLL_BY_ID[-9201]["price_crystals"])


def test_shop_purchase_rejects_invalid_client_request_id(db_session):
    user = _create_user(db_session, "shop-invalid-idempotency@example.com")
    _create_progress(db_session, user.id, crystals=500)
    db_session.commit()

    with pytest.raises(HTTPException) as exc:
        inventory_service.buy_shop_item(db_session, user, -9201, client_request_id="bad id")

    assert exc.value.status_code == 400
    assert "client_request_id" in exc.value.detail


def test_shop_purchase_rejects_when_distributed_lock_is_busy(db_session, monkeypatch: pytest.MonkeyPatch):
    user = _create_user(db_session, "shop-lock-busy@example.com")
    _create_progress(db_session, user.id, crystals=500)
    db_session.commit()

    monkeypatch.setattr(inventory_service, "cache_acquire_lock", lambda *_args, **_kwargs: False)

    with pytest.raises(HTTPException) as exc:
        inventory_service.buy_shop_item(db_session, user, -9201, client_request_id="shop-lock-busy-001")

    assert exc.value.status_code == 409
    assert "already processing" in exc.value.detail


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


def test_sync_catalog_repairs_legacy_duplicate_item_ids(db_session) -> None:
    user = _create_user(db_session, "shop-repair@example.com")
    _create_progress(db_session, user.id, crystals=500)

    legacy_item = Item(
        name="Ржавый меч",
        description="legacy duplicate",
        type="weapon",
        rarity="common",
        icon="legacy-sword",
        price_crystals=1,
        required_level=1,
    )
    db_session.add(legacy_item)
    db_session.flush()

    inventory_row = UserInventory(user_id=user.id, item_id=legacy_item.id, quantity=1)
    db_session.add(inventory_row)
    db_session.commit()
    db_session.refresh(inventory_row)

    canonical_item = item_service.ensure_catalog_item(db_session, 101)
    db_session.commit()
    db_session.refresh(inventory_row)

    assert canonical_item.id == 101
    assert inventory_row.item_id == 101
    assert db_session.query(Item).filter(Item.id == legacy_item.id).count() == 0


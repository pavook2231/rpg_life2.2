from app.models import Item, ItemWeaponStats, User, UserClassProgress, UserInventory
from app.services import inventory_service


def _create_user(db_session, email: str = "equip@example.com") -> User:
    user = User(email=email, hashed_password="hashed", is_active=True)
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user


def _create_progress(
    db_session,
    user_id: int,
    *,
    class_name: str = "warrior",
    level: int = 10,
) -> UserClassProgress:
    progress = UserClassProgress(
        user_id=user_id,
        class_name=class_name,
        display_name=class_name,
        level=level,
        strength=15,
        agility=10,
        intellect=5,
        stamina=12,
        is_unlocked=True,
    )
    db_session.add(progress)
    db_session.commit()
    db_session.refresh(progress)
    return progress


def _create_warrior_axe_inventory(db_session, user_id: int) -> UserInventory:
    item = Item(
        name="Боевой топор",
        description="Тестовый топор",
        type="weapon",
        subclass="axe",
        rarity="uncommon",
        price_crystals=100,
        required_level=7,
        required_class="warrior",
    )
    db_session.add(item)
    db_session.flush()

    stats = ItemWeaponStats(
        item_id=item.id,
        weapon_type="one_hand_axe",
        weapon_category="one_hand",
        damage_min=10,
        damage_max=16,
        dps=6.0,
    )
    db_session.add(stats)
    db_session.flush()

    inventory_item = UserInventory(user_id=user_id, item_id=item.id, quantity=1, is_equipped=False)
    db_session.add(inventory_item)
    db_session.commit()
    db_session.refresh(inventory_item)
    return inventory_item


def test_equip_inventory_item_accepts_weapon_slot_alias(db_session) -> None:
    user = _create_user(db_session, "equip-alias@example.com")
    progress = _create_progress(db_session, user.id, class_name="warrior", level=10)
    inventory_item = _create_warrior_axe_inventory(db_session, user.id)

    result = inventory_service.equip_inventory_item(db_session, user, inventory_item.id, "weapon", progress.id)

    assert result["ok"] is True


def test_equip_inventory_item_accepts_camel_case_slot_and_class_case(db_session) -> None:
    user = _create_user(db_session, "equip-camel@example.com")
    progress = _create_progress(db_session, user.id, class_name="Warrior", level=10)
    inventory_item = _create_warrior_axe_inventory(db_session, user.id)

    result = inventory_service.equip_inventory_item(db_session, user, inventory_item.id, "mainHand", progress.id)

    assert result["ok"] is True

from app.models import Item, User, UserClassProgress, UserInventory
from app.services import crafting_service
from app import item_service


def _create_user(session, email: str) -> User:
    user = User(email=email, hashed_password="hashed", is_active=True)
    session.add(user)
    session.commit()
    session.refresh(user)
    return user


def _create_progress(session, user_id: int, *, level: int = 6) -> UserClassProgress:
    progress = UserClassProgress(
        user_id=user_id,
        class_name="warrior",
        display_name="Warrior",
        is_unlocked=True,
        level=level,
    )
    session.add(progress)
    session.commit()
    session.refresh(progress)
    return progress


def _grant_resource(session, user_id: int, key: str, amount: int) -> None:
    row = crafting_service._resource_inventory_row(session, user_id, key)
    row.quantity = amount
    session.commit()


def test_craft_recipe_consumes_resources_and_grants_item(db_session) -> None:
    user = _create_user(db_session, "crafter@example.com")
    _create_progress(db_session, user.id, level=6)
    _grant_resource(db_session, user.id, "iron_shard", 4)

    result = crafting_service.craft_recipe(db_session, user, "forge_steel_sword")

    crafted_item = result["crafted_item"]
    inventory_item = db_session.query(UserInventory).filter(UserInventory.id == crafted_item["inventory_id"]).one()

    assert crafted_item["name"]
    assert inventory_item.quantity == 1
    assert crafting_service._resource_inventory_row(db_session, user.id, "iron_shard").quantity == 0


def test_upgrade_item_replaces_inventory_item_with_upgraded_version(db_session) -> None:
    user = _create_user(db_session, "upgrader@example.com")
    _create_progress(db_session, user.id, level=6)
    _grant_resource(db_session, user.id, "iron_shard", 3)

    base_item = item_service.ensure_catalog_item(db_session, 101)
    inventory_item = UserInventory(user_id=user.id, item_id=base_item.id, quantity=1)
    db_session.add(inventory_item)
    db_session.commit()
    db_session.refresh(inventory_item)

    result = crafting_service.upgrade_item(db_session, user, inventory_item.id)

    upgraded_db_item = db_session.query(Item).filter(Item.id == inventory_item.item_id).one()

    assert result["upgraded_item"]["name"] == upgraded_db_item.name
    assert upgraded_db_item.name != base_item.name
    assert crafting_service._resource_inventory_row(db_session, user.id, "iron_shard").quantity == 0


def test_get_crafting_overview_reads_seeded_catalog_from_database(db_session) -> None:
    user = _create_user(db_session, "overview@example.com")
    _create_progress(db_session, user.id, level=6)
    _grant_resource(db_session, user.id, "iron_shard", 2)

    overview = crafting_service.get_crafting_overview(db_session, user)

    recipe = next(entry for entry in overview["recipes"] if entry["id"] == "forge_steel_sword")
    resource = next(entry for entry in overview["resources"] if entry["key"] == "iron_shard")

    assert recipe["ingredients"] == {"iron_shard": 4}
    assert recipe["can_craft"] is True
    assert resource["quantity"] == 2

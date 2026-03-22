from __future__ import annotations

import random

from fastapi import HTTPException
from sqlalchemy.orm import Session, joinedload

from app.item_service import ensure_catalog_item, find_catalog_item_data
from app.models import (
    CraftingRecipe,
    CraftingRecipeIngredient,
    CraftingResource,
    Item,
    ItemUpgradePath,
    User,
    UserClassProgress,
    UserInventory,
)

DEFAULT_RESOURCES = [
    {
        "key": "iron_shard",
        "name": "Iron Shard",
        "description": "A rough shard used in basic weapon crafting.",
        "icon": "pickaxe",
        "rarity": "common",
        "price_crystals": 0,
    },
    {
        "key": "oak_resin",
        "name": "Oak Resin",
        "description": "Flexible resin for bows and lightweight gear.",
        "icon": "pine-tree",
        "rarity": "common",
        "price_crystals": 0,
    },
    {
        "key": "arcane_dust",
        "name": "Arcane Dust",
        "description": "Magical dust used in staff crafting and upgrades.",
        "icon": "creation",
        "rarity": "uncommon",
        "price_crystals": 0,
    },
]

DEFAULT_RECIPES = [
    {
        "key": "forge_steel_sword",
        "title": "Forge Steel Sword",
        "result_item_id": 201,
        "ingredients": {"iron_shard": 4},
        "required_level": 5,
    },
    {
        "key": "craft_hunters_bow",
        "title": "Craft Hunter Bow",
        "result_item_id": 202,
        "ingredients": {"oak_resin": 4},
        "required_level": 5,
    },
    {
        "key": "bind_apprentice_staff",
        "title": "Bind Elder Staff",
        "result_item_id": 203,
        "ingredients": {"arcane_dust": 4},
        "required_level": 5,
    },
]

DEFAULT_UPGRADE_PATHS = [
    {"from_item_id": 101, "to_item_id": 201, "resource_key": "iron_shard", "quantity": 3},
    {"from_item_id": 102, "to_item_id": 202, "resource_key": "oak_resin", "quantity": 3},
    {"from_item_id": 103, "to_item_id": 203, "resource_key": "arcane_dust", "quantity": 3},
]


def _ensure_seed_data(db: Session) -> None:
    if db.query(CraftingResource.id).first():
        return

    resources_by_key: dict[str, CraftingResource] = {}
    for resource_data in DEFAULT_RESOURCES:
        resource = CraftingResource(**resource_data)
        db.add(resource)
        db.flush()
        resources_by_key[resource.key] = resource

    for recipe_data in DEFAULT_RECIPES:
        recipe = CraftingRecipe(
            key=recipe_data["key"],
            title=recipe_data["title"],
            result_item_id=recipe_data["result_item_id"],
            required_level=recipe_data["required_level"],
        )
        db.add(recipe)
        db.flush()
        for resource_key, quantity in recipe_data["ingredients"].items():
            db.add(
                CraftingRecipeIngredient(
                    recipe_id=recipe.id,
                    resource_id=resources_by_key[resource_key].id,
                    quantity=quantity,
                )
            )

    for path_data in DEFAULT_UPGRADE_PATHS:
        db.add(
            ItemUpgradePath(
                from_item_id=path_data["from_item_id"],
                to_item_id=path_data["to_item_id"],
                resource_id=resources_by_key[path_data["resource_key"]].id,
                quantity=path_data["quantity"],
            )
        )

    db.commit()


def _main_progress(db: Session, user_id: int) -> UserClassProgress | None:
    return (
        db.query(UserClassProgress)
        .filter(UserClassProgress.user_id == user_id, UserClassProgress.is_unlocked == True)
        .order_by(UserClassProgress.id.asc())
        .first()
    )


def _resource_definition(db: Session, resource_key: str) -> CraftingResource:
    _ensure_seed_data(db)
    resource = db.query(CraftingResource).filter(CraftingResource.key == resource_key).first()
    if resource is None:
        raise HTTPException(status_code=404, detail="Crafting resource not found")
    return resource


def _resource_definitions(db: Session) -> list[CraftingResource]:
    _ensure_seed_data(db)
    return db.query(CraftingResource).order_by(CraftingResource.id.asc()).all()


def _ensure_resource_item(db: Session, resource_key: str) -> Item:
    definition = _resource_definition(db, resource_key)

    item = db.query(Item).filter(Item.name == definition.name).first()
    if item:
        return item

    item = Item(
        name=definition.name,
        description=definition.description,
        type="resource",
        rarity=definition.rarity,
        icon=definition.icon,
        price_crystals=definition.price_crystals,
        required_level=1,
    )
    db.add(item)
    db.flush()
    return item


def _resource_inventory_row(db: Session, user_id: int, resource_key: str) -> UserInventory:
    resource_item = _ensure_resource_item(db, resource_key)
    inventory_row = (
        db.query(UserInventory)
        .filter(UserInventory.user_id == user_id, UserInventory.item_id == resource_item.id)
        .first()
    )
    if inventory_row is None:
        inventory_row = UserInventory(user_id=user_id, item_id=resource_item.id, quantity=0)
        db.add(inventory_row)
        db.flush()
    return inventory_row


def _resource_counts(db: Session, user_id: int) -> dict[str, int]:
    counts: dict[str, int] = {}
    for resource in _resource_definitions(db):
        counts[resource.key] = _resource_inventory_row(db, user_id, resource.key).quantity
    return counts


def _serialize_resource_state(db: Session, user_id: int) -> list[dict]:
    counts = _resource_counts(db, user_id)
    return [
        {
            "key": resource.key,
            "name": resource.name,
            "description": resource.description,
            "icon": resource.icon,
            "quantity": counts.get(resource.key, 0),
        }
        for resource in _resource_definitions(db)
    ]


def _consume_resources(db: Session, user_id: int, cost: dict[str, int]) -> None:
    for resource_key, required_amount in cost.items():
        row = _resource_inventory_row(db, user_id, resource_key)
        if row.quantity < required_amount:
            raise HTTPException(status_code=400, detail=f"Not enough resource: {resource_key}")

    for resource_key, required_amount in cost.items():
        row = _resource_inventory_row(db, user_id, resource_key)
        row.quantity -= required_amount


def _grant_item_to_inventory(db: Session, user_id: int, item: Item) -> UserInventory:
    inventory_item = UserInventory(user_id=user_id, item_id=item.id, quantity=1)
    db.add(inventory_item)
    db.flush()
    return inventory_item


def _serialize_recipe(recipe: CraftingRecipe, progress: UserClassProgress | None) -> dict:
    item_data = find_catalog_item_data(recipe.result_item_id)
    return {
        "id": recipe.key,
        "title": recipe.title,
        "required_level": recipe.required_level,
        "can_craft": bool(progress and progress.level >= recipe.required_level),
        "ingredients": {ingredient.resource.key: ingredient.quantity for ingredient in recipe.ingredients},
        "result": item_data,
    }


def _upgrade_payload(path: ItemUpgradePath, inventory_id: int) -> dict:
    return {
        "inventory_id": inventory_id,
        "from_item_id": path.from_item_id,
        "to_item_id": path.to_item_id,
        "cost": {path.resource.key: path.quantity},
        "current_item": find_catalog_item_data(path.from_item_id),
        "upgraded_item": find_catalog_item_data(path.to_item_id),
    }


def grant_random_crafting_resource(db: Session, user_id: int) -> dict | None:
    resources = _resource_definitions(db)
    resource = random.choice(resources)
    row = _resource_inventory_row(db, user_id, resource.key)
    row.quantity += 1
    db.commit()
    return {
        "name": resource.name,
        "description": resource.description,
        "icon": resource.icon,
    }


def get_crafting_overview(db: Session, current_user: User) -> dict:
    _ensure_seed_data(db)
    progress = _main_progress(db, current_user.id)
    resources = _serialize_resource_state(db, current_user.id)

    recipes = [
        _serialize_recipe(recipe, progress)
        for recipe in db.query(CraftingRecipe)
        .options(joinedload(CraftingRecipe.ingredients).joinedload(CraftingRecipeIngredient.resource))
        .order_by(CraftingRecipe.id.asc())
        .all()
    ]

    upgrade_paths = (
        db.query(ItemUpgradePath)
        .options(joinedload(ItemUpgradePath.resource))
        .order_by(ItemUpgradePath.id.asc())
        .all()
    )
    path_by_item_id = {}
    for path in upgrade_paths:
        path_by_item_id[path.from_item_id] = path

    owned_items = (
        db.query(UserInventory)
        .options(joinedload(UserInventory.item))
        .filter(UserInventory.user_id == current_user.id)
        .all()
    )
    upgrades = []
    for inventory_item in owned_items:
        if inventory_item.item is None:
            continue
        path = path_by_item_id.get(inventory_item.item_id)
        if path is None:
            continue
        upgrades.append(_upgrade_payload(path, inventory_item.id))

    return {
        "resources": resources,
        "recipes": recipes,
        "upgrades": upgrades,
        "level": progress.level if progress else 1,
    }


def craft_recipe(db: Session, current_user: User, recipe_id: str) -> dict:
    _ensure_seed_data(db)
    recipe = (
        db.query(CraftingRecipe)
        .options(joinedload(CraftingRecipe.ingredients).joinedload(CraftingRecipeIngredient.resource))
        .filter(CraftingRecipe.key == recipe_id)
        .first()
    )
    if recipe is None:
        raise HTTPException(status_code=404, detail="Crafting recipe not found")

    progress = _main_progress(db, current_user.id)
    if progress is None or progress.level < recipe.required_level:
        raise HTTPException(status_code=400, detail="Level is too low for this recipe")

    _consume_resources(
        db,
        current_user.id,
        {ingredient.resource.key: ingredient.quantity for ingredient in recipe.ingredients},
    )
    item = ensure_catalog_item(db, recipe.result_item_id)
    inventory_item = _grant_item_to_inventory(db, current_user.id, item)
    db.commit()

    return {
        "ok": True,
        "crafted_item": {
            "inventory_id": inventory_item.id,
            "name": item.name,
            "description": item.description,
            "icon": item.icon,
            "rarity": item.rarity,
        },
        "resources": _serialize_resource_state(db, current_user.id),
    }


def upgrade_item(db: Session, current_user: User, inventory_id: int) -> dict:
    _ensure_seed_data(db)
    inventory_item = (
        db.query(UserInventory)
        .options(joinedload(UserInventory.item))
        .filter(UserInventory.id == inventory_id, UserInventory.user_id == current_user.id)
        .first()
    )
    if inventory_item is None or inventory_item.item is None:
        raise HTTPException(status_code=404, detail="Inventory item not found")

    upgrade_entry = (
        db.query(ItemUpgradePath)
        .options(joinedload(ItemUpgradePath.resource))
        .filter(ItemUpgradePath.from_item_id == inventory_item.item_id)
        .first()
    )
    if upgrade_entry is None:
        raise HTTPException(status_code=400, detail="This item cannot be upgraded")

    _consume_resources(db, current_user.id, {upgrade_entry.resource.key: upgrade_entry.quantity})
    upgraded_item = ensure_catalog_item(db, upgrade_entry.to_item_id)
    inventory_item.item_id = upgraded_item.id
    db.commit()
    db.refresh(inventory_item)

    return {
        "ok": True,
        "upgraded_item": {
            "inventory_id": inventory_item.id,
            "name": upgraded_item.name,
            "description": upgraded_item.description,
            "icon": upgraded_item.icon,
            "rarity": upgraded_item.rarity,
        },
        "resources": _serialize_resource_state(db, current_user.id),
    }

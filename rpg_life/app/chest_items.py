from sqlalchemy.orm import Session

from app.beta_content import CHEST_CATALOG
from app.models import Item, UserInventory


CHEST_PRESENTATION = {
    "COMMON_CHEST": {
        "name": "Common Chest",
        "description": "A basic chest with starter rewards.",
    },
    "RARE_CHEST": {
        "name": "Rare Chest",
        "description": "Improved rewards with better drop quality.",
    },
    "EPIC_CHEST": {
        "name": "Epic Chest",
        "description": "High-tier chest with increased epic drop chance.",
    },
    "LEGENDARY_CHEST": {
        "name": "Legendary Chest",
        "description": "Top-tier chest with the strongest loot pool.",
    },
}


def get_chest_catalog_entry(chest_name: str) -> dict:
    payload = next((entry for entry in CHEST_CATALOG if entry["name"] == chest_name), None)
    if payload is None:
        raise LookupError(f"Chest catalog entry not found: {chest_name}")
    return payload


def get_chest_presentation(chest_name: str) -> dict:
    payload = CHEST_PRESENTATION.get(chest_name)
    if payload is not None:
        return payload
    fallback_name = chest_name.replace("_", " ").title()
    return {"name": fallback_name, "description": ""}


def ensure_chest_item(db: Session, chest_name: str) -> Item:
    chest_payload = get_chest_catalog_entry(chest_name)
    presentation = get_chest_presentation(chest_name)
    item = db.query(Item).filter(Item.type == "chest", Item.subclass == chest_name).first()

    if item is None:
        item = Item(
            name=presentation["name"],
            description=presentation["description"],
            type="chest",
            subclass=chest_name,
            slot=None,
            rarity=chest_payload["rarity"],
            power=0,
            icon="treasure-chest",
            price_crystals=chest_payload["gold_cost"],
            required_level=1,
        )
        db.add(item)
        db.flush()
        return item

    item.name = presentation["name"]
    item.description = presentation["description"]
    item.rarity = chest_payload["rarity"]
    item.icon = "treasure-chest"
    item.price_crystals = chest_payload["gold_cost"]
    item.slot = None
    db.flush()
    return item


def grant_chest_to_user(db: Session, user_id: int, chest_name: str, quantity: int = 1) -> UserInventory:
    chest_item = ensure_chest_item(db, chest_name)
    inventory_item = UserInventory(user_id=user_id, item=chest_item, quantity=quantity)
    db.add(inventory_item)
    db.flush()
    return inventory_item


def build_chest_grant_payload(
    inventory_item: UserInventory,
    chest_name: str,
    *,
    level: int | None = None,
    source: str | None = None,
) -> dict:
    payload = {
        "chest_name": chest_name,
        "inventory_id": inventory_item.id,
        "item": inventory_item.item,
        "rarity": getattr(inventory_item.item, "rarity", None),
    }
    if level is not None:
        payload["level"] = level
    if source:
        payload["source"] = source
    return payload

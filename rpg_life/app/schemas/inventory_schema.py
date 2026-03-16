from pydantic import BaseModel


class InventoryActionSchema(BaseModel):
    inventory_id: int
    class_progress_id: int | None = None
    slot: str | None = None


class ShopPurchaseSchema(BaseModel):
    item_id: int


class EquipmentSlotActionSchema(BaseModel):
    class_progress_id: int
    slot: str

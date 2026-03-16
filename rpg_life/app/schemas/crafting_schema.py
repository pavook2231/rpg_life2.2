from pydantic import BaseModel


class CraftRecipeSchema(BaseModel):
    recipe_id: str


class UpgradeItemSchema(BaseModel):
    inventory_id: int

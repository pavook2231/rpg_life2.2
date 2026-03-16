from sqlalchemy import Column, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import relationship

from app.core.database import Base


class CraftingResource(Base):
    __tablename__ = "crafting_resources"

    id = Column(Integer, primary_key=True, index=True)
    key = Column(String, unique=True, index=True, nullable=False)
    name = Column(String, nullable=False)
    description = Column(Text, nullable=False, default="")
    icon = Column(String, nullable=False, default="pickaxe")
    rarity = Column(String, nullable=False, default="common")
    price_crystals = Column(Integer, nullable=False, default=0)

    recipe_ingredients = relationship("CraftingRecipeIngredient", back_populates="resource")


class CraftingRecipe(Base):
    __tablename__ = "crafting_recipes"

    id = Column(Integer, primary_key=True, index=True)
    key = Column(String, unique=True, index=True, nullable=False)
    title = Column(String, nullable=False)
    result_item_id = Column(Integer, nullable=False)
    required_level = Column(Integer, nullable=False, default=1)

    ingredients = relationship(
        "CraftingRecipeIngredient",
        back_populates="recipe",
        cascade="all, delete-orphan",
    )


class CraftingRecipeIngredient(Base):
    __tablename__ = "crafting_recipe_ingredients"
    __table_args__ = (UniqueConstraint("recipe_id", "resource_id", name="uq_crafting_recipe_resource"),)

    id = Column(Integer, primary_key=True, index=True)
    recipe_id = Column(Integer, ForeignKey("crafting_recipes.id"), nullable=False, index=True)
    resource_id = Column(Integer, ForeignKey("crafting_resources.id"), nullable=False, index=True)
    quantity = Column(Integer, nullable=False, default=1)

    recipe = relationship("CraftingRecipe", back_populates="ingredients")
    resource = relationship("CraftingResource", back_populates="recipe_ingredients")


class ItemUpgradePath(Base):
    __tablename__ = "item_upgrade_paths"
    __table_args__ = (UniqueConstraint("from_item_id", name="uq_item_upgrade_from_item"),)

    id = Column(Integer, primary_key=True, index=True)
    from_item_id = Column(Integer, nullable=False, index=True)
    to_item_id = Column(Integer, nullable=False)
    resource_id = Column(Integer, ForeignKey("crafting_resources.id"), nullable=False, index=True)
    quantity = Column(Integer, nullable=False, default=1)

    resource = relationship("CraftingResource")

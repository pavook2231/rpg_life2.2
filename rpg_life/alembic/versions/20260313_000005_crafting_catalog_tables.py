"""add crafting catalog tables

Revision ID: 20260313_000005
Revises: 20260313_000004
Create Date: 2026-03-13 16:30:00
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "20260313_000005"
down_revision: Union[str, None] = "20260313_000004"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


crafting_resources = sa.table(
    "crafting_resources",
    sa.column("id", sa.Integer),
    sa.column("key", sa.String),
    sa.column("name", sa.String),
    sa.column("description", sa.Text),
    sa.column("icon", sa.String),
    sa.column("rarity", sa.String),
    sa.column("price_crystals", sa.Integer),
)

crafting_recipes = sa.table(
    "crafting_recipes",
    sa.column("id", sa.Integer),
    sa.column("key", sa.String),
    sa.column("title", sa.String),
    sa.column("result_item_id", sa.Integer),
    sa.column("required_level", sa.Integer),
)

crafting_recipe_ingredients = sa.table(
    "crafting_recipe_ingredients",
    sa.column("recipe_id", sa.Integer),
    sa.column("resource_id", sa.Integer),
    sa.column("quantity", sa.Integer),
)

item_upgrade_paths = sa.table(
    "item_upgrade_paths",
    sa.column("from_item_id", sa.Integer),
    sa.column("to_item_id", sa.Integer),
    sa.column("resource_id", sa.Integer),
    sa.column("quantity", sa.Integer),
)


def _inspector():
    return sa.inspect(op.get_bind())


def _has_table(table_name: str) -> bool:
    return table_name in _inspector().get_table_names()


def _has_index(table_name: str, index_name: str) -> bool:
    if not _has_table(table_name):
        return False
    return index_name in {index["name"] for index in _inspector().get_indexes(table_name)}


def upgrade() -> None:
    if not _has_table("crafting_resources"):
        op.create_table(
            "crafting_resources",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("key", sa.String(), nullable=False),
            sa.Column("name", sa.String(), nullable=False),
            sa.Column("description", sa.Text(), nullable=False, server_default=""),
            sa.Column("icon", sa.String(), nullable=False, server_default="pickaxe"),
            sa.Column("rarity", sa.String(), nullable=False, server_default="common"),
            sa.Column("price_crystals", sa.Integer(), nullable=False, server_default="0"),
        )
    if not _has_index("crafting_resources", "ix_crafting_resources_key"):
        op.create_index("ix_crafting_resources_key", "crafting_resources", ["key"], unique=True)

    if not _has_table("crafting_recipes"):
        op.create_table(
            "crafting_recipes",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("key", sa.String(), nullable=False),
            sa.Column("title", sa.String(), nullable=False),
            sa.Column("result_item_id", sa.Integer(), nullable=False),
            sa.Column("required_level", sa.Integer(), nullable=False, server_default="1"),
        )
    if not _has_index("crafting_recipes", "ix_crafting_recipes_key"):
        op.create_index("ix_crafting_recipes_key", "crafting_recipes", ["key"], unique=True)

    if not _has_table("crafting_recipe_ingredients"):
        op.create_table(
            "crafting_recipe_ingredients",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("recipe_id", sa.Integer(), sa.ForeignKey("crafting_recipes.id"), nullable=False),
            sa.Column("resource_id", sa.Integer(), sa.ForeignKey("crafting_resources.id"), nullable=False),
            sa.Column("quantity", sa.Integer(), nullable=False, server_default="1"),
            sa.UniqueConstraint("recipe_id", "resource_id", name="uq_crafting_recipe_resource"),
        )
    if not _has_index("crafting_recipe_ingredients", "ix_crafting_recipe_ingredients_recipe_id"):
        op.create_index("ix_crafting_recipe_ingredients_recipe_id", "crafting_recipe_ingredients", ["recipe_id"], unique=False)
    if not _has_index("crafting_recipe_ingredients", "ix_crafting_recipe_ingredients_resource_id"):
        op.create_index("ix_crafting_recipe_ingredients_resource_id", "crafting_recipe_ingredients", ["resource_id"], unique=False)

    if not _has_table("item_upgrade_paths"):
        op.create_table(
            "item_upgrade_paths",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("from_item_id", sa.Integer(), nullable=False),
            sa.Column("to_item_id", sa.Integer(), nullable=False),
            sa.Column("resource_id", sa.Integer(), sa.ForeignKey("crafting_resources.id"), nullable=False),
            sa.Column("quantity", sa.Integer(), nullable=False, server_default="1"),
            sa.UniqueConstraint("from_item_id", name="uq_item_upgrade_from_item"),
        )
    if not _has_index("item_upgrade_paths", "ix_item_upgrade_paths_from_item_id"):
        op.create_index("ix_item_upgrade_paths_from_item_id", "item_upgrade_paths", ["from_item_id"], unique=False)
    if not _has_index("item_upgrade_paths", "ix_item_upgrade_paths_resource_id"):
        op.create_index("ix_item_upgrade_paths_resource_id", "item_upgrade_paths", ["resource_id"], unique=False)

    if op.get_bind().execute(sa.text("SELECT COUNT(*) FROM crafting_resources")).scalar() == 0:
        op.bulk_insert(
            crafting_resources,
            [
                {
                    "id": 1,
                    "key": "iron_shard",
                    "name": "Iron Shard",
                    "description": "A rough shard used in basic weapon crafting.",
                    "icon": "pickaxe",
                    "rarity": "common",
                    "price_crystals": 0,
                },
                {
                    "id": 2,
                    "key": "oak_resin",
                    "name": "Oak Resin",
                    "description": "Flexible resin for bows and lightweight gear.",
                    "icon": "pine-tree",
                    "rarity": "common",
                    "price_crystals": 0,
                },
                {
                    "id": 3,
                    "key": "arcane_dust",
                    "name": "Arcane Dust",
                    "description": "Magical dust used in staff crafting and upgrades.",
                    "icon": "creation",
                    "rarity": "uncommon",
                    "price_crystals": 0,
                },
            ],
        )

    if op.get_bind().execute(sa.text("SELECT COUNT(*) FROM crafting_recipes")).scalar() == 0:
        op.bulk_insert(
            crafting_recipes,
            [
                {"id": 1, "key": "forge_steel_sword", "title": "Forge Steel Sword", "result_item_id": 201, "required_level": 5},
                {"id": 2, "key": "craft_hunters_bow", "title": "Craft Hunter Bow", "result_item_id": 202, "required_level": 5},
                {"id": 3, "key": "bind_apprentice_staff", "title": "Bind Elder Staff", "result_item_id": 203, "required_level": 5},
            ],
        )

    if op.get_bind().execute(sa.text("SELECT COUNT(*) FROM crafting_recipe_ingredients")).scalar() == 0:
        op.bulk_insert(
            crafting_recipe_ingredients,
            [
                {"recipe_id": 1, "resource_id": 1, "quantity": 4},
                {"recipe_id": 2, "resource_id": 2, "quantity": 4},
                {"recipe_id": 3, "resource_id": 3, "quantity": 4},
            ],
        )

    if op.get_bind().execute(sa.text("SELECT COUNT(*) FROM item_upgrade_paths")).scalar() == 0:
        op.bulk_insert(
            item_upgrade_paths,
            [
                {"from_item_id": 101, "to_item_id": 201, "resource_id": 1, "quantity": 3},
                {"from_item_id": 102, "to_item_id": 202, "resource_id": 2, "quantity": 3},
                {"from_item_id": 103, "to_item_id": 203, "resource_id": 3, "quantity": 3},
            ],
        )


def downgrade() -> None:
    op.drop_index("ix_item_upgrade_paths_resource_id", table_name="item_upgrade_paths")
    op.drop_index("ix_item_upgrade_paths_from_item_id", table_name="item_upgrade_paths")
    op.drop_table("item_upgrade_paths")

    op.drop_index("ix_crafting_recipe_ingredients_resource_id", table_name="crafting_recipe_ingredients")
    op.drop_index("ix_crafting_recipe_ingredients_recipe_id", table_name="crafting_recipe_ingredients")
    op.drop_table("crafting_recipe_ingredients")

    op.drop_index("ix_crafting_recipes_key", table_name="crafting_recipes")
    op.drop_table("crafting_recipes")

    op.drop_index("ix_crafting_resources_key", table_name="crafting_resources")
    op.drop_table("crafting_resources")

from .items_catalog import ACCESSORY_ITEMS, ARMOR_ITEMS, SET_BONUSES_DATA, WEAPONS
from .text_utils import normalize_nested_strings

ITEMS = normalize_nested_strings(WEAPONS + ARMOR_ITEMS + ACCESSORY_ITEMS)
SET_BONUSES = normalize_nested_strings(SET_BONUSES_DATA)

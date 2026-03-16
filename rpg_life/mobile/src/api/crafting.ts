import { apiRequest } from "./client";

import { fetchWithCache } from "../lib/offline";

export type CraftingOverview = {
  level: number;
  resources: Array<{
    key: string;
    name: string;
    description: string;
    icon: string;
    quantity: number;
  }>;
  recipes: Array<{
    id: string;
    title: string;
    required_level: number;
    can_craft: boolean;
    ingredients: Record<string, number>;
    result?: {
      id: number;
      name: string;
      description: string;
      icon: string;
      rarity: string;
      required_level: number;
    };
  }>;
  upgrades: Array<{
    inventory_id: number;
    from_item_id: number;
    to_item_id: number;
    cost: Record<string, number>;
    current_item?: {
      id: number;
      name: string;
      icon: string;
      rarity: string;
    };
    upgraded_item?: {
      id: number;
      name: string;
      icon: string;
      rarity: string;
    };
  }>;
};

export function fetchCraftingOverview() {
  return fetchWithCache("crafting-overview", () => apiRequest<CraftingOverview>("/crafting"));
}

export function craftRecipe(recipeId: string) {
  return apiRequest<{
    ok: boolean;
    crafted_item: {
      inventory_id: number;
      name: string;
      description: string;
      icon: string;
      rarity: string;
    };
  }>("/crafting/craft", {
    method: "POST",
    body: JSON.stringify({ recipe_id: recipeId }),
  });
}

export function upgradeItem(inventoryId: number) {
  return apiRequest<{
    ok: boolean;
    upgraded_item: {
      inventory_id: number;
      name: string;
      description: string;
      icon: string;
      rarity: string;
    };
  }>("/crafting/upgrade", {
    method: "POST",
    body: JSON.stringify({ inventory_id: inventoryId }),
  });
}

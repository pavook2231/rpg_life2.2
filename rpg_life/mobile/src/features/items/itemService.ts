import { apiRequest, apiRootRequest } from "../../api/client";
import { fetchWithTtlCache, queueIfOffline } from "../../lib/offline";
import {
  normalizeChestRewardItem,
  normalizeChestRewardPayload,
  normalizeEquipmentOverview,
  normalizeInventoryDetail,
  normalizeInventoryPagePayload,
  normalizeShopPayload,
} from "./itemStore";
import type {
  ChestRewardPayload,
  EquipmentOverviewPayload,
  InventoryItem,
  InventoryPagePayload,
  ShopPayload,
  ShopPurchasePayload,
} from "./types";

type CachedRequestOptions = {
  forceRefresh?: boolean;
};

const ITEM_CACHE_TTL = {
  catalog: 30_000,
  inventory: 45_000,
  equipment: 30_000,
} as const;

export function fetchItemsCatalog(options: CachedRequestOptions = {}) {
  return fetchWithTtlCache("items-catalog", async () => {
    const payload = await apiRequest<unknown>("/items");
    return normalizeShopPayload(payload);
  }, {
    ttlMs: ITEM_CACHE_TTL.catalog,
    forceRefresh: options.forceRefresh,
  });
}

export function fetchShop(options: CachedRequestOptions = {}) {
  return fetchItemsCatalog(options);
}

export function refreshShop() {
  return apiRequest<unknown>("/shop/refresh", {
    method: "POST",
  }).then((payload) => normalizeShopPayload(payload));
}

export function fetchInventory(page = 1, limit = 20, options: CachedRequestOptions = {}) {
  return fetchWithTtlCache(`items-inventory:${page}:${limit}`, async () => {
    const payload = await apiRequest<unknown>(`/users/me/items?page=${page}&limit=${limit}`);
    return normalizeInventoryPagePayload(payload);
  }, {
    ttlMs: ITEM_CACHE_TTL.inventory,
    forceRefresh: options.forceRefresh,
  });
}

export function fetchInventoryItemDetail(inventoryId: number) {
  return apiRequest<unknown>(`/inventory/${inventoryId}`).then((payload) => normalizeInventoryDetail(payload));
}

export function equipInventoryItem(inventoryId: number, slot: string, classProgressId?: number) {
  return apiRequest<{ ok: boolean }>("/items/equip", {
    method: "POST",
    body: JSON.stringify({
      inventory_id: inventoryId,
      slot,
      class_progress_id: classProgressId ?? null,
    }),
  });
}

export function unequipInventoryItem(inventoryId: number) {
  return apiRequest<{ ok: boolean }>("/inventory/unequip", {
    method: "POST",
    body: JSON.stringify({ inventory_id: inventoryId }),
  });
}

export function sellInventoryItem(inventoryId: number) {
  return apiRequest<{ ok: boolean; crystals_earned?: number }>("/inventory/sell", {
    method: "POST",
    body: JSON.stringify({ inventory_id: inventoryId }),
  });
}

export function fetchEquipmentOverview(options: CachedRequestOptions = {}) {
  return fetchWithTtlCache("items-equipment-overview", async () => {
    const payload = await apiRequest<unknown>("/character/equipment");
    return normalizeEquipmentOverview(payload);
  }, {
    ttlMs: ITEM_CACHE_TTL.equipment,
    forceRefresh: options.forceRefresh,
  });
}

function buildShopPurchaseRequestId(itemId: number, targetInventoryId?: number | null) {
  const targetToken = targetInventoryId ?? 0;
  const tsToken = Date.now().toString(36);
  const randomToken = Math.random().toString(36).slice(2, 10);
  return `shop-${itemId}-${targetToken}-${tsToken}-${randomToken}`;
}

export function buyShopItem(itemId: number, targetInventoryId?: number | null, clientRequestId?: string | null) {
  const requestId = clientRequestId || buildShopPurchaseRequestId(itemId, targetInventoryId);
  return apiRequest<ShopPurchasePayload>("/items/buy", {
    method: "POST",
    body: JSON.stringify({
      item_id: itemId,
      target_inventory_id: targetInventoryId ?? null,
      client_request_id: requestId,
    }),
  }).then((payload) => ({
    ...payload,
    chest_item: payload.chest_item
      ? {
          ...payload.chest_item,
          ...normalizeChestRewardItem(payload.chest_item),
        }
      : payload.chest_item,
  }));
}

export function openChest(payload: { inventory_id?: number | null; chest_id?: number | null; chest_name?: string | null }) {
  return queueIfOffline(
    () =>
      apiRootRequest<unknown>("/chests/open", {
        method: "POST",
        body: JSON.stringify(payload),
      }).then((result) => normalizeChestRewardPayload(result)),
    { type: "open_chest", payload },
  );
}

export type {
  ChestRewardPayload,
  EquipmentOverviewPayload,
  InventoryItem,
  InventoryPagePayload,
  ShopPayload,
};

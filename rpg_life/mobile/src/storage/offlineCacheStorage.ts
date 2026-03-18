import AsyncStorage from "@react-native-async-storage/async-storage";

const CACHE_PREFIX = "@rpg_life/cache/";
const memoryCache = new Map<string, string | null>();

type CachedValue<T> = {
  savedAt: string;
  value: T;
};

function keyFor(cacheKey: string) {
  return `${CACHE_PREFIX}${cacheKey}`;
}

export async function saveCachedValue<T>(cacheKey: string, value: T) {
  const payload: CachedValue<T> = {
    savedAt: new Date().toISOString(),
    value,
  };
  const storageKey = keyFor(cacheKey);
  const serialized = JSON.stringify(payload);
  memoryCache.set(storageKey, serialized);
  await AsyncStorage.setItem(storageKey, serialized);
}

export async function getCachedValue<T>(cacheKey: string): Promise<CachedValue<T> | null> {
  const storageKey = keyFor(cacheKey);
  const rawValue = memoryCache.has(storageKey) ? (memoryCache.get(storageKey) ?? null) : await AsyncStorage.getItem(storageKey);
  if (!memoryCache.has(storageKey)) {
    memoryCache.set(storageKey, rawValue);
  }
  if (!rawValue) {
    return null;
  }

  try {
    return JSON.parse(rawValue) as CachedValue<T>;
  } catch {
    return null;
  }
}

export async function clearCachedValue(cacheKey: string) {
  const storageKey = keyFor(cacheKey);
  memoryCache.delete(storageKey);
  await AsyncStorage.removeItem(storageKey);
}

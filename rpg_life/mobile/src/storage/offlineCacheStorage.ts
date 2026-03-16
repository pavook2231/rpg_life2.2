import AsyncStorage from "@react-native-async-storage/async-storage";

const CACHE_PREFIX = "@rpg_life/cache/";

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
  await AsyncStorage.setItem(keyFor(cacheKey), JSON.stringify(payload));
}

export async function getCachedValue<T>(cacheKey: string): Promise<CachedValue<T> | null> {
  const rawValue = await AsyncStorage.getItem(keyFor(cacheKey));
  if (!rawValue) {
    return null;
  }

  try {
    return JSON.parse(rawValue) as CachedValue<T>;
  } catch {
    return null;
  }
}

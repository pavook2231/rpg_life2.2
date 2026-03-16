import AsyncStorage from "@react-native-async-storage/async-storage";

const STORAGE_KEY = "@rpg_life/rpg_life_system";

export async function loadRpgLifeState<T>() {
  const rawValue = await AsyncStorage.getItem(STORAGE_KEY);
  if (!rawValue) {
    return null as T | null;
  }

  try {
    return JSON.parse(rawValue) as T;
  } catch {
    return null as T | null;
  }
}

export async function saveRpgLifeState<T>(state: T) {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

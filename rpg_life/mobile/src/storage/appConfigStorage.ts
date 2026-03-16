import AsyncStorage from "@react-native-async-storage/async-storage";

const API_BASE_URL_KEY = "rpg_life_api_base_url";

export async function getStoredApiBaseUrl() {
  return AsyncStorage.getItem(API_BASE_URL_KEY);
}

export async function saveApiBaseUrl(value: string) {
  await AsyncStorage.setItem(API_BASE_URL_KEY, value);
}

export async function clearApiBaseUrl() {
  await AsyncStorage.removeItem(API_BASE_URL_KEY);
}

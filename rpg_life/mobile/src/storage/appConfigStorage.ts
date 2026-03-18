import AsyncStorage from "@react-native-async-storage/async-storage";

const API_BASE_URL_KEY = "rpg_life_api_base_url";
let apiBaseUrlCache: string | null | undefined;

export async function getStoredApiBaseUrl() {
  if (apiBaseUrlCache !== undefined) {
    return apiBaseUrlCache;
  }
  apiBaseUrlCache = await AsyncStorage.getItem(API_BASE_URL_KEY);
  return apiBaseUrlCache;
}

export async function saveApiBaseUrl(value: string) {
  apiBaseUrlCache = value;
  await AsyncStorage.setItem(API_BASE_URL_KEY, value);
}

export async function clearApiBaseUrl() {
  apiBaseUrlCache = null;
  await AsyncStorage.removeItem(API_BASE_URL_KEY);
}

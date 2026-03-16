import AsyncStorage from "@react-native-async-storage/async-storage";

const PUSH_TOKEN_STORAGE_KEY = "@rpg_life/push_token";

export async function savePushToken(pushToken: string) {
  await AsyncStorage.setItem(PUSH_TOKEN_STORAGE_KEY, pushToken);
}

export async function getStoredPushToken() {
  return AsyncStorage.getItem(PUSH_TOKEN_STORAGE_KEY);
}

export async function clearStoredPushToken() {
  await AsyncStorage.removeItem(PUSH_TOKEN_STORAGE_KEY);
}

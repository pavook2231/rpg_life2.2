import AsyncStorage from "@react-native-async-storage/async-storage";

const STORAGE_KEY = "rpg_life_daily_bonus_prompt_day";
let promptDayCache: string | null | undefined;

export async function getLastDailyBonusPromptDay() {
  if (promptDayCache !== undefined) {
    return promptDayCache;
  }
  promptDayCache = await AsyncStorage.getItem(STORAGE_KEY);
  return promptDayCache;
}

export async function saveLastDailyBonusPromptDay(dayKey: string) {
  promptDayCache = dayKey;
  await AsyncStorage.setItem(STORAGE_KEY, dayKey);
}

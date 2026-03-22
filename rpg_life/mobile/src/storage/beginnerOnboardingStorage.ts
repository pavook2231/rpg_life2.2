import AsyncStorage from "@react-native-async-storage/async-storage";

const STORAGE_PREFIX = "rpg_life_beginner_goal_setup";
const cache = new Map<number, boolean | null>();

function keyForUser(userId: number) {
  return `${STORAGE_PREFIX}:${userId}`;
}

export async function getGoalSetupPending(userId: number) {
  if (cache.has(userId)) {
    return cache.get(userId) === true;
  }

  const value = await AsyncStorage.getItem(keyForUser(userId));
  const pending = value === "1";
  cache.set(userId, pending);
  return pending;
}

export async function markGoalSetupPending(userId: number) {
  cache.set(userId, true);
  await AsyncStorage.setItem(keyForUser(userId), "1");
}

export async function clearGoalSetupPending(userId: number) {
  cache.set(userId, false);
  await AsyncStorage.removeItem(keyForUser(userId));
}

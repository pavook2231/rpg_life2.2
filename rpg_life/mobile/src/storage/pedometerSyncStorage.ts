import AsyncStorage from "@react-native-async-storage/async-storage";

type PedometerSyncState = {
  dayKey: string;
  steps: number;
};

const STORAGE_KEY = "@rpg_life/pedometer_sync";

export async function getLastPedometerSyncState(): Promise<PedometerSyncState | null> {
  const rawValue = await AsyncStorage.getItem(STORAGE_KEY);
  if (!rawValue) {
    return null;
  }

  try {
    return JSON.parse(rawValue) as PedometerSyncState;
  } catch {
    return null;
  }
}

export async function saveLastPedometerSyncState(state: PedometerSyncState) {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

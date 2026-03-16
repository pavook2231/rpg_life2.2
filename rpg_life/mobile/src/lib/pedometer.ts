import { Platform } from "react-native";

type PedometerLike = {
  isAvailableAsync?: () => Promise<boolean>;
  getPermissionsAsync?: () => Promise<{ granted: boolean }>;
  requestPermissionsAsync?: () => Promise<{ granted: boolean }>;
  getStepCountAsync?: (start: Date, end: Date) => Promise<{ steps: number }>;
  watchStepCount?: (callback: (payload: { steps: number }) => void) => { remove: () => void };
};

function resolvePedometer(): PedometerLike | null {
  try {
    const maybeModule = require("expo-sensors");
    const pedometer = maybeModule?.Pedometer;
    if (!pedometer) {
      return null;
    }
    return pedometer as PedometerLike;
  } catch {
    return null;
  }
}

function startOfToday() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
}

export async function ensurePedometerAccess(): Promise<boolean> {
  const pedometer = resolvePedometer();
  if (!pedometer?.isAvailableAsync) {
    return false;
  }
  const available = await pedometer.isAvailableAsync();
  if (!available) {
    return false;
  }
  if (Platform.OS === "web") {
    return false;
  }

  if (pedometer.getPermissionsAsync && pedometer.requestPermissionsAsync) {
    const permission = await pedometer.getPermissionsAsync();
    if (permission.granted) {
      return true;
    }
    const requested = await pedometer.requestPermissionsAsync();
    return Boolean(requested.granted);
  }
  return true;
}

export async function getTodaySteps(): Promise<number | null> {
  const pedometer = resolvePedometer();
  if (!pedometer?.getStepCountAsync) {
    return null;
  }
  const hasAccess = await ensurePedometerAccess();
  if (!hasAccess) {
    return null;
  }
  const data = await pedometer.getStepCountAsync(startOfToday(), new Date());
  return Math.max(0, Number(data?.steps ?? 0));
}

export async function watchTodaySteps(onUpdate: (steps: number) => void): Promise<(() => void) | null> {
  const pedometer = resolvePedometer();
  if (!pedometer?.watchStepCount) {
    return null;
  }
  const hasAccess = await ensurePedometerAccess();
  if (!hasAccess) {
    return null;
  }

  const baseline = await getTodaySteps();
  if (baseline != null) {
    onUpdate(baseline);
  }
  const subscription = pedometer.watchStepCount((payload) => {
    onUpdate(Math.max(0, Number(payload?.steps ?? 0)));
  });
  return () => subscription.remove();
}

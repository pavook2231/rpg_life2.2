import { Platform } from "react-native";
import AppleHealthKit, { HealthInputOptions, HealthKitPermissions } from "react-native-health";
import GoogleFit, { Scopes } from "react-native-google-fit";

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

async function initHealthKit(): Promise<boolean> {
  if (Platform.OS !== "ios") return false;

  const permissions: HealthKitPermissions = {
    permissions: {
      read: [AppleHealthKit.Constants.Permissions.Steps],
      write: [],
    },
  };

  return new Promise((resolve) => {
    const timeout = setTimeout(() => resolve(false), 5000);

    AppleHealthKit.initHealthKit(permissions, (error: string) => {
      clearTimeout(timeout);
      resolve(!error);
    });
  });
}

async function initGoogleFit(): Promise<boolean> {
  if (Platform.OS !== "android") return false;

  const options = {
    scopes: [Scopes.FITNESS_ACTIVITY_READ],
  };

  try {
    const timeoutPromise = new Promise<boolean>((resolve) => {
      setTimeout(() => resolve(false), 5000);
    });

    const authPromise = GoogleFit.authorize(options).then((authorized) => authorized.success);
    return await Promise.race([authPromise, timeoutPromise]);
  } catch {
    return false;
  }
}

async function getStepsFromHealthKit(start: Date, end: Date): Promise<number | null> {
  if (Platform.OS !== "ios") return null;

  const options: HealthInputOptions = {
    startDate: start.toISOString(),
    endDate: end.toISOString(),
  };

  return new Promise((resolve) => {
    AppleHealthKit.getStepCount(options, (error: string, results: { value?: number }) => {
      if (error) {
        resolve(null);
        return;
      }

      resolve(results?.value || 0);
    });
  });
}

async function getStepsFromGoogleFit(start: Date, end: Date): Promise<number | null> {
  if (Platform.OS !== "android") return null;

  try {
    const results = await GoogleFit.getDailyStepCountSamples({
      startDate: start.toISOString(),
      endDate: end.toISOString(),
    });

    if (results.length > 0 && results[0].steps) {
      return results[0].steps.reduce((sum: number, step: { value: number }) => sum + step.value, 0);
    }

    return 0;
  } catch {
    return null;
  }
}

export async function ensurePedometerAccess(): Promise<boolean> {
  const isSimulator = !__DEV__ || (Platform.OS === "ios" && !AppleHealthKit) || (Platform.OS === "android" && !GoogleFit);

  if (Platform.OS === "ios" && !isSimulator) {
    const hkInit = await initHealthKit();
    if (hkInit) {
      return true;
    }
  } else if (Platform.OS === "android" && !isSimulator) {
    const gfInit = await initGoogleFit();
    if (gfInit) {
      return true;
    }
  }

  const pedometer = resolvePedometer();
  if (!pedometer?.isAvailableAsync) {
    return false;
  }

  const available = await pedometer.isAvailableAsync();
  if (!available || Platform.OS === "web") {
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
  const start = startOfToday();
  const end = new Date();

  if (Platform.OS === "ios" || Platform.OS === "android") {
    const hasAccess = await ensurePedometerAccess();

    if (hasAccess) {
      let steps: number | null = null;

      if (Platform.OS === "ios") {
        steps = await getStepsFromHealthKit(start, end);
      } else if (Platform.OS === "android") {
        steps = await getStepsFromGoogleFit(start, end);
      }

      if (steps !== null && steps > 0) {
        return Math.max(0, Number(steps));
      }
    }
  }

  const pedometer = resolvePedometer();
  if (!pedometer?.getStepCountAsync) {
    return null;
  }

  const hasAccess = await ensurePedometerAccess();
  if (!hasAccess) {
    return null;
  }

  const data = await pedometer.getStepCountAsync(start, end);
  return Math.max(0, Number(data?.steps ?? 0));
}

export async function watchTodaySteps(onUpdate: (steps: number) => void): Promise<(() => void) | null> {
  const updateSteps = async () => {
    const steps = await getTodaySteps();
    if (steps != null) {
      onUpdate(steps);
    }
  };

  await updateSteps();

  const pedometer = resolvePedometer();
  const watchSubscription = pedometer?.watchStepCount
    ? pedometer.watchStepCount(() => {
        void updateSteps();
      })
    : null;

  const interval = setInterval(updateSteps, 15 * 1000);
  return () => {
    watchSubscription?.remove();
    clearInterval(interval);
  };
}

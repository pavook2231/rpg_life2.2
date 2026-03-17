import { Platform } from "react-native";
import AppleHealthKit, { HealthInputOptions, HealthKitPermissions } from "react-native-health";
import GoogleFit, { Scopes } from "react-native-google-fit";

console.log("Pedometer module loaded. Platform:", Platform.OS);
console.log("AppleHealthKit available:", !!AppleHealthKit);
console.log("GoogleFit available:", !!GoogleFit);

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
  console.log("initHealthKit: Initializing...");

  const permissions: HealthKitPermissions = {
    permissions: {
      read: [AppleHealthKit.Constants.Permissions.Steps],
      write: [],
    },
  };

  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      console.log("initHealthKit: Timeout after 5 seconds");
      resolve(false);
    }, 5000);

    AppleHealthKit.initHealthKit(permissions, (error: string) => {
      clearTimeout(timeout);
      if (error) {
        console.log("initHealthKit: Error:", error);
        resolve(false);
      } else {
        console.log("initHealthKit: Success");
        resolve(true);
      }
    });
  });
}

async function initGoogleFit(): Promise<boolean> {
  if (Platform.OS !== "android") return false;
  console.log("initGoogleFit: Initializing...");

  const options = {
    scopes: [Scopes.FITNESS_ACTIVITY_READ],
  };

  try {
    const timeoutPromise = new Promise<boolean>((resolve) => {
      setTimeout(() => {
        console.log("initGoogleFit: Timeout after 5 seconds");
        resolve(false);
      }, 5000);
    });

    const authPromise = GoogleFit.authorize(options).then((authorized) => {
      console.log("initGoogleFit: Result:", authorized);
      return authorized.success;
    });

    return await Promise.race([authPromise, timeoutPromise]);
  } catch (error) {
    console.log("initGoogleFit: Error:", error);
    return false;
  }
}

async function getStepsFromHealthKit(start: Date, end: Date): Promise<number | null> {
  if (Platform.OS !== "ios") return null;
  console.log("getStepsFromHealthKit: Getting steps from", start, "to", end);

  const options: HealthInputOptions = {
    startDate: start.toISOString(),
    endDate: end.toISOString(),
  };

  return new Promise((resolve) => {
    AppleHealthKit.getStepCount(options, (error: string, results: any) => {
      if (error) {
        console.log("getStepsFromHealthKit: Error:", error);
        resolve(null);
      } else {
        console.log("getStepsFromHealthKit: Results:", results);
        resolve(results.value || 0);
      }
    });
  });
}

async function getStepsFromGoogleFit(start: Date, end: Date): Promise<number | null> {
  if (Platform.OS !== "android") return null;
  console.log("getStepsFromGoogleFit: Getting steps from", start, "to", end);

  try {
    const res = await GoogleFit.getDailyStepCountSamples({
      startDate: start.toISOString(),
      endDate: end.toISOString(),
    });
    console.log("getStepsFromGoogleFit: Raw response:", res);

    if (res.length > 0 && res[0].steps) {
      const totalSteps = res[0].steps.reduce((sum: number, step: any) => sum + step.value, 0);
      console.log("getStepsFromGoogleFit: Total steps:", totalSteps);
      return totalSteps;
    }
    console.log("getStepsFromGoogleFit: No steps data");
    return 0;
  } catch (error) {
    console.log("getStepsFromGoogleFit: Error:", error);
    return null;
  }
}

export async function ensurePedometerAccess(): Promise<boolean> {
  console.log("ensurePedometerAccess: Starting...");

  // Check if running on simulator/emulator
  const isSimulator = !__DEV__ || (Platform.OS === "ios" && !AppleHealthKit) || (Platform.OS === "android" && !GoogleFit);
  console.log("ensurePedometerAccess: Is simulator:", isSimulator);

  // Try health app first
  if (Platform.OS === "ios" && !isSimulator) {
    const hkInit = await initHealthKit();
    if (hkInit) {
      console.log("ensurePedometerAccess: HealthKit access granted");
      return true;
    }
  } else if (Platform.OS === "android" && !isSimulator) {
    const gfInit = await initGoogleFit();
    if (gfInit) {
      console.log("ensurePedometerAccess: Google Fit access granted");
      return true;
    }
  }

  // Fallback to expo-sensors
  console.log("ensurePedometerAccess: Falling back to expo-sensors...");
  const pedometer = resolvePedometer();
  if (!pedometer?.isAvailableAsync) {
    console.log("ensurePedometerAccess: Pedometer not available");
    return false;
  }
  const available = await pedometer.isAvailableAsync();
  console.log("ensurePedometerAccess: Pedometer available:", available);
  if (!available) {
    return false;
  }
  if (Platform.OS === "web") {
    return false;
  }

  if (pedometer.getPermissionsAsync && pedometer.requestPermissionsAsync) {
    const permission = await pedometer.getPermissionsAsync();
    console.log("ensurePedometerAccess: Current permission:", permission);
    if (permission.granted) {
      return true;
    }
    const requested = await pedometer.requestPermissionsAsync();
    console.log("ensurePedometerAccess: Requested permission:", requested);
    return Boolean(requested.granted);
  }
  console.log("ensurePedometerAccess: No permission methods, assuming granted");
  return true;
}

export async function getTodaySteps(): Promise<number | null> {
  console.log("getTodaySteps: Starting...");
  const start = startOfToday();
  const end = new Date();

  // Try health app first - but need to ensure access first
  if (Platform.OS === "ios" || Platform.OS === "android") {
    console.log("getTodaySteps: Ensuring health app access...");
    const hasAccess = await ensurePedometerAccess();
    console.log("getTodaySteps: Health app access result:", hasAccess);

    if (hasAccess) {
      let steps: number | null = null;
      if (Platform.OS === "ios") {
        console.log("getTodaySteps: Trying HealthKit...");
        steps = await getStepsFromHealthKit(start, end);
        console.log("getTodaySteps: HealthKit result:", steps);
      } else if (Platform.OS === "android") {
        console.log("getTodaySteps: Trying Google Fit...");
        steps = await getStepsFromGoogleFit(start, end);
        console.log("getTodaySteps: Google Fit result:", steps);
      }

      if (steps !== null && steps > 0) {
        console.log("getTodaySteps: Returning health app steps:", steps);
        return Math.max(0, Number(steps));
      }
    }
  }

  // Fallback to expo-sensors
  console.log("getTodaySteps: Falling back to expo-sensors...");
  const pedometer = resolvePedometer();
  if (!pedometer?.getStepCountAsync) {
    console.log("getTodaySteps: No pedometer available");
    return null;
  }
  const hasAccess = await ensurePedometerAccess();
  console.log("getTodaySteps: Pedometer access:", hasAccess);
  if (!hasAccess) {
    console.log("getTodaySteps: No access to pedometer");
    return null;
  }
  const data = await pedometer.getStepCountAsync(start, end);
  console.log("getTodaySteps: Expo-sensors result:", data);
  return Math.max(0, Number(data?.steps ?? 0));
}

export async function watchTodaySteps(onUpdate: (steps: number) => void): Promise<(() => void) | null> {
  // For health apps, we can't watch in real-time easily, so we'll poll
  // In a real implementation, you'd set up observers for HealthKit/GoogleFit
  const start = startOfToday();

  const updateSteps = async () => {
    const steps = await getTodaySteps();
    if (steps != null) {
      onUpdate(steps);
    }
  };

  // Initial update
  await updateSteps();

  // Poll every 5 minutes
  const interval = setInterval(updateSteps, 5 * 60 * 1000);

  return () => clearInterval(interval);
}

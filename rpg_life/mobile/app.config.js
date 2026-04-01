const fs = require("fs");
const path = require("path");

const appJson = require("./app.json");

const fallbackExpoConfig = appJson.expo ?? {};
const projectEnvPath = path.resolve(__dirname, "..", ".env");

function readEnvFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return {};
  }

  const values = {};
  const lines = fs.readFileSync(filePath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex <= 0) {
      continue;
    }

    const key = trimmed.slice(0, separatorIndex).trim();
    let value = trimmed.slice(separatorIndex + 1).trim();
    if (
      value.length >= 2 &&
      ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'")))
    ) {
      value = value.slice(1, -1);
    }
    values[key] = value;
  }

  return values;
}

const fileEnv = readEnvFile(projectEnvPath);

function getEnvValue(name, fallback) {
  const value = process.env[name];
  if (value != null && value !== "") {
    return value;
  }
  const fileValue = fileEnv[name];
  if (fileValue != null && fileValue !== "") {
    return fileValue;
  }
  return fallback;
}

function envFlag(name, fallback) {
  const value = getEnvValue(name, null);
  if (value == null || value === "") {
    return fallback;
  }
  return ["1", "true", "yes", "on"].includes(String(value).trim().toLowerCase());
}

function buildBaseExpoConfig(config) {
  const resolvedConfig = config ?? fallbackExpoConfig;
  return {
    ...fallbackExpoConfig,
    ...resolvedConfig,
    ios: {
      ...(fallbackExpoConfig.ios ?? {}),
      ...(resolvedConfig.ios ?? {}),
      infoPlist: {
        ...((fallbackExpoConfig.ios && fallbackExpoConfig.ios.infoPlist) ?? {}),
        ...((resolvedConfig.ios && resolvedConfig.ios.infoPlist) ?? {}),
      },
    },
    android: {
      ...(fallbackExpoConfig.android ?? {}),
      ...(resolvedConfig.android ?? {}),
    },
    extra: {
      ...(fallbackExpoConfig.extra ?? {}),
      ...(resolvedConfig.extra ?? {}),
    },
  };
}

function uniqueStrings(values) {
  return Array.from(new Set(values.filter((value) => typeof value === "string" && value)));
}

module.exports = ({ config }) => {
  const baseExpoConfig = buildBaseExpoConfig(config);
  const isProduction = (getEnvValue("APP_ENV", process.env.NODE_ENV || "") || "").toLowerCase() === "production";
  let apiBaseUrl = getEnvValue("EXPO_PUBLIC_API_BASE_URL", baseExpoConfig.extra?.apiBaseUrl);
  if (isProduction && typeof apiBaseUrl === "string" && apiBaseUrl.startsWith("http://")) {
    apiBaseUrl = `https://${apiBaseUrl.slice("http://".length)}`;
  }
  const allowCustomApiOverride = envFlag("EXPO_PUBLIC_ALLOW_CUSTOM_API_OVERRIDE", !isProduction);
  const enableAccountRecovery = envFlag("EXPO_PUBLIC_ENABLE_ACCOUNT_RECOVERY", false);
  const googleAuthClientId = getEnvValue(
    "EXPO_PUBLIC_GOOGLE_AUTH_CLIENT_ID",
    getEnvValue("GOOGLE_AUTH_MOBILE_CLIENT_ID", "723557656382-vm0ahmv322777ea3l07t7rq87diif5uk.apps.googleusercontent.com")
  );
  const googleAuthAndroidClientId = getEnvValue(
    "EXPO_PUBLIC_GOOGLE_AUTH_ANDROID_CLIENT_ID",
    getEnvValue("GOOGLE_AUTH_ANDROID_CLIENT_ID", "")
  );
  const googleAuthIosClientId = getEnvValue(
    "EXPO_PUBLIC_GOOGLE_AUTH_IOS_CLIENT_ID",
    getEnvValue("GOOGLE_AUTH_IOS_CLIENT_ID", "")
  );
  const googleAuthWebClientId = getEnvValue(
    "EXPO_PUBLIC_GOOGLE_AUTH_WEB_CLIENT_ID",
    getEnvValue("GOOGLE_AUTH_WEB_CLIENT_ID", googleAuthClientId)
  );
  const socialAuthRedirectScheme = getEnvValue(
    "EXPO_PUBLIC_SOCIAL_AUTH_REDIRECT_SCHEME",
    getEnvValue("SOCIAL_AUTH_REDIRECT_SCHEME", "rpglife")
  );
  const androidPermissions = uniqueStrings([
    ...(((baseExpoConfig.android && baseExpoConfig.android.permissions) || [])),
    "android.permission.ACTIVITY_RECOGNITION",
  ]).filter(
    (permission) =>
      permission !== "android.permission.BODY_SENSORS" &&
      permission !== "com.google.android.gms.permission.ACTIVITY_RECOGNITION"
  );
  const motionUsageDescription =
    baseExpoConfig.ios?.infoPlist?.NSMotionUsageDescription ||
    "This app reads your motion activity to sync daily step progress.";

  return {
    ...baseExpoConfig,
    scheme: baseExpoConfig.scheme || socialAuthRedirectScheme,
    ios: {
      ...(baseExpoConfig.ios ?? {}),
      infoPlist: {
        ...((baseExpoConfig.ios && baseExpoConfig.ios.infoPlist) ?? {}),
        ITSAppUsesNonExemptEncryption: false,
        NSMotionUsageDescription: motionUsageDescription,
      },
    },
    android: {
      ...(baseExpoConfig.android ?? {}),
      permissions: androidPermissions,
    },
    extra: {
      ...(baseExpoConfig.extra ?? {}),
      apiBaseUrl,
      allowCustomApiOverride,
      requireHttps: isProduction,
      enableAccountRecovery,
      googleAuthClientId,
      googleAuthAndroidClientId,
      googleAuthIosClientId,
      googleAuthWebClientId,
      socialAuthRedirectScheme,
    },
  };
};

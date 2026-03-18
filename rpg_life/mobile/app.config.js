const appJson = require("./app.json");

const baseExpoConfig = appJson.expo ?? {};

function envFlag(name, fallback) {
  const value = process.env[name];
  if (value == null || value === "") {
    return fallback;
  }
  return ["1", "true", "yes", "on"].includes(String(value).trim().toLowerCase());
}

module.exports = () => {
  const isProduction = (process.env.APP_ENV || process.env.NODE_ENV || "").toLowerCase() === "production";
  let apiBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL || baseExpoConfig.extra?.apiBaseUrl;
  if (isProduction && typeof apiBaseUrl === "string" && apiBaseUrl.startsWith("http://")) {
    apiBaseUrl = `https://${apiBaseUrl.slice("http://".length)}`;
  }
  const allowCustomApiOverride = envFlag("EXPO_PUBLIC_ALLOW_CUSTOM_API_OVERRIDE", !isProduction);
  const enableAccountRecovery = envFlag("EXPO_PUBLIC_ENABLE_ACCOUNT_RECOVERY", false);
  const googleAuthClientId =
    process.env.EXPO_PUBLIC_GOOGLE_AUTH_CLIENT_ID ||
    "723557656382-ol45mkmikajrkjs1amidtkkmf08q8ftq.apps.googleusercontent.com";
  const socialAuthRedirectScheme = process.env.EXPO_PUBLIC_SOCIAL_AUTH_REDIRECT_SCHEME || "rpglife";

  return {
    ...baseExpoConfig,
    scheme: baseExpoConfig.scheme || socialAuthRedirectScheme,
    ios: {
      ...(baseExpoConfig.ios ?? {}),
      infoPlist: {
        ...((baseExpoConfig.ios && baseExpoConfig.ios.infoPlist) ?? {}),
        ITSAppUsesNonExemptEncryption: false,
      },
    },
    extra: {
      ...(baseExpoConfig.extra ?? {}),
      apiBaseUrl,
      allowCustomApiOverride,
      requireHttps: isProduction,
      enableAccountRecovery,
      googleAuthClientId,
      socialAuthRedirectScheme,
    },
  };
};

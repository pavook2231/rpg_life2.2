# Mobile Beta Release Checklist

## Build And Config

- Verify `expo.extra.apiBaseUrl` points to the beta backend.
- Current default mobile API URL: `https://rpglife.online/api/v1`
- Confirm `android.package` and `ios.bundleIdentifier` match the intended test build.
- Confirm `version`, `versionCode`, and `buildNumber` are bumped for the next beta build.
- Re-check Android permissions before each beta cut.
- Confirm deep link scheme `rpglife` still matches the auth/social flow.

## Product Flows

- Register a new account and finish onboarding.
- Log in with email/password.
- Check Google and Telegram social entry points.
- Create or change a goal from `Home`, `Profile`, and `GoalSelect`.
- Complete a quest and verify rewards sync into hero/profile state.
- Open `Friends`, search users, send a request, and load leaderboard tabs.
- Open inventory, equip an item, unequip it, sell an item, and open a chest.
- Open `Settings`, change password, and test recovery email flow if enabled.

## Offline And Sync

- Launch the app offline and confirm the UI stays usable.
- Queue at least one action offline and confirm it syncs after reconnect.
- Verify reward claim buttons do not double-submit after reconnect.

## Notifications And Health

- Verify push notification permission flow on a fresh install.
- Verify step tracking on Android with Google Fit.
- Verify step tracking on iOS with HealthKit.
- Confirm the app still behaves gracefully when health or activity permissions are denied.

## UI And Localization

- Spot check Russian and English on the main screens.
- Check empty states, loading states, and error states on `Home`, `Quests`, `Friends`, and `Inventory`.
- Confirm no mojibake or broken separators appear in user-facing text.
- Check small-screen layout on a narrow Android device.

## Verification

- Run `npm run typecheck`.
- Smoke test the app in Expo/dev build before cutting the beta artifact.
- Capture release notes listing fixed flows, known issues, and backend URL used for the build.

# RPG Life Mobile Beta Release Notes

## What Was Improved

- Fixed the auth entry flow so login and registration work as a proper switcher.
- Replaced the temporary `GoalSelect` redirect with a dedicated goal selection screen.
- Moved the default mobile API base URL to `https://rpglife.online/api/v1` instead of a local LAN IP.
- Improved `Friends` and leaderboard UX with stronger summaries, safer loading flow, and better friend cards.
- Added consistent loading states to the main action flows in `Login`, `Register`, `Profile`, `Settings`, `Home`, `Quests`, and `Inventory`.
- Cleaned up debug noise and removed most leftover console output from the mobile app.
- Normalized several broken separators and hardcoded text issues across the UI.
- Reduced Android permission surface by removing unused fine location access.

## High Confidence Areas

- Auth and onboarding entry
- Goal selection flow
- Reward claim flow
- Quests flow
- Inventory item actions
- Friends and leaderboard tabs

## Known Manual Check Areas

- Google and Telegram social login on real devices
- Push permission flow on fresh install
- HealthKit and Google Fit step sync on real devices
- Offline queue recovery after reconnect
- Small-screen layout polish on narrow Android devices

## Build Verification

- `npm run typecheck` passes
- Beta API URL configured in `app.json`
- Beta release checklist added to `mobile/docs/BETA_RELEASE_CHECKLIST.md`

# RPG Life Mobile Beta Audit

Date: 2026-03-13

## Strengths

- The project already has a real mobile gameplay loop: auth, quests, inventory, shop, character, crafting, offline queue, push notifications, and background jobs.
- The backend is API-first and no longer depends on the old web UI to serve the mobile client.
- The mobile app has a strong visual base: item source art, layered character equipment, rarity surfaces, animated feedback, and a clear RPG identity.
- The app is already structured as a multi-screen mobile product instead of a single hybrid page.
- TypeScript checks are green, which reduces the risk of shipping broken navigation or UI props in beta.

## Weak Points

- Store-readiness still needed explicit app icon, splash, deep-link configuration, and consistent mobile release metadata.
- Not every item source asset was visible inside the app; part of the art library lived only in the repository.
- Some screens were still too card-heavy for phones, especially secondary utility flows.
- Android release signing still depends on external environment variables and must use a real upload keystore before store upload.
- Public production infrastructure, privacy text, crash reporting, and marketplace accounts remain external blockers outside the codebase.

## Biggest Risks Before Beta

- No public production API means social auth and real beta distribution cannot be fully validated end-to-end.
- Missing release signing credentials block a real Google Play upload.
- iOS/TestFlight still requires Apple-side setup and cannot be completed from code alone.

## Work Plan

### P0

- Ensure every gameplay-facing item source asset is reachable from the mobile app.
- Make release config beta-ready: app icon, splash, mobile deep links, version metadata.
- Tighten phone layouts for dense screens and remove unnecessary spacing.
- Verify TypeScript after every change.

### P1

- Connect public production API and switch beta builds away from local URLs.
- Add crash reporting and basic product analytics.
- Complete social auth externally with public HTTPS endpoints.

### P2

- Finish full App Store / Google Play operational packaging:
  - privacy policy
  - screenshots
  - store texts
  - age/content declarations
  - support email and release notes

## Implemented In This Pass

- Added a live in-app armory screen with the bundled item source library.
- Added automatic source-asset resolution by icon name across the mobile UI.
- Added store-oriented Expo config for icon, splash, version, and deep-link scheme.
- Added Android `rpglife://` deep-link handling for real beta flows.
- Reduced default card and screen spacing for phones.
- Tightened inventory and crafting layouts for smaller devices.

## Remaining External Steps

- Deploy the backend to a public HTTPS URL.
- Provide Android upload keystore values.
- Create marketplace accounts and fill listing metadata.
- Run smoke tests on at least 2-3 real devices before opening beta.

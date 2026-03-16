# RPG Life Beta Release Checklist

## What is already ready

- Mobile TypeScript check passes: `npm run typecheck`
- Backend tests pass: `pytest`
- Production compose includes API, PostgreSQL, Redis, Celery worker and Celery beat

## Before first closed beta

1. Prepare backend environment

- Create a real `.env` on the server with:
  - `APP_ENV=production`
  - strong `SECRET_KEY`
  - production `DATABASE_URL`
  - production `REDIS_URL`
  - `ALLOW_SQLITE_FALLBACK=false`
  - `AUTO_CREATE_TABLES=false`
  - `ENABLE_ACCOUNT_RECOVERY=false` until email delivery is implemented
- Start the stack with:

```bash
docker compose -f docker-compose.production.yml up --build -d
```

2. Verify backend health

- Open `/healthz`
- Open `/readyz`
- Check that API, Postgres, Redis, Celery worker and Celery beat are healthy

3. Prepare mobile beta build variables

- Set `EXPO_PUBLIC_API_BASE_URL` to the public API base URL, for example:

```bash
https://beta-api.example.com/api/v1
```

- Optional flags:
  - `EXPO_PUBLIC_ALLOW_CUSTOM_API_OVERRIDE=false` for store-facing beta builds
  - `EXPO_PUBLIC_ENABLE_ACCOUNT_RECOVERY=false`
  - `EXPO_PUBLIC_SOCIAL_AUTH_REDIRECT_SCHEME=rpglife`

4. Confirm mobile release metadata

- The mobile app now expects a real icon/splash in Expo config
- Confirm app version, Android `versionCode`, and iOS `buildNumber`
- Confirm deep links open the app with `rpglife://`

5. Prepare Android signing

- Provide release signing variables before building:
  - `RPG_LIFE_UPLOAD_STORE_FILE`
  - `RPG_LIFE_UPLOAD_STORE_PASSWORD`
  - `RPG_LIFE_UPLOAD_KEY_ALIAS`
  - `RPG_LIFE_UPLOAD_KEY_PASSWORD`

- Do not ship a store beta with debug signing fallback

6. Build Android beta

- Internal APK:

```bash
eas build --profile beta -p android
```

- Or local native build:

```bash
npx expo run:android --variant release
```

7. Smoke test on real devices

- Register account
- Login and session restore
- Create and complete quest
- Claim daily reward
- Buy and equip item
- Open inventory and character screens
- Test offline queue and sync recovery
- Test push registration and one real push event

8. Prepare marketplace packaging

- Privacy policy URL
- Support email
- App screenshots for phone sizes
- Play Store / App Store descriptions and keywords
- Age/content questionnaire answers

## Not ready yet

- Real account recovery email flow
- iOS native project and TestFlight setup
- Crash reporting / analytics integration

## Temporary path without a server

If there is no VPS yet, start with:

```powershell
.\scripts\Start-Local-Beta.ps1
```

This is enough for a first local closed beta on devices in the same Wi-Fi network.

# RPG Life Mobile

Expo + React Native mobile client for the RPG Life backend.

## What is ready

- JWT login and registration
- secure token storage and session restore
- 5-tab mobile navigation
- hero dashboard on the home screen
- daily quests with progress cards
- inventory grid with item modal and equip action
- shop screen with category tabs
- profile screen with stats and equipment
- challenge and event snippets inside the main game flow

## 1. Start backend

From the project root:

```bash
docker compose up --build
```

The phone and the backend machine must be on the same Wi-Fi network.

## 2. Configure API URL for a real phone

Edit `app.json` and replace the default emulator URL with your computer LAN IP:

```json
{
  "expo": {
    "extra": {
      "apiBaseUrl": "http://192.168.1.50:8000/api/v1"
    }
  }
}
```

Use:

- `10.0.2.2` for Android emulator
- `192.168.x.x` or `10.x.x.x` for a physical phone
- never `127.0.0.1` on a real device

You can also change the API URL directly on the login screen now. The app stores it locally on the device, so you do not need to rebuild Expo config every time.

## 3. Start Expo

```bash
cd mobile
npm install
npx expo start
```

Then install `Expo Go` on the phone and scan the QR code.

## 4. Current screens

- Login
- Register
- Home
- Quests
- Inventory
- Shop
- Profile

## 5. Native release builds later

For installable release artifacts:

- `npx expo run:android`
- `eas build -p android`
- `eas build -p ios`

### Local APK build (Windows, faster defaults)

From repository root:

```powershell
powershell -ExecutionPolicy Bypass -File ".\mobile\scripts\Build-Android-Release.ps1" -UseShortRoot
```

The script automatically retries native build steps on transient CMake/.cxx file-lock errors.

If the fast mode fails on your machine, retry in safe mode:

```powershell
powershell -ExecutionPolicy Bypass -File ".\mobile\scripts\Build-Android-Release.ps1" -SafeMode -UseShortRoot
```

## 6. Closed beta build

Use environment variables so the release app points to the public beta backend:

```bash
$env:EXPO_PUBLIC_API_BASE_URL="https://beta-api.example.com/api/v1"
$env:EXPO_PUBLIC_ENABLE_ACCOUNT_RECOVERY="false"
eas build --profile beta -p android
```

For release signing on Android also provide:

```bash
$env:RPG_LIFE_UPLOAD_STORE_FILE="C:\\keys\\rpglife-upload.jks"
$env:RPG_LIFE_UPLOAD_STORE_PASSWORD="***"
$env:RPG_LIFE_UPLOAD_KEY_ALIAS="rpglife"
$env:RPG_LIFE_UPLOAD_KEY_PASSWORD="***"
```

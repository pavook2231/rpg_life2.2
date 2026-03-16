# RPG Life Beta Handoff For Owner

## What was prepared in the codebase

- Mobile app can now use a public beta API URL in release builds
- Android release config is prepared for real signing via environment variables
- Unused Android permissions were removed
- Account recovery is hidden in the mobile UI until the real email flow exists
- Beta build profile was added to EAS
- A production environment template was added

## What still requires your action

These items cannot be completed from this local workspace alone:

1. A public server or VPS for the backend
2. A domain or public IP for the API
3. Android signing credentials
4. Optional Expo/EAS account login for cloud builds

## Simplest path to beta

### Option 1: easiest for a beginner

- Rent a small VPS
- Install Docker and Docker Compose
- Point a domain or subdomain to the VPS
- Copy `.env.production.example` to `.env`
- Fill in real secrets and passwords
- Run:

```bash
docker compose -f docker-compose.production.yml up --build -d
```

- Verify:
  - `https://your-api-domain/healthz`
  - `https://your-api-domain/readyz`

- Build Android beta with:

```bash
$env:EXPO_PUBLIC_API_BASE_URL="https://your-api-domain/api/v1"
eas build --profile beta -p android
```

### Option 2: local closed test only

- Run backend on your own PC
- Open port `8000`
- Use your public IP or a tunnel
- Build Android beta pointed to that address

This is faster, but much less stable for real testers.

## Android signing

The project is ready for release signing with these variables:

- `RPG_LIFE_UPLOAD_STORE_FILE`
- `RPG_LIFE_UPLOAD_STORE_PASSWORD`
- `RPG_LIFE_UPLOAD_KEY_ALIAS`
- `RPG_LIFE_UPLOAD_KEY_PASSWORD`

If you use EAS managed credentials, Expo can usually handle signing for you during cloud builds.

## Recommended next step

Do not try to solve mobile signing first.
First get one public backend URL working and make sure `/readyz` is healthy.

## If there is no server yet

Use the local beta path first:

```powershell
.\scripts\Start-Local-Beta.ps1
```

Then test the app on a phone connected to the same Wi-Fi.

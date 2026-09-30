# Raritone store release checklist

The Capacitor shells are already present for both stores.

## Current release identifiers

- Android application ID: `com.raritone.app`
- iOS bundle identifier: `com.raritone.app`
- Current version: `1.0` / Android version code `1`

## Required before a real release build

1. Deploy the API and live try-on broker behind a public HTTPS origin.
2. Set `VITE_API_BASE_URL` to that origin. It must be an HTTPS origin with no
   path, query string, fragment, or credentials.
3. Set production storage (Supabase URL, anon key, and server-only service
   role key) and the live provider configuration on the server.
4. Create the Android upload keystore and Play App Signing configuration.
5. Configure Apple signing in Xcode or a macOS CI runner.
6. Prepare a privacy-policy URL, support URL, app screenshots, age rating,
   data-safety answers, and App Store privacy answers.

## Build commands

```bash
npm install
VITE_API_BASE_URL=https://api.example.com npm run mobile:build
```

Then open the generated native projects:

```bash
npm run mobile:open:android
npm run mobile:open:ios
```

Android can produce an `.aab` from Android Studio or Gradle after signing is
configured. iOS archive/export requires Xcode on macOS or a macOS CI runner.

## Important release boundary

The local development backend uses the mock provider and on-disk storage. It is
not suitable for store submission. Do not ship until the API origin, storage,
provider, privacy policy, and signing configuration are production-ready.

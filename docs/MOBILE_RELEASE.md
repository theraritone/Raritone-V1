# Raritone mobile release workflow

Raritone uses the existing Capacitor Android and iOS projects. The web bundle is built first, then copied into the native shells.

## Local verification

```bash
npm install
npm run typecheck
npm run build
npm run native:check
npm run verify
```

## Android

```bash
npm run build
npx cap sync android
npx cap open android
```

In Android Studio, configure the production API origin, confirm camera and internet permissions, add the Google Play Billing plugin implementation, configure signing, configure `com.raritone.pro.monthly` and `com.raritone.vip.monthly`, then test through Play internal testing.

## iOS

```bash
npm run build
npx cap sync ios
npx cap open ios
```

In Xcode, configure the production API origin, confirm camera permission text, add the StoreKit purchase implementation, configure signing and capabilities, configure the subscription product identifiers, then test with a Sandbox tester through TestFlight.

## Purchase safety

The client must submit a signed transaction or receipt to the server. The server verifies it with Apple or Google, persists the entitlement, and only then exposes Pro/VIP access. Never enable paid features based only on a local client callback.

## Current boundary

The repository has the Capacitor shells, product contract, UI, receipt submission API, strict product validation, and release checks. Store SDK wiring and provider credentials remain platform configuration work.

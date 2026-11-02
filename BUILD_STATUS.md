# Raritone Build Status

Updated: 2026-11-02

## Current baseline

- Repository: `theraritone/Raritone-V1`
- Product: Raritone — camera-first virtual try-on
- Current runtime: TypeScript + Vite PWA with an Express API
- Working areas found: camera surface, preview, wardrobe, profile, server routes, provider adapters, local persistence, Supabase integration path

## Completed

- Created implementation branch: `feature/raritone-mobile-foundation`
- Preserved the existing camera-first architecture instead of replacing working behavior
- Added reusable design tokens
- Added Discover and five-tab mobile navigation
- Added server-owned Free, Pro, and VIP plan contract with ₹0/₹299/₹999 pricing
- Added subscription screen with plan comparison and server-verification messaging
- Added native in-app purchase adapter boundary that refuses fake web purchases

## In progress

- Wiring Apple App Store and Google Play Billing adapters in native builds
- Adding server receipt validation and entitlement persistence
- Adding authenticated account linking and Style Streak data

## Pending integrations

- Apple App Store subscription product configuration
- Google Play Billing subscription product configuration
- Apple receipt/App Store Server API credentials
- Google Play service-account credentials for purchase verification
- Production authentication provider credentials
- Production private media storage credentials
- Live AI provider credentials and production limits
- Push notification credentials
- Admin deployment environment

## Known limitations

- The current repository is a PWA/Capacitor-oriented TypeScript application, not yet an Expo Router React Native project.
- Web development builds intentionally cannot start real in-app purchases.
- No AI result or subscription entitlement is fabricated when an external provider is unavailable.
- Payment, rewards, and entitlement decisions must remain server-verified.

## Verification status

- GitHub connector cannot execute local npm scripts.
- Run locally before merging:

```bash
npm install
npm run typecheck
npm run build
npm run verify
```

## Next implementation slice

1. Add a Profile membership entry and wire the subscription screen into navigation.
2. Add native store adapters and receipt submission endpoints.
3. Add server-backed entitlements and Style Streak.
4. Map exact Figma assets and typography to the navigation shell.

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
- Wired Membership entry from Profile to the subscription screen
- Added billing plan and entitlement read endpoints
- Added fail-closed receipt submission endpoint
- Added server-backed Style Streak read endpoint
- Wired billing routes into the authenticated API application

## In progress

- Implementing Apple App Store and Google Play receipt verification
- Persisting verified entitlements and renewal dates
- Adding authenticated account linking
- Adding Style Streak qualifying-event writes and reward administration

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
- Receipt submission currently fails closed until provider-specific verification is implemented and credentials are configured.
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

1. Implement provider-specific Apple and Google receipt verification.
2. Add entitlement persistence to both local and Supabase repositories.
3. Add native Capacitor purchase plugins and submit verified receipts.
4. Add server-verified Style Streak completion events and admin reward controls.
5. Add account linking and authentication.

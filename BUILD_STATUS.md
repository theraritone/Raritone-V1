# Raritone Build Status

Updated: 2026-11-02

## Current baseline

- Repository: `theraritone/Raritone-V1`
- Product: Raritone — camera-first virtual try-on
- Current runtime: TypeScript + Vite PWA with an Express API
- Working areas found: camera surface, preview, wardrobe, profile, server routes, provider adapters, local persistence, Supabase integration path

## Completed in this foundation pass

- Created implementation branch: `feature/raritone-mobile-foundation`
- Preserved the existing camera-first architecture instead of replacing working behavior
- Documented the Figma-to-code implementation plan
- Added the initial reusable design-token contract for the Raritone visual system
- Added a Discover screen with editorial collections, category browsing, and try-on CTA
- Added a persistent five-destination mobile navigation model: Home, Discover, Try-On, Wardrobe, Profile
- Kept the existing camera capture, preview, wardrobe, and profile flows intact
- Recorded current integration and release limitations

## In progress

- Aligning visual details and assets with the Raritone V1 Figma screens
- Adding authenticated user flows while retaining guest-first development behavior
- Adding server-backed discovery and Style Streak data

## Pending integrations

- Production authentication provider credentials
- Production private media storage credentials
- Live AI provider credentials and production limits
- App Store / Play Store subscription products
- Stripe or Razorpay production configuration
- Push notification credentials
- Admin deployment environment

## Known limitations

- The current repository is a PWA/Capacitor-oriented TypeScript application, not yet an Expo Router React Native project.
- Live try-on requires the external provider session service and valid credentials.
- No AI result is fabricated when the provider is unavailable.
- Payment, rewards, and entitlement decisions must remain server-verified.
- Figma MCP inspection is limited to the shared design URL; exact exported assets and tokens must be confirmed during implementation.

## Verification status

- GitHub connector cannot execute the repository's local npm scripts.
- Run locally before merging:

```bash
npm install
npm run typecheck
npm run build
npm run verify
```

## Next implementation slice

1. Add authenticated account linking and subscription entitlement reads.
2. Add server-backed Discover and Style Streak endpoints.
3. Map exact Figma assets and typography to the new navigation shell.
4. Add device builds and native permission validation through Capacitor or migrate deliberately to Expo after characterization tests.

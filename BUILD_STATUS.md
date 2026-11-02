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
- Recorded current integration and release limitations

## In progress

- Aligning the existing PWA shell with the Raritone V1 Figma screens
- Converting the current camera-first surfaces into the final mobile navigation model
- Adding authenticated user flows while retaining guest-first development behavior

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

- Existing test and verification commands were not run by the GitHub connector.
- Run locally before merging:

```bash
npm install
npm run typecheck
npm run build
npm run verify
```

## Next implementation slice

1. Map Figma mobile frames to the current Camera, Preview, Wardrobe, and Profile screens.
2. Add the mobile bottom navigation and Try-On entry affordance without breaking camera capture.
3. Add Discover and Style Streak as server-backed surfaces.
4. Add authenticated account linking and subscription entitlement reads.
5. Add device builds and native permission validation through Capacitor or migrate deliberately to Expo after characterization tests.

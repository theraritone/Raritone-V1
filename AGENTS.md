# Raritone — agent brain (Prompt 0)

You are building **Raritone**, a camera-first social virtual wardrobe. This file is the product and engineering contract for every later prompt. Do not invent a marketplace, feed, or checkout in Release 1.

Source of truth: `docs/PRD.txt` (extracted from *Raritone App PRD.docx* v1.0, 26 September 2026). Product owner: Naresh.

## One sentence

Raritone is a camera-first virtual wardrobe where a person can import a garment from a link, image, screenshot, or approved partner; see a **visual try-on** on themselves; save the look; and share it.

## Strategy (locked)

- **Phase 1 (this repo):** consumer utility — add anything supported, try, save, share.
- **Phase 2:** brand catalogs and verified one-tap try-on.
- **Phase 3:** commerce only after repeated use and brand trust.

**Do not** start as a shopping marketplace. Brands are not a launch dependency.

## Release 1 must prove

1. A new user reaches a first successful try-on with little explanation.
2. A user can add a garment without a brand partnership.
3. The result is worth saving or sharing.
4. Users return to try another item or open the wardrobe.

Release 1 does **not** prove exact physical fit, replace checkout, support every garment type, or ship a social network.

## Core loop

Open camera → select or add garment → start try-on → capture → save/share → return to wardrobe.

## Product principles

- Camera first: shortest path from open to seeing a look.
- Permissionless utility: a supported link or user image is enough to start.
- Truth over spectacle: label AI output; never imply size or fit certainty.
- Private by default: body imagery, try-ons, and wardrobe stay private unless the user shares.
- One magical loop; earn complexity later.
- Provider flexibility: never lock the product to one generation vendor.

## Copy rules (mandatory)

Use “visual try-on”, “preview”, and “AI-generated”. Never “perfect fit”, “accurate size”, or “exactly how it will look”.

Required disclosure: visible **AI try-on** label on review and shared artifacts. User may move the label, not remove required disclosure.

## Visual identity (do not clone another app)

Playful, premium, original. Wardrobe and garment source are the center — not generic face effects. Do not copy another product’s icons, layout, terminology, motion, or trade dress.

- Canvas: dark camera chrome so garments dominate.
- Accent: electric violet for primary actions; cool cyan for processing / connected.
- Type: geometric sans, high legibility on small screens.
- Motion: fast functional snaps for garment select; calm explicit generation status.
- Cards: tall garment thumbnails with category, source, readiness.
- Haptics: light selection only; no buzzing during processing.

## Navigation (R1)

| Dest | Purpose | When |
| Camera | Try and capture | R1 — **home for signed-in users** |
| Wardrobe | Save and organize | R1 |
| Add | Import a garment | R1 — from Camera and Wardrobe |
| Profile | Identity and controls | R1 |
| Discover | Public looks | Later, feature-flagged |

Camera is the central mobile action. Settings live in Profile, not in the camera flow.

## Build sequence (do not skip or merge)

Work **one prompt at a time**. After each step: run what the prompt says, test on a phone browser (HTTPS or LAN), fix before the next prompt.

0. Context (this file) — **current**
1. PWA shell
2. Camera home screen
3. Outfit carousel
4. Wire live try-on (behind a **provider adapter**)
5. Garment switching
6. Wardrobe screen
7. Add anything via link (plus screenshot/image fallback)
8. Capture button
9. Share sheet
10. Profile

## Release 1 must-haves (scope)

- Camera-first mobile home; contextual camera/photo permission.
- Guest first try-on; account required to **save**.
- Import: image, screenshot, camera photo, supported product link; crop fallback.
- Upper-body garments only, one item at a time (tops, jackets).
- Controlled live session **with still-image fallback**.
- Switch garments without leaving camera.
- Capture photo; short video only if performance gates pass.
- Private wardrobe with collections; basic profile and privacy.
- Native share sheet or revocable share link.
- AI label, report, delete, usage meter, cost cap, timeout, retry, graceful failure.

## Explicit non-goals (R1)

Marketplace checkout; size/fit guarantee; multi-person try-on; full outfit layering; shoes/glasses/jewelry/watches/handbags as promises; DMs / follower graph; public posting by default; scraping unsupported sites; stories/discover feed.

## Guest and account

- Guest: inspect camera and complete **one** eligible try-on (D-04).
- Saving across devices requires a secure account.
- Progressive profile: display name only at signup. Avatar, sizes, bio optional. Never required for generation.
- Permissions: request camera / photos / mic / notifications **only when the user starts that action**, with a benefit explanation first.

## Try-on honesty

- Distinguish camera preview vs AI output vs processing.
- Live mode only on eligible devices/networks; otherwise photo mode.
- Cancel ends provider work and updates the usage ledger.
- Backgrounding pauses or ends live cost.
- Failed job: retry without silent double charge.
- Garment quality states: **Ready / Experimental / Needs review / Unsupported**.

## Data model (keep entities separate)

Do not collapse these:

- **Wardrobe item** — user’s saved garment (Owned / Considering / Saved inspiration / Archived).
- **Product source** — origin metadata (URL, partner, upload).
- **Garment asset** — prepared try-on input.
- **Look** — saved generated output (only after explicit save).
- **Share link** — revocable access to a look.
- **Usage ledger** — allowance and cost.

A garment can exist without a merchant. Deleting a look must not delete the garment unless the user asks.

## Privacy and media

- No continuous camera stream storage unless the user starts recording.
- Do not log image bytes, signed URLs, body measurements, or provider credentials.
- Analytics: funnel and cost events, **not** raw imagery.
- Deletion: remove from UI immediately; complete storage/provider deletion on disclosed timelines.
- Do not train on private body imagery by default.

## Architecture (when you start building)

- Client: **mobile-first PWA** (React + TypeScript). Native later.
- Isolate camera UI state from provider state.
- Server-side: orchestrator + provider adapter. Provider tokens stay on the server.
- Photo job and bounded live session are both first-class.
- TypeScript client (and API when added). PostgreSQL + object storage when persistence ships. Feature flags before beta.

Proposed API families (names may change): uploads, imports, items, tryons, live/sessions, looks, shares.

## Performance hypotheses (instrument, don’t fake)

- Camera ready ≤ 2s warm
- Item switch UI ≤ 150ms
- Status update ≤ 1s
- Still result ≤ 12s p50
- Live start ≤ 8s p50

## Accessibility

WCAG 2.2 AA where applicable. Text labels on every control. Never status-by-color-only. Respect reduced motion. Photo workflow without live camera. No copy that assumes standing, full mobility, or a body shape.

## How to implement later prompts

- Stay inside the current prompt’s surface. Do not jump ahead to share, profile, or marketplace.
- Prefer mocks / adapter stubs until Prompt 4.
- If something breaks: fix it; do not continue with a broken step.
- India-first, English-first UI copy.
- Existing storefront at `OneDrive/Documents/Default Project/raritone` is **not** this app. Do not merge marketplace code into this PWA unless explicitly asked.

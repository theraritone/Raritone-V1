# Raritone

Camera-first virtual wardrobe. Open the camera, pick a garment, see it on
yourself, and keep the result.

Release 1 is upper-body garments only, guest-first (no login), and private by
default: nothing is published unless you share it.

## Run it

```bash
npm install
npm run dev
```

Then open the printed URL. To use it on a phone, the phone must be on the same
Wi-Fi and must reach the dev server over the LAN — Vite and the API both bind to
`0.0.0.0`, so the address the server logs is the one to type on the phone.

A camera requires a secure context. `localhost` counts as secure, so desktop
testing is fine; a phone hitting `http://192.168.x.x` does not, and the browser
will refuse the camera. For a phone, build and serve over HTTPS, or use a tunnel:

```bash
npm run build
npx localtunnel --port 8787     # or ngrok http 8787
```

## One process, one port

```bash
npm run build
npm start
```

Serves the built PWA and the API together on `PORT` (default 8787), including
the SPA fallback so shared links open correctly.

## What the try-on actually is

`server/provider/` is an adapter, and the default is `live-vto`: it brokers
real Decart live sessions through the raritone-live-vto backend — session
creation, heartbeats and teardown are that backend's logic, reused over HTTP.
The permanent Decart key lives in the backend's own `.env`; this process only
ever sees short-lived client tokens.

Important: Decart renders browser-to-Decart over WebRTC, so the PWA server never
sees a pixel. Until the client integrates the Decart browser SDK, the server
refuses to mint app-facing sessions rather than render a stand-in: with no
backend, try-on start fails with "Try-on unavailable — check your connection.",
and there is no mock, no placeholder garment, ever.

`mock` still exists for offline development and hermetic tests: it composites
the garment onto the frame with `sharp`, locally, with no network and no cost.
Select it with `TRYON_PROVIDER=mock` (`npm run smoke` pins this). It never
ships as the default.

If the provider misbehaves in production, set `PROVIDER_KILL_SWITCH=true` and
no new work is accepted without shipping anything.

## Running the backend + PWA together

The live adapter needs the session backend on `LIVE_VTO_BASE_URL`
(default `http://127.0.0.1:4000`). In one terminal, from the backend folder:

```bash
cd "<path-to>/raritone-live-vto/backend"
npm install
npm run dev          # needs DECART_API_KEY in that backend's .env for real tokens
```

In a second terminal, from this folder:

```bash
TRYON_PROVIDER=live-vto LIVE_VTO_BASE_URL=http://127.0.0.1:4000 npm run dev
```

(Git Bash accepts inline `VAR=value` assignments. In PowerShell, set them with
`$env:TRYON_PROVIDER = "live-vto"` first.) Every live session start and end is
logged to the PWA server's stdout with its timestamp and burned seconds, so
inference usage is always visible.

## Storage

With no configuration, data goes to `.data/` on disk: guest JSON plus media
files. It is a real driver behind the same repository interface, so nothing
upstream knows the difference.

To use Postgres and private Storage buckets instead, apply
`server/supabase/schema.sql`, then set the four Supabase variables in `.env`
(see `.env.example`). RLS is enabled on every table and the buckets are private;
the server uses the service role and hands out short-lived signed URLs. The anon
key is never used for data access.

## Verifying

```bash
npm run typecheck      # client + server, strict
npm run smoke          # 50 API checks against a real server on a real port (mock provider)
npm run verify:live    # live-vto adapter against the real session backend
npm run serve:check    # the built app served the way it ships
npm run build          # typecheck, bundle, and verify every class emitted CSS
```

`npm run smoke` walks the whole Release 1 loop and asserts the promises that are
easy to break: a guest gets exactly one try-on, a non-launch category is saved
but refused at try-on time, a link pointing at a private address is blocked, a
finished job is idempotent on retry, a garment can be deleted without taking its
saved looks with it, and stories are off by default.

## Layout

```
shared/         types, repository contract, sample garment art
server/
  app.ts        the express app, with no listener
  index.ts      starts it and logs the LAN addresses
  lib/          auth, storage drivers, errors, link import, orchestration
  provider/     try-on adapters: live-vto (real Decart sessions), mock, http template
  routes/       the API surface
  supabase/     schema.sql
src/
  state/        device identity, API client, app store
  lib/          camera, capture, try-on session
  components/   carousel, sheets, error surfaces, icons
  screens/      camera, preview, wardrobe, profile
scripts/        icon generation, smoke test, style and server checks
```

## Decisions worth knowing

- **The camera is the front door.** No onboarding, no feed, no login wall.
- **A device id is the guest credential**, minted in `localStorage` and
  exchanged for a real account row. The profile screen can reset it.
- **Photos mode is default per the PRD's D-03**, with live try-on one tap away
  in the mode switch. `FLAG_LIVE_TRYON` turns live off entirely.
- **Quality states are visible**, and a garment outside the launch categories is
  marked unsupported rather than silently failing at the shutter.
- **Stories are built but off** (`FLAG_STORIES=false`). The PRD scopes them past
  Release 1, so the code exists and ships disabled.
- **Error copy comes from the server.** One `ErrorPanel` renders every
  `ApiError`, so a failure always says what happened, what to do next, and
  whether a retry is free.
- **The service worker never caches `/api` or `/media`.** A cached bootstrap
  would show a guest garments they deleted and an allowance they already spent.

## Not in Release 1

No marketplace, checkout, public feed, follower graph, size or fit guarantee, or
story feed. Try-on output is illustrative, and every surface that shows it says
so.

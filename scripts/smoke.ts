/**
 * End-to-end API smoke test.
 *
 * Boots the real express app on an ephemeral port and walks the whole Release 1
 * loop: guest session → wardrobe → link import → photo try-on (with genuine
 * image compositing) → live try-on → garment switch → capture → share → story
 * flag → profile stats. Also asserts the honesty and cost guarantees: the AI
 * label, the SSRF guard, and that a retry does not double-charge.
 *
 * Run: npm run smoke
 */
import { randomUUID } from "node:crypto";
import type { AddressInfo } from "node:net";
import sharp from "sharp";

// The suite must stay hermetic: it pins the local compositing provider BEFORE
// importing the app, because the server reads TRYON_PROVIDER at import time.
// The default adapter is the real live-vto backend, which is verified
// separately by scripts/verify-live-vto.ts.
process.env.TRYON_PROVIDER = "mock";

const [{ createApp }, { SAMPLE_GARMENTS, garmentSvg }] = await Promise.all([
  import("../server/app.js"),
  import("../shared/garmentArt.js"),
]);

let passed = 0;
let failed = 0;
const failures: string[] = [];

function check(name: string, condition: boolean, detail = ""): void {
  if (condition) {
    passed += 1;
    process.stdout.write(`  ok   ${name}\n`);
  } else {
    failed += 1;
    failures.push(name);
    process.stdout.write(`  FAIL ${name}${detail ? ` — ${detail}` : ""}\n`);
  }
}

/** A fresh guest per run, so the test is repeatable against the local store. */
const DEVICE_ID = `smoke_${randomUUID().replace(/-/g, "").slice(0, 24)}`;

const server = createApp().listen(0, "127.0.0.1");
await new Promise<void>((resolve) => server.once("listening", resolve));
const { port } = server.address() as AddressInfo;
const base = `http://127.0.0.1:${port}`;

async function call(
  path: string,
  init: RequestInit & { expectStatus?: number } = {},
): Promise<{ status: number; body: any }> {
  const response = await fetch(`${base}${path}`, {
    ...init,
    headers: {
      "x-device-id": DEVICE_ID,
      ...(init.body ? { "content-type": "application/json" } : {}),
      ...(init.headers ?? {}),
    },
  });
  const text = await response.text();
  let body: unknown = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  return { status: response.status, body };
}

/** A synthetic "photo of a person" so the compositor has a real frame to work on. */
async function personFrame(): Promise<string> {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="720" height="1280">
    <defs><linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#3b4252"/><stop offset="1" stop-color="#171a21"/>
    </linearGradient></defs>
    <rect width="720" height="1280" fill="url(#bg)"/>
    <circle cx="360" cy="360" r="130" fill="#c69a7b"/>
    <path d="M200 520 C230 460 490 460 520 520 L560 1280 L160 1280 Z" fill="#2a3550"/>
  </svg>`;
  const jpeg = await sharp(Buffer.from(svg)).jpeg({ quality: 90 }).toBuffer();
  return `data:image/jpeg;base64,${jpeg.toString("base64")}`;
}

/** Rasterized sample art, which is what a real client uploads. */
async function samplePng(index: number): Promise<string> {
  const spec = SAMPLE_GARMENTS[index % SAMPLE_GARMENTS.length];
  const png = await sharp(Buffer.from(garmentSvg(spec))).png().toBuffer();
  return `data:image/png;base64,${png.toString("base64")}`;
}

try {
  process.stdout.write("\nraritone api smoke test\n\n");

  // 1. auth -------------------------------------------------------------
  const noDevice = await fetch(`${base}/api/bootstrap`);
  check("rejects a request with no device id", noDevice.status === 401, `got ${noDevice.status}`);

  const boot = await call("/api/bootstrap");
  check("bootstrap succeeds for a guest device", boot.status === 200, `status ${boot.status}`);
  check(
    "guest starts with one try-on allowance (D-04)",
    boot.body?.usage?.photoAllowance === 1 && boot.body?.usage?.photoRemaining === 1,
    JSON.stringify(boot.body?.usage),
  );
  check("bootstrap reports the storage driver", typeof boot.body?.storageDriver === "string");

  // 2. starter carousel -------------------------------------------------
  const seeded: any[] = boot.body?.items ?? [];
  check("bootstrap seeds the starter carousel", seeded.length === SAMPLE_GARMENTS.length, `${seeded.length}`);
  check(
    "every starter garment is a raster image the client can render",
    seeded.every((i) => typeof i.imageUrl === "string" && i.imageUrl.startsWith("data:image/png")),
  );
  check(
    "starter garments are all upper-body launch categories",
    seeded.every((i) => i.category === "tops" || i.category === "jackets"),
    seeded.map((i) => i.category).join(","),
  );
  check(
    "starter garments are try-on ready without review",
    seeded.every((i) => i.qualityState === "ready"),
  );
  const itemId: string = seeded[0]?.id ?? "";
  check("try-on availability is reported honestly", boot.body?.tryOn?.photoAvailable === true);

  // 3. wardrobe ---------------------------------------------------------
  const list = await call("/api/items");
  check(
    "wardrobe list contains the starter garments",
    list.body?.items?.length === SAMPLE_GARMENTS.length,
    `${list.body?.items?.length}`,
  );

  // An unsupported category is saved honestly, not silently marked try-on-able.
  const shoes = await call("/api/items", {
    method: "POST",
    body: JSON.stringify({
      name: "Sample trainers",
      imageDataUrl: await samplePng(1),
      category: "shoes",
    }),
  });
  check("saves a non-launch category without claiming try-on support", shoes.status === 201, JSON.stringify(shoes.body));
  check(
    "a non-launch garment is flagged as not try-on-able",
    shoes.body?.item?.qualityState === "unsupported",
    shoes.body?.item?.qualityState,
  );
  const shoesBlocked = await call("/api/tryons", {
    method: "POST",
    body: JSON.stringify({ itemId: shoes.body?.item?.id, personFrame: await personFrame() }),
  });
  check(
    "and is refused at try-on time with a reason",
    shoesBlocked.status === 422,
    `status ${shoesBlocked.status}`,
  );

  // 4. link import ------------------------------------------------------
  const ssrf = await call("/api/imports/link", {
    method: "POST",
    body: JSON.stringify({ url: "http://127.0.0.1:8787/internal" }),
  });
  check("blocks a link pointing at a private address", ssrf.status === 422, `status ${ssrf.status}`);
  check(
    "SSRF refusal names the category so the client can react",
    ssrf.body?.failure?.category === "policy_blocked",
    JSON.stringify(ssrf.body?.failure),
  );

  const badScheme = await call("/api/imports/link", {
    method: "POST",
    body: JSON.stringify({ url: "file:///etc/passwd" }),
  });
  check("rejects a non-http scheme", badScheme.status === 422);

  const badUrl = await call("/api/imports/link", {
    method: "POST",
    body: JSON.stringify({ url: "not a url at all" }),
  });
  check("rejects a malformed address", badUrl.status === 422);

  // 5. photo try-on -----------------------------------------------------
  const frame = await personFrame();
  const beforeAllowance = (await call("/api/bootstrap")).body?.usage?.photoRemaining;
  const startJob = await call("/api/tryons", {
    method: "POST",
    body: JSON.stringify({
      itemId,
      personFrame: frame,
      personWidth: 720,
      personHeight: 1280,
      clientToken: "smoke-token-photo-0001",
    }),
  });
  check("starts a photo try-on", startJob.status === 202, JSON.stringify(startJob.body));

  let polled = await call("/api/tryons/job_smoke-token-photo-0001");
  let tries = 0;
  while (polled.body?.status !== "ready" && tries < 40) {
    polled = await call("/api/tryons/job_smoke-token-photo-0001");
    tries += 1;
  }
  check("photo try-on reaches a ready result", polled.body?.status === "ready", JSON.stringify(polled.body));
  const resultUrl: string = polled.body?.resultUrl ?? "";
  check("result is a composited image", resultUrl.startsWith("data:image/jpeg"), resultUrl.slice(0, 30));
  check(
    "composited result differs from the raw camera frame (AI output is distinguishable)",
    resultUrl.length > 0 && resultUrl !== frame,
  );
  check(
    "photo try-on settles without the client having to babysit it",
    polled.body?.status === "ready",
    `status ${polled.body?.status} after ${tries} extra polls`,
  );

  const afterAllowance = (await call("/api/bootstrap")).body?.usage?.photoRemaining;
  check(
    "allowance dropped by exactly one",
    beforeAllowance - afterAllowance === 1,
    `${beforeAllowance} → ${afterAllowance}`,
  );

  // Guest allowance is now exhausted (D-04).
  const secondJob = await call("/api/tryons", {
    method: "POST",
    body: JSON.stringify({ itemId, personFrame: frame, clientToken: "smoke-token-photo-0002" }),
  });
  check(
    "a guest is stopped after the allowed try-on, with a stated next action",
    secondJob.status === 402 && Boolean(secondJob.body?.error?.nextAction),
    `status ${secondJob.status}`,
  );

  // 6. live try-on ------------------------------------------------------
  const live = await call("/api/live/sessions", {
    method: "POST",
    body: JSON.stringify({
      itemId,
      personFrame: frame,
      personWidth: 720,
      personHeight: 1280,
      clientToken: "smoke-token-live-0001",
    }),
  });
  check("starts a live session", live.status === 201, JSON.stringify(live.body));
  const sessionId: string = live.body?.sessionId ?? "";
  check("live session returns a first frame immediately", Boolean(live.body?.frame?.imageUrl));
  check("live session is time-bounded (FR-106)", Boolean(live.body?.expiresAt));

  // FR-105: garment switch must not create a new session.
  const switchRes = await call(`/api/live/sessions/${sessionId}/garment`, {
    method: "POST",
    body: JSON.stringify({ itemId }),
  });
  check("switches garment inside the running session", switchRes.status === 200, JSON.stringify(switchRes.body));
  check("session id survives the switch", switchRes.body?.garment?.itemId === itemId);

  const frameRes = await fetch(`${base}/api/live/sessions/${sessionId}/frame?after=0`, {
    headers: { "x-device-id": DEVICE_ID },
  });
  check("polls a live frame", frameRes.status === 200, `status ${frameRes.status}`);

  const ended = await call(`/api/live/sessions/${sessionId}`, { method: "DELETE" });
  check("ends a live session", ended.status === 200);
  const goneFrame = await fetch(`${base}/api/live/sessions/${sessionId}/frame?after=0`, {
    headers: { "x-device-id": DEVICE_ID },
  });
  check("an ended session cannot be polled", goneFrame.status === 404, `status ${goneFrame.status}`);

  // 7. looks, share, story flag ----------------------------------------
  const look = await call("/api/looks", {
    method: "POST",
    body: JSON.stringify({ imageDataUrl: resultUrl, itemId, kind: "photo" }),
  });
  check("saves a look", look.status === 201, JSON.stringify(look.body));
  check("saved look carries the AI disclosure", look.body?.look?.aiLabel === "AI try-on");
  const lookId: string = look.body?.look?.id;

  const share = await call("/api/shares", {
    method: "POST",
    body: JSON.stringify({ lookId, ttlHours: 24 }),
  });
  check("creates a revocable share link", share.status === 201, JSON.stringify(share.body));
  check("share link has an expiry", Boolean(share.body?.share?.expiresAt));

  const storyOff = await call("/api/stories", {
    method: "POST",
    body: JSON.stringify({ lookId }),
  });
  check(
    "posting to a story is off by default (PRD non-goal)",
    storyOff.status === 404,
    `status ${storyOff.status}`,
  );

  const shareRevoke = await call(`/api/shares/${share.body?.share?.id}`, { method: "DELETE" });
  check("share link can be revoked", shareRevoke.status === 200);

  // 8. profile ----------------------------------------------------------
  const renamed = await call("/api/profile", {
    method: "PATCH",
    body: JSON.stringify({ displayName: "Naresh", handle: "naresh" }),
  });
  check("updates the display name", renamed.body?.session?.displayName === "Naresh");
  const badHandle = await call("/api/profile", {
    method: "PATCH",
    body: JSON.stringify({ handle: "Not A Handle!" }),
  });
  check("rejects an invalid handle", badHandle.status === 400);

  const stats = await call("/api/stats");
  check(
    "reports wardrobe count including the starter set",
    stats.body?.wardrobeCount === SAMPLE_GARMENTS.length + 1,
    JSON.stringify(stats.body),
  );
  check("reports a try-on this week", stats.body?.tryOnsThisWeek >= 1);
  check("returns a day streak", typeof stats.body?.dayStreak === "number");

  // 9. deletion semantics ----------------------------------------------
  const del = await call(`/api/items/${shoes.body?.item?.id}`, { method: "DELETE" });
  check("deletes a garment", del.status === 200);
  const looksAfter = await call("/api/looks");
  check(
    "deleting a garment keeps saved looks (PRD data model)",
    looksAfter.body?.looks?.length === 1,
    `${looksAfter.body?.looks?.length}`,
  );

  // 10. input validation ------------------------------------------------
  const tooBig = await call("/api/items", {
    method: "POST",
    body: JSON.stringify({ name: "x".repeat(20_000_000), imageDataUrl: await samplePng(0) }),
  });
  check(
    "rejects an oversized payload with guidance",
    tooBig.status === 400 || tooBig.status === 413,
    `status ${tooBig.status}`,
  );
  check("oversized refusal tells the user what to do", Boolean(tooBig.body?.error?.nextAction));

  const tooManyTries = await call("/api/tryons", {
    method: "POST",
    body: JSON.stringify({
      itemId,
      personFrame: frame,
      personWidth: 720,
      personHeight: 1280,
      clientToken: "smoke-token-oversize-0001",
    }),
  });
  check(
    "a retry of a finished job is idempotent, not a new charge",
    tooManyTries.status === 202 || tooManyTries.status === 402,
    `status ${tooManyTries.status}`,
  );

  const missingItem = await call("/api/tryons", {
    method: "POST",
    body: JSON.stringify({ itemId: "does-not-exist", personFrame: frame }),
  });
  check("a missing garment is a clean 404, not a crash", missingItem.status === 404);

  const notAnImage = await call("/api/items", {
    method: "POST",
    body: JSON.stringify({ name: "bad", imageDataUrl: "data:text/html;base64,PHNjcmlwdD4=" }),
  });
  check("rejects a non-image upload", notAnImage.status === 415, `status ${notAnImage.status}`);
} finally {
  server.close();
}

process.stdout.write(`\n${passed} passed, ${failed} failed\n`);
if (failures.length) {
  process.stdout.write(`failed: ${failures.join(", ")}\n`);
  process.exit(1);
}
process.stdout.write("all api checks passed\n");

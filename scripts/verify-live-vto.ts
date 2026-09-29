/**
 * Verifies the live-vto adapter against real backends.
 *
 * This goes through the PWA's own provider adapter — the exact object the app
 * uses — not a curl shortcut to the backend. Four phases:
 *
 *   A. Keyed backend: mint a REAL session (201 + genuine client token),
 *      heartbeat, garment switch without reconnecting, end with duration.
 *   B. PWA route with the backend up: starting a live session mints a
 *      browser-renderable session — 201, a genuine client token, frame null
 *      (no stand-in is ever faked) — and ending it releases the backend
 *      session so duration and cost get logged.
 *   C. Backend down: the adapter and the PWA route both fail with the exact
 *      "Try-on unavailable — check your connection." copy. Never a fake frame.
 *   D. Backend up but unconfigured (no Decart key): the backend's own 503
 *      surfaces with its "not configured" message, nothing minted.
 *
 * Backends are spawned as child processes and killed afterwards. Client tokens
 * are never printed — only their shape (length, dot-parts, mock prefix check).
 *
 * Knobs (env): BACKEND_REAL_DIR, BACKEND_BARE_DIR, BACKEND_PORT (default 4000),
 * PWA_PORT (default 8788).
 *
 * Run: npm run verify:live
 */
import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import sharp from "sharp";

const PWA_DIR = process.cwd();
const BACKEND_REAL_DIR =
  process.env.BACKEND_REAL_DIR ??
  "C:\\Users\\System10\\Downloads\\raritone-live-vto (1)\\raritone-live-vto\\backend";
const BACKEND_BARE_DIR =
  process.env.BACKEND_BARE_DIR ??
  "C:\\Users\\System10\\Downloads\\raritone-live-vto\\raritone-live-vto\\backend";
const BACKEND_PORT = Number(process.env.BACKEND_PORT ?? 4000);
const PWA_PORT = Number(process.env.PWA_PORT ?? 8788);

const backendBase = `http://127.0.0.1:${BACKEND_PORT}`;
const pwaBase = `http://127.0.0.1:${PWA_PORT}`;

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

interface Spawned {
  child: ChildProcess;
  output: string;
  name: string;
}

const spawned: Spawned[] = [];

function spawnServer(name: string, cwd: string, args: string[], env: Record<string, string>): Spawned {
  const child = spawn(process.execPath, args, {
    cwd,
    env: { ...process.env, ...env, FORCE_COLOR: "0" },
    stdio: ["ignore", "pipe", "pipe"],
  });
  const record: Spawned = { child, output: "", name };
  child.stdout?.on("data", (chunk: Buffer) => {
    record.output += chunk.toString();
  });
  child.stderr?.on("data", (chunk: Buffer) => {
    record.output += chunk.toString();
  });
  spawned.push(record);
  return record;
}

function killAll(): void {
  for (const { child } of spawned) {
    try {
      if (child.pid === undefined) continue;
      if (process.platform === "win32") {
        spawnSync("taskkill", ["/pid", String(child.pid), "/T", "/F"], { stdio: "ignore" });
      } else {
        child.kill("SIGTERM");
      }
    } catch {
      // Already gone.
    }
  }
  spawned.length = 0;
}

async function waitFor(url: string, timeoutMs: number): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      await fetch(url);
      return true;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }
  return false;
}

async function readJson(response: Response): Promise<any> {
  const text = await response.text();
  try {
    return text ? JSON.parse(text) : null;
  } catch {
    return text;
  }
}

/** Never print a token. Shape only: length, dot-parts, and the mock check. */
function tokenShape(token: string): string {
  const parts = token.split(".").length;
  const mock = token.startsWith("mock.");
  return `len=${token.length} parts=${parts} mockPrefix=${mock}`;
}

function backendLogLines(record: Spawned, phase: string): void {
  const lines = record.output
    .split(/\r?\n/)
    .filter((line) => line.includes("[live-vto]") && /session_(start|end|heartbeat)|expired|expired/i.test(line));
  if (lines.length > 0) {
    process.stdout.write(`  [backend usage log, ${phase}]\n`);
    for (const line of lines.slice(-8)) process.stdout.write(`    ${line.trim()}\n`);
  }
}

async function personFrame(): Promise<string> {
  const jpeg = await sharp({
    create: { width: 480, height: 640, channels: 3, background: { r: 60, g: 70, b: 90 } },
  })
    .jpeg({ quality: 85 })
    .toBuffer();
  return `data:image/jpeg;base64,${jpeg.toString("base64")}`;
}

async function main(): Promise<void> {
  process.stdout.write("\nraritone live-vto adapter verification\n");

  const { createLiveVtoProvider } = await import("../server/provider/liveVto.js");
  const adapter = createLiveVtoProvider({ baseUrl: backendBase, connectTimeoutMs: 12000 });

  // --- phase A: real backend, real session --------------------------------
  process.stdout.write("\n[A] keyed backend — mint, heartbeat, switch, end\n");
  const real = spawnServer("backend-real", BACKEND_REAL_DIR, ["--import", "tsx", "src/index.ts"], {
    PORT: String(BACKEND_PORT),
  });
  check("keyed backend boots", await waitFor(`${backendBase}/healthz`, 60000));

  const configRes = await fetch(`${backendBase}/api/live-vto/config`);
  const configBody = await readJson(configRes);
  check("backend reports its provider honestly", configRes.status === 200, `status ${configRes.status}`);
  process.stdout.write(
    `  [backend] provider=${configBody?.provider} configured=${configBody?.configured} model=${configBody?.modelId}\n`,
  );
  const realInference = configBody?.provider === "decart" && configBody?.configured === true;
  check("backend can mint REAL Decart sessions", realInference, `provider=${configBody?.provider}`);

  if (realInference) {
    const handle = await adapter.startLive({
      userId: "verify_user_a",
      person: { frameDataUrl: await personFrame(), width: 480, height: 640, capturedAt: Date.now() },
      garment: { itemId: "verify_garment_1", imageUrl: "data:image/png;base64,iVBORw0KGgo=", category: "tops", qualityState: "ready" },
      maxSeconds: 90,
      networkMbps: null,
      clientToken: "verify-token-a-0001",
    });
    check("adapter minted a session (backend 201 underneath)", typeof handle.providerSessionId === "string");
    const token: string = handle.internals?.clientToken as string;
    check("client token is genuine (not a mock token)", token.length > 32 && !token.startsWith("mock."), tokenShape(token));
    process.stdout.write(`  [token] ${tokenShape(token)} (value never printed)\n`);

    const statusRes = await fetch(`${backendBase}/api/live-vto/session/${handle.providerSessionId}`);
    const statusBody = await readJson(statusRes);
    check("backend session is active", statusRes.status === 200 && statusBody?.status === "active", `status ${statusRes.status}`);

    const beatRes = await fetch(`${backendBase}/api/live-vto/session/${handle.providerSessionId}/heartbeat`, { method: "POST" });
    check("heartbeat is tracked", beatRes.status === 200, `status ${beatRes.status}`);

    const beforeSwitch = handle.providerSessionId;
    await adapter.switchLiveGarment(handle, { itemId: "verify_garment_2", imageUrl: "data:image/png;base64,iVBORw0KGgo=", category: "tops", qualityState: "ready" });
    check("garment switch keeps the SAME session (no reconnect)", handle.providerSessionId === beforeSwitch);
    const afterSwitch = await readJson(await fetch(`${backendBase}/api/live-vto/session/${handle.providerSessionId}`));
    check("backend session still active after switch", afterSwitch?.status === "active");

    await adapter.endLive(handle, "verify_done");
    // Ending is idempotent: a second DELETE still reports 200 with the final
    // duration, which is what the cost guardrail displays per session.
    const endRes = await fetch(`${backendBase}/api/live-vto/session/${handle.providerSessionId}`, { method: "DELETE" });
    const endBody = await readJson(endRes);
    check("ended session reports its duration", endRes.status === 200 && typeof endBody?.durationSec === "number", JSON.stringify(endBody));
    process.stdout.write(`  [duration] backend burned ${endBody?.durationSec}s, ~$${endBody?.estimatedCostUsd} (from DELETE response)\n`);
    backendLogLines(real, "phase A");
  } else {
    process.stdout.write("  [skip] no Decart key: real-token minting cannot be proven without one.\n");
  }
  killAll();

  // --- phase B: PWA route with backend up — real token, no fake frames ----
  process.stdout.write("\n[B] PWA route with backend up — browser-renderable session\n");
  const real2 = spawnServer("backend-real", BACKEND_REAL_DIR, ["--import", "tsx", "src/index.ts"], {
    PORT: String(BACKEND_PORT),
  });
  void real2;
  check("keyed backend boots again", await waitFor(`${backendBase}/healthz`, 60000));

  const dataDir = mkdtempSync(join(tmpdir(), "raritone-verify-"));
  const pwa = spawnServer("pwa", PWA_DIR, ["--import", "tsx", "server/index.ts"], {
    PORT: String(PWA_PORT),
    HOST: "127.0.0.1",
    TRYON_PROVIDER: "live-vto",
    LIVE_VTO_BASE_URL: backendBase,
    DATA_DIR: dataDir,
  });
  void pwa;
  check("PWA boots on live-vto", await waitFor(`${pwaBase}/api/health`, 60000));

  const deviceB = "verify_device_b_0001";
  const boot = await readJson(
    await fetch(`${pwaBase}/api/bootstrap`, { headers: { "x-device-id": deviceB } }),
  );
  const itemId: string = boot?.items?.[0]?.id ?? "";
  check("PWA seeded a garment to try on with", itemId.length > 0);

  const healthBefore = await readJson(await fetch(`${backendBase}/healthz`));
  // No personFrame on purpose: a browser-rendered session must be mintable
  // without the guest's pixels ever touching this server.
  const startRes = await fetch(`${pwaBase}/api/live/sessions`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-device-id": deviceB },
    body: JSON.stringify({
      itemId,
      personWidth: 480,
      personHeight: 640,
      clientToken: "verify-token-b-0001",
    }),
  });
  const startBody = await readJson(startRes);
  check("PWA mints a live session (201)", startRes.status === 201, `status ${startRes.status}`);
  const browserToken = String(startBody?.browser?.clientToken ?? "");
  check(
    "minted with no person frame posted at all",
    startRes.status === 201 && typeof startBody?.browser === "object",
    "person pixels stayed in the browser",
  );
  check(
    "response carries a clientToken for the browser",
    browserToken.length > 100,
    `len=${browserToken.length}`,
  );
  check(
    "clientToken is a real JWT, not a mock token",
    browserToken.split(".").length === 3 && !browserToken.startsWith("mock."),
    `parts=${browserToken.split(".").length} mock=${browserToken.startsWith("mock.")}`,
  );
  check(
    "no server-rendered frame is faked",
    startBody?.frame === null || startBody?.frame === undefined,
    JSON.stringify(startBody?.frame ?? null),
  );
  check(
    "bootstrap tells the camera to render in the browser",
    boot?.tryOn?.renderMode === "browser",
    boot?.tryOn?.renderMode,
  );
  const healthAfter = await readJson(await fetch(`${backendBase}/healthz`));
  check(
    "a real backend session backs the mint",
    Number(healthAfter?.activeSessions) > Number(healthBefore?.activeSessions),
    `before=${healthBefore?.activeSessions} after=${healthAfter?.activeSessions}`,
  );

  const endRes = await fetch(`${pwaBase}/api/live/sessions/${startBody?.sessionId ?? ""}`, {
    method: "DELETE",
    headers: { "x-device-id": deviceB },
  });
  check("leaving the camera ends the session (200)", endRes.status === 200, `status ${endRes.status}`);
  const healthEnded = await readJson(await fetch(`${backendBase}/healthz`));
  check(
    "ending released the backend session so duration can be logged",
    Number(healthEnded?.activeSessions) < Number(healthAfter?.activeSessions),
    `after=${healthAfter?.activeSessions} ended=${healthEnded?.activeSessions}`,
  );

  // --- phase C: backend down — exact unavailable copy ----------------------
  process.stdout.write("\n[C] backend down — exact unavailable copy, never fake\n");
  killAll();
  const pwa2 = spawnServer("pwa", PWA_DIR, ["--import", "tsx", "server/index.ts"], {
    PORT: String(PWA_PORT),
    HOST: "127.0.0.1",
    TRYON_PROVIDER: "live-vto",
    LIVE_VTO_BASE_URL: backendBase,
    DATA_DIR: dataDir,
  });
  check("PWA boots without the backend", await waitFor(`${pwaBase}/api/health`, 60000));

  const downRes = await fetch(`${pwaBase}/api/live/sessions`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-device-id": deviceB },
    body: JSON.stringify({
      itemId,
      personFrame: await personFrame(),
      personWidth: 480,
      personHeight: 640,
      clientToken: "verify-token-c-0001",
    }),
  });
  const downBody = await readJson(downRes);
  check("PWA route reports unavailable, not a fake", downRes.status === 503, `status ${downRes.status}`);
  check(
    "message is exactly the required copy",
    downBody?.error?.message === "Try-on unavailable — check your connection.",
    downBody?.error?.message,
  );

  let adapterCopy = "";
  try {
    await adapter.startLive({
      userId: "verify_user_c",
      person: { frameDataUrl: await personFrame(), width: 480, height: 640, capturedAt: Date.now() },
      garment: { itemId: "x", imageUrl: "data:image/png;base64,iVBORw0KGgo=", category: "tops", qualityState: "ready" },
      maxSeconds: 90,
      networkMbps: null,
      clientToken: "verify-token-c-0002",
    });
  } catch (error) {
    adapterCopy = error instanceof Error ? error.message : String(error);
  }
  check("adapter itself throws the exact copy", adapterCopy === "Try-on unavailable — check your connection.", adapterCopy);

  // --- phase D: backend up but unconfigured — backend's own 503 surfaces ---
  process.stdout.write("\n[D] backend up, no Decart key — 'not configured' surfaces\n");
  killAll();
  const bare = spawnServer("backend-bare", BACKEND_BARE_DIR, ["--import", "tsx", "src/index.ts"], {
    PORT: String(BACKEND_PORT),
  });
  void bare;
  check("bare backend boots", await waitFor(`${backendBase}/healthz`, 60000));
  const bareConfig = await readJson(await fetch(`${backendBase}/api/live-vto/config`));
  check("bare backend admits it cannot serve real sessions", bareConfig?.provider === "unavailable", `provider=${bareConfig?.provider}`);

  let bareCopy = "";
  try {
    await adapter.startLive({
      userId: "verify_user_d",
      person: { frameDataUrl: await personFrame(), width: 480, height: 640, capturedAt: Date.now() },
      garment: { itemId: "x", imageUrl: "data:image/png;base64,iVBORw0KGgo=", category: "tops", qualityState: "ready" },
      maxSeconds: 90,
      networkMbps: null,
      clientToken: "verify-token-d-0001",
    });
  } catch (error) {
    bareCopy = error instanceof Error ? error.message : String(error);
  }
  check("unconfigured backend is reported, not faked", /not configured/i.test(bareCopy), bareCopy);
  void pwa2;

  try {
    rmSync(dataDir, { recursive: true, force: true });
  } catch {
    // Best effort; the OS reclaims temp.
  }
}

try {
  await main();
} catch (error) {
  failed += 1;
  failures.push("unexpected error");
  process.stdout.write(`  FAIL unexpected — ${error instanceof Error ? error.message : String(error)}\n`);
} finally {
  killAll();
}

process.stdout.write(`\n${passed} passed, ${failed} failed\n`);
if (failures.length > 0) {
  process.stdout.write(`failed: ${failures.join(", ")}\n`);
  process.exit(1);
}
process.stdout.write("live-vto adapter verification complete\n");

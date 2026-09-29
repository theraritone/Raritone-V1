/**
 * Verifies the production server: the built PWA and the API served from one
 * process on one port, which is how the app ships.
 *
 * Run after `npm run build`:  node --import tsx scripts/serve-check.ts
 */
import { readFileSync } from "node:fs";
import type { AddressInfo } from "node:net";
import { createApp, describeRuntime } from "../server/app.js";

let passed = 0;
let failed = 0;
const failures: string[] = [];

function check(name: string, condition: boolean, detail = ""): void {
  if (condition) {
    passed += 1;
    console.log(`  ok   ${name}`);
  } else {
    failed += 1;
    failures.push(name);
    console.log(`  FAIL ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

const DEVICE_ID = `serve_${Math.random().toString(36).slice(2, 14)}`;
const server = createApp().listen(0, "127.0.0.1");
await new Promise<void>((resolve) => server.once("listening", resolve));
const { port } = server.address() as AddressInfo;
const base = `http://127.0.0.1:${port}`;

try {
  console.log("\nraritone production server check\n");
  for (const line of describeRuntime()) console.log(line.replace(/^ {2}/, "  "));

  // --- the built shell -------------------------------------------------
  const root = await fetch(`${base}/`);
  const html = await root.text();
  check("serves the built app at /", root.status === 200, `status ${root.status}`);
  check("declares the PWA manifest", html.includes('rel="manifest"'));
  check("is marked as a web app", html.includes("apple-mobile-web-app-capable"));
  check("mounts the React root", html.includes('id="root"'));
  check("does not ship the dev client", !html.includes("/@vite/client"));

  const icon = await fetch(`${base}/icons/icon-192.png`);
  check("serves the PWA icon", icon.status === 200 && icon.headers.get("content-type") === "image/png");

  const manifest = await fetch(`${base}/manifest.json`);
  const manifestBody = (await manifest.json()) as { name?: string; display?: string; icons?: unknown[] };
  check("serves a standalone manifest", manifestBody.display === "standalone", manifestBody.display);
  check("manifest declares icons", (manifestBody.icons?.length ?? 0) >= 2);

  // Deep links must reach the shell, not 404, or a shared link opens nothing.
  const deep = await fetch(`${base}/wardrobe`);
  check("unknown paths fall back to the app shell", deep.status === 200);

  // An unknown API route must stay a JSON 404, not the HTML shell.
  const missingApi = await fetch(`${base}/api/nope`, { headers: { "x-device-id": DEVICE_ID } });
  check("unknown API routes are still 404s", missingApi.status === 404, `status ${missingApi.status}`);

  // --- the API, same origin -------------------------------------------
  const boot = await fetch(`${base}/api/bootstrap`, { headers: { "x-device-id": DEVICE_ID } });
  const bootBody = (await boot.json()) as { items?: unknown[]; usage?: { photoAllowance?: number } };
  check("serves the API from the same origin", boot.status === 200);
  check("the camera opens with garments ready", (bootBody.items?.length ?? 0) > 0);
  check("a guest gets one try-on", bootBody.usage?.photoAllowance === 1);

  // --- the service worker ----------------------------------------------
  const sw = await fetch(`${base}/sw.js`);
  check("serves the service worker", sw.status === 200);
  check(
    "service worker is served as JavaScript",
    (sw.headers.get("content-type") ?? "").includes("javascript"),
    sw.headers.get("content-type") ?? "none",
  );

  // --- static asset caching --------------------------------------------
  const cssHref = /href="(\/assets\/[^"]+\.css)"/.exec(html)?.[1];
  if (cssHref) {
    const css = await fetch(`${base}${cssHref}`);
    check("serves the hashed stylesheet", css.status === 200, cssHref);
  } else {
    check("build emitted a stylesheet reference", false, "no /assets/*.css in index.html");
  }
} finally {
  server.close();
}

console.log(`\n${passed} passed, ${failed} failed`);
if (failures.length) {
  console.log(`failed: ${failures.join(", ")}`);
  process.exit(1);
}
console.log("production server looks right");

// Fail loudly if the build is missing, so this is not silently green.
try {
  readFileSync("dist/index.html", "utf8");
} catch {
  console.error("\ndist/ is missing — run `npm run build` first.");
  process.exit(1);
}

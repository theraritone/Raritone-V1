/**
 * Verifies the development path: Vite on 5173, the API on 8787, and the proxy
 * between them. This is the mode a developer actually uses, and it is the one
 * where a missing proxy rule only shows up at runtime.
 *
 * Run: node --import tsx scripts/dev-check.ts
 */
import { spawn, type ChildProcess } from "node:child_process";

const children: ChildProcess[] = [];

function run(name: string, args: string[]): ChildProcess {
  const child = spawn("npx", args, {
    stdio: ["ignore", "pipe", "pipe"],
    env: { ...process.env, FORCE_COLOR: "0" },
    shell: process.platform === "win32",
  });
  child.stdout?.on("data", () => {});
  child.stderr?.on("data", (chunk: Buffer) => {
    const text = chunk.toString();
    // A port clash is the one dev-server failure worth surfacing immediately.
    if (/EADDRINUSE|error when starting dev server/i.test(text)) {
      process.stderr.write(`[${name}] ${text}`);
    }
  });
  children.push(child);
  return child;
}

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

/**
 * Any HTTP response means the port is listening. A 401 counts: `/api/bootstrap`
 * correctly refuses a request with no device id, and treating that as "not up"
 * would make this check fail on correct behaviour.
 */
async function waitFor(url: string, timeoutMs: number): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      await fetch(url);
      return true;
    } catch {
      // Not listening yet.
    }
    await new Promise((resolve) => setTimeout(resolve, 400));
  }
  return false;
}

async function main(): Promise<void> {
  console.log("\nraritone dev environment check\n");
  run("api", ["tsx", "server/index.ts"]);
  run("web", ["vite", "--host", "0.0.0.0", "--port", "5173"]);

  const apiUp = await waitFor("http://127.0.0.1:8787/api/bootstrap", 40_000).catch(() => false);
  check("the API starts on 8787", apiUp);

  const webUp = await waitFor("http://127.0.0.1:5173/", 40_000).catch(() => false);
  check("Vite starts on 5173", webUp);

  if (webUp) {
    const html = await (await fetch("http://127.0.0.1:5173/")).text();
    check("serves the dev entry point", html.includes('id="root"'));
    check("injects the Vite client", html.includes("/@vite/client"));

    // The proxy is the part that silently breaks: same-origin /api calls from the
    // browser have to reach the API or every screen shows an offline error.
    const proxied = await fetch("http://127.0.0.1:5173/api/bootstrap", {
      headers: { "x-device-id": "devcheck_0000000000001" },
    });
    const body = (await proxied.json()) as { items?: unknown[]; usage?: { photoAllowance?: number } };
    check("proxies /api to the API server", proxied.status === 200, `status ${proxied.status}`);
    check("proxied bootstrap carries garments", (body.items?.length ?? 0) > 0);
    check("proxied bootstrap carries the guest allowance", body.usage?.photoAllowance === 1);

    const module = await fetch("http://127.0.0.1:5173/src/main.tsx");
    check("transforms TSX on request", module.status === 200, `status ${module.status}`);
  }
}

try {
  await main();
} catch (error) {
  failed += 1;
  failures.push("unexpected error");
  console.log(`  FAIL unexpected — ${error instanceof Error ? error.message : String(error)}`);
} finally {
  for (const child of children) {
    try {
      if (process.platform === "win32") {
        spawn("taskkill", ["/pid", String(child.pid), "/T", "/F"], { stdio: "ignore" });
      } else {
        child.kill("SIGTERM");
      }
    } catch {
      // Already gone.
    }
  }
}

console.log(`\n${passed} passed, ${failed} failed`);
if (failures.length) {
  console.log(`failed: ${failures.join(", ")}`);
  process.exit(1);
}
console.log("dev environment looks right");

import { networkInterfaces } from "node:os";
import { readFileSync } from "node:fs";
import { createServer as createHttpsServer } from "node:https";
import { createApp, describeRuntime } from "./app.js";
import { config } from "./env.js";
import { repo } from "./lib/db.js";

const app = createApp();

app.listen(config.port, config.host, () => {
  const lines = [
    "",
    "  Raritone v1 — camera-first virtual wardrobe",
    `  api        http://${config.host}:${config.port}/api`,
    ...describeRuntime(),
  ];
  for (const url of lanUrls(config.port, "http")) lines.push(`  lan        ${url}`);
  if (tlsEnabled()) {
    for (const url of lanUrls(config.tls.port, "https")) lines.push(`  lan-tls    ${url}`);
  }
  lines.push("");
  process.stdout.write(`${lines.join("\n")}\n`);
});

if (tlsEnabled()) {
  createHttpsServer(
    {
      cert: readFileSync(config.tls.certPath),
      key: readFileSync(config.tls.keyPath),
    },
    app,
  ).listen(config.tls.port, config.host, () => {
    process.stdout.write(`  [raritone] lan https on :${config.tls.port}\n`);
  });
}

function tlsEnabled(): boolean {
  return config.tls.port > 0 && config.tls.certPath !== "" && config.tls.keyPath !== "";
}

/** LAN origins, so the dev URL to open on a phone is never a guess. */
function lanUrls(port: number, scheme: "http" | "https"): string[] {
  const out: string[] = [];
  for (const addresses of Object.values(networkInterfaces())) {
    for (const address of addresses ?? []) {
      if (address.family !== "IPv4" || address.internal) continue;
      out.push(`${scheme}://${address.address}:${port}/`);
    }
  }
  return out;
}

process.on("SIGINT", () => {
  process.stdout.write(`\n[raritone] stopping (${repo.driver})\n`);
  process.exit(0);
});

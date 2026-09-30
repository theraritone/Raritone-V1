import process from "node:process";
import { spawnSync } from "node:child_process";
import { checkMobileConfiguration, mobileEnv } from "./mobile-config.mjs";

const mode = process.env.MOBILE_BUILD_MODE ?? "production";
const config = checkMobileConfiguration(mobileEnv(mode));
if (!config.ok) {
  console.error(`Mobile build stopped: ${config.error}`);
  process.exit(1);
}

const run = (args) => {
  // Invoke npm's JS entry point directly: spawning npm.cmd without a shell
  // fails with EINVAL on Windows. Never interpolate env values into a shell.
  const npmCli = process.env.npm_execpath;
  if (!npmCli) throw new Error("Run this script using npm run mobile:build.");
  const result = spawnSync(process.execPath, [npmCli, ...args], {
    stdio: "inherit",
    env: { ...process.env, VITE_API_BASE_URL: config.origin },
  });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
};

// Keep the existing build stages while passing the selected mode directly to
// Vite (rather than relying on npm's argument forwarding through `build`).
run(["run", "typecheck"]);
run(["exec", "vite", "--", "build", "--mode", mode]);
run(["run", "check:styles"]);
run(["exec", "cap", "sync"]);

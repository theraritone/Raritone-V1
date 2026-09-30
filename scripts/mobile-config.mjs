import process from "node:process";
import { fileURLToPath } from "node:url";
import { loadEnv } from "vite";

/**
 * Validate the origin baked into a Capacitor bundle. This function is pure so
 * it can also be used by the configuration check and its unit tests.
 */
export function validateMobileApiBaseUrl(value) {
  if (typeof value !== "string" || value.trim() === "") {
    return { ok: false, error: "VITE_API_BASE_URL is required for a native build." };
  }

  const input = value.trim();
  let url;
  try {
    url = new URL(input);
  } catch {
    return { ok: false, error: "VITE_API_BASE_URL must be a valid HTTPS origin." };
  }

  if (url.protocol !== "https:") {
    return { ok: false, error: "VITE_API_BASE_URL must use HTTPS." };
  }
  if (url.username || url.password) {
    return { ok: false, error: "VITE_API_BASE_URL must not contain credentials." };
  }
  if (url.search || url.hash) {
    return { ok: false, error: "VITE_API_BASE_URL must not contain a query or fragment." };
  }
  if (url.pathname !== "/") {
    return { ok: false, error: "VITE_API_BASE_URL must be an origin without a path." };
  }

  return { ok: true, origin: url.origin };
}

export function mobileEnv(mode = "production", root = process.cwd()) {
  // Explicit process values win over .env files, matching Vite's precedence.
  return { ...loadEnv(mode, root, ""), ...process.env };
}

export function checkMobileConfiguration(env) {
  return validateMobileApiBaseUrl(env.VITE_API_BASE_URL);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const mode = process.argv[2] ?? "production";
  const result = checkMobileConfiguration(mobileEnv(mode));
  if (!result.ok) {
    console.error(`Mobile configuration invalid: ${result.error}`);
    process.exitCode = 1;
  } else {
    console.log(`Mobile configuration valid: ${result.origin}`);
  }
}

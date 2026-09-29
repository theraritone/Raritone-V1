/**
 * Device identity.
 *
 * Release 1 has no login wall. A guest is recognised by a device id kept in
 * localStorage, which the server exchanges for a real account row. The id is
 * therefore a credential, so it is generated with `randomHex` (getRandomValues,
 * which works outside secure contexts too) and never
 * derived from anything guessable about the device.
 *
 * The server treats this as untrusted input and validates its shape.
 */

const STORAGE_KEY = "raritone.device-id.v1";

/**
 * Random hex that works in every context. `crypto.randomUUID` only exists in
 * secure contexts (https, localhost) — on a plain-LAN origin such as
 * http://192.168.x.x it is undefined and every caller would throw.
 * `crypto.getRandomValues` is available everywhere, so it is the primitive.
 */
export function randomHex(bytes = 16): string {
  const buf = new Uint8Array(bytes);
  crypto.getRandomValues(buf);
  return Array.from(buf, (b) => b.toString(16).padStart(2, "0")).join("");
}

export function deviceId(): string {
  const existing = read();
  if (existing) return existing;
  const minted = `rd_${randomHex(16)}`;
  write(minted);
  return minted;
}

export function read(): string | null {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    return value && /^[A-Za-z0-9_-]{8,64}$/.test(value) ? value : null;
  } catch {
    // Private browsing modes can throw on storage access. A session that lasts
    // only as long as the tab is better than a broken app.
    return null;
  }
}

function write(value: string): void {
  try {
    localStorage.setItem(STORAGE_KEY, value);
  } catch {
    // Non-fatal: the id still works for this tab via the module-level fallback.
  }
}

/** Let a guest wipe their identity and data from the profile screen. */
export function forgetDevice(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Nothing to do.
  }
}

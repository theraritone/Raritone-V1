import { createHmac, timingSafeEqual } from "node:crypto";
import type { NextFunction, Request, Response } from "express";
import type { ApiErrorBody, UserId } from "../../shared/types.js";
import { config } from "../env.js";
import { repo } from "./db.js";

/**
 * Guest identity, keyed on a device id (FR-001, D-04). No passwords, no login
 * wall: the app opens straight to the camera.
 *
 * The device id is a client-generated random string persisted in localStorage.
 * The server treats it as an opaque key, never as a credential — possession of
 * the same id is what links a device to its wardrobe, which is the intended
 * "private by default, same device" model for Release 1.
 */

const DEVICE_ID_PATTERN = /^[A-Za-z0-9_-]{16,128}$/;

export function isValidDeviceId(value: unknown): value is string {
  return typeof value === "string" && DEVICE_ID_PATTERN.test(value);
}

export function newDeviceId(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(36).padStart(2, "0")).join("").slice(0, 40);
}

interface GuestClaims {
  sub: UserId;
  role: "authenticated";
  aud: "authenticated";
  iss: "raritone";
  iat: number;
  exp: number;
}

function b64url(input: Buffer | string): string {
  return Buffer.from(input).toString("base64url");
}

function sign(data: string, secret: string): string {
  return createHmac("sha256", secret).update(data).digest("base64url");
}

/**
 * Mints a Supabase-compatible access token for a guest, using the project's own
 * JWT secret. This is what lets the client read rows through PostgREST with RLS
 * active while the service-role key stays on the server.
 */
export function mintGuestToken(userId: UserId): string {
  if (!config.supabase.jwtSecret) {
    throw new Error("SUPABASE_JWT_SECRET is not configured");
  }
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const claims: GuestClaims = {
    sub: userId,
    role: "authenticated",
    aud: "authenticated",
    iss: "raritone",
    iat: now,
    exp: now + 60 * 60 * 12,
  };
  const body = b64url(JSON.stringify(claims));
  const signature = sign(`${header}.${body}`, config.supabase.jwtSecret);
  return `${header}.${body}.${signature}`;
}

export function verifyGuestToken(token: string): GuestClaims | null {
  if (!config.supabase.jwtSecret) return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [header, body, signature] = parts;
  const expected = sign(`${header}.${body}`, config.supabase.jwtSecret);
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const claims = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as GuestClaims;
    if (claims.exp * 1000 < Date.now()) return null;
    return claims;
  } catch {
    return null;
  }
}

declare module "express-serve-static-core" {
  interface Request {
    /** Populated by `requireUser`. */
    userId?: UserId;
    deviceId?: string;
  }
}

/**
 * Express middleware that resolves the caller.
 *
 * The device id is the guest credential for Release 1; a bearer token is accepted
 * too so the same middleware keeps working once real authentication ships. Either
 * way the request carries a resolved `userId` for the rest of its life.
 */
export function requireUser(req: Request, res: Response, next: NextFunction): void {
  void resolveUser(req)
    .then((userId) => {
      req.userId = userId;
      next();
    })
    .catch((error: unknown) => {
      if (error instanceof NoSessionError) {
        res.status(401).json({
          error: {
            category: "permission_denied",
            message: "This device has no Raritone session yet.",
            nextAction: "Reopen the app to start a new guest session.",
            retryIsFree: true,
          },
        } satisfies ApiErrorBody);
        return;
      }
      throw error;
    });
}

export class NoSessionError extends Error {
  constructor() {
    super("no_session");
    this.name = "NoSessionError";
  }
}

async function resolveUser(req: Request): Promise<UserId> {
  const deviceId = extractDeviceId(req);
  if (deviceId) {
    const session = await repo.getOrCreateSession(deviceId);
    req.deviceId = deviceId;
    await repo.touchActivity(session.userId, today());
    return session.userId;
  }

  const header = req.header("authorization");
  if (header?.startsWith("Bearer ")) {
    const claims = verifyGuestToken(header.slice(7).trim());
    if (claims) {
      await repo.touchActivity(claims.sub, today());
      return claims.sub;
    }
  }

  throw new NoSessionError();
}

function extractDeviceId(req: Request): string | null {
  const candidates = [
    req.header("x-device-id"),
    (req.query.deviceId as string | undefined) ?? undefined,
  ];
  for (const candidate of candidates) {
    if (isValidDeviceId(candidate)) return candidate;
  }
  return null;
}

export function today(): string {
  return new Date().toISOString().slice(0, 10);
}

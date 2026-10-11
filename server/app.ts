import express from "express";
import cors from "cors";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { api } from "./routes/api.js";
import { siteApi } from "./routes/site.js";
import { config } from "./env.js";
import { repo } from "./lib/db.js";
import { fail, handler, HttpError } from "./lib/http.js";
import { requireUser } from "./lib/auth.js";
import { activeProvider } from "./provider/index.js";

/**
 * The express application, with no listener attached. `index.ts` starts it; the
 * smoke tests mount it on an ephemeral port. Keeping the two apart is what lets
 * the whole API be exercised in a single process.
 */
export function createApp(): express.Express {
  const app = express();

  app.disable("x-powered-by");
  // TEMP-DIAG-ACCESS-LOG: phone-reachability diagnosis, remove after.
  if (process.env.ACCESS_LOG === "1") {
    app.use((req, res, next) => {
      const started = Date.now();
      res.on("finish", () => {
        console.log(
          `[access] ${req.ip} ${req.method} ${req.originalUrl} -> ${res.statusCode} ${Date.now() - started}ms`,
        );
      });
      next();
    });
  }
  app.use(cors({ origin: true, credentials: false }));
  // Camera frames arrive as base64 data URLs, so the JSON limit is generous —
  // but it is still a limit.
  app.use(express.json({ limit: "32mb" }));

  app.use(rateLimit);
  // The website's API lives at /api/site and must be reachable before any
  // device session exists — signing up is the first thing a visitor does.
  app.use("/api/site", siteApi);
  app.use("/api", requireUser);
  app.use("/api", api);

  // Local-driver media. The Supabase driver serves private buckets with
  // short-lived signed URLs instead, so nothing here is a public object address.
  app.get(
    "/media/*splat",
    handler(async (req, res) => {
      const params = req.params as Record<string, string | string[] | undefined>;
      const raw = params.splat;
      const storagePath = Array.isArray(raw) ? (raw[0] ?? "") : (raw ?? "");
      if (!storagePath) throw new HttpError(404, "not_found", "Media not found.");
      const media = await repo.readMedia(storagePath);
      if (!media) throw new HttpError(404, "not_found", "Media not found.", "It may have been deleted.");
      res.setHeader("content-type", media.contentType);
      res.setHeader("cache-control", "private, max-age=3600");
      res.send(media.bytes);
    }),
  );

  // In production the same process serves the built PWA.
  const dist = resolve(process.cwd(), "dist");
  if (existsSync(dist)) {
    app.use(express.static(dist, { index: false, maxAge: "1h" }));
    app.get(/^(?!\/api|\/media).*/, (_req, res) => {
      res.sendFile(resolve(dist, "index.html"));
    });
  }

  app.use(
    (
      error: unknown,
      _req: express.Request,
      res: express.Response,
      _next: express.NextFunction,
    ) => {
      if (error instanceof SyntaxError && "body" in error) {
        res.status(400).json({
          error: {
            category: "invalid_input",
            message: "That request was too large or malformed.",
            nextAction: "Try a smaller image.",
            retryIsFree: true,
          },
        });
        return;
      }
      fail(res, error);
    },
  );

  return app;
}

/** Simple fixed-window rate limit, keyed by device id when present, else by IP. */
const buckets = new Map<string, { count: number; resetAt: number }>();

function rateLimit(
  req: express.Request,
  res: express.Response,
  next: express.NextFunction,
): void {
  const key = req.header("x-device-id") ?? req.ip ?? "anon";
  const now = Date.now();
  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + config.rateLimit.windowMs });
    next();
    return;
  }
  bucket.count += 1;
  if (bucket.count > config.rateLimit.max) {
    res.status(429).json({
      error: {
        category: "rate_limited",
        message: "Too many requests in a short time.",
        nextAction: "Wait a few seconds and continue.",
        retryIsFree: true,
      },
    });
    return;
  }
  next();
}

// Keep the bucket map from growing without bound on a long-running process.
setInterval(() => {
  const now = Date.now();
  for (const [key, bucket] of buckets) if (bucket.resetAt <= now) buckets.delete(key);
}, config.rateLimit.windowMs).unref();

export function describeRuntime(): string[] {
  const provider = activeProvider();
  return [
    `  storage    ${repo.driver} driver`,
    `  provider   ${provider.name} (${provider.providerClass})`,
    `  flags      live ${config.flags.liveTryOn ? "on" : "off"} · stories ${config.flags.stories ? "on (non-R1)" : "off"}`,
  ];
}

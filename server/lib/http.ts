import { randomUUID } from "node:crypto";
import type { Request, Response } from "express";
import type { ApiErrorBody, ErrorCategory } from "../../shared/types.js";
import { ProviderFailure } from "../provider/types.js";
import { LinkFetchError } from "./linkImport.js";

/** One error shape for every failure, so the client can always recover. */
export class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly category: ErrorCategory,
    message: string,
    readonly nextAction = "",
    readonly retryIsFree = false,
  ) {
    super(message);
    this.name = "HttpError";
  }
}

export function badRequest(message: string, nextAction = ""): HttpError {
  return new HttpError(400, "invalid_input", message, nextAction, true);
}

export function notFound(message = "That item no longer exists.", nextAction = "Refresh and try again."): HttpError {
  return new HttpError(404, "not_found", message, nextAction, true);
}

export function forbidden(message: string, nextAction: string): HttpError {
  return new HttpError(403, "permission_denied", message, nextAction, true);
}

export function traceId(): string {
  return `rt_${randomUUID().replace(/-/g, "").slice(0, 12)}`;
}

export function fail(res: Response, error: unknown): void {
  if (error instanceof HttpError) {
    const body: ApiErrorBody = {
      error: {
        category: error.category,
        message: error.message,
        nextAction: error.nextAction || undefined,
        retryIsFree: error.retryIsFree,
        traceId: traceId(),
      },
    };
    res.status(error.status).json(body);
    return;
  }

  if (error instanceof LinkFetchError) {
    res.status(422).json({
      error: {
        category: error.category,
        message: error.message,
        nextAction: error.nextAction,
        retryIsFree: true,
        traceId: traceId(),
      },
    } satisfies ApiErrorBody);
    return;
  }

  if (error instanceof ProviderFailure) {
    res.status(502).json({
      error: {
        category: error.detail.category,
        message: error.detail.message,
        nextAction: error.detail.nextAction,
        retryIsFree: true,
        traceId: traceId(),
      },
    } satisfies ApiErrorBody);
    return;
  }

  const id = traceId();
  // Never log image bytes, signed URLs, or provider credentials.
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`[raritone] error ${id}: ${message}\n`);
  res.status(500).json({
    error: {
      category: "internal",
      message: "Something went wrong on our side.",
      nextAction: "Retry in a moment. Nothing was saved and nothing was charged.",
      retryIsFree: true,
      traceId: id,
    },
  } satisfies ApiErrorBody);
}

/** Wraps an async handler so a rejection becomes a structured response. */
export function handler(
  fn: (req: Request, res: Response) => Promise<unknown>,
): (req: Request, res: Response) => void {
  return (req, res) => {
    fn(req, res).catch((error: unknown) => {
      if (!res.headersSent) fail(res, error);
    });
  };
}

/** Express 5 types route params as `string | string[]`; this narrows once. */
export function param(req: Request, name: string): string {
  const value = (req.params as Record<string, string | string[] | undefined>)[name];
  if (typeof value === "string") return value;
  if (Array.isArray(value) && typeof value[0] === "string") return value[0];
  throw badRequest(`Missing ${name}.`);
}

export function dataUrlToBuffer(dataUrl: string): { bytes: Buffer; contentType: string } {
  const match = /^data:([\w.+-]+\/[\w.+-]+)?(;charset=[\w-]+)?(;base64)?,/.exec(dataUrl);
  if (!match) throw badRequest("That image could not be read.", "Choose the image again.");
  const contentType = match[1] ?? "image/jpeg";
  const isBase64 = Boolean(match[3]);
  const payload = dataUrl.slice(match[0].length);
  const bytes = isBase64
    ? Buffer.from(payload, "base64")
    : Buffer.from(decodeURIComponent(payload), "utf8");
  if (bytes.byteLength === 0) {
    throw badRequest("That image looks empty.", "Choose a different image.");
  }
  return { bytes, contentType };
}

const ALLOWED_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/avif",
  "image/gif",
]);

/** FR: validate actual media type and size on upload, not just the client claim. */
export function assertUploadable(contentType: string, byteLength: number): void {
  if (!ALLOWED_IMAGE_TYPES.has(contentType)) {
    throw new HttpError(
      415,
      "invalid_input",
      "That file is not an image Raritone can use.",
      "Choose a JPG, PNG, or WebP screenshot.",
      true,
    );
  }
  if (byteLength > 12 * 1024 * 1024) {
    throw new HttpError(
      413,
      "invalid_input",
      "That image is larger than 12 MB.",
      "Crop the screenshot and try again.",
      true,
    );
  }
}

import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import type { GarmentCategory, LinkImportPreview, QualityState } from "../../shared/types.js";
import { config } from "../env.js";

/**
 * Product-link import (FR-201 … FR-203): validate the address, retrieve
 * permitted metadata, and surface candidate images so the user confirms the
 * right garment.
 *
 * Security: the PRD requires server-side fetches to be protected against
 * internal-network access and unsafe redirects. Every hop is resolved and
 * checked before the socket is opened, and the body is size-capped.
 *
 * When nothing usable is found the caller turns this into the honest fallback —
 * "Couldn't fetch that link — try uploading a screenshot instead" — never a
 * silent fake import.
 */

export class LinkFetchError extends Error {
  constructor(
    readonly category:
      | "invalid_input"
      | "upstream_link"
      | "provider_timeout"
      | "policy_blocked",
    message: string,
    readonly nextAction: string,
  ) {
    super(message);
    this.name = "LinkFetchError";
  }
}

export interface NormalizedLink {
  canonicalUrl: string;
  siteName: string;
}

const BLOCKED_HOSTNAMES = new Set([
  "localhost",
  "localhost.localdomain",
  "metadata.google.internal",
  "instance-data",
]);

export function normalizeProductUrl(raw: string): NormalizedLink {
  const trimmed = raw.trim();
  if (!trimmed) {
    throw new LinkFetchError("invalid_input", "Paste a product link to continue.", "Paste the link from a product page.");
  }
  const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;

  let url: URL;
  try {
    url = new URL(withScheme);
  } catch {
    throw new LinkFetchError(
      "invalid_input",
      "That does not look like a web address.",
      "Check the link and paste it again.",
    );
  }

  if (!config.linkImport.allowedSchemes.includes(url.protocol as "http:" | "https:")) {
    throw new LinkFetchError(
      "invalid_input",
      "Only http and https links can be imported.",
      "Paste a link copied from a browser address bar.",
    );
  }
  if (!url.hostname || BLOCKED_HOSTNAMES.has(url.hostname.toLowerCase())) {
    throw new LinkFetchError(
      "policy_blocked",
      "That address is not allowed.",
      "Paste a public product page instead.",
    );
  }
  url.hash = "";
  return {
    canonicalUrl: url.toString(),
    siteName: url.hostname.replace(/^www\./, ""),
  };
}

/** Rejects any address that resolves into a private, loopback, or link-local range. */
async function assertPublicHost(hostname: string): Promise<void> {
  const lowered = hostname.toLowerCase();
  if (BLOCKED_HOSTNAMES.has(lowered)) {
    throw new LinkFetchError(
      "policy_blocked",
      "That address is not allowed.",
      "Paste a public product page instead.",
    );
  }
  if (lowered.endsWith(".local") || lowered.endsWith(".internal")) {
    throw new LinkFetchError(
      "policy_blocked",
      "That address is not allowed.",
      "Paste a public product page instead.",
    );
  }

  const literal = isIP(lowered);
  const addresses = literal
    ? [{ address: lowered }]
    : await lookup(lowered, { all: true }).catch(() => {
        throw new LinkFetchError(
          "upstream_link",
          "That address could not be found.",
          "Check the link, or upload a screenshot instead.",
        );
      });

  for (const { address } of addresses) {
    if (isPrivateAddress(address)) {
      throw new LinkFetchError(
        "policy_blocked",
        "That address is not allowed.",
        "Paste a public product page instead.",
      );
    }
  }
}

function isPrivateAddress(address: string): boolean {
  if (address.includes(":")) {
    const lower = address.toLowerCase();
    if (lower === "::1" || lower === "::") return true;
    if (lower.startsWith("fe80") || lower.startsWith("fc") || lower.startsWith("fd")) return true;
    if (lower.startsWith("::ffff:")) return isPrivateAddress(lower.slice(7));
    return false;
  }
  const parts = address.split(".").map(Number);
  if (parts.length !== 4 || parts.some((p) => !Number.isInteger(p) || p < 0 || p > 255)) return true;
  const [a, b] = parts;
  if (a === 0 || a === 10 || a === 127) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 169 && b === 254) return true;
  if (a === 100 && b >= 64 && b <= 127) return true;
  if (a >= 224) return true;
  return false;
}

interface FetchedPage {
  html: string;
  finalUrl: string;
}

/** Fetch with a redirect walk that revalidates every hop. */
async function fetchPage(startUrl: string): Promise<FetchedPage> {
  let current = startUrl;
  for (let hop = 0; hop <= config.linkImport.maxRedirects; hop += 1) {
    const url = new URL(current);
    await assertPublicHost(url.hostname);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), config.linkImport.timeoutMs);
    let response: Response;
    try {
      response = await fetch(url, {
        redirect: "manual",
        signal: controller.signal,
        headers: {
          // A normal browser UA. Sites block unknown clients, and pretending to be
          // one is what "import a link the user is looking at" requires.
          "user-agent":
            "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 " +
            "(KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
          accept: "text/html,application/xhtml+xml",
          "accept-language": "en-IN,en;q=0.9",
        },
      });
    } catch {
      throw new LinkFetchError(
        "provider_timeout",
        "That page took too long to answer.",
        "Try again, or upload a screenshot instead.",
      );
    } finally {
      clearTimeout(timer);
    }

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (!location) break;
      current = new URL(location, url).toString();
      continue;
    }

    if (!response.ok) {
      throw new LinkFetchError(
        "upstream_link",
        `That page returned ${response.status} and could not be read.`,
        "Upload a screenshot instead — it works just as well.",
      );
    }

    const contentType = response.headers.get("content-type") ?? "";
    if (!contentType.includes("html") && !contentType.includes("text")) {
      throw new LinkFetchError(
        "upstream_link",
        "That link is not a product page.",
        "Open the product in a browser and copy the page link.",
      );
    }

    const buffer = await response.arrayBuffer();
    if (buffer.byteLength > config.linkImport.maxBytes) {
      throw new LinkFetchError(
        "upstream_link",
        "That page is too large to read.",
        "Upload a screenshot instead.",
      );
    }
    return {
      html: new TextDecoder("utf-8", { fatal: false }).decode(buffer),
      finalUrl: response.url || current,
    };
  }
  throw new LinkFetchError(
    "upstream_link",
    "That link redirected too many times.",
    "Paste the final product page link instead.",
  );
}

// --- metadata extraction -------------------------------------------------

function metaContent(html: string, ...keys: string[]): string | null {
  for (const key of keys) {
    const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const patterns = [
      new RegExp(
        `<meta[^>]+(?:property|name|itemprop)\\s*=\\s*["']${escaped}["'][^>]*?content\\s*=\\s*["']([^"']{1,2000})["']`,
        "i",
      ),
      new RegExp(
        `<meta[^>]+content\\s*=\\s*["']([^"']{1,2000})["'][^>]*?(?:property|name|itemprop)\\s*=\\s*["']${escaped}["']`,
        "i",
      ),
    ];
    for (const pattern of patterns) {
      const match = html.match(pattern);
      if (match?.[1]) return decodeEntities(match[1].trim());
    }
  }
  return null;
}

function linkHref(html: string, rel: string): string | null {
  const pattern = new RegExp(
    `<link[^>]+rel\\s*=\\s*["'][^"']*\\b${rel}\\b[^"']*["'][^>]*?href\\s*=\\s*["']([^"']{1,2000})["']`,
    "i",
  );
  const match = html.match(pattern);
  if (match?.[1]) return decodeEntities(match[1].trim());
  return null;
}

function titleOf(html: string): string | null {
  const og = metaContent(html, "og:title", "twitter:title");
  if (og) return og;
  const match = html.match(/<title[^>]*>([^<]{1,300})<\/title>/i);
  return match?.[1] ? decodeEntities(match[1].trim()) : null;
}

/** Absolute-ise a possibly protocol-relative or relative image URL. */
function absolute(base: string, candidate: string): string | null {
  try {
    const url = new URL(candidate, base);
    if (!/^https?:$/.test(url.protocol)) return null;
    return url.toString();
  } catch {
    return null;
  }
}

function looksLikeImage(candidate: string): boolean {
  const withoutQuery = candidate.split("?")[0].toLowerCase();
  return (
    /\.(png|jpe?g|webp|avif|gif|jpeg)$/.test(withoutQuery) ||
    // Many CDNs serve images from extensionless paths.
    /image|img|photo|product|media|cdn|assets/.test(withoutQuery)
  );
}

function decodeEntities(input: string): string {
  return input
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)));
}

/** Heuristic category guess from the product title. Release 1 tries tops only. */
export function guessCategory(text: string): GarmentCategory {
  const lower = text.toLowerCase();
  if (/(shoe|sneaker|boot|sandal|heel|loafer|chappal)/.test(lower)) return "shoes";
  if (/(bag|handbag|backpack|tote|watch|jewel|necklace|ring|bracelet|sunglasses|glasses|scarf|cap|hat)/.test(lower)) {
    return "accessories";
  }
  if (/(dress|kurti|saree|gown|lehenga| jumpsuit|romper)/.test(lower)) return "dresses";
  if (/(jean|trouser|pants|shorts|skirt|legging|salwar|pyjama)/.test(lower)) return "bottoms";
  return "tops";
}

/**
 * Guards the category against what Release 1 can actually try on, so a link to a
 * pair of shoes is saved honestly as "Unsupported" instead of failing at
 * inference time.
 */
export function qualityForCategory(category: GarmentCategory): QualityState {
  return category === "tops" ? "ready" : "experimental";
}

export async function extractProductPreview(rawUrl: string): Promise<LinkImportPreview> {
  const { canonicalUrl, siteName } = normalizeProductUrl(rawUrl);
  const { html, finalUrl } = await fetchPage(canonicalUrl);

  const productName =
    metaContent(html, "og:title", "twitter:title", "name") ?? titleOf(html) ?? "Untitled product";
  const siteLabel =
    metaContent(html, "og:site_name") ?? new URL(finalUrl).hostname.replace(/^www\./, "");

  const candidates: { imageUrl: string; label: string }[] = [];
  const push = (url: string | null, label: string) => {
    if (!url) return;
    const absoluteUrl = absolute(finalUrl, url);
    if (!absoluteUrl) return;
    if (candidates.some((c) => c.imageUrl === absoluteUrl)) return;
    candidates.push({ imageUrl: absoluteUrl, label });
  };

  // Order matters: og:image is the page's declared hero product image.
  push(metaContent(html, "og:image", "og:image:secure_url", "twitter:image", "twitter:image:src"), "Page image");
  const twitterLarge = metaContent(html, "twitter:image:width");
  if (twitterLarge && Number(twitterLarge) >= 400) {
    push(metaContent(html, "twitter:image"), "Page image");
  }
  push(linkHref(html, "image_src"), "Page image");

  // Then the largest plausible <img> in the markup, as a secondary candidate so
  // the user is not stuck when og:image is missing or wrong.
  const imgMatches = html.matchAll(/<img\b[^>]*>/gi);
  let inspected = 0;
  for (const match of imgMatches) {
    if (inspected >= 60) break;
    const tag = match[0];
    if (/(logo|icon|sprite|avatar|badge|payment|flag|rating|1x1|spacer)/i.test(tag)) continue;
    const src =
      tag.match(/\ssrc\s*=\s*["']([^"']{4,2000})["']/i)?.[1] ??
      tag.match(/\ssrcset\s*=\s*["']([^"']{4,2000})["']/i)?.[1]?.split(",").pop()?.trim().split(/\s+/)[0];
    if (!src || !looksLikeImage(src)) continue;
    inspected += 1;
    push(src, "Found on page");
  }

  const hero = candidates[0];
  if (!hero) {
    throw new LinkFetchError(
      "upstream_link",
      "No product image was found on that page.",
      "Upload a screenshot of the garment instead.",
    );
  }

  const suggestedCategory = guessCategory(`${productName} ${html.slice(0, 4000)}`);

  return {
    canonicalUrl: finalUrl,
    siteName: siteLabel || siteName,
    productName: productName.slice(0, 140),
    imageUrl: hero.imageUrl,
    // Offer at most four choices; more than that is noise on a phone.
    candidates: candidates.slice(0, 4),
    suggestedCategory,
    qualityState: qualityForCategory(suggestedCategory),
  };
}

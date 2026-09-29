/**
 * Sample garment art for Release 1.
 *
 * These are original vector garments drawn by this repo, not product photography
 * from any retailer, so the starter carousel ships with no rights attached
 * (AGENTS.md: "generic or licensed items"). Each is a flat product render on a
 * transparent background, which also gives the try-on adapter a clean garment
 * silhouette to work with.
 *
 * The same silhouette path is reused server-side to synthesise a garment-shaped
 * alpha mask when a user uploads a real photo instead of a flat product shot.
 */

export interface GarmentArtSpec {
  id: string;
  name: string;
  category: "tops";
  /** Fill for the body of the garment. */
  color: string;
  /** Secondary colour for panels, collars, or trim. */
  trim: string;
  /** Silhouette variant. */
  cut: "tee" | "hoodie" | "shirt" | "jacket" | "blazer";
  /** Short description shown on the card. */
  note: string;
}

export const SAMPLE_GARMENTS: GarmentArtSpec[] = [
  {
    id: "sample-slate-tee",
    name: "Slate cotton tee",
    category: "tops",
    color: "#4a5568",
    trim: "#2d3748",
    cut: "tee",
    note: "Everyday basics",
  },
  {
    id: "sample-ember-hoodie",
    name: "Ember hoodie",
    category: "tops",
    color: "#e0533d",
    trim: "#b23c2a",
    cut: "hoodie",
    note: "Soft heavyweight",
  },
  {
    id: "sample-sage-shirt",
    name: "Sage poplin shirt",
    category: "tops",
    color: "#7fa88f",
    trim: "#5c8169",
    cut: "shirt",
    note: "Crisp and light",
  },
  {
    id: "sample-ink-jacket",
    name: "Ink bomber jacket",
    category: "tops",
    color: "#2b3a67",
    trim: "#8b5cf6",
    cut: "jacket",
    note: "Lightly structured",
  },
  {
    id: "sample-cream-blazer",
    name: "Cream linen blazer",
    category: "tops",
    color: "#e8dcc4",
    trim: "#b9a988",
    cut: "blazer",
    note: "Relaxed tailoring",
  },
];

/**
 * Silhouette path in a 100x120 viewBox, anchored at the neck (50,18). Drawn as a
 * closed shape so both the SVG render and the server-side mask share one outline.
 */
export function garmentPath(cut: GarmentArtSpec["cut"]): string {
  switch (cut) {
    case "tee":
      return [
        "M32,20 C28,20 25,22 21,25 L8,34 L15,46 L24,41 L24,100 C24,103 26,105 29,105",
        "L71,105 C74,105 76,103 76,100 L76,41 L85,46 L92,34 L79,25 C75,22 72,20 68,20",
        "C63,26 57,29 50,29 C43,29 37,26 32,20 Z",
      ].join(" ");
    case "hoodie":
      return [
        "M33,22 C29,22 26,24 22,27 L6,40 L14,54 L24,48 L24,102 C24,106 27,108 31,108",
        "L69,108 C73,108 76,106 76,102 L76,48 L86,54 L94,40 L78,27 C74,24 71,22 67,22",
        "C64,14 58,10 50,10 C42,10 36,14 33,22 Z",
      ].join(" ");
    case "shirt":
      return [
        "M33,20 C29,20 26,22 22,25 L9,33 L15,45 L24,40 L24,104 L76,104 L76,40 L85,45 L91,33",
        "L78,25 C74,22 71,20 67,20 C63,25 57,28 50,28 C43,28 37,25 33,20 Z",
      ].join(" ");
    case "jacket":
      return [
        "M32,20 C28,20 25,22 21,25 L6,34 L13,48 L23,42 L23,100 C23,104 26,106 30,106",
        "L70,106 C74,106 77,104 77,100 L77,42 L87,48 L94,34 L79,25 C75,22 72,20 68,20",
        "C64,24 58,27 50,27 C42,27 36,24 32,20 Z",
      ].join(" ");
    case "blazer":
      return [
        "M32,20 C28,20 25,22 21,25 L5,36 L12,52 L22,45 L22,104 L78,104 L78,45 L88,52 L95,36",
        "L79,25 C75,22 72,20 68,20 C63,26 57,29 50,29 C43,29 37,26 32,20 Z",
      ].join(" ");
  }
}

/** Extra seams/panels drawn on top of the base silhouette. */
function garmentDetail(spec: GarmentArtSpec): string {
  switch (spec.cut) {
    case "tee":
      return `
        <path d="M32,20 C37,26 43,29 50,29 C57,29 63,26 68,20" fill="none" stroke="${spec.trim}" stroke-width="2.4" stroke-linecap="round"/>
        <path d="M24,44 L24,100" fill="none" stroke="${spec.trim}" stroke-width="1" opacity="0.45"/>`;
    case "hoodie":
      return `
        <path d="M33,22 C36,15 42,11 50,11 C58,11 64,15 67,22 C63,27 57,30 50,30 C43,30 37,27 33,22 Z" fill="${spec.trim}"/>
        <path d="M42,30 L42,52" stroke="${spec.trim}" stroke-width="2.6" stroke-linecap="round"/>
        <path d="M58,30 L58,52" stroke="${spec.trim}" stroke-width="2.6" stroke-linecap="round"/>
        <rect x="32" y="78" width="36" height="16" rx="5" fill="none" stroke="${spec.trim}" stroke-width="1.6" opacity="0.8"/>`;
    case "shirt":
      return `
        <path d="M33,20 L50,52 L67,20" fill="none" stroke="${spec.trim}" stroke-width="1.8"/>
        <path d="M50,28 L50,104" stroke="${spec.trim}" stroke-width="1.6" opacity="0.85"/>
        <circle cx="50" cy="44" r="1.9" fill="${spec.trim}"/>
        <circle cx="50" cy="60" r="1.9" fill="${spec.trim}"/>
        <circle cx="50" cy="76" r="1.9" fill="${spec.trim}"/>
        <circle cx="50" cy="92" r="1.9" fill="${spec.trim}"/>`;
    case "jacket":
      return `
        <path d="M50,27 L50,106" stroke="${spec.trim}" stroke-width="2"/>
        <path d="M50,27 L36,34" stroke="${spec.trim}" stroke-width="2"/>
        <path d="M50,27 L64,34" stroke="${spec.trim}" stroke-width="2"/>
        <rect x="30" y="56" width="40" height="4" rx="2" fill="${spec.trim}" opacity="0.9"/>`;
    case "blazer":
      return `
        <path d="M33,20 L50,58 L67,20" fill="none" stroke="${spec.trim}" stroke-width="1.8"/>
        <path d="M50,58 L50,104" stroke="${spec.trim}" stroke-width="1.4" opacity="0.7"/>
        <path d="M30,60 L30,96" stroke="${spec.trim}" stroke-width="1.2" opacity="0.55"/>
        <circle cx="53" cy="70" r="2" fill="${spec.trim}"/>
        <circle cx="53" cy="84" r="2" fill="${spec.trim}"/>`;
  }
}

/** Full standalone SVG document for a sample garment, transparent background. */
export function garmentSvg(spec: GarmentArtSpec): string {
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 120" width="300" height="360">`,
    `<defs>`,
    `<linearGradient id="g" x1="0" y1="0" x2="0.35" y2="1">`,
    `<stop offset="0" stop-color="${shade(spec.color, 1.16)}"/>`,
    `<stop offset="0.55" stop-color="${spec.color}"/>`,
    `<stop offset="1" stop-color="${shade(spec.color, 0.78)}"/>`,
    `</linearGradient>`,
    `</defs>`,
    `<path d="${garmentPath(spec.cut)}" fill="url(#g)"/>`,
    garmentDetail(spec),
    `</svg>`,
  ].join("");
}

function garmentDataUrl(spec: GarmentArtSpec): string {
  return `data:image/svg+xml;base64,${base64(garmentSvg(spec))}`;
}

// Browser-safe base64 of a UTF-8 string, without depending on Buffer.
function base64(input: string): string {
  if (typeof btoa === "function") {
    return btoa(unescape(encodeURIComponent(input)));
  }
  return Buffer.from(input, "utf8").toString("base64");
}

let cache: Map<string, string> | null = null;

/** Memoised data URLs keyed by garment id, so re-renders never re-encode. */
export function sampleGarmentArt(): { id: string; dataUrl: string; spec: GarmentArtSpec }[] {
  cache ??= new Map();
  return SAMPLE_GARMENTS.map((spec) => {
    let dataUrl = cache!.get(spec.id);
    if (!dataUrl) {
      dataUrl = garmentDataUrl(spec);
      cache!.set(spec.id, dataUrl);
    }
    return { id: spec.id, dataUrl, spec };
  });
}

function shade(hex: string, factor: number): string {
  const clean = hex.replace("#", "");
  const num = Number.parseInt(clean.length === 3 ? clean.replace(/./g, (c) => c + c) : clean, 16);
  const r = Math.min(255, Math.round(((num >> 16) & 0xff) * factor));
  const g = Math.min(255, Math.round(((num >> 8) & 0xff) * factor));
  const b = Math.min(255, Math.round((num & 0xff) * factor));
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
}

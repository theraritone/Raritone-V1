/**
 * Raritone design tokens.
 *
 * Keep product decisions in one place so web/PWA and future native clients can
 * share the same visual contract. CSS remains the source of truth for the
 * current renderer; this module is the typed bridge for application code.
 */
export const raritoneTokens = {
  color: {
    ink: "#050508",
    chrome: "#101018",
    raise: "#1a1a26",
    paper: "#f4f4f8",
    muted: "#9a9ab0",
    violet: "#8b5cf6",
    cyan: "#22d3ee",
    accentYellow: "#f5c84b",
    danger: "#fb7185",
    success: "#34d399",
  },
  radius: {
    sm: 8,
    md: 12,
    lg: 16,
    xl: 24,
    pill: 999,
  },
  spacing: {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 24,
    xxl: 32,
  },
  typography: {
    eyebrow: 10,
    body: 15,
    label: 13,
    title: 28,
    display: 40,
  },
} as const;

export type RaritoneTokens = typeof raritoneTokens;

import { useEffect } from "react";

const ORIGIN = "https://www.raritone.com";

function upsertMeta(selector: string, attribute: "name" | "property", key: string, content: string): void {
  let tag = document.head.querySelector<HTMLMetaElement>(selector);
  if (!tag) {
    tag = document.createElement("meta");
    tag.setAttribute(attribute, key);
    document.head.appendChild(tag);
  }
  tag.setAttribute("content", content);
}

/**
 * Per-page title, description, and canonical/OG metadata. The site is a single
 * bundle, so each page declares its own metadata on mount and restores nothing
 * on unmount — the next page always sets its own.
 */
export function usePageMeta(options: { title: string; description: string; path: string }): void {
  const { title, description, path } = options;

  useEffect(() => {
    document.title = title;
    upsertMeta('meta[name="description"]', "name", "description", description);
    upsertMeta('meta[property="og:title"]', "property", "og:title", title);
    upsertMeta('meta[property="og:description"]', "property", "og:description", description);
    upsertMeta('meta[property="og:url"]', "property", "og:url", `${ORIGIN}${path}`);

    let canonical = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (!canonical) {
      canonical = document.createElement("link");
      canonical.rel = "canonical";
      document.head.appendChild(canonical);
    }
    canonical.href = `${ORIGIN}${path}`;
  }, [title, description, path]);
}

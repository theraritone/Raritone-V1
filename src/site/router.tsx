import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type AnchorHTMLAttributes,
  type MouseEvent,
  type ReactNode,
} from "react";

/**
 * A minimal path router for the public website.
 *
 * The marketing surface is a handful of static destinations; a routing library
 * would add weight without adding anything this doesn't already do: real hrefs
 * for crawlers and middle-click, history integration, and scroll restoration on
 * navigation. The PWA keeps its own screen state under /app.
 */

const PathContext = createContext<string>(typeof window === "undefined" ? "/" : window.location.pathname);

export function navigate(to: string, options?: { replace?: boolean }): void {
  if (options?.replace) window.history.replaceState({}, "", to);
  else window.history.pushState({}, "", to);
  window.dispatchEvent(new PopStateEvent("popstate"));
}

export function SiteRouterProvider({ children }: { children: ReactNode }): ReactNode {
  const [path, setPath] = useState(() => window.location.pathname);

  useEffect(() => {
    const onPop = () => setPath(window.location.pathname);
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  return <PathContext.Provider value={path}>{children}</PathContext.Provider>;
}

export function usePath(): string {
  return useContext(PathContext);
}

function isExternal(href: string): boolean {
  return /^(https?:|mailto:|tel:)/.test(href);
}

export type LinkProps = AnchorHTMLAttributes<HTMLAnchorElement> & { to: string };

export function Link({ to, onClick, children, ...rest }: LinkProps): ReactNode {
  const handle = useCallback(
    (event: MouseEvent<HTMLAnchorElement>) => {
      onClick?.(event);
      if (event.defaultPrevented) return;
      if (isExternal(to)) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      if (event.button !== 0) return;
      event.preventDefault();
      navigate(to);
    },
    [onClick, to],
  );

  return (
    <a href={to} onClick={handle} {...rest}>
      {children}
    </a>
  );
}

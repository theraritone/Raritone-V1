import { useState, type ReactNode } from "react";
import { StoreProvider, useStore } from "./state/store";
import { ErrorPanel, BootScreen } from "./components/feedback";
import { CameraScreen, type CapturedResult } from "./screens/CameraScreen";
import { PreviewScreen } from "./screens/PreviewScreen";
import { WardrobeScreen } from "./screens/WardrobeScreen";
import { ProfileScreen } from "./screens/ProfileScreen";
import { DiscoverScreen } from "./screens/DiscoverScreen";
import { SubscriptionScreen } from "./screens/SubscriptionScreen";
import { StyleStreakScreen } from "./screens/StyleStreakScreen";

type Route = "home" | "discover" | "try-on" | "wardrobe" | "profile" | "subscription" | "streak" | "preview";
type NavRoute = Exclude<Route, "preview" | "subscription" | "streak">;
const navItems: Array<{ route: NavRoute; label: string; glyph: string }> = [
  { route: "home", label: "Home", glyph: "⌂" },
  { route: "discover", label: "Discover", glyph: "✦" },
  { route: "try-on", label: "Try-On", glyph: "◎" },
  { route: "wardrobe", label: "Wardrobe", glyph: "▦" },
  { route: "profile", label: "Profile", glyph: "◯" },
];

function BottomNavigation({ route, onNavigate }: { route: NavRoute; onNavigate: (next: NavRoute) => void }): ReactNode {
  return <nav className="rt-glass absolute inset-x-0 bottom-0 z-30 flex items-end justify-around border-t border-white/10 px-2 pb-[max(env(safe-area-inset-bottom),0.5rem)] pt-2" aria-label="Primary navigation">
    {navItems.map((item) => { const active = route === item.route; const isTryOn = item.route === "try-on"; return <button key={item.route} type="button" aria-current={active ? "page" : undefined} onClick={() => onNavigate(item.route)} className={`flex min-w-14 flex-col items-center gap-1 rounded-xl px-2 py-1 text-[10px] transition-colors ${active ? "text-cyan-200" : "text-white/50"}`}><span className={`grid place-items-center ${isTryOn ? "-mt-6 size-12 rounded-full border-4 border-ink-950 bg-violet-electric text-xl text-white shadow-lg shadow-violet-500/30" : "size-6 text-lg"}`} aria-hidden="true">{item.glyph}</span><span className={isTryOn ? "font-semibold text-white" : ""}>{item.label}</span></button>; })}
  </nav>;
}

function Shell(): ReactNode {
  const { ready, bootError, reload } = useStore();
  const [route, setRoute] = useState<Route>("home");
  const [capture, setCapture] = useState<CapturedResult | null>(null);
  if (!ready) return <BootScreen label="Loading your wardrobe…" />;
  if (bootError) return <div className="grid min-h-dvh place-items-center bg-ink-950 px-6"><div className="w-full max-w-sm"><ErrorPanel error={bootError} onRetry={() => void reload()} /></div></div>;
  const navigate = (next: NavRoute) => setRoute(next);
  if (route === "preview" && capture) return <PreviewScreen capture={capture} onRetake={() => { setCapture(null); setRoute("try-on"); }} onDone={() => { setCapture(null); setRoute("home"); }} />;
  if (route === "subscription") return <SubscriptionScreen onBack={() => setRoute("profile")} />;
  if (route === "streak") return <StyleStreakScreen onBack={() => setRoute("profile")} />;
  const bottomRoute: NavRoute = route === "try-on" ? "try-on" : route as NavRoute;
  if (route === "wardrobe") return <div className="relative h-dvh"><WardrobeScreen onBack={() => setRoute("home")} onUseGarment={() => setRoute("try-on")} /><BottomNavigation route={bottomRoute} onNavigate={navigate} /></div>;
  if (route === "profile") return <div className="relative h-dvh"><ProfileScreen onBack={() => setRoute("home")} onOpenWardrobe={() => setRoute("wardrobe")} /><div className="absolute right-4 top-[max(0.75rem,env(safe-area-inset-top))] z-20 flex gap-2"><button type="button" onClick={() => setRoute("streak")} className="rounded-full border border-amber-200/30 bg-amber-300/10 px-3 py-2 text-xs font-semibold text-amber-100">Streak</button><button type="button" onClick={() => setRoute("subscription")} className="rounded-full border border-cyan-200/30 bg-cyan-300/10 px-3 py-2 text-xs font-semibold text-cyan-100">Membership</button></div><BottomNavigation route={bottomRoute} onNavigate={navigate} /></div>;
  if (route === "discover") return <div className="relative h-dvh"><DiscoverScreen onTryOn={() => setRoute("try-on")} /><BottomNavigation route={bottomRoute} onNavigate={navigate} /></div>;
  return <div className="relative h-dvh"><CameraScreen onOpenWardrobe={() => setRoute("wardrobe")} onOpenProfile={() => setRoute("profile")} onCaptured={(result) => { setCapture(result); setRoute("preview"); }} /><BottomNavigation route={bottomRoute} onNavigate={navigate} /></div>;
}

export default function App(): ReactNode { return <StoreProvider><Shell /></StoreProvider>; }

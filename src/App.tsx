import { useState, type ReactNode } from "react";
import { StoreProvider, useStore } from "./state/store";
import { ErrorPanel, BootScreen } from "./components/feedback";
import { CameraScreen, type CapturedResult } from "./screens/CameraScreen";
import { PreviewScreen } from "./screens/PreviewScreen";
import { WardrobeScreen } from "./screens/WardrobeScreen";
import { ProfileScreen } from "./screens/ProfileScreen";
import { SplashScreen } from "./screens/SplashScreen";
import { OnboardingScreen } from "./screens/OnboardingScreen";
import { CameraPermissionScreen } from "./screens/CameraPermissionScreen";

/**
 * The app shell.
 *
 * Three surfaces, no router: the camera is the home, and the wardrobe and
 * profile slide over it. That matches the PRD's navigation rule — the camera is
 * the front door, and nothing should feel like a separate destination — and it
 * avoids pulling in a routing library for three views.
 *
 * The service worker is registered in production only: a cached shell during
 * development serves stale modules and makes every change look like it did
 * nothing.
 */

type Route = "camera" | "wardrobe" | "profile" | "preview";

const SHELL_COMPLETE_KEY = "raritone.shell.complete";
const SHELL_SPLASH_KEY = "raritone.shell.splash-seen";

function Shell(): ReactNode {
  const { ready, bootError, reload } = useStore();
  const [route, setRoute] = useState<Route>("camera");
  const [capture, setCapture] = useState<CapturedResult | null>(null);
  const [launchStep, setLaunchStep] = useState<"returning" | "splash" | "onboarding" | "permission">(() => {
    try {
      if (window.localStorage.getItem(SHELL_COMPLETE_KEY) === "1") return "returning";
      return window.localStorage.getItem(SHELL_SPLASH_KEY) === "1" ? "onboarding" : "splash";
    } catch {
      return "splash";
    }
  });

  if (!ready) return <BootScreen label="Loading your wardrobe…" />;

  if (bootError) {
    return (
      <div className="grid min-h-dvh place-items-center bg-ink-950 px-6">
        <div className="w-full max-w-sm">
          <ErrorPanel error={bootError} onRetry={() => void reload()} />
        </div>
      </div>
    );
  }

  if (launchStep === "splash") {
    return <SplashScreen onContinue={() => { window.localStorage.setItem(SHELL_SPLASH_KEY, "1"); setLaunchStep("onboarding"); }} />;
  }
  if (launchStep === "onboarding") return <OnboardingScreen onComplete={() => setLaunchStep("permission")} />;
  if (launchStep === "permission") {
    return <CameraPermissionScreen onComplete={() => { window.localStorage.setItem(SHELL_COMPLETE_KEY, "1"); setLaunchStep("returning"); }} />;
  }

  if (route === "preview" && capture) {
    return (
      <PreviewScreen
        capture={capture}
        onRetake={() => {
          // The blob URL is released by the preview screen on unmount.
          setCapture(null);
          setRoute("camera");
        }}
        onDone={() => {
          setCapture(null);
          setRoute("camera");
        }}
      />
    );
  }

  if (route === "wardrobe") {
    return (
      <WardrobeScreen
        onBack={() => setRoute("camera")}
        onUseGarment={() => setRoute("camera")}
      />
    );
  }

  if (route === "profile") {
    return <ProfileScreen onBack={() => setRoute("camera")} onOpenWardrobe={() => setRoute("wardrobe")} />;
  }

  return (
    <CameraScreen
      onOpenWardrobe={() => setRoute("wardrobe")}
      onOpenProfile={() => setRoute("profile")}
      onCaptured={(result) => {
        setCapture(result);
        setRoute("preview");
      }}
    />
  );
}

export default function App(): ReactNode {
  return (
    <StoreProvider>
      <Shell />
    </StoreProvider>
  );
}

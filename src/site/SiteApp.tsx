import { useEffect, type ReactNode } from "react";
import { SiteRouterProvider, usePath } from "./router";
import { SiteHeader } from "./components/SiteHeader";
import { SiteFooter } from "./components/SiteFooter";
import { HomePage } from "./pages/HomePage";
import { HowItWorksPage } from "./pages/HowItWorksPage";
import { LiveTryOnPage } from "./pages/LiveTryOnPage";
import { StyleStreakPage } from "./pages/StyleStreakPage";
import { MembershipPage } from "./pages/MembershipPage";
import { RewardsPage } from "./pages/RewardsPage";
import { BrandsPage } from "./pages/BrandsPage";
import { AboutPage } from "./pages/AboutPage";
import { FaqPage } from "./pages/FaqPage";
import { ContactPage } from "./pages/ContactPage";
import { AuthPage } from "./pages/AuthPage";
import { ForgotPasswordPage } from "./pages/ForgotPasswordPage";
import { DashboardPage } from "./pages/DashboardPage";
import { AdminPage } from "./pages/AdminPage";
import { PrivacyPolicyPage } from "./pages/PrivacyPolicyPage";
import { TermsPage } from "./pages/TermsPage";
import { SubscriptionRefundPage } from "./pages/SubscriptionRefundPage";
import { NotFoundPage } from "./pages/NotFoundPage";

/** Dashboard and admin surfaces get no marketing footer chrome. */
const BARE_ROUTES = ["/dashboard", "/admin", "/sign-in", "/sign-up", "/forgot-password"];

function matchPath(path: string): { page: ReactNode; bare: boolean } {
  const clean = path.replace(/\/+$/, "") || "/";
  const bare = BARE_ROUTES.some((route) => clean === route || clean.startsWith(`${route}/`));

  let page: ReactNode;
  switch (clean) {
    case "/":
      page = <HomePage />;
      break;
    case "/how-it-works":
      page = <HowItWorksPage />;
      break;
    case "/live-try-on":
      page = <LiveTryOnPage />;
      break;
    case "/style-streak":
      page = <StyleStreakPage />;
      break;
    case "/membership":
      page = <MembershipPage />;
      break;
    case "/rewards":
      page = <RewardsPage />;
      break;
    case "/brands":
      page = <BrandsPage />;
      break;
    case "/about":
      page = <AboutPage />;
      break;
    case "/faq":
      page = <FaqPage />;
      break;
    case "/contact":
      page = <ContactPage />;
      break;
    case "/sign-in":
      page = <AuthPage mode="sign-in" />;
      break;
    case "/sign-up":
      page = <AuthPage mode="sign-up" />;
      break;
    case "/forgot-password":
      page = <ForgotPasswordPage />;
      break;
    case "/dashboard":
      page = <DashboardPage />;
      break;
    case "/admin":
      page = <AdminPage />;
      break;
    case "/privacy-policy":
      page = <PrivacyPolicyPage />;
      break;
    case "/terms-and-conditions":
      page = <TermsPage />;
      break;
    case "/subscription-and-refund-policy":
      page = <SubscriptionRefundPage />;
      break;
    default:
      page = <NotFoundPage path={clean} />;
  }
  return { page, bare };
}

function SiteSurface(): ReactNode {
  const path = usePath();
  const { page, bare } = matchPath(path);

  useEffect(() => {
    if (window.location.hash) {
      const target = document.getElementById(window.location.hash.slice(1));
      if (target) {
        target.scrollIntoView({ block: "start" });
        return;
      }
    }
    window.scrollTo(0, 0);
  }, [path]);

  if (bare) {
    return <main className="min-h-[100dvh]">{page}</main>;
  }

  return (
    <>
      <SiteHeader />
      <main className="min-h-[100dvh]">{page}</main>
      <SiteFooter />
    </>
  );
}

export function SiteApp(): ReactNode {
  return (
    <SiteRouterProvider>
      <SiteSurface />
    </SiteRouterProvider>
  );
}

import { CartProvider } from "@/lib/cart";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { MobileTabBar } from "@/components/mobile-tab-bar";
import { ContactButton } from "@/components/contact-button";
import { Gtm } from "@/components/gtm";
import { Suspense } from "react";
import { AnalyticsRouteTracker } from "@/components/analytics-route-tracker";

export default function SiteLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <CartProvider>
      <SiteHeader />
      <div className="flex-1">{children}</div>
      <SiteFooter />
      <ContactButton />
      <MobileTabBar />
      <Gtm />
      {/*
        Client-side navigations are invisible to GTM without this.

        Wrapped in Suspense because it reads useSearchParams: without a
        boundary that opts the whole route out of prerendering, and /checkout
        failed to build outright. The fallback is null — this component renders
        nothing, so there is nothing to fall back to.
      */}
      <Suspense fallback={null}>
        <AnalyticsRouteTracker />
      </Suspense>
    </CartProvider>
  );
}

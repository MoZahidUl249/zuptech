import { CartProvider } from "@/lib/cart";

/**
 * Minimal chrome for unlisted campaign landing pages — deliberately outside
 * app/(site) so it does NOT inherit SiteHeader/SiteFooter/MobileTabBar/
 * WhatsAppButton/the site-wide <Gtm/>: a single-purpose ad landing page
 * shouldn't offer a way to wander off to the rest of the site, and each
 * page loads its own GTM container (see LandingPageGtm) instead of the
 * shared one. Still wrapped in <CartProvider> so "Add to cart"/"Buy now"
 * share the same localStorage-backed cart as the rest of the site.
 *
 * No header here either. This layout used to render a small "ZUP TECH ·
 * Official store · Dhaka" bar, which sat directly above the campaign page's
 * own header once that page grew one — two brand bars stacked on the first
 * thing an ad click sees. The page owns its header, because only the page
 * knows the campaign's hotline and call to action.
 */
export default function LandingPageLayout({ children }: { children: React.ReactNode }) {
  return (
    <CartProvider>
      <div className="flex min-h-dvh flex-col bg-zup-bg">
        <div className="flex-1">{children}</div>
      </div>
    </CartProvider>
  );
}

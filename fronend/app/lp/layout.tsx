import Image from "next/image";
import Link from "next/link";
import { CartProvider } from "@/lib/cart";

/**
 * Minimal chrome for unlisted campaign landing pages — deliberately outside
 * app/(site) so it does NOT inherit SiteHeader/SiteFooter/MobileTabBar/
 * WhatsAppButton/the site-wide <Gtm/>: a single-purpose ad landing page
 * shouldn't offer a way to wander off to the rest of the site, and each
 * page loads its own GTM container (see LandingPageGtm) instead of the
 * shared one. Still wrapped in <CartProvider> so "Add to cart"/"Buy now"
 * share the same localStorage-backed cart as the rest of the site.
 */
export default function LandingPageLayout({ children }: { children: React.ReactNode }) {
  return (
    <CartProvider>
      <div className="flex min-h-dvh flex-col bg-zup-bg">
        <header className="border-b border-zup-body/6 bg-white px-5 py-3.5">
          <div className="mx-auto flex max-w-[720px] items-center justify-between">
            <Link href="/" className="flex items-center gap-2" aria-label="ZUP TECH">
              <Image
                src="/images/zup-mark.png"
                alt=""
                width={26}
                height={26}
                className="h-[26px] w-[26px] object-contain"
              />
              <span className="text-[16px] font-extrabold tracking-[0.03em] text-zup-body">
                ZUP TECH
              </span>
            </Link>
            <span className="text-[12px] font-semibold text-zup-soft">
              Official store · Dhaka
            </span>
          </div>
        </header>
        <div className="flex-1">{children}</div>
      </div>
    </CartProvider>
  );
}

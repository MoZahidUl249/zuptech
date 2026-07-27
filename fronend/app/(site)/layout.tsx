import { CartProvider } from "@/lib/cart";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { MobileTabBar } from "@/components/mobile-tab-bar";
import { WhatsAppButton } from "@/components/whatsapp-button";
import { Gtm } from "@/components/gtm";

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
      <WhatsAppButton />
      <MobileTabBar />
      <Gtm />
    </CartProvider>
  );
}

"use client";

import Script from "next/script";
import { GTM_ID_RE } from "@/lib/admin";

/**
 * Per-landing-page GTM container — deliberately separate from the shared
 * <Gtm /> in components/gtm.tsx (which loads the site-wide container from
 * Site content → Google Tag Manager). Each campaign landing page tracks its
 * own ad spend in its own container, so this renders instead of, not in
 * addition to, the site-wide one (the /lp route tree never renders <Gtm />).
 */
export function LandingPageGtm({ gtmId }: { gtmId: string }) {
  if (!gtmId || !GTM_ID_RE.test(gtmId)) return null;

  return (
    <Script
      id="lp-gtm-loader"
      strategy="afterInteractive"
      dangerouslySetInnerHTML={{
        __html: `(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','${gtmId}');`,
      }}
    />
  );
}

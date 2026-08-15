import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { site , jsonLd } from "@/lib/site";
import { Toaster } from "@/components/ui/sonner";

const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(site.url),
  title: {
    default: "ZUP TECH — Power Solutions & Services in Bangladesh",
    template: "%s | ZUP TECH",
  },
  description: site.description,
  keywords: [
    "power solutions Bangladesh",
    "IPS price in Bangladesh",
    "solar system Bangladesh",
    "substation installation Dhaka",
    "voltage stabilizer",
    "switchgear panel",
    "solar EPC Bangladesh",
    "ZUP TECH",
  ],
  applicationName: site.name,
  authors: [{ name: site.name, url: site.url }],
  creator: site.name,
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: site.url,
    siteName: site.name,
    title: "ZUP TECH — Power Solutions & Services in Bangladesh",
    description: site.description,
    images: [
      {
        url: "/images/banner-power-solutions.png",
        width: 1717,
        height: 916,
        alt: "ZUP TECH power solutions — engineered hardware and turnkey energy services",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "ZUP TECH — Power Solutions & Services in Bangladesh",
    description: site.description,
    images: ["/images/banner-power-solutions.png"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  icons: { icon: "/images/zup-mark.png", apple: "/images/zup-mark.png" },
};

export const viewport: Viewport = {
  themeColor: "#fafafb",
  width: "device-width",
  initialScale: 1,
};

const organizationJsonLd = {
  "@context": "https://schema.org",
  "@type": "Organization",
  "@id": `${site.url}/#organization`,
  name: site.name,
  url: site.url,
  logo: `${site.url}/images/zup-mark.png`,
  description: site.description,
  slogan: site.tagline,
  email: site.email,
  telephone: site.phone,
  address: {
    "@type": "PostalAddress",
    streetAddress: site.address.street,
    addressLocality: site.address.city,
    postalCode: site.address.postalCode,
    addressCountry: site.address.country,
  },
  contactPoint: {
    "@type": "ContactPoint",
    telephone: site.phone,
    contactType: "customer service",
    areaServed: "BD",
    availableLanguage: ["en", "bn"],
  },
  sameAs: [site.social.facebook, site.social.youtube, site.social.linkedin],
};

const webSiteJsonLd = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  "@id": `${site.url}/#website`,
  name: site.name,
  url: site.url,
  publisher: { "@id": `${site.url}/#organization` },
  potentialAction: {
    "@type": "SearchAction",
    target: {
      "@type": "EntryPoint",
      urlTemplate: `${site.url}/products?q={search_term_string}`,
    },
    "query-input": "required name=search_term_string",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    // suppressHydrationWarning is scoped to <html>'s own attributes (it does
    // not cascade to children): browser extensions such as Google Analytics
    // Opt-out and dark-mode toggles stamp attributes on <html> before React
    // hydrates, which otherwise reports a mismatch no site change can fix.
    <html
      lang="en"
      className={`${inter.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col bg-zup-bg text-zup-body">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: jsonLd(organizationJsonLd) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: jsonLd(webSiteJsonLd) }}
        />
        {children}
        <Toaster position="bottom-center" />
      </body>
    </html>
  );
}

import "./globals.css";
import type { Metadata, Viewport } from "next";
import Script from "next/script";
import {
  Bricolage_Grotesque,
  Instrument_Serif,
  Inter,
  JetBrains_Mono,
} from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { SITE_NAME } from "@/lib/seo/schema";

/* GTM container ID — the SAME container the marketing site loads (GA4 audit,
   10 Aug 2026). Deliberately one container and one data stream, not two:
   app.makemycv.ae and www.makemycv.ae share the root domain makemycv.ae, so
   gtag sets the _ga cookie on .makemycv.ae and sessions stitch across the
   www → app hop automatically. A second property or stream would break that
   into two sessions and turn the handoff into a self-referral. Cross-domain
   linking is for different ROOT domains and is not needed here.

   This is the GTM CONTAINER id (GTM-…), not the GA4 measurement id
   (G-8MWPD87FJH) — that lives inside the container, never in this codebase.

   Set ONLY in Vercel's Production environment, so localhost and preview
   deployments load no Google tag and cannot pollute the production property.
   Format-guarded because the value is interpolated into an inline <script>. */
const RAW_GTM_ID = process.env.NEXT_PUBLIC_GTM_ID;
const GTM_ID =
  RAW_GTM_ID && /^GTM-[A-Z0-9]+$/.test(RAW_GTM_ID) ? RAW_GTM_ID : null;

/* Focus Flow font pipeline (audit PERF-2). Exactly the four families the
   UI renders, all self-hosted through next/font (no render-blocking
   Google @import chain). The previous setup loaded EIGHT families —
   Sora/Fraunces/Poppins/Plus Jakarta were preloaded but never painted,
   and Inter was loaded twice. The Logo renders SVG files, so no
   wordmark font is needed. */
const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const bricolage = Bricolage_Grotesque({
  subsets: ["latin"],
  variable: "--font-bricolage",
  display: "swap",
  weight: ["500", "600", "700"],
});

const instrumentSerif = Instrument_Serif({
  subsets: ["latin"],
  variable: "--font-instrument",
  display: "swap",
  weight: "400",
  style: ["normal", "italic"],
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains",
  display: "swap",
  weight: ["500", "600"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://app.makemycv.ae"),
  title: {
    // Entity name, not the logotype: title case with the .ae, matching the
    // marketing site, LinkedIn and the manifest verbatim. See SITE_NAME.
    default: `${SITE_NAME} - Free CV Builder for UAE Jobs`,
    template: `%s | ${SITE_NAME}`,
  },
  description:
    "Build a professional, ATS-friendly CV in minutes. " +
    "Designed for the UAE job market. Free templates, " +
    "instant PDF export, no sign-up required.",
  keywords: [
    "CV builder UAE",
    "resume builder Dubai",
    "free CV maker",
    "ATS CV template",
    "professional resume UAE",
    "job application UAE",
    "CV template Dubai",
    "makemycv",
  ],
  authors: [{ name: SITE_NAME, url: "https://www.makemycv.ae" }],
  creator: SITE_NAME,
  publisher: SITE_NAME,
  openGraph: {
    type: "website",
    locale: "en_AE",
    url: "https://app.makemycv.ae",
    siteName: SITE_NAME,
    title: `${SITE_NAME} - Free CV Builder for UAE Jobs`,
    description:
      "Build a professional, ATS-friendly CV in minutes. " +
      "Designed for the UAE job market. Free, instant PDF export.",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: `${SITE_NAME} - CV Builder for UAE Job Seekers`,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: `${SITE_NAME} - Free CV Builder for UAE Jobs`,
    description:
      "ATS-friendly CVs built for the UAE job market. " +
      "Free, fast, no sign-up needed.",
    images: ["/og-image.png"],
    creator: "@makemycv",
  },
  robots: {
    index: false,
    follow: false,
    googleBot: {
      index: false,
      follow: false,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: "/favicon-96x96.png", sizes: "96x96", type: "image/png" },
    ],
    shortcut: "/favicon.ico",
    apple: [
      { url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
  },
  manifest: "/site.webmanifest",
  appleWebApp: {
    // iOS home-screen label. Must agree with the manifest short_name, or the
    // same install shows two different brand strings across platforms.
    title: SITE_NAME,
    capable: true,
    statusBarStyle: "default",
  },
  category: "productivity",
};

// Next.js 14+ recommends a separate viewport export for themeColor.
export const viewport: Viewport = {
  themeColor: "#1B2A4A",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${bricolage.variable} ${instrumentSerif.variable} ${jetbrainsMono.variable}`}
    >
      <body className="antialiased">
        {/* No Organization node here, deliberately. www.makemycv.ae owns the
            entity: it emits Organization, WebSite and the WebApplication that
            describes THIS host, all cross-linked by @id. This subdomain used
            to emit a second, thinner Organization on the same @id, which is
            the entity split that work exists to prevent. Pages here reference
            those nodes by @id instead — see lib/seo/schema.ts. */}
        {children}
        {/* Analytics (2026-08-02, audit A-W8-003 / A-W4-017 / A-W5-036).
            app.makemycv.ae previously ran NO analytics of any kind, so not one
            CV export could be attributed to the traffic that produced it and
            the entire SEO/link-building spend was unmeasurable.

            These two give RUM and Web Vitals for THIS host only — Vercel
            Analytics is per-project and does NOT follow a session across the
            www -> app domain hop. Cross-domain attribution needs the GA4
            cross-domain config, which lands separately; do not assume this
            covers it. The app's CSP already allowed vitals.vercel-insights.com
            from an install that never happened, so no header change was needed.

            Neither library sends CV content: they report route, referrer and
            timing only. */}
        <Analytics />
        <SpeedInsights />
        {/* Google Tag Manager (2026-08-10, GA4 audit). This host appeared in ZERO
            hostname rows across 28 days of GA4 data — the actual product was
            entirely unmeasured while the marketing site was fully tagged.

            This is the piece the 2026-08-02 note above called "the GA4
            cross-domain config, which lands separately". It is now here, and it
            is NOT cross-domain config: same container, same stream, shared root
            domain. See the GTM_ID comment at the top of this file.

            No <noscript> iframe counterpart, unlike the marketing site: this app
            is a client-rendered CV builder that does nothing without JavaScript,
            so a noscript pixel would measure users who cannot use the product —
            and it would need a CSP frame-src exemption to load at all. */}
        {GTM_ID && (
          <Script id="google-tag-manager" strategy="lazyOnload">
            {`(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
})(window,document,'script','dataLayer','${GTM_ID}');`}
          </Script>
        )}
      </body>
    </html>
  );
}

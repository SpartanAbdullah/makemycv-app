import "./globals.css";
import type { Metadata, Viewport } from "next";
import {
  Bricolage_Grotesque,
  Instrument_Serif,
  Inter,
  JetBrains_Mono,
} from "next/font/google";
import { JsonLd } from "@/components/seo/JsonLd";
import { organizationSchema } from "@/lib/seo/schema";

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
    default: "MakeMyCV - Free CV Builder for UAE Jobs",
    template: "%s | MakeMyCV",
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
  authors: [{ name: "MakeMyCV", url: "https://makemycv.ae" }],
  creator: "MakeMyCV",
  publisher: "MakeMyCV",
  openGraph: {
    type: "website",
    locale: "en_AE",
    url: "https://app.makemycv.ae",
    siteName: "MakeMyCV",
    title: "MakeMyCV - Free CV Builder for UAE Jobs",
    description:
      "Build a professional, ATS-friendly CV in minutes. " +
      "Designed for the UAE job market. Free, instant PDF export.",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "MakeMyCV - CV Builder for UAE Job Seekers",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "MakeMyCV - Free CV Builder for UAE Jobs",
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
    title: "makemycv",
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
        {/* Site-wide Organization identity. Pages that need surface-specific
            schema (WebApplication, FAQPage, BreadcrumbList) emit it locally
            and link back to this @id via the publisher field. */}
        <JsonLd data={organizationSchema()} />
        {children}
      </body>
    </html>
  );
}

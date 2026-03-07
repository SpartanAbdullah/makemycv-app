import "./globals.css";
import type { Metadata } from "next";
import localFont from "next/font/local";

const sora = localFont({
  src: [
    { path: "../public/fonts/Sora-400.woff2", weight: "400", style: "normal" },
    { path: "../public/fonts/Sora-600.woff2", weight: "600", style: "normal" },
  ],
  variable: "--font-sora",
  display: "swap",
});

const fraunces = localFont({
  src: [
    { path: "../public/fonts/Fraunces-600.woff2", weight: "600", style: "normal" },
    { path: "../public/fonts/Fraunces-700.woff2", weight: "700", style: "normal" },
  ],
  variable: "--font-fraunces",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://app.makemycv.ae"),

  title: {
    default: "MakeMyCV — Free CV Builder for UAE Jobs",
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

  alternates: {
    canonical: "https://app.makemycv.ae",
    languages: {
      "en-AE": "https://app.makemycv.ae",
      en: "https://app.makemycv.ae",
    },
  },

  openGraph: {
    type: "website",
    locale: "en_AE",
    url: "https://app.makemycv.ae",
    siteName: "MakeMyCV",
    title: "MakeMyCV — Free CV Builder for UAE Jobs",
    description:
      "Build a professional, ATS-friendly CV in minutes. " +
      "Designed for the UAE job market. Free, instant PDF export.",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "MakeMyCV — CV Builder for UAE Job Seekers",
      },
    ],
  },

  twitter: {
    card: "summary_large_image",
    title: "MakeMyCV — Free CV Builder for UAE Jobs",
    description:
      "ATS-friendly CVs built for the UAE job market. " +
      "Free, fast, no sign-up needed.",
    images: ["/og-image.png"],
    creator: "@makemycv",
  },

  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },

  icons: {
    icon: "/favicon.ico",
    shortcut: "/favicon-16x16.png",
    apple: "/apple-touch-icon.png",
  },

  manifest: "/site.webmanifest",

  category: "productivity",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${sora.variable} ${fraunces.variable}`}>
      <body className={`${sora.variable} ${fraunces.variable} antialiased`}>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "SoftwareApplication",
              name: "MakeMyCV",
              applicationCategory: "BusinessApplication",
              operatingSystem: "Web",
              description:
                "Free online CV builder designed for UAE job seekers. " +
                "ATS-optimized templates with instant PDF export.",
              url: "https://app.makemycv.ae",
              offers: {
                "@type": "Offer",
                price: "0",
                priceCurrency: "AED",
              },
              featureList: [
                "ATS-friendly CV templates",
                "Instant PDF export",
                "UAE job market focused",
                "No sign-up required",
                "Live CV preview",
              ],
              inLanguage: "en-AE",
              publisher: {
                "@type": "Organization",
                name: "MakeMyCV",
                url: "https://makemycv.ae",
              },
            }),
          }}
        />
        {children}
      </body>
    </html>
  );
}

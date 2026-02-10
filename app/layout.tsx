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
  title: "MakeMyCV",
  description: "Build a professional CV with a guided, modern workflow.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${sora.variable} ${fraunces.variable}`}>
      <body className={`${sora.variable} ${fraunces.variable} antialiased`}>
        {children}
      </body>
    </html>
  );
}

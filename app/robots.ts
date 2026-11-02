import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        // /preview is NOT disallowed: its pages carry noindex, and Google
        // can only see a noindex on a URL it is allowed to crawl.
        disallow: ["/api/", "/_next/"],
      },
    ],
    sitemap: "https://app.makemycv.ae/sitemap.xml",
  };
}

import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/api/", "/_next/", "/preview", "/preview/"],
      },
    ],
    sitemap: "https://app.makemycv.ae/sitemap.xml",
  };
}

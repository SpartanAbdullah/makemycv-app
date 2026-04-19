import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  // The app subdomain is intentionally a noindex product surface.
  // Indexable acquisition pages live on www.makemycv.ae instead.
  return [];
}

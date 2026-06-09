/**
 * Schema.org JSON-LD builders for MakeMyCV.
 *
 * Why this lives here:
 * - Keep schema authoring DRY and type-safe so future pages can add blocks
 *   without re-implementing org/identity facts.
 * - The Organization @id is the single shared anchor that links the app
 *   subdomain to the marketing site as one entity in search graphs.
 *
 * Rule (per the SEO checklist's integrity rule): every claim in schema
 * must mirror visible on-page content. No fabricated stats, no ratings.
 */

const SITE_URL = "https://www.makemycv.ae";
const APP_URL = "https://app.makemycv.ae";
const ORG_ID = `${SITE_URL}/#organization`;
const APP_WEBSITE_ID = `${APP_URL}/#website`;

export type JsonLdGraph = Record<string, unknown> | Record<string, unknown>[];

export const organizationSchema = () =>
  ({
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": ORG_ID,
    name: "MakeMyCV",
    url: SITE_URL,
    logo: `${SITE_URL}/og-image.png`,
    description:
      "Free, ATS-clean CV builder designed for the UAE and GCC job market.",
    areaServed: { "@type": "Country", name: "United Arab Emirates" },
    founder: { "@type": "Person", name: "Abdullah" },
    contactPoint: {
      "@type": "ContactPoint",
      email: "hello@makemycv.ae",
      contactType: "customer support",
      areaServed: "AE",
      availableLanguage: ["English", "Arabic"],
    },
  }) as const;

export const appWebSiteSchema = () =>
  ({
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": APP_WEBSITE_ID,
    url: APP_URL,
    name: "MakeMyCV",
    publisher: { "@id": ORG_ID },
    inLanguage: "en-AE",
  }) as const;

/**
 * The builder/app surface as a WebApplication. Used on the app's only
 * public, indexable entry surface (/resume-checker). The featureList
 * mirrors what's actually built and visible on the page — no aspirational
 * features.
 */
export const webApplicationSchema = () =>
  ({
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: "MakeMyCV",
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web",
    url: APP_URL,
    description:
      "Free ATS-optimized CV builder with UAE-specific fields (visa status, " +
      "Emirates ID, nationality, driving licence). No sign-up, no paywall, " +
      "data stays in the browser.",
    offers: { "@type": "Offer", price: "0", priceCurrency: "AED" },
    featureList: [
      "ATS-parseable structure",
      "UAE-specific fields",
      "Instant PDF and DOCX export",
      "Live preview",
      "AI bullet-point rewriter",
      "Browser-only data (no accounts)",
    ],
    inLanguage: "en-AE",
    publisher: { "@id": ORG_ID },
    isPartOf: { "@id": APP_WEBSITE_ID },
  }) as const;

export type FaqEntry = { q: string; a: string };

export const faqPageSchema = (faqs: readonly FaqEntry[]) =>
  ({
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: {
        "@type": "Answer",
        text: f.a,
      },
    })),
  }) as const;

export type BreadcrumbItem = { name: string; item?: string };

export const breadcrumbListSchema = (items: readonly BreadcrumbItem[]) =>
  ({
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((it, i) => {
      const base = {
        "@type": "ListItem" as const,
        position: i + 1,
        name: it.name,
      };
      return it.item ? { ...base, item: it.item } : base;
    }),
  }) as const;

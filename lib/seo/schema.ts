/**
 * Schema.org JSON-LD builders for MakeMyCV.ae.
 *
 * Why this lives here:
 * - Keep schema authoring DRY and type-safe so future pages can add blocks
 *   without re-implementing identity facts.
 * - The apex domain owns the entity. This subdomain only ever *references*
 *   the marketing site's nodes by @id — it never restates them.
 *
 * ENTITY OWNERSHIP (do not break this):
 *   www.makemycv.ae/#organization  Organization  — defined in makemycv-site
 *   www.makemycv.ae/#website       WebSite       — defined in makemycv-site
 *   www.makemycv.ae/#webapp        WebApplication, url = app.makemycv.ae,
 *                                  publisher-linked to #organization
 *                                                — defined in makemycv-site
 *
 * This repo used to emit its own Organization on that same @id with thinner,
 * conflicting facts (name "MakeMyCV", no sameAs, no address, logo pointing at
 * the OG image) plus its own WebApplication describing the same builder at
 * the same URL. Two descriptions of one entity is exactly the entity split
 * the LinkedIn entity-linking work exists to prevent, so both were dropped:
 * makemycv-site is the single source of truth for both nodes.
 *
 * The only node this repo owns is the app subdomain's WebSite — a genuinely
 * distinct site, on its own @id, deferring upward by reference.
 *
 * Rule (per the SEO checklist's integrity rule): every claim in schema
 * must mirror visible on-page content. No fabricated stats, no ratings.
 */

const SITE_URL = "https://www.makemycv.ae";
const APP_URL = "https://app.makemycv.ae";

/**
 * Canonical entity name. Must match the marketing site, LinkedIn and every
 * other owned profile verbatim — inconsistent name strings split the entity
 * and are what let the similarly-named European makemycv.* operators absorb
 * our brand signals. Mirrors SITE_NAME in makemycv-site/lib/seo.ts.
 *
 * Title case, always: this is the entity NAME. The drawn wordmark in
 * public/logos/ is the logotype and stays lowercase. Different strings for
 * different jobs — never swap one for the other.
 */
export const SITE_NAME = "MakeMyCV.ae";

/** Owned by makemycv-site. Reference by @id only — never define them here. */
const ORG_ID = `${SITE_URL}/#organization`;
const WEBAPP_ID = `${SITE_URL}/#webapp`;

const APP_WEBSITE_ID = `${APP_URL}/#website`;

export type JsonLdGraph = Record<string, unknown> | Record<string, unknown>[];

/**
 * The app subdomain as a WebSite. The one node this repo owns.
 *
 * Both outbound links are bare @id references, and that is what makes engines
 * resolve this subdomain into the apex entity graph instead of treating it as
 * a second, unrelated property:
 * - publisher  → the Organization defined on www
 * - mainEntity → the WebApplication defined on www, whose url is this host
 */
export const appWebSiteSchema = () =>
  ({
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": APP_WEBSITE_ID,
    url: APP_URL,
    name: SITE_NAME,
    publisher: { "@id": ORG_ID },
    mainEntity: { "@id": WEBAPP_ID },
    inLanguage: "en-AE",
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

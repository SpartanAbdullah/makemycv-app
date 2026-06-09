import type { JsonLdGraph } from "@/lib/seo/schema";

/**
 * Server component that emits one <script type="application/ld+json"> tag.
 *
 * SSR-only: no client hooks, no window/document access. Renders during the
 * server pass so crawlers and AI fetchers see the schema in the initial HTML.
 *
 * Pass either a single schema object or an array (rendered as one block per
 * call — render the component twice for two separate blocks, or pass an
 * array if a graph is intended).
 */
export function JsonLd({ data }: { data: JsonLdGraph }) {
  return (
    <script
      type="application/ld+json"
      // JSON.stringify is the standard, safe serialization for JSON-LD.
      // The data passed in is plain data, not user input.
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}

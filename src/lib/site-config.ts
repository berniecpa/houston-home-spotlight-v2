/**
 * Site-wide configuration (name, URLs, social handles, SEO keywords).
 *
 * Extracted from `app/layout.tsx` because Next.js only permits a fixed set of
 * named exports from `layout.tsx`/`page.tsx`/`route.ts` (component, metadata,
 * viewport, route-segment config, HTTP handlers). Arbitrary exports such as
 * `siteConfig` are rejected by the build. Importers reference it from
 * `@/lib/site-config`.
 *
 * @module lib/site-config
 */

/** Site-wide constants used for metadata, OpenGraph, Twitter cards, and JSON-LD. */
export const siteConfig = {
  name: "Houston Home Spotlight",
  description: "Discover beautiful homes for sale in Houston. Browse featured listings and connect with Bernard, your local real estate expert.",
  url: "https://houstonhomespotlight.com",
  ogImage: "https://houstonhomespotlight.com/og-image.jpg",
  twitterHandle: "@nbeliterealty",
  author: "NB Elite Realty",
  keywords: [
    "Houston real estate",
    "Houston homes for sale",
    "Houston realtor",
    "Houston property listings",
    "buy home Houston",
    "sell home Houston",
    "Houston luxury homes",
    "Harris County real estate",
    "Fort Bend County homes",
    "Houston TX real estate agent",
  ],
};

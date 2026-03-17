/**
 * Home Page Tests
 * 
 * Tests for the home page component including:
 * - Hero section rendering
 * - Featured listings display
 * - Mobile responsiveness
 * - Component integration
 * 
 * @module tests/home-page.test
 */

import { describe, it } from "node:test";
import assert from "node:assert";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const projectRoot = process.cwd();
const pagePath = join(projectRoot, "src/app/page.tsx");

describe("Home Page", () => {
  describe("File Structure", () => {
    it("should have page.tsx in src/app/", () => {
      assert.ok(existsSync(pagePath), "page.tsx should exist");
    });

    it("should export default Home component", () => {
      const content = readFileSync(pagePath, "utf-8");
      assert.ok(
        content.includes("export default async function Home"),
        "Should export default async Home function"
      );
    });

    it("should return JSX.Element type", () => {
      const content = readFileSync(pagePath, "utf-8");
      assert.ok(
        content.includes(": Promise<JSX.Element>"),
        "Should return Promise<JSX.Element>"
      );
    });
  });

  describe("Imports", () => {
    it("should import Link from next/link", () => {
      const content = readFileSync(pagePath, "utf-8");
      assert.ok(
        content.includes('import Link from "next/link"'),
        "Should import Link component"
      );
    });

    it("should import ListingCard from @/components/ListingCard", () => {
      const content = readFileSync(pagePath, "utf-8");
      assert.ok(
        content.includes('import { ListingCard } from "@/components/ListingCard"'),
        "Should import ListingCard component"
      );
    });

    it("should import getFeaturedListings from @/lib/data", () => {
      const content = readFileSync(pagePath, "utf-8");
      assert.ok(
        content.includes('import { getFeaturedListings } from "@/lib/data"'),
        "Should import getFeaturedListings function"
      );
    });
  });

  describe("Hero Section", () => {
    it("should have a hero section with gradient background", () => {
      const content = readFileSync(pagePath, "utf-8");
      assert.ok(
        content.includes("bg-gradient-to-br from-primary-900"),
        "Should have gradient background"
      );
      assert.ok(
        content.includes("text-white"),
        "Hero should have white text"
      );
    });

    it("should have a headline with 'Find Your Dream Home in Houston'", () => {
      const content = readFileSync(pagePath, "utf-8");
      assert.ok(
        content.includes("Find Your Dream Home in") || content.includes("Find Your Dream Home in Houston"),
        "Should have main headline"
      );
      assert.ok(
        content.includes("Houston") || content.includes("text-accent-400"),
        "Should highlight Houston"
      );
    });

    it("should have a subheadline describing the service", () => {
      const content = readFileSync(pagePath, "utf-8");
      assert.ok(
        content.includes("Discover beautiful homes for sale") ||
        content.includes("Houston") && content.includes("neighborhoods"),
        "Should have subheadline describing homes in Houston"
      );
    });

    it("should have a CTA link to /listings", () => {
      const content = readFileSync(pagePath, "utf-8");
      assert.ok(
        content.includes('href="/listings"'),
        "Should have link to /listings"
      );
      assert.ok(
        content.includes("Browse Listings"),
        "Should have Browse Listings CTA text"
      );
    });

    it("should have a secondary CTA link to /contact", () => {
      const content = readFileSync(pagePath, "utf-8");
      assert.ok(
        content.includes('href="/contact"'),
        "Should have link to /contact"
      );
      assert.ok(
        content.includes("Contact Bernard"),
        "Should have Contact Bernard CTA text"
      );
    });
  });

  describe("Featured Listings Section", () => {
    it("should have a featured listings section", () => {
      const content = readFileSync(pagePath, "utf-8");
      assert.ok(
        content.includes("Featured Listings"),
        "Should have Featured Listings heading"
      );
    });

    it("should call getFeaturedListings to fetch data", () => {
      const content = readFileSync(pagePath, "utf-8");
      assert.ok(
        content.includes("await getFeaturedListings()"),
        "Should await getFeaturedListings()"
      );
    });

    it("should render ListingCard components in a grid", () => {
      const content = readFileSync(pagePath, "utf-8");
      assert.ok(
        content.includes("<ListingCard"),
        "Should render ListingCard components"
      );
      assert.ok(
        content.includes('key={listing.id}'),
        "Should use listing.id as key"
      );
      assert.ok(
        content.includes('listing={listing}'),
        "Should pass listing prop"
      );
    });

    it("should have responsive grid layout", () => {
      const content = readFileSync(pagePath, "utf-8");
      assert.ok(
        content.includes("grid-cols-1") || content.includes("grid"),
        "Should have grid layout"
      );
      assert.ok(
        content.includes("md:grid-cols-2") || content.includes("lg:grid-cols-3"),
        "Should have responsive columns"
      );
    });

    it("should handle empty featured listings gracefully", () => {
      const content = readFileSync(pagePath, "utf-8");
      assert.ok(
        content.includes("featuredListings.length > 0"),
        "Should check for empty listings"
      );
    });

    it("should have a 'View All Listings' link", () => {
      const content = readFileSync(pagePath, "utf-8");
      assert.ok(
        content.includes("View All Listings"),
        "Should have View All Listings link"
      );
    });
  });

  describe("Mobile Responsiveness", () => {
    it("should use responsive container classes", () => {
      const content = readFileSync(pagePath, "utf-8");
      assert.ok(
        content.includes("container-custom"),
        "Should use container-custom class"
      );
    });

    it("should have responsive padding", () => {
      const content = readFileSync(pagePath, "utf-8");
      assert.ok(
        content.includes("py-16") || content.includes("sm:py-20") || content.includes("section-padding"),
        "Should have responsive vertical padding"
      );
    });

    it("should use responsive text sizes", () => {
      const content = readFileSync(pagePath, "utf-8");
      assert.ok(
        content.includes("text-3xl sm:text-4xl") || 
        content.includes("sm:text-5xl") ||
        content.includes("md:text-5xl"),
        "Should have responsive text sizes"
      );
    });

    it("should have responsive button layout", () => {
      const content = readFileSync(pagePath, "utf-8");
      assert.ok(
        content.includes("flex-col sm:flex-row"),
        "Should stack buttons on mobile, row on desktop"
      );
      assert.ok(
        content.includes("w-full sm:w-auto"),
        "Should have full-width buttons on mobile"
      );
    });
  });

  describe("Additional Sections", () => {
    it("should have a 'Why Work With Me' section", () => {
      const content = readFileSync(pagePath, "utf-8");
      assert.ok(
        content.includes("Why Work With Bernard") || content.includes("Why Work With Me"),
        "Should have Why Work With section"
      );
    });

    it("should have a final CTA section", () => {
      const content = readFileSync(pagePath, "utf-8");
      assert.ok(
        content.includes("Ready to Find Your Perfect Home") ||
        content.includes("Get in Touch"),
        "Should have final CTA section"
      );
    });
  });

  describe("Accessibility", () => {
    it("should have semantic HTML structure", () => {
      const content = readFileSync(pagePath, "utf-8");
      assert.ok(
        content.includes("<section"),
        "Should use section elements"
      );
      assert.ok(
        /<h1[\s>]/.test(content) && content.includes("</h1>"),
        "Should have h1 heading"
      );
      assert.ok(
        /<h2[\s>]/.test(content) && content.includes("</h2>"),
        "Should have h2 headings"
      );
    });

    it("should have aria-hidden on decorative icons", () => {
      const content = readFileSync(pagePath, "utf-8");
      assert.ok(
        content.includes('aria-hidden="true"'),
        "Should have aria-hidden on decorative elements"
      );
    });
  });
});

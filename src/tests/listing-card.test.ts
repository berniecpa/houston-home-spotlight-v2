/**
 * ListingCard Component Tests
 * 
 * Tests for the ListingCard component including:
 * - File structure and exports
 * - Component props acceptance
 * - Display elements (image, address, price, stats)
 * - Link behavior
 * - Hover effects
 * - Mobile responsiveness patterns
 */

import { describe, it } from "node:test";
import assert from "node:assert";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const COMPONENT_PATH = join(process.cwd(), "src/components/ListingCard.tsx");

describe("ListingCard Component", () => {
  describe("File Structure", () => {
    it("should have ListingCard.tsx in src/components/", () => {
      assert.strictEqual(existsSync(COMPONENT_PATH), true, "ListingCard.tsx should exist");
    });

    it("should export ListingCard function", () => {
      const content = readFileSync(COMPONENT_PATH, "utf-8");
      assert.ok(
        content.includes("export function ListingCard"),
        "Should export ListingCard function"
      );
    });

    it("should export default ListingCard", () => {
      const content = readFileSync(COMPONENT_PATH, "utf-8");
      assert.ok(
        content.includes("export default ListingCard"),
        "Should have default export"
      );
    });
  });

  describe("Props Interface", () => {
    it("should define ListingCardProps interface", () => {
      const content = readFileSync(COMPONENT_PATH, "utf-8");
      assert.ok(
        content.includes("interface ListingCardProps"),
        "Should define ListingCardProps interface"
      );
    });

    it("should accept listing prop of type Listing", () => {
      const content = readFileSync(COMPONENT_PATH, "utf-8");
      assert.ok(
        content.match(/listing\s*:\s*Listing/),
        "Should accept listing prop of type Listing"
      );
    });
  });

  describe("Imports", () => {
    it("should import Link from next/link", () => {
      const content = readFileSync(COMPONENT_PATH, "utf-8");
      assert.ok(
        content.includes('import Link from "next/link"'),
        "Should import Link from next/link"
      );
    });

    it("should import Image from next/image", () => {
      const content = readFileSync(COMPONENT_PATH, "utf-8");
      assert.ok(
        content.includes('import Image from "next/image"'),
        "Should import Image from next/image"
      );
    });

    it("should import Listing type from @/types", () => {
      const content = readFileSync(COMPONENT_PATH, "utf-8");
      assert.ok(
        content.includes('import { Listing } from "@/types"'),
        "Should import Listing type"
      );
    });
  });

  describe("Display Elements", () => {
    it("should display primary image", () => {
      const content = readFileSync(COMPONENT_PATH, "utf-8");
      assert.ok(
        content.includes("listing.images[0]") || content.includes("primaryImage"),
        "Should reference primary image"
      );
      assert.ok(
        content.includes("<Image"),
        "Should use Next.js Image component"
      );
    });

    it("should display address", () => {
      const content = readFileSync(COMPONENT_PATH, "utf-8");
      assert.ok(
        content.includes("listing.address"),
        "Should display listing address"
      );
    });

    it("should display city, state, and zip", () => {
      const content = readFileSync(COMPONENT_PATH, "utf-8");
      assert.ok(
        content.includes("listing.city"),
        "Should display city"
      );
      assert.ok(
        content.includes("listing.state"),
        "Should display state"
      );
      assert.ok(
        content.includes("listing.zip"),
        "Should display zip"
      );
    });

    it("should display formatted price", () => {
      const content = readFileSync(COMPONENT_PATH, "utf-8");
      assert.ok(
        content.includes("listing.price"),
        "Should display price"
      );
      assert.ok(
        content.includes("formatPrice") || content.includes("Intl.NumberFormat"),
        "Should format price as currency"
      );
    });

    it("should display bed count", () => {
      const content = readFileSync(COMPONENT_PATH, "utf-8");
      assert.ok(
        content.includes("listing.beds"),
        "Should display beds"
      );
    });

    it("should display bath count", () => {
      const content = readFileSync(COMPONENT_PATH, "utf-8");
      assert.ok(
        content.includes("listing.baths"),
        "Should display baths"
      );
    });

    it("should display square footage", () => {
      const content = readFileSync(COMPONENT_PATH, "utf-8");
      assert.ok(
        content.includes("listing.sqft"),
        "Should display sqft"
      );
      assert.ok(
        content.includes("formatNumber") || content.includes("Intl.NumberFormat"),
        "Should format sqft number"
      );
    });
  });

  describe("Link Behavior", () => {
    it("should link to /listings/[slug]", () => {
      const content = readFileSync(COMPONENT_PATH, "utf-8");
      assert.ok(
        content.includes('/listings/${listing.slug}'),
        "Should link to listing detail page with slug"
      );
    });

    it("should use Next.js Link component", () => {
      const content = readFileSync(COMPONENT_PATH, "utf-8");
      assert.ok(
        content.includes("<Link"),
        "Should use Link component"
      );
    });
  });

  describe("Hover Effects", () => {
    it("should have group class for hover effects", () => {
      const content = readFileSync(COMPONENT_PATH, "utf-8");
      assert.ok(
        content.includes('className="group'),
        "Should have group class for hover effects"
      );
    });

    it("should have hover shadow effect", () => {
      const content = readFileSync(COMPONENT_PATH, "utf-8");
      assert.ok(
        content.includes("hover:shadow") || content.includes("hover:shadow-xl"),
        "Should have hover shadow effect"
      );
    });

    it("should have hover translate effect", () => {
      const content = readFileSync(COMPONENT_PATH, "utf-8");
      assert.ok(
        content.includes("hover:-translate-y") || content.includes("hover:translate-y"),
        "Should have hover translate effect"
      );
    });

    it("should have image scale on hover", () => {
      const content = readFileSync(COMPONENT_PATH, "utf-8");
      assert.ok(
        content.includes("group-hover:scale"),
        "Should have image scale on group hover"
      );
    });
  });

  describe("Mobile Responsiveness", () => {
    it("should have w-full for full width", () => {
      const content = readFileSync(COMPONENT_PATH, "utf-8");
      assert.ok(
        content.includes("w-full"),
        "Should have w-full for full width cards"
      );
    });

    it("should have responsive padding", () => {
      const content = readFileSync(COMPONENT_PATH, "utf-8");
      assert.ok(
        content.includes("p-4") && content.includes("sm:p-5"),
        "Should have responsive padding (p-4 sm:p-5)"
      );
    });

    it("should have aspect ratio container for images", () => {
      const content = readFileSync(COMPONENT_PATH, "utf-8");
      assert.ok(
        content.includes("aspect-") || content.includes("aspect-[4/3]"),
        "Should have aspect ratio for image container"
      );
    });
  });

  describe("Accessibility", () => {
    it("should have aria-label for the link", () => {
      const content = readFileSync(COMPONENT_PATH, "utf-8");
      assert.ok(
        content.includes("aria-label"),
        "Should have aria-label for accessibility"
      );
    });

    it("should have alt text for images", () => {
      const content = readFileSync(COMPONENT_PATH, "utf-8");
      assert.ok(
        content.includes("alt=") && content.includes("Primary Photo"),
        "Should have descriptive alt text for images"
      );
    });

    it("should use semantic article element", () => {
      const content = readFileSync(COMPONENT_PATH, "utf-8");
      assert.ok(
        content.includes("<article"),
        "Should use semantic article element"
      );
    });
  });

  describe("Featured Badge", () => {
    it("should conditionally show featured badge", () => {
      const content = readFileSync(COMPONENT_PATH, "utf-8");
      assert.ok(
        content.includes("listing.featured") && content.includes("Featured"),
        "Should conditionally show featured badge"
      );
    });
  });

  describe("Helper Functions", () => {
    it("should have formatPrice helper function", () => {
      const content = readFileSync(COMPONENT_PATH, "utf-8");
      assert.ok(
        content.includes("function formatPrice"),
        "Should have formatPrice helper function"
      );
    });

    it("should have formatNumber helper function", () => {
      const content = readFileSync(COMPONENT_PATH, "utf-8");
      assert.ok(
        content.includes("function formatNumber"),
        "Should have formatNumber helper function"
      );
    });
  });

  describe("Styling", () => {
    it("should use card class from globals.css", () => {
      const content = readFileSync(COMPONENT_PATH, "utf-8");
      assert.ok(
        content.includes('className="card'),
        "Should use card class for consistent styling"
      );
    });

    it("should use primary color classes", () => {
      const content = readFileSync(COMPONENT_PATH, "utf-8");
      assert.ok(
        content.includes("text-primary-900") || content.includes("text-primary-700"),
        "Should use primary color classes"
      );
    });

    it("should have transition classes", () => {
      const content = readFileSync(COMPONENT_PATH, "utf-8");
      assert.ok(
        content.includes("transition-"),
        "Should have transition classes for smooth animations"
      );
    });
  });
});

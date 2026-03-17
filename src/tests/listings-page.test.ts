/**
 * Tests for Listings Page
 * 
 * @module tests/listings.test
 */

import { describe, it } from "node:test";
import assert from "node:assert";
import { readFileSync, existsSync } from "fs";
import { join } from "path";

const ROOT_DIR = "/home/berniecpa/projects/houston-home-spotlight-v2";
const PAGE_FILE = join(ROOT_DIR, "src/app/listings/page.tsx");

describe("Listings Page (US-010)", () => {
  describe("File Structure", () => {
    it("should have listings page at src/app/listings/page.tsx", () => {
      assert.strictEqual(existsSync(PAGE_FILE), true, "Listings page file should exist");
    });

    it("should export default component", () => {
      const content = readFileSync(PAGE_FILE, "utf-8");
      assert.ok(
        content.includes("export default function ListingsPage"),
        "Should export default ListingsPage component"
      );
    });

    it("should use 'use client' directive for client-side interactivity", () => {
      const content = readFileSync(PAGE_FILE, "utf-8");
      assert.ok(
        content.includes('"use client"'),
        "Should have 'use client' directive for client-side filtering"
      );
    });
  });

  describe("Component Imports", () => {
    it("should import ListingCard component", () => {
      const content = readFileSync(PAGE_FILE, "utf-8");
      assert.ok(
        content.includes('import { ListingCard } from "@/components/ListingCard"'),
        "Should import ListingCard component"
      );
    });

    it("should import FilterBar component", () => {
      const content = readFileSync(PAGE_FILE, "utf-8");
      assert.ok(
        content.includes('import { FilterBar } from "@/components/FilterBar"'),
        "Should import FilterBar component"
      );
    });

    it("should import types from @/types", () => {
      const content = readFileSync(PAGE_FILE, "utf-8");
      assert.ok(
        content.includes('import { Listing, FilterOptions } from "@/types"'),
        "Should import Listing and FilterOptions types"
      );
    });

    it("should import React hooks for state management", () => {
      const content = readFileSync(PAGE_FILE, "utf-8");
      assert.ok(
        content.includes("useState") && content.includes("useEffect") && content.includes("useCallback") && content.includes("useMemo"),
        "Should import useState, useEffect, useCallback, and useMemo hooks"
      );
    });
  });

  describe("Filtering Logic", () => {
    it("should have filterListingsClientSide function", () => {
      const content = readFileSync(PAGE_FILE, "utf-8");
      assert.ok(
        content.includes("function filterListingsClientSide"),
        "Should have filterListingsClientSide function"
      );
    });

    it("should filter by minPrice", () => {
      const content = readFileSync(PAGE_FILE, "utf-8");
      assert.ok(
        content.includes("filters.minPrice !== undefined && listing.price < filters.minPrice"),
        "Should filter by minPrice"
      );
    });

    it("should filter by maxPrice", () => {
      const content = readFileSync(PAGE_FILE, "utf-8");
      assert.ok(
        content.includes("filters.maxPrice !== undefined && listing.price > filters.maxPrice"),
        "Should filter by maxPrice"
      );
    });

    it("should filter by minBeds", () => {
      const content = readFileSync(PAGE_FILE, "utf-8");
      assert.ok(
        content.includes("filters.minBeds !== undefined && listing.beds < filters.minBeds"),
        "Should filter by minBeds"
      );
    });

    it("should use useMemo for filtered listings", () => {
      const content = readFileSync(PAGE_FILE, "utf-8");
      assert.ok(
        content.includes("useMemo") && content.includes("filteredListings"),
        "Should use useMemo for filtered listings performance"
      );
    });
  });

  describe("State Management", () => {
    it("should have allListings state", () => {
      const content = readFileSync(PAGE_FILE, "utf-8");
      assert.ok(
        content.includes("const [allListings, setAllListings] = useState<Listing[]>") ||
        content.includes('useState<Listing[]>([])'),
        "Should have allListings state"
      );
    });

    it("should have isLoading state", () => {
      const content = readFileSync(PAGE_FILE, "utf-8");
      assert.ok(
        content.includes('const [isLoading, setIsLoading] = useState'),
        "Should have isLoading state"
      );
    });

    it("should have filters state", () => {
      const content = readFileSync(PAGE_FILE, "utf-8");
      assert.ok(
        content.includes("const [filters, setFilters] = useState<FilterOptions>") ||
        content.includes('useState<FilterOptions>({})'),
        "Should have filters state"
      );
    });

    it("should load listings in useEffect", () => {
      const content = readFileSync(PAGE_FILE, "utf-8");
      assert.ok(
        content.includes("useEffect") && content.includes("loadListings"),
        "Should load listings in useEffect"
      );
    });
  });

  describe("FilterBar Integration", () => {
    it("should render FilterBar component", () => {
      const content = readFileSync(PAGE_FILE, "utf-8");
      assert.ok(
        content.includes("<FilterBar"),
        "Should render FilterBar component"
      );
    });

    it("should pass filters prop to FilterBar", () => {
      const content = readFileSync(PAGE_FILE, "utf-8");
      assert.ok(
        content.match(/filters\s*=\s*\{filters\}/),
        "Should pass filters prop to FilterBar"
      );
    });

    it("should pass onFiltersChange handler to FilterBar", () => {
      const content = readFileSync(PAGE_FILE, "utf-8");
      assert.ok(
        content.includes("onFiltersChange={handleFiltersChange}"),
        "Should pass onFiltersChange handler to FilterBar"
      );
    });

    it("should pass resultCount to FilterBar", () => {
      const content = readFileSync(PAGE_FILE, "utf-8");
      assert.ok(
        content.includes("resultCount={filteredCount}"),
        "Should pass resultCount to FilterBar"
      );
    });
  });

  describe("Listings Grid", () => {
    it("should render ListingCard for each listing", () => {
      const content = readFileSync(PAGE_FILE, "utf-8");
      assert.ok(
        content.includes("filteredListings.map") && content.includes("<ListingCard"),
        "Should map filteredListings to ListingCard components"
      );
    });

    it("should use key prop with listing.id", () => {
      const content = readFileSync(PAGE_FILE, "utf-8");
      assert.ok(
        content.includes("key={listing.id}"),
        "Should use listing.id as key prop"
      );
    });

    it("should have responsive grid layout", () => {
      const content = readFileSync(PAGE_FILE, "utf-8");
      assert.ok(
        content.includes("grid-cols-1") && 
        content.includes("md:grid-cols-2") && 
        content.includes("lg:grid-cols-3"),
        "Should have responsive grid: 1 col mobile, 2 col tablet, 3 col desktop"
      );
    });
  });

  describe("Empty States", () => {
    it("should have empty state when no listings match filters", () => {
      const content = readFileSync(PAGE_FILE, "utf-8");
      assert.ok(
        content.includes("No listings match your filters") ||
        content.includes("filteredListings.length === 0"),
        "Should have empty state for no filter matches"
      );
    });

    it("should have 'Clear All Filters' button in empty state", () => {
      const content = readFileSync(PAGE_FILE, "utf-8");
      assert.ok(
        content.includes("Clear All Filters") || content.includes("setFilters({})"),
        "Should have clear filters button in empty state"
      );
    });

    it("should have loading state", () => {
      const content = readFileSync(PAGE_FILE, "utf-8");
      assert.ok(
        content.includes("isLoading") && content.includes("Loading listings"),
        "Should have loading state UI"
      );
    });

    it("should have error state", () => {
      const content = readFileSync(PAGE_FILE, "utf-8");
      assert.ok(
        content.includes("setError") && content.includes("Something went wrong"),
        "Should have error state UI"
      );
    });
  });

  describe("Hero Section", () => {
    it("should have hero section with gradient-primary class", () => {
      const content = readFileSync(PAGE_FILE, "utf-8");
      assert.ok(
        content.includes("gradient-primary"),
        "Should use gradient-primary class for hero"
      );
    });

    it("should have page title", () => {
      const content = readFileSync(PAGE_FILE, "utf-8");
      assert.ok(
        content.includes("Houston Area Homes for Sale"),
        "Should have page title 'Houston Area Homes for Sale'"
      );
    });

    it("should have breadcrumb navigation", () => {
      const content = readFileSync(PAGE_FILE, "utf-8");
      assert.ok(
        content.includes('aria-label="Breadcrumb"') || content.includes("breadcrumb"),
        "Should have breadcrumb navigation"
      );
    });

    it("should display results count", () => {
      const content = readFileSync(PAGE_FILE, "utf-8");
      assert.ok(
        content.includes("filteredCount") && content.includes("totalCount"),
        "Should display filtered and total counts"
      );
    });
  });

  describe("Mobile Responsiveness", () => {
    it("should use container-custom class", () => {
      const content = readFileSync(PAGE_FILE, "utf-8");
      assert.ok(
        content.includes("container-custom"),
        "Should use container-custom class"
      );
    });

    it("should have responsive padding", () => {
      const content = readFileSync(PAGE_FILE, "utf-8");
      assert.ok(
        content.includes("py-6") || content.includes("py-10") || content.includes("sm:py"),
        "Should have responsive padding classes"
      );
    });

    it("should have responsive text sizes", () => {
      const content = readFileSync(PAGE_FILE, "utf-8");
      assert.ok(
        content.includes("text-2xl") && content.includes("sm:text-3xl"),
        "Should have responsive text sizes"
      );
    });
  });

  describe("Accessibility", () => {
    it("should have semantic HTML structure", () => {
      const content = readFileSync(PAGE_FILE, "utf-8");
      assert.ok(
        content.includes("<section") && content.includes("<nav"),
        "Should use semantic section and nav elements"
      );
    });

    it("should have aria-label for breadcrumb", () => {
      const content = readFileSync(PAGE_FILE, "utf-8");
      assert.ok(
        content.includes('aria-label="Breadcrumb"'),
        "Should have aria-label for breadcrumb"
      );
    });

    it("should have aria-current for current page", () => {
      const content = readFileSync(PAGE_FILE, "utf-8");
      assert.ok(
        content.includes('aria-current="page"'),
        "Should have aria-current for current page"
      );
    });
  });

  describe("Data Loading", () => {
    it("should import listing JSON files dynamically", () => {
      const content = readFileSync(PAGE_FILE, "utf-8");
      assert.ok(
        content.includes("import(\"@/data/listings/riverside-terrace-modern-craftsman.json\")") &&
        content.includes("import(\"@/data/listings/heights-bungalow-historic.json\")") &&
        content.includes("import(\"@/data/listings/sugarland-estate-pool.json\")"),
        "Should dynamically import all listing JSON files"
      );
    });

    it("should use Promise.all for parallel loading", () => {
      const content = readFileSync(PAGE_FILE, "utf-8");
      assert.ok(
        content.includes("Promise.all(listingFiles)"),
        "Should use Promise.all for parallel loading"
      );
    });
  });
});

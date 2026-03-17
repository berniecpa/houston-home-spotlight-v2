/**
 * Filter Components Tests
 * 
 * Tests for PriceFilter, BedsFilter, and FilterBar components including:
 * - File structure and exports
 * - Props interfaces
 * - Component composition
 * - Accessibility features
 * - Mobile responsive patterns
 */

import { describe, it } from "node:test";
import assert from "node:assert";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const PRICE_FILTER_PATH = join(process.cwd(), "src/components/PriceFilter.tsx");
const BEDS_FILTER_PATH = join(process.cwd(), "src/components/BedsFilter.tsx");
const FILTER_BAR_PATH = join(process.cwd(), "src/components/FilterBar.tsx");

describe("Filter Components", () => {
  describe("File Structure", () => {
    it("should have PriceFilter.tsx in src/components/", () => {
      assert.strictEqual(existsSync(PRICE_FILTER_PATH), true, "PriceFilter.tsx should exist");
    });

    it("should have BedsFilter.tsx in src/components/", () => {
      assert.strictEqual(existsSync(BEDS_FILTER_PATH), true, "BedsFilter.tsx should exist");
    });

    it("should have FilterBar.tsx in src/components/", () => {
      assert.strictEqual(existsSync(FILTER_BAR_PATH), true, "FilterBar.tsx should exist");
    });

    it("should export PriceFilter function", () => {
      const content = readFileSync(PRICE_FILTER_PATH, "utf-8");
      assert.ok(
        content.includes("export function PriceFilter"),
        "Should export PriceFilter function"
      );
    });

    it("should export BedsFilter function", () => {
      const content = readFileSync(BEDS_FILTER_PATH, "utf-8");
      assert.ok(
        content.includes("export function BedsFilter"),
        "Should export BedsFilter function"
      );
    });

    it("should export FilterBar function", () => {
      const content = readFileSync(FILTER_BAR_PATH, "utf-8");
      assert.ok(
        content.includes("export function FilterBar"),
        "Should export FilterBar function"
      );
    });

    it("should have default exports for all components", () => {
      assert.ok(
        readFileSync(PRICE_FILTER_PATH, "utf-8").includes("export default PriceFilter"),
        "PriceFilter should have default export"
      );
      assert.ok(
        readFileSync(BEDS_FILTER_PATH, "utf-8").includes("export default BedsFilter"),
        "BedsFilter should have default export"
      );
      assert.ok(
        readFileSync(FILTER_BAR_PATH, "utf-8").includes("export default FilterBar"),
        "FilterBar should have default export"
      );
    });
  });

  describe("PriceFilter Component", () => {
    it("should define PriceFilterProps interface", () => {
      const content = readFileSync(PRICE_FILTER_PATH, "utf-8");
      assert.ok(
        content.includes("interface PriceFilterProps"),
        "Should define PriceFilterProps interface"
      );
    });

    it("should accept minPrice and maxPrice props as strings", () => {
      const content = readFileSync(PRICE_FILTER_PATH, "utf-8");
      assert.ok(
        content.match(/minPrice\s*:\s*string/),
        "Should accept minPrice prop as string"
      );
      assert.ok(
        content.match(/maxPrice\s*:\s*string/),
        "Should accept maxPrice prop as string"
      );
    });

    it("should have onMinPriceChange and onMaxPriceChange callback props", () => {
      const content = readFileSync(PRICE_FILTER_PATH, "utf-8");
      assert.ok(
        content.includes("onMinPriceChange"),
        "Should have onMinPriceChange callback"
      );
      assert.ok(
        content.includes("onMaxPriceChange"),
        "Should have onMaxPriceChange callback"
      );
    });

    it("should have two input fields for min and max price", () => {
      const content = readFileSync(PRICE_FILTER_PATH, "utf-8");
      const inputMatches = content.match(/<input/g);
      assert.ok(
        inputMatches && inputMatches.length >= 2,
        "Should have at least 2 input fields"
      );
    });

    it("should have labels for price inputs", () => {
      const content = readFileSync(PRICE_FILTER_PATH, "utf-8");
      assert.ok(
        content.includes('htmlFor="min-price"'),
        "Should have label for min price input"
      );
      assert.ok(
        content.includes('htmlFor="max-price"'),
        "Should have label for max price input"
      );
    });

    it("should have dollar sign prefix for price inputs", () => {
      const content = readFileSync(PRICE_FILTER_PATH, "utf-8");
      assert.ok(
        content.includes("$") || content.includes("&#36;"),
        "Should show dollar sign prefix"
      );
    });

    it("should use inputMode numeric for mobile keyboards", () => {
      const content = readFileSync(PRICE_FILTER_PATH, "utf-8");
      assert.ok(
        content.includes('inputMode="numeric"'),
        "Should use numeric input mode for mobile"
      );
    });

    it("should have aria-label for accessibility", () => {
      const content = readFileSync(PRICE_FILTER_PATH, "utf-8");
      assert.ok(
        content.includes('aria-label="Minimum price"'),
        "Should have aria-label for min price"
      );
      assert.ok(
        content.includes('aria-label="Maximum price"'),
        "Should have aria-label for max price"
      );
    });

    it("should use fieldset and legend for grouping", () => {
      const content = readFileSync(PRICE_FILTER_PATH, "utf-8");
      assert.ok(
        content.includes("<fieldset"),
        "Should use fieldset for grouping"
      );
      assert.ok(
        content.includes("<legend"),
        "Should use legend for label"
      );
    });
  });

  describe("BedsFilter Component", () => {
    it("should define BedsFilterProps interface", () => {
      const content = readFileSync(BEDS_FILTER_PATH, "utf-8");
      assert.ok(
        content.includes("interface BedsFilterProps"),
        "Should define BedsFilterProps interface"
      );
    });

    it("should accept selectedBeds prop", () => {
      const content = readFileSync(BEDS_FILTER_PATH, "utf-8");
      assert.ok(
        content.includes("selectedBeds"),
        "Should accept selectedBeds prop"
      );
    });

    it("should have onBedsChange callback prop", () => {
      const content = readFileSync(BEDS_FILTER_PATH, "utf-8");
      assert.ok(
        content.includes("onBedsChange"),
        "Should have onBedsChange callback"
      );
    });

    it("should have button elements for bed count selection", () => {
      const content = readFileSync(BEDS_FILTER_PATH, "utf-8");
      assert.ok(
        content.includes("<button"),
        "Should use button elements for bed selection"
      );
    });

    it("should have 'Any' option for clearing bed filter", () => {
      const content = readFileSync(BEDS_FILTER_PATH, "utf-8");
      assert.ok(
        content.includes("Any"),
        "Should have 'Any' option"
      );
    });

    it("should have bed count options (1-5+)", () => {
      const content = readFileSync(BEDS_FILTER_PATH, "utf-8");
      assert.ok(
        content.includes("1") && content.includes("5"),
        "Should have bed count options 1-5"
      );
    });

    it("should use role=radiogroup for accessibility", () => {
      const content = readFileSync(BEDS_FILTER_PATH, "utf-8");
      assert.ok(
        content.includes('role="radiogroup"'),
        "Should use radiogroup role"
      );
    });

    it("should have aria-checked for selected state", () => {
      const content = readFileSync(BEDS_FILTER_PATH, "utf-8");
      assert.ok(
        content.includes("aria-checked"),
        "Should have aria-checked for state"
      );
    });

    it("should have aria-label for each bed option", () => {
      const content = readFileSync(BEDS_FILTER_PATH, "utf-8");
      assert.ok(
        content.includes('aria-label=') && content.includes("bedroom"),
        "Should have descriptive aria-labels"
      );
    });

    it("should use fieldset and legend for grouping", () => {
      const content = readFileSync(BEDS_FILTER_PATH, "utf-8");
      assert.ok(
        content.includes("<fieldset"),
        "Should use fieldset for grouping"
      );
      assert.ok(
        content.includes("<legend"),
        "Should use legend for label"
      );
    });
  });

  describe("FilterBar Component", () => {
    it("should define FilterBarProps interface", () => {
      const content = readFileSync(FILTER_BAR_PATH, "utf-8");
      assert.ok(
        content.includes("interface FilterBarProps"),
        "Should define FilterBarProps interface"
      );
    });

    it("should accept filters prop of type FilterOptions", () => {
      const content = readFileSync(FILTER_BAR_PATH, "utf-8");
      assert.ok(
        content.match(/filters\s*:\s*FilterOptions/),
        "Should accept filters prop of type FilterOptions"
      );
    });

    it("should import PriceFilter component", () => {
      const content = readFileSync(FILTER_BAR_PATH, "utf-8");
      assert.ok(
        content.includes('import { PriceFilter }'),
        "Should import PriceFilter"
      );
    });

    it("should import BedsFilter component", () => {
      const content = readFileSync(FILTER_BAR_PATH, "utf-8");
      assert.ok(
        content.includes('import { BedsFilter }'),
        "Should import BedsFilter"
      );
    });

    it("should import FilterOptions type from @/types", () => {
      const content = readFileSync(FILTER_BAR_PATH, "utf-8");
      assert.ok(
        content.includes('import { FilterOptions }'),
        "Should import FilterOptions type"
      );
    });

    it("should render both PriceFilter and BedsFilter", () => {
      const content = readFileSync(FILTER_BAR_PATH, "utf-8");
      assert.ok(
        content.includes("<PriceFilter"),
        "Should render PriceFilter component"
      );
      assert.ok(
        content.includes("<BedsFilter"),
        "Should render BedsFilter component"
      );
    });

    it("should have clear filters functionality", () => {
      const content = readFileSync(FILTER_BAR_PATH, "utf-8");
      assert.ok(
        content.includes("Clear") || content.includes("clear"),
        "Should have clear filters functionality"
      );
    });

    it("should track active filter count", () => {
      const content = readFileSync(FILTER_BAR_PATH, "utf-8");
      assert.ok(
        content.includes("activeFilterCount"),
        "Should track active filter count"
      );
    });

    it("should show badge with active filter count", () => {
      const content = readFileSync(FILTER_BAR_PATH, "utf-8");
      assert.ok(
        content.includes("activeFilterCount"),
        "Should show active filter count badge"
      );
    });
  });

  describe("Mobile Responsiveness", () => {
    it("PriceFilter should stack inputs vertically on mobile", () => {
      const content = readFileSync(PRICE_FILTER_PATH, "utf-8");
      assert.ok(
        content.includes("flex-col") && content.includes("sm:flex-row"),
        "Should stack inputs vertically on mobile"
      );
    });

    it("FilterBar should have expandable section on mobile", () => {
      const content = readFileSync(FILTER_BAR_PATH, "utf-8");
      assert.ok(
        content.includes("sm:hidden") || content.includes("hidden sm:block"),
        "Should have mobile-only toggle behavior"
      );
    });

    it("FilterBar should use aria-expanded for toggle state", () => {
      const content = readFileSync(FILTER_BAR_PATH, "utf-8");
      assert.ok(
        content.includes("aria-expanded"),
        "Should use aria-expanded for toggle"
      );
    });

    it("FilterBar should have aria-controls for panel", () => {
      const content = readFileSync(FILTER_BAR_PATH, "utf-8");
      assert.ok(
        content.includes("aria-controls"),
        "Should have aria-controls"
      );
    });
  });

  describe("Accessibility", () => {
    it("All components should use semantic HTML", () => {
      const priceContent = readFileSync(PRICE_FILTER_PATH, "utf-8");
      const bedsContent = readFileSync(BEDS_FILTER_PATH, "utf-8");
      
      assert.ok(
        priceContent.includes("<fieldset"),
        "PriceFilter should use fieldset"
      );
      assert.ok(
        bedsContent.includes("<fieldset"),
        "BedsFilter should use fieldset"
      );
    });

    it("should have focus indicators", () => {
      const content = readFileSync(PRICE_FILTER_PATH, "utf-8");
      assert.ok(
        content.includes("focus:ring") || content.includes("focus:outline"),
        "Should have focus indicators"
      );
    });

    it("should have keyboard-navigable elements", () => {
      const content = readFileSync(BEDS_FILTER_PATH, "utf-8");
      assert.ok(
        content.includes('type="button"'),
        "Buttons should be keyboard accessible"
      );
    });

    it("should have aria-label for clear button", () => {
      const content = readFileSync(FILTER_BAR_PATH, "utf-8");
      assert.ok(
        content.includes('aria-label="Clear all filters"'),
        "Should have aria-label for clear button"
      );
    });
  });

  describe("Styling", () => {
    it("should use consistent Tailwind classes", () => {
      const priceContent = readFileSync(PRICE_FILTER_PATH, "utf-8");
      const bedsContent = readFileSync(BEDS_FILTER_PATH, "utf-8");
      
      assert.ok(
        priceContent.includes("rounded-md"),
        "Should use rounded-md for consistent styling"
      );
      assert.ok(
        bedsContent.includes("rounded-md"),
        "Should use rounded-md for consistent styling"
      );
    });

    it("should use primary color for focus states", () => {
      const content = readFileSync(PRICE_FILTER_PATH, "utf-8");
      assert.ok(
        content.includes("focus:ring-primary"),
        "Should use primary color for focus"
      );
    });

    it("should have active state styling for selected beds", () => {
      const content = readFileSync(BEDS_FILTER_PATH, "utf-8");
      assert.ok(
        content.includes("bg-primary") || content.includes("text-primary"),
        "Should have primary color for active state"
      );
    });
  });
});

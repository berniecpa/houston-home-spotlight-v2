/**
 * PriceFilter Component
 * 
 * A reusable filter component for selecting price ranges.
 * Provides min and max price input fields with proper accessibility.
 * 
 * @module components/PriceFilter
 */

import { ChangeEvent } from "react";

/**
 * Props for the PriceFilter component
 */
interface PriceFilterProps {
  /** Current minimum price value (empty string if not set) */
  minPrice: string;
  /** Current maximum price value (empty string if not set) */
  maxPrice: string;
  /** Callback when min price changes */
  onMinPriceChange: (value: string) => void;
  /** Callback when max price changes */
  onMaxPriceChange: (value: string) => void;
  /** Optional label for the filter section */
  label?: string;
}

/**
 * Format price for display (adds commas, no dollar sign)
 * @param value - Raw input value
 * @returns Formatted value with commas
 */
function formatPriceInput(value: string): string {
  // Remove non-numeric characters
  const numericValue = value.replace(/[^0-9]/g, "");
  // Add commas for thousands
  return numericValue.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

/**
 * PriceFilter component - Allows users to filter by price range
 * 
 * Features:
 * - Min and max price inputs
 * - Formatted number display with commas
 * - Accessible labels and keyboard navigation
 * - Mobile-optimized layout
 * 
 * @param {PriceFilterProps} props - Component props
 * @returns {JSX.Element} The price filter component
 */
export function PriceFilter({
  minPrice,
  maxPrice,
  onMinPriceChange,
  onMaxPriceChange,
  label = "Price Range",
}: PriceFilterProps): JSX.Element {
  const handleMinChange = (e: ChangeEvent<HTMLInputElement>) => {
    const rawValue = e.target.value.replace(/[^0-9]/g, "");
    onMinPriceChange(rawValue);
  };

  const handleMaxChange = (e: ChangeEvent<HTMLInputElement>) => {
    const rawValue = e.target.value.replace(/[^0-9]/g, "");
    onMaxPriceChange(rawValue);
  };

  return (
    <fieldset className="space-y-3">
      <legend className="text-sm font-semibold text-gray-900">{label}</legend>
      <div className="flex flex-col sm:flex-row gap-3">
        {/* Min Price Input */}
        <div className="flex-1">
          <label 
            htmlFor="min-price" 
            className="block text-xs text-gray-600 mb-1"
          >
            Min Price
          </label>
          <div className="relative">
            <span 
              className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none"
              aria-hidden="true"
            >
              $
            </span>
            <input
              id="min-price"
              type="text"
              inputMode="numeric"
              pattern="[0-9,]*"
              value={minPrice ? formatPriceInput(minPrice) : ""}
              onChange={handleMinChange}
              placeholder="No min"
              className="w-full pl-7 pr-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors"
              aria-label="Minimum price"
            />
          </div>
        </div>

        {/* Max Price Input */}
        <div className="flex-1">
          <label 
            htmlFor="max-price" 
            className="block text-xs text-gray-600 mb-1"
          >
            Max Price
          </label>
          <div className="relative">
            <span 
              className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none"
              aria-hidden="true"
            >
              $
            </span>
            <input
              id="max-price"
              type="text"
              inputMode="numeric"
              pattern="[0-9,]*"
              value={maxPrice ? formatPriceInput(maxPrice) : ""}
              onChange={handleMaxChange}
              placeholder="No max"
              className="w-full pl-7 pr-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors"
              aria-label="Maximum price"
            />
          </div>
        </div>
      </div>
    </fieldset>
  );
}

export default PriceFilter;

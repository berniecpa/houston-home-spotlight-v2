/**
 * FilterBar Component
 * 
 * A composite filter component that combines all listing filters.
 * Manages filter state and provides clear/reset functionality.
 * 
 * @module components/FilterBar
 */

import { useState, useCallback } from "react";
import { PriceFilter } from "./PriceFilter";
import { BedsFilter } from "./BedsFilter";
import { FilterOptions } from "@/types";

/**
 * Props for the FilterBar component
 */
interface FilterBarProps {
  /** Current filter values */
  filters: FilterOptions;
  /** Callback when filters change */
  onFiltersChange: (filters: FilterOptions) => void;
  /** Optional additional CSS classes */
  className?: string;
  /** Total number of results (for display) */
  resultCount?: number;
}

/**
 * FilterBar component - Combines all listing filters into a cohesive UI
 * 
 * Features:
 * - Combines PriceFilter and BedsFilter
 * - Expandable on mobile devices
 * - Clear all filters button
 * - Result count display
 * - Accessible with proper ARIA attributes
 * - Mobile-first responsive design
 * 
 * @param {FilterBarProps} props - Component props
 * @returns {JSX.Element} The filter bar component
 */
export function FilterBar({
  filters,
  onFiltersChange,
  className = "",
  resultCount,
}: FilterBarProps): JSX.Element {
  const [isExpanded, setIsExpanded] = useState(false);

  // Local state for price inputs (strings for raw input handling)
  const [minPrice, setMinPrice] = useState(filters.minPrice?.toString() || "");
  const [maxPrice, setMaxPrice] = useState(filters.maxPrice?.toString() || "");

  // Update parent when price inputs change (debounced could be added here)
  const handleMinPriceChange = useCallback((value: string) => {
    setMinPrice(value);
    const numValue = value ? parseInt(value.replace(/,/g, ""), 10) : undefined;
    onFiltersChange({
      ...filters,
      minPrice: numValue && !isNaN(numValue) ? numValue : undefined,
    });
  }, [filters, onFiltersChange]);

  const handleMaxPriceChange = useCallback((value: string) => {
    setMaxPrice(value);
    const numValue = value ? parseInt(value.replace(/,/g, ""), 10) : undefined;
    onFiltersChange({
      ...filters,
      maxPrice: numValue && !isNaN(numValue) ? numValue : undefined,
    });
  }, [filters, onFiltersChange]);

  const handleBedsChange = useCallback((beds: number | undefined) => {
    onFiltersChange({
      ...filters,
      minBeds: beds,
    });
  }, [filters, onFiltersChange]);

  const handleClearFilters = () => {
    setMinPrice("");
    setMaxPrice("");
    onFiltersChange({});
  };

  const hasActiveFilters = filters.minPrice !== undefined || 
                           filters.maxPrice !== undefined || 
                           filters.minBeds !== undefined;

  const activeFilterCount = [
    filters.minPrice !== undefined,
    filters.maxPrice !== undefined,
    filters.minBeds !== undefined,
  ].filter(Boolean).length;

  return (
    <div className={`bg-white border border-gray-200 rounded-lg shadow-sm ${className}`}>
      {/* Mobile Header with Toggle */}
      <div className="sm:hidden">
        <button
          type="button"
          onClick={() => setIsExpanded(!isExpanded)}
          className="w-full flex items-center justify-between px-4 py-3 text-left focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-inset"
          aria-expanded={isExpanded}
          aria-controls="filter-panel"
        >
          <div className="flex items-center gap-2">
            <svg 
              className="w-5 h-5 text-gray-500" 
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                strokeWidth={2} 
                d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" 
              />
            </svg>
            <span className="font-medium text-gray-900">
              Filters
              {activeFilterCount > 0 && (
                <span className="ml-2 inline-flex items-center justify-center w-5 h-5 text-xs font-semibold bg-primary-600 text-white rounded-full">
                  {activeFilterCount}
                </span>
              )}
            </span>
          </div>
          <svg 
            className={`w-5 h-5 text-gray-500 transition-transform duration-200 ${isExpanded ? "rotate-180" : ""}`}
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              strokeWidth={2} 
              d="M19 9l-7 7-7-7" 
            />
          </svg>
        </button>
      </div>

      {/* Filter Content - Always visible on desktop, toggleable on mobile */}
      <div 
        id="filter-panel"
        className={`${isExpanded ? "block" : "hidden"} sm:block px-4 py-4 sm:px-6 sm:py-5`}
      >
        {/* Desktop Header */}
        <div className="hidden sm:flex sm:items-center sm:justify-between mb-5">
          <div className="flex items-center gap-2">
            <svg 
              className="w-5 h-5 text-gray-500" 
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                strokeWidth={2} 
                d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" 
              />
            </svg>
            <h3 className="font-semibold text-gray-900">Filter Listings</h3>
          </div>
          {resultCount !== undefined && (
            <span className="text-sm text-gray-600">
              {resultCount} {resultCount === 1 ? "home" : "homes"} found
            </span>
          )}
        </div>

        {/* Filter Controls */}
        <div className="space-y-5 sm:space-y-0 sm:grid sm:grid-cols-2 sm:gap-6 lg:gap-8">
          {/* Price Filter */}
          <PriceFilter
            minPrice={minPrice}
            maxPrice={maxPrice}
            onMinPriceChange={handleMinPriceChange}
            onMaxPriceChange={handleMaxPriceChange}
          />

          {/* Beds Filter */}
          <BedsFilter
            selectedBeds={filters.minBeds}
            onBedsChange={handleBedsChange}
          />
        </div>

        {/* Mobile Result Count */}
        {resultCount !== undefined && (
          <div className="mt-4 pt-4 border-t border-gray-200 sm:hidden">
            <span className="text-sm text-gray-600">
              {resultCount} {resultCount === 1 ? "home" : "homes"} found
            </span>
          </div>
        )}

        {/* Clear Filters Button */}
        {hasActiveFilters && (
          <div className="mt-5 pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={handleClearFilters}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-primary-700 bg-primary-50 hover:bg-primary-100 rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-1"
              aria-label="Clear all filters"
            >
              <svg 
                className="w-4 h-4" 
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path 
                  strokeLinecap="round" 
                  strokeLinejoin="round" 
                  strokeWidth={2} 
                  d="M6 18L18 6M6 6l12 12" 
                />
              </svg>
              Clear All Filters
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default FilterBar;

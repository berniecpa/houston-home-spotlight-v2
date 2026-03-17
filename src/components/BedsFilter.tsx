/**
 * BedsFilter Component
 * 
 * A reusable filter component for selecting bedroom count.
 * Provides selectable bed count options with proper accessibility.
 * 
 * @module components/BedsFilter
 */

// No type imports needed - using primitive types only

/**
 * Props for the BedsFilter component
 */
interface BedsFilterProps {
  /** Currently selected bed count (undefined if not set) */
  selectedBeds: number | undefined;
  /** Callback when bed selection changes */
  onBedsChange: (beds: number | undefined) => void;
  /** Optional label for the filter section */
  label?: string;
  /** Available bed count options (defaults to 1-5+) */
  options?: number[];
}

/**
 * Default bed count options
 */
const DEFAULT_BED_OPTIONS = [1, 2, 3, 4, 5];

/**
 * BedsFilter component - Allows users to filter by bedroom count
 * 
 * Features:
 * - Selectable bed count buttons (1, 2, 3, 4, 5+)
 * - "Any" option to clear selection
 * - Accessible button group with ARIA attributes
 * - Visual active state indication
 * - Keyboard navigation support
 * - Mobile-optimized layout
 * 
 * @param {BedsFilterProps} props - Component props
 * @returns {JSX.Element} The beds filter component
 */
export function BedsFilter({
  selectedBeds,
  onBedsChange,
  label = "Bedrooms",
  options = DEFAULT_BED_OPTIONS,
}: BedsFilterProps): JSX.Element {
  const handleBedsClick = (beds: number | undefined) => {
    // Toggle off if clicking the same value
    if (selectedBeds === beds) {
      onBedsChange(undefined);
    } else {
      onBedsChange(beds);
    }
  };

  return (
    <fieldset className="space-y-3">
      <legend className="text-sm font-semibold text-gray-900">{label}</legend>
      <div 
        className="flex flex-wrap gap-2"
        role="radiogroup"
        aria-label={`${label} selection`}
      >
        {/* Any option */}
        <button
          type="button"
          onClick={() => handleBedsClick(undefined)}
          className={`
            px-4 py-2 text-sm font-medium rounded-md border transition-all duration-200
            focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-1
            ${selectedBeds === undefined
              ? "bg-primary-600 text-white border-primary-600"
              : "bg-white text-gray-700 border-gray-300 hover:border-primary-400 hover:text-primary-700"
            }
          `}
          role="radio"
          aria-checked={selectedBeds === undefined}
          aria-label="Any number of bedrooms"
        >
          Any
        </button>

        {/* Bed count options */}
        {options.map((beds) => (
          <button
            key={beds}
            type="button"
            onClick={() => handleBedsClick(beds)}
            className={`
              px-4 py-2 text-sm font-medium rounded-md border transition-all duration-200
              focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-1
              ${selectedBeds === beds
                ? "bg-primary-600 text-white border-primary-600"
                : "bg-white text-gray-700 border-gray-300 hover:border-primary-400 hover:text-primary-700"
              }
            `}
            role="radio"
            aria-checked={selectedBeds === beds}
            aria-label={`${beds} ${beds === 1 ? "bedroom" : "bedrooms"}${beds === 5 ? " or more" : ""}`}
          >
            {beds}{beds === 5 ? "+" : ""}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

export default BedsFilter;

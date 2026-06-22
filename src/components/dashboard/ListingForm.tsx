/**
 * ListingForm Component
 *
 * Client form for creating and editing agent listings (LIST-01, LIST-02).
 *
 * Features:
 * - Fields: title, address, city, state, zip, price, beds, baths, sqft, description
 * - Dynamic photo URL list: add/remove rows, at least one http(s) URL required (LIST-01)
 * - Create mode → POST /api/agent/listings
 * - Edit mode (seeded with existing listing) → PUT /api/agent/listings/[id] (LIST-02)
 * - Client-side validation mirrors server requirements (required fields, positive numerics,
 *   http(s) URL allowlist) — instant feedback before network request
 * - API error mapping: 400 (validation), 403 (forbidden/subscription), 409 (slug conflict)
 *   → inline error banners using the ProfileForm status-banner pattern
 * - onSuccess callback triggers ListingsManager refresh and closes the modal
 *
 * Security (T-04-18 mitigation):
 *   Client URL allowlist for UX; authoritative isSafeHttpUrl check runs server-side.
 *
 * Per 02-UI-SPEC ProfileForm visual language (labels, inputs, red asterisks, error banners).
 *
 * @module components/dashboard/ListingForm
 */

'use client';

import { useState, useEffect, ChangeEvent, FormEvent } from 'react';
import type { OwnListing } from '@/components/dashboard/ListingsManager';

/** Fields managed by this form */
interface ListingFormFields {
  title: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  price: string;
  beds: string;
  baths: string;
  sqft: string;
  description: string;
}

/** Per-field validation errors */
interface ListingFormErrors {
  title?: string;
  address?: string;
  city?: string;
  state?: string;
  zip?: string;
  price?: string;
  beds?: string;
  baths?: string;
  sqft?: string;
  description?: string;
}

/** Props for the ListingForm component */
export interface ListingFormProps {
  /** Whether we are creating a new listing or editing an existing one */
  mode: 'create' | 'edit';
  /** Existing listing to pre-fill fields in edit mode (null/undefined for create) */
  existingListing: OwnListing | null | undefined;
  /** Called after a successful API response — triggers table refresh in parent */
  onSuccess: () => void;
  /** Called when the user cancels without saving */
  onCancel: () => void;
  /** When true, render the admin-only "Featured on homepage" toggle. */
  isAdmin?: boolean;
}

/** Default empty form state */
const DEFAULT_FIELDS: ListingFormFields = {
  title: '',
  address: '',
  city: 'Houston',
  state: 'TX',
  zip: '',
  price: '',
  beds: '',
  baths: '',
  sqft: '',
  description: '',
};

/**
 * Client-side http(s) URL check — mirrors server-side isSafeHttpUrl (T-04-18).
 * Provides instant feedback so users do not wait for a network round-trip.
 */
function isSafeHttpUrl(raw: string): boolean {
  try {
    const u = new URL(raw);
    return u.protocol === 'https:' || u.protocol === 'http:';
  } catch {
    return false;
  }
}

/** Full listing detail returned by GET /api/agent/listings/[id] (CR-02) */
interface ListingDetail {
  title: string;
  address: string;
  city: string;
  state: string;
  zip: string | null;
  price: number;
  beds: number;
  baths: number;
  sqft: number | null;
  description: string | null;
  featured?: number;
}

/**
 * Seed ListingFormFields from the full listing detail for edit mode (CR-02).
 *
 * Previously this seeded city/state/zip/sqft/description with hardcoded
 * defaults because only summary columns were available, which silently
 * overwrote real data on save. The form now fetches the full record from
 * GET /api/agent/listings/[id] and seeds every field from real values.
 */
function seedFromDetail(detail: ListingDetail): ListingFormFields {
  return {
    title: detail.title,
    address: detail.address,
    city: detail.city ?? '',
    state: detail.state ?? '',
    zip: detail.zip ?? '',
    price: String(detail.price),
    beds: String(detail.beds),
    baths: String(detail.baths),
    sqft: detail.sqft != null ? String(detail.sqft) : '',
    description: detail.description ?? '',
  };
}

/**
 * Seed the minimal summary fields synchronously so the edit form is not blank
 * while the full detail fetch is in flight. The remaining columns are filled
 * once GET /api/agent/listings/[id] resolves (CR-02).
 */
function seedSummary(listing: OwnListing): ListingFormFields {
  return {
    ...DEFAULT_FIELDS,
    title: listing.title,
    address: listing.address,
    price: String(listing.price),
    beds: String(listing.beds),
    baths: String(listing.baths),
    city: '',
    state: '',
  };
}

/**
 * ListingForm — create/edit form with multi-photo URL inputs.
 *
 * @param props.mode - 'create' or 'edit'
 * @param props.existingListing - Existing listing data for pre-filling edit mode
 * @param props.onSuccess - Callback fired after successful POST/PUT
 * @param props.onCancel - Callback fired when user clicks Cancel
 * @returns {JSX.Element} Listing form with all fields and photo URL list
 */
export function ListingForm({
  mode,
  existingListing,
  onSuccess,
  onCancel,
  isAdmin = false,
}: ListingFormProps): JSX.Element {
  const [fields, setFields] = useState<ListingFormFields>(
    mode === 'edit' && existingListing
      ? seedSummary(existingListing)
      : DEFAULT_FIELDS
  );

  // Dynamic photo URL rows — at least one required (LIST-01)
  const [imageUrls, setImageUrls] = useState<string[]>(['']);
  const [urlErrors, setUrlErrors] = useState<string[]>(['']);

  const [fieldErrors, setFieldErrors] = useState<ListingFormErrors>({});
  const [serverError, setServerError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  // Admin-only: homepage featured flag. Seeded from the detail fetch in edit mode.
  const [featured, setFeatured] = useState(false);

  // Edit mode: load the FULL listing record (all columns + image URLs) so the
  // form seeds from real values rather than hardcoded defaults (CR-02).
  const isEditMode = mode === 'edit' && existingListing != null;
  const [isLoadingDetail, setIsLoadingDetail] = useState(isEditMode);

  useEffect(() => {
    if (!isEditMode || !existingListing) return;
    let cancelled = false;

    async function loadDetail(id: string): Promise<void> {
      setIsLoadingDetail(true);
      try {
        const res = await fetch(`/api/agent/listings/${id}`);
        const data = (await res.json()) as {
          success: boolean;
          listing?: ListingDetail;
          imageUrls?: string[];
          message?: string;
        };
        if (cancelled) return;
        if (res.ok && data.success && data.listing) {
          setFields(seedFromDetail(data.listing));
          setFeatured(data.listing.featured === 1);
          const urls =
            data.imageUrls && data.imageUrls.length > 0 ? data.imageUrls : [''];
          setImageUrls(urls);
          setUrlErrors(urls.map(() => ''));
        } else {
          setServerError(data.message ?? 'Failed to load listing details.');
        }
      } catch {
        if (!cancelled) setServerError('Network error loading listing details.');
      } finally {
        if (!cancelled) setIsLoadingDetail(false);
      }
    }

    void loadDetail(existingListing.id);
    return () => {
      cancelled = true;
    };
  }, [isEditMode, existingListing]);

  // -------------------------------------------------------------------------
  // Field change + validation
  // -------------------------------------------------------------------------

  function handleFieldChange(
    e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ): void {
    const { name, value } = e.target;
    setFields((prev) => ({ ...prev, [name]: value }));
    setServerError('');
    const error = validateField(name as keyof ListingFormFields, value);
    setFieldErrors((prev) => ({ ...prev, [name]: error || undefined }));
  }

  function validateField(
    name: keyof ListingFormFields,
    value: string
  ): string {
    const required: (keyof ListingFormFields)[] = ['title', 'address', 'price', 'beds', 'baths'];
    if (required.includes(name) && !value.trim()) {
      const labels: Record<keyof ListingFormFields, string> = {
        title: 'Title',
        address: 'Address',
        city: 'City',
        state: 'State',
        zip: 'ZIP',
        price: 'Price',
        beds: 'Beds',
        baths: 'Baths',
        sqft: 'Sqft',
        description: 'Description',
      };
      return `${labels[name]} is required.`;
    }
    if (name === 'price' && value.trim()) {
      const n = Number(value);
      if (isNaN(n) || n <= 0) return 'Price must be a positive number.';
    }
    if (name === 'beds' && value.trim()) {
      const n = Number(value);
      if (isNaN(n) || n < 0) return 'Beds must be 0 or more.';
    }
    if (name === 'baths' && value.trim()) {
      const n = Number(value);
      if (isNaN(n) || n < 0) return 'Baths must be 0 or more.';
    }
    if (name === 'sqft' && value.trim()) {
      const n = Number(value);
      if (isNaN(n) || n <= 0) return 'Sqft must be a positive number.';
    }
    return '';
  }

  function validateAllFields(): boolean {
    const newErrors: ListingFormErrors = {};
    (Object.keys(fields) as (keyof ListingFormFields)[]).forEach((k) => {
      const err = validateField(k, fields[k]);
      if (err) newErrors[k] = err;
    });
    setFieldErrors(newErrors);
    return Object.values(newErrors).every((v) => !v);
  }

  // -------------------------------------------------------------------------
  // Photo URL row management
  // -------------------------------------------------------------------------

  function handleUrlChange(index: number, value: string): void {
    setImageUrls((prev) => {
      const updated = [...prev];
      updated[index] = value;
      return updated;
    });
    setServerError('');
    const err = value.trim() && !isSafeHttpUrl(value.trim())
      ? 'Must be a valid http(s) URL.'
      : '';
    setUrlErrors((prev) => {
      const updated = [...prev];
      updated[index] = err;
      return updated;
    });
  }

  function addUrlRow(): void {
    setImageUrls((prev) => [...prev, '']);
    setUrlErrors((prev) => [...prev, '']);
  }

  function removeUrlRow(index: number): void {
    if (imageUrls.length === 1) return;
    setImageUrls((prev) => prev.filter((_, i) => i !== index));
    setUrlErrors((prev) => prev.filter((_, i) => i !== index));
  }

  function validateUrls(): boolean {
    const newErrors = imageUrls.map((url) => {
      if (!url.trim()) return 'Photo URL is required.';
      if (!isSafeHttpUrl(url.trim())) return 'Must be a valid http(s) URL.';
      return '';
    });
    setUrlErrors(newErrors);
    return newErrors.every((e) => !e);
  }

  // -------------------------------------------------------------------------
  // Submit
  // -------------------------------------------------------------------------

  async function handleSubmit(e: FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault();
    setServerError('');

    const fieldsValid = validateAllFields();
    const urlsValid = validateUrls();
    if (!fieldsValid || !urlsValid) return;

    setIsSubmitting(true);

    const payload = {
      title: fields.title.trim(),
      address: fields.address.trim(),
      city: fields.city.trim() || 'Houston',
      state: fields.state.trim() || 'TX',
      zip: fields.zip.trim() || undefined,
      price: Number(fields.price),
      beds: Number(fields.beds),
      baths: Number(fields.baths),
      sqft: fields.sqft.trim() ? Number(fields.sqft) : undefined,
      description: fields.description.trim() || undefined,
      imageUrls: imageUrls.map((u) => u.trim()),
      // Featured is admin-only; only send it when the toggle is available.
      ...(isAdmin ? { featured: featured ? 1 : 0 } : {}),
    };

    const isEdit = mode === 'edit' && existingListing !== null && existingListing !== undefined;
    const url = isEdit
      ? `/api/agent/listings/${existingListing!.id}`
      : '/api/agent/listings';

    try {
      // Use method: 'POST' for create, method: 'PUT' for edit (LIST-02)
      const res = isEdit
        ? await fetch(url, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          })
        : await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          });

      const data = (await res.json()) as { success: boolean; message?: string };

      if (res.ok && data.success) {
        onSuccess();
        return;
      }

      // Map known HTTP status codes to user-friendly messages
      if (res.status === 403) {
        setServerError(
          data.message ??
            'You can only edit your own listings, or an active subscription is required.'
        );
      } else if (res.status === 409) {
        setServerError(
          data.message ??
            'A listing with a similar title and address already exists.'
        );
      } else {
        setServerError(data.message ?? 'Something went wrong. Please try again.');
      }
    } catch {
      setServerError('Network error. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  }

  // -------------------------------------------------------------------------
  // Input class helper
  // -------------------------------------------------------------------------

  function inputClass(hasError: boolean): string {
    return [
      'w-full px-4 py-2.5 rounded-lg border transition-colors duration-200',
      'focus:ring-2 focus:ring-primary-500 focus:border-primary-500',
      'disabled:bg-gray-100 disabled:cursor-not-allowed',
      hasError ? 'border-red-500' : 'border-gray-300',
    ].join(' ');
  }

  const isDisabled = isSubmitting || isLoadingDetail;

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    <form onSubmit={handleSubmit} className="space-y-5" noValidate>
      {/* Loading existing listing details (edit mode, CR-02) */}
      {isLoadingDetail && (
        <div
          className="text-sm text-gray-500"
          role="status"
          aria-live="polite"
        >
          Loading listing details...
        </div>
      )}

      {/* Server error banner */}
      {serverError && (
        <div
          className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-lg text-sm"
          role="alert"
          aria-live="assertive"
        >
          {serverError}
        </div>
      )}

      {/* Title */}
      <div>
        <label
          htmlFor="listing-title"
          className="block text-sm font-semibold text-gray-700 mb-1.5"
        >
          Title <span className="text-red-600" aria-hidden="true">*</span>
        </label>
        <input
          type="text"
          id="listing-title"
          name="title"
          value={fields.title}
          onChange={handleFieldChange}
          disabled={isDisabled}
          className={inputClass(!!fieldErrors.title)}
          aria-required="true"
          aria-invalid={fieldErrors.title ? 'true' : 'false'}
          aria-describedby={fieldErrors.title ? 'err-listing-title' : undefined}
          placeholder="Heights Craftsman Bungalow"
        />
        {fieldErrors.title && (
          <p id="err-listing-title" className="mt-1 text-sm text-red-600">
            {fieldErrors.title}
          </p>
        )}
      </div>

      {/* Address */}
      <div>
        <label
          htmlFor="listing-address"
          className="block text-sm font-semibold text-gray-700 mb-1.5"
        >
          Address <span className="text-red-600" aria-hidden="true">*</span>
        </label>
        <input
          type="text"
          id="listing-address"
          name="address"
          value={fields.address}
          onChange={handleFieldChange}
          disabled={isDisabled}
          className={inputClass(!!fieldErrors.address)}
          aria-required="true"
          aria-invalid={fieldErrors.address ? 'true' : 'false'}
          aria-describedby={fieldErrors.address ? 'err-listing-address' : undefined}
          placeholder="1234 Heights Blvd"
          autoComplete="street-address"
        />
        {fieldErrors.address && (
          <p id="err-listing-address" className="mt-1 text-sm text-red-600">
            {fieldErrors.address}
          </p>
        )}
      </div>

      {/* City / State / ZIP */}
      <div className="grid grid-cols-3 gap-3">
        <div className="col-span-1">
          <label
            htmlFor="listing-city"
            className="block text-sm font-semibold text-gray-700 mb-1.5"
          >
            City
          </label>
          <input
            type="text"
            id="listing-city"
            name="city"
            value={fields.city}
            onChange={handleFieldChange}
            disabled={isDisabled}
            className={inputClass(false)}
            placeholder="Houston"
            autoComplete="address-level2"
          />
        </div>
        <div className="col-span-1">
          <label
            htmlFor="listing-state"
            className="block text-sm font-semibold text-gray-700 mb-1.5"
          >
            State
          </label>
          <input
            type="text"
            id="listing-state"
            name="state"
            value={fields.state}
            onChange={handleFieldChange}
            disabled={isDisabled}
            className={inputClass(false)}
            placeholder="TX"
            autoComplete="address-level1"
            maxLength={2}
          />
        </div>
        <div className="col-span-1">
          <label
            htmlFor="listing-zip"
            className="block text-sm font-semibold text-gray-700 mb-1.5"
          >
            ZIP
          </label>
          <input
            type="text"
            id="listing-zip"
            name="zip"
            value={fields.zip}
            onChange={handleFieldChange}
            disabled={isDisabled}
            className={inputClass(false)}
            placeholder="77008"
            autoComplete="postal-code"
            maxLength={10}
          />
        </div>
      </div>

      {/* Price / Beds / Baths / Sqft */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div>
          <label
            htmlFor="listing-price"
            className="block text-sm font-semibold text-gray-700 mb-1.5"
          >
            Price ($) <span className="text-red-600" aria-hidden="true">*</span>
          </label>
          <input
            type="number"
            id="listing-price"
            name="price"
            value={fields.price}
            onChange={handleFieldChange}
            disabled={isDisabled}
            className={inputClass(!!fieldErrors.price)}
            aria-required="true"
            aria-invalid={fieldErrors.price ? 'true' : 'false'}
            aria-describedby={fieldErrors.price ? 'err-listing-price' : undefined}
            placeholder="450000"
            min="1"
            step="1"
          />
          {fieldErrors.price && (
            <p id="err-listing-price" className="mt-1 text-sm text-red-600">
              {fieldErrors.price}
            </p>
          )}
        </div>

        <div>
          <label
            htmlFor="listing-beds"
            className="block text-sm font-semibold text-gray-700 mb-1.5"
          >
            Beds <span className="text-red-600" aria-hidden="true">*</span>
          </label>
          <input
            type="number"
            id="listing-beds"
            name="beds"
            value={fields.beds}
            onChange={handleFieldChange}
            disabled={isDisabled}
            className={inputClass(!!fieldErrors.beds)}
            aria-required="true"
            aria-invalid={fieldErrors.beds ? 'true' : 'false'}
            aria-describedby={fieldErrors.beds ? 'err-listing-beds' : undefined}
            placeholder="3"
            min="0"
            step="1"
          />
          {fieldErrors.beds && (
            <p id="err-listing-beds" className="mt-1 text-sm text-red-600">
              {fieldErrors.beds}
            </p>
          )}
        </div>

        <div>
          <label
            htmlFor="listing-baths"
            className="block text-sm font-semibold text-gray-700 mb-1.5"
          >
            Baths <span className="text-red-600" aria-hidden="true">*</span>
          </label>
          <input
            type="number"
            id="listing-baths"
            name="baths"
            value={fields.baths}
            onChange={handleFieldChange}
            disabled={isDisabled}
            className={inputClass(!!fieldErrors.baths)}
            aria-required="true"
            aria-invalid={fieldErrors.baths ? 'true' : 'false'}
            aria-describedby={fieldErrors.baths ? 'err-listing-baths' : undefined}
            placeholder="2"
            min="0"
            step="0.5"
          />
          {fieldErrors.baths && (
            <p id="err-listing-baths" className="mt-1 text-sm text-red-600">
              {fieldErrors.baths}
            </p>
          )}
        </div>

        <div>
          <label
            htmlFor="listing-sqft"
            className="block text-sm font-semibold text-gray-700 mb-1.5"
          >
            Sqft
          </label>
          <input
            type="number"
            id="listing-sqft"
            name="sqft"
            value={fields.sqft}
            onChange={handleFieldChange}
            disabled={isDisabled}
            className={inputClass(!!fieldErrors.sqft)}
            aria-invalid={fieldErrors.sqft ? 'true' : 'false'}
            aria-describedby={fieldErrors.sqft ? 'err-listing-sqft' : undefined}
            placeholder="1850"
            min="1"
            step="1"
          />
          {fieldErrors.sqft && (
            <p id="err-listing-sqft" className="mt-1 text-sm text-red-600">
              {fieldErrors.sqft}
            </p>
          )}
        </div>
      </div>

      {/* Description */}
      <div>
        <label
          htmlFor="listing-description"
          className="block text-sm font-semibold text-gray-700 mb-1.5"
        >
          Description
        </label>
        <textarea
          id="listing-description"
          name="description"
          value={fields.description}
          onChange={handleFieldChange}
          disabled={isDisabled}
          className={[
            'w-full px-4 py-2.5 rounded-lg border transition-colors duration-200 resize-y',
            'focus:ring-2 focus:ring-primary-500 focus:border-primary-500',
            'disabled:bg-gray-100 disabled:cursor-not-allowed border-gray-300',
          ].join(' ')}
          rows={4}
          placeholder="Describe the property, neighborhood, highlights..."
        />
      </div>

      {/* Featured toggle — admin only (controls homepage placement) */}
      {isAdmin && (
        <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-3">
          <input
            type="checkbox"
            id="listing-featured"
            name="featured"
            checked={featured}
            onChange={(e) => setFeatured(e.target.checked)}
            disabled={isDisabled}
            className="mt-0.5 h-5 w-5 rounded border-gray-300 text-accent-600 focus:ring-accent-500"
          />
          <label htmlFor="listing-featured" className="text-sm text-gray-700">
            <span className="font-semibold">Feature on homepage</span>
            <span className="block text-xs text-gray-500">
              Admin only — featured listings appear in the homepage spotlight grid.
            </span>
          </label>
        </div>
      )}

      {/* Photo URLs — dynamic list (LIST-01 multi-photo) */}
      <div>
        <div className="mb-2">
          <span className="block text-sm font-semibold text-gray-700">
            Photo URLs <span className="text-red-600" aria-hidden="true">*</span>
            <span className="ml-1 text-xs font-normal text-gray-400">
              (at least one http(s) URL required)
            </span>
          </span>
        </div>

        <div className="space-y-2">
          {imageUrls.map((url, index) => (
            <div key={index} className="flex items-start gap-2">
              <div className="flex-1">
                <input
                  type="url"
                  value={url}
                  onChange={(e) => handleUrlChange(index, e.target.value)}
                  disabled={isDisabled}
                  className={inputClass(!!urlErrors[index])}
                  aria-label={`Photo URL ${index + 1}`}
                  aria-invalid={urlErrors[index] ? 'true' : 'false'}
                  placeholder="https://example.com/photo.jpg"
                />
                {urlErrors[index] && (
                  <p className="mt-1 text-sm text-red-600">{urlErrors[index]}</p>
                )}
              </div>
              <button
                type="button"
                onClick={() => removeUrlRow(index)}
                disabled={isDisabled || imageUrls.length === 1}
                className="touch-target flex items-center justify-center rounded-lg text-gray-400 hover:text-red-500 transition-colors disabled:opacity-30"
                aria-label={`Remove photo URL ${index + 1}`}
              >
                <svg
                  className="w-5 h-5"
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
              </button>
            </div>
          ))}
        </div>

        <button
          type="button"
          onClick={addUrlRow}
          disabled={isDisabled}
          className="mt-2 text-sm text-primary-600 hover:text-primary-800 font-medium transition-colors disabled:opacity-50"
        >
          + Add photo URL
        </button>
      </div>

      {/* Form actions */}
      <div className="flex items-center justify-end gap-3 pt-2">
        <button
          type="button"
          onClick={onCancel}
          disabled={isSubmitting}
          className="px-5 py-2.5 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors touch-target disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isDisabled}
          aria-disabled={isDisabled}
          className={`btn-primary touch-target ${isDisabled ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          {isSubmitting
            ? 'Saving...'
            : mode === 'create'
            ? 'Create listing'
            : 'Save changes'}
        </button>
      </div>
    </form>
  );
}

export default ListingForm;

/**
 * ProfileForm Component
 *
 * Client form for agent profile completion (AUTH-05). Five fields:
 * Full Name, Photo URL, Phone, Brokerage, License Number.
 *
 * Features:
 * - Pre-fills from current agent values passed as props
 * - Photo URL shows 64x64 rounded-full preview updating onBlur;
 *   gray-200 placeholder circle on empty/invalid URL
 * - Required validation with red asterisk per field label
 * - On submit: PATCH /api/agent/profile
 * - On success: green "Profile saved." banner; router.refresh() re-runs the
 *   layout gate so a newly-complete profile unlocks the dashboard
 * - ErrorBanner reused from auth components for server errors
 * - label htmlFor/id + aria-describedby (Accessibility Contract)
 * - .btn-primary full width, .touch-target (44px)
 *
 * Per UI-SPEC /dashboard/profile spec, Copywriting Contract, and
 * PLAN 02-03 Task 2 action.
 *
 * @module components/dashboard/ProfileForm
 */

'use client';

import { useState, ChangeEvent, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { ErrorBanner } from '@/components/auth/ErrorBanner';

/** Agent profile field values accepted by the form */
export interface ProfileFormValues {
  display_name: string;
  photo_url: string;
  phone: string;
  brokerage: string;
  license_number: string;
}

/** Per-field validation errors */
interface ProfileFormErrors {
  display_name?: string;
  photo_url?: string;
  phone?: string;
  brokerage?: string;
  license_number?: string;
}

/** ProfileForm component props */
export interface ProfileFormProps {
  /** Current agent field values to pre-fill the form */
  initialValues: ProfileFormValues;
}

/**
 * ProfileForm — five-field agent profile completion form.
 *
 * Posts PATCH /api/agent/profile; shows green success banner on save.
 *
 * @param props.initialValues - Current agent profile values from D1
 * @returns {JSX.Element} Profile form with photo preview and save CTA
 */
export function ProfileForm({ initialValues }: ProfileFormProps): JSX.Element {
  const router = useRouter();

  const [fields, setFields] = useState<ProfileFormValues>(initialValues);
  const [previewUrl, setPreviewUrl] = useState(initialValues.photo_url);
  const [errors, setErrors] = useState<ProfileFormErrors>({});
  const [serverError, setServerError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  /**
   * True only for http(s) URLs. Mirrors the server-side allow-list (CR-01) so
   * a javascript:/data: value never binds to the preview `<img src>`.
   */
  function isSafeHttpUrl(raw: string): boolean {
    try {
      const u = new URL(raw);
      return u.protocol === 'https:' || u.protocol === 'http:';
    } catch {
      return false;
    }
  }

  /**
   * Validate a single field. Returns error string or empty string.
   * All profile fields are optional — only the photo URL, when provided,
   * must be a safe http(s) URL.
   */
  function validateField(name: keyof ProfileFormValues, value: string): string {
    if (name === 'photo_url' && value.trim() && !isSafeHttpUrl(value.trim())) {
      return 'Photo URL must be a valid http(s) URL.';
    }
    return '';
  }

  /** Handle field change with instant validation. */
  function handleChange(e: ChangeEvent<HTMLInputElement>): void {
    const { name, value } = e.target;
    setFields((prev) => ({ ...prev, [name]: value }));
    setServerError('');
    setSuccessMessage('');
    const error = validateField(name as keyof ProfileFormValues, value);
    setErrors((prev) => ({ ...prev, [name]: error || undefined }));
  }

  /** Update photo preview on blur. */
  function handlePhotoBlur(): void {
    setPreviewUrl(fields.photo_url);
  }

  /** Validate all fields and return whether form is valid. */
  function validateAll(): boolean {
    const newErrors: ProfileFormErrors = {};
    (Object.keys(fields) as (keyof ProfileFormValues)[]).forEach((k) => {
      const err = validateField(k, fields[k]);
      if (err) newErrors[k] = err;
    });
    setErrors(newErrors);
    return Object.values(newErrors).every((v) => !v);
  }

  /** Whether submit button should be disabled. */
  function isDisabled(): boolean {
    return isSubmitting || Object.values(errors).some(Boolean);
  }

  /**
   * Submit handler — PATCH /api/agent/profile.
   * On success: show green banner + router.refresh() to re-run layout gate.
   */
  async function handleSubmit(e: FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault();
    setServerError('');
    setSuccessMessage('');

    if (!validateAll()) return;

    setIsSubmitting(true);

    try {
      const res = await fetch('/api/agent/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(fields),
      });

      const data = (await res.json()) as { success: boolean; message: string };

      if (res.ok && data.success) {
        setSuccessMessage('Profile saved.');
        // Refresh the server layout so the profile gate re-evaluates
        router.refresh();
      } else {
        setServerError(data.message || 'Something went wrong. Please try again.');
      }
    } catch {
      setServerError('Something went wrong. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-xl" noValidate>
      {/* Server error banner */}
      <ErrorBanner message={serverError} />

      {/* Success banner */}
      {successMessage && (
        <div
          className="bg-green-50 border border-green-200 text-green-700 p-4 rounded-lg text-sm"
          role="status"
          aria-live="polite"
        >
          {successMessage}
        </div>
      )}

      {/* Full Name */}
      <div>
        <label
          htmlFor="profile-display-name"
          className="block text-sm font-semibold text-gray-700 mb-1.5"
        >
          Full name
        </label>
        <input
          type="text"
          id="profile-display-name"
          name="display_name"
          value={fields.display_name}
          onChange={handleChange}
          disabled={isSubmitting}
          autoComplete="name"
          className={`w-full px-4 py-2.5 rounded-lg border transition-colors duration-200
            focus:ring-2 focus:ring-primary-500 focus:border-primary-500
            disabled:bg-gray-100 disabled:cursor-not-allowed
            ${errors.display_name ? 'border-red-500' : 'border-gray-300'}`}
          aria-required="false"
          aria-invalid={errors.display_name ? 'true' : 'false'}
          aria-describedby={errors.display_name ? 'err-display-name' : undefined}
          placeholder="Jane Smith"
        />
        {errors.display_name && (
          <p id="err-display-name" className="mt-1 text-sm text-red-600">
            {errors.display_name}
          </p>
        )}
      </div>

      {/* Photo URL */}
      <div>
        <label
          htmlFor="profile-photo-url"
          className="block text-sm font-semibold text-gray-700 mb-1.5"
        >
          Photo URL
        </label>
        <div className="flex items-start gap-4">
          {/* 64x64 rounded-full preview — gray circle placeholder on empty/invalid */}
          <div className="flex-shrink-0 w-16 h-16 rounded-full bg-gray-200 overflow-hidden">
            {previewUrl && isSafeHttpUrl(previewUrl.trim()) ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={previewUrl}
                alt="Profile photo preview"
                className="w-full h-full object-cover"
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).style.display = 'none';
                }}
              />
            ) : (
              <div
                className="w-full h-full flex items-center justify-center"
                aria-hidden="true"
              >
                <svg
                  className="w-8 h-8 text-gray-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                  />
                </svg>
              </div>
            )}
          </div>

          {/* URL input */}
          <div className="flex-1">
            <input
              type="url"
              id="profile-photo-url"
              name="photo_url"
              value={fields.photo_url}
              onChange={handleChange}
              onBlur={handlePhotoBlur}
              disabled={isSubmitting}
              className={`w-full px-4 py-2.5 rounded-lg border transition-colors duration-200
                focus:ring-2 focus:ring-primary-500 focus:border-primary-500
                disabled:bg-gray-100 disabled:cursor-not-allowed
                ${errors.photo_url ? 'border-red-500' : 'border-gray-300'}`}
              aria-required="false"
              aria-invalid={errors.photo_url ? 'true' : 'false'}
              aria-describedby={errors.photo_url ? 'err-photo-url' : undefined}
              placeholder="https://example.com/photo.jpg"
            />
            {errors.photo_url && (
              <p id="err-photo-url" className="mt-1 text-sm text-red-600">
                {errors.photo_url}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Phone */}
      <div>
        <label
          htmlFor="profile-phone"
          className="block text-sm font-semibold text-gray-700 mb-1.5"
        >
          Phone
        </label>
        <input
          type="tel"
          id="profile-phone"
          name="phone"
          value={fields.phone}
          onChange={handleChange}
          disabled={isSubmitting}
          autoComplete="tel"
          className={`w-full px-4 py-2.5 rounded-lg border transition-colors duration-200
            focus:ring-2 focus:ring-primary-500 focus:border-primary-500
            disabled:bg-gray-100 disabled:cursor-not-allowed
            ${errors.phone ? 'border-red-500' : 'border-gray-300'}`}
          aria-required="false"
          aria-invalid={errors.phone ? 'true' : 'false'}
          aria-describedby={errors.phone ? 'err-phone' : undefined}
          placeholder="713-555-0100"
        />
        {errors.phone && (
          <p id="err-phone" className="mt-1 text-sm text-red-600">
            {errors.phone}
          </p>
        )}
      </div>

      {/* Brokerage */}
      <div>
        <label
          htmlFor="profile-brokerage"
          className="block text-sm font-semibold text-gray-700 mb-1.5"
        >
          Brokerage
        </label>
        <input
          type="text"
          id="profile-brokerage"
          name="brokerage"
          value={fields.brokerage}
          onChange={handleChange}
          disabled={isSubmitting}
          className={`w-full px-4 py-2.5 rounded-lg border transition-colors duration-200
            focus:ring-2 focus:ring-primary-500 focus:border-primary-500
            disabled:bg-gray-100 disabled:cursor-not-allowed
            ${errors.brokerage ? 'border-red-500' : 'border-gray-300'}`}
          aria-required="false"
          aria-invalid={errors.brokerage ? 'true' : 'false'}
          aria-describedby={errors.brokerage ? 'err-brokerage' : undefined}
          placeholder="Houston Realty Group"
        />
        {errors.brokerage && (
          <p id="err-brokerage" className="mt-1 text-sm text-red-600">
            {errors.brokerage}
          </p>
        )}
      </div>

      {/* License Number */}
      <div>
        <label
          htmlFor="profile-license-number"
          className="block text-sm font-semibold text-gray-700 mb-1.5"
        >
          License number
        </label>
        <input
          type="text"
          id="profile-license-number"
          name="license_number"
          value={fields.license_number}
          onChange={handleChange}
          disabled={isSubmitting}
          className={`w-full px-4 py-2.5 rounded-lg border transition-colors duration-200
            focus:ring-2 focus:ring-primary-500 focus:border-primary-500
            disabled:bg-gray-100 disabled:cursor-not-allowed
            ${errors.license_number ? 'border-red-500' : 'border-gray-300'}`}
          aria-required="false"
          aria-invalid={errors.license_number ? 'true' : 'false'}
          aria-describedby={errors.license_number ? 'err-license' : undefined}
          placeholder="TX-12345"
        />
        {errors.license_number && (
          <p id="err-license" className="mt-1 text-sm text-red-600">
            {errors.license_number}
          </p>
        )}
      </div>

      {/* Submit */}
      <button
        type="submit"
        disabled={isDisabled()}
        aria-disabled={isDisabled()}
        className={`btn-primary touch-target w-full ${
          isDisabled() ? 'opacity-50 cursor-not-allowed' : ''
        }`}
      >
        {isSubmitting ? 'Please wait...' : 'Save profile'}
      </button>
    </form>
  );
}

export default ProfileForm;

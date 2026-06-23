/**
 * ListingsManager Component
 *
 * Client component that renders the agent's listings in a table with full
 * CRUD actions: Create, Edit, Delete (with confirm), Pause/Activate, and
 * Generate Video (async trigger + status polling).
 *
 * Actions are wired to the 04-02 CRUD API and 06-02 video API:
 *   GET    /api/agent/listings                    — refresh after any mutation
 *   DELETE /api/agent/listings/[id]               — delete with window.confirm guard
 *   PATCH  /api/agent/listings/[id]               — toggle status active ↔ paused
 *   POST/PUT via ListingForm                      — create and edit delegated to form
 *   POST   /api/agent/listings/[id]/video         — trigger async video generation
 *   GET    /api/agent/listings/[id]/video-status  — poll for video status
 *
 * Security (T-04-16 / T-06-09 mitigations):
 *   All mutations hit server routes which re-check ownership/publishability.
 *   The UI cannot bypass server-side auth gates.
 *
 * @module components/dashboard/ListingsManager
 */

'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { ListingForm } from '@/components/dashboard/ListingForm';

/** A single row outcome from POST /api/agent/listings/import */
interface ImportRowResult {
  row: number;
  success: boolean;
  id?: string;
  slug?: string;
  reason?: string;
}

/** Response shape from POST /api/agent/listings/import */
interface ImportResponse {
  success: boolean;
  imported?: number;
  failed?: number;
  results?: ImportRowResult[];
  message?: string;
}

/** A single listing row returned by GET /api/agent/listings */
export interface OwnListing {
  /** listings.id — UUID primary key */
  id: string;
  /** URL-friendly slug */
  slug: string;
  /** Listing title */
  title: string;
  /** Street address */
  address: string;
  /** Listing price in USD */
  price: number;
  /** Bedroom count */
  beds: number;
  /** Bathroom count */
  baths: number;
  /** Listing status */
  status: 'active' | 'paused';
  /** Unix timestamp (seconds) */
  created_at: number;
  /** Video generation status — optional, supplied by W1 SELECT fix */
  video_status?: 'none' | 'processing' | 'ready' | 'failed' | null;
  /** Generated video URL — optional, supplied by W1 SELECT fix */
  video_url?: string | null;
  /** Homepage featured flag (0/1) — admin-controlled */
  featured?: number;
}

/** Props for the ListingsManager component */
export interface ListingsManagerProps {
  /** The agent's own listings, loaded server-side and passed as initial state */
  initialListings: OwnListing[];
  /** When true, expose the admin-only Featured toggle in the listing form. */
  isAdmin?: boolean;
  /** Active-listing cap for the agent's tier (null = unlimited / admin). */
  maxListings?: number | null;
}

/** Per-listing video state tracked client-side during a polling session */
interface VideoRowState {
  /** Current video status for this listing */
  status: 'none' | 'processing' | 'ready' | 'failed';
  /** Video URL once ready */
  videoUrl?: string | null;
}

/** Response shape from GET /api/agent/listings/[id]/video-status */
interface VideoStatusResponse {
  status: 'none' | 'processing' | 'ready' | 'failed';
  videoUrl?: string | null;
}

/** Response shape from POST /api/agent/listings/[id]/video */
interface VideoTriggerResponse {
  jobId?: string;
  status?: string;
  message?: string;
}

/** Format a price number as USD currency string */
function formatPrice(price: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(price);
}

/** Polling interval in ms (4 000 ms — within the 3-5 s range) */
const POLL_INTERVAL_MS = 4000;

/** Hard cap: stop polling after 5 minutes to prevent unbounded loops (T-06-10) */
const POLL_MAX_MS = 5 * 60 * 1000;

/**
 * ListingsManager — dashboard listings table with create/edit/delete/pause/video actions.
 *
 * Fetches a fresh copy of listings after every mutation to keep the table
 * in sync with the server state.
 *
 * @param props.initialListings - Server-loaded listings; client refreshes after mutations
 * @returns {JSX.Element} Listings management table or empty state with Create CTA
 */
export function ListingsManager({
  initialListings,
  isAdmin = false,
  maxListings = null,
}: ListingsManagerProps): JSX.Element {
  const [listings, setListings] = useState<OwnListing[]>(initialListings);
  const [isLoading, setIsLoading] = useState(false);
  const [actionError, setActionError] = useState('');

  // Form modal state
  const [showForm, setShowForm] = useState(false);
  const [formMode, setFormMode] = useState<'create' | 'edit'>('create');
  const [editingListing, setEditingListing] = useState<OwnListing | null>(null);

  // CSV import state
  const [isImporting, setIsImporting] = useState(false);
  const [importResults, setImportResults] = useState<ImportRowResult[] | null>(null);
  const importFileRef = useRef<HTMLInputElement>(null);

  // Per-listing video state: listingId -> VideoRowState
  // Initialised from server-loaded video_status/video_url so persisted state
  // shows on page load (W1 fix — status survives page refresh).
  const [videoStates, setVideoStates] = useState<Record<string, VideoRowState>>(
    () => {
      const initial: Record<string, VideoRowState> = {};
      for (const l of initialListings) {
        if (l.video_status && l.video_status !== 'none') {
          initial[l.id] = {
            status: l.video_status,
            videoUrl: l.video_url ?? null,
          };
        }
      }
      return initial;
    }
  );

  // Active poll intervals keyed by listingId — cleared on terminal state or unmount
  const pollIntervalsRef = useRef<Record<string, ReturnType<typeof setInterval>>>({});
  // Poll start times to enforce POLL_MAX_MS cap
  const pollStartRef = useRef<Record<string, number>>({});

  /** Clear the polling interval for a given listing */
  const clearPoll = useCallback((listingId: string) => {
    const interval = pollIntervalsRef.current[listingId];
    if (interval !== undefined) {
      clearInterval(interval);
      delete pollIntervalsRef.current[listingId];
      delete pollStartRef.current[listingId];
    }
  }, []);

  /** Start polling /video-status for a listing */
  const startPolling = useCallback(
    (listingId: string) => {
      // Do not start a second interval if one is already active
      if (pollIntervalsRef.current[listingId] !== undefined) return;

      pollStartRef.current[listingId] = Date.now();

      const interval = setInterval(() => {
        // Enforce hard cap
        const elapsed = Date.now() - (pollStartRef.current[listingId] ?? 0);
        if (elapsed >= POLL_MAX_MS) {
          clearPoll(listingId);
          return;
        }

        void (async () => {
          try {
            const res = await fetch(
              `/api/agent/listings/${listingId}/video-status`
            );
            if (!res.ok) return; // transient error — keep polling

            const data = (await res.json()) as VideoStatusResponse;

            if (data.status === 'ready' || data.status === 'failed') {
              // Terminal state: update UI and stop polling
              setVideoStates((prev) => ({
                ...prev,
                [listingId]: {
                  status: data.status,
                  videoUrl: data.videoUrl ?? null,
                },
              }));
              clearPoll(listingId);
            } else if (data.status === 'processing') {
              // Still in progress — keep state as processing
              setVideoStates((prev) => ({
                ...prev,
                [listingId]: {
                  ...prev[listingId],
                  status: 'processing',
                },
              }));
            }
          } catch {
            // Network error — keep polling until cap
          }
        })();
      }, POLL_INTERVAL_MS);

      pollIntervalsRef.current[listingId] = interval;
    },
    [clearPoll]
  );

  // On mount: resume polling for any listings already in 'processing' state
  // (covers page-refresh scenario where D1 has processing jobs)
  useEffect(() => {
    for (const [listingId, vs] of Object.entries(videoStates)) {
      if (vs.status === 'processing') {
        startPolling(listingId);
      }
    }
    // Cleanup: clear all intervals on unmount (T-06-10).
    // Snapshot the ref so cleanup clears the same map instance (lint: ref-in-cleanup).
    const intervals = pollIntervalsRef.current;
    return () => {
      for (const listingId of Object.keys(intervals)) {
        clearPoll(listingId);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // intentionally empty — run once on mount only

  /**
   * Trigger video generation for a listing (VIDEO-01).
   * POSTs to /api/agent/listings/[id]/video; on 202 starts polling;
   * on 409 (in-flight) adopts the existing job and starts polling.
   * Never blocks longer than the fetch round-trip (<2s).
   */
  async function handleGenerateVideo(listing: OwnListing): Promise<void> {
    setActionError('');

    // Optimistic: mark as processing immediately so button disables
    setVideoStates((prev) => ({
      ...prev,
      [listing.id]: { status: 'processing', videoUrl: null },
    }));

    try {
      const res = await fetch(`/api/agent/listings/${listing.id}/video`, {
        method: 'POST',
      });

      if (res.status === 202) {
        // Accepted — start polling
        startPolling(listing.id);
        return;
      }

      if (res.status === 409) {
        // Duplicate: an active job already exists — adopt it and poll
        startPolling(listing.id);
        return;
      }

      // Other error: show banner and revert optimistic state
      const data = (await res.json()) as VideoTriggerResponse;
      setActionError(data.message ?? 'Failed to start video generation. Please try again.');
      setVideoStates((prev) => {
        const next = { ...prev };
        delete next[listing.id];
        return next;
      });
    } catch {
      setActionError('Network error. Please try again.');
      setVideoStates((prev) => {
        const next = { ...prev };
        delete next[listing.id];
        return next;
      });
    }
  }

  /** Re-fetch the agent's own listings from the server */
  const refreshListings = useCallback(async () => {
    setIsLoading(true);
    setActionError('');
    try {
      const res = await fetch('/api/agent/listings');
      if (!res.ok) {
        const data = (await res.json()) as { message?: string };
        setActionError(data.message ?? 'Failed to load listings.');
        return;
      }
      const data = (await res.json()) as { listings: OwnListing[] };
      setListings(data.listings);
      // Merge fresh video_status/video_url into videoStates for any listings
      // whose server state has updated since the last client session
      setVideoStates((prev) => {
        const next = { ...prev };
        for (const l of data.listings) {
          if (l.video_status && l.video_status !== 'none') {
            // Only update if we have no active client-side polling state
            if (!next[l.id]) {
              next[l.id] = {
                status: l.video_status,
                videoUrl: l.video_url ?? null,
              };
            }
          }
        }
        return next;
      });
    } catch {
      setActionError('Network error. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  /** Open the form in create mode */
  function handleCreate(): void {
    setEditingListing(null);
    setFormMode('create');
    setShowForm(true);
    setActionError('');
  }

  /** Open the form in edit mode, seeded with the selected listing */
  function handleEdit(listing: OwnListing): void {
    setEditingListing(listing);
    setFormMode('edit');
    setShowForm(true);
    setActionError('');
  }

  /** Close the form without action */
  function handleFormClose(): void {
    setShowForm(false);
    setEditingListing(null);
  }

  /** Called by ListingForm on successful create/edit — close form + refresh */
  function handleFormSuccess(): void {
    setShowForm(false);
    setEditingListing(null);
    void refreshListings();
  }

  /**
   * Delete a listing after window.confirm (T-04-16 accidental deletion guard).
   * Calls DELETE /api/agent/listings/[id]; ownership enforced server-side.
   */
  async function handleDelete(listing: OwnListing): Promise<void> {
    const confirmed = window.confirm(
      `Delete "${listing.title}"? This cannot be undone.`
    );
    if (!confirmed) return;

    setIsLoading(true);
    setActionError('');
    try {
      const res = await fetch(`/api/agent/listings/${listing.id}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const data = (await res.json()) as { message?: string };
        setActionError(data.message ?? 'Delete failed. Please try again.');
        return;
      }
      // WR-08: single source of truth — re-fetch from the server rather than
      // optimistically removing the row. This avoids the desync where a
      // successful DELETE followed by a failed refetch leaves the row removed
      // locally (or a stale refetch resurrects it). refreshListings surfaces
      // its own error banner if the re-fetch fails.
      await refreshListings();
    } catch {
      setActionError('Network error. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }

  /**
   * Toggle listing status active ↔ paused (LIST-05).
   * Calls PATCH /api/agent/listings/[id] { status }; ownership enforced server-side.
   */
  async function handleToggleStatus(listing: OwnListing): Promise<void> {
    const newStatus = listing.status === 'active' ? 'paused' : 'active';
    setIsLoading(true);
    setActionError('');
    try {
      const res = await fetch(`/api/agent/listings/${listing.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) {
        const data = (await res.json()) as { message?: string };
        setActionError(data.message ?? 'Status update failed. Please try again.');
        return;
      }
      // Optimistic update
      setListings((prev) =>
        prev.map((l) => (l.id === listing.id ? { ...l, status: newStatus } : l))
      );
    } catch {
      setActionError('Network error. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }

  /**
   * Handle CSV file selection and upload to /api/agent/listings/import.
   * Reads the chosen file, POSTs it as FormData, then shows per-row results
   * and refreshes the listings table on partial or full success.
   */
  async function handleImportCsv(
    e: React.ChangeEvent<HTMLInputElement>
  ): Promise<void> {
    const file = e.target.files?.[0];
    // Reset file input so the same file can be re-selected after a run
    if (importFileRef.current) importFileRef.current.value = '';
    if (!file) return;

    setIsImporting(true);
    setImportResults(null);
    setActionError('');

    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch('/api/agent/listings/import', {
        method: 'POST',
        body: formData,
      });

      const data = (await res.json()) as ImportResponse;

      if (!res.ok) {
        setActionError(data.message ?? 'Import failed. Please try again.');
        return;
      }

      setImportResults(data.results ?? []);

      // Refresh table if at least one row was imported
      if ((data.imported ?? 0) > 0) {
        await refreshListings();
      }
    } catch {
      setActionError('Network error during import. Please try again.');
    } finally {
      setIsImporting(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-serif text-2xl font-semibold leading-snug text-gray-900">
            Listings
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Manage your property listings
            {maxListings !== null && (
              <span className="ml-1 text-gray-400">
                · {listings.filter((l) => l.status === 'active').length} of {maxListings} active
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* Hidden file input for CSV import */}
          <input
            ref={importFileRef}
            type="file"
            accept=".csv"
            className="sr-only"
            aria-label="Choose CSV file to import"
            onChange={(e) => void handleImportCsv(e)}
          />
          <a
            href="/listing-template.csv"
            download="listing-template.csv"
            className="text-primary-600 hover:text-primary-800 font-medium text-sm transition-colors touch-target flex items-center"
            aria-label="Download CSV import template"
          >
            Download template
          </a>
          <button
            type="button"
            onClick={() => importFileRef.current?.click()}
            disabled={isImporting || isLoading}
            className="btn-accent touch-target"
            aria-label="Import listings from CSV file"
          >
            {isImporting ? 'Importing…' : 'Import CSV'}
          </button>
          <button
            type="button"
            onClick={handleCreate}
            disabled={isLoading}
            className="btn-primary touch-target"
          >
            + Create listing
          </button>
        </div>
      </div>

      {/* Action error banner */}
      {actionError && (
        <div
          className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-lg text-sm"
          role="alert"
          aria-live="assertive"
        >
          {actionError}
        </div>
      )}

      {/* CSV import results panel */}
      {importResults !== null && (
        <div className="card p-4 space-y-2" role="region" aria-label="CSV import results">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-sm text-gray-900">Import Results</h3>
            <button
              type="button"
              onClick={() => setImportResults(null)}
              className="text-xs text-gray-400 hover:text-gray-600 transition-colors touch-target"
              aria-label="Dismiss import results"
            >
              Dismiss
            </button>
          </div>
          <ul className="text-sm space-y-1 max-h-48 overflow-y-auto">
            {importResults.map((r) => (
              <li
                key={r.row}
                className={r.success ? 'text-green-700' : 'text-red-600'}
              >
                {r.success
                  ? `Row ${r.row}: imported (${r.slug ?? r.id})`
                  : `Row ${r.row}: failed — ${r.reason}`}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Loading indicator */}
      {isLoading && (
        <div className="text-sm text-gray-500" role="status" aria-live="polite">
          Updating...
        </div>
      )}

      {/* Empty state */}
      {listings.length === 0 && !isLoading && (
        <div className="card p-12 text-center">
          <svg
            className="w-12 h-12 text-gray-300 mx-auto mb-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
            />
          </svg>
          <h2 className="text-lg font-semibold text-gray-700 mb-2">
            No listings yet
          </h2>
          <p className="text-sm text-gray-500 mb-6">
            Create your first listing to start reaching Houston home buyers.
          </p>
          <button
            type="button"
            onClick={handleCreate}
            className="btn-primary touch-target"
          >
            Create your first listing
          </button>
        </div>
      )}

      {/* Listings table */}
      {listings.length > 0 && (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th
                    scope="col"
                    className="px-4 py-3 text-left font-semibold text-gray-700"
                  >
                    Title / Address
                  </th>
                  <th
                    scope="col"
                    className="px-4 py-3 text-right font-semibold text-gray-700"
                  >
                    Price
                  </th>
                  <th
                    scope="col"
                    className="px-4 py-3 text-center font-semibold text-gray-700"
                  >
                    Status
                  </th>
                  <th
                    scope="col"
                    className="px-4 py-3 text-center font-semibold text-gray-700"
                  >
                    Video
                  </th>
                  <th
                    scope="col"
                    className="px-4 py-3 text-right font-semibold text-gray-700"
                  >
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {listings.map((listing) => {
                  const vs = videoStates[listing.id];
                  const isProcessing = vs?.status === 'processing';
                  const isReady = vs?.status === 'ready';
                  const isFailed = vs?.status === 'failed';

                  return (
                    <tr key={listing.id} className="hover:bg-gray-50 transition-colors">
                      {/* Title + address */}
                      <td className="px-4 py-3">
                        <p className="font-medium text-gray-900 leading-snug">
                          {listing.title}
                          {listing.featured === 1 && (
                            <span className="ml-2 inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 align-middle text-[10px] font-semibold text-amber-700">
                              Featured
                            </span>
                          )}
                        </p>
                        <p className="text-xs text-gray-500 mt-0.5">
                          {listing.address}
                        </p>
                      </td>

                      {/* Price */}
                      <td className="px-4 py-3 text-right text-gray-700 font-medium tabular-nums">
                        {formatPrice(listing.price)}
                      </td>

                      {/* Status badge */}
                      <td className="px-4 py-3 text-center">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            listing.status === 'active'
                              ? 'bg-green-100 text-green-700'
                              : 'bg-yellow-100 text-yellow-700'
                          }`}
                        >
                          {listing.status === 'active' ? 'Active' : 'Paused'}
                        </span>
                      </td>

                      {/* Video status cell (VIDEO-02, VIDEO-03) */}
                      <td className="px-4 py-3 text-center">
                        <div
                          role="status"
                          aria-live="polite"
                          aria-label={`Video status for ${listing.title}`}
                          className="flex flex-col items-center gap-1"
                        >
                          {isProcessing && (
                            <span className="text-xs text-blue-600 font-medium">
                              Generating…
                            </span>
                          )}
                          {isFailed && (
                            <span className="text-xs text-red-600 font-medium">
                              Generation failed — retrying
                            </span>
                          )}
                          {isReady && vs?.videoUrl && (
                            <a
                              href={`/listings/${listing.slug}`}
                              className="text-xs text-green-600 font-medium hover:text-green-800 transition-colors"
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              View video
                            </a>
                          )}
                          {isReady && !vs?.videoUrl && (
                            <span className="text-xs text-green-600 font-medium">
                              Ready
                            </span>
                          )}
                          {!vs && (
                            <span className="text-xs text-gray-400">—</span>
                          )}
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-2">
                          {/* Edit */}
                          <button
                            type="button"
                            onClick={() => handleEdit(listing)}
                            disabled={isLoading}
                            className="text-primary-600 hover:text-primary-800 font-medium text-xs transition-colors touch-target disabled:opacity-50"
                            aria-label={`Edit ${listing.title}`}
                          >
                            Edit
                          </button>

                          {/* Pause / Activate */}
                          <button
                            type="button"
                            onClick={() => void handleToggleStatus(listing)}
                            disabled={isLoading}
                            className="text-gray-500 hover:text-gray-700 font-medium text-xs transition-colors touch-target disabled:opacity-50"
                            aria-label={
                              listing.status === 'active'
                                ? `Pause ${listing.title}`
                                : `Activate ${listing.title}`
                            }
                          >
                            {listing.status === 'active' ? 'Pause' : 'Activate'}
                          </button>

                          {/* Delete */}
                          <button
                            type="button"
                            onClick={() => void handleDelete(listing)}
                            disabled={isLoading}
                            className="text-red-500 hover:text-red-700 font-medium text-xs transition-colors touch-target disabled:opacity-50"
                            aria-label={`Delete ${listing.title}`}
                          >
                            Delete
                          </button>

                          {/* Generate Video (VIDEO-01) */}
                          <button
                            type="button"
                            onClick={() => void handleGenerateVideo(listing)}
                            disabled={isProcessing}
                            className="text-accent-600 hover:text-accent-800 font-medium text-xs transition-colors touch-target disabled:opacity-50"
                            aria-label={`Generate video for ${listing.title}`}
                          >
                            Generate Video
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ListingForm modal overlay */}
      {showForm && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 overflow-y-auto py-8"
          role="dialog"
          aria-modal="true"
          aria-labelledby="listing-form-title"
        >
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl mx-4 p-6">
            <div className="flex items-center justify-between mb-6">
              <h2
                id="listing-form-title"
                className="font-serif text-xl font-semibold text-gray-900"
              >
                {formMode === 'create' ? 'Create listing' : 'Edit listing'}
              </h2>
              <button
                type="button"
                onClick={handleFormClose}
                className="touch-target flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-600 transition-colors"
                aria-label="Close form"
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

            <ListingForm
              mode={formMode}
              existingListing={editingListing}
              onSuccess={handleFormSuccess}
              onCancel={handleFormClose}
              isAdmin={isAdmin}
            />
          </div>
        </div>
      )}
    </div>
  );
}

export default ListingsManager;

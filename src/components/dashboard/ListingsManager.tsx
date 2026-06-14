/**
 * ListingsManager Component
 *
 * Client component that renders the agent's listings in a table with full
 * CRUD actions: Create, Edit, Delete (with confirm), and Pause/Activate.
 *
 * Actions are wired to the 04-02 CRUD API:
 *   GET    /api/agent/listings        — refresh after any mutation
 *   DELETE /api/agent/listings/[id]   — delete with window.confirm guard
 *   PATCH  /api/agent/listings/[id]   — toggle status active ↔ paused
 *   POST/PUT via ListingForm          — create and edit delegated to form
 *
 * Security (T-04-16 mitigation):
 *   All mutations hit server routes which re-check ownership/publishability.
 *   The UI cannot bypass server-side auth gates.
 *
 * @module components/dashboard/ListingsManager
 */

'use client';

import { useState, useCallback } from 'react';
import { ListingForm } from '@/components/dashboard/ListingForm';

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
}

/** Props for the ListingsManager component */
export interface ListingsManagerProps {
  /** The agent's own listings, loaded server-side and passed as initial state */
  initialListings: OwnListing[];
}

/** Format a price number as USD currency string */
function formatPrice(price: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(price);
}

/**
 * ListingsManager — dashboard listings table with create/edit/delete/pause actions.
 *
 * Fetches a fresh copy of listings after every mutation to keep the table
 * in sync with the server state.
 *
 * @param props.initialListings - Server-loaded listings; client refreshes after mutations
 * @returns {JSX.Element} Listings management table or empty state with Create CTA
 */
export function ListingsManager({
  initialListings,
}: ListingsManagerProps): JSX.Element {
  const [listings, setListings] = useState<OwnListing[]>(initialListings);
  const [isLoading, setIsLoading] = useState(false);
  const [actionError, setActionError] = useState('');

  // Form modal state
  const [showForm, setShowForm] = useState(false);
  const [formMode, setFormMode] = useState<'create' | 'edit'>('create');
  const [editingListing, setEditingListing] = useState<OwnListing | null>(null);

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
      // Optimistic update — remove from local state, then confirm with server
      setListings((prev) => prev.filter((l) => l.id !== listing.id));
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
          </p>
        </div>
        <button
          type="button"
          onClick={handleCreate}
          disabled={isLoading}
          className="btn-primary touch-target"
        >
          + Create listing
        </button>
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
                    className="px-4 py-3 text-right font-semibold text-gray-700"
                  >
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {listings.map((listing) => (
                  <tr key={listing.id} className="hover:bg-gray-50 transition-colors">
                    {/* Title + address */}
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-900 leading-snug">
                        {listing.title}
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
                      </div>
                    </td>
                  </tr>
                ))}
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
            />
          </div>
        </div>
      )}
    </div>
  );
}

export default ListingsManager;

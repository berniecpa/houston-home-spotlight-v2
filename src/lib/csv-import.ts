/**
 * CSV import library — dependency-free parser and per-row listing validator.
 *
 * Provides a hand-rolled RFC-4180-compliant parser and a validateListingRow
 * function that maps raw CSV string records to typed listing fields, applying
 * all schema constraints before any data reaches the database.
 *
 * Security (T-IMP-04 mitigation):
 *   - validateListingRow rejects unsafe image URLs via isSafeHttpUrl before
 *     any URL leaves this module.
 *
 * @module lib/csv-import
 */

import { isSafeHttpUrl } from '@/lib/listings-db';
import type { ListingWriteFields } from '@/lib/listings-db';

/**
 * Listing write fields produced by validateListingRow (slug is excluded —
 * the route derives the slug from title + address after validation).
 */
export type CsvListingFields = Omit<ListingWriteFields, 'slug'>;

/**
 * Discriminated union returned by validateListingRow.
 *
 * ok:true  — row is valid; `fields` contains the typed listing metadata,
 *            `imageUrls` is the ordered URL array, `featured` is 0 or 1.
 * ok:false — row is invalid; `reason` is a human-readable explanation
 *            naming the offending field (e.g. "price not numeric").
 */
export type CsvRowResult =
  | {
      ok: true;
      /** Validated, typed listing fields (slug excluded) */
      fields: CsvListingFields;
      /** Ordered, validated image URL array (may be empty — route enforces minimum) */
      imageUrls: string[];
      /** 0 or 1 — derived from the CSV featured cell */
      featured: 0 | 1;
    }
  | {
      ok: false;
      /** Human-readable failure reason naming the offending field */
      reason: string;
    };

// ---------------------------------------------------------------------------
// parseCsv
// ---------------------------------------------------------------------------

/**
 * Parse RFC-4180-style CSV text into an array of string records.
 *
 * Rules:
 *   - First non-empty line is the header; subsequent non-empty lines are data.
 *   - Header names are lower-cased and trimmed so callers do not need to
 *     worry about leading/trailing whitespace or capitalisation differences.
 *   - Fields may be optionally quoted with double-quotes.
 *   - Quoted fields may contain commas and CRLF without splitting.
 *   - Two consecutive double-quotes inside a quoted field represent a single
 *     literal double-quote (RFC-4180 §2.7).
 *   - Fully empty lines (after trimming) are silently skipped.
 *   - CRLF and LF line endings are both accepted.
 *
 * @param text - Raw CSV string (UTF-8, CRLF or LF line endings)
 * @returns    Array of records keyed by lower-cased trimmed header names
 */
export function parseCsv(text: string): Record<string, string>[] {
  // Split into lines, normalising CRLF → LF first
  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');

  // Collect non-empty lines
  const nonEmpty = lines.filter((l) => l.trim().length > 0);
  if (nonEmpty.length === 0) return [];

  const headers = parseFields(nonEmpty[0]).map((h) => h.toLowerCase().trim());
  const rows: Record<string, string>[] = [];

  for (let i = 1; i < nonEmpty.length; i++) {
    const fields = parseFields(nonEmpty[i]);
    const record: Record<string, string> = {};
    for (let j = 0; j < headers.length; j++) {
      record[headers[j]] = fields[j] ?? '';
    }
    rows.push(record);
  }

  return rows;
}

/**
 * Parse a single CSV line into an array of field values.
 *
 * Handles:
 *   - Unquoted fields (split on comma, trimmed)
 *   - Quoted fields (content between double-quotes, commas preserved)
 *   - Escaped double-quotes ("" → ") inside quoted fields
 *
 * @param line - A single CSV line (must NOT contain unescaped CRLF)
 * @returns    Ordered array of string values
 */
function parseFields(line: string): string[] {
  const fields: string[] = [];
  let i = 0;
  const len = line.length;

  while (i <= len) {
    if (i === len) {
      // End of line — push empty trailing field if line ends with comma
      if (fields.length > 0 && line[len - 1] === ',') {
        fields.push('');
      }
      break;
    }

    if (line[i] === '"') {
      // Quoted field
      i++; // skip opening quote
      let value = '';
      while (i < len) {
        if (line[i] === '"') {
          if (i + 1 < len && line[i + 1] === '"') {
            // Escaped double-quote
            value += '"';
            i += 2;
          } else {
            // Closing quote
            i++;
            break;
          }
        } else {
          value += line[i];
          i++;
        }
      }
      fields.push(value);
      // Skip comma separator (if any)
      if (i < len && line[i] === ',') i++;
    } else {
      // Unquoted field — read until next comma
      const commaIdx = line.indexOf(',', i);
      if (commaIdx === -1) {
        fields.push(line.slice(i));
        break;
      } else {
        fields.push(line.slice(i, commaIdx));
        i = commaIdx + 1;
        // Handle trailing comma: loop will push empty field on next iteration
      }
    }
  }

  return fields;
}

// ---------------------------------------------------------------------------
// validateListingRow
// ---------------------------------------------------------------------------

/**
 * Validate and normalise a single CSV record into typed listing fields.
 *
 * Column mapping (all header names lower-cased):
 *   title        — required, non-empty string
 *   address      — required, non-empty string
 *   price        — required, integer USD ≥ 1
 *   beds         — required, non-negative integer
 *   baths        — required, non-negative decimal
 *   sqft         — optional, positive integer
 *   city         — optional, defaults to 'Houston'
 *   state        — optional, defaults to 'TX'
 *   zip          — optional string
 *   description  — optional string
 *   featured     — optional boolean-ish: "1"/"0"/"true"/"false" (case-insensitive),
 *                  anything else is an error; missing defaults to 0
 *   images       — optional; comma-separated http(s) URLs; any unsafe URL fails the row;
 *                  empty cell → [] (route enforces the "at least one" rule)
 *
 * Security (T-IMP-01): agent_id, slug, and status are NEVER read from the record.
 * Security (T-IMP-04): each image URL is validated via isSafeHttpUrl.
 *
 * Validation stops at the FIRST error so callers can report "row N: reason".
 *
 * @param record - A raw CSV row keyed by lower-cased header names
 * @returns      CsvRowResult — ok:true with typed fields, or ok:false with reason
 */
export function validateListingRow(record: Record<string, string>): CsvRowResult {
  // --- Required string fields ---
  const title = (record['title'] ?? '').trim();
  if (!title) return { ok: false, reason: 'title is required' };

  const address = (record['address'] ?? '').trim();
  if (!address) return { ok: false, reason: 'address is required' };

  // --- Required numeric fields ---
  const priceRaw = (record['price'] ?? '').trim();
  if (!priceRaw) return { ok: false, reason: 'price is required' };
  const price = Number(priceRaw);
  if (!Number.isFinite(price) || isNaN(price)) {
    return { ok: false, reason: 'price not numeric' };
  }

  const bedsRaw = (record['beds'] ?? '').trim();
  if (!bedsRaw) return { ok: false, reason: 'beds is required' };
  const beds = Number(bedsRaw);
  if (!Number.isFinite(beds) || isNaN(beds)) {
    return { ok: false, reason: 'beds not numeric' };
  }

  const bathsRaw = (record['baths'] ?? '').trim();
  if (!bathsRaw) return { ok: false, reason: 'baths is required' };
  const baths = Number(bathsRaw);
  if (!Number.isFinite(baths) || isNaN(baths)) {
    return { ok: false, reason: 'baths not numeric' };
  }

  // --- Optional numeric: sqft ---
  let sqft: number | null = null;
  const sqftRaw = (record['sqft'] ?? '').trim();
  if (sqftRaw) {
    const sqftVal = Number(sqftRaw);
    if (!Number.isFinite(sqftVal) || isNaN(sqftVal)) {
      return { ok: false, reason: 'sqft not numeric' };
    }
    sqft = sqftVal > 0 ? sqftVal : null;
  }

  // --- Optional string fields with defaults ---
  const city = (record['city'] ?? '').trim() || 'Houston';
  const state = (record['state'] ?? '').trim() || 'TX';
  const zip = (record['zip'] ?? '').trim() || null;
  const description = (record['description'] ?? '').trim() || null;

  // --- Featured: boolean-ish field ---
  let featured: 0 | 1 = 0;
  const featuredRaw = (record['featured'] ?? '').trim();
  if (featuredRaw !== '') {
    const lower = featuredRaw.toLowerCase();
    if (lower === '1' || lower === 'true') {
      featured = 1;
    } else if (lower === '0' || lower === 'false') {
      featured = 0;
    } else {
      return {
        ok: false,
        reason: `featured must be 1/0/true/false, got "${featuredRaw}"`,
      };
    }
  }

  // --- Images: comma-separated URLs ---
  const imagesRaw = (record['images'] ?? '').trim();
  let imageUrls: string[] = [];
  if (imagesRaw) {
    const parts = imagesRaw.split(',').map((u) => u.trim()).filter(Boolean);
    for (const url of parts) {
      if (!isSafeHttpUrl(url)) {
        return {
          ok: false,
          reason: `images contains an unsafe URL: "${url}"`,
        };
      }
    }
    imageUrls = parts;
  }

  // --- Assemble typed fields (slug excluded — route derives it) ---
  const fields: CsvListingFields = {
    title,
    address,
    city,
    state,
    zip,
    price,
    beds,
    baths,
    sqft,
    description,
  };

  return { ok: true, fields, imageUrls, featured };
}

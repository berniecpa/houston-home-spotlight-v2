/**
 * CSV import lib — unit tests for parseCsv, validateListingRow, makeUniqueSlug.
 *
 * All tests are pure unit tests: no live D1, no network, no filesystem (other
 * than importing the modules under test). Tests use node:test + node:assert/strict
 * matching the project's existing test style.
 *
 * @module tests/csv-import
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { parseCsv, validateListingRow } from '../lib/csv-import.js';
import { makeUniqueSlug } from '../lib/listings-db.js';

// ---------------------------------------------------------------------------
// parseCsv
// ---------------------------------------------------------------------------

describe('parseCsv — basic parsing', () => {
  it('parses header + 2 data rows into array of record objects', () => {
    const csv = 'title,address,price\nHome A,123 Main St,350000\nHome B,456 Oak Ave,420000';
    const rows = parseCsv(csv);
    assert.equal(rows.length, 2);
    assert.equal(rows[0]['title'], 'Home A');
    assert.equal(rows[0]['address'], '123 Main St');
    assert.equal(rows[0]['price'], '350000');
    assert.equal(rows[1]['title'], 'Home B');
  });

  it('handles quoted fields containing commas as a single value', () => {
    const csv = 'title,address,city\nNice House,"1234 Main, Ste 2","Houston, TX"';
    const rows = parseCsv(csv);
    assert.equal(rows.length, 1);
    assert.equal(rows[0]['address'], '1234 Main, Ste 2');
    assert.equal(rows[0]['city'], 'Houston, TX');
  });

  it('handles quoted fields containing escaped double-quotes ("" -> ")', () => {
    const csv = 'title,description\n"The ""Best"" Home","Has ""great"" views"';
    const rows = parseCsv(csv);
    assert.equal(rows.length, 1);
    assert.equal(rows[0]['title'], 'The "Best" Home');
    assert.equal(rows[0]['description'], 'Has "great" views');
  });

  it('trims a trailing blank line and ignores fully-empty lines', () => {
    const csv = 'title,address,price\nHome A,123 Main St,350000\n\n';
    const rows = parseCsv(csv);
    assert.equal(rows.length, 1);
    assert.equal(rows[0]['title'], 'Home A');
  });

  it('header names are lowercased and trimmed', () => {
    const csv = 'Title , Address , Price\nMy Home,100 St,500000';
    const rows = parseCsv(csv);
    assert.equal(rows.length, 1);
    assert.ok('title' in rows[0]);
    assert.ok('address' in rows[0]);
    assert.ok('price' in rows[0]);
  });

  it('handles CRLF line endings', () => {
    const csv = 'title,address,price\r\nHome A,123 Main,350000\r\n';
    const rows = parseCsv(csv);
    assert.equal(rows.length, 1);
    assert.equal(rows[0]['title'], 'Home A');
  });
});

// ---------------------------------------------------------------------------
// validateListingRow
// ---------------------------------------------------------------------------

describe('validateListingRow — valid row', () => {
  const validRecord = {
    title: 'Cozy Bungalow',
    address: '100 Oak St',
    price: '350000',
    beds: '3',
    baths: '2',
    images: 'https://example.com/photo1.jpg,https://example.com/photo2.jpg',
    featured: '0',
  };

  it('valid row returns ok:true with city default Houston, state default TX', () => {
    const result = validateListingRow(validRecord);
    assert.ok(result.ok, `Expected ok:true, got: ${JSON.stringify(result)}`);
    if (result.ok) {
      assert.equal(result.fields.city, 'Houston');
      assert.equal(result.fields.state, 'TX');
    }
  });

  it('valid row returns imageUrls array', () => {
    const result = validateListingRow(validRecord);
    assert.ok(result.ok);
    if (result.ok) {
      assert.equal(result.imageUrls.length, 2);
      assert.equal(result.imageUrls[0], 'https://example.com/photo1.jpg');
    }
  });

  it('valid row with explicit city/state uses them', () => {
    const result = validateListingRow({ ...validRecord, city: 'Katy', state: 'TX' });
    assert.ok(result.ok);
    if (result.ok) {
      assert.equal(result.fields.city, 'Katy');
    }
  });

  it('empty images cell returns imageUrls: [] (allowed at lib layer)', () => {
    const result = validateListingRow({ ...validRecord, images: '' });
    assert.ok(result.ok);
    if (result.ok) {
      assert.equal(result.imageUrls.length, 0);
    }
  });
});

describe('validateListingRow — required field failures', () => {
  const base = {
    title: 'Good House',
    address: '100 Oak St',
    price: '350000',
    beds: '3',
    baths: '2',
    images: '',
  };

  it('missing title -> ok:false with reason mentioning "title"', () => {
    const result = validateListingRow({ ...base, title: '' });
    assert.ok(!result.ok);
    if (!result.ok) {
      assert.ok(result.reason.toLowerCase().includes('title'), `Reason: ${result.reason}`);
    }
  });

  it('missing address -> ok:false with reason mentioning "address"', () => {
    const result = validateListingRow({ ...base, address: '' });
    assert.ok(!result.ok);
    if (!result.ok) {
      assert.ok(result.reason.toLowerCase().includes('address'), `Reason: ${result.reason}`);
    }
  });

  it('missing price -> ok:false with reason mentioning "price"', () => {
    const result = validateListingRow({ ...base, price: '' });
    assert.ok(!result.ok);
    if (!result.ok) {
      assert.ok(result.reason.toLowerCase().includes('price'), `Reason: ${result.reason}`);
    }
  });

  it('missing beds -> ok:false with reason mentioning "beds"', () => {
    const result = validateListingRow({ ...base, beds: '' });
    assert.ok(!result.ok);
    if (!result.ok) {
      assert.ok(result.reason.toLowerCase().includes('beds'), `Reason: ${result.reason}`);
    }
  });

  it('missing baths -> ok:false with reason mentioning "baths"', () => {
    const result = validateListingRow({ ...base, baths: '' });
    assert.ok(!result.ok);
    if (!result.ok) {
      assert.ok(result.reason.toLowerCase().includes('baths'), `Reason: ${result.reason}`);
    }
  });
});

describe('validateListingRow — numeric validation', () => {
  const base = {
    title: 'Good House',
    address: '100 Oak St',
    price: '350000',
    beds: '3',
    baths: '2',
    images: '',
  };

  it('non-numeric price -> ok:false with reason naming "price"', () => {
    const result = validateListingRow({ ...base, price: 'abc' });
    assert.ok(!result.ok);
    if (!result.ok) {
      assert.ok(result.reason.toLowerCase().includes('price'), `Reason: ${result.reason}`);
    }
  });

  it('non-numeric beds -> ok:false with reason naming "beds"', () => {
    const result = validateListingRow({ ...base, beds: 'three' });
    assert.ok(!result.ok);
    if (!result.ok) {
      assert.ok(result.reason.toLowerCase().includes('beds'), `Reason: ${result.reason}`);
    }
  });

  it('non-numeric baths -> ok:false with reason naming "baths"', () => {
    const result = validateListingRow({ ...base, baths: 'two' });
    assert.ok(!result.ok);
    if (!result.ok) {
      assert.ok(result.reason.toLowerCase().includes('baths'), `Reason: ${result.reason}`);
    }
  });

  it('non-numeric sqft -> ok:false with reason naming "sqft"', () => {
    const result = validateListingRow({ ...base, sqft: 'big' });
    assert.ok(!result.ok);
    if (!result.ok) {
      assert.ok(result.reason.toLowerCase().includes('sqft'), `Reason: ${result.reason}`);
    }
  });
});

describe('validateListingRow — featured field', () => {
  const base = {
    title: 'Good House',
    address: '100 Oak St',
    price: '350000',
    beds: '3',
    baths: '2',
    images: '',
  };

  it('featured "1" -> featured: 1', () => {
    const result = validateListingRow({ ...base, featured: '1' });
    assert.ok(result.ok);
    if (result.ok) assert.equal(result.featured, 1);
  });

  it('featured "0" -> featured: 0', () => {
    const result = validateListingRow({ ...base, featured: '0' });
    assert.ok(result.ok);
    if (result.ok) assert.equal(result.featured, 0);
  });

  it('featured "true" (case-insensitive) -> featured: 1', () => {
    const result = validateListingRow({ ...base, featured: 'TRUE' });
    assert.ok(result.ok);
    if (result.ok) assert.equal(result.featured, 1);
  });

  it('featured "false" (case-insensitive) -> featured: 0', () => {
    const result = validateListingRow({ ...base, featured: 'False' });
    assert.ok(result.ok);
    if (result.ok) assert.equal(result.featured, 0);
  });

  it('invalid featured value -> ok:false with reason mentioning "featured"', () => {
    const result = validateListingRow({ ...base, featured: 'yes' });
    assert.ok(!result.ok);
    if (!result.ok) {
      assert.ok(result.reason.toLowerCase().includes('featured'), `Reason: ${result.reason}`);
    }
  });

  it('missing featured field -> defaults to 0', () => {
    const result = validateListingRow(base);
    assert.ok(result.ok);
    if (result.ok) assert.equal(result.featured, 0);
  });
});

describe('validateListingRow — image URL validation', () => {
  const base = {
    title: 'Good House',
    address: '100 Oak St',
    price: '350000',
    beds: '3',
    baths: '2',
  };

  it('comma-separated image URLs split into ordered array', () => {
    const result = validateListingRow({
      ...base,
      images: 'https://a.com/1.jpg, https://b.com/2.jpg , https://c.com/3.jpg',
    });
    assert.ok(result.ok);
    if (result.ok) {
      assert.equal(result.imageUrls.length, 3);
      assert.equal(result.imageUrls[0], 'https://a.com/1.jpg');
      assert.equal(result.imageUrls[1], 'https://b.com/2.jpg');
      assert.equal(result.imageUrls[2], 'https://c.com/3.jpg');
    }
  });

  it('unsafe javascript: URL -> ok:false with reason mentioning "images"', () => {
    const result = validateListingRow({
      ...base,
      images: 'javascript:alert(1)',
    });
    assert.ok(!result.ok);
    if (!result.ok) {
      assert.ok(result.reason.toLowerCase().includes('images'), `Reason: ${result.reason}`);
    }
  });

  it('data: URL -> ok:false with reason mentioning "images"', () => {
    const result = validateListingRow({
      ...base,
      images: 'data:image/png;base64,abc',
    });
    assert.ok(!result.ok);
    if (!result.ok) {
      assert.ok(result.reason.toLowerCase().includes('images'), `Reason: ${result.reason}`);
    }
  });
});

// ---------------------------------------------------------------------------
// makeUniqueSlug
// ---------------------------------------------------------------------------

describe('makeUniqueSlug', () => {
  it('returns the base slug unchanged when not in taken set', () => {
    const taken = new Set(['other-slug']);
    const result = makeUniqueSlug('my-house-100-oak-st', taken);
    assert.equal(result, 'my-house-100-oak-st');
  });

  it('returns a suffixed slug when base is already in taken set', () => {
    const taken = new Set(['my-house-100-oak-st']);
    const result = makeUniqueSlug('my-house-100-oak-st', taken);
    assert.notEqual(result, 'my-house-100-oak-st');
    assert.ok(!taken.has(result), `Returned value must not be in taken set, got: ${result}`);
  });

  it('returned suffixed slug is not in the taken set', () => {
    const taken = new Set(['my-slug', 'my-slug-1', 'my-slug-2']);
    const result = makeUniqueSlug('my-slug', taken);
    assert.ok(!taken.has(result), `Result "${result}" must not be in taken set`);
    assert.ok(result.startsWith('my-slug-'), `Result "${result}" must start with base`);
  });
});

# Testing Patterns

**Analysis Date:** 2026-06-10

## Test Framework

**Runner:**
- Node.js built-in test runner (`node:test`) — no Jest or Vitest
- No separate test config file (no `jest.config.*`, no `vitest.config.*`)
- Run command: `npm test` → `node --test`

**Assertion Library:**
- `node:assert` (built-in) — `assert.ok(...)`, `assert.strictEqual(...)`
- Some files use `import { strict as assert } from 'node:assert'` alias

**Run Commands:**
```bash
npm test           # Run all tests (node --test)
npm run typecheck  # TypeScript check only (tsc --noEmit)
npm run lint       # ESLint check
```

## Test File Organization

**Location:** All test files are centralized in `src/tests/` — NOT co-located with source files.

**Naming:** `[feature-or-component].test.ts` — lowercase kebab-case, always `.ts` (not `.tsx`)

**All test files:**
- `src/tests/seo.test.ts`
- `src/tests/listings-page.test.ts`
- `src/tests/filter-components.test.ts`
- `src/tests/listing-detail-page.test.ts`
- `src/tests/listing-card.test.ts`
- `src/tests/photo-gallery.test.ts`
- `src/tests/responsive-design.test.ts`
- `src/tests/data.test.ts`
- `src/tests/types.test.ts`
- `src/tests/inquiry-form.test.ts`
- `src/tests/listings.test.ts`
- `src/tests/cloudflare-deployment.test.ts`
- `src/tests/tailwind-config.test.ts`
- `src/tests/leads-api.test.ts`
- `src/tests/project-setup.test.ts`
- `src/tests/layout.test.ts`
- `src/tests/contact.test.ts`
- `src/tests/home-page.test.ts`
- `src/tests/integration.test.ts`

## Test Structure

**Suite Organization:**
```typescript
import { describe, it } from "node:test";
import assert from "node:assert";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const COMPONENT_PATH = join(process.cwd(), "src/components/ListingCard.tsx");

describe("ListingCard Component", () => {
  describe("File Structure", () => {
    it("should have ListingCard.tsx in src/components/", () => {
      assert.strictEqual(existsSync(COMPONENT_PATH), true, "ListingCard.tsx should exist");
    });
  });

  describe("Props Interface", () => {
    it("should define ListingCardProps interface", () => {
      const content = readFileSync(COMPONENT_PATH, "utf-8");
      assert.ok(
        content.includes("interface ListingCardProps"),
        "Should define ListingCardProps interface"
      );
    });
  });
});
```

**Patterns:**
- No setup/teardown hooks (`beforeEach`, `afterEach`) — not needed for static analysis tests
- Nested `describe` blocks group assertions by concern
- Each `it` block tests one specific assertion
- All assertions include a descriptive failure message as the last argument

## Testing Approach: Static File Analysis

**Critical pattern:** Tests do NOT render or execute components. They read source files as raw text strings and assert on presence of specific code patterns using `readFileSync`.

```typescript
const COMPONENT_PATH = join(process.cwd(), "src/components/ListingCard.tsx");

it("should export ListingCard function", () => {
  const content = readFileSync(COMPONENT_PATH, "utf-8");
  assert.ok(
    content.includes("export function ListingCard"),
    "Should export ListingCard function"
  );
});
```

Tests verify:
- File existence — `existsSync(path)`
- Named exports — `content.includes("export function X")`
- Specific imports — `content.includes('import Link from "next/link"')`
- Tailwind classes — `content.includes("hover:shadow-xl")`
- TypeScript type annotations — `content.match(/listing\s*:\s*Listing/)`
- Environment variable usage — `content.includes('process.env.PERFEX_RE_URL')`
- Response shapes — `content.includes('success: true')`

**Integration tests** (`src/tests/integration.test.ts`) go further: they verify the built `dist/` directory, asserting that HTML output files exist and contain valid HTML after `npm run build`.

## Mocking

No mocking framework detected. Tests avoid the need for mocks by asserting on source code text rather than executing component or API logic.

## Type Tests

Type correctness is verified by constructing typed objects inline in test files:
```typescript
import type { Listing } from '../types/index.js';

it('should accept a complete valid listing object', () => {
  const listing: Listing = {
    id: '123',
    slug: '123-main-st-houston',
    address: '123 Main St',
    // ... all required fields
  };
  // TypeScript compilation IS the assertion — if types are wrong, tsc fails
});
```
`src/tests/types.test.ts` covers all exported interfaces this way.

## Coverage

**Requirements:** None enforced — no coverage thresholds configured.

**Coverage tooling:** Not configured. `node --test` does not produce coverage reports in this setup.

## Test Categories

**Component structure tests** (`src/tests/listing-card.test.ts`, `src/tests/photo-gallery.test.ts`, etc.):
- Verify file exists, exports present, props interface defined, imports correct, JSX patterns present, Tailwind classes used, accessibility attributes

**API route tests** (`src/tests/leads-api.test.ts`):
- Verify handler exports, env var usage, request body parsing, field mapping, validation logic, response shape

**Type definition tests** (`src/tests/types.test.ts`):
- Verify TypeScript interfaces accept valid objects (compile-time checking via `tsc --noEmit`)

**Integration/build tests** (`src/tests/integration.test.ts`):
- Verify `dist/` output contains expected HTML files after build

**Infrastructure/config tests** (`src/tests/cloudflare-deployment.test.ts`, `src/tests/tailwind-config.test.ts`, `src/tests/project-setup.test.ts`):
- Verify config files exist and contain required settings

## Adding New Tests

**New component test:**
1. Create `src/tests/[component-name].test.ts`
2. Imports: `describe`, `it` from `"node:test"`; `assert` from `"node:assert"`; `readFileSync`, `existsSync` from `"node:fs"`; `join` from `"node:path"`
3. Define path constant: `const COMPONENT_PATH = join(process.cwd(), "src/components/ComponentName.tsx")`
4. Group assertions in nested `describe` blocks: File Structure, Imports, Props Interface, Display Elements, Accessibility
5. Use `readFileSync(COMPONENT_PATH, "utf-8")` and `content.includes(...)` for all assertions

**New API route test:**
1. Create `src/tests/[route-name]-api.test.ts`
2. Define: `const ROUTE_PATH = join(process.cwd(), "src/app/api/[route]/route.ts")`
3. Test groups: File Structure, Imports, Environment Variables, Request Body Parsing, Validation, Success Response, Error Response

---

*Testing analysis: 2026-06-10*

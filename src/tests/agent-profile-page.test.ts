/**
 * Agent Profile Page Tests — Plan 05-02, Task 2
 *
 * Source-grep assertions verifying the public /agents/[slug] page and
 * AgentProfileHeader component meet their structural requirements:
 *
 *   page.tsx:
 *   - Exports `dynamic = 'force-dynamic'`
 *   - Does NOT export `runtime = 'edge'` (pages are force-dynamic only)
 *   - Calls getAgentProfileBySlug to resolve the agent
 *   - Calls notFound() for unknown/suspended agents
 *   - Maps ListingCard for the listings grid
 *   - Shows an empty-state when no listings
 *   - Awaits params for the slug (Next.js 15 async params)
 *   - No email or phone rendered (PII safety)
 *
 *   AgentProfileHeader.tsx:
 *   - AgentProfileHeaderProps interface omits email and phone
 *   - Interface includes display_name, photo_url, brokerage, license_number
 *   - Is a pure server component (no 'use client')
 *   - Uses next/image for the photo
 *   - References brokerage
 *
 * Threat model coverage:
 *   - T-05-06: Profile page leaks agent email/phone (mitigated)
 *   - T-05-07: Suspended agent profile still reachable (mitigated — notFound())
 *
 * @module tests/agent-profile-page
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const pagePath   = join(root, 'src/app/agents/[slug]/page.tsx');
const headerPath = join(root, 'src/components/AgentProfileHeader.tsx');

const page   = readFileSync(pagePath, 'utf-8');
const header = readFileSync(headerPath, 'utf-8');

// ---------------------------------------------------------------------------
// page.tsx — rendering mode
// ---------------------------------------------------------------------------
describe("agents/[slug]/page.tsx — rendering mode (autonomous directive)", () => {
  it("exports dynamic = 'force-dynamic'", () => {
    assert.ok(
      page.includes("export const dynamic = 'force-dynamic'"),
      "page.tsx must export dynamic = 'force-dynamic' — required for D1 reads at request time"
    );
  });

  it("does NOT export runtime = 'edge'", () => {
    assert.ok(
      !page.includes("runtime = 'edge'") && !page.includes('runtime = "edge"'),
      "page.tsx must NOT export runtime = 'edge' — pages use force-dynamic only; edge runtime is reserved for API routes"
    );
  });
});

// ---------------------------------------------------------------------------
// page.tsx — data access
// ---------------------------------------------------------------------------
describe("agents/[slug]/page.tsx — data access (T-05-07)", () => {
  it("imports getAgentProfileBySlug from @/lib/data", () => {
    assert.ok(
      page.includes("getAgentProfileBySlug") &&
      page.includes("@/lib/data"),
      "page.tsx must import getAgentProfileBySlug from @/lib/data"
    );
  });

  it("calls getAgentProfileBySlug to resolve the agent", () => {
    assert.ok(
      page.includes("getAgentProfileBySlug(slug)") ||
      page.includes("await getAgentProfileBySlug"),
      "page.tsx must call getAgentProfileBySlug with the slug parameter"
    );
  });

  it("awaits params for the slug (Next.js 15 async params)", () => {
    assert.ok(
      page.includes("await params") && page.includes("slug"),
      "page.tsx must await params and destructure slug (Next.js 15 async params pattern)"
    );
  });
});

// ---------------------------------------------------------------------------
// page.tsx — 404 / suspension handling
// ---------------------------------------------------------------------------
describe("agents/[slug]/page.tsx — 404 handling (T-05-07)", () => {
  it("imports notFound from next/navigation", () => {
    assert.ok(
      page.includes("notFound") && page.includes("next/navigation"),
      "page.tsx must import notFound from next/navigation"
    );
  });

  it("calls notFound() when profile is null (unknown or suspended agent)", () => {
    assert.ok(
      page.includes("notFound()"),
      "page.tsx must call notFound() when getAgentProfileBySlug returns null (T-05-07)"
    );
  });
});

// ---------------------------------------------------------------------------
// page.tsx — listing grid and empty state
// ---------------------------------------------------------------------------
describe("agents/[slug]/page.tsx — listings grid and empty state", () => {
  it("imports ListingCard from @/components/ListingCard", () => {
    assert.ok(
      page.includes("ListingCard") && page.includes("@/components/ListingCard"),
      "page.tsx must import ListingCard to render the agent's listings grid"
    );
  });

  it("maps profile.listings to ListingCard components", () => {
    assert.ok(
      page.includes("profile.listings") && page.includes("ListingCard"),
      "page.tsx must map profile.listings and render a ListingCard for each"
    );
  });

  it("shows an empty-state message when listings is empty", () => {
    assert.ok(
      page.includes("no active listings") || page.includes("No active listings"),
      "page.tsx must show an empty-state message when the agent has no visible listings"
    );
  });
});

// ---------------------------------------------------------------------------
// page.tsx — PII safety
// ---------------------------------------------------------------------------
describe("agents/[slug]/page.tsx — PII safety (T-05-06)", () => {
  it("does not render email anywhere on the page", () => {
    // Strip comments then check for .email usage
    const stripped = page.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
    assert.ok(
      !stripped.includes('profile.email') && !stripped.includes('{profile.email}'),
      "page.tsx must never render email — PII must not appear on the public profile (T-05-06)"
    );
  });

  it("does not render phone anywhere on the page", () => {
    assert.ok(
      !page.includes("profile.phone") && !page.includes("phonenumber"),
      "page.tsx must never render phone — PII must not appear on the public profile (T-05-06)"
    );
  });
});

// ---------------------------------------------------------------------------
// page.tsx — AgentProfileHeader usage
// ---------------------------------------------------------------------------
describe("agents/[slug]/page.tsx — AgentProfileHeader usage", () => {
  it("imports AgentProfileHeader from @/components/AgentProfileHeader", () => {
    assert.ok(
      page.includes("AgentProfileHeader") &&
      page.includes("@/components/AgentProfileHeader"),
      "page.tsx must import AgentProfileHeader from @/components/AgentProfileHeader"
    );
  });

  it("passes display_name to AgentProfileHeader", () => {
    assert.ok(
      page.includes("display_name"),
      "page.tsx must pass display_name prop to AgentProfileHeader"
    );
  });

  it("passes brokerage to AgentProfileHeader", () => {
    assert.ok(
      page.includes("brokerage"),
      "page.tsx must pass brokerage prop to AgentProfileHeader"
    );
  });

  it("passes license_number to AgentProfileHeader", () => {
    assert.ok(
      page.includes("license_number"),
      "page.tsx must pass license_number prop to AgentProfileHeader"
    );
  });
});

// ---------------------------------------------------------------------------
// AgentProfileHeader.tsx — interface shape (PII safety)
// ---------------------------------------------------------------------------
describe("AgentProfileHeader.tsx — AgentProfileHeaderProps interface (T-05-06)", () => {
  it("defines AgentProfileHeaderProps interface", () => {
    assert.ok(
      header.includes("AgentProfileHeaderProps"),
      "AgentProfileHeader.tsx must define the AgentProfileHeaderProps interface"
    );
  });

  it("interface includes display_name field", () => {
    assert.ok(
      header.includes("display_name"),
      "AgentProfileHeaderProps must include display_name field"
    );
  });

  it("interface includes photo_url field", () => {
    assert.ok(
      header.includes("photo_url"),
      "AgentProfileHeaderProps must include photo_url field"
    );
  });

  it("interface includes brokerage field", () => {
    assert.ok(
      header.includes("brokerage"),
      "AgentProfileHeaderProps must include brokerage field"
    );
  });

  it("interface includes license_number field", () => {
    assert.ok(
      header.includes("license_number"),
      "AgentProfileHeaderProps must include license_number field"
    );
  });

  it("interface does NOT include email field (PII omission — T-05-06)", () => {
    // Extract the interface block for scoped check
    const ifaceStart = header.indexOf('interface AgentProfileHeaderProps');
    const ifaceEnd   = header.indexOf('}', ifaceStart);
    const ifaceBody  = ifaceEnd !== -1
      ? header.slice(ifaceStart, ifaceEnd + 1)
      : header.slice(ifaceStart);

    assert.ok(
      !ifaceBody.includes('email'),
      "AgentProfileHeaderProps must NOT include an email field — PII omission (T-05-06)"
    );
  });

  it("interface does NOT include phone field (PII omission — T-05-06)", () => {
    const ifaceStart = header.indexOf('interface AgentProfileHeaderProps');
    const ifaceEnd   = header.indexOf('}', ifaceStart);
    const ifaceBody  = ifaceEnd !== -1
      ? header.slice(ifaceStart, ifaceEnd + 1)
      : header.slice(ifaceStart);

    assert.ok(
      !ifaceBody.includes('phone'),
      "AgentProfileHeaderProps must NOT include a phone field — PII omission (T-05-06)"
    );
  });
});

// ---------------------------------------------------------------------------
// AgentProfileHeader.tsx — component characteristics
// ---------------------------------------------------------------------------
describe("AgentProfileHeader.tsx — component characteristics", () => {
  it("is a server component (no 'use client' directive)", () => {
    // Strip JS comments before checking — the phrase may appear in doc comments
    const stripped = header
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/\/\/.*$/gm, '');
    assert.ok(
      !stripped.includes("'use client'") && !stripped.includes('"use client"'),
      "AgentProfileHeader must be a server component — 'use client' must not appear as actual directive"
    );
  });

  it("uses next/image for the agent photo", () => {
    assert.ok(
      header.includes("next/image") || header.includes("Image"),
      "AgentProfileHeader must use next/image for the agent photo with descriptive alt text"
    );
  });

  it("provides a fallback avatar when photo_url is null", () => {
    assert.ok(
      header.includes("photo_url") &&
      (header.includes("fallback") || header.includes("Fallback") || header.includes("svg")),
      "AgentProfileHeader must render a fallback avatar when photo_url is null"
    );
  });

  it("displays brokerage name in the rendered output", () => {
    assert.ok(
      header.includes("{brokerage}"),
      "AgentProfileHeader must display brokerage in the rendered output"
    );
  });

  it("displays license_number in the rendered output", () => {
    assert.ok(
      header.includes("{license_number}"),
      "AgentProfileHeader must display license_number in the rendered output"
    );
  });
});

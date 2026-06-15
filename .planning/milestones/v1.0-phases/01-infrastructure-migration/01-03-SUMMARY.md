---
phase: 01-infrastructure-migration
plan: "03"
subsystem: ci-cd-pipeline
tags:
  - github-actions
  - cloudflare-workers
  - opennextjs
  - wrangler-action
dependency_graph:
  requires:
    - "01-01: @opennextjs/cloudflare adapter configured, wrangler.toml Workers config"
    - "01-02: D1 schema applied, health route live"
  provides:
    - "GitHub Actions CI/CD pipeline for Workers deployment"
    - "deploy.yml using opennextjs-cloudflare build + wrangler-action@v3 command: deploy"
  affects:
    - "All future phases: every push to main triggers full Workers deploy"
tech_stack:
  added: []
  patterns:
    - "cloudflare/wrangler-action@v3 with command: deploy and accountId secret"
    - "npx opennextjs-cloudflare build as CI build step"
key_files:
  created: []
  modified:
    - .github/workflows/deploy.yml
decisions:
  - "Replaced wrangler pages deploy with wrangler deploy (command: deploy) -- Workers deployment does not use Pages project routing"
  - "Added accountId: CLOUDFLARE_ACCOUNT_ID secret field -- required for Workers deploy (Pages embedded account via --project-name but Workers needs it explicit)"
  - "Replaced npm run pages:build with npx opennextjs-cloudflare build -- consistent with adapter swap in Plan 01"
metrics:
  duration: "~5 minutes"
  completed: "2026-06-11"
  tasks_completed: 1
  files_modified: 1
  files_created: 0
requirements:
  - INFRA-05
---

# Phase 01 Plan 03: CI/CD Pipeline Update Summary

**One-liner:** Rewrote deploy.yml to replace Pages static build (npm run pages:build + wrangler pages deploy) with OpenNext Workers build (npx opennextjs-cloudflare build + wrangler-action@v3 command: deploy), adding the required CLOUDFLARE_ACCOUNT_ID secret field.

## What Was Built

This plan updated the GitHub Actions CI/CD pipeline -- the final slice of the Phase 1 Walking Skeleton -- so that every push to main triggers a full Workers deployment using the OpenNext adapter installed in Plan 01.

**.github/workflows/deploy.yml rewritten:**
- Workflow name: "Deploy to Cloudflare Workers" (was "Deploy to Cloudflare Pages")
- Build step: `npx opennextjs-cloudflare build` (was `npm run pages:build`)
- Deploy step: `cloudflare/wrangler-action@v3` with `command: deploy` (was `pages deploy .vercel/output/static ...`)
- Added `accountId: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}` to deploy step (new required field for Workers)
- Removed Pages-specific flags: --project-name, --branch, --commit-dirty, .vercel/output/static path

Steps carried over unchanged: actions/checkout@v4, actions/setup-node@v4 (node-version: 20, cache: npm), npm ci.

## Task Commits

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Rewrite deploy.yml for OpenNext Workers build pipeline | 912049b | .github/workflows/deploy.yml |

## Checkpoint: Awaiting CI Verification

Task 2 is a checkpoint:human-verify -- execution paused here. Bernard must:

1. Verify CLOUDFLARE_API_TOKEN GitHub secret has Workers Scripts:Edit + D1:Edit permissions (may need update from Pages-only scope)
2. Add CLOUDFLARE_ACCOUNT_ID as a new GitHub repository secret (Cloudflare Dashboard overview page, right sidebar)
3. Push to main to trigger the pipeline
4. Confirm "Build (OpenNext)" and "Deploy to Cloudflare Workers" steps are green in the Actions tab
5. Verify GET https://[workers-url]/api/health returns {"ok":true,"runtime":"cloudflare-workers"}

Resume signal: type "deployed" when CI passes and /api/health returns ok: true.

## Deviations from Plan

None -- plan executed exactly as written. The deploy.yml rewrite matched RESEARCH.md Pattern 7.

## Known Stubs

None. The workflow references CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID secrets that must be configured by Bernard -- these are intentional human-action gates, not stubs.

## Threat Flags

| Flag | File | Description |
|------|------|-------------|
| threat_flag: T-03-01 (mitigated by checkpoint) | .github/workflows/deploy.yml | CLOUDFLARE_API_TOKEN scope verified by Bernard before first CI run; checkpoint gate enforces this |
| threat_flag: T-03-02 (accepted) | .github/workflows/deploy.yml | Workflow triggers only on push to main; no PR or external-contributor deploy path |

## Self-Check: PASSED

- .github/workflows/deploy.yml: FOUND -- contains "opennextjs-cloudflare build", "command: deploy", "CLOUDFLARE_ACCOUNT_ID"; does NOT contain "pages deploy" or "pages:build"
- 912049b: FOUND (Task 1 commit)

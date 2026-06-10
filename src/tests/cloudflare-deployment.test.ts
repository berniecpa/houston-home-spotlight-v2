/**
 * Cloudflare Workers Deployment Tests
 *
 * Tests verify that:
 * 1. wrangler.toml has main = ".open-next/worker.js" and nodejs_compat
 * 2. next.config.mjs does NOT contain output: 'export' or distDir: 'dist'
 * 3. open-next.config.ts exists with defineCloudflareConfig
 * 4. @opennextjs/cloudflare is in devDependencies
 * 5. package.json has cf:build and cf:deploy scripts
 * 6. db/migrations/0001_initial_schema.sql exists with required tables
 * 7. /api/leads route uses Workers env vars via getCloudflareContext
 *
 * @module tests/cloudflare-deployment
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '../../');

describe('Cloudflare Workers Deployment Configuration', () => {

  describe('wrangler.toml Workers configuration', () => {
    const wranglerPath = path.join(rootDir, 'wrangler.toml');

    it('should exist', () => {
      assert.ok(fs.existsSync(wranglerPath), 'wrangler.toml should exist');
    });

    it('should have main pointing to worker.js', () => {
      const content = fs.readFileSync(wranglerPath, 'utf-8');
      assert.ok(content.includes('main = ".open-next/worker.js"'), 'wrangler.toml should point to .open-next/worker.js');
    });

    it('should have compatibility_date 2024-12-30', () => {
      const content = fs.readFileSync(wranglerPath, 'utf-8');
      assert.ok(content.includes('compatibility_date = "2024-12-30"'), 'wrangler.toml should have compatibility_date 2024-12-30');
    });

    it('should have nodejs_compat flag', () => {
      const content = fs.readFileSync(wranglerPath, 'utf-8');
      assert.ok(content.includes('nodejs_compat'), 'wrangler.toml should include nodejs_compat flag');
    });

    it('should have D1 database binding DB', () => {
      const content = fs.readFileSync(wranglerPath, 'utf-8');
      assert.ok(content.includes('binding = "DB"'), 'wrangler.toml should have D1 binding named DB');
    });

    it('should NOT have bucket = "dist" (Pages config)', () => {
      const content = fs.readFileSync(wranglerPath, 'utf-8');
      assert.ok(!content.includes('bucket = "dist"'), 'wrangler.toml should not have Pages bucket config');
    });

    it('should NOT have [build] section (Pages config)', () => {
      const content = fs.readFileSync(wranglerPath, 'utf-8');
      assert.ok(!content.includes('[build]'), 'wrangler.toml should not have [build] section');
    });
  });

  describe('next.config.mjs Workers configuration', () => {
    const configPath = path.join(rootDir, 'next.config.mjs');

    it('should exist', () => {
      assert.ok(fs.existsSync(configPath), 'next.config.mjs should exist');
    });

    it("should NOT contain output: 'export'", () => {
      const content = fs.readFileSync(configPath, 'utf-8');
      assert.ok(!content.includes("output: 'export'"), "next.config.mjs should not have output: 'export'");
    });

    it("should NOT contain distDir: 'dist'", () => {
      const content = fs.readFileSync(configPath, 'utf-8');
      assert.ok(!content.includes("distDir: 'dist'"), "next.config.mjs should not have distDir: 'dist'");
    });

    it('should contain initOpenNextCloudflareForDev', () => {
      const content = fs.readFileSync(configPath, 'utf-8');
      assert.ok(content.includes('initOpenNextCloudflareForDev'), 'next.config.mjs should call initOpenNextCloudflareForDev for local dev');
    });
  });

  describe('open-next.config.ts', () => {
    const openNextConfigPath = path.join(rootDir, 'open-next.config.ts');

    it('should exist', () => {
      assert.ok(fs.existsSync(openNextConfigPath), 'open-next.config.ts should exist');
    });

    it('should contain defineCloudflareConfig', () => {
      const content = fs.readFileSync(openNextConfigPath, 'utf-8');
      assert.ok(content.includes('defineCloudflareConfig'), 'open-next.config.ts should call defineCloudflareConfig');
    });
  });

  describe('package.json Workers scripts and dependencies', () => {
    const packagePath = path.join(rootDir, 'package.json');
    const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf-8')) as {
      scripts?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };

    it('should have @opennextjs/cloudflare in devDependencies', () => {
      assert.ok(
        packageJson.devDependencies && packageJson.devDependencies['@opennextjs/cloudflare'],
        'package.json should have @opennextjs/cloudflare in devDependencies'
      );
    });

    it('should NOT have @cloudflare/next-on-pages in devDependencies', () => {
      assert.ok(
        !packageJson.devDependencies || !packageJson.devDependencies['@cloudflare/next-on-pages'],
        'package.json should not have @cloudflare/next-on-pages (archived package)'
      );
    });

    it('should have cf:build script', () => {
      assert.ok(packageJson.scripts && packageJson.scripts['cf:build'], 'package.json should have cf:build script');
    });

    it('should have cf:deploy script', () => {
      assert.ok(packageJson.scripts && packageJson.scripts['cf:deploy'], 'package.json should have cf:deploy script');
    });

    it('should have db:migrate:local script', () => {
      assert.ok(packageJson.scripts && packageJson.scripts['db:migrate:local'], 'package.json should have db:migrate:local script');
    });

    it('should have db:migrate:remote script', () => {
      assert.ok(packageJson.scripts && packageJson.scripts['db:migrate:remote'], 'package.json should have db:migrate:remote script');
    });
  });

  describe('D1 migration file', () => {
    const migrationPath = path.join(rootDir, 'db/migrations/0001_initial_schema.sql');

    it('should exist', () => {
      assert.ok(fs.existsSync(migrationPath), 'db/migrations/0001_initial_schema.sql should exist');
    });

    it('should contain CREATE TABLE IF NOT EXISTS agents', () => {
      const content = fs.readFileSync(migrationPath, 'utf-8');
      assert.ok(content.includes('CREATE TABLE IF NOT EXISTS agents'), 'migration should create agents table');
    });

    it('should contain CREATE TABLE IF NOT EXISTS listings', () => {
      const content = fs.readFileSync(migrationPath, 'utf-8');
      assert.ok(content.includes('CREATE TABLE IF NOT EXISTS listings'), 'migration should create listings table');
    });

    it('should contain CREATE TABLE IF NOT EXISTS leads', () => {
      const content = fs.readFileSync(migrationPath, 'utf-8');
      assert.ok(content.includes('CREATE TABLE IF NOT EXISTS leads'), 'migration should create leads table');
    });
  });

  describe('/api/leads route Workers env vars', () => {
    const leadsRoutePath = path.join(rootDir, 'src/app/api/leads/route.ts');

    it('should NOT contain process.env.PERFEX_RE_URL', () => {
      const content = fs.readFileSync(leadsRoutePath, 'utf-8');
      assert.ok(!content.includes('process.env.PERFEX_RE_URL'), 'leads route should not use process.env for PERFEX_RE_URL');
    });

    it('should contain getCloudflareContext', () => {
      const content = fs.readFileSync(leadsRoutePath, 'utf-8');
      assert.ok(content.includes('getCloudflareContext'), 'leads route should use getCloudflareContext for env vars');
    });
  });

});

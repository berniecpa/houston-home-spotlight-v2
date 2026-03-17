/**
 * Cloudflare Pages Deployment Tests - US-016
 * 
 * Tests verify that:
 * 1. wrangler.toml exists with proper Pages configuration
 * 2. next.config.js has output: 'export' and distDir: 'dist'
 * 3. .node-version file specifies compatible Node version
 * 4. npm run build outputs static files to dist/
 * 5. Build scripts for Cloudflare deployment exist
 * 6. @cloudflare/next-on-pages dependency is installed
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '../../');

describe('Cloudflare Pages Deployment Configuration - US-016', () => {
  
  describe('wrangler.toml configuration', () => {
    const wranglerPath = path.join(rootDir, 'wrangler.toml');
    
    it('should exist', () => {
      assert.ok(fs.existsSync(wranglerPath), 'wrangler.toml should exist');
    });
    
    it('should have name property', () => {
      const content = fs.readFileSync(wranglerPath, 'utf-8');
      assert.ok(content.includes('name = "houston-home-spotlight-v2"'), 'wrangler.toml should have correct name');
    });
    
    it('should have compatibility_date', () => {
      const content = fs.readFileSync(wranglerPath, 'utf-8');
      assert.ok(content.includes('compatibility_date'), 'wrangler.toml should have compatibility_date');
    });
    
    it('should have compatibility_flags with nodejs_compat', () => {
      const content = fs.readFileSync(wranglerPath, 'utf-8');
      assert.ok(content.includes('compatibility_flags'), 'wrangler.toml should have compatibility_flags');
      assert.ok(content.includes('nodejs_compat'), 'wrangler.toml should include nodejs_compat flag');
    });
    
    it('should have build configuration', () => {
      const content = fs.readFileSync(wranglerPath, 'utf-8');
      assert.ok(content.includes('[build]'), 'wrangler.toml should have [build] section');
      assert.ok(content.includes('command = "npm run build"'), 'wrangler.toml should have build command');
    });
    
    it('should have Pages bucket configuration', () => {
      const content = fs.readFileSync(wranglerPath, 'utf-8');
      assert.ok(content.includes('bucket = "dist"'), 'wrangler.toml should have dist bucket');
    });
  });
  
  describe('next.config.mjs configuration', () => {
    const configPath = path.join(rootDir, 'next.config.mjs');
    
    it('should exist', () => {
      assert.ok(fs.existsSync(configPath), 'next.config.mjs should exist');
    });
    
    it('should have output: "export"', () => {
      const content = fs.readFileSync(configPath, 'utf-8');
      assert.ok(content.includes("output: 'export'"), 'next.config.mjs should have output: "export"');
    });
    
    it('should have distDir: "dist"', () => {
      const content = fs.readFileSync(configPath, 'utf-8');
      assert.ok(content.includes("distDir: 'dist'"), 'next.config.mjs should have distDir: "dist"');
    });
    
    it('should have unoptimized images for static export', () => {
      const content = fs.readFileSync(configPath, 'utf-8');
      assert.ok(content.includes('unoptimized: true'), 'next.config.mjs should have unoptimized images');
    });
  });
  
  describe('.node-version file', () => {
    const nodeVersionPath = path.join(rootDir, '.node-version');
    
    it('should exist', () => {
      assert.ok(fs.existsSync(nodeVersionPath), '.node-version should exist');
    });
    
    it('should specify a compatible Node version', () => {
      const version = fs.readFileSync(nodeVersionPath, 'utf-8').trim();
      assert.ok(version.length > 0, '.node-version should not be empty');
      // Check for major version 18, 20, or 22 (LTS versions compatible with Cloudflare)
      const majorVersion = parseInt(version.split('.')[0], 10);
      assert.ok(
        majorVersion === 18 || majorVersion === 20 || majorVersion === 22,
        `.node-version should specify Node 18, 20, or 22 (found: ${version})`
      );
    });
  });
  
  describe('package.json scripts', () => {
    const packagePath = path.join(rootDir, 'package.json');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let packageJson: { scripts?: Record<string, string>; devDependencies?: Record<string, string> } | null = null;
    
    it('should exist and be valid JSON', () => {
      assert.ok(fs.existsSync(packagePath), 'package.json should exist');
      const content = fs.readFileSync(packagePath, 'utf-8');
      packageJson = JSON.parse(content) as { scripts?: Record<string, string>; devDependencies?: Record<string, string> };
      assert.ok(packageJson?.scripts, 'package.json should have scripts section');
    });
    
    it('should have pages:build script', () => {
      assert.ok(packageJson!.scripts!['pages:build'], 'package.json should have pages:build script');
      assert.ok(
        packageJson!.scripts!['pages:build'].includes('@cloudflare/next-on-pages'),
        'pages:build should reference @cloudflare/next-on-pages'
      );
    });
    
    it('should have pages:deploy script', () => {
      assert.ok(packageJson!.scripts!['pages:deploy'], 'package.json should have pages:deploy script');
      assert.ok(
        packageJson!.scripts!['pages:deploy'].includes('wrangler pages deploy'),
        'pages:deploy should use wrangler pages deploy'
      );
    });
    
    it('should have build script that outputs to dist', () => {
      assert.ok(packageJson!.scripts!.build, 'package.json should have build script');
      assert.ok(
        packageJson!.scripts!.build === 'next build',
        'build script should run next build'
      );
    });
    
    it('should have @cloudflare/next-on-pages in devDependencies', () => {
      assert.ok(
        packageJson!.devDependencies && packageJson!.devDependencies['@cloudflare/next-on-pages'],
        'package.json should have @cloudflare/next-on-pages in devDependencies'
      );
    });
  });
  
  describe('dist/ build output', () => {
    const distPath = path.join(rootDir, 'dist');
    
    it('should exist after build', () => {
      assert.ok(fs.existsSync(distPath), 'dist/ directory should exist');
      assert.ok(fs.statSync(distPath).isDirectory(), 'dist/ should be a directory');
    });
    
    it('should contain index.html', () => {
      const indexPath = path.join(distPath, 'index.html');
      assert.ok(fs.existsSync(indexPath), 'dist/ should contain index.html');
    });
    
    it('should contain static assets in _next/', () => {
      const nextPath = path.join(distPath, '_next');
      assert.ok(fs.existsSync(nextPath), 'dist/ should contain _next/ directory');
      assert.ok(fs.statSync(nextPath).isDirectory(), '_next/ should be a directory');
    });
    
    it('should contain listings pages', () => {
      const listingsPath = path.join(distPath, 'listings.html');
      const listingsDir = path.join(distPath, 'listings');
      assert.ok(
        fs.existsSync(listingsPath) || fs.existsSync(listingsDir),
        'dist/ should contain listings page'
      );
    });
    
    it('should contain contact page', () => {
      const contactPath = path.join(distPath, 'contact.html');
      assert.ok(fs.existsSync(contactPath), 'dist/ should contain contact.html');
    });
  });
  
  describe('TypeScript configuration compatibility', () => {
    const tsConfigPath = path.join(rootDir, 'tsconfig.json');
    
    it('should exist', () => {
      assert.ok(fs.existsSync(tsConfigPath), 'tsconfig.json should exist');
    });
    
    it('should be valid JSON', () => {
      const content = fs.readFileSync(tsConfigPath, 'utf-8');
      const tsConfig = JSON.parse(content);
      assert.ok(tsConfig.compilerOptions, 'tsconfig.json should have compilerOptions');
    });
  });
});

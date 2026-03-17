/**
 * Tests for Tailwind CSS Configuration
 * Story: US-002 - Configure Tailwind CSS with custom theme
 */

import { describe, it } from "node:test";
import assert from "node:assert";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const PROJECT_ROOT = process.cwd();
const SRC_DIR = join(PROJECT_ROOT, "src");

describe("Tailwind CSS Configuration", () => {
  describe("Configuration Files", () => {
    it("should have tailwind.config.ts file", () => {
      const configPath = join(PROJECT_ROOT, "tailwind.config.ts");
      assert.ok(existsSync(configPath), "tailwind.config.ts should exist");
    });

    it("should have postcss.config.mjs file", () => {
      const configPath = join(PROJECT_ROOT, "postcss.config.mjs");
      assert.ok(existsSync(configPath), "postcss.config.mjs should exist");
    });

    it("should have globals.css with Tailwind directives", () => {
      const globalsPath = join(SRC_DIR, "app", "globals.css");
      assert.ok(existsSync(globalsPath), "globals.css should exist");

      const content = readFileSync(globalsPath, "utf-8");
      assert.ok(content.includes("@tailwind base"), "Should include @tailwind base directive");
      assert.ok(content.includes("@tailwind components"), "Should include @tailwind components directive");
      assert.ok(content.includes("@tailwind utilities"), "Should include @tailwind utilities directive");
    });
  });

  describe("Custom Theme Colors", () => {
    const tailwindConfig = readFileSync(join(PROJECT_ROOT, "tailwind.config.ts"), "utf-8");

    it("should define custom primary color palette", () => {
      assert.ok(tailwindConfig.includes("primary:"), "Should define primary color");
      assert.ok(tailwindConfig.includes('900: "#1e3a8a"'), "Should define primary-900 as #1e3a8a");
      assert.ok(tailwindConfig.includes('500: "#3b82f6"'), "Should define primary-500");
    });

    it("should define custom accent color palette", () => {
      assert.ok(tailwindConfig.includes("accent:"), "Should define accent color");
      assert.ok(tailwindConfig.includes('500: "#f59e0b"'), "Should define accent-500 as #f59e0b");
      assert.ok(tailwindConfig.includes('400: "#fbbf24"'), "Should define accent-400");
    });

    it("should include full color scale (50-950) for primary", () => {
      assert.ok(tailwindConfig.includes('50: "#eff6ff"'), "Should define primary-50");
      assert.ok(tailwindConfig.includes('950: "#172554"'), "Should define primary-950");
    });

    it("should include full color scale (50-950) for accent", () => {
      assert.ok(tailwindConfig.includes('50: "#fffbeb"'), "Should define accent-50");
      assert.ok(tailwindConfig.includes('950: "#451a03"'), "Should define accent-950");
    });
  });

  describe("Font Configuration", () => {
    const tailwindConfig = readFileSync(join(PROJECT_ROOT, "tailwind.config.ts"), "utf-8");

    it("should configure sans-serif font family", () => {
      assert.ok(tailwindConfig.includes("fontFamily:"), "Should define fontFamily");
      assert.ok(tailwindConfig.includes('sans:'), "Should define sans font");
      assert.ok(tailwindConfig.includes("var(--font-inter)"), "Should use --font-inter CSS variable");
    });

    it("should configure serif font family for headings", () => {
      assert.ok(tailwindConfig.includes('serif:'), "Should define serif font");
      assert.ok(tailwindConfig.includes("var(--font-merriweather)"), "Should use --font-merriweather CSS variable");
    });

    it("should have layout.tsx with Inter font", () => {
      const layoutPath = join(SRC_DIR, "app", "layout.tsx");
      const content = readFileSync(layoutPath, "utf-8");
      assert.ok(content.includes('from "next/font/google"'), "Should import from next/font/google");
      assert.ok(content.includes('Inter'), "Should import Inter font");
      assert.ok(content.includes('Merriweather'), "Should import Merriweather font");
      assert.ok(content.includes('variable: "--font-inter"'), "Should set --font-inter CSS variable");
      assert.ok(content.includes('variable: "--font-merriweather"'), "Should set --font-merriweather CSS variable");
    });
  });

  describe("Responsive Breakpoints", () => {
    const tailwindConfig = readFileSync(join(PROJECT_ROOT, "tailwind.config.ts"), "utf-8");

    it("should define custom breakpoints for mobile-first design", () => {
      assert.ok(tailwindConfig.includes('screens:'), "Should define screens/breakpoints");
      assert.ok(tailwindConfig.includes('"xs": "375px"'), "Should define xs breakpoint at 375px");
      assert.ok(tailwindConfig.includes('"sm": "640px"'), "Should define sm breakpoint at 640px");
      assert.ok(tailwindConfig.includes('"md": "768px"'), "Should define md breakpoint at 768px");
    });
  });

  describe("Custom Components and Utilities", () => {
    const globalsContent = readFileSync(join(SRC_DIR, "app", "globals.css"), "utf-8");

    it("should have @layer base with base styles", () => {
      assert.ok(globalsContent.includes("@layer base"), "Should define @layer base");
      assert.ok(globalsContent.includes("scroll-behavior: smooth"), "Should enable smooth scrolling");
    });

    it("should have @layer components with custom components", () => {
      assert.ok(globalsContent.includes("@layer components"), "Should define @layer components");
      assert.ok(globalsContent.includes(".btn-primary"), "Should define btn-primary component");
      assert.ok(globalsContent.includes(".btn-accent"), "Should define btn-accent component");
      assert.ok(globalsContent.includes(".card"), "Should define card component");
    });

    it("should have @layer utilities with custom utilities", () => {
      assert.ok(globalsContent.includes("@layer utilities"), "Should define @layer utilities");
      assert.ok(globalsContent.includes(".gradient-primary"), "Should define gradient-primary utility");
      assert.ok(globalsContent.includes(".gradient-accent"), "Should define gradient-accent utility");
    });
  });

  describe("PostCSS Configuration", () => {
    const postcssConfig = readFileSync(join(PROJECT_ROOT, "postcss.config.mjs"), "utf-8");

    it("should have tailwindcss plugin", () => {
      assert.ok(postcssConfig.includes("tailwindcss:"), "Should include tailwindcss plugin");
    });

    it("should have autoprefixer plugin", () => {
      assert.ok(postcssConfig.includes("autoprefixer:"), "Should include autoprefixer plugin");
    });
  });

  describe("Package Dependencies", () => {
    const packageJson = JSON.parse(readFileSync(join(PROJECT_ROOT, "package.json"), "utf-8"));

    it("should have tailwindcss as dev dependency", () => {
      assert.ok(packageJson.devDependencies?.tailwindcss, "tailwindcss should be in devDependencies");
    });

    it("should have postcss as dev dependency", () => {
      assert.ok(packageJson.devDependencies?.postcss, "postcss should be in devDependencies");
    });

    it("should have autoprefixer as dev dependency", () => {
      assert.ok(packageJson.devDependencies?.autoprefixer, "autoprefixer should be in devDependencies");
    });
  });
});

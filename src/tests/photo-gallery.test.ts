/**
 * PhotoGallery Component Tests
 * 
 * Tests for the PhotoGallery component including:
 * - Component rendering and exports
 * - Props interface (images array, alt text)
 * - Main image display functionality
 * - Thumbnail navigation
 * - Touch/swipe support
 * - Lazy loading implementation
 * - Lightbox/full-screen view
 * - Keyboard navigation
 * - Accessibility features
 * - Edge cases (empty images, single image)
 * 
 * @module tests/photo-gallery.test
 */

import { describe, it } from "node:test";
import assert from "node:assert";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const projectRoot = process.cwd();
const componentPath = join(projectRoot, "src/components/PhotoGallery.tsx");

describe("PhotoGallery Component", () => {
  describe("File Structure", () => {
    it("should have PhotoGallery.tsx in src/components/", () => {
      assert.ok(existsSync(componentPath), "PhotoGallery.tsx should exist");
    });

    it("should export PhotoGallery function", () => {
      const content = readFileSync(componentPath, "utf-8");
      assert.ok(
        content.includes("export function PhotoGallery"),
        "Should export PhotoGallery function"
      );
    });

    it("should export default PhotoGallery", () => {
      const content = readFileSync(componentPath, "utf-8");
      assert.ok(
        content.includes("export default PhotoGallery"),
        "Should have default export"
      );
    });
  });

  describe("TypeScript Types", () => {
    it("should define PhotoGalleryProps interface", () => {
      const content = readFileSync(componentPath, "utf-8");
      assert.ok(
        content.includes("interface PhotoGalleryProps"),
        "Should define PhotoGalleryProps interface"
      );
    });

    it("should have images array prop", () => {
      const content = readFileSync(componentPath, "utf-8");
      assert.ok(
        content.includes("images: string[]"),
        "Should have images array of strings"
      );
    });

    it("should have optional alt prop", () => {
      const content = readFileSync(componentPath, "utf-8");
      assert.ok(
        content.includes("alt?: string"),
        "Should have optional alt prop"
      );
    });

    it("should return JSX.Element type", () => {
      const content = readFileSync(componentPath, "utf-8");
      assert.ok(
        content.includes(": JSX.Element"),
        "Should return JSX.Element type"
      );
    });
  });

  describe("Imports", () => {
    it("should import useState and useCallback from React", () => {
      const content = readFileSync(componentPath, "utf-8");
      assert.ok(
        content.includes("import { useState, useCallback, useEffect } from 'react'"),
        "Should import React hooks"
      );
    });

    it("should import Image from next/image", () => {
      const content = readFileSync(componentPath, "utf-8");
      assert.ok(
        content.includes("import Image from") && content.includes("next/image"),
        "Should import Next.js Image component"
      );
    });

    it("should have 'use client' directive", () => {
      const content = readFileSync(componentPath, "utf-8");
      assert.ok(
        content.includes("'use client'"),
        "Should have 'use client' directive"
      );
    });
  });

  describe("Main Image Display", () => {
    it("should use Next.js Image component for main image", () => {
      const content = readFileSync(componentPath, "utf-8");
      assert.ok(
        content.includes("<Image"),
        "Should use Next.js Image component"
      );
    });

    it("should have aspect ratio container for main image", () => {
      const content = readFileSync(componentPath, "utf-8");
      assert.ok(
        content.includes("aspect-[4/3]"),
        "Should have 4:3 aspect ratio container"
      );
    });

    it("should display image counter overlay", () => {
      const content = readFileSync(componentPath, "utf-8");
      assert.ok(
        content.includes("currentIndex + 1") && content.includes("images.length"),
        "Should show current image counter"
      );
    });

    it("should set priority loading for first image", () => {
      const content = readFileSync(componentPath, "utf-8");
      assert.ok(
        content.includes("priority={currentIndex === 0}"),
        "Should prioritize first image"
      );
    });

    it("should use lazy loading for non-first images", () => {
      const content = readFileSync(componentPath, "utf-8");
      assert.ok(
        content.includes("loading={currentIndex === 0 ? 'eager' : 'lazy'}") ||
        content.includes('loading="lazy"'),
        "Should lazy load images"
      );
    });
  });

  describe("Thumbnail Navigation", () => {
    it("should render thumbnail strip when multiple images", () => {
      const content = readFileSync(componentPath, "utf-8");
      assert.ok(
        content.includes("images.length > 1") && content.includes("images.map"),
        "Should render thumbnails for multiple images"
      );
    });

    it("should have clickable thumbnail buttons", () => {
      const content = readFileSync(componentPath, "utf-8");
      assert.ok(
        content.includes("onClick={() => goToImage(index)}"),
        "Should have clickable thumbnails"
      );
    });

    it("should highlight active thumbnail", () => {
      const content = readFileSync(componentPath, "utf-8");
      assert.ok(
        content.includes("index === currentIndex") && content.includes("ring-2"),
        "Should highlight active thumbnail with ring"
      );
    });

    it("should make thumbnail strip horizontally scrollable", () => {
      const content = readFileSync(componentPath, "utf-8");
      assert.ok(
        content.includes("overflow-x-auto"),
        "Should have horizontal scroll for thumbnails"
      );
    });
  });

  describe("Touch/Swipe Support", () => {
    it("should have touch start handler", () => {
      const content = readFileSync(componentPath, "utf-8");
      assert.ok(
        content.includes("onTouchStart"),
        "Should have touch start handler"
      );
    });

    it("should have touch move handler", () => {
      const content = readFileSync(componentPath, "utf-8");
      assert.ok(
        content.includes("onTouchMove"),
        "Should have touch move handler"
      );
    });

    it("should have touch end handler", () => {
      const content = readFileSync(componentPath, "utf-8");
      assert.ok(
        content.includes("onTouchEnd"),
        "Should have touch end handler"
      );
    });

    it("should define minimum swipe distance", () => {
      const content = readFileSync(componentPath, "utf-8");
      assert.ok(
        content.includes("minSwipeDistance"),
        "Should define minimum swipe distance"
      );
    });

    it("should show swipe hint on mobile", () => {
      const content = readFileSync(componentPath, "utf-8");
      assert.ok(
        content.includes("Swipe to navigate"),
        "Should show swipe hint on mobile"
      );
    });
  });

  describe("Lightbox/Full-screen View", () => {
    it("should have lightbox open state", () => {
      const content = readFileSync(componentPath, "utf-8");
      assert.ok(
        content.includes("isLightboxOpen"),
        "Should have lightbox open state"
      );
    });

    it("should open lightbox on main image click", () => {
      const content = readFileSync(componentPath, "utf-8");
      assert.ok(
        content.includes("onClick={openLightbox}"),
        "Should open lightbox on click"
      );
    });

    it("should close lightbox with close button", () => {
      const content = readFileSync(componentPath, "utf-8");
      assert.ok(
        content.includes("onClick={closeLightbox}"),
        "Should close lightbox with button"
      );
    });

    it("should have fixed position overlay for lightbox", () => {
      const content = readFileSync(componentPath, "utf-8");
      assert.ok(
        content.includes("fixed inset-0"),
        "Should have fixed position overlay"
      );
    });

    it("should have high z-index for lightbox", () => {
      const content = readFileSync(componentPath, "utf-8");
      assert.ok(
        content.includes("z-50"),
        "Should have high z-index for lightbox"
      );
    });
  });

  describe("Navigation", () => {
    it("should have goToNext function", () => {
      const content = readFileSync(componentPath, "utf-8");
      assert.ok(
        content.includes("const goToNext"),
        "Should have goToNext function"
      );
    });

    it("should have goToPrevious function", () => {
      const content = readFileSync(componentPath, "utf-8");
      assert.ok(
        content.includes("const goToPrevious"),
        "Should have goToPrevious function"
      );
    });

    it("should have goToImage function for thumbnails", () => {
      const content = readFileSync(componentPath, "utf-8");
      assert.ok(
        content.includes("const goToImage"),
        "Should have goToImage function"
      );
    });

    it("should cycle through images with next/previous", () => {
      const content = readFileSync(componentPath, "utf-8");
      assert.ok(
        content.includes("(prev + 1) % images.length") ||
        content.includes("(prev - 1 + images.length) % images.length"),
        "Should cycle through images"
      );
    });
  });

  describe("Keyboard Navigation", () => {
    it("should add keyboard event listener", () => {
      const content = readFileSync(componentPath, "utf-8");
      assert.ok(
        content.includes("addEventListener('keydown'"),
        "Should add keyboard event listener"
      );
    });

    it("should handle ArrowLeft key", () => {
      const content = readFileSync(componentPath, "utf-8");
      assert.ok(
        content.includes("ArrowLeft"),
        "Should handle ArrowLeft key"
      );
    });

    it("should handle ArrowRight key", () => {
      const content = readFileSync(componentPath, "utf-8");
      assert.ok(
        content.includes("ArrowRight"),
        "Should handle ArrowRight key"
      );
    });

    it("should handle Escape key to close lightbox", () => {
      const content = readFileSync(componentPath, "utf-8");
      assert.ok(
        content.includes("Escape") && content.includes("closeLightbox"),
        "Should handle Escape key to close lightbox"
      );
    });
  });

  describe("Accessibility", () => {
    it("should have ARIA labels on main image container", () => {
      const content = readFileSync(componentPath, "utf-8");
      assert.ok(
        content.includes('aria-label='),
        "Should have aria-label on image container"
      );
    });

    it("should have role button on clickable image", () => {
      const content = readFileSync(componentPath, "utf-8");
      assert.ok(
        content.includes('role="button"'),
        "Should have role button on clickable image"
      );
    });

    it("should have aria-label on navigation buttons", () => {
      const content = readFileSync(componentPath, "utf-8");
      assert.ok(
        content.includes('aria-label="Previous image"') &&
        content.includes('aria-label="Next image"'),
        "Should have aria-labels on navigation buttons"
      );
    });

    it("should have aria-current on active thumbnail", () => {
      const content = readFileSync(componentPath, "utf-8");
      assert.ok(
        content.includes('aria-current={index === currentIndex'),
        "Should have aria-current on active thumbnail"
      );
    });

    it("should have role dialog on lightbox", () => {
      const content = readFileSync(componentPath, "utf-8");
      assert.ok(
        content.includes('role="dialog"'),
        "Should have role dialog on lightbox"
      );
    });

    it("should have aria-modal on lightbox", () => {
      const content = readFileSync(componentPath, "utf-8");
      assert.ok(
        content.includes('aria-modal="true"'),
        "Should have aria-modal on lightbox"
      );
    });

    it("should handle keyboard Enter/Space on main image", () => {
      const content = readFileSync(componentPath, "utf-8");
      assert.ok(
        content.includes("onKeyDown") && 
        (content.includes("key === 'Enter'") || content.includes('key === "Enter"')),
        "Should handle Enter key on main image"
      );
    });
  });

  describe("Edge Cases", () => {
    it("should handle empty images array", () => {
      const content = readFileSync(componentPath, "utf-8");
      assert.ok(
        content.includes("!images || images.length === 0"),
        "Should check for empty images array"
      );
    });

    it("should show fallback message for empty images", () => {
      const content = readFileSync(componentPath, "utf-8");
      assert.ok(
        content.includes("No images available"),
        "Should show fallback message for empty images"
      );
    });

    it("should conditionally render thumbnails only when multiple images", () => {
      const content = readFileSync(componentPath, "utf-8");
      assert.ok(
        content.includes("images.length > 1") && content.includes("thumbnail"),
        "Should only render thumbnails for multiple images"
      );
    });

    it("should conditionally render navigation arrows", () => {
      const content = readFileSync(componentPath, "utf-8");
      assert.ok(
        content.includes("images.length > 1") && 
        (content.includes("Previous image") || content.includes("Next image")),
        "Should only show navigation for multiple images"
      );
    });
  });

  describe("Performance", () => {
    it("should use useCallback for event handlers", () => {
      const content = readFileSync(componentPath, "utf-8");
      const useCallbackCount = (content.match(/useCallback/g) || []).length;
      assert.ok(
        useCallbackCount >= 5,
        `Should use useCallback for memoization (found ${useCallbackCount} uses)`
      );
    });

    it("should specify image sizes for responsive loading", () => {
      const content = readFileSync(componentPath, "utf-8");
      assert.ok(
        content.includes('sizes="'),
        "Should specify image sizes attribute"
      );
    });

    it("should prevent body scroll when lightbox is open", () => {
      const content = readFileSync(componentPath, "utf-8");
      assert.ok(
        content.includes("document.body.style.overflow"),
        "Should prevent body scroll when lightbox open"
      );
    });
  });

  describe("Styling", () => {
    it("should use Tailwind classes for styling", () => {
      const content = readFileSync(componentPath, "utf-8");
      assert.ok(
        content.includes("className=") && 
        (content.includes("bg-") || content.includes("text-") || content.includes("rounded-")),
        "Should use Tailwind classes"
      );
    });

    it("should have responsive design classes", () => {
      const content = readFileSync(componentPath, "utf-8");
      assert.ok(
        content.includes("md:") || content.includes("sm:"),
        "Should have responsive Tailwind classes"
      );
    });

    it("should have hover effects for interactivity", () => {
      const content = readFileSync(componentPath, "utf-8");
      assert.ok(
        content.includes("hover:") || content.includes("transition-"),
        "Should have hover effects and transitions"
      );
    });
  });
});

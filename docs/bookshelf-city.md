# Bookshelf City implementation

The next homepage is staged at `/bookshelf/`. The production entry, character media, and share preview stay unchanged while this version is reviewed.

## Current stage

- The selected Bookshelf City composition, including coding, bridge construction, block building, and a notebook workshop.
- Art-directed desktop and portrait layouts instead of cropping desktop art on phones.
- Selectable HTML heading and introduction, with the existing full-name wordmark.
- A separate animated companion with a nine-second flight, a small pointer response, blinking, and a trailing path.
- Tap, Enter, or Space on the companion to rest/wake it. Reduced-motion preferences start it at rest. Animation pauses when the document or scene is hidden.
- No center spinner, bottom control strip, or top-right domain label.

The Aidan activity poses are illustrations from the selected concept. They are not the newer character mesh or articulated animations. The real model currently has no verified action rig. No third-party mesh or source model is included in this website.

## Structure

- `public/bookshelf/index.html`: semantic presentation and accessible companion.
- `public/bookshelf/style.css`: responsive composition and material treatment.
- `public/bookshelf/scene.js`: normalized anchors and independently tested motion.
- `public/bookshelf/app.js`: pointer/keyboard events, lifecycle, and rendered motion.
- `public/bookshelf/assets/`: responsive WebP artwork, 51–163 KB each.
- `scripts/bookshelf.test.mjs`: composition, motion, accessibility, and asset budgets.

All application code is dependency-free. The new page loads one appropriately sized city image, one wordmark, one local font, and small HTML/CSS/JS files. It does not load the old portrait atlas or use a backend.

## Verification

All 34 repository tests and the static build pass. Browser review covered the desktop page, click-to-rest, Enter-to-wake, and iframe viewports at 390×844, 320×568, and 844×390. Each viewport matched its document dimensions without internal scrolling. The portrait image preserves all four activities. The small-screen companion toggle worked. No application errors were observed; unrelated browser-extension errors were present.

These viewport checks are desktop-browser layout tests, not physical iPhone Safari or touch-device testing. Reduced-motion positioning has unit coverage and the media-query wiring is present, but an actual OS reduced-motion setting was not changed for testing.

## Next stages

1. Review this implemented composition, especially the portrait adaptation, before promoting it over the existing homepage.
2. Once the visually approved immutable character is available, prepare and verify a first seated coding pose. Replace the illustrative scene layer using matched camera, lighting, and alpha/compositing. Then repeat for plank carrying, block building, and the notebook workshop.
3. Add short verified action loops. Keep activity timing and interaction separate from the scene layout.
4. Add world interactions only after their behavior and mobile performance are implemented and tested. Real-time articulated physics requires a separately validated rig, weights, colliders, and an appropriate asset-license/protection pipeline.
5. On homepage promotion, replace the share preview with this world, remove the staged `noindex`, and verify the exact GitHub commit, Vercel deployment, live HTTPS, responsive behavior, and metadata. The previous homepage remains available in Git history for rollback.

No production deployment, domain configuration, integration permission, or branch protection is changed by this staged implementation.

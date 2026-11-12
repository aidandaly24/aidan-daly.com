# Articulated action media contract

This is preparation for real character animation. No action loop is mounted in the current preview until its rig, pose, motion, and scene composition have been visually verified.

## First action

Seated coding: four seconds at 24 fps, 96 distinct frames. The next frame must return to the first pose for loop-seam review, but is not included twice in playback. Real alternating arm/wrist keypresses and a restrained head glance are the target. Shoulder/sleeve, elbow/wrist, seated jeans/knee, and hand/keyboard contact must pass actual deformation review.

The fixed camera should show the character facing screen-right, with the face and front-left side visible, a slightly elevated near-orthographic miniature view. Match the selected coding nook before final rendering. Keep the action independent from the camera and props.

## Render outputs

- RGBA PNG frames with stable camera, exposure, lighting, seed policy, and crop.
- Fixed bounds for the entire loop, with roughly 5% transparent margin. No per-frame recropping.
- Explicit floor, chair, keyboard and desk contact references for composition.
- One static poster with the same bounds.
- A short diagnostic proof before any full-resolution series.
- Source/action/camera provenance retained privately. Only finished rendered media is published.

Desktop and portrait require matched scene placement and desk occlusion. Removing the illustrated person from the background and rendering proper foreground occlusion is a separate composition step, not automatic rigging.

## Browser delivery

`action-media.js` supports discrete transparent rendered frames in small WebP atlas pages. It deliberately does not blend different limb poses. One current and one next page remain decoded, with one page in flight. Retired bitmaps are closed. Missing media holds the last correct frame rather than going blank or jumping ahead. A common scene clock can pause when hidden or under reduced-motion preferences.

Mobile and desktop tiers should be selected against actual displayed size and device-pixel density. Each atlas page is capped at 24 MiB decoded; practical targets should be substantially lower, with the combined four-scene budget measured on a phone before release. The existing turntable atlases are not loaded by the city page.

Transparent video may be considered after actual Safari/Chrome support checks. Do not ship black or opaque replacement backgrounds, and do not treat unverified alpha-video support as a solution.

This module is currently unmounted infrastructure with unit tests. It is not evidence that a character animation exists or that physical iPhone playback has passed.

## Offline packaging

After the actual sequence passes visual review, use `python scripts/pack-action.py --source /path/to/verified/frames --output /path/to/new/versioned/media`. Defaults are 96 frames at 24 fps, numbered `frame-0001.png` through `frame-0096.png`. The optional frame 97 seam proof is not packaged. The script rejects missing, opaque, changing-size, empty, or edge-clipped frames and refuses to overwrite existing media. It never invents an absent frame.

Responsive tiers default to 512px and 768px high, never upscale source frames, and preserve the fixed source bounds. Tune those heights against measured on-screen size after camera/compositing approval. Six frames per atlas, three columns by two rows, keep memory predictable. A publishable manifest is written only after all pages finish.

`python scripts/test_pack_action.py` runs the offline packaging checks. Pillow is an optional media-preparation dependency, not a website runtime or deployment dependency. The generated rectangular test fixtures are only test data and are never displayed as character animation.

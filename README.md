# aidan-daly.com

A small, static coming-soon site for Aidan Daly. The homepage has a rendered 360-degree character turntable, pointer/touch dragging, keyboard rotation, glasses and recenter controls, and reduced-motion and data-saver support. The default portrait has no glasses. The high-resolution 144-view turntable is decoded in a small rolling cache, with a complete lightweight fallback for fast drags and poor connections. Both glasses options use matching 1024px, 144-view media with identical framing. The glasses upgrade has a versioned asset path so returning visitors do not reuse the older cached media. The figure turns once every 12 seconds while the horizontal typography keeps its 26-second counter-rotation. Both follow the display refresh rate, including during drag reversals. Same-direction dragging adds speed; opposite dragging reverses, coasts, and returns to the normal auto-spin.

## Development

No runtime dependencies. Node 20 or newer is sufficient.

- `npm test` checks rotation math, content, accessibility hooks, media completeness, and deployment configuration.
- `npm run build` copies `public/` to `dist/`.

The intended Vercel configuration serves `dist/`. The site is live at https://aidan-daly.com/. Automatic GitHub-to-Vercel deployment is pending repository access and connection in Vercel; current releases are deployed directly from the reviewed repository files. The primary domain is `aidan-daly.com`. Future projects can use their own Vercel projects and subdomains without changing this site's source or the domain's nameservers. No wildcard domain is attached to this project.

## Character media

The interactive figure uses genuine rendered camera angles from the existing Blender character, not an exposed downloadable 3D mesh. Source models and Blender files stay out of the public repository. Only finished rendered media is published.

Fonts: Instrument Serif, DM Sans, and Sora, distributed under the SIL Open Font License. See `public/assets/fonts/` for the license text.

## Share previews

Metadata is in the initial HTML, without JavaScript or user-agent-specific content. The preview uses the same rendered character and typography as the site. Static JPEG fallback is 1200×630. A muted 26-second MP4 loops the actual figure and counter-rotating type, with a 13-second figure turn for a seamless loop and the same 26-second text turn. The live interactive site keeps its 12-second figure pace. Optional local generation scripts use `@napi-rs/canvas`; video generation also needs `ffmpeg`. These tools are not runtime or deployment dependencies. Apple Messages support for directly linked MP4 previews is documented in [TN3156](https://developer.apple.com/documentation/technotes/tn3156-create-rich-previews-for-messages). Client caches and autoplay preferences can affect presentation; browser playback alone does not verify iMessage behavior.

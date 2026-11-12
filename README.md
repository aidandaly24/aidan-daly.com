# aidan-daly.com

A small, static coming-soon site for Aidan Daly. The homepage has a rendered 360-degree character turntable, pointer/touch dragging, keyboard rotation, a pause control, and reduced-motion and data-saver support. The horizontal typography orbit counter-rotates with the character, including during drag reversals. Same-direction dragging adds speed; opposite dragging reverses, coasts, and returns to the normal auto-spin.

## Development

No runtime dependencies. Node 20 or newer is sufficient.

- `npm test` checks rotation math, content, accessibility hooks, media completeness, and deployment configuration.
- `npm run build` copies `public/` to `dist/`.

The intended Vercel configuration serves `dist/`. Publication and the GitHub connection are pending design approval and repository access in Vercel. The primary domain is `aidan-daly.com`. Future projects can use their own Vercel projects and subdomains without changing this site's source or the domain's nameservers. No wildcard domain is attached to this project.

## Character media

The interactive figure uses genuine rendered camera angles from the existing Blender character, not an exposed downloadable 3D mesh. Source models and Blender files stay out of the public repository. Only finished rendered media is published.

Fonts: Instrument Serif, DM Sans, and Sora, distributed under the SIL Open Font License. See `public/assets/fonts/` for the license text.

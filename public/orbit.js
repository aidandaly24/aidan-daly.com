// Sora SemiBold outlines are licensed under SIL OFL 1.1; see assets/fonts/Sora-OFL.txt.
export function createOrbitRenderer(data) {
  const R = data.radius, D = data.cameraDistance, el = data.elevation * Math.PI / 180;
  const ce = Math.cos(el), se = Math.sin(el), text = data.text;
  const circumference = Math.PI * 2 * R;
  const tracking = (circumference - [...text].reduce((n, ch) => n + data.glyphs[ch].advance, 0)) / text.length;
  const items = []; let cursor = 0;
  for (const ch of text) {
    const glyph = data.glyphs[ch];
    items.push({ glyph, offset: -Math.PI / 3 + (cursor + glyph.advance / 2) / R });
    cursor += glyph.advance + tracking;
  }
  return function draw(context, phase, front) {
    const sorted = items.map(item => ({ ...item, angle: item.offset + phase })).filter(item => (Math.cos(item.angle) >= 0) === front).sort((a,b) => Math.cos(a.angle) - Math.cos(b.angle));
    context.fillStyle = '#45483f'; context.globalAlpha = front ? 1 : .33;
    for (const { glyph, angle } of sorted) {
      const st = Math.sin(angle), ct = Math.cos(angle); context.beginPath();
      for (const path of glyph.paths) {
        let first = true;
        for (const [px, z] of path) {
          const tangent = px - glyph.advance / 2;
          const x = R * st + tangent * ct, y = R * ct - tangent * st;
          const depth = D - (y * ce + z * se);
          const sx = 450 + D * x / depth, sy = 260 + D * (-z * ce + y * se) / depth;
          if (first) { context.moveTo(sx, sy); first = false; } else context.lineTo(sx, sy);
        }
        context.closePath();
      }
      context.fill();
    }
    context.globalAlpha = 1;
  };
}

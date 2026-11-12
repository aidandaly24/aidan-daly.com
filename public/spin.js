export function wrap(value, count) { return ((value % count) + count) % count; }
export function dragFrame(start, delta, width, count) { return wrap(start - delta / Math.max(width, 1) * count * 1.4, count); }
export function degrees(frame, count) { return Math.round(wrap(frame, count) / count * 360) % 360; }

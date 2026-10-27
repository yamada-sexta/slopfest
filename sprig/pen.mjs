import { LIMITS, toSVG } from './language.mjs';
const fail = message => { throw new RangeError(message); };
const finite = values => values.every(Number.isFinite);

export function preparePen(drawing) {
  if (!drawing || !Array.isArray(drawing.segments) || !Array.isArray(drawing.buds) || !Array.isArray(drawing.marks) || drawing.segments.length > LIMITS.segments || drawing.marks.length > LIMITS.symbols || drawing.marks.length !== drawing.segments.length + drawing.buds.length) fail('Use a bounded Sprig trace with ordered marks.');
  const { minX, minY, maxX, maxY } = drawing.bounds ?? {};
  if (!finite([minX, minY, maxX, maxY]) || minX > maxX || minY > maxY) fail('Drawing bounds must be finite and ordered.');
  for (const segment of drawing.segments) if (!segment || !finite([segment.x1, segment.y1, segment.x2, segment.y2]) || !Number.isInteger(segment.branch) || segment.branch < 0) fail('A stroke needs finite geometry and a branch depth.');
  for (const bud of drawing.buds) if (!bud || !finite([bud.x, bud.y])) fail('A bud needs finite coordinates.');
  const strokes = new Uint32Array(drawing.marks.length + 1), buds = new Uint32Array(drawing.marks.length + 1);
  let previousSource = -1;
  drawing.marks.forEach((mark, i) => {
    if (!mark || !['stroke', 'bud'].includes(mark.kind) || !Number.isInteger(mark.source) || mark.source <= previousSource || mark.source >= LIMITS.symbols) fail('Marks must follow expanded symbol order.');
    strokes[i + 1] = strokes[i]; buds[i + 1] = buds[i];
    const counts = mark.kind === 'stroke' ? strokes : buds;
    if (mark.index !== counts[i]) fail('Marks must refer to each stroke or bud exactly once in order.');
    counts[i + 1]++; previousSource = mark.source;
  });
  if (strokes.at(-1) !== drawing.segments.length || buds.at(-1) !== drawing.buds.length) fail('Every visible mark must appear in the trace.');
  return { drawing, strokes, buds, total: drawing.marks.length };
}

export function frameAt(pen, position) {
  if (!Number.isInteger(position) || position < 0 || position > pen.total) fail('Choose a whole mark position inside this drawing.');
  const mark = position === 0 ? null : pen.drawing.marks[position - 1];
  const item = mark ? (mark.kind === 'stroke' ? pen.drawing.segments : pen.drawing.buds)[mark.index] : null;
  return {
    position, strokes: pen.strokes[position], buds: pen.buds[position],
    marker: mark ? { x: mark.kind === 'stroke' ? item.x2 : item.x, y: mark.kind === 'stroke' ? item.y2 : item.y, source: mark.source, kind: mark.kind, branch: mark.kind === 'stroke' ? item.branch : null } : null,
  };
}

export function snapshotSVG(pen, position, options = {}) {
  const frame = frameAt(pen, position);
  // Full bounds keep the camera fixed even when only one mark is visible.
  return toSVG({ segments: pen.drawing.segments.slice(0, frame.strokes), buds: pen.drawing.buds.slice(0, frame.buds), bounds: pen.drawing.bounds }, options);
}

export function sourceWindow(symbols, source, radius = 12) {
  if (typeof symbols !== 'string' || symbols.length > LIMITS.symbols || !Number.isInteger(source) || source < -1 || source >= symbols.length || !Number.isInteger(radius) || radius < 1 || radius > 30) fail('Choose a bounded expanded-word excerpt.');
  if (source === -1) return { before: '', current: '', after: symbols.slice(0, radius), left: false, right: symbols.length > radius };
  return { before: symbols.slice(Math.max(0, source - radius), source), current: symbols[source], after: symbols.slice(source + 1, source + radius + 1), left: source > radius, right: source + radius + 1 < symbols.length };
}

export function drawingStyle(drawing, palette = 'moss') {
  const colors = { moss: ['#14201a', '#c6e494', '#f0b689'], blueprint: ['#152a3b', '#9fd9ec', '#f0d792'], ink: ['#eee9dc', '#304239', '#af5939'] };
  const [background, stroke, bud] = colors[palette] ?? colors.moss;
  const { minX, minY, maxX, maxY } = drawing.bounds;
  const span = Math.max(maxX - minX, maxY - minY, 1), pad = span * .09 + 3;
  return { background, stroke, bud, x: minX - pad, y: minY - pad, width: maxX - minX + pad * 2, height: maxY - minY + pad * 2, thickness: Math.max(span / 450, .3), radius: Math.max(span / 180, .7) };
}

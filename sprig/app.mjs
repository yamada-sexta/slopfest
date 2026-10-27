import { grow, parse } from './language.mjs';
import { preparePen, frameAt, snapshotSVG, sourceWindow, drawingStyle } from './pen.mjs';
import { specimens } from './specimens.mjs';
const $ = id => document.getElementById(id), canvas = $('pen-canvas'), ctx = canvas.getContext('2d');
let current = null, pen = null, position = 0, currentPalette = 'moss', currentSource = '', valid = false, timer;
let playing = false, frameId, lastTime = null, lastPaint = 0, budget = 0;
specimens.forEach((specimen, i) => { const option = document.createElement('option'); option.value = i; option.textContent = specimen.name; $('specimen').append(option); });
const message = text => { $('pen-message').textContent = text; };
function pause() { playing = false; cancelAnimationFrame(frameId); lastTime = null; budget = 0; }
function paint() {
  if (!pen) return;
  const frame = frameAt(pen, position), style = drawingStyle(current.drawing, currentPalette), rect = canvas.getBoundingClientRect();
  const ratio = Math.min(window.devicePixelRatio || 1, 2), width = Math.max(1, Math.round(rect.width * ratio)), height = Math.max(1, Math.round(rect.height * ratio));
  if (canvas.width !== width || canvas.height !== height) { canvas.width = width; canvas.height = height; }
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.fillStyle = style.background; ctx.fillRect(0, 0, width, height);
  const scale = Math.min(width / style.width, height / style.height);
  ctx.setTransform(scale, 0, 0, scale, (width - style.width * scale) / 2 - style.x * scale, (height - style.height * scale) / 2 - style.y * scale);
  ctx.strokeStyle = style.stroke; ctx.lineWidth = style.thickness; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.beginPath();
  for (let i = 0; i < frame.strokes; i++) { const s = current.drawing.segments[i]; ctx.moveTo(s.x1, s.y1); ctx.lineTo(s.x2, s.y2); }
  ctx.stroke(); ctx.fillStyle = style.bud; ctx.beginPath();
  for (let i = 0; i < frame.buds; i++) { const p = current.drawing.buds[i]; ctx.moveTo(p.x + style.radius, p.y); ctx.arc(p.x, p.y, style.radius, 0, Math.PI * 2); }
  ctx.fill();
  if ($('show-pen').checked && frame.marker) {
    ctx.strokeStyle = style.bud; ctx.lineWidth = 1.5 * ratio / scale; ctx.beginPath(); ctx.arc(frame.marker.x, frame.marker.y, 6 * ratio / scale, 0, Math.PI * 2); ctx.stroke();
  }
  canvas.setAttribute('aria-label', `Sprig drawing: ${frame.strokes} of ${current.drawing.segments.length} strokes, ${frame.buds} of ${current.drawing.buds.length} buds. Mark ${position} of ${pen.total}. Left and right step; Home and End jump; Space plays or pauses.`);
}
function display() {
  if (!pen) return;
  paint(); const frame = frameAt(pen, position), hasMarks = pen.total > 0;
  $('pen-progress').max = pen.total; $('pen-progress').value = position; $('pen-progress').disabled = !valid || !hasMarks;
  $('pen-progress').setAttribute('aria-valuetext', `${position} of ${pen.total} marks drawn`);
  $('pen-count').value = `${position.toLocaleString()} / ${pen.total.toLocaleString()} marks`;
  $('pen-start').disabled = $('pen-back').disabled = !valid || position === 0;
  $('pen-next').disabled = $('pen-finish').disabled = !valid || position === pen.total;
  $('pen-play').disabled = !valid || !hasMarks; $('pen-play').textContent = playing ? 'Ⅱ Pause' : '▶ Draw';
  $('export').disabled = !valid;
  const excerpt = sourceWindow(current.symbols, frame.marker?.source ?? -1);
  $('pen-word').replaceChildren(document.createTextNode(`${excerpt.left ? '…' : ''}${excerpt.before}`));
  if (excerpt.current) { const mark = document.createElement('mark'); mark.textContent = excerpt.current; $('pen-word').append(mark); }
  $('pen-word').append(document.createTextNode(`${excerpt.after}${excerpt.right ? '…' : ''}`));
  $('pen-symbol').textContent = frame.marker ? `EXPANDED SYMBOL ${frame.marker.source + 1} / ${current.symbols.length} · ${frame.marker.kind.toUpperCase()}${frame.marker.branch === null ? '' : ` · BRANCH ${frame.marker.branch}`}` : hasMarks ? 'BEFORE THE FIRST MARK' : 'NO VISIBLE MARKS';
}
function seek(next) {
  if (!valid) return; pause(); position = next; display();
  const frame = frameAt(pen, position);
  message(position === 0 ? 'At the start. The camera keeps the full drawing in view.' : position === pen.total ? 'Every stroke and bud is here. Draw replays it from the start.' : `${frame.strokes} ${frame.strokes === 1 ? 'stroke' : 'strokes'} and ${frame.buds} ${frame.buds === 1 ? 'bud' : 'buds'} drawn. Step either way or continue drawing.`);
}
function frame(time) {
  if (!playing) return;
  if (lastTime === null) lastTime = time;
  budget += Math.min(100, time - lastTime) / 1000 * Math.max(4, pen.total / 12); lastTime = time;
  if (time - lastPaint >= 1000 / 30) {
    const count = Math.floor(budget); budget -= count; position = Math.min(pen.total, position + count); lastPaint = time;
    if (position === pen.total) { pause(); message('Drawing complete. Scrub backward, or save this moment as SVG.'); }
    display();
  }
  if (playing) frameId = requestAnimationFrame(frame);
}
function play() {
  if (!valid || !pen.total) return;
  if (playing) { pause(); display(); message('Pen paused. Scrub, step, or save this unfinished drawing.'); return; }
  if (position === pen.total) position = 0;
  playing = true; lastTime = null; lastPaint = 0; budget = 0;
  message('Following the marks in order. Moves and branch returns jump to the next stroke or bud.'); display(); frameId = requestAnimationFrame(frame);
}
function render({ preservePosition = false } = {}) {
  pause(); $('drawing').setAttribute('aria-busy', 'true');
  try {
    const result = grow($('source').value, { palette: $('palette').value }), nextPen = preparePen(result.drawing);
    const retain = preservePosition && currentSource === $('source').value;
    current = result; pen = nextPen; position = retain ? Math.min(position, pen.total) : pen.total;
    currentPalette = $('palette').value; currentSource = $('source').value; valid = true;
    const { depth, angle } = result.program;
    $('depth').value = depth; $('angle').value = angle; $('depth-value').value = depth; $('angle-value').value = `${angle}°`;
    $('stats').textContent = `${result.drawing.segments.length.toLocaleString()} STROKES · ${result.symbols.length.toLocaleString()} SYMBOLS`;
    $('error').hidden = true; $('source').removeAttribute('aria-invalid');
    message(!pen.total ? 'No visible marks. F draws a stroke; a dot places a bud.' : retain && position < pen.total ? `Palette changed. Pen stays at mark ${position} of ${pen.total}. Draw continues from here.` : 'Full drawing ready. Draw replays it; Start reveals a blank page.');
  } catch (error) {
    valid = false; $('error').textContent = error.message; $('error').hidden = false; $('source').setAttribute('aria-invalid', 'true');
    $('stats').textContent = 'SEED NEEDS ATTENTION · LAST GOOD DRAWING'; message('Fix the seed packet to resume. The last good drawing stays here.');
  } finally { display(); $('drawing').setAttribute('aria-busy', 'false'); }
}
function load() {
  clearTimeout(timer); const index = Number($('specimen').value), specimen = specimens[index]; $('source').value = specimen.source;
  $('specimen-number').textContent = `SPECIMEN ${String(index + 1).padStart(2, '0')} / 05`; $('specimen-note').textContent = specimen.note; render();
}
function changeSetting(key, value) {
  clearTimeout(timer);
  try {
    parse($('source').value); const pattern = new RegExp(`^[\\t ]*${key}[\\t ]+.*$`, 'm');
    $('source').value = pattern.test($('source').value) ? $('source').value.replace(pattern, `${key} ${value}`) : `${$('source').value}\n${key} ${value}`;
  } catch { /* Leave malformed text intact; render explains the error. */ }
  render();
}
$('source').addEventListener('input', () => { clearTimeout(timer); pause(); valid = false; display(); message('Seed changed. Preparing the new drawing…'); timer = setTimeout(render, 180); });
$('specimen').addEventListener('change', load); $('restore').addEventListener('click', load);
$('palette').addEventListener('change', () => { clearTimeout(timer); render({ preservePosition: true }); });
$('depth').addEventListener('input', event => changeSetting('depth', event.target.value)); $('angle').addEventListener('input', event => changeSetting('angle', event.target.value));
$('pen-start').addEventListener('click', () => seek(0)); $('pen-back').addEventListener('click', () => seek(position - 1));
$('pen-next').addEventListener('click', () => seek(position + 1)); $('pen-finish').addEventListener('click', () => seek(pen.total));
$('pen-progress').addEventListener('input', event => seek(Number(event.target.value))); $('pen-play').addEventListener('click', play); $('show-pen').addEventListener('change', paint);
canvas.addEventListener('keydown', event => {
  if (!valid || event.ctrlKey || event.metaKey || event.altKey) return;
  const positions = { ArrowLeft: Math.max(0, position - 1), ArrowRight: Math.min(pen.total, position + 1), Home: 0, End: pen.total };
  if (Object.hasOwn(positions, event.key)) { event.preventDefault(); seek(positions[event.key]); }
  else if (event.key === ' ' && !event.repeat) { event.preventDefault(); play(); }
});
$('export').addEventListener('click', () => {
  if (!valid) return;
  const svg = position === pen.total ? current.svg : snapshotSVG(pen, position, { palette: currentPalette });
  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' })), a = document.createElement('a');
  a.href = url; a.download = 'sprig-drawing.svg'; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  message(`Saved ${position} of ${pen.total} marks as SVG. The last-mark ring stays in the workbench.`);
});
document.addEventListener('visibilitychange', () => { if (document.hidden && playing) { pause(); display(); message('Pen paused while this page was hidden. Draw continues when you choose.'); } });
new ResizeObserver(paint).observe(canvas);
load();

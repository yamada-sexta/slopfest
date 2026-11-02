import { pair, centered } from './core.mjs';
import { createLoom, advance, forgetTrail, resetLoom, atHome, clothSVG } from './loom.mjs';

const $ = id => document.getElementById(id);
let loom, dirty = false, running = 0, frame = 0, last = 0;
const controls = ['back', 'forward', 'outward', 'homeward', 'forget', 'reset', 'save'];
function pause() { running = 0; cancelAnimationFrame(frame); frame = 0; }
function syncFields() {
  $('rule').value = loom.rule; $('depth').value = loom.depth;
  $('past').value = loom.origin.past; $('current').value = loom.origin.current;
  dirty = false; $('error').textContent = '';
}
function render(message) {
  $('cloth').innerHTML = clothSVG(loom);
  $('clock').textContent = `TIME ${loom.time} / ${loom.depth}`;
  $('recorded').textContent = loom.trail.length;
  $('live-past').textContent = loom.state.past; $('live-current').textContent = loom.state.current;
  for (const id of controls) $(id).disabled = dirty;
  $('back').disabled ||= loom.time === 0;
  $('homeward').disabled ||= loom.time === 0;
  $('forward').disabled ||= loom.time === loom.depth;
  $('outward').disabled ||= loom.time === loom.depth;
  $('forget').disabled ||= loom.trail.length === 1;
  $('pause').disabled = !running;
  $('apply').disabled = !dirty; $('discard').disabled = !dirty;
  $('outward').setAttribute('aria-pressed', String(running === 1));
  $('homeward').setAttribute('aria-pressed', String(running === -1));
  if (message) $('status').textContent = message;
}
function whereabouts() {
  if (atHome(loom)) return loom.hasMoved ? 'Both rows came home exactly. Every bit matches the starting pair.' : 'Ready at the starting pair. Weave outward to begin.';
  if (loom.time === loom.depth) return 'At the far edge. Forget the trail, then weave home: the live pair is all the rule needs.';
  return `Time ${loom.time}. ${loom.trail.length} rows recorded; the live pair is ready to move either way.`;
}
function loadSpecimen(rule) {
  pause();
  const state = rule === 0 ? pair('1000001', '0010100') : centered(65);
  loom = createLoom({ state, rule, depth: 64 });
  for (let i = 0; i < 32; i++) loom = advance(loom, 1);
  syncFields(); render('Already 32 stitches out. Try Forget the trail, then Weave home.');
}
function single(direction) {
  pause(); loom = advance(loom, direction); render(whereabouts());
}
function tick(now) {
  if (!running) return;
  if (now - last >= 75) {
    last = now; const next = advance(loom, running);
    if (next === loom) { pause(); render(whereabouts()); return; }
    loom = next;
    if (loom.time === 0 || loom.time === loom.depth) { pause(); render(whereabouts()); return; }
    render();
  }
  frame = requestAnimationFrame(tick);
}
function play(direction) {
  pause(); running = direction; last = 0;
  render(direction === 1 ? 'Weaving outward. Pause or take one stitch at a time.' : 'Weaving home from the live pair. The drawing is not used to reverse.');
  frame = requestAnimationFrame(tick);
}
$('back').addEventListener('click', () => single(-1));
$('forward').addEventListener('click', () => single(1));
$('outward').addEventListener('click', () => play(1));
$('homeward').addEventListener('click', () => play(-1));
$('pause').addEventListener('click', () => { pause(); render(whereabouts()); });
$('forget').addEventListener('click', () => { pause(); loom = forgetTrail(loom); render('The cloth is blank except for now. Both live rows are unchanged. Weave home to reconstruct the missing marks.'); });
$('reset').addEventListener('click', () => { pause(); loom = resetLoom(loom); render(whereabouts()); });
$('specimen').addEventListener('change', () => loadSpecimen(Number($('specimen').value)));
for (const id of ['past', 'current', 'rule', 'depth']) $(id).addEventListener('input', () => {
  pause(); dirty = true; $('error').textContent = ''; render('Starting pair edited. Apply it or discard edits before weaving.');
});
$('discard').addEventListener('click', () => { syncFields(); render(`Edits discarded. ${whereabouts()}`); });
$('seed-form').addEventListener('submit', event => {
  event.preventDefault(); pause();
  try {
    const next = createLoom({ state: pair($('past').value, $('current').value), rule: Number($('rule').value), depth: Number($('depth').value) });
    loom = next; $('specimen').value = 'custom'; syncFields(); render('New pair loaded at time zero. Weave outward, then bring both rows home.');
  } catch (error) { $('error').textContent = error.message; render('The loaded loom is intact. Fix the pair or discard edits.'); }
});
$('save').addEventListener('click', () => {
  pause();
  const blob = new Blob([clothSVG(loom)], { type: 'image/svg+xml' }), url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = 'backstitch-cloth.svg'; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  render('Saved the visible cloth and both live rows. Unrecorded gaps stay blank.');
});
document.addEventListener('visibilitychange', () => { if (document.hidden && running) { pause(); render('Paused while the loom was out of view.'); } });
loadSpecimen(110);

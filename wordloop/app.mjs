import { SIZE, CENTER, RADIUS, COLORS, makeLoop, windowAt, locate, move, bead, positionAt, selection, toSVG } from './core.mjs';
const $ = id => document.getElementById(id), canvas = $('ring'), ctx = canvas.getContext('2d');
let loop, head = 0, seen, walking = false, remaining = 0, frameId, lastTime = null, budget = 0;
const message = text => { $('status').textContent = text; };
function draw() {
  const count = loop.tape.length, active = new Set(selection(loop, head)), radius = Math.max(1.1, Math.min(13, 620 / count));
  ctx.fillStyle = '#202129'; ctx.fillRect(0, 0, SIZE, SIZE);
  ctx.strokeStyle = '#55525c'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(CENTER, CENTER, RADIUS, 0, Math.PI * 2); ctx.stroke();
  for (let i = 0; i < count; i++) {
    const point = bead(i, count), symbol = loop.tape[i], color = COLORS[loop.alphabet.indexOf(symbol)];
    ctx.globalAlpha = active.has(i) ? 1 : seen[i] ? .75 : .27; ctx.fillStyle = color;
    ctx.beginPath(); ctx.arc(point.x, point.y, radius, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1;
    if (active.has(i)) { ctx.strokeStyle = '#f3d6b3'; ctx.lineWidth = i === head ? 3 : 1.5; ctx.beginPath(); ctx.arc(point.x, point.y, radius + 5, 0, Math.PI * 2); ctx.stroke(); }
    if (count <= 64) { ctx.fillStyle = active.has(i) || seen[i] ? '#25232b' : '#e1d7d7'; ctx.font = `${count <= 32 ? 12 : 9}px ui-monospace, monospace`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(symbol, point.x, point.y); }
  }
  const start = bead(0, count);
  ctx.fillStyle = '#b8b2b9'; ctx.font = '10px ui-monospace, monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('JOIN ↻', start.x, start.y - 32);
  ctx.fillStyle = '#f3d6b3'; ctx.font = '58px ui-monospace, monospace'; ctx.fillText(windowAt(loop.tape, loop.order, head), CENTER, CENTER - 8);
  ctx.fillStyle = '#b8b2b9'; ctx.font = '10px ui-monospace, monospace'; ctx.fillText('READ CLOCKWISE', CENTER, CENTER + 39);
  const unit = 26, legendWidth = loop.alphabet.length * 66;
  [...loop.alphabet].forEach((symbol, i) => { const x = CENTER - legendWidth / 2 + i * 66 + 10; ctx.fillStyle = COLORS[i]; ctx.beginPath(); ctx.arc(x, CENTER + 85, 4, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#b8b2b9'; ctx.font = '12px ui-monospace, monospace'; ctx.fillText(symbol, x + unit, CENTER + 85); });
}
function render() {
  draw(); const count = loop.tape.length, word = windowAt(loop.tape, loop.order, head), visited = seen.reduce((sum, value) => sum + value, 0);
  $('position').textContent = `${head + 1} / ${count}`; $('seen').value = `${visited} / ${count}`; $('visited').value = visited; $('visited').max = count;
  $('walk').textContent = walking ? 'Ⅱ Pause walk' : 'Walk a lap';
  $('join-note').textContent = head + loop.order > count ? 'THIS WORD CROSSES THE JOIN ↻' : `${loop.order} ${loop.order === 1 ? 'BEAD' : 'BEADS'}, ONE WORD`;
  canvas.setAttribute('aria-label', `Circular ribbon, ${count} beads. Position ${head + 1}, word ${word}. ${visited} of ${count} words visited. Left and right step; Home and End jump; Space walks or pauses.`);
  $('ribbon').replaceChildren();
  // Three context beads on either side make even a seam-crossing word legible.
  for (let offset = -3; offset < loop.order + 3; offset++) {
    const index = move(head, offset, count), tile = document.createElement('div');
    tile.className = `tile${offset >= 0 && offset < loop.order ? ' active' : ''}${offset === 0 ? ' start' : ''}`;
    tile.style.setProperty('--bead', COLORS[loop.alphabet.indexOf(loop.tape[index])]);
    const symbol = document.createElement('strong'); symbol.textContent = loop.tape[index];
    const position = document.createElement('small'); position.textContent = index + 1;
    tile.append(symbol, position);
    if (index === 0) { const seam = document.createElement('span'); seam.className = 'seam'; seam.textContent = '↻'; seam.setAttribute('aria-label', 'Ribbon join before this bead'); tile.append(seam); }
    $('ribbon').append(tile);
  }
}
function pause() { walking = false; cancelAnimationFrame(frameId); lastTime = null; budget = 0; }
function choose(position, text) { pause(); head = position; seen[head] = 1; render(); message(text ?? `Position ${head + 1}: ${windowAt(loop.tape, loop.order, head)}.${head + loop.order > loop.tape.length ? ' This word crosses the join.' : ''}`); }
function frame(time) {
  if (!walking) return;
  if (lastTime === null) lastTime = time;
  budget += Math.min(100, time - lastTime) / 1000 * Math.max(4, loop.tape.length / 12); lastTime = time;
  const steps = Math.min(remaining, Math.floor(budget)); budget -= steps;
  for (let i = 0; i < steps; i++) { head = move(head, 1, loop.tape.length); seen[head] = 1; remaining--; }
  if (remaining === 0) { pause(); message('One lap, every word visited. Back at the bead where this walk began.'); }
  render(); if (walking) frameId = requestAnimationFrame(frame);
}
function walk() {
  if (walking) { pause(); render(); message('Walk paused. Step or look up a word for a closer look.'); return; }
  seen.fill(0); seen[head] = 1; remaining = loop.tape.length; walking = true; budget = 0; lastTime = null;
  message('Walking clockwise for one lap. Pause or step to inspect a word.'); render(); frameId = requestAnimationFrame(frame);
}
function load() {
  pause(); loop = makeLoop($('alphabet').value, Number($('order').value)); head = 0; seen = new Uint8Array(loop.tape.length); seen[0] = 1;
  $('possible').value = loop.proof.possible; $('audit').textContent = `${loop.proof.distinct} distinct · ${loop.proof.missing} missing · ${loop.proof.repeats} repeated`;
  $('find').value = loop.alphabet.at(-1).repeat(loop.order); $('find-note').textContent = `Try any ${loop.order}-symbol word using ${loop.alphabet.split('').join(', ')}.`;
  $('find-note').className = 'small'; $('find').removeAttribute('aria-invalid');
  $('saving').textContent = `Here, ${loop.alphabet.length} symbols and a ${loop.order}-bead window make ${loop.proof.possible} words. Writing them separately would take ${loop.proof.possible * loop.order} symbols; the ring needs just ${loop.proof.possible}.`;
  render(); message('A complete ribbon, freshly audited. Walk a lap, step through it, or find a word.');
}
$('alphabet').addEventListener('change', load); $('order').addEventListener('change', load);
$('back').addEventListener('click', () => choose(move(head, -1, loop.tape.length)));
$('next').addEventListener('click', () => choose(move(head, 1, loop.tape.length)));
$('walk').addEventListener('click', walk);
$('restart').addEventListener('click', () => { seen.fill(0); choose(0, 'Walk restarted at the first bead. The ribbon itself is unchanged.'); });
$('find-form').addEventListener('submit', event => {
  event.preventDefault();
  try { const word = $('find').value.trim().toUpperCase(), position = locate(loop, word); $('find').value = word; choose(position, `Found ${word} at position ${position + 1}.${position + loop.order > loop.tape.length ? ' The word wraps across the join.' : ''}`); $('find-note').textContent = 'Found exactly once. Its bright beads are shown on the ring.'; $('find-note').className = 'small'; $('find').removeAttribute('aria-invalid'); }
  catch (error) { pause(); render(); message('The current window and visits are unchanged. Check the word and try again.'); $('find-note').textContent = error.message; $('find-note').className = 'small error'; $('find').setAttribute('aria-invalid', 'true'); }
});
canvas.addEventListener('pointerdown', event => {
  if (event.button !== 0) return; const bounds = canvas.getBoundingClientRect();
  const position = positionAt((event.clientX - bounds.left) / bounds.width * SIZE, (event.clientY - bounds.top) / bounds.height * SIZE, loop.tape.length);
  canvas.focus({ preventScroll: true }); if (position !== null) choose(position);
});
canvas.addEventListener('keydown', event => {
  if (event.ctrlKey || event.metaKey || event.altKey) return;
  const positions = { ArrowLeft: move(head, -1, loop.tape.length), ArrowRight: move(head, 1, loop.tape.length), Home: 0, End: loop.tape.length - 1 };
  if (Object.hasOwn(positions, event.key)) { event.preventDefault(); choose(positions[event.key]); }
  else if (event.key === ' ' && !event.repeat) { event.preventDefault(); walk(); }
});
$('save').addEventListener('click', () => {
  const url = URL.createObjectURL(new Blob([toSVG(loop, head)], { type: 'image/svg+xml' })), link = document.createElement('a');
  link.href = url; link.download = 'wordloop.svg'; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); message('Saved this ribbon and its current word as an SVG. The visit meter stays in the browser.');
});
document.addEventListener('visibilitychange', () => { if (document.hidden && walking) { pause(); render(); message('Walk paused while this page was hidden. Start a lap when you return.'); } });
load();

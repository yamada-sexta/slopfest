import { PRESETS, cloth, turn, loops, svg } from './core.mjs';
const $ = id => document.getElementById(id), board = $('board');
let world, traced, history = [], mode = 'turn', selectedArc = null, seed = 42, cursor = 0, keyboard = false, walkOffset = null;
const selectedLoop = () => selectedArc === null ? null : traced.owners[selectedArc];
const PORTS = ['north', 'east', 'south', 'west'];
const message = text => { $('status').textContent = text; };
function render() {
  traced = loops(world);
  const { threads } = traced, selected = selectedLoop(), thread = selected === null ? null : threads[selected];
  const step = thread && walkOffset !== null ? thread.steps[(thread.pieces.indexOf(selectedArc) + walkOffset) % thread.steps.length] : null;
  let image = svg(world, { selected, grid: $('grid').checked, active: step?.arc ?? null });
  const hits = world.tiles.map((_, cell) => `<rect data-cell="${cell}" x="${cell % world.width}" y="${Math.floor(cell / world.width)}" width="1" height="1" fill="transparent"/>`).join('');
  image = image.replace('<g fill=', `${hits}<g fill=`);
  if (keyboard) image = image.replace('</svg>', `<rect x="${cursor % world.width + 0.05}" y="${Math.floor(cursor / world.width) + 0.05}" width=".9" height=".9" fill="none" stroke="#fff4d7" stroke-width=".035" stroke-dasharray=".08 .06" pointer-events="none"/></svg>`);
  board.innerHTML = image;
  board.setAttribute('aria-label', `Cloth with ${threads.length} loops. ${mode} mode, column ${cursor % world.width + 1}, row ${Math.floor(cursor / world.width) + 1}. Arrow keys move. Enter acts; in Follow mode Space picks the second arc. Z undoes.`);
  $('count').textContent = threads.length; $('winding').textContent = threads.filter(t => t.horizontal || t.vertical).length;
  $('longest').textContent = Math.max(...threads.map(t => t.pieces.length));
  $('dimensions').textContent = `${world.width} × ${world.height} TILES`; $('seed').textContent = `SEED ${seed}`;
  $('undo').disabled = history.length === 0;
  $('turn').setAttribute('aria-pressed', String(mode === 'turn')); $('follow').setAttribute('aria-pressed', String(mode === 'follow'));
  $('thread-title').textContent = thread ? `Loop ${selected + 1} · ${thread.pieces.length} arcs` : 'Pick up a thread';
  $('walk-start').disabled = !thread; $('walk-start').textContent = walkOffset === null ? 'Walk this loop' : 'Restart walk';
  $('walk-back').disabled = !step; $('walk-next').disabled = !step;
  $('walk-note').textContent = step ? `Stitch ${walkOffset + 1} of ${thread.steps.length}: row ${Math.floor(step.cell / world.width) + 1}, column ${step.cell % world.width + 1}. Enter ${PORTS[step.entry]}, leave ${PORTS[step.exit]}. ` + (step.wrapX || step.wrapY ? `Across the ${PORTS[step.exit]} seam → enter ${PORTS[(step.exit + 2) % 4]} at row ${Math.floor(step.nextCell / world.width) + 1}, column ${step.nextCell % world.width + 1}.` : `Next: row ${Math.floor(step.nextCell / world.width) + 1}, column ${step.nextCell % world.width + 1}.`) : 'Select a loop, then walk its stitches. The white arc marks your place.';
  $('walk-note').classList.toggle('at-seam', Boolean(step && (step.wrapX || step.wrapY)));
  $('thread-detail').textContent = thread ? (thread.horizontal || thread.vertical ? `Winds ${Math.abs(thread.horizontal)} times horizontally and ${Math.abs(thread.vertical)} times vertically before returning. Opposite edges belong together.` : 'Returns with no net winding around either seam. It may cross an edge and return across it.') : 'Choose Follow a loop, then touch a curve. Its whole journey lights up.';
}
function reset(scatter = false) {
  const preset = PRESETS[Number($('preset').value)];
  seed = scatter ? (seed + 1) >>> 0 : preset.seed;
  world = cloth(preset.width, preset.height, seed, scatter ? 'scatter' : preset.pattern);
  history = []; cursor = 0; selectedArc = null; keyboard = false; walkOffset = null;
  message(scatter ? 'A fresh scattering. Turning a tile changes the journey; Undo brings it back.' : 'Cloth ready. Turn a tile, or follow a loop across the seams.'); render();
}
function act(cell, arc = 0) {
  cursor = cell; walkOffset = null;
  if (mode === 'turn') {
    const before = traced.threads.length; history.push(world); if (history.length > 200) history.shift();
    world = turn(world, cell); selectedArc = null;
    const delta = loops(world).threads.length - before;
    message(delta < 0 ? 'Two loops joined into one. One corner changed both journeys.' : delta > 0 ? 'One loop split into two. A small turn, two homecomings.' : 'The thread took a new route. The number of loops stayed the same.');
  } else { selectedArc = cell * 2 + arc; message('This whole loop is lit. Use the arrows below the inspector to visit its neighbors.'); }
  render();
}
function undo() {
  if (!history.length) { message('No turns to undo.'); return; }
  world = history.pop(); selectedArc = null; walkOffset = null; message('Last turn undone. The previous threads are back.'); render();
}
PRESETS.forEach((preset, index) => { const option = document.createElement('option'); option.value = index; option.textContent = preset.name; $('preset').append(option); });
for (const name of ['turn', 'follow']) $(name).addEventListener('click', () => {
  mode = name; walkOffset = null; if (mode === 'turn') selectedArc = null;
  message(mode === 'turn' ? 'Touch any tile to turn its two arcs. Every thread remains connected.' : 'Touch a curve to follow it. In the keyboard cloth, Enter picks arc one; Space picks arc two.'); render();
});
board.addEventListener('click', event => {
  const target = event.target.closest('[data-cell]'); if (!target) return;
  keyboard = false; board.focus({ preventScroll: true }); act(Number(target.dataset.cell), Number(target.dataset.arc || 0));
});
board.addEventListener('keydown', event => {
  if (event.ctrlKey || event.metaKey || event.altKey) return;
  const directions = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }, direction = directions[event.key];
  if (direction) {
    event.preventDefault(); cursor = ((Math.floor(cursor / world.width) + direction[1] + world.height) % world.height) * world.width + (cursor % world.width + direction[0] + world.width) % world.width; keyboard = true; render();
  } else if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); if (!event.repeat) { keyboard = true; act(cursor, event.key === ' ' ? 1 : 0); } }
  else if (event.key.toLowerCase() === 'z') { event.preventDefault(); undo(); }
});
board.addEventListener('blur', () => { keyboard = false; render(); });
for (const [id, direction] of [['previous', -1], ['next', 1]]) $(id).addEventListener('click', () => {
  mode = 'follow'; walkOffset = null; const count = traced.threads.length, selected = selectedLoop();
  const index = selected === null ? direction === 1 ? 0 : count - 1 : (selected + direction + count) % count;
  selectedArc = traced.threads[index].pieces[0]; message('Following a closed thread. Show all returns the other colors.'); render();
});
$('all').addEventListener('click', () => { selectedArc = null; walkOffset = null; message('All threads visible.'); render(); });
$('walk-start').addEventListener('click', () => { walkOffset = 0; message('Walking from the chosen arc. Next stitch follows the thread; Previous stitch moves back one arc.'); render(); });
for (const [id, direction] of [['walk-back', -1], ['walk-next', 1]]) $(id).addEventListener('click', () => {
  const length = traced.threads[selectedLoop()].steps.length;
  walkOffset = (walkOffset + direction + length) % length;
  message(walkOffset === 0 ? 'Back at the starting stitch. Continue to go around again.' : 'One stitch along the same thread. The cloth stays unchanged.'); render();
});
$('undo').addEventListener('click', undo); $('reset').addEventListener('click', () => reset()); $('shuffle').addEventListener('click', () => reset(true)); $('preset').addEventListener('change', () => reset()); $('grid').addEventListener('change', render);
$('save').addEventListener('click', () => {
  const blob = new Blob([svg(world, { selected: selectedLoop(), grid: $('grid').checked })], { type: 'image/svg+xml' }), url = URL.createObjectURL(blob), link = document.createElement('a');
  link.href = url; link.download = 'looploom.svg'; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); message('Saved the cloth as SVG, including the loop highlight and grid, without the walking marker.');
});
reset();

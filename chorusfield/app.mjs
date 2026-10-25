import { WIDTH, HEIGHT, TAU, DT, SCENES, scene, advance, agreement, neighbors, nudge, scatter, nearest, clockStyle, toSVG } from './core.mjs';
const $ = id => document.getElementById(id), canvas = $('field'), ctx = canvas.getContext('2d');
let world, selected = 31, playing = false, frameId, lastTime = null, budget = 0, history = [];
const options = () => ({ radius: Number($('radius').value), pull: Number($('pull').value), spread: Number($('spread').value) });
const message = text => { $('status').textContent = text; };
function record() {
  const value = { tick: world.tick, value: agreement(world) };
  if (history.at(-1)?.tick === world.tick) history[history.length - 1] = value;
  else history.push(value);
  history = history.filter(item => item.tick >= world.tick - 3600);
}
function draw() {
  ctx.clearRect(0, 0, WIDTH, HEIGHT); ctx.fillStyle = '#101e1c'; ctx.fillRect(0, 0, WIDTH, HEIGHT);
  ctx.fillStyle = '#476153';
  for (let y = 20; y < HEIGHT; y += 26) for (let x = 20; x < WIDTH; x += 26) { ctx.globalAlpha = .19; ctx.fillRect(x, y, 1, 1); }
  ctx.globalAlpha = 1;
  const node = world.nodes[selected], peers = neighbors(world, options().radius)[selected];
  if ($('links').checked) {
    ctx.strokeStyle = '#a3bc8340'; ctx.fillStyle = '#b2c69405'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(node.x, node.y, options().radius, 0, TAU); ctx.fill(); ctx.setLineDash([4, 6]); ctx.stroke(); ctx.setLineDash([]);
    for (const index of peers) { const peer = world.nodes[index]; ctx.beginPath(); ctx.moveTo(node.x, node.y); ctx.lineTo(peer.x, peer.y); ctx.stroke(); }
  }
  world.nodes.forEach((clock, index) => {
    const { flash, color } = clockStyle(clock.phase);
    const halo = ctx.createRadialGradient(clock.x, clock.y, 0, clock.x, clock.y, 27);
    halo.addColorStop(0, `rgba(226,221,150,${.04 + flash * .23})`); halo.addColorStop(1, 'rgba(226,221,150,0)');
    ctx.fillStyle = halo; ctx.beginPath(); ctx.arc(clock.x, clock.y, 27, 0, TAU); ctx.fill();
    ctx.strokeStyle = color; ctx.lineWidth = index === selected ? 1.8 : 1;
    ctx.globalAlpha = index === selected ? .9 : .35; ctx.beginPath(); ctx.arc(clock.x, clock.y, 15, 0, TAU); ctx.stroke(); ctx.globalAlpha = 1;
    ctx.fillStyle = color; ctx.beginPath(); ctx.arc(clock.x, clock.y, 3 + flash * 2, 0, TAU); ctx.fill();
    ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(clock.x, clock.y); ctx.lineTo(clock.x + Math.sin(clock.phase) * 12, clock.y - Math.cos(clock.phase) * 12); ctx.stroke();
    if (index === selected) { ctx.strokeStyle = '#f1c18e'; ctx.lineWidth = 1.5; ctx.strokeRect(clock.x - 21, clock.y - 21, 42, 42); }
  });
}
function render() {
  draw(); $('time').textContent = `${(world.tick * DT).toFixed(2).padStart(6, '0')} s`;
  $('motion').textContent = playing ? 'The meadow is listening' : 'The meadow is paused'; $('play').textContent = playing ? 'Ⅱ Pause' : '▶ Run';
  $('agreement').value = (agreement(world) * 100).toFixed(1);
  const first = Math.max(0, world.tick - 3600);
  $('history').setAttribute('d', history.map((item, i) => `${i ? 'L' : 'M'}${(720 - (world.tick - item.tick) / 3600 * 720).toFixed(2)} ${(120 - item.value * 110).toFixed(2)}`).join(''));
  $('history-now').setAttribute('cy', (120 - agreement(world) * 110).toFixed(2));
  $('history-span').textContent = `${((world.tick - first) * DT).toFixed(1)} s recorded`;
  canvas.setAttribute('aria-label', `Clock meadow, ${(world.tick * DT).toFixed(2)} seconds, ${(agreement(world) * 100).toFixed(1)} percent field agreement. Clock ${selected + 1} selected, hearing ${neighbors(world, options().radius)[selected].length} neighbors. Left and right select; Enter nudges; Space runs or pauses.`);
}
function pause(text) { playing = false; cancelAnimationFrame(frameId); lastTime = null; budget = 0; if (text) message(text); render(); }
function advanceSampled(ticks) {
  // History records once per simulated tenth-second, regardless of frame rate.
  while (ticks > 0) { const count = Math.min(ticks, 12 - world.tick % 12); advance(world, options(), count); ticks -= count; if (world.tick % 12 === 0) record(); }
}
function frame(time) {
  if (!playing) return;
  if (lastTime === null) lastTime = time;
  budget += Math.min(100, time - lastTime) / (1000 * DT); lastTime = time;
  const ticks = Math.min(12, Math.floor(budget)); budget -= ticks;
  if (ticks) advanceSampled(ticks);
  render(); frameId = requestAnimationFrame(frame);
}
function toggle() {
  if (playing) { pause('Paused. Nudge a clock, change the listening distance, or inspect a tenth-second at a time.'); return; }
  playing = true; lastTime = null; budget = 0; message('Listening. Each clock gently pulls toward the phases of its neighbors.'); render(); frameId = requestAnimationFrame(frame);
}
function load() {
  playing = false; cancelAnimationFrame(frameId); lastTime = null; budget = 0;
  const kind = Number($('scene').value), preset = SCENES[kind]; world = scene(kind); selected = kind === 1 ? 14 : 31;
  for (const id of ['radius', 'pull', 'spread']) $(id).value = preset[id];
  labels(); history = []; record(); $('scene-note').textContent = preset.note;
  message('Clocks ready, paused. Run the meadow or let it listen for ten seconds.'); render();
}
function labels() { $('radius-value').value = `${$('radius').value} units`; $('pull-value').value = Number($('pull').value).toFixed(2); $('spread-value').value = `±${Number($('spread').value).toFixed(2)}`; }
function disturb() { nudge(world, selected); record(); message(`Clock ${selected + 1} nudged a quarter turn ahead. ${playing ? 'Watch the neighbors respond.' : 'Run or Listen for 10 s to watch the response.'}`); render(); }
SCENES.forEach((preset, index) => { const option = document.createElement('option'); option.value = index; option.textContent = preset.name; $('scene').append(option); });
$('scene').addEventListener('change', load); $('reset').addEventListener('click', load); $('play').addEventListener('click', toggle);
$('step').addEventListener('click', () => { pause(); advanceSampled(12); record(); message('One tenth-second. All clocks read the same old field before they move.'); render(); });
$('settle').addEventListener('click', () => { pause(); advanceSampled(1200); record(); message('Ten simulated seconds of listening, now paused. Change a setting or disturb a clock to try again.'); render(); });
$('scatter').addEventListener('click', () => { pause(); scatter(world); record(); message('Clock phases scattered. Positions and natural speeds stayed put. Run to let them find their way again.'); render(); });
for (const id of ['radius', 'pull', 'spread']) $(id).addEventListener('input', () => { labels(); pause('Setting changed. Current clock phases remain; Run lets the new rule take effect.'); });
$('links').addEventListener('change', render);
canvas.addEventListener('pointerdown', event => {
  if (event.button !== 0) return; const bounds = canvas.getBoundingClientRect();
  selected = nearest(world, (event.clientX - bounds.left) / bounds.width * WIDTH, (event.clientY - bounds.top) / bounds.height * HEIGHT);
  canvas.focus({ preventScroll: true }); disturb();
});
canvas.addEventListener('keydown', event => {
  if (event.ctrlKey || event.metaKey || event.altKey) return;
  if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') { event.preventDefault(); selected = (selected + (event.key === 'ArrowRight' ? 1 : -1) + world.nodes.length) % world.nodes.length; render(); }
  else if (event.key === 'Enter' && !event.repeat) { event.preventDefault(); disturb(); }
  else if (event.key === ' ' && !event.repeat) { event.preventDefault(); toggle(); }
});
$('save').addEventListener('click', () => {
  const url = URL.createObjectURL(new Blob([toSVG(world)], { type: 'image/svg+xml' })), link = document.createElement('a');
  link.href = url; link.download = 'chorusfield.svg'; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  message('Saved a still meadow as SVG, with clock hands and field agreement. Selection and listening guides stay in the workbench.');
});
document.addEventListener('visibilitychange', () => { if (document.hidden && playing) pause('Paused while this page was hidden. Run when you return.'); });
load();

export const WIDTH = 960, HEIGHT = 560, TAU = Math.PI * 2, DT = 1 / 120;
export const SCENES = Object.freeze([
  { name: 'One clearing', radius: 260, pull: 4, spread: 0.03, note: 'A scattered rhythm with a small difference between clocks. Let the neighbors find a common pace.' },
  { name: 'Two choirs', radius: 180, pull: 4, spread: 0, note: 'Each island can agree with itself while the whole field disagrees. Widen the listening distance to bring the islands together.' },
  { name: 'Nobody listening', radius: 260, pull: 0, spread: 0.12, note: 'Without a neighbor’s pull, every clock follows its own pace. Turn up the pull and see what changes.' },
]);
const fail = message => { throw new RangeError(message); };
const finite = value => typeof value === 'number' && Number.isFinite(value);
export const wrap = phase => ((phase % TAU) + TAU) % TAU;
function random(seed) {
  let value = seed >>> 0;
  return () => { value = (Math.imul(value, 1664525) + 1013904223) >>> 0; return value / 4294967296; };
}
export function scene(kind = 0) {
  if (!Number.isInteger(kind) || !SCENES[kind]) fail('Choose one of the three clearings.');
  const rng = random(61 + kind), nodes = [];
  for (let i = 0; i < 72; i++) {
    let x, y, phase;
    if (kind === 1) {
      const island = Math.floor(i / 36), local = i % 36;
      x = 140 + island * 500 + local % 6 * 36;
      y = 175 + Math.floor(local / 6) * 42;
      // Offset the islands by 0.42 turns; exact opposition is an unstable balance.
      phase = (island * 0.42 + (local % 6 - 2.5) * 0.018) * TAU;
    } else {
      x = 95 + i % 9 * 96 + (rng() - 0.5) * 30;
      y = 65 + Math.floor(i / 9) * 61 + (rng() - 0.5) * 26;
      phase = kind === 0 ? (rng() - 0.5) * 3.8 : rng() * TAU;
    }
    nodes.push({ x, y, phase: wrap(phase), bias: rng() * 2 - 1 });
  }
  return { nodes, tick: 0, scrambles: 0 };
}
function validate(world) {
  if (!world || !Array.isArray(world.nodes) || world.nodes.length < 1 || world.nodes.length > 144 || !Number.isSafeInteger(world.tick) || world.tick < 0) fail('Use a field of 1–144 clocks and a valid tick.');
  for (const node of world.nodes) if (!node || !finite(node.x) || node.x < 0 || node.x > WIDTH || !finite(node.y) || node.y < 0 || node.y > HEIGHT || !finite(node.phase) || node.phase < 0 || node.phase >= TAU || !finite(node.bias) || Math.abs(node.bias) > 1) fail('A clock needs a position, wrapped phase, and bias from −1 to 1.');
}
export function settings({ radius = 260, pull = 4, spread = 0.03 } = {}) {
  if (!finite(radius) || radius < 20 || radius > 1000 || !finite(pull) || pull < 0 || pull > 8 || !finite(spread) || spread < 0 || spread > 0.2) fail('Keep listening distance at 20–1,000, pull at 0–8, and clock differences at 0–0.2.');
  return { radius, pull, spread };
}
export function neighbors(world, radius) {
  validate(world); settings({ radius });
  const result = world.nodes.map(() => []), squared = radius * radius;
  for (let i = 0; i < world.nodes.length; i++) for (let j = i + 1; j < world.nodes.length; j++) {
    const a = world.nodes[i], b = world.nodes[j];
    if ((a.x - b.x) ** 2 + (a.y - b.y) ** 2 <= squared) { result[i].push(j); result[j].push(i); }
  }
  return result;
}
export function advance(world, options = {}, ticks = 1) {
  validate(world); const { radius, pull, spread } = settings(options);
  if (!Number.isInteger(ticks) || ticks < 1 || ticks > 3600 || !Number.isSafeInteger(world.tick + ticks)) fail('Advance 1–3,600 ticks at a time.');
  const graph = neighbors(world, radius), next = new Float64Array(world.nodes.length);
  for (let tick = 0; tick < ticks; tick++) {
    for (let i = 0; i < world.nodes.length; i++) {
      const node = world.nodes[i], peers = graph[i]; let influence = 0;
      for (const j of peers) influence += Math.sin(world.nodes[j].phase - node.phase);
      const angularSpeed = TAU * (0.8 + spread * node.bias) + (peers.length ? pull * influence / peers.length : 0);
      next[i] = wrap(node.phase + DT * angularSpeed);
    }
    // All clocks read the old field before any of the new phases are installed.
    world.nodes.forEach((node, i) => { node.phase = next[i]; }); world.tick++;
  }
  return world;
}
export function agreement(world) {
  validate(world); let x = 0, y = 0;
  for (const node of world.nodes) { x += Math.cos(node.phase); y += Math.sin(node.phase); }
  return Math.min(1, Math.hypot(x, y) / world.nodes.length);
}
export function nudge(world, index) {
  validate(world);
  if (!Number.isInteger(index) || index < 0 || index >= world.nodes.length) fail('Select a clock in this field.');
  world.nodes[index].phase = wrap(world.nodes[index].phase + TAU / 4);
}
export function scatter(world) {
  validate(world);
  if (!Number.isSafeInteger(world.scrambles) || world.scrambles < 0 || world.scrambles >= 1000000) fail('Reset this clearing before scattering again.');
  const rng = random(++world.scrambles * 977);
  for (const node of world.nodes) node.phase = rng() * TAU;
}
export function nearest(world, x, y) {
  validate(world); if (!finite(x) || !finite(y)) fail('Choose a finite point.');
  let selected = 0, distance = Infinity;
  world.nodes.forEach((node, i) => { const squared = (node.x - x) ** 2 + (node.y - y) ** 2; if (squared < distance) { distance = squared; selected = i; } });
  return selected;
}
export function clockStyle(phase) {
  const flash = Math.exp(-38 * (Math.min(phase, TAU - phase) / TAU) ** 2);
  return { flash, color: `hsl(${Math.round(35 + phase / TAU * 110)} 68% ${Math.round(59 + flash * 22)}%)` };
}
export function toSVG(world) {
  validate(world);
  const clocks = world.nodes.map(node => {
    const { color, flash } = clockStyle(node.phase), dx = Math.sin(node.phase) * 12, dy = -Math.cos(node.phase) * 12;
    return `<g transform="translate(${node.x.toFixed(3)} ${node.y.toFixed(3)})"><circle r="${(9 + flash * 9).toFixed(3)}" fill="${color}" opacity=".13"/><circle r="4" fill="${color}"/><circle r="15" fill="none" stroke="${color}" stroke-opacity=".35"/><path d="M0 0L${dx.toFixed(3)} ${dy.toFixed(3)}" stroke="${color}" stroke-width="2" stroke-linecap="round"/></g>`;
  }).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${WIDTH} ${HEIGHT + 60}" role="img" aria-labelledby="title"><title id="title">Chorusfield — ${world.nodes.length} little clocks</title><rect width="960" height="620" fill="#101e1c"/>${clocks}<text x="32" y="599" fill="#c0cbb5" font-family="monospace" font-size="12">CHORUSFIELD / ${(world.tick * DT).toFixed(2)}s / ${(agreement(world) * 100).toFixed(1)}% FIELD AGREEMENT</text></svg>`;
}

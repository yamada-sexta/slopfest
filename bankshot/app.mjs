import { fraction, shoot, toSVG } from './core.mjs';
import { atlasSVG, survey } from './atlas.mjs';

const byId = id => document.getElementById(id);
const atlasView = byId('atlas');
const defaults = { width: 12, height: 9, velocity: [2, 1] };
const cornerNames = { NW: 'north-west', NE: 'north-east', SW: 'south-west', SE: 'south-east' };
let atlas;
let start;
let shot;

function describe({ outcome, tick, banks }, scale) {
  const ending = outcome === 'loop' ? 'Loop' : `${cornerNames[outcome]} pocket`;
  return `${ending} at time ${fraction(tick, scale)}, after ${banks} ${banks === 1 ? 'bank' : 'banks'}.`;
}

function drawShot() {
  const { width, height, scale, points, banks, end } = shot;
  const point = p => `${p.x / scale + 1},${p.y / scale + 1}`;
  const dot = (p, fill, radius) =>
    `<circle cx="${p.x / scale + 1}" cy="${p.y / scale + 1}" r="${radius}" fill="${fill}"/>`;
  const result = atlas.rows[start[1] - 1][start[0] - 1];
  byId('selection').textContent = `From (${start.join(', ')})`;
  byId('result').textContent = describe(result, scale);
  const corners = [0, width * scale].flatMap(x => [0, height * scale].map(y =>
    dot({ x, y }, '#101d19', .16))).join('');
  const marks = banks <= 24 ? points.slice(1, banks + 1).map(p => dot(p, '#a8ddca', .07)).join('') : '';
  // Coordinates come from the validated, immutable shot.
  byId('path').innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width + 2} ${height + 2}" role="img" aria-labelledby="path-title path-desc">
    <title id="path-title">Shot from (${start.join(', ')})</title>
    <desc id="path-desc">${describe(result, scale)}</desc>
    <rect x="1" y="1" width="${width}" height="${height}" fill="#203a32" stroke="#7ca295" stroke-width="2" vector-effect="non-scaling-stroke"/>
    ${corners}
    <polyline points="${points.map(point).join(' ')}" fill="none" stroke="#a8ddca" stroke-opacity="${banks > 24 ? '.4' : '.85'}" stroke-width="1.8" vector-effect="non-scaling-stroke"/>
    <polyline points="${point(points[0])} ${point(points[1])}" fill="none" stroke="#edc88f" stroke-width="2.4" vector-effect="non-scaling-stroke"/>
    ${marks}${dot(points[0], '#edc88f', .12)}${end === 'pocket' ? dot(points.at(-1), '#f1a089', .15) : ''}
  </svg>`;
}

function choose(x, y, focus = false) {
  const nextShot = shoot({ width: atlas.width, height: atlas.height, velocity: atlas.velocity, start: [x, y] });
  const previous = atlasView.querySelector('[aria-pressed="true"]');
  if (previous) {
    previous.setAttribute('aria-pressed', 'false');
    previous.tabIndex = -1;
  }
  const selected = atlasView.querySelector(`button[data-x="${x}"][data-y="${y}"]`);
  selected.setAttribute('aria-pressed', 'true');
  selected.tabIndex = 0;
  start = [x, y];
  shot = nextShot;
  drawShot();
  if (focus) selected.focus();
}

function load(settings, selectedStart) {
  const next = survey(settings);
  const x = Math.min(selectedStart[0], next.width - 1);
  const y = Math.min(selectedStart[1], next.height - 1);
  const headers = Array.from({ length: next.width - 1 }, (_, i) => `<th scope="col">${i + 1}</th>`).join('');
  const rows = next.rows.map((row, i) => `<tr><th scope="row">${i + 1}</th>${row.map((cell, j) => {
    const label = `Start (${j + 1}, ${i + 1}). ${describe(cell, next.scale)}`;
    return `<td><button type="button" data-x="${j + 1}" data-y="${i + 1}" data-outcome="${cell.outcome}" tabindex="-1" aria-pressed="false" aria-label="${label}" title="${label}">${cell.outcome === 'loop' ? '·' : cell.outcome}</button></td>`;
  }).join('')}</tr>`).join('');
  atlas = next;
  atlasView.innerHTML = `<table class="atlas-table mono"><caption>Starting points · X → / Y ↓</caption><thead><tr><td></td>${headers}</tr></thead><tbody>${rows}</tbody></table>`;
  byId('loaded').textContent = `${next.width} × ${next.height} table · velocity (${next.velocity.join(', ')})`;
  const total = (next.width - 1) * (next.height - 1);
  byId('summary').textContent = `${total - next.counts.loop} of ${total} starts reach a pocket. ${next.counts.loop} loop.`;
  byId('settings-error').textContent = '';
  choose(x, y);
}

atlasView.addEventListener('click', event => {
  const button = event.target.closest('button[data-x]');
  if (button) choose(Number(button.dataset.x), Number(button.dataset.y));
});

atlasView.addEventListener('keydown', event => {
  const button = event.target.closest('button[data-x]');
  if (!button || event.ctrlKey || event.altKey || event.metaKey) return;
  let x = Number(button.dataset.x), y = Number(button.dataset.y);
  switch (event.key) {
    case 'ArrowLeft': x--; break;
    case 'ArrowRight': x++; break;
    case 'ArrowUp': y--; break;
    case 'ArrowDown': y++; break;
    case 'Home': x = 1; break;
    case 'End': x = atlas.width - 1; break;
    default: return;
  }
  event.preventDefault();
  choose(Math.max(1, Math.min(x, atlas.width - 1)), Math.max(1, Math.min(y, atlas.height - 1)), true);
});

byId('settings').addEventListener('submit', event => {
  event.preventDefault();
  try {
    load({
      width: byId('width').valueAsNumber, height: byId('height').valueAsNumber,
      velocity: [byId('vx').valueAsNumber, byId('vy').valueAsNumber],
    }, start);
  } catch (error) {
    byId('settings-error').textContent = error.message;
  }
});

byId('reset').addEventListener('click', () => {
  byId('width').value = defaults.width;
  byId('height').value = defaults.height;
  byId('vx').value = defaults.velocity[0];
  byId('vy').value = defaults.velocity[1];
  load(defaults, [3, 2]);
});

function save(svg, filename) {
  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
byId('save-shot').addEventListener('click', () => save(toSVG(shot), 'bankshot-shot.svg'));
byId('save-atlas').addEventListener('click', () => save(atlasSVG(atlas), 'bankshot-atlas.svg'));
load(defaults, [3, 2]);

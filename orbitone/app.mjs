import { COLORS, VOICES, PRESETS, preset, ringPattern, toggleStep, resizeRing, encodeScore, decodeScore, tickSeconds, cycleTicks, voiceSample, renderWav } from './core.mjs';
const $ = id => document.getElementById(id);
const element = (tag, text, className) => { const node = document.createElement(tag); if (text !== undefined) node.textContent = text; if (className) node.className = className; return node; };
const svg = (tag, attrs) => { const node = document.createElementNS('http://www.w3.org/2000/svg', tag); for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, value); return node; };
let song = preset(0), context, master, buffers, playing = false, timer, frame, startTime, nextTick = 0, shownTick = -1, generation = 0;
const sources = new Set();
let cursors = [], dots = [], ringViews = [];
const point = (radius, step, length) => { const angle = step / length * Math.PI * 2 - Math.PI / 2; return { cx: 300 + Math.cos(angle) * radius, cy: 300 + Math.sin(angle) * radius }; };
function draw() {
  $('orbits').replaceChildren(); cursors = []; dots = [];
  $('orbits').append(svg('line', { x1: 300, y1: 36, x2: 300, y2: 300, class: 'orbit-line' }));
  song.rings.forEach((ring, voice) => {
    const radius = 238 - voice * 64, active = ringPattern(ring);
    const group = svg('g', { opacity: ring.muted ? 0.3 : 1 }); group.append(svg('circle', { cx: 300, cy: 300, r: radius, class: 'orbit-track' }));
    const nodes = active.map((pulse, step) => {
      const node = svg('circle', { ...point(radius, step, ring.length), r: pulse ? 10 : 6, fill: pulse ? COLORS[voice] : '#464253', class: 'orbit-dot' }); group.append(node); return node;
    });
    const cursor = svg('circle', { ...point(radius, 0, ring.length), r: 16, class: 'orbit-cursor', opacity: 0.4 }); group.append(cursor);
    $('orbits').append(group); dots.push(nodes); cursors.push(cursor);
  });
  const center = svg('text', { x: 300, y: 307, class: 'orbit-center' }); center.textContent = '◎'; $('orbits').append(center);
  $('alignment').textContent = `POINTERS REALIGN EVERY ${cycleTicks(song)} TICKS`;
}
function paint(tick) {
  if (tick === shownTick) return; shownTick = tick;
  $('counter').textContent = String(Math.max(0, tick)).padStart(3, '0');
  song.rings.forEach((ring, voice) => {
    const step = Math.max(0, tick) % ring.length, pos = point(238 - voice * 64, step, ring.length);
    cursors[voice].setAttribute('cx', pos.cx); cursors[voice].setAttribute('cy', pos.cy); cursors[voice].setAttribute('opacity', tick < 0 ? 0.4 : 1);
    dots[voice].forEach((dot, index) => dot.setAttribute('stroke-width', tick >= 0 && index === step ? 0 : 3));
  });
}
function stop(message = 'At rest. Play starts all three rings from the beginning.') {
  generation++; playing = false; clearInterval(timer); cancelAnimationFrame(frame);
  for (const source of sources) source.stop(); sources.clear();
  $('play').textContent = '▶ Play'; $('motion').textContent = 'AT REST'; $('status').textContent = message;
  shownTick = -2; paint(-1);
}
function clearShare() { $('share-panel').hidden = true; $('share-url').value = ''; }
function refreshRing(voice) {
  const ring = song.rings[voice], view = ringViews[voice], active = ringPattern(ring);
  for (const [field, slider] of Object.entries(view.sliders)) { slider.input.value = ring[field]; slider.output.textContent = ring[field]; }
  view.mode.textContent = ring.custom == null ? 'Evenly spaced' : 'Hand placed';
  if (view.buttons.length !== ring.length) {
    view.grid.replaceChildren();
    view.buttons = active.map((_, step) => {
      const button = element('button', step + 1); button.setAttribute('aria-label', `${VOICES[voice]} step ${step + 1}`);
      button.addEventListener('click', () => { Object.assign(ring, toggleStep(ring, step)); changed(); });
      view.grid.append(button); return button;
    });
  }
  view.buttons.forEach((button, step) => button.setAttribute('aria-pressed', String(active[step])));
}
function changed() {
  stop('Arrangement changed. Press Play to hear it from the beginning.'); clearShare(); $('preset').value = 'custom';
  song.rings.forEach((_, voice) => refreshRing(voice)); draw(); shownTick = -2; paint(-1);
}
function buildControls() {
  $('rings').replaceChildren(); ringViews = []; $('bpm').value = song.bpm; $('bpm-value').textContent = `${song.bpm} BPM`;
  song.rings.forEach((ring, voice) => {
    const card = element('section', undefined, 'ring'); card.style.setProperty('--voice', COLORS[voice]); card.setAttribute('aria-label', VOICES[voice]);
    const top = element('div', undefined, 'ring-top'), heading = element('h3', `${String(voice + 1).padStart(2, '0')} / ${VOICES[voice]}`), label = element('label', 'Mute', 'mute'), mute = element('input');
    mute.type = 'checkbox'; mute.checked = ring.muted; mute.setAttribute('aria-label', `Mute ${VOICES[voice]}`); label.append(mute); top.append(heading, label); card.append(top);
    mute.addEventListener('change', () => { ring.muted = mute.checked; changed(); });
    const controls = element('div', undefined, 'ring-controls'), sliders = {};
    for (const [key, title, min, max] of [['length', 'Steps', 2, 16], ['hits', 'Pulses', 0, ring.length], ['offset', 'Rotate', 0, ring.length - 1]]) {
      const wrap = element('label', title), output = element('output', ring[key]), input = element('input'); input.type = 'range'; input.min = min; input.max = max; input.value = ring[key]; input.step = 1; input.setAttribute('aria-label', `${VOICES[voice]} ${title}`);
      wrap.append(output, input); controls.append(wrap); sliders[key] = { input, output };
      input.addEventListener('input', () => {
        if (key === 'length') {
          Object.assign(ring, resizeRing(ring, Number(input.value)));
          sliders.hits.input.max = ring.length; sliders.offset.input.max = ring.length - 1;
        } else { ring[key] = Number(input.value); if (key === 'hits') ring.custom = null; }
        changed();
      });
    }
    const mode = element('span', '', 'pattern-mode'), hand = element('details', undefined, 'hand-editor'), summary = element('summary', `Place ${VOICES[voice]} pulses by hand`), grid = element('div', undefined, 'step-grid'), even = element('button', 'Space evenly', 'even-button');
    grid.setAttribute('role', 'group'); grid.setAttribute('aria-label', `${VOICES[voice]} pulse steps`);
    even.addEventListener('click', () => { ring.custom = null; changed(); });
    hand.append(summary, element('p', 'Toggle a numbered step. Bright steps sound; gaps stay quiet.'), grid, even);
    card.append(controls, mode, hand); $('rings').append(card); ringViews.push({ sliders, mode, grid, buttons: [] }); refreshRing(voice);
  });
  draw(); shownTick = -2; paint(-1);
}
function schedule() {
  const duration = tickSeconds(song.bpm), patterns = song.rings.map(ringPattern);
  nextTick = Math.max(nextTick, Math.ceil((context.currentTime - 0.01 - startTime) / duration));
  while (startTime + nextTick * duration < context.currentTime + 0.12) {
    const time = startTime + nextTick * duration;
    // Do not burst old notes after the browser was stalled.
    if (time >= context.currentTime - 0.01) song.rings.forEach((ring, voice) => {
      if (ring.muted || !patterns[voice][nextTick % ring.length]) return;
      const source = context.createBufferSource(), gain = context.createGain(), pan = context.createStereoPanner();
      source.buffer = buffers[voice]; gain.gain.value = 0.28; pan.pan.value = [-0.55, 0, 0.55][voice];
      source.connect(gain).connect(pan).connect(master); sources.add(source);
      source.onended = () => { sources.delete(source); source.disconnect(); gain.disconnect(); pan.disconnect(); };
      source.start(Math.max(time, context.currentTime));
    });
    nextTick++;
  }
}
function animate() {
  if (!playing) return;
  paint(Math.floor((context.currentTime - startTime) / tickSeconds(song.bpm)));
  frame = requestAnimationFrame(animate);
}
$('play').addEventListener('click', async () => {
  if (playing) { stop(); return; }
  const attempt = ++generation; $('play').disabled = true;
  try {
    if (!context) {
      context = new AudioContext(); master = context.createGain(); master.connect(context.destination);
      buffers = [0, 1, 2].map(voice => { const data = voiceSample(voice); const buffer = context.createBuffer(1, data.length, 22050); buffer.copyToChannel(data, 0); return buffer; });
      context.addEventListener('statechange', () => { if (playing && context.state !== 'running') stop('Audio paused by the browser. Press Play to start again.'); });
    }
    await context.resume(); if (attempt !== generation) return;
    master.gain.cancelScheduledValues(0); master.gain.value = Number($('volume').value) / 100;
    playing = true; nextTick = 0; shownTick = -2; startTime = context.currentTime + 0.08;
    $('play').textContent = '■ Stop'; $('motion').textContent = 'IN COMPANY'; $('status').textContent = 'Playing. Stop returns to the beginning; ring edits also stop the clocks.';
    schedule(); timer = setInterval(schedule, 25); animate();
  } catch { stop('Audio is unavailable in this browser. You can still arrange the rings and save a WAV.'); }
  finally { $('play').disabled = false; }
});
$('bpm').addEventListener('input', () => { song.bpm = Number($('bpm').value); $('bpm-value').textContent = `${song.bpm} BPM`; changed(); });
$('volume').addEventListener('input', () => { $('volume-value').textContent = `${$('volume').value}%`; if (master) master.gain.setTargetAtTime(Number($('volume').value) / 100, context.currentTime, 0.015); });
PRESETS.forEach((entry, index) => { const option = element('option', entry.name); option.value = index; $('preset').append(option); });
const customOption = element('option', 'Your arrangement'); customOption.value = 'custom'; customOption.disabled = true; $('preset').append(customOption);
$('preset').addEventListener('change', () => { stop('Arrangement loaded. Press Play to listen.'); clearShare(); song = preset(Number($('preset').value)); buildControls(); });
$('share').addEventListener('click', async () => {
  const score = encodeScore(song), url = new URL(location.href); url.hash = score;
  $('share-url').value = url.href; $('share-panel').hidden = false;
  try {
    await navigator.clipboard.writeText(url.href);
    if (encodeScore(song) === score) $('status').textContent = 'Arrangement link copied. It includes your pulses, rotations, tempo, and mutes. Playback starts only when Play is pressed.';
  } catch {
    if (encodeScore(song) === score) { $('status').textContent = 'Copy the arrangement link below. This browser could not copy it automatically.'; $('share-url').focus(); $('share-url').select(); }
  }
});
$('save').addEventListener('click', () => {
  try {
    const bytes = renderWav(song, { volume: Number($('volume').value) / 100 }), url = URL.createObjectURL(new Blob([bytes], { type: 'audio/wav' }));
    const link = element('a'); link.href = url; link.download = 'orbitone-8-bars.wav'; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    $('status').textContent = `Saved eight bars from tick zero at ${song.bpm} BPM, with the current mutes and volume. The rings may not all realign at the end.`;
  } catch (error) { $('status').textContent = `Could not create a WAV: ${error.message}`; }
});
document.addEventListener('visibilitychange', () => { if (document.hidden) stop('Paused while this page was hidden. Press Play to start again.'); });
function loadFragment() {
  try {
    const shared = location.hash ? decodeScore(location.hash) : preset(0);
    stop(location.hash ? 'Shared arrangement loaded. Press Play to listen; volume stays at your local setting.' : 'Default arrangement restored. Press Play to listen.');
    song = shared; clearShare(); $('preset').value = location.hash ? 'custom' : '0'; buildControls();
  } catch { $('status').textContent = 'This arrangement link is invalid or uses an unsupported version. Your current arrangement is unchanged.'; }
}
window.addEventListener('hashchange', loadFragment);
buildControls();
if (location.hash) loadFragment();

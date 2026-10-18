import test from 'node:test';
import assert from 'node:assert/strict';
import { pattern, preset, PRESETS, events, cycleTicks, tickSeconds, voiceSample, renderWav, ringPattern, toggleStep, resizeRing, encodeScore, decodeScore } from '../core.mjs';

test('Every pulse count is exact and circular gaps differ by at most one', () => {
  for (let length = 2; length <= 16; length++) for (let hits = 0; hits <= length; hits++) {
    const result = pattern(length, hits);
    const positions = result.flatMap((hit, i) => hit ? [i] : []);
    assert.equal(positions.length, hits);
    if (hits) {
      const gaps = positions.map((pos, i) => (positions[(i + 1) % hits] - pos + length) % length || length);
      assert.ok(Math.max(...gaps) - Math.min(...gaps) <= 1, `${length}/${hits}: ${gaps}`);
    }
    for (let offset = -length; offset <= length; offset++) {
      const rotated = pattern(length, hits, offset);
      assert.deepEqual(rotated, result.map((_, i) => result[((i - offset) % length + length) % length]));
    }
  }
});
test('Presets are independent copies and all pointer periods are exact', () => {
  const first = preset(0); first.rings[0].hits = 0; assert.equal(preset(0).rings[0].hits, 3);
  assert.equal(cycleTicks(preset(0)), 280); assert.equal(cycleTicks(preset(1)), 16); assert.equal(cycleTicks(preset(2)), 585);
  for (let i = 0; i < PRESETS.length; i++) {
    const song = preset(i), cycle = cycleTicks(song);
    assert.ok(song.rings.every(r => cycle % r.length === 0));
    for (let n = 1; n < cycle; n++) assert.ok(song.rings.some(r => n % r.length !== 0));
  }
});
test('Event times agree with ring positions, wrap independently, and honor mutes', () => {
  const song = preset(0), notes = events(song, 64);
  assert.equal(tickSeconds(120), 0.25);
  for (let tick = 0; tick < 64; tick++) song.rings.forEach((r, voice) => {
    const note = notes.find(n => n.tick === tick && n.voice === voice);
    assert.equal(Boolean(note), pattern(r.length, r.hits, r.offset)[tick % r.length]);
    if (note) assert.ok(Math.abs(note.time - tick * 30 / song.bpm) < 1e-12);
  });
  song.rings[1].muted = true; assert.ok(events(song).every(n => n.voice !== 1));
  song.rings.forEach(r => r.muted = true); assert.deepEqual(events(song), []);
});
test('Synthesized voices are deterministic, bounded, distinct, and start and end softly', () => {
  const samples = [0, 1, 2].map(voice => voiceSample(voice));
  for (const [voice, sample] of samples.entries()) {
    assert.deepEqual(sample, voiceSample(voice)); assert.equal(Math.abs(sample[0]), 0); assert.ok(Math.abs(sample.at(-1)) < 0.001);
    assert.ok(sample.every(n => Number.isFinite(n) && Math.abs(n) <= 1));
    assert.ok(sample.some(n => Math.abs(n) > 0.1));
  }
  assert.notDeepEqual(samples[0], samples[1]); assert.notDeepEqual(samples[1], samples[2]);
});
test('WAV has correct stereo PCM header, exact duration, audible samples, and silent tail', () => {
  const song = preset(1), bytes = renderWav(song), view = new DataView(bytes.buffer), text = (a, b) => new TextDecoder().decode(bytes.slice(a, b));
  assert.equal(text(0, 4), 'RIFF'); assert.equal(text(8, 12), 'WAVE'); assert.equal(text(12, 16), 'fmt '); assert.equal(text(36, 40), 'data');
  assert.equal(view.getUint32(4, true), bytes.length - 8); assert.equal(view.getUint16(20, true), 1); assert.equal(view.getUint16(22, true), 2);
  assert.equal(view.getUint32(24, true), 22050); assert.equal(view.getUint32(28, true), 88200); assert.equal(view.getUint16(32, true), 4); assert.equal(view.getUint16(34, true), 16);
  const frames = Math.ceil((64 * 30 / song.bpm + 0.5) * 22050);
  assert.equal(view.getUint32(40, true), frames * 4); assert.equal(bytes.length, 44 + frames * 4);
  let peak = 0, stereoDifference = false;
  for (let i = 44; i < bytes.length; i += 4) { peak = Math.max(peak, Math.abs(view.getInt16(i, true)), Math.abs(view.getInt16(i + 2, true))); if (view.getInt16(i, true) !== view.getInt16(i + 2, true)) stereoDifference = true; }
  assert.ok(peak > 1000 && peak < 32767); assert.equal(stereoDifference, true);
  assert.ok(bytes.slice(-2205 * 4).every(n => n === 0));
  assert.deepEqual(bytes, renderWav(song));
});
test('Muted and zero-volume exports are silent; dense patterns retain headroom', () => {
  const song = preset(0); song.rings.forEach(r => r.muted = true);
  assert.ok(renderWav(song, { ticks: 8 }).slice(44).every(n => n === 0));
  song.rings.forEach(r => { r.muted = false; r.hits = r.length; }); song.bpm = 180;
  assert.ok(renderWav(song, { ticks: 8, volume: 0 }).slice(44).every(n => n === 0));
  const bytes = renderWav(song, { ticks: 16, volume: 1 }), view = new DataView(bytes.buffer);
  for (let i = 44; i < bytes.length; i += 2) assert.ok(Math.abs(view.getInt16(i, true)) < 32767);
});
test('WAV sound starts on the rotated pulse and leaves the other ticks silent', () => {
  const song = preset(0); song.bpm = 120;
  song.rings[0].muted = true; song.rings[1].muted = true;
  Object.assign(song.rings[2], { length: 8, hits: 1, offset: 3 });
  const bytes = renderWav(song, { sampleRate: 8000, ticks: 8 });
  const view = new DataView(bytes.buffer), onset = 3 * 0.25 * 8000;
  assert.ok(bytes.slice(44, 44 + onset * 4).every(n => n === 0));
  let energy = 0;
  for (let frame = onset; frame < onset + 800; frame++) energy += Math.abs(view.getInt16(44 + frame * 4, true));
  assert.ok(energy > 10000);
  assert.ok(bytes.slice(44 + (onset + 960) * 4).every(n => n === 0));
});
test('Invalid musical and audio bounds fail before allocating large renders', () => {
  for (const args of [[1, 1], [17, 1], [8, 9], [8, -1], [8, 2, 0.5]]) assert.throws(() => pattern(...args), RangeError);
  assert.throws(() => preset(99), RangeError);
  assert.throws(() => events({ ...preset(0), bpm: 0 }), RangeError);
  assert.throws(() => events(preset(0), 100000), RangeError);
  assert.throws(() => renderWav(preset(0), { sampleRate: 1 }), RangeError);
  assert.throws(() => renderWav(preset(0), { volume: NaN }), RangeError);
});

test('Hand toggles change only the requested displayed step at every rotation', () => {
  for (let length = 2; length <= 16; length++) for (let offset = 0; offset < length; offset++) {
    const ring = { length, hits: Math.floor(length / 2), offset, muted: false, custom: null };
    const before = ringPattern(ring);
    for (let step = 0; step < length; step++) {
      const edited = toggleStep(ring, step), expected = before.map((hit, i) => i === step ? !hit : hit);
      assert.deepEqual(ringPattern(edited), expected);
      assert.equal(edited.offset, offset); assert.equal(edited.hits, expected.filter(Boolean).length);
      assert.deepEqual(ringPattern(toggleStep(edited, step)), before);
      assert.equal(ring.custom, null);
    }
  }
});
test('Resizing custom rings preserves the base prefix, pads rests, and clamps controls', () => {
  const ring = { length: 5, hits: 3, offset: 4, muted: true, custom: [true, false, true, false, true] };
  const short = resizeRing(ring, 3), long = resizeRing(ring, 8);
  assert.deepEqual(short.custom, [true, false, true]); assert.equal(short.hits, 2); assert.equal(short.offset, 1);
  assert.deepEqual(long.custom, [true, false, true, false, true, false, false, false]); assert.equal(long.hits, 3);
  assert.equal(ring.length, 5); assert.equal(ring.custom.length, 5);
  const even = resizeRing({ ...ring, custom: null, hits: 5 }, 2);
  assert.equal(even.hits, 2); assert.equal(even.offset, 0); assert.equal(even.custom, null);
  assert.throws(() => resizeRing(ring, 17), RangeError); assert.throws(() => toggleStep(ring, 5), RangeError);
});
test('Versioned score links preserve all presets and independently decoded copies', () => {
  for (let i = 0; i < PRESETS.length; i++) {
    const song = preset(i), code = encodeScore(song), restored = decodeScore('#' + code);
    assert.deepEqual(restored, song); assert.deepEqual(events(restored), events(song));
    assert.equal(encodeScore(restored), code); assert.ok(code.length < 160);
    restored.rings[0].muted = true; assert.equal(song.rings[0].muted, false);
  }
});
test('Custom masks survive links across every ring length, rotation, and mute', () => {
  let seed = 12345;
  for (let length = 2; length <= 16; length++) for (let trial = 0; trial < 32; trial++) {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    const bits = trial === 0 ? 0 : trial === 1 ? 2 ** length - 1 : trial === 2 ? 2 ** (length - 1) : seed % 2 ** length;
    const song = preset(0), custom = Array.from({ length }, (_, i) => Boolean(bits & (1 << i)));
    song.rings[trial % 3] = { length, hits: custom.filter(Boolean).length, offset: trial % length, muted: trial % 2 === 0, custom };
    const restored = decodeScore(encodeScore(song));
    assert.deepEqual(restored, song); assert.deepEqual(events(restored), events(song));
    assert.deepEqual(renderWav(restored, { ticks: 1, sampleRate: 8000 }), renderWav(song, { ticks: 1, sampleRate: 8000 }));
  }
});
test('Malformed, oversized, noncanonical, and inconsistent score links are rejected', () => {
  const good = encodeScore(preset(0));
  for (const bad of ['', good.replace('o1=', 'o2='), good + '~8.1.0.0.e', good.slice(0, -2), '#'.repeat(161), good.replace('112', '060'), good.replace('112', '181'), good.replace('8.3.0.0.e', '1.1.0.0.e'), good.replace('8.3.0.0.e', '8.3.8.0.e'), good.replace('8.3.0.0.e', '8.3.0.2.e'), good.replace('8.3.0.0.e', '8.1.0.0.x100'), good.replace('8.3.0.0.e', '8.3.0.0.x1'), good.replace('8.3.0.0.e', '8.1.0.0.x01'), 'o1=<script>']) assert.throws(() => decodeScore(bad), RangeError, bad);
  for (const custom of [[true], Array(8), [1, 0, 0, 0, 0, 0, 0, 0], Array(8).fill(false)]) {
    const song = preset(0); song.rings[0].custom = custom; assert.throws(() => encodeScore(song), RangeError);
  }
});
test('A hand-placed isolated pulse appears at the same onset in a restored WAV', () => {
  const song = preset(0); song.bpm = 120; song.rings.forEach(r => r.muted = true);
  song.rings[2] = { length: 8, hits: 1, offset: 1, muted: false, custom: [false, false, true, false, false, false, false, false] };
  const restored = decodeScore(encodeScore(song));
  assert.deepEqual(events(restored, 8).map(n => n.tick), [3]);
  const bytes = renderWav(restored, { sampleRate: 8000, ticks: 8 });
  assert.ok(bytes.slice(44, 44 + 6000 * 4).every(n => n === 0));
  assert.ok(bytes.slice(44 + 6000 * 4, 44 + 6960 * 4).some(n => n !== 0));
});

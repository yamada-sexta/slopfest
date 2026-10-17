export const COLORS = ['#f1bb87', '#9bd8df', '#c7b2ef'];
export const VOICES = ['Thump', 'Glass', 'Dust'];
export const PRESETS = [
  { name: 'Odd company', bpm: 112, rings: [[8, 3, 0], [7, 3, 1], [5, 2, 0]] },
  { name: 'Evening train', bpm: 124, rings: [[8, 4, 0], [8, 3, 2], [16, 7, 1]] },
  { name: 'Slow moons', bpm: 84, rings: [[5, 2, 0], [9, 4, 1], [13, 5, 2]] }
];
export function pattern(length, hits, offset = 0) {
  if (!Number.isInteger(length) || length < 2 || length > 16 || !Number.isInteger(hits) || hits < 0 || hits > length || !Number.isInteger(offset)) throw new RangeError('Use 2–16 steps, 0–length pulses, and an integer rotation.');
  const turn = ((offset % length) + length) % length;
  return Array.from({ length }, (_, i) => ((((i - turn + length) % length) * hits) % length) < hits);
}
export function preset(index) {
  const entry = PRESETS[index];
  if (!entry) throw new RangeError('Unknown preset.');
  return { bpm: entry.bpm, rings: entry.rings.map(([length, hits, offset]) => ({ length, hits, offset, muted: false })) };
}
export function validate(song) {
  if (!song || !Number.isInteger(song.bpm) || song.bpm < 60 || song.bpm > 180 || !Array.isArray(song.rings) || song.rings.length !== 3) throw new RangeError('Use three rings and a tempo from 60 to 180 BPM.');
  for (const ring of song.rings) { pattern(ring.length, ring.hits, ring.offset); if (typeof ring.muted !== 'boolean') throw new RangeError('Mute must be true or false.'); }
  return song;
}
export const tickSeconds = bpm => 30 / bpm; // One shared tick is an eighth note.
export function events(song, ticks = 64) {
  validate(song);
  if (!Number.isInteger(ticks) || ticks < 1 || ticks > 256) throw new RangeError('Use 1–256 ticks.');
  const patterns = song.rings.map(r => pattern(r.length, r.hits, r.offset)), result = [];
  for (let tick = 0; tick < ticks; tick++) song.rings.forEach((ring, voice) => {
    if (!ring.muted && patterns[voice][tick % ring.length]) result.push({ tick, voice, time: tick * tickSeconds(song.bpm) });
  });
  return result;
}
const gcd = (a, b) => b ? gcd(b, a % b) : a;
export function cycleTicks(song) { validate(song); return song.rings.reduce((cycle, r) => cycle * r.length / gcd(cycle, r.length), 1); }

// Identical samples feed Web Audio and the offline WAV renderer. No recordings.
export function voiceSample(voice, sampleRate = 22050) {
  if (!Number.isInteger(voice) || voice < 0 || voice > 2 || !Number.isInteger(sampleRate) || sampleRate < 8000 || sampleRate > 96000) throw new RangeError('Invalid voice or sample rate.');
  const duration = [0.24, 0.42, 0.12][voice], data = new Float32Array(Math.ceil(duration * sampleRate));
  let noise = 0x5eed1234;
  for (let i = 0; i < data.length; i++) {
    const t = i / sampleRate, attack = Math.min(1, t / 0.003), release = Math.min(1, (duration - t) / 0.012);
    let value;
    if (voice === 0) value = Math.sin(2 * Math.PI * (48 * t + 9 * (1 - Math.exp(-24 * t)))) * Math.exp(-19 * t);
    else if (voice === 1) value = (Math.sin(2 * Math.PI * 523.25 * t) + 0.35 * Math.sin(2 * Math.PI * 1308.125 * t)) / 1.35 * Math.exp(-12 * t);
    else { noise ^= noise << 13; noise ^= noise >>> 17; noise ^= noise << 5; value = ((noise >>> 0) / 2147483648 - 1) * Math.exp(-55 * t); }
    data[i] = value * attack * release;
  }
  return data;
}
export function renderWav(song, { sampleRate = 22050, ticks = 64, volume = 0.6 } = {}) {
  const notes = events(song, ticks);
  if (!Number.isFinite(volume) || volume < 0 || volume > 1) throw new RangeError('Volume must be between zero and one.');
  const samples = [0, 1, 2].map(voice => voiceSample(voice, sampleRate));
  const frames = Math.ceil((ticks * tickSeconds(song.bpm) + 0.5) * sampleRate);
  const left = new Float32Array(frames), right = new Float32Array(frames);
  const pans = [-0.55, 0, 0.55];
  for (const note of notes) {
    const start = Math.round(note.time * sampleRate), sample = samples[note.voice], angle = (pans[note.voice] + 1) * Math.PI / 4;
    for (let i = 0; i < sample.length && start + i < frames; i++) {
      left[start + i] += sample[i] * Math.cos(angle) * 0.28 * volume;
      right[start + i] += sample[i] * Math.sin(angle) * 0.28 * volume;
    }
  }
  const bytes = new Uint8Array(44 + frames * 4), view = new DataView(bytes.buffer);
  const text = (offset, value) => [...value].forEach((char, i) => view.setUint8(offset + i, char.charCodeAt(0)));
  text(0, 'RIFF'); view.setUint32(4, bytes.length - 8, true); text(8, 'WAVE'); text(12, 'fmt '); view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); view.setUint16(22, 2, true); view.setUint32(24, sampleRate, true); view.setUint32(28, sampleRate * 4, true);
  view.setUint16(32, 4, true); view.setUint16(34, 16, true); text(36, 'data'); view.setUint32(40, frames * 4, true);
  for (let i = 0; i < frames; i++) for (let channel = 0; channel < 2; channel++) {
    const value = Math.max(-1, Math.min(1, channel ? right[i] : left[i]));
    view.setInt16(44 + i * 4 + channel * 2, Math.round(value * (value < 0 ? 32768 : 32767)), true);
  }
  return bytes;
}

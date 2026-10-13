import { grow, parse } from './language.mjs';
import { specimens } from './specimens.mjs';
const $ = id => document.getElementById(id);
let currentSVG = null, timer;
specimens.forEach((specimen, i) => { const option = document.createElement('option'); option.value = i; option.textContent = specimen.name; $('specimen').append(option); });

function render() {
  $('drawing').setAttribute('aria-busy', 'true');
  try {
    const result = grow($('source').value, { palette: $('palette').value });
    // The SVG serializer emits numeric geometry and fixed palette values only.
    $('drawing').innerHTML = result.svg;
    currentSVG = result.svg;
    const { depth, angle } = result.program;
    $('depth').value = depth; $('angle').value = angle;
    $('depth-value').value = depth; $('angle-value').value = `${angle}°`;
    $('stats').textContent = `${result.drawing.segments.length.toLocaleString()} STROKES · ${result.symbols.length.toLocaleString()} SYMBOLS`;
    $('error').hidden = true; $('source').removeAttribute('aria-invalid');
    $('export').disabled = false;
  } catch (error) {
    $('error').textContent = error.message; $('error').hidden = false;
    $('source').setAttribute('aria-invalid', 'true');
    $('stats').textContent = 'SEED NEEDS ATTENTION · LAST GOOD DRAWING';
    $('export').disabled = true; currentSVG = null;
  } finally { $('drawing').setAttribute('aria-busy', 'false'); }
}
function load() {
  clearTimeout(timer);
  const index = Number($('specimen').value), specimen = specimens[index];
  $('source').value = specimen.source;
  $('specimen-number').textContent = `SPECIMEN ${String(index + 1).padStart(2, '0')} / 05`;
  $('specimen-note').textContent = specimen.note;
  render();
}
function changeSetting(key, value) {
  clearTimeout(timer);
  try {
    parse($('source').value);
    const pattern = new RegExp(`^[\\t ]*${key}[\\t ]+.*$`, 'm');
    $('source').value = pattern.test($('source').value)
      ? $('source').value.replace(pattern, `${key} ${value}`)
      : `${$('source').value}\n${key} ${value}`;
  } catch { /* Leave malformed text intact; render explains the error. */ }
  render();
}
$('source').addEventListener('input', () => { clearTimeout(timer); currentSVG = null; $('export').disabled = true; timer = setTimeout(render, 180); });
$('specimen').addEventListener('change', load);
$('restore').addEventListener('click', load);
$('palette').addEventListener('change', () => { clearTimeout(timer); render(); });
$('depth').addEventListener('input', event => changeSetting('depth', event.target.value));
$('angle').addEventListener('input', event => changeSetting('angle', event.target.value));
$('export').addEventListener('click', () => {
  if (!currentSVG) return;
  const url = URL.createObjectURL(new Blob([currentSVG], { type: 'image/svg+xml' }));
  const a = document.createElement('a'); a.href = url; a.download = 'sprig-drawing.svg'; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
});
load();

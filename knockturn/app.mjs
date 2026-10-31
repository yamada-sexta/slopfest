import { ROOMS, affected, knock, solve, countBits, toSVG } from './core.mjs';
const $ = id => document.getElementById(id), grid = $('windows');
let roomIndex = 0, room, lights, history = [], solution, hint = -1, selected = 0, preview = null, buttons = [];
ROOMS.forEach((item, i) => { const option = document.createElement('option'); option.value = i; option.textContent = `${String(i + 1).padStart(2, '0')} / ${item.name}`; $('room').append(option); });
const message = text => { $('status').textContent = text; };
function paintWindows() {
  const flip = preview === null || lights === 0 ? 0 : affected(room.size, preview), plan = $('show-plan').checked ? solution.mask : 0;
  buttons.forEach((button, index) => {
    const lit = Boolean(lights & (1 << index));
    button.classList.toggle('lit', lit); button.classList.toggle('will-flip', Boolean(flip & (1 << index)));
    button.classList.toggle('plan-mark', Boolean(plan & (1 << index))); button.classList.toggle('hint', hint === index && lights !== 0);
    button.disabled = lights === 0; button.tabIndex = index === selected ? 0 : -1;
    button.setAttribute('aria-pressed', String(lit)); button.setAttribute('aria-label', `Row ${Math.floor(index / room.size) + 1}, column ${index % room.size + 1}, ${lit ? 'lit' : 'dark'}${hint === index && lights !== 0 ? ', suggested knock' : plan & (1 << index) ? ', quiet plan' : ''}`);
    button.querySelector('small').textContent = lit ? 'ON' : 'OFF';
  });
  $('preview-note').textContent = lights === 0 ? 'Every window is quiet. Goodnight, neighbors.' : preview === null ? 'Choose a window. Dotted frames preview the little cross it would flip.' : `Knocking row ${Math.floor(preview / room.size) + 1}, column ${preview % room.size + 1} would flip ${countBits(flip)} windows.`;
}
function render() {
  solution = solve(room.size, lights); paintWindows();
  $('room-number').textContent = `ROOM ${String(roomIndex + 1).padStart(2, '0')} / ${String(ROOMS.length).padStart(2, '0')} · ${room.size} × ${room.size}`;
  $('awake').textContent = lights === 0 ? 'ALL QUIET' : `${countBits(lights)} AWAKE`;
  $('moves').value = history.length; $('remaining').value = solution.distance;
  $('undo').disabled = history.length === 0; $('hint').disabled = lights === 0; $('next').disabled = lights !== 0;
  $('next').textContent = roomIndex === ROOMS.length - 1 ? 'Back to the first room ↺' : 'Next room →';
  $('proof').textContent = `${solution.solutions} valid ${solution.solutions === 1 ? 'plan' : 'plans'} · ${solution.shortest} shortest\n${solution.distance} ${solution.distance === 1 ? 'knock' : 'knocks'} remaining`;
}
function load() {
  roomIndex = Number($('room').value); room = ROOMS[roomIndex]; lights = room.lights; history = []; hint = -1; selected = 0; preview = null;
  $('show-plan').checked = false; $('room-name').textContent = room.name; $('room-note').textContent = room.note;
  grid.style.setProperty('--size', room.size); grid.replaceChildren(); buttons = [];
  for (let index = 0; index < room.size ** 2; index++) {
    const button = document.createElement('button'); button.type = 'button'; button.className = 'window'; button.dataset.index = index; button.setAttribute('aria-describedby', 'preview-note');
    const pane = document.createElement('span'); pane.className = 'pane'; pane.setAttribute('aria-hidden', 'true'); const label = document.createElement('small'); label.setAttribute('aria-hidden', 'true'); button.append(pane, label);
    button.addEventListener('click', () => press(index));
    button.addEventListener('pointerenter', () => { preview = index; paintWindows(); });
    button.addEventListener('focus', () => { selected = index; preview = index; paintWindows(); });
    button.addEventListener('keydown', event => {
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      const x = index % room.size, y = Math.floor(index / room.size), positions = { ArrowLeft: y * room.size + Math.max(0, x - 1), ArrowRight: y * room.size + Math.min(room.size - 1, x + 1), ArrowUp: Math.max(0, y - 1) * room.size + x, ArrowDown: Math.min(room.size - 1, y + 1) * room.size + x, Home: 0, End: room.size ** 2 - 1 };
      if (Object.hasOwn(positions, event.key)) { event.preventDefault(); buttons[positions[event.key]].focus(); }
    });
    grid.append(button); buttons.push(button);
  }
  render(); message(room.note);
}
function press(index) {
  if (lights === 0) return;
  history.push(index); lights = knock(room.size, lights, index); hint = -1; render();
  if (lights === 0) { message(`All quiet in ${history.length} ${history.length === 1 ? 'knock' : 'knocks'}. Choose the next room, or undo to explore another ending.`); $('next').focus({ preventScroll: true }); }
  else message(`${countBits(lights)} windows awake. A shortest route from here needs ${solution.distance} ${solution.distance === 1 ? 'knock' : 'knocks'}.`);
}
grid.addEventListener('pointerleave', () => { preview = grid.contains(document.activeElement) ? selected : null; paintWindows(); });
grid.addEventListener('focusout', event => { if (!grid.contains(event.relatedTarget)) { preview = null; paintWindows(); } });
$('room').addEventListener('change', load); $('reset').addEventListener('click', load);
$('undo').addEventListener('click', () => {
  if (!history.length) return; const index = history.pop(); lights = knock(room.size, lights, index); hint = -1; render(); message('Last knock retracted. The previous window pattern is back.');
});
$('hint').addEventListener('click', () => {
  if (!lights) return; hint = Math.log2(solution.mask & -solution.mask); selected = hint; preview = hint; paintWindows(); buttons[hint].focus({ preventScroll: true });
  message(`A shortest route needs ${solution.distance} ${solution.distance === 1 ? 'knock' : 'knocks'}. One starts at row ${Math.floor(hint / room.size) + 1}, column ${hint % room.size + 1}. The gold frame is a suggestion; make the knock when ready.`);
});
$('show-plan').addEventListener('change', () => { paintWindows(); message($('show-plan').checked ? `Mint frames show a shortest plan of ${solution.distance} ${solution.distance === 1 ? 'knock' : 'knocks'}. Knock those windows in any order.` : 'Quiet plan hidden. Your lights and knock count stay the same.'); });
$('next').addEventListener('click', () => { if (lights) return; $('room').value = (roomIndex + 1) % ROOMS.length; load(); });
$('save').addEventListener('click', () => {
  const svg = toSVG(room.size, lights, { title: room.name, moves: history.length }), url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' })), link = document.createElement('a');
  link.href = url; link.download = 'knockturn-postcard.svg'; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); message('Saved this window pattern and its counts. Hints and preview frames stay in the game.');
});
load();

import { createState, parseRoom, move, rewind, undo, position, echoPosition, gateOpen, MAX_ECHOES } from './core.mjs';
import { rooms } from './rooms.mjs';
const $ = id => document.getElementById(id);
const canvas = $('board'), ctx = canvas.getContext('2d');
const colors = ['#93cbdc', '#d4a2d5', '#edb983'];
let roomIndex = 0, state;

rooms.forEach((room, i) => { const option = document.createElement('option'); option.value = i; option.textContent = `${String(i + 1).padStart(2, '0')} / ${room.name}`; $('room').append(option); });
function load(index) {
  roomIndex = index; state = createState(parseRoom(rooms[index].rows));
  $('room').value = index;
  $('room-number').textContent = `ROOM ${String(index + 1).padStart(2, '0')} / ${String(rooms.length).padStart(2, '0')}`;
  $('room-name').textContent = rooms[index].name;
  $('subtitle').textContent = rooms[index].subtitle;
  $('story').textContent = rooms[index].story;
  $('hint-text').textContent = rooms[index].hint;
  $('hint').open = false;
  update('Walk onto a plate, then rewind to record an echo.');
}

function update(message) {
  $('tick').textContent = String(state.tick).padStart(2, '0');
  $('echo-count').textContent = `${state.echoes.length} / ${MAX_ECHOES}`;
  $('rewind').disabled = !state.tick || state.echoes.length >= MAX_ECHOES || state.won;
  $('undo').disabled = !state.tick;
  $('complete').hidden = !state.won;
  $('next').textContent = roomIndex === rooms.length - 1 ? 'Play again ↶' : 'Next room →';
  const p = position(state);
  $('status').textContent = message || `Beat ${state.tick}. You are at column ${p.x}, row ${p.y}. Your past is keeping pace.`;
  canvas.setAttribute('aria-label', `${rooms[roomIndex].name}. You are at column ${p.x}, row ${p.y}. Beat ${state.tick}. ${state.echoes.length} echoes. Arrow keys move, space waits, R rewinds.`);
  $('tapes').replaceChildren();
  for (let i = 0; i < MAX_ECHOES; i++) {
    const tape = document.createElement('div'); tape.className = `tape${state.echoes[i] ? '' : ' empty'}`;
    const label = document.createElement('span'), info = document.createElement('small');
    label.textContent = `◇ ECHO ${String(i + 1).padStart(2, '0')}`; label.style.color = colors[i];
    const echo = state.echoes[i];
    info.textContent = echo ? `${Math.min(state.tick, echo.length - 1)} / ${echo.length - 1} · ${state.tick >= echo.length - 1 ? 'HOLDING' : 'WALKING'}` : 'EMPTY TAPE';
    tape.append(label, info); $('tapes').append(tape);
  }
  draw();
}

function roundRect(x, y, w, h, radius, fill, stroke) {
  ctx.beginPath(); ctx.roundRect(x, y, w, h, radius);
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 1; ctx.stroke(); }
}
function diamond(x, y, size, color, fill = false) {
  ctx.beginPath(); ctx.moveTo(x, y - size); ctx.lineTo(x + size, y); ctx.lineTo(x, y + size); ctx.lineTo(x - size, y); ctx.closePath();
  ctx.strokeStyle = color; ctx.lineWidth = 2;
  if (fill) { ctx.fillStyle = color; ctx.fill(); } else ctx.stroke();
}
function draw() {
  const w = 900, h = 440;
  ctx.clearRect(0, 0, w, h);
  const { room } = state;
  const cell = Math.min(68, (w - 70) / room.width, (h - 85) / room.height);
  const ox = (w - room.width * cell) / 2, oy = (h - room.height * cell) / 2;
  const center = p => ({ x: ox + (p.x + .5) * cell, y: oy + (p.y + .5) * cell });
  ctx.font = '11px ui-monospace, monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  room.rows.forEach((row, y) => [...row].forEach((tile, x) => {
    const px = ox + x * cell, py = oy + y * cell, cx = px + cell / 2, cy = py + cell / 2;
    if (tile === '#') {
      roundRect(px + 3, py + 3, cell - 6, cell - 6, 5, '#15221b', '#23372b');
      ctx.fillStyle = '#2b4132'; ctx.fillRect(px + 10, py + 8, cell - 20, 2); return;
    }
    roundRect(px + 3, py + 3, cell - 6, cell - 6, 5, '#263e30', '#3b5740');
    ctx.fillStyle = '#587051'; ctx.beginPath(); ctx.arc(cx, cy, 1.2, 0, Math.PI * 2); ctx.fill();
    if (/[abc]/.test(tile)) {
      const open = [position(state), ...state.echoes.map(e => echoPosition(e, state.tick))].some(p => p.x === x && p.y === y);
      ctx.strokeStyle = open ? '#d0ef8a' : '#edb28b'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(cx, cy, cell * .23, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = open ? '#d0ef8a' : '#edb28b'; ctx.fillText(tile, cx, cy);
    }
    if (/[ABC]/.test(tile)) {
      const open = gateOpen(state, tile);
      roundRect(px + 8, py + 8, cell - 16, cell - 16, 3, open ? '#375536' : '#564638', open ? '#89af6b' : '#d6a77a');
      ctx.fillStyle = open ? '#b2d492' : '#edbb8c';
      if (!open) { for (const dx of [-.23, .23]) ctx.fillRect(cx + dx * cell - 1, py + 12, 2, cell - 24); }
      ctx.fillText(tile, cx, cy);
    }
    if (tile === 'E') {
      ctx.save(); ctx.translate(cx, cy); ctx.strokeStyle = '#d0ef8a'; ctx.lineWidth = 2;
      for (let i = 0; i < 8; i++) { ctx.rotate(Math.PI / 4); ctx.beginPath(); ctx.moveTo(0, cell * .1); ctx.lineTo(0, cell * .27); ctx.stroke(); }
      ctx.restore();
    }
    if (tile === 'S') { ctx.strokeStyle = '#617952'; ctx.lineWidth = 1; ctx.strokeRect(cx - cell * .18, cy - cell * .18, cell * .36, cell * .36); }
  }));
  // A faint breadcrumb trail reveals each recording without hiding the tiles.
  state.echoes.forEach((echo, i) => {
    ctx.beginPath(); echo.forEach((p, j) => { const c = center(p); j ? ctx.lineTo(c.x, c.y) : ctx.moveTo(c.x, c.y); });
    ctx.strokeStyle = colors[i]; ctx.globalAlpha = .22; ctx.lineWidth = 2; ctx.setLineDash([3, 7]); ctx.stroke(); ctx.setLineDash([]); ctx.globalAlpha = 1;
  });
  state.echoes.forEach((echo, i) => {
    const c = center(echoPosition(echo, state.tick));
    const offset = (i - (state.echoes.length - 1) / 2) * cell * .11;
    ctx.save(); ctx.shadowColor = colors[i]; ctx.shadowBlur = 14;
    diamond(c.x + offset, c.y - cell * .09, cell * .19, colors[i]);
    ctx.restore();
    ctx.fillStyle = colors[i]; ctx.font = '9px ui-monospace,monospace'; ctx.fillText(i + 1, c.x + offset, c.y + cell * .28);
  });
  const player = center(position(state));
  ctx.save(); ctx.shadowColor = '#d0ef8a'; ctx.shadowBlur = 24;
  diamond(player.x, player.y, cell * .17, '#d0ef8a', true); ctx.restore();
  ctx.fillStyle = '#273e28'; ctx.fillRect(player.x - 2, player.y - 2, 4, 4);
  ctx.fillStyle = '#708871'; ctx.font = '10px ui-monospace,monospace';
  ctx.textAlign = 'left'; ctx.fillText('REC ●  ONE STEP = ONE BEAT', 26, h - 20);
  ctx.textAlign = 'right'; ctx.fillText('THE PAST IS ON YOUR SIDE', w - 26, h - 20);
}

function act(action) { const result = action(); update(result.message); }
function step(direction) { act(() => move(state, direction)); }
$('rewind').addEventListener('click', () => act(() => rewind(state)));
$('undo').addEventListener('click', () => act(() => undo(state)));
$('reset').addEventListener('click', () => load(roomIndex));
$('next').addEventListener('click', () => load((roomIndex + 1) % rooms.length));
$('room').addEventListener('change', event => load(Number(event.target.value)));
document.querySelectorAll('[data-move]').forEach(button => button.addEventListener('click', () => step(button.dataset.move)));
document.addEventListener('keydown', event => {
  if (event.ctrlKey || event.metaKey || event.altKey || event.target.matches('select,input,textarea')) return;
  if (event.repeat) return;
  const key = event.key.toLowerCase();
  const directions = { arrowup: 'up', w: 'up', arrowdown: 'down', s: 'down', arrowleft: 'left', a: 'left', arrowright: 'right', d: 'right', ' ': 'wait' };
  // Leave space and Enter available for focused native controls.
  if (event.target.matches('button,summary,a') && key === ' ') return;
  if (directions[key]) { event.preventDefault(); step(directions[key]); }
  else if (key === 'r') { event.preventDefault(); act(() => rewind(state)); }
  else if (key === 'z') { event.preventDefault(); act(() => undo(state)); }
});
load(0);

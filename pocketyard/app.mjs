import { transfer, isSolved, solve, toSVG } from './core.mjs';
import { ROOMS } from './rooms.mjs';

const $ = id => document.getElementById(id), NAMES = ['A', 'B', 'C'];
const COLORS = ['#e9b37e', '#8fcac5', '#d3b6da', '#b5ce86', '#e29c94', '#acc5e0'];
let roomIndex = 0, state, history = [], selected = null, hint = null;
const buttons = [], groups = [];
const currentRoom = () => ROOMS[roomIndex];
function wagon(id, small = false) {
  const element = document.createElement('span'); element.className = small ? 'goal-car' : 'wagon';
  element.style.setProperty('--wagon', COLORS[Number(id) - 1]); element.textContent = id; return element;
}
function render(message) {
  const room = currentRoom(), solution = solve(room.yard, state), won = isSolved(room.yard, state);
  state.forEach((track, index) => {
    const button = buttons[index], rail = button.querySelector('.rail'); rail.replaceChildren();
    for (let slot = 0; slot < room.yard.capacity; slot++) {
      const car = track[slot] ? wagon(track[slot]) : document.createElement('span');
      if (!track[slot]) car.className = 'empty';
      if (slot === track.length - 1) car.classList.add('exposed');
      rail.append(car);
    }
    button.disabled = won;
    button.classList.toggle('selected', selected === index);
    button.classList.toggle('hint-from', hint?.from === index);
    button.classList.toggle('hint-to', hint?.to === index);
    button.setAttribute('aria-pressed', String(selected === index));
    const action = selected === null ? (track ? `Select exposed wagon ${track.at(-1)}.` : 'Empty track.') : selected === index ? 'Cancel selection.' : track.length < room.yard.capacity ? `Receive wagon ${state[selected].at(-1)}.` : 'Full; cannot receive a wagon.';
    button.setAttribute('aria-label', `Track ${NAMES[index]}: ${track ? [...track].join(', ') : 'empty'}. ${action}${hint?.from === index ? ' Hint source.' : hint?.to === index ? ' Hint destination.' : ''}`);
    button.dataset.wagons = track;
    groups[index].querySelector('.occupancy').textContent = `${track.length} / ${room.yard.capacity}`;
    groups[index].querySelector('.signal').textContent = selected === index ? 'SELECTED →' : hint?.from === index ? 'HINT · TAKE →' : hint?.to === index ? 'HINT · RECEIVE ←' : '';
    groups[index].querySelector('.goal-check').textContent = track === room.yard.goal[index] ? '✓ MATCH' : '';
  });
  $('moves').textContent = history.length; $('remaining').textContent = solution.distance;
  $('undo').disabled = !history.length; $('cancel').disabled = selected === null;
  $('hint').disabled = won; $('next').disabled = !won;
  $('result').textContent = won ? `DISPATCH READY · ${history.length} TRANSFER${history.length === 1 ? '' : 'S'}` : selected === null ? 'PICK A TRACK · THEN PICK A DESTINATION' : `WAGON ${state[selected].at(-1)} READY · CHOOSE ANOTHER TRACK`;
  if (message) $('status').textContent = message;
}
function choose(index) {
  if (isSolved(currentRoom().yard, state)) return;
  if (selected === null) {
    if (!state[index]) { render(`Track ${NAMES[index]} is empty. First choose a track with a wagon.`); return; }
    if (hint && hint.from !== index) hint = null;
    selected = index; render(`Wagon ${state[index].at(-1)} selected from track ${NAMES[index]}. Choose another track with space, or this track again to cancel.`); return;
  }
  if (selected === index) { selected = null; hint = null; render('Selection cancelled. Choose an exposed wagon when you are ready.'); return; }
  const next = transfer(currentRoom().yard, state, selected, index);
  if (!next) { render(`Track ${NAMES[index]} is full. Wagon ${state[selected].at(-1)} is still selected; choose another track.`); return; }
  const from = selected, car = state[from].at(-1);
  history.push(state); state = next; selected = null; hint = null;
  const won = isSolved(currentRoom().yard, state);
  render(won ? 'Every wagon matches the dispatch. Ready to roll! Undo is still available.' : `Wagon ${car} moved from ${NAMES[from]} to ${NAMES[index]}. Choose the next exposed wagon.`);
  if (won) $('next').focus();
}
function loadRoom(index) {
  roomIndex = index; const room = currentRoom();
  state = room.start; history = []; selected = null; hint = null;
  $('room').value = String(index); $('room-title').textContent = room.title; $('room-note').textContent = room.note;
  $('room-number').textContent = `DISPATCH ${String(index + 1).padStart(2, '0')} / ${String(ROOMS.length).padStart(2, '0')}`;
  $('par').textContent = `This dispatch starts ${room.par} transfers from home. Hints update after every detour.`;
  $('tracks').replaceChildren(); buttons.length = 0; groups.length = 0;
  for (let i = 0; i < 3; i++) {
    const group = document.createElement('div'); group.className = 'track-group';
    const heading = document.createElement('div'); heading.className = 'track-label';
    heading.innerHTML = `<strong>TRACK ${NAMES[i]}</strong><span class="signal"></span><span class="occupancy"></span>`;
    const button = document.createElement('button'); button.className = 'track'; button.dataset.track = i;
    const rail = document.createElement('span'); rail.className = 'rail'; rail.setAttribute('aria-hidden', 'true'); button.append(rail);
    button.addEventListener('click', () => choose(i));
    const goal = document.createElement('div'); goal.className = 'goal';
    const label = document.createElement('span'); label.textContent = 'DISPATCH →'; goal.append(label);
    const order = document.createElement('span'); order.className = 'goal-order'; order.setAttribute('aria-label', `Track ${NAMES[i]} dispatch: ${room.yard.goal[i] ? [...room.yard.goal[i]].join(', ') : 'empty'}`);
    for (const id of room.yard.goal[i]) order.append(wagon(id, true));
    if (!room.yard.goal[i]) { order.classList.add('goal-text'); order.textContent = 'empty'; }
    const match = document.createElement('span'); match.className = 'goal-check'; goal.append(order, match);
    group.append(heading, button, goal); $('tracks').append(group); buttons.push(button); groups.push(group);
  }
  render(index === 0 ? 'Your first transfer: choose track B, then track A. Wagon 2 will join wagon 1.' : 'Choose an exposed wagon, then a receiving track. The small dispatch rows show the goal.');
}
ROOMS.forEach((room, i) => { const option = document.createElement('option'); option.value = i; option.textContent = `${String(i + 1).padStart(2, '0')} / ${room.title}`; $('room').append(option); });
$('room').addEventListener('change', () => loadRoom(Number($('room').value)));
$('reset').addEventListener('click', () => loadRoom(roomIndex));
$('cancel').addEventListener('click', () => { selected = null; hint = null; render('Selection cancelled. Choose another exposed wagon.'); });
$('undo').addEventListener('click', () => { if (!history.length) return; state = history.pop(); selected = null; hint = null; render('Last transfer undone. The wagon is back on its previous track.'); });
$('hint').addEventListener('click', () => {
  selected = null; const route = solve(currentRoom().yard, state).route; hint = route[0];
  render(`Hint: move wagon ${hint.wagon} from ${NAMES[hint.from]} to ${NAMES[hint.to]}. This leaves ${route.length - 1} transfers on a shortest route. Nothing has moved yet.`);
  buttons[hint.from].focus();
});
$('next').addEventListener('click', () => { loadRoom((roomIndex + 1) % ROOMS.length); buttons[0].focus(); });
$('save').addEventListener('click', () => {
  const room = currentRoom(), svg = toSVG(room.yard, state, { title: room.title, moves: history.length });
  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
  const link = document.createElement('a'); link.href = url; link.download = 'pocketyard-dispatch.svg'; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000); render('Saved the current yard and its dispatch order as SVG. Helpers stay out of the postcard.');
});
loadRoom(0);

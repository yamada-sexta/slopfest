import { transfer, isSolved, solve, toSVG, yardStats, scramble } from './core.mjs';
import { ROOMS } from './rooms.mjs';
import { makeDispatch, encodeDispatch, decodeDispatch } from './dispatch.mjs';

const $ = id => document.getElementById(id), NAMES = ['A', 'B', 'C'];
const COLORS = ['#e9b37e', '#8fcac5', '#d3b6da', '#b5ce86', '#e29c94', '#acc5e0'];
let roomIndex = 0, customRoom = null, state, history = [], selected = null, hint = null, choice = 0;
const buttons = [], groups = [];
const currentRoom = () => roomIndex === null ? customRoom : ROOMS[roomIndex];
function fillMaker(start, goal) {
  for (const [i, name] of ['a', 'b', 'c'].entries()) {
    $(`start-${name}`).value = start[i]; $(`goal-${name}`).value = goal[i];
  }
  $('maker-error').textContent = '';
}
function clearShare() { $('share-link').value = ''; $('link-error').textContent = ''; }
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
function loadRoom(index, message) {
  roomIndex = index; const room = currentRoom();
  state = room.start; history = []; selected = null; hint = null;
  $('room').value = index === null ? 'custom' : String(index); $('room-title').textContent = room.title; $('room-note').textContent = room.note;
  $('room-number').textContent = index === null ? 'YOUR DISPATCH' : `DISPATCH ${String(index + 1).padStart(2, '0')} / ${String(ROOMS.length).padStart(2, '0')}`;
  $('par').textContent = `This dispatch starts ${room.par} transfers from home. Hints update after every detour.`;
  $('next').textContent = index === null ? 'First dispatch →' : 'Next dispatch →';
  fillMaker(room.start, room.yard.goal); clearShare();
  const stats = yardStats(room.yard);
  $('distance').max = stats.maxDistance;
  $('distance').value = Math.min(Math.max(1, room.par), stats.maxDistance);
  $('yard-space').textContent = `${stats.states.toLocaleString('en-US')} arrangements for this goal. Exact distances run from 0 to ${stats.maxDistance}. Repeated deals cycle through the selected distance.`;
  $('deal-error').textContent = '';
  window.history.replaceState(null, '', index === null ? encodeDispatch(room.start, room.yard.goal) : location.pathname + location.search);
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
  render(message ?? (index === 0 ? 'Your first transfer: choose track B, then track A. Wagon 2 will join wagon 1.' : room.par === 0 ? 'Already in dispatch order. Deal a scramble for this goal, or make another starting yard.' : 'Choose an exposed wagon, then a receiving track. The small dispatch rows show the goal.'));
}
ROOMS.forEach((room, i) => { const option = document.createElement('option'); option.value = i; option.textContent = `${String(i + 1).padStart(2, '0')} / ${room.title}`; $('room').append(option); });
const customOption = document.createElement('option'); customOption.value = 'custom'; customOption.textContent = 'Your dispatch'; customOption.disabled = true; $('room').append(customOption);
$('room').addEventListener('change', () => loadRoom(Number($('room').value)));
$('reset').addEventListener('click', () => loadRoom(roomIndex));
$('cancel').addEventListener('click', () => { selected = null; hint = null; render('Selection cancelled. Choose another exposed wagon.'); });
$('undo').addEventListener('click', () => { if (!history.length) return; state = history.pop(); selected = null; hint = null; render('Last transfer undone. The wagon is back on its previous track.'); });
$('hint').addEventListener('click', () => {
  selected = null; const route = solve(currentRoom().yard, state).route; hint = route[0];
  render(`Hint: move wagon ${hint.wagon} from ${NAMES[hint.from]} to ${NAMES[hint.to]}. This leaves ${route.length - 1} transfers on a shortest route. Nothing has moved yet.`);
  buttons[hint.from].focus();
});
$('next').addEventListener('click', () => { loadRoom(roomIndex === null ? 0 : (roomIndex + 1) % ROOMS.length); buttons[0].focus(); });
$('save').addEventListener('click', () => {
  const room = currentRoom(), svg = toSVG(room.yard, state, { title: room.title, moves: history.length });
  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
  const link = document.createElement('a'); link.href = url; link.download = 'pocketyard-dispatch.svg'; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000); render('Saved the current yard and its dispatch order as SVG. Helpers stay out of the postcard.');
});
$('maker-form').addEventListener('submit', event => {
  event.preventDefault();
  try {
    const start = ['a','b','c'].map(name => $(`start-${name}`).value), goal = ['a','b','c'].map(name => $(`goal-${name}`).value);
    const dispatch = makeDispatch(start, goal);
    customRoom = dispatch; loadRoom(null, `Your dispatch is loaded: ${dispatch.par} shortest transfers from the goal.`);
  } catch (error) { $('maker-error').textContent = `${error.message} The loaded yard is intact.`; }
});
$('use-current').addEventListener('click', () => { fillMaker(state, currentRoom().yard.goal); $('maker-error').textContent = 'Current wagons copied into the draft. Apply to start a new attempt here.'; });
$('deal').addEventListener('click', () => {
  try {
    const room = currentRoom(), distance = $('distance').valueAsNumber;
    if (!Number.isInteger(distance) || distance < 1 || distance > Number($('distance').max)) throw new Error(`Choose a whole distance from 1 to ${$('distance').max}.`);
    const start = scramble(room.yard, distance, choice), dispatch = Object.freeze({ ...room, title: 'Your dispatch', note: 'A fresh starting yard for the loaded goal. Its shortest distance is exact.', start, par: distance });
    choice = (choice + 1) >>> 0; customRoom = dispatch;
    loadRoom(null, `Dealt a yard exactly ${distance} transfers from the goal. Hints and undo are ready.`);
  } catch (error) { $('deal-error').textContent = `${error.message} The loaded yard is intact.`; }
});
$('share').addEventListener('click', () => {
  const room = currentRoom(), url = new URL(location.href);
  url.search = '';
  url.hash = encodeDispatch(room.start, room.yard.goal);
  $('share-link').value = url.href; $('share-link').focus(); $('share-link').select();
});
function readLink() {
  if (!location.hash) { loadRoom(0); return; }
  try { const dispatch = decodeDispatch(location.hash); customRoom = dispatch; loadRoom(null, `Shared dispatch loaded: ${dispatch.par} shortest transfers from the goal.`); }
  catch (error) {
    if (!state) loadRoom(0);
    $('sharing').open = true;
    $('link-error').textContent = `Could not load the shared dispatch: ${error.message} The loaded yard is intact.`;
  }
}
window.addEventListener('hashchange', readLink);
readLink();

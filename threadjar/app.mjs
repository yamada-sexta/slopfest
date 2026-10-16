import { parse, createState, step, runnable, status as runStatus, nextInstruction, explore } from './core.mjs';
import { examples } from './examples.mjs';
const $ = id => document.getElementById(id);
const colors = ['#f4bc83', '#94cddd', '#c6abe6'];
let state, appliedSource = '', history = [], views = [], report = null;
const el = (tag, className, text) => { const node = document.createElement(tag); if (className) node.className = className; if (text !== undefined) node.textContent = text; return node; };
const summary = shared => Object.entries(shared).map(([id, value]) => `${id} = ${value}`).join(' · ') || 'no shared jars';
const counted = (count, word) => `${count} ${word}${count === 1 ? '' : 's'}`;

examples.forEach((example, i) => { const option = el('option', '', example.name); option.value = i; $('example').append(option); });
function sourceStatus() {
  const dirty = $('source').value !== appliedSource;
  $('source-status').textContent = dirty ? 'EDITS NOT APPLIED' : 'PROGRAM APPLIED';
  $('source-status').classList.toggle('dirty', dirty);
}
function apply() {
  try {
    const program = parse($('source').value);
    state = createState(program); appliedSource = $('source').value; history = []; report = null;
    const index = Number($('example').value), example = examples[index], custom = appliedSource !== example.source;
    $('experiment-number').textContent = custom ? 'CUSTOM PROGRAM' : `EXPERIMENT ${String(index + 1).padStart(2, '0')} / 03`;
    $('experiment-name').textContent = custom ? 'Your own little schedule' : example.name;
    $('challenge').textContent = custom ? 'Choose whose instruction runs next, or explore the endings of your applied program.' : example.note;
    $('error').hidden = true; $('source').removeAttribute('aria-invalid'); sourceStatus();
    buildWorkers(); renderReport(); render('Choose a worker’s Step button. Each button runs exactly one instruction; the other workers keep their places.');
  } catch (error) {
    $('error').textContent = error.message; $('error').hidden = false; $('source').setAttribute('aria-invalid', 'true'); sourceStatus();
  }
}
function load() {
  const index = Number($('example').value), example = examples[index];
  $('source').value = example.source;
  $('experiment-number').textContent = `EXPERIMENT ${String(index + 1).padStart(2, '0')} / 03`;
  $('experiment-name').textContent = example.name; $('challenge').textContent = example.note;
  apply();
}

function buildWorkers() {
  $('workers').replaceChildren(); $('workers').style.setProperty('--workers', state.workers.length);
  views = state.program.threads.map((thread, index) => {
    const card = el('article', 'worker'); card.style.setProperty('--worker', colors[index]);
    const header = el('div', 'worker-top'), title = el('h3', '', thread.id), pocket = el('span', 'pocket', 'POCKET '), value = el('b', '', '0'); pocket.append(value); header.append(title, pocket);
    const list = el('ol', 'instructions'); list.setAttribute('aria-label', `${thread.id} instructions`);
    const lines = thread.instructions.map((instruction, i) => {
      const li = el('li'); li.append(el('small', '', String(i + 1).padStart(2, '0')), el('span', '', `${instruction.op} ${instruction.arg}`)); list.append(li); return li;
    });
    const footer = el('div', 'worker-next'), hint = el('p'), button = el('button', '', `Step ${thread.id} →`);
    button.addEventListener('click', () => take(thread.id)); footer.append(hint, button); card.append(header, list, footer); $('workers').append(card);
    return { value, lines, hint, button };
  });
}
function take(id) {
  const result = step(state, id);
  if (result.ok) { history.push({ before: state, id, message: result.message }); state = result.state; }
  render(result.message);
}
function render(message) {
  const kind = runStatus(state), available = runnable(state);
  $('run-state').textContent = kind === 'running' ? 'READY TO STEP' : kind.toUpperCase(); $('run-state').dataset.state = kind;
  $('tick').textContent = String(state.tick).padStart(2, '0');
  $('deal').disabled = kind !== 'running'; $('undo').disabled = !history.length;
  $('jars').replaceChildren();
  for (const [id, value] of Object.entries(state.shared)) {
    const jar = el('div', 'jar'), icon = el('span', 'jar-icon'); icon.setAttribute('aria-hidden', 'true');
    for (let i = 0; i < Math.min(Math.max(value, 0), 6); i++) icon.append(el('i'));
    const label = el('span'); label.append(el('span', 'jar-name', id), el('span', 'jar-value', value)); jar.append(icon, label); $('jars').append(jar);
  }
  $('locks').replaceChildren();
  for (const [id, owner] of Object.entries(state.locks)) $('locks').append(el('span', owner ? 'held' : '', `⚿ ${id}: ${owner ? `held by ${owner}` : 'free'}`));
  state.workers.forEach((worker, index) => {
    const view = views[index], instruction = nextInstruction(state, index);
    view.value.textContent = worker.pocket; view.button.disabled = !available.includes(worker.id);
    view.lines.forEach((line, i) => {
      line.classList.toggle('current', i === worker.pc); line.classList.toggle('done', i < worker.pc);
      if (i === worker.pc) line.setAttribute('aria-current', 'step'); else line.removeAttribute('aria-current');
    });
    view.hint.textContent = !instruction ? 'All instructions finished.'
      : instruction.op === 'lock' && state.locks[instruction.arg] !== null ? `Waiting for ${instruction.arg}, held by ${state.locks[instruction.arg]}.`
      : ({ load: `Read ${instruction.arg} into this pocket.`, add: `Add ${instruction.arg} to this pocket.`, store: `Copy this pocket into ${instruction.arg}.`, lock: `Take the ${instruction.arg} key.`, unlock: `Return the ${instruction.arg} key.` })[instruction.op];
  });
  $('status').textContent = kind === 'finished' ? `Run finished: ${summary(state.shared)}. Inspect another ending or reset to try a different order.`
    : kind === 'deadlock' ? 'Deadlock. Every unfinished worker is waiting for a held key. Undo or reset to try another order.'
    : kind === 'fault' ? state.fault : message || 'Choose whose instruction runs next.';
  $('trace-count').textContent = counted(history.length, 'turn'); $('empty-trace').hidden = Boolean(history.length); $('trace').replaceChildren();
  history.forEach(entry => {
    const item = el('li', '', entry.message); item.style.color = colors[state.workers.findIndex(t => t.id === entry.id)]; $('trace').append(item);
  });
}
function renderReport() {
  $('outcomes').replaceChildren(); $('search-summary').classList.toggle('incomplete', Boolean(report && !report.complete));
  if (!report) { $('search-summary').textContent = 'Run the explorer to find distinct endings and a trace for each one. It checks the currently applied program.'; return; }
  $('search-summary').textContent = report.complete
    ? `Search complete: ${report.visited.toLocaleString()} distinct states, ${counted(report.outcomes.length, 'distinct ending')}. These cover every allowed instruction order.`
    : `Search stopped at ${report.visited.toLocaleString()} states. Found ${report.outcomes.length} endings so far; more may exist. Try a shorter program or fewer workers.`;
  report.outcomes.forEach(outcome => {
    const card = el('div', `outcome ${outcome.kind}`), text = el('div');
    text.append(el('strong', '', summary(outcome.shared)), el('small', '', `${outcome.kind.toUpperCase()} · ${outcome.schedule.length} TURNS`));
    if (outcome.fault) text.append(el('small', '', outcome.fault));
    const button = el('button', '', 'Inspect trace'); button.setAttribute('aria-label', `Inspect ${outcome.kind} trace: ${summary(outcome.shared)}`);
    button.addEventListener('click', () => {
      state = createState(state.program); history = [];
      for (const id of outcome.schedule) {
        const result = step(state, id); if (!result.ok) throw new Error('This witness is not runnable.');
        history.push({ before: state, id, message: result.message }); state = result.state;
      }
      render();
    });
    card.append(text, button); $('outcomes').append(card);
  });
}

$('example').addEventListener('change', load);
$('source').addEventListener('input', sourceStatus);
$('apply').addEventListener('click', apply);
$('deal').addEventListener('click', () => { const available = runnable(state); if (available.length) take(available[Math.floor(Math.random() * available.length)]); });
$('undo').addEventListener('click', () => { const entry = history.pop(); if (entry) { state = entry.before; render('One turn unwound. Choose a different worker to change what happens next.'); } });
$('reset').addEventListener('click', () => { state = createState(state.program); history = []; render('Run reset. The same program starts again with fresh pockets.'); });
$('explore').addEventListener('click', () => { report = explore(state.program); renderReport(); });
$('save').addEventListener('click', () => {
  const trace = { format: 'threadjar-trace-v1', source: appliedSource, schedule: history.map(entry => entry.id), outcome: { kind: runStatus(state), shared: state.shared, fault: state.fault } };
  const url = URL.createObjectURL(new Blob([JSON.stringify(trace, null, 2)], { type: 'application/json' }));
  const link = document.createElement('a'); link.href = url; link.download = 'threadjar-trace.json'; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
});
load();

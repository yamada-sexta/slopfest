import { REGISTERS } from './core.mjs';
import { createWorkbench, seek, preview, inverseSource } from './workbench.mjs';
import { specimens } from './specimens.mjs';

const $ = id => document.getElementById(id);
let machine, loadedSource, loadedSeeds, dirty = false;
const seedInputs = REGISTERS.map((name, i) => {
  const label = document.createElement('label'); label.textContent = name;
  const input = document.createElement('input'); input.type = 'number'; input.min = '0'; input.max = '255'; input.step = '1';
  input.setAttribute('aria-label', `Starting byte ${name}`); input.value = specimens[0].initial[i];
  label.append(input); $('seeds').append(label); return input;
});
specimens.forEach((specimen, i) => {
  const option = document.createElement('option'); option.value = i; option.textContent = specimen.name; $('specimen').append(option);
});
const registers = REGISTERS.map(name => {
  const card = document.createElement('div'); card.className = 'register';
  const header = document.createElement('header'), title = document.createElement('span'), hex = document.createElement('span');
  title.textContent = name; hex.className = 'hex'; header.append(title, hex);
  const decimal = document.createElement('output'); decimal.className = 'decimal'; decimal.setAttribute('aria-label', `Register ${name}`);
  const bits = document.createElement('div'); bits.className = 'bits'; bits.setAttribute('role', 'img');
  const cells = Array.from({ length: 8 }, (_, i) => { const bit = document.createElement('span'); bit.className = 'bit'; bit.title = `Bit ${7 - i} · weight ${2 ** (7 - i)}`; bits.append(bit); return bit; });
  const initial = document.createElement('small'); card.append(header, decimal, bits, initial); $('registers').append(card);
  return { card, hex, decimal, bits, cells, initial };
});

function render(before = machine.values) {
  const { values, initial, cursor, program } = machine;
  registers.forEach((register, i) => {
    register.decimal.value = String(values[i]).padStart(3, '0');
    register.hex.textContent = values[i].toString(16).padStart(2, '0').toUpperCase() + ' hex';
    register.card.classList.toggle('changed', values[i] !== before[i]);
    register.bits.setAttribute('aria-label', `${REGISTERS[i]} binary ${values[i].toString(2).padStart(8, '0')}; high bit on the left`);
    register.cells.forEach((cell, bit) => { const mask = 1 << (7 - bit); cell.classList.toggle('on', Boolean(values[i] & mask)); cell.classList.toggle('changed', Boolean((values[i] ^ before[i]) & mask)); });
    register.initial.textContent = `START ${String(initial[i]).padStart(3, '0')}`;
    if (values[i] === initial[i]) register.initial.append(document.createElement('br'), document.createTextNode('SAME'));
    register.initial.className = values[i] === initial[i] ? 'home' : '';
  });
  $('position').textContent = `${String(cursor).padStart(2, '0')} / ${String(program.length).padStart(2, '0')}`;
  $('progress-label').textContent = `${cursor} of ${program.length}`;
  $('cursor').max = program.length; $('cursor').value = cursor;
  $('cursor').setAttribute('aria-valuetext', `${cursor} of ${program.length} instructions applied`);
  $('cursor').disabled = dirty;
  $('back').disabled = $('uncast').disabled = dirty || cursor === 0;
  $('forward').disabled = $('cast').disabled = dirty || cursor === program.length;
  const next = preview(machine), previous = preview(machine, -1);
  $('next').textContent = next?.instruction ?? 'Spell complete';
  $('explanation').textContent = next?.explanation ?? 'Every step is reversible. Uncast all to bring the four bytes home.';
  $('previous').textContent = previous?.instruction ?? 'At the beginning';
  const start = Math.max(0, Math.min(cursor - 3, program.length - 7)), end = Math.min(program.length, start + 7);
  $('tape').replaceChildren();
  for (let i = start; i < end; i++) {
    const item = program[i], row = document.createElement('li'); row.className = i === cursor ? 'next' : i < cursor ? 'done' : '';
    if (i === cursor) row.setAttribute('aria-current', 'step');
    for (const [text, className] of [[`${i === cursor ? '→' : i < cursor ? '✓' : '·'} ${i + 1}`, ''], [[item.op, item.target, item.operand].filter(v => v !== undefined).join(' '), ''], [`L${item.line}`, 'line']]) {
      const span = document.createElement('span'); span.textContent = text; span.className = className; row.append(span);
    }
    $('tape').append(row);
  }
}

function load() {
  $('source').removeAttribute('aria-invalid');
  seedInputs.forEach(input => input.removeAttribute('aria-invalid'));
  try {
    const seedText = seedInputs.map(input => input.value);
    const invalidSeed = seedText.findIndex(value => !/^(0|[1-9]\d{0,2})$/.test(value) || Number(value) > 255);
    if (invalidSeed !== -1) {
      seedInputs[invalidSeed].setAttribute('aria-invalid', 'true');
      throw new Error(`Starting byte ${REGISTERS[invalidSeed]} needs a whole decimal value from 0 to 255.`);
    }
    // Validate first. A bad draft never replaces the loaded program or its bytes.
    const next = createWorkbench($('source').value, seedText.map(Number));
    machine = next; loadedSource = $('source').value; loadedSeeds = seedText; dirty = false;
    $('draft-note').textContent = `Loaded ${machine.program.length} reversible instructions. Edits wait until you load again.`;
    $('draft-note').className = 'small'; $('source').removeAttribute('aria-invalid');
    $('inverse').value = inverseSource(machine);
    $('notice').textContent = 'Try Cast all, then Uncast all. Every byte will come home.';
    render();
  } catch (error) {
    $('draft-note').textContent = error.message; $('draft-note').className = 'small error';
    if (!seedInputs.some(input => input.hasAttribute('aria-invalid'))) $('source').setAttribute('aria-invalid', 'true');
  }
}

function changed() {
  dirty = $('source').value !== loadedSource || seedInputs.some((input, i) => input.value !== loadedSeeds[i]);
  $('draft-note').textContent = dirty ? 'Draft changed. Load spell to restart with these edits.' : 'The loaded spell is ready.';
  $('draft-note').className = 'small'; $('source').removeAttribute('aria-invalid');
  seedInputs.forEach(input => input.removeAttribute('aria-invalid'));
  $('notice').textContent = dirty ? 'Draft edits paused the machine. Load the spell to continue.' : 'The loaded spell is ready to step.';
  render();
}

function move(target) {
  if (dirty || target === machine.cursor) return;
  const before = machine.values, delta = target - machine.cursor;
  const step = Math.abs(delta) === 1 ? preview(machine, Math.sign(delta)) : null;
  machine = seek(machine, target); render(before);
  $('notice').textContent = target === 0 ? 'Home again. All four starting bytes recovered by inverse arithmetic.'
    : step ? `${delta > 0 ? 'Cast' : 'Uncast'} ${step.instruction}. ${step.explanation}`
    : `${delta > 0 ? 'Cast' : 'Uncast'} ${Math.abs(delta)} instructions. ${target === machine.program.length ? 'Spell complete. Now try Uncast all.' : 'Keep exploring in either direction.'}`;
}

$('load').addEventListener('click', load);
$('source').addEventListener('input', changed); seedInputs.forEach(input => input.addEventListener('input', changed));
$('specimen').addEventListener('change', () => {
  const specimen = specimens[Number($('specimen').value)]; $('source').value = specimen.source;
  seedInputs.forEach((input, i) => { input.value = specimen.initial[i]; }); load();
});
$('back').addEventListener('click', () => move(machine.cursor - 1));
$('forward').addEventListener('click', () => move(machine.cursor + 1));
$('cast').addEventListener('click', () => move(machine.program.length));
$('uncast').addEventListener('click', () => move(0));
$('cursor').addEventListener('input', event => move(Number(event.target.value)));
$('machine').addEventListener('keydown', event => {
  // Native slider and button keyboard behavior takes precedence inside controls.
  if (event.target !== $('machine') || dirty) return;
  const positions = { ArrowLeft: Math.max(0, machine.cursor - 1), ArrowRight: Math.min(machine.program.length, machine.cursor + 1), Home: 0, End: machine.program.length };
  if (Object.hasOwn(positions, event.key)) { event.preventDefault(); move(positions[event.key]); }
});
$('source').value = specimens[0].source; load();

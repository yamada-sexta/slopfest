import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deck, shuffle, run, analyze, route, toSVG } from '../core.mjs';

// Physical oracle: cut arrays in half, then zip the halves in the chosen order.
function interleave(cards, side) {
  const top = cards.slice(0,cards.length/2), bottom = cards.slice(cards.length/2);
  const [first,second] = side === 'O' ? [top,bottom] : [bottom,top];
  return first.flatMap((card,i) => [card,second[i]]);
}
function apply(cards, word) { for (const side of word) cards = interleave(cards,side); return cards; }
function shortest(cards, card, target) {
  let candidates = [''];
  for (let depth = 0; depth < cards.length; depth++) {
    for (const word of candidates) if (apply(cards,word).indexOf(card) === target - 1) return word;
    candidates = candidates.flatMap(word => ['O','I'].map(side => word + side));
  }
  return null;
}

test('All 4064 words through six shuffles agree with physical interleaving across every supported deck size', () => {
  let checked = 0;
  for (let size = 2; size <= 64; size += 2) {
    let words = [''];
    for (let depth = 0; depth <= 6; depth++) {
      for (const word of words) {
        const journey = run(word,size);
        let expected = Array.from({length:size},(_,i) => i + 1);
        assert.deepEqual(journey.frames[0].cards,expected);
        [...word].forEach((side,i) => {
          expected = interleave(expected,side);
          assert.deepEqual(journey.frames[i+1].cards,expected);
        });
        assert.deepEqual([...expected].sort((a,b)=>a-b),Array.from({length:size},(_,i)=>i+1));
        checked++;
      }
      words = words.flatMap(word => ['O','I'].map(side => word + side));
    }
  }
  assert.equal(checked,4064);
  assert.deepEqual(shuffle(deck(8),'O').cards,[1,5,2,6,3,7,4,8]);
  assert.deepEqual(shuffle(deck(8),'I').cards,[5,1,6,2,7,3,8,4]);
});

test('Cycle orders equal the first physical return for every short word on small decks', () => {
  for (let size = 2; size <= 10; size += 2) {
    let words = [''];
    for (let depth = 0; depth <= 4; depth++) {
      for (const word of words) {
        const journey = run(word,size), report = analyze(journey), initial = deck(size).cards;
        let physical = [...initial], repeats = 0;
        do { physical = apply(physical,word); repeats++; assert.ok(repeats <= 2520); } while (physical.some((card,i)=>card!==initial[i]));
        assert.equal(report.order,String(repeats));
        assert.deepEqual(report.cycles.flat().sort((a,b)=>a-b),[...initial]);
        for (const cycle of report.cycles) cycle.forEach((at,i) => assert.equal(report.destinations[at-1],cycle[(i+1)%cycle.length]));
      }
      words = words.flatMap(word=>['O','I'].map(side=>word+side));
    }
  }
  assert.equal(analyze(run('O',52)).order,'8');
  assert.equal(analyze(run('I',52)).order,'52');
  for (const [side,period] of [['O',8],['I',52]]) {
    let physical = deck(52).cards;
    for (let repeat = 1; repeat <= period; repeat++) {
      physical = interleave(physical,side);
      assert.equal(physical.every((card,i)=>card===i+1),repeat===period);
    }
  }
  assert.equal(analyze(run('',64)).order,'1');
  assert.deepEqual(analyze(run('OIO',8)).cycles,[[1,3],[2,4],[5,7],[6,8]]);
});

test('Card routes match independent word enumeration from already shuffled decks', () => {
  let checked = 0;
  for (const size of [2,4,6,8,10,12,64]) {
    const initial = run('OIO',size).frames.at(-1);
    const cards = size === 64 ? [1,64] : initial.cards;
    for (const card of cards) for (let target = 1; target <= size; target++) {
      const result = route(initial,card,target), expected = shortest(initial.cards,card,target);
      assert.equal(result.word,expected,`${size}/${card}/${target}`);
      assert.ok(result.discovered <= size);
      assert.ok(result.word.length < size);
      let physical = initial.cards;
      const positions = [physical.indexOf(card)+1];
      for (const side of result.word) { physical = interleave(physical,side); positions.push(physical.indexOf(card)+1); }
      assert.deepEqual(result.positions,positions);
      assert.equal(physical[target-1],card);
      checked++;
    }
  }
  assert.equal(checked,492);
  assert.equal(route(deck(8),1,8).word,'III');
  assert.equal(route(deck(8),4,4).word,'');
  assert.equal(route(deck(8),4,4).discovered,1);
});

test('All 45760 card-to-position pairs across every supported deck have valid shuffle routes', () => {
  let checked = 0;
  for (let size = 2; size <= 64; size += 2) {
    const initial = deck(size);
    for (let card = 1; card <= size; card++) for (let target = 1; target <= size; target++) {
      const result = route(initial,card,target);
      assert.ok(result.discovered <= size);
      assert.ok(result.word.length < size);
      assert.equal(apply(initial.cards,result.word)[target-1],card);
      checked++;
    }
  }
  assert.equal(checked,45760);
});

test('Limits, immutable states, stable card identity, and forged data are enforced', () => {
  const initial = deck(), next = shuffle(initial,'I'), journey = run();
  assert.deepEqual(initial.cards,[1,2,3,4,5,6,7,8]);
  assert.throws(()=>next.cards.pop());
  assert.throws(()=>journey.frames.pop());
  assert.throws(()=>analyze(journey).cycles[0].push(9));
  assert.throws(()=>route(initial,1,8).positions.pop());
  for (const size of [0,1,3,65,2.5,'8',null]) assert.throws(()=>deck(size));
  for (const word of [null,8,'o','OL','O I','I'.repeat(129)]) assert.throws(()=>run(word));
  assert.equal(run('I'.repeat(128),64).frames.length,129);
  for (const value of [0,9,-1,1.5,'1',NaN]) { assert.throws(()=>route(initial,value,1)); assert.throws(()=>route(initial,1,value)); }
  assert.throws(()=>shuffle(initial,'L'));
  assert.throws(()=>shuffle({...initial},'O'));
  assert.throws(()=>analyze({...journey}));
  assert.throws(()=>toSVG({...journey}));
  assert.throws(()=>toSVG(journey,{card:9}));
});

test('SVG follows the selected original card and preserves every deck frame', () => {
  const svg = toSVG(run('OIO',8),{card:1});
  assert.equal((svg.match(/data-card=/g)??[]).length,32);
  assert.equal((svg.match(/fill="#efac87"/g)??[]).length,4);
  assert.match(svg,/points="90,104 160,104 230,128 300,152"/);
  assert.match(toSVG(run('',2),{card:2}),/following 2/);
  const maximum = toSVG(run('O'.repeat(128),64),{card:64});
  assert.equal((maximum.match(/data-card=/g)??[]).length,64*129);
  assert.doesNotMatch(maximum,/NaN|Infinity|undefined/);
});

const cli = fileURLToPath(new URL('../cli.mjs',import.meta.url));
const invoke = (...args) => spawnSync(process.execPath,[cli,...args],{encoding:'utf8',timeout:10000});
test('The real CLI appends routes, prints exact receipts, and refuses to overwrite SVGs', async () => {
  const directory = await mkdtemp(join(tmpdir(),'riffraff-'));
  try {
    const file = join(directory,'cards.svg');
    const result = invoke('','--cards','8','--card','1','--to','8','--json','--svg',file);
    assert.equal(result.status,0,result.stderr);
    const journey = run('III',8), receipt = JSON.parse(result.stdout);
    assert.deepEqual(receipt,{initialWord:'',...journey,card:1,analysis:analyze(journey),route:route(deck(8),1,8)});
    assert.equal(await readFile(file,'utf8'),toSVG(journey,{card:1}));
    const text = invoke('','--to','8','--trace'); assert.equal(text.status,0,text.stderr);
    assert.match(text.stdout,/Append III/); assert.match(text.stdout,/3 I  8 7 6 5 4 3 2 1/);
    await writeFile(file,'keep'); assert.equal(invoke('--svg',file).status,1); assert.equal(await readFile(file,'utf8'),'keep');
    const absent = join(directory,'absent.svg');
    assert.equal(invoke('--card','9','--svg',absent).status,1); await assert.rejects(readFile(absent));
    assert.equal(invoke('O'.repeat(128),'--to','8','--svg',absent).status,1); await assert.rejects(readFile(absent));
    const emptyRoute = invoke('O'.repeat(128),'--to','1','--json'); assert.equal(emptyRoute.status,0,emptyRoute.stderr);
    assert.equal(JSON.parse(emptyRoute.stdout).route.word,'');
    assert.equal(invoke('--help').status,0);
    assert.equal(invoke().status,0);
  } finally { await rm(directory,{recursive:true,force:true}); }
});

test('CLI rejects malformed and duplicate options before printing analysis', () => {
  for (const args of [['--what'],['--help','--json'],['O','I'],['--cards'],['--cards','3'],
    ['--cards','66'],['--cards','08'],['--card','0'],['--card','9'],['--to','9'],['--to','1.5'],
    ['--json','--json'],['--trace','--trace'],['--cards','8','--cards','10'],['--svg',''],['X']]) {
    const result = invoke(...args); assert.equal(result.status,1,args.join(' '));
    assert.equal(result.stdout,''); assert.ok(result.stderr.trim());
  }
});

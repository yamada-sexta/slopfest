import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { race, counterpick, byToss } from '../core.mjs';

function reduced(n, d) {
  let a = n, b = d;
  while (b) [a, b] = [b, a % b];
  n /= a; d /= a;
  return d === 1n ? String(n) : `${n}/${d}`;
}
const pair = value => value.split('/').map(BigInt).concat(value.includes('/') ? [] : [1n]);
const add = ([a,b],[c,d]) => [a*d+c*b,b*d];
const compare = ([a,b],[c,d]) => a*d-c*b;
const words = length => Array.from({length:2**length},(_,i)=>i.toString(2).padStart(length,'0').replaceAll('0','H').replaceAll('1','T'));

// Read complete strings, locate the first winning substring, and weight the
// entire string directly. There are no prefix states or evolving mass arrays.
function enumerate(patterns, horizon, heads = '1/2') {
  const [h,d] = pair(heads), wins = patterns.map(() => 0n);
  let unresolved = 0n, watched = 0n;
  for (let bits = 0; bits < 2 ** horizon; bits++) {
    const stream = horizon === 0 ? '' : bits.toString(2).padStart(horizon,'0').replaceAll('0','H').replaceAll('1','T');
    const headCount = [...stream].filter(toss => toss === 'H').length;
    const weight = h ** BigInt(headCount) * (d - h) ** BigInt(horizon - headCount);
    let winner = -1, end = horizon + 1;
    patterns.forEach((pattern,i) => {
      const at = stream.indexOf(pattern);
      if (at !== -1 && at + pattern.length < end) { winner = i; end = at + pattern.length; }
    });
    if (winner === -1) unresolved += weight;
    else wins[winner] += weight;
    watched += BigInt(winner === -1 ? horizon : end) * weight;
  }
  const denominator = d ** BigInt(horizon);
  return {
    tosses: horizon,
    outcomes: patterns.map((pattern,i) => ({pattern, probability:reduced(wins[i],denominator)})),
    unresolved: reduced(unresolved,denominator),
    expectedObservedTosses: reduced(watched,denominator),
  };
}

test('All 154 fair-coin pairs agree with complete-string enumeration at every deadline through eight', () => {
  let checked = 0;
  for (let length = 2; length <= 4; length++) {
    const options = words(length);
    for (let i = 0; i < options.length; i++) for (let j = i + 1; j < options.length; j++) {
      const receipt = race([options[i],options[j]]);
      for (let horizon = 0; horizon <= 8; horizon++) {
        assert.deepEqual(byToss(receipt,horizon),enumerate(receipt.patterns,horizon));
        checked++;
      }
    }
  }
  assert.equal(checked,1386);
});

test('Deadline boundaries distinguish stopping early, certain completion, and eventual expectations', () => {
  const receipt = race();
  assert.deepEqual(byToss(receipt,0),{
    tosses:0, outcomes:[{pattern:'HHH',probability:'0'},{pattern:'HTH',probability:'0'}],
    unresolved:'1', expectedObservedTosses:'0',
  });
  assert.equal(byToss(receipt,2).unresolved,'1');
  assert.equal(byToss(receipt,2).expectedObservedTosses,'2');
  assert.deepEqual(byToss(receipt,4),{
    tosses:4, outcomes:[{pattern:'HHH',probability:'3/16'},{pattern:'HTH',probability:'1/4'}],
    unresolved:'9/16', expectedObservedTosses:'15/4',
  });
  const complete = race(['HH','HT','TH','TT'],{heads:'2/3'});
  for (const horizon of [2,3,12,256]) {
    const forecast = byToss(complete,horizon);
    assert.deepEqual(forecast.outcomes,complete.outcomes);
    assert.equal(forecast.unresolved,'0');
    assert.equal(forecast.expectedObservedTosses,'2');
  }
  let previous = byToss(receipt,0);
  for (let horizon = 1; horizon <= 32; horizon++) {
    const next = byToss(receipt,horizon);
    assert.ok(compare(pair(next.unresolved),pair(previous.unresolved)) <= 0n);
    next.outcomes.forEach((row,i) => assert.ok(compare(pair(row.probability),pair(previous.outcomes[i].probability)) >= 0n));
    assert.ok(compare(pair(next.expectedObservedTosses),pair(previous.expectedObservedTosses)) >= 0n);
    assert.ok(compare(pair(next.expectedObservedTosses),pair(receipt.expectedTosses)) <= 0n);
    previous = next;
  }
});

test('Biased multi-way races and long exact forecasts conserve probability and respect symmetry', () => {
  for (const [patterns,heads] of [
    [['HH','HT','TH','TT'],'2/3'],
    [['HHT','HTH','THH'],'1/3'],
    [['HHHHHH','HTHTHT','TTTTTT'],'17/32'],
  ]) {
    const receipt = race(patterns,{heads});
    for (let horizon = 0; horizon <= 10; horizon++) assert.deepEqual(byToss(receipt,horizon),enumerate(patterns,horizon,heads));
    const complement = patterns.map(word => [...word].map(c => c === 'H' ? 'T' : 'H').join(''));
    const [h,d] = pair(heads), other = race(complement,{heads:`${d-h}/${d}`});
    const original = byToss(receipt,256), swapped = byToss(other,256);
    assert.deepEqual(original.outcomes.map(row => row.probability),swapped.outcomes.map(row => row.probability));
    assert.equal(original.unresolved,swapped.unresolved);
    assert.equal(original.expectedObservedTosses,swapped.expectedObservedTosses);
    const mass = original.outcomes.map(row => pair(row.probability)).reduce(add,pair(original.unresolved));
    assert.equal(compare(mass,[1n,1n]),0n);
  }
  assert.ok(byToss(race(['HHHHHH','HTHTHT'],{heads:'17/32'}),256).unresolved.length > 30);
});

test('Forecasts are frozen, repeatable, bounded, and require an engine-created race', () => {
  const receipt = race(), before = JSON.stringify(receipt), forecast = byToss(receipt,12);
  assert.equal(JSON.stringify(receipt),before);
  assert.deepEqual(byToss(receipt,12),forecast);
  assert.throws(() => { forecast.unresolved = '0'; });
  assert.throws(() => { forecast.outcomes[0].probability = '1'; });
  assert.throws(() => forecast.outcomes.pop());
  for (const horizon of [-1,257,1.5,'12',null,NaN,Infinity]) assert.throws(() => byToss(receipt,horizon),/deadline/);
  for (const foreign of [null,{}, {...receipt},JSON.parse(before),counterpick('HHH')]) assert.throws(() => byToss(foreign,12),/race receipt/);
});

const cli = fileURLToPath(new URL('../cli.mjs',import.meta.url));
const invoke = (...args) => spawnSync(process.execPath,[cli,...args],{encoding:'utf8',timeout:10000});
test('CLI deadline reports keep the full race and exact forecast and reject ambiguous arguments', () => {
  const receipt = race(['HHH','THH'],{heads:'2/3'});
  const result = invoke('HHH','THH','--heads','2/3','--by','12','--json');
  assert.equal(result.status,0,result.stderr);
  assert.deepEqual(JSON.parse(result.stdout),{...receipt,byToss:byToss(receipt,12)});
  const text = invoke('--by','4','--states');
  assert.equal(text.status,0,text.stderr);
  assert.match(text.stdout,/By toss 4:/);
  assert.match(text.stdout,/Still racing: 9\/16/);
  assert.match(text.stdout,/stop at 4\): 15\/4/);
  assert.match(text.stdout,/Matched prefix/);
  assert.equal(JSON.parse(invoke('--by','0','--json').stdout).byToss.expectedObservedTosses,'0');
  assert.equal(invoke('--by','256','--json').status,0);
  for (const args of [['--by'],['--by','-1'],['--by','257'],['--by','01'],['--by','1.5'],
    ['--by','1e2'],['--by','2','--by','3'],['--counter','HHH','--by','12']]) {
    const failed = invoke(...args); assert.equal(failed.status,1,args.join(' '));
    assert.equal(failed.stdout,''); assert.ok(failed.stderr.trim());
  }
});

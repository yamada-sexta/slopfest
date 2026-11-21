import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { race, counterpick } from '../core.mjs';

// Test arithmetic uses unreduced pairs and cross multiplication, not the solver.
const rational = value => { const [n, d = '1'] = value.split('/'); return [BigInt(n), BigInt(d)]; };
const plus = ([a,b], [c,d]) => [a*d+c*b,b*d];
const times = ([a,b], [c,d]) => [a*c,b*d];
const equal = ([a,b], [c,d]) => a*d === c*b;
const compare = ([a,b], [c,d]) => a*d-c*b;
const wordsOf = length => Array.from({length:2**length}, (_, i) => i.toString(2).padStart(length,'0').replaceAll('0','H').replaceAll('1','T'));

function certificate(result) {
  const p = rational(result.heads), q = [p[1]-p[0],p[1]];
  assert.equal(result.states[0].prefix, '');
  const prefixes = result.patterns.flatMap(word => Array.from({length:word.length}, (_, i) => word.slice(0,i)));
  assert.deepEqual(new Set(result.states.map(state => state.prefix)), new Set(prefixes));
  for (const state of result.states) {
    const expected = [];
    for (const toss of ['H','T']) {
      const suffix = state.prefix + toss;
      // Winner words all have the same length; a matching complete suffix wins.
      const full = result.patterns.find(word => suffix.slice(-word.length) === word);
      const fallback = prefixes.filter(prefix => suffix.endsWith(prefix)).sort((a,b) => b.length-a.length)[0];
      assert.equal(state[toss], full ?? fallback);
      expected.push(full ? {
        probabilities:result.patterns.map(word => word===full?'1':'0'), expectedTosses:'0',
      } : result.states.find(candidate => candidate.prefix===fallback));
    }
    const probabilities = state.probabilities.map(rational);
    assert.ok(equal(probabilities.reduce(plus,[0n,1n]),[1n,1n]));
    for(let i=0;i<probabilities.length;i++) {
      assert.ok(compare(probabilities[i],[0n,1n])>=0n);
      assert.ok(compare(probabilities[i],[1n,1n])<=0n);
      assert.ok(equal(probabilities[i],plus(times(p,rational(expected[0].probabilities[i])),times(q,rational(expected[1].probabilities[i])))));
    }
    const nextTime = plus([1n,1n],plus(times(p,rational(expected[0].expectedTosses)),times(q,rational(expected[1].expectedTosses))));
    assert.ok(equal(rational(state.expectedTosses),nextTime));
  }
  assert.deepEqual(result.outcomes.map(outcome=>outcome.probability),result.states[0].probabilities);
  assert.ok(result.outcomes.every(outcome=>compare(rational(outcome.probability),[0n,1n])>0n));
  assert.equal(result.expectedTosses,result.states[0].expectedTosses);
}

// Independent finite-word oracle: retain every possible trailing window, rather
// than the solver's compressed matched-prefix states. Integer weights count
// whole toss strings. Already-absorbed words are extended with arbitrary tosses.
function finiteBounds(patterns, heads='1/2', depth=60) {
  const [h,d] = rational(heads), width=patterns[0].length;
  let windows=new Map([['',1n]]), wins=patterns.map(()=>0n), denominator=1n, elapsed=0n;
  for(let step=0;step<depth;step++) {
    const surviving=[...windows.values()].reduce((a,b)=>a+b,0n);
    elapsed=(elapsed+surviving)*d;
    wins=wins.map(count=>count*d);
    const next=new Map();
    for(const [window,count] of windows) for(const [toss,weight] of [['H',h],['T',d-h]]) {
      const tail=window+toss, winner=patterns.indexOf(tail.slice(-width));
      if(winner>=0) wins[winner]+=count*weight;
      else { const key=tail.slice(-(width-1)); next.set(key,(next.get(key)??0n)+count*weight); }
    }
    windows=next; denominator*=d;
  }
  return {wins,denominator,elapsed,surviving:[...windows.values()].reduce((a,b)=>a+b,0n)};
}

test('All 154 fair-coin pairs through length four satisfy exact certificates and independent word bounds', () => {
  let checked=0;
  for(let length=2;length<=4;length++) {
    const words=wordsOf(length);
    for(let i=0;i<words.length;i++) for(let j=i+1;j<words.length;j++) {
      const result=race([words[i],words[j]]); certificate(result);
      const bounds=finiteBounds(result.patterns);
      result.outcomes.forEach((outcome,k)=>{
        const chance=rational(outcome.probability);
        assert.ok(compare(chance,[bounds.wins[k],bounds.denominator])>=0n);
        assert.ok(compare(chance,[bounds.wins[k]+bounds.surviving,bounds.denominator])<=0n);
      });
      assert.ok(compare(rational(result.expectedTosses),[bounds.elapsed,bounds.denominator])>=0n);
      checked++;
    }
  }
  assert.equal(checked,154);
});

test('Known races include overlap, a strongly favored counterpick, and complete two-toss coverage', () => {
  const defaultRace=race();
  assert.deepEqual(defaultRace.outcomes,[{pattern:'HHH',probability:'2/5'},{pattern:'HTH',probability:'3/5'}]);
  assert.equal(defaultRace.expectedTosses,'34/5');
  assert.deepEqual(race(['HHH','THH']).outcomes.map(row=>row.probability),['1/8','7/8']);
  assert.equal(race(['HHH','THH']).expectedTosses,'7');
  assert.equal(race(['HH','TT']).expectedTosses,'3');
  assert.deepEqual(race(['HH','HT','TH','TT'],{heads:'2/3'}).outcomes.map(row=>row.probability),['4/9','2/9','2/9','1/9']);
  assert.equal(race(['HH','HT','TH','TT'],{heads:'2/3'}).expectedTosses,'2');
  assert.equal(defaultRace.states.find(state=>state.prefix==='HH').T,'HT');
});

test('Biased, three-way, four-way, and maximum-length races satisfy exact transition equations', () => {
  for(const [patterns,heads] of [
    [['HHT','HTH','THH'],'1/3'],
    [['HHHTTH','HTHTHT','THTHTH','TTTHHH'],'2/3'],
    [['HHHHHH','TTTTTT'],'1/32'],
    [['HHHHHH','TTTTTT'],'31/32'],
    [['HTHTHT','THTHTH','HHHHHH','TTTTTT'],'17/32'],
  ]) {
    const result=race(patterns,{heads}); certificate(result);
    assert.ok(result.states.length<=21);
    const bounds=finiteBounds(patterns,heads,24);
    result.outcomes.forEach((outcome,i)=>{
      assert.ok(compare(rational(outcome.probability),[bounds.wins[i],bounds.denominator])>=0n);
      assert.ok(compare(rational(outcome.probability),[bounds.wins[i]+bounds.surviving,bounds.denominator])<=0n);
    });
  }
});

test('Head/tail complementation and contestant reordering preserve the corresponding answers', () => {
  const words=wordsOf(3), complement=word=>[...word].map(c=>c==='H'?'T':'H').join('');
  for(let i=0;i<words.length;i++) for(let j=i+1;j<words.length;j++) {
    const original=race([words[i],words[j]],{heads:'1/3'});
    const swapped=race([complement(words[i]),complement(words[j])],{heads:'2/3'});
    assert.equal(original.expectedTosses,swapped.expectedTosses);
    assert.deepEqual(original.outcomes.map(row=>row.probability),swapped.outcomes.map(row=>row.probability));
    const reversed=race([words[j],words[i]],{heads:'1/3'});
    assert.equal(original.expectedTosses,reversed.expectedTosses);
    assert.deepEqual(original.outcomes.map(row=>row.probability),reversed.outcomes.map(row=>row.probability).reverse());
  }
});

test('Counterpicks search every alternative and retain every best tie in alphabetic order', () => {
  for(const first of wordsOf(3)) for(const heads of ['1/2','2/3']) {
    const result=counterpick(first,{heads});
    assert.deepEqual(result.choices.map(choice=>choice.pattern),wordsOf(3).filter(word=>word!==first));
    const expected=[];
    for(const choice of result.choices) {
      const receipt=race([first,choice.pattern],{heads});
      assert.equal(choice.probability,receipt.outcomes[1].probability);
      assert.equal(choice.expectedTosses,receipt.expectedTosses);
      assert.ok(compare(rational(choice.probability),rational(result.probability))<=0n);
      if(choice.probability===result.probability) expected.push(choice.pattern);
    }
    assert.deepEqual(result.best,expected);
  }
  assert.deepEqual(counterpick('HHH').best,['THH']);
  assert.equal(counterpick('HHH').probability,'7/8');
  assert.deepEqual(counterpick('HTH').best,['HHT']);
  assert.equal(counterpick('HTH').probability,'2/3');
  assert.deepEqual(counterpick('HT').best,['HH','TH']);
  assert.equal(counterpick('HT').probability,'1/2');
  assert.equal(counterpick('HTHTHT').choices.length,63);
});

test('Inputs are copied, receipts are frozen, and malformed patterns and coins fail clearly', () => {
  const words=['HH','HT'], result=race(words,{heads:'2/4'});
  words[0]='TT'; assert.equal(result.patterns[0],'HH'); assert.equal(result.heads,'1/2');
  assert.throws(()=>{result.states[0].H='TT';});
  assert.throws(()=>result.outcomes.pop());
  assert.throws(()=>counterpick('HHH').best.pop());
  for(const words of [null,[],['HH'],['HH','HH'],['HH','HTH'],['H','T'],['HHHHHHH','TTTTTTT'],
    ['hh','HT'],['HX','TH'],Array(2),['HH','HT','TH','TT','HH']]) assert.throws(()=>race(words));
  for(const heads of ['0/1','1/1','2/1','1/33','01/02','1/0','0.5',0.5,null,'-1/2']) assert.throws(()=>race(['HH','TT'],{heads}));
  for(const word of ['H','HTHTHTH','ht','x',null]) assert.throws(()=>counterpick(word));
});

const cli=fileURLToPath(new URL('../cli.mjs',import.meta.url));
const invoke=(...args)=>spawnSync(process.execPath,[cli,...args],{encoding:'utf8',timeout:10000});
test('The real CLI prints exact race and counterpick receipts and explains state transitions', () => {
  const normal=invoke('--states'); assert.equal(normal.status,0,normal.stderr);
  assert.match(normal.stdout,/HHH wins: 2\/5/); assert.match(normal.stdout,/empty \| H \| empty \| 34\/5/);
  const json=invoke('HHH','THH','--heads','2/3','--json'); assert.equal(json.status,0,json.stderr);
  assert.deepEqual(JSON.parse(json.stdout),race(['HHH','THH'],{heads:'2/3'}));
  const counter=invoke('--counter','HTH','--json'); assert.equal(counter.status,0,counter.stderr);
  assert.deepEqual(JSON.parse(counter.stdout),counterpick('HTH'));
  assert.match(invoke('--counter','HHH').stdout,/Best replies: THH · win probability 7\/8/);
  assert.equal(invoke('--help').status,0);
});

test('CLI rejects ambiguous options and prints no partial analysis on input errors', () => {
  for(const args of [['--help','--json'],['--unknown'],['--heads'],['--counter'],['--heads','0/1'],
    ['--heads','1/2','--heads','1/3'],['--json','--json'],['--states','--states'],['HH'],
    ['HH','HH'],['HH','TT','--counter','HH'],['--counter','HH','--states'],['--counter','H']]) {
    const result=invoke(...args); assert.equal(result.status,1,args.join(' '));
    assert.equal(result.stdout,''); assert.ok(result.stderr.trim());
  }
});

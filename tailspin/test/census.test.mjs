import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { compile } from '../core.mjs';
import { specimens } from '../specimens.mjs';
import { census, censusToSVG } from '../census.mjs';
function words(n) {
  let result = [''];
  for (let i = 0; i < n; i++) result = result.flatMap(word => ['a','b'].map(letter => word + letter));
  return result;
}

// Independent whole-graph oracle for length-preserving programs. Undirected
// components identify shared eventual cycles; peeling indegree-zero vertices
// identifies the cycles themselves, without interpreter traces or cycle keys.
function graph(rules, length) {
  const seeds = words(length), index = new Map(seeds.map((seed,i)=>[seed,i]));
  const next = seeds.map(seed => {
    const queue = [...seed], head = queue[0]; queue.splice(0,2); queue.push(...rules[head]);
    return index.get(queue.join(''));
  });
  const parents = seeds.map((_,i)=>i), indegree = seeds.map(()=>0), live = seeds.map(()=>true);
  const root = i => { while (parents[i] !== i) i = parents[i]; return i; };
  next.forEach((to,from)=>{ parents[root(from)] = root(to); indegree[to]++; });
  const queue = indegree.flatMap((degree,i)=>degree===0?[i]:[]);
  for (let head = 0; head < queue.length; head++) {
    const at = queue[head]; live[at] = false;
    if (--indegree[next[at]] === 0) queue.push(next[at]);
  }
  const groups = new Map();
  seeds.forEach((seed,i)=>{
    const key = root(i);
    if (!groups.has(key)) groups.set(key,{seeds:0,cycle:[]});
    groups.get(key).seeds++; if (live[i]) groups.get(key).cycle.push(seed);
  });
  const sorted = [...groups.entries()].sort((a,b)=>a[1].cycle[0]<b[1].cycle[0]?-1:1);
  const ids = new Map(sorted.map(([key],i)=>[key,i+1]));
  return { orbits: sorted.map(([,group],i)=>({id:i+1,representative:group.cycle[0],period:group.cycle.length,seeds:group.seeds})),
    rows: seeds.map((seed,i)=>{
      let at = i, start = 0;
      while (!live[at]) { at = next[at]; start++; }
      const group = groups.get(root(i));
      return {seed,status:'cycle',steps:start+group.cycle.length,final:seeds[at],cycle:{start,period:group.cycle.length},blockedLength:null,orbit:ids.get(root(i))};
    }) };
}

test('All 1984 seeds across 80 finite queue graphs match independently peeled cycles and components', () => {
  let checked = 0;
  for (const a of words(2)) for (const b of words(2)) for (let length = 2; length <= 6; length++) {
    const receipt = census(compile(`b -> ${b}\na -> ${a}`),length), expected = graph({a,b},length);
    assert.deepEqual(receipt.orbits,expected.orbits,`${a}/${b}/${length}`);
    assert.deepEqual(receipt.outcomes,expected.rows);
    assert.deepEqual(receipt.counts,{halted:0,cycle:2**length,steps:0,size:0});
    assert.deepEqual(receipt.alphabet,['a','b']); assert.equal(receipt.status,'complete');
    checked += receipt.total;
  }
  assert.equal(checked,1984);
});

test('Variable queue lengths, loop phases, multiple orbits and unresolved seeds remain distinct', () => {
  const fall = census(compile(specimens.fall.source),3);
  assert.deepEqual(fall.counts,{halted:6,cycle:2,steps:0,size:0});
  assert.deepEqual(fall.orbits,[{id:1,representative:'ab',period:1,seeds:2}]);
  assert.deepEqual(fall.outcomes.filter(row=>row.orbit).map(row=>row.seed),['baa','bba']);
  const orbit = census(compile(specimens.orbit.source),2);
  assert.deepEqual(orbit.orbits,[{id:1,representative:'aa',period:2,seeds:4}]);
  assert.deepEqual(orbit.outcomes.map(row=>row.cycle.start),[0,1,1,0]);
  const separate = census(compile('a -> aa\nb -> bb'),2);
  assert.deepEqual(separate.orbits,[{id:1,representative:'aa',period:1,seeds:2},{id:2,representative:'bb',period:1,seeds:2}]);
  const mixed = census(compile('a -> aa\nb -> bbb'),2,{maxLength:2});
  assert.equal(mixed.status,'limited'); assert.deepEqual(mixed.counts,{halted:0,cycle:2,steps:0,size:2});
  assert.deepEqual(mixed.outcomes.map(row=>row.blockedLength),[null,null,3,3]);
  assert.ok(mixed.outcomes.filter(row=>row.status==='size').every(row=>row.orbit===null&&row.cycle===null&&row.steps===0&&row.final===row.seed));
  const budget = census(compile(specimens.orbit.source),2,{maxSteps:0});
  assert.deepEqual(budget.counts,{halted:0,cycle:0,steps:4,size:0}); assert.deepEqual(budget.orbits,[]);
  // Budget two resolves the seeds that start on the orbit, but not transients.
  assert.deepEqual(census(compile(specimens.orbit.source),2,{maxSteps:2}).counts,{halted:0,cycle:2,steps:2,size:0});
  assert.deepEqual(census(compile('a -> aa\nb -> bbb'),2,{maxSteps:0,maxLength:2}).counts,{halted:0,cycle:0,steps:4,size:0});
});

test('Census bounds, alphabet ordering, the empty seed and frozen receipts are enforced', () => {
  const program = compile('b -> bb\na -> aa'), receipt = census(program,2);
  for (const object of [receipt,receipt.rules,receipt.alphabet,receipt.counts,receipt.outcomes,receipt.orbits,...receipt.outcomes,...receipt.orbits,...receipt.outcomes.map(row=>row.cycle)]) assert.ok(Object.isFrozen(object));
  assert.throws(()=>receipt.outcomes.pop()); assert.throws(()=>{receipt.outcomes[0].orbit=9;});
  const empty = census(program,0,{maxSteps:0,maxLength:1});
  assert.equal(empty.total,1); assert.equal(empty.outcomes[0].seed,''); assert.equal(empty.counts.halted,1);
  assert.equal(census(program,10).total,1024); assert.equal(census(compile('a -> a'),12).total,1);
  const alphabet = 'abcdefghijklmnopqrstuvwxyz';
  const large = compile([...alphabet].map(letter=>`${letter} -> -`).join('\n'));
  assert.equal(census(large,2).total,676); assert.throws(()=>census(large,3),/1024/);
  assert.throws(()=>census(program,11),/1024/);
  assert.throws(()=>census(program,2,{maxLength:1}),/queue limit/);
  for (const length of [-1,13,1.5,'2',null,NaN]) assert.throws(()=>census(program,length));
  for (const options of [{maxSteps:-1},{maxSteps:2001},{maxLength:0},{maxLength:513}]) assert.throws(()=>census(program,2,options));
  assert.throws(()=>census({...program},2));
});

test('Census SVG labels every outcome, separates limits from proofs and marks omitted seeds explicitly', () => {
  const mixed = census(compile('a -> aa\nb -> bbb'),2,{maxLength:2}), svg = censusToSVG(mixed);
  assert.equal((svg.match(/data-seed=/g)??[]).length,4);
  assert.match(svg,/data-seed="aa" data-status="cycle" data-orbit="1"/);
  assert.match(svg,/data-seed="bb" data-status="size" data-orbit=""/);
  assert.match(svg,/cycle C1 \/ p1/); assert.match(svg,/size limit/); assert.match(svg,/limited seeds remain unresolved/);
  const large = census(compile(specimens.fall.source),7), clipped = censusToSVG(large);
  assert.equal((clipped.match(/data-seed=/g)??[]).length,64); assert.match(clipped,/64 middle seeds omitted/);
  for (const row of [...large.outcomes.slice(0,32),...large.outcomes.slice(-32)]) assert.ok(clipped.includes(`data-seed="${row.seed}"`));
  assert.ok(!clipped.includes(`data-seed="${large.outcomes[32].seed}"`));
  const tiny = censusToSVG(large,{maxSeeds:3}); assert.equal((tiny.match(/data-seed=/g)??[]).length,3); assert.match(tiny,/125 middle seeds omitted/);
  assert.match(censusToSVG(census(compile('a -> a'),0)),/∅/);
  assert.doesNotMatch(clipped,/NaN|Infinity|undefined/);
  for (const maxSeeds of [0,1,129,3.5,'4',null]) assert.throws(()=>censusToSVG(large,{maxSeeds}));
  assert.throws(()=>censusToSVG({...mixed}));
});

const cli = fileURLToPath(new URL('../cli.mjs',import.meta.url));
const invoke = (...args)=>spawnSync(process.execPath,[cli,...args],{encoding:'utf8',timeout:10000});
test('CLI censuses support specimens and custom rules, exact JSON/SVG, limits and exclusive writes', async () => {
  const directory = await mkdtemp(join(tmpdir(),'tailspin-census-'));
  try {
    const file = join(directory,'census.svg'), source = join(directory,'custom.tag');
    const result = invoke('orbit','--census','2','--json','--svg',file);
    assert.equal(result.status,0,result.stderr);
    const expected = census(compile(specimens.orbit.source),2);
    assert.deepEqual(JSON.parse(result.stdout),expected); assert.equal(await readFile(file,'utf8'),censusToSVG(expected));
    const text = invoke('--census','3'); assert.equal(text.status,0,text.stderr);
    assert.match(text.stdout,/halted: 6 · cycle: 2/); assert.match(text.stdout,/C1: period 1, representative ab, 2 seeds/);
    assert.match(text.stdout,/baa: cycle C1, enters at step 2/);
    await writeFile(source,'a -> aa\nb -> bbb');
    const limited = invoke('--program',source,'--census','2','--limit','2','--json');
    assert.equal(limited.status,2,limited.stderr); assert.deepEqual(JSON.parse(limited.stdout),census(compile(await readFile(source,'utf8')),2,{maxLength:2}));
    assert.equal(invoke('orbit','--census','2','--steps','0').status,2);
    assert.equal(invoke('--census','0').status,0);
    const absent = join(directory,'absent.svg');
    assert.equal(invoke('bloom','--census','2','--steps','3','--svg',absent).status,2);
    assert.match(await readFile(absent,'utf8'),/steps limit/);
    await writeFile(file,'keep'); assert.equal(invoke('--census','2','--svg',file).status,1); assert.equal(await readFile(file,'utf8'),'keep');
    const invalid = join(directory,'invalid.svg');
    assert.equal(invoke('--census','11','--svg',invalid).status,1); await assert.rejects(readFile(invalid));
  } finally { await rm(directory,{recursive:true,force:true}); }
});

test('CLI rejects malformed, conflicting and oversized censuses before producing receipts', () => {
  for (const args of [['--census'],['--census','-1'],['--census','13'],['--census','1.5'],['--census','02'],
    ['--census','11'],['--census','2','--limit','1'],['--census','2','--seed','ab'],['--census','2','--trace'],
    ['--census','1','--census','2'],['orbit','--program','missing','--census','2']]) {
    const result = invoke(...args); assert.equal(result.status,1,args.join(' ')); assert.equal(result.stdout,''); assert.ok(result.stderr.trim());
  }
});

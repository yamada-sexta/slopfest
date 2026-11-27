import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { compile, run, toSVG } from '../core.mjs';
import { specimens } from '../specimens.mjs';

// An independent literal queue interpreter: splice tokens and compare previous
// arrays directly, with no string slicing or visited-state map.
function oracle(rules, seed, deletion, budget, limit) {
  const queue = [...seed], frames = [{step:0,word:seed,read:null,removed:'',appended:''}];
  const history = [];
  for (;;) {
    if (queue.length < deletion) return {status:'halted',cycle:null,blocked:null,frames};
    const prior = history.findIndex(old => old.length === queue.length && old.every((token,i) => token === queue[i]));
    if (prior !== -1) return {status:'cycle',cycle:{start:prior,period:history.length-prior},blocked:null,frames};
    if (history.length === budget) return {status:'steps',cycle:null,blocked:null,frames};
    const old = [...queue], read = queue[0], removed = queue.splice(0,deletion).join(''), appended = rules[read];
    queue.push(...appended);
    if (queue.length > limit) return {status:'size',cycle:null,blocked:{read,removed,appended,length:queue.length},frames};
    history.push(old);
    frames.push({step:history.length,word:queue.join(''),read,removed,appended});
  }
}
function words(max) {
  const all = ['']; let layer = [''];
  for (let n = 1; n <= max; n++) { layer = layer.flatMap(word => ['a','b'].map(letter => word + letter)); all.push(...layer); }
  return all;
}

test('All 4557 small two-letter programs/seeds/deletions match literal queue execution', () => {
  let checked = 0; const tails = words(2), seeds = words(4);
  for (const a of tails) for (const b of tails) for (let deletion = 1; deletion <= 3; deletion++) {
    const source = `a -> ${a || '-'}\nb -> ${b || '-'}`, program = compile(source,{deleteCount:deletion});
    for (const seed of seeds) {
      const actual = run(program,seed,{maxSteps:20,maxLength:16}), expected = oracle({a,b},seed,deletion,20,16);
      for (const key of ['status','cycle','blocked','frames']) assert.deepEqual(actual[key],expected[key],`${source}/${seed}/${deletion}/${key}`);
      checked++;
    }
  }
  assert.equal(checked,4557);
});

test('Specimens halt, orbit after a transient, or stop before an oversized append', () => {
  const sample = name => run(compile(specimens[name].source),specimens[name].seed);
  const fall = sample('fall'); assert.equal(fall.status,'halted'); assert.deepEqual(fall.frames.map(f=>f.word),['aab','bab','ba','a']);
  const orbit = sample('orbit'); assert.equal(orbit.status,'cycle'); assert.deepEqual(orbit.cycle,{start:1,period:2});
  assert.deepEqual(orbit.frames.map(f=>f.word),['ab','bb','aa','bb']);
  const growing = compile(specimens.bloom.source);
  const size = run(growing,'aa',{maxLength:5});
  assert.equal(size.status,'size'); assert.deepEqual(size.frames.map(f=>f.word),['aa','aaa','aaaa','aaaaa']);
  assert.deepEqual(size.blocked,{read:'a',removed:'aa',appended:'aaa',length:6});
  const steps = run(growing,'aa',{maxSteps:3}); assert.equal(steps.status,'steps'); assert.equal(steps.frames.length,4);
  assert.equal(run(growing,'a',{maxSteps:0}).status,'halted');
  assert.equal(run(growing,'aa',{maxSteps:0}).status,'steps');
  assert.equal(run(compile(specimens.orbit.source),'ab',{maxSteps:3}).status,'cycle');
  assert.equal(run(compile(specimens.fall.source),'aab',{maxSteps:3}).status,'halted');
  // The budget is observed before attempting another append at that boundary.
  assert.equal(run(growing,'aa',{maxSteps:3,maxLength:5}).status,'steps');
  const maximum = run(growing,'aa',{maxSteps:2000,maxLength:512});
  assert.equal(maximum.status,'size'); assert.equal(maximum.frames.at(-1).word.length,512);
  assert.equal(maximum.blocked.length,513);
  assert.equal(run(compile('a -> -',{deleteCount:1}),'aaaa').frames.at(-1).word,'');
});

test('Compiler checks source locations, a closed alphabet, duplicate rules and resource bounds', () => {
  const program = compile('# greeting\r\n a -> ab # grow\r\n\nb -> -\n');
  assert.deepEqual(program.rules,{a:'ab',b:''}); assert.equal(program.deleteCount,2);
  assert.throws(()=>{program.rules.a='a';}); assert.throws(()=>{program.deleteCount=1;});
  assert.throws(()=>compile('a -> a\n\na -> -'),/Line 3.*duplicate/);
  assert.throws(()=>compile('a -> a\nb => a'),/Line 2/);
  for (const source of ['', '# only a comment', 'a -> b', 'A -> a', 'aa -> a', 'a ->', 'a -> a b', 'a -> <svg>', 'a -> '+ 'a'.repeat(33), ' '.repeat(4097), null, {}]) assert.throws(()=>compile(source));
  assert.equal(compile('a -> '+ 'a'.repeat(32)).rules.a.length,32);
  for (const deleteCount of [0,9,1.5,'2',null,NaN]) assert.throws(()=>compile('a -> a',{deleteCount}));
  assert.equal(compile('a -> -',{deleteCount:8}).deleteCount,8);
});

test('Runs reject forged programs and invalid seeds or budgets, and deeply freeze their receipts', () => {
  const program = compile(specimens.orbit.source), receipt = run(program,'ab');
  for (const object of [receipt,receipt.rules,receipt.frames,...receipt.frames,receipt.cycle]) assert.ok(Object.isFrozen(object));
  assert.throws(()=>receipt.frames.pop()); assert.throws(()=>{receipt.frames[1].word='a';});
  const stopped = run(compile('a -> aaa'),'aa',{maxLength:2}); assert.ok(Object.isFrozen(stopped.blocked));
  for (const seed of ['c','A','a b','<svg>',null,23,'a'.repeat(513)]) assert.throws(()=>run(program,seed));
  assert.equal(run(program,'').status,'halted');
  assert.throws(()=>run({...program},'ab'));
  for (const maxSteps of [-1,2001,1.5,'1',Infinity,null]) assert.throws(()=>run(program,'ab',{maxSteps}));
  for (const maxLength of [0,513,1.5,'2',Infinity,null]) assert.throws(()=>run(program,'ab',{maxLength}));
  assert.throws(()=>run(program,'ab',{maxLength:1}));
});

test('SVGs preserve exact queue rows, show an honest middle gap, and handle empty queues', () => {
  const fall = run(compile(specimens.fall.source),specimens.fall.seed), svg = toSVG(fall);
  assert.equal((svg.match(/data-step=/g)??[]).length,4);
  for (const frame of fall.frames) assert.ok(svg.includes(`data-step="${frame.step}" data-word="${frame.word}"`));
  assert.equal((svg.match(/fill="#eeb084"/g)??[]).length,6);
  assert.match(svg,/3 completed steps \/ 1 letter/);
  const long = run(compile(specimens.bloom.source),'aa',{maxSteps:40});
  const clipped = toSVG(long,{maxFrames:4});
  assert.equal((clipped.match(/data-step=/g)??[]).length,4);
  for (const step of [0,1,39,40]) assert.match(clipped,new RegExp(`data-step="${step}"`));
  assert.match(clipped,/37 middle frames omitted/);
  assert.doesNotMatch(clipped,/data-step="2"/);
  assert.match(toSVG(run(compile('a -> -',{deleteCount:1}),'a')),/data-word=""/);
  assert.match(toSVG(run(compile('a -> -'),'')),/∅/);
  assert.doesNotMatch(toSVG(run(compile('a -> aaa'),'a'.repeat(512),{maxLength:512})),/NaN|Infinity|undefined/);
  for (const maxFrames of [0,1,65,2.5,'4',null]) assert.throws(()=>toSVG(fall,{maxFrames}));
  assert.throws(()=>toSVG({...fall}));
});

const cli = fileURLToPath(new URL('../cli.mjs',import.meta.url));
const invoke = (...args) => spawnSync(process.execPath,[cli,...args],{encoding:'utf8',timeout:10000});
test('Real CLI receipts, custom programs, limits, traces and exclusive SVG exports agree with the engine', async () => {
  const directory = await mkdtemp(join(tmpdir(),'tailspin-'));
  try {
    const file = join(directory,'trace.svg'), source = join(directory,'queue.tag');
    const result = invoke('orbit','--json','--svg',file); assert.equal(result.status,0,result.stderr);
    const expected = run(compile(specimens.orbit.source),'ab');
    assert.deepEqual(JSON.parse(result.stdout),expected); assert.equal(await readFile(file,'utf8'),toSVG(expected));
    const text = invoke('--trace'); assert.equal(text.status,0,text.stderr); assert.match(text.stdout,/3: a.*read b; remove ba; append a/);
    await writeFile(source,'a -> -');
    const custom = invoke('--program',source,'--seed','aaa','--delete','1','--json');
    assert.equal(custom.status,0,custom.stderr); assert.deepEqual(JSON.parse(custom.stdout),run(compile('a -> -',{deleteCount:1}),'aaa'));
    assert.equal(invoke('--seed','').status,0);
    const absent = join(directory,'absent.svg');
    const limited = invoke('bloom','--steps','40','--json','--svg',absent);
    assert.equal(limited.status,2,limited.stderr); assert.equal(JSON.parse(limited.stdout).status,'steps');
    assert.equal(await readFile(absent,'utf8'),toSVG(run(compile('a -> aaa'),'aa',{maxSteps:40})));
    assert.equal(invoke('bloom','--limit','5','--json').status,2);
    await writeFile(file,'keep'); assert.equal(invoke('--svg',file).status,1); assert.equal(await readFile(file,'utf8'),'keep');
    const invalid = join(directory,'invalid.svg');
    assert.equal(invoke('--seed','c','--svg',invalid).status,1); await assert.rejects(readFile(invalid));
    assert.equal(invoke('--help').status,0);
  } finally { await rm(directory,{recursive:true,force:true}); }
});

test('CLI rejects ambiguous specimens, malformed options and missing custom inputs without receipts', () => {
  for (const args of [['unknown'],['fall','orbit'],['--what'],['--help','--json'],['--seed'],['--delete','0'],['--delete','9'],
    ['--steps','-1'],['--steps','2001'],['--steps','01'],['--limit','0'],['--limit','513'],['--json','--json'],
    ['--seed','a','--seed','b'],['--program','missing'],['fall','--program','missing','--seed','a'],['--svg','']]) {
    const result = invoke(...args); assert.equal(result.status,1,args.join(' ')); assert.equal(result.stdout,''); assert.ok(result.stderr.trim());
  }
});

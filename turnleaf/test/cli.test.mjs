import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, readFile, writeFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { run as foldRun, locate, toSVG } from '../core.mjs';
const cli=fileURLToPath(new URL('../cli.mjs',import.meta.url));
const run=args=>spawnSync(process.execPath,[cli,...args],{encoding:'utf8',timeout:10000,maxBuffer:1024*1024});

test('The real CLI has a useful default, plain readable layer order, and standalone help', () => {
  const result=run([]);assert.equal(result.status,0,result.stderr);
  assert.match(result.stdout,/16 panels · LRR · 2 packets × 8 layers/);
  assert.match(result.stdout,/Packet 1: 12B 5F 4B 13F 16B 1F 8B 9F/);
  assert.doesNotMatch(result.stdout,/\x1b/);
  const help=run(['--help']);assert.equal(help.status,0);assert.match(help.stdout,/--find N/);
  assert.match(help.stdout,/TOP → BOTTOM|top-to-bottom/);
});

test('CLI JSON and trace retain bottom-to-top engine order, exact prefixes, and panel lookup', () => {
  const result=run(['LR','--panels','8','--find','1','--trace','--json']);
  assert.equal(result.status,0,result.stderr);
  const parsed=JSON.parse(result.stdout), journey=foldRun('LR',8), final=journey.frames.at(-1);
  assert.deepEqual(parsed,{panels:8,folds:'LR',packets:2,layers:4,cells:final.cells,found:{panel:1,...locate(final,1)},frames:journey.frames});
  const trace=run(['LR','--panels','8','--trace']);
  assert.equal(trace.status,0);assert.match(trace.stdout,/Start\n/);assert.match(trace.stdout,/After fold 2: R/);
  const find=run(['--find','1']);assert.match(find.stdout,/packet 1, layer 6 from top \(3 from bottom\), front up/);
  for(const [args,folds] of [[['--panels','1','--json'],''],[['--panels','2','--json'],'L'],[['','--panels','64','--json'],''],[['LRLRLR','--panels','64','--json'],'LRLRLR']]) {
    const result=run(args);assert.equal(result.status,0,result.stderr);assert.equal(JSON.parse(result.stdout).folds,folds);
  }
});

test('SVG writes are exclusive, byte-identical to the engine, and compatible with JSON; errors leave no partial export', async () => {
  const directory=await mkdtemp(join(tmpdir(),'turnleaf-'));
  try {
    const path=join(directory,'folded.svg');
    const result=run(['LRR','--find','1','--svg',path,'--json']);
    assert.equal(result.status,0,result.stderr);assert.equal(JSON.parse(result.stdout).found.fromTop,6);
    const bytes=await readFile(path,'utf8');assert.equal(bytes,toSVG(foldRun('LRR',16),{highlight:1}));
    assert.equal(run(['--svg',path]).status,1);assert.equal(await readFile(path,'utf8'),bytes);
    const keep=join(directory,'keep.svg');await writeFile(keep,'keep');assert.equal(run(['--svg',keep]).status,1);assert.equal(await readFile(keep,'utf8'),'keep');
    assert.equal(run(['--find','17','--svg',join(directory,'bad.svg')]).status,1);
    assert.equal(run(['XXXX','--svg',join(directory,'bad.svg')]).status,1);
    assert.equal(run(['--svg',join(directory,'missing','folded.svg')]).status,1);
    assert.deepEqual((await readdir(directory)).sort(),['folded.svg','keep.svg']);
  } finally {await rm(directory,{recursive:true,force:true});}
});

test('CLI rejects duplicate options, noncanonical numbers, invalid folds, bad widths, and missing values', () => {
  for(const args of [ ['--help','--json'],['--wat'],['L','R'],['l'],['L\n'],['LRRRR'],['L','--panels','1'],
    ['--panels','3'],['--panels','0'],['--panels','65'],['--panels','2.5'],['--panels','016'],['--panels','16\n'],
    ['--panels'],['--find'],['--find','0'],['--find','17'],['--find','--json'],['--svg'],['--svg',''],
    ['--panels','16','--panels','8'],['--json','--json'],['--trace','--trace'],['--find','1','--find','2'],
  ]) {
    const result=run(args);assert.equal(result.status,1,JSON.stringify(args));assert.equal(result.stdout,'');assert.ok(result.stderr.trim());
  }
});

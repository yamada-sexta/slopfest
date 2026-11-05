import test from 'node:test';
import assert from 'node:assert/strict';
import { strip, fold, run, locate, toSVG } from '../core.mjs';

function words(length) { return length ? words(length - 1).flatMap(word => [word + 'L', word + 'R']) : ['']; }
// Independent panel coordinates: x is a cell, z is height above the table.
// A moving half is reflected in x and z, then translated onto the still half.
function reference(panels, folds) {
  let width = panels, thickness = 1;
  let pieces = Array.from({ length: panels }, (_, i) => ({ panel: i + 1, x: i, z: 0, up: true }));
  for (const side of folds) {
    const half = width / 2;
    pieces = pieces.map(piece => {
      const moving = side === 'L' ? piece.x < half : piece.x >= half;
      return { panel: piece.panel, x: (moving ? width - 1 - piece.x : piece.x) - (side === 'L' ? half : 0), z: moving ? 2 * thickness - 1 - piece.z : piece.z, up: moving ? !piece.up : piece.up };
    });
    width /= 2; thickness *= 2;
  }
  return { pieces, width, thickness };
}

test('Every valid fold word through 64 panels matches an independent coordinate reflection model', () => {
  let cases = 0;
  for (const panels of [1,2,4,8,16,32,64]) for (let count = 0; count <= Math.log2(panels); count++) for (const word of words(count)) {
    const state = run(word, panels).frames.at(-1), expected = reference(panels, word);
    assert.equal(state.cells.length, expected.width);
    for (const piece of expected.pieces) {
      assert.deepEqual(state.cells[piece.x][piece.z], { panel: piece.panel, face: piece.up ? 'front' : 'back' });
      assert.deepEqual(locate(state, piece.panel), { packet: piece.x + 1, fromTop: expected.thickness - piece.z, fromBottom: piece.z + 1, face: piece.up ? 'front' : 'back' });
    }
    assert.deepEqual(state.cells.flat().map(piece => piece.panel).sort((a,b)=>a-b), Array.from({length:panels},(_,i)=>i+1));
    assert.ok(state.cells.every(cell => cell.length === 2 ** count));
    cases++;
  }
  assert.equal(cases, 247);
});

test('Small hand-folded fixtures distinguish left/right, top/bottom, flipping faces, and packet order', () => {
  const labels = state => state.cells.map(cell => cell.map(piece => `${piece.panel}${piece.face === 'front' ? 'F' : 'B'}`));
  assert.deepEqual(labels(fold(strip(2),'L')), [['2F','1B']]);
  assert.deepEqual(labels(fold(strip(2),'R')), [['1F','2B']]);
  assert.deepEqual(labels(run('LL',4).frames.at(-1)), [['4F','1B','2F','3B']]);
  assert.deepEqual(labels(run('LR',4).frames.at(-1)), [['3F','2B','1F','4B']]);
  assert.deepEqual(labels(run('RR',4).frames.at(-1)), [['1F','4B','3F','2B']]);
  assert.deepEqual(labels(run('L',4).frames.at(-1)), [['3F','2B'],['4F','1B']]);
  assert.deepEqual(locate(run().frames.at(-1),1), { packet:1,fromTop:6,fromBottom:3,face:'front' });
});

test('Swapping left and right mirrors packet positions and complements panel numbers, with faces preserved', () => {
  for (let count=0;count<=6;count++) for(const word of words(count)) {
    const opposite=[...word].map(side=>side==='L'?'R':'L').join('');
    const a=run(word,64).frames.at(-1), b=run(opposite,64).frames.at(-1);
    const mirror=[...a.cells].reverse().map(cell=>cell.map(piece=>({panel:65-piece.panel,face:piece.face})));
    assert.deepEqual(b.cells,mirror);
  }
});

test('Every trace frame is its actual prefix, and snapshots never change or share mutable arrays', () => {
  const journey=run('LRR',16), before=JSON.stringify(journey.frames[0]);
  assert.equal(journey.frames.length,4);
  for(let i=0;i<journey.frames.length;i++) {
    const state=journey.frames[i];
    assert.deepEqual(state,run(journey.folds.slice(0,i),16).frames.at(-1));
    assert.ok(Object.isFrozen(state) && Object.isFrozen(state.cells));
    for(const cell of state.cells) {assert.ok(Object.isFrozen(cell));for(const piece of cell) assert.ok(Object.isFrozen(piece));}
  }
  assert.ok(Object.isFrozen(journey) && Object.isFrozen(journey.frames));
  assert.equal(JSON.stringify(journey.frames[0]),before);
  assert.throws(()=>{journey.frames[0].cells[0][0].face='back';},TypeError);
  assert.throws(()=>{journey.frames.push(strip());},TypeError);
  assert.throws(()=>{journey.frames.at(-1).cells[0].reverse();},TypeError);
});

test('SVG records every final layer once in top-to-bottom order, with a truthful lookup and optional single highlight', () => {
  for(const [panels,word] of [[1,''],[16,'LRR'],[64,''],[64,'LRLRLR']]) {
    const journey=run(word,panels), state=journey.frames.at(-1), svg=toSVG(journey,{highlight:panels});
    const pieces=[...svg.matchAll(/data-panel="(\d+)" data-face="(front|back)" data-from-top="(\d+)"/g)].map(match=>({panel:Number(match[1]),face:match[2],fromTop:Number(match[3])}));
    const expected=state.cells.flatMap(cell=>[...cell].reverse().map((piece,i)=>({...piece,fromTop:i+1})));
    assert.deepEqual(pieces,expected);
    assert.equal([...svg.matchAll(/data-packet=/g)].length,state.cells.length);
    assert.equal([...svg.matchAll(/data-highlight="true"/g)].length,1);
    assert.equal([...toSVG(journey).matchAll(/data-highlight=/g)].length,0);
    const found=locate(state,panels);
    assert.ok(svg.includes(`Panel ${panels}: packet ${found.packet}, layer ${found.fromTop} from top, ${found.face} up.`));
    assert.doesNotMatch(svg, /<script|href=|<image|foreignObject/);
  }
});

test('Malformed widths, excessive folds, invalid directions, fake states, and invalid lookups fail before work', () => {
  for(const panels of [0,3,5,65,-2,1.5,'16',Infinity,NaN,null]) assert.throws(()=>strip(panels));
  for(const word of [null,42,'l','R L','LR\n','RRRRRRR','<svg>']) assert.throws(()=>run(word,64));
  assert.throws(()=>run('L',1),/at most 0/);
  for(const side of ['','l','X',0,null]) assert.throws(()=>fold(strip(),side));
  assert.throws(()=>fold(strip(1),'R'),/one packet/);
  for(const fake of [null,{},JSON.parse(JSON.stringify(strip()))]) {
    assert.throws(()=>fold(fake,'L'));assert.throws(()=>locate(fake,1));
  }
  for(const panel of [0,17,1.5,'1',NaN,null]) assert.throws(()=>locate(strip(),panel));
  for(const highlight of [0,17,1.5,'1',NaN]) assert.throws(()=>toSVG(run(),{highlight}));
  assert.throws(()=>toSVG(JSON.parse(JSON.stringify(run()))));
  assert.throws(()=>toSVG(null));
});

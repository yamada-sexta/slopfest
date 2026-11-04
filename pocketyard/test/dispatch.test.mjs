import test from 'node:test';
import assert from 'node:assert/strict';
import { createYard, solve, transfer, yardStats, scramble } from '../core.mjs';
import { makeDispatch, encodeDispatch, decodeDispatch } from '../dispatch.mjs';
import { ROOMS } from '../rooms.mjs';

test('Distance layers enumerate a complete small yard, cycle without repeats, and never expose cached arrays', () => {
  const yard = createYard(['123','','']), stats = yardStats(yard), found = new Set();
  assert.equal(stats.states, 60);
  assert.equal(stats.counts[0], 1);
  assert.ok(Object.isFrozen(stats) && Object.isFrozen(stats.counts));
  for (let distance = 0; distance <= stats.maxDistance; distance++) {
    const bucket = new Set();
    for (let choice = 0; choice < stats.counts[distance]; choice++) {
      const state = scramble(yard, distance, choice), encoded = state.join('|');
      assert.equal(solve(yard, state).distance, distance);
      assert.ok(Object.isFrozen(state)); bucket.add(encoded); found.add(encoded);
    }
    assert.equal(bucket.size, stats.counts[distance]);
    assert.deepEqual(scramble(yard, distance, 0), scramble(yard, distance, stats.counts[distance]));
  }
  assert.equal(found.size, stats.states);
  assert.throws(() => { stats.counts[0] = 9; }, TypeError);
  assert.equal(yardStats(yard).counts[0], 1);
});

test('All six-wagon difficulty layers return actual shortest starts, including the 19-transfer extreme', () => {
  const yard = ROOMS[5].yard, stats = yardStats(yard);
  assert.equal(stats.states, 7200); assert.equal(stats.maxDistance, 19);
  assert.equal(stats.counts.reduce((a,b)=>a+b,0),7200);
  for (let distance = 0; distance <= 19; distance++) for (const choice of [0,1,0xffffffff]) {
    const state = scramble(yard, distance, choice);
    const solution = solve(yard,state);
    assert.equal(solution.distance,distance);
    let next=state; for(const move of solution.route) next=transfer(yard,next,move.from,move.to);
    assert.deepEqual(next,yard.goal);
  }
});

test('Scrambling respects tiny and disconnected yards and rejects unavailable distances and bad choices', () => {
  const small=createYard(['1','','']), stats=yardStats(small);
  assert.deepEqual(stats,{states:3,maxDistance:1,counts:[1,2]});
  assert.notDeepEqual(scramble(small,1,0),scramble(small,1,1));
  const tight=createYard(['12','34','5'],2), tightStats=yardStats(tight);
  assert.ok(tightStats.states<360);
  for(const distance of [-1,1.5,'1',NaN,Infinity,tightStats.maxDistance+1]) assert.throws(()=>scramble(tight,distance));
  for(const choice of [-1,1.5,'1',NaN,Infinity,0x100000000]) assert.throws(()=>scramble(small,1,choice));
  for(const fake of [null,{},JSON.parse(JSON.stringify(small))]) {
    assert.throws(()=>yardStats(fake)); assert.throws(()=>scramble(fake,1));
  }
});

test('Every shipped dispatch survives a compact, canonical link without names, moves or helpers', () => {
  for(const room of ROOMS) {
    const hash=encodeDispatch(room.start,room.yard.goal), copy=decodeDispatch(hash);
    assert.match(hash,/^#dispatch=v1:[1-6.]+:[1-6.]+$/);
    assert.ok(hash.length<=30);
    assert.deepEqual(copy.start,room.start); assert.deepEqual(copy.yard.goal,room.yard.goal);
    assert.equal(copy.par,room.par); assert.equal(copy.yard.capacity,3);
    assert.equal(encodeDispatch(copy.start,copy.yard.goal),hash);
    assert.ok(Object.isFrozen(copy) && Object.isFrozen(copy.start));
    assert.equal(copy.title,'Your dispatch');
  }
  assert.equal(encodeDispatch(['1','2',''],['12','','']),'#dispatch=v1:1.2.:12..');
});

test('Custom dispatches own their snapshots and allow already-arranged starts and a single wagon', () => {
  const start=['1','2',''],goal=['12','',''],dispatch=makeDispatch(start,goal);
  start[0]='2';goal[0]='21';
  assert.deepEqual(dispatch.start,['1','2','']);assert.deepEqual(dispatch.yard.goal,['12','','']);
  assert.equal(dispatch.par,1);
  const ready=makeDispatch(['12','',''],['12','','']);
  assert.equal(ready.par,0);
  assert.equal(decodeDispatch(encodeDispatch(ready.start,ready.yard.goal)).par,0);
  assert.equal(makeDispatch(['','','6'],['6','','']).par,1);
  assert.throws(()=>makeDispatch(['1','',''],['12','','']));
  assert.throws(()=>makeDispatch(['11','',''],['1','','']));
});

test('Malformed, oversized, noncanonical, foreign and future-version links are refused', () => {
  for(const hash of [null,42,'','#help','#dispatch=v2:1.2.:12..',
    '#dispatch=v1:1.2.:12..:extra','#dispatch=v1:1.2:12..','#dispatch=v1:1.2..:12..',
    '#dispatch=v1:1.2.:12..\n','#dispatch=v1:1.2.:12..%00','#dispatch=v1:1.2.:12.%20.',
    '#dispatch=v1:1.2.:13..','#dispatch=v1:1.1.:11..','#dispatch=v1:..:..',
    '#dispatch=v1:1234..:1234..','#dispatch=v1:<img>..:1..','#dispatch=v1:'+ '1'.repeat(65),
  ]) assert.throws(()=>decodeDispatch(hash),String(hash));
});

test('A shared partially worked yard starts a new attempt at its actual remaining minimum', () => {
  const room=ROOMS[5], first=solve(room.yard,room.start).route[0];
  const current=transfer(room.yard,room.start,first.from,first.to);
  const copy=decodeDispatch(encodeDispatch(current,room.yard.goal));
  assert.equal(copy.par,11); assert.deepEqual(copy.start,current);
  assert.equal('moves' in copy,false);assert.equal('hint' in copy,false);
});

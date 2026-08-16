const { test } = require('node:test');
const assert = require('node:assert');
const {
  LiarsDiceGame,
  rollDiceSet,
  isValidFirstBid,
  bidGreaterThan,
  countBid,
} = require('../../server/games/liars-dice');

test('rollDiceSet returns 5 values in 1..6', () => {
  const set = rollDiceSet(5);
  assert.equal(set.length, 5);
  for (const d of set) assert.ok(d >= 1 && d <= 6);
});

test('isValidFirstBid accepts valid bid only', () => {
  assert.ok(isValidFirstBid({ quantity: 3, face: 5 }));
  assert.ok(!isValidFirstBid({ quantity: 0, face: 5 }));
  assert.ok(!isValidFirstBid({ quantity: 3, face: 7 }));
  assert.ok(!isValidFirstBid({ quantity: 1.5, face: 3 }));
  assert.ok(!isValidFirstBid(null));
});

test('bidGreaterThan compares quantity then face', () => {
  assert.ok(bidGreaterThan({ quantity: 4, face: 2 }, { quantity: 3, face: 6 }));
  assert.ok(bidGreaterThan({ quantity: 3, face: 6 }, { quantity: 3, face: 5 }));
  assert.ok(!bidGreaterThan({ quantity: 3, face: 5 }, { quantity: 3, face: 5 }));
  assert.ok(!bidGreaterThan({ quantity: 2, face: 6 }, { quantity: 3, face: 1 }));
});

test('countBid counts matching dice across players', () => {
  const dice = new Map([
    ['a', [1, 3, 3, 5, 6]],
    ['b', [3, 3, 2, 2, 2]],
  ]);
  assert.equal(countBid(dice, { quantity: 3, face: 3 }), 4);
  assert.equal(countBid(dice, { quantity: 1, face: 6 }), 1);
});

test('start rolls dice and enters betting phase', () => {
  const g = new LiarsDiceGame(['a', 'b']);
  assert.deepEqual(g.start(), { ok: true });
  assert.equal(g.phase, 'betting');
  assert.equal(g.currentPlayerId(), 'a');
  assert.equal(g.diceById.get('a').length, 5);
  assert.equal(g.diceById.get('b').length, 5);
});

test('start rejects fewer than 2 players', () => {
  const g = new LiarsDiceGame(['a']);
  assert.equal(g.start().error, '至少需要 2 名玩家');
});

test('call advances turn and records bid', () => {
  const g = new LiarsDiceGame(['a', 'b']);
  g.start();
  assert.deepEqual(g.call('a', { quantity: 3, face: 4 }), { ok: true });
  assert.equal(g.bids.length, 1);
  assert.equal(g.currentPlayerId(), 'b');
});

test('call rejects non-current player', () => {
  const g = new LiarsDiceGame(['a', 'b']);
  g.start();
  assert.equal(g.call('b', { quantity: 3, face: 4 }).error, '还没轮到你叫数');
});

test('call rejects non-increasing bid', () => {
  const g = new LiarsDiceGame(['a', 'b']);
  g.start();
  g.call('a', { quantity: 3, face: 4 });
  assert.equal(g.call('b', { quantity: 3, face: 3 }).error, '叫数必须比上家大');
});

test('open: correct call makes opener drink', () => {
  const g = new LiarsDiceGame(['a', 'b']);
  g.start();
  g.diceById = new Map([
    ['a', [5, 5, 5, 1, 1]],
    ['b', [5, 5, 2, 2, 2]],
  ]);
  g.call('a', { quantity: 5, face: 5 });
  assert.deepEqual(g.open('b'), { ok: true });
  assert.equal(g.phase, 'roundEnd');
  assert.equal(g.winnerId, 'a');
  assert.equal(g.loserId, 'b');
});

test('open: wrong call makes caller drink', () => {
  const g = new LiarsDiceGame(['a', 'b']);
  g.start();
  g.diceById = new Map([
    ['a', [5, 5, 5, 1, 1]],
    ['b', [1, 2, 3, 4, 6]],
  ]);
  g.call('a', { quantity: 6, face: 5 });
  assert.deepEqual(g.open('b'), { ok: true });
  assert.equal(g.winnerId, 'b');
  assert.equal(g.loserId, 'a');
});

test('open rejects when no bids yet', () => {
  const g = new LiarsDiceGame(['a', 'b']);
  g.start();
  assert.equal(g.open('a').error, '还没有人叫数');
});

test('publicState shows own dice to each viewer', () => {
  const g = new LiarsDiceGame(['a', 'b']);
  g.start();
  const viewA = g.publicState('a');
  const viewB = g.publicState('b');
  assert.equal(viewA.myDice.length, 5);
  assert.equal(viewB.myDice.length, 5);
  assert.equal(viewA.playerIds.length, 2);
  assert.equal(viewA.game, 'liar');
});

test('publicState exposes all dice after roundEnd', () => {
  const g = new LiarsDiceGame(['a', 'b']);
  g.start();
  g.diceById = new Map([
    ['a', [1, 1, 1, 1, 1]],
    ['b', [1, 1, 1, 1, 1]],
  ]);
  g.call('a', { quantity: 3, face: 1 });
  g.open('b');
  const view = g.publicState('a');
  assert.equal(view.allDice.a.length, 5);
  assert.equal(view.allDice.b.length, 5);
});

test('nextRound only valid after roundEnd', () => {
  const g = new LiarsDiceGame(['a', 'b']);
  g.start();
  assert.equal(g.nextRound().error, '当前回合未结束');
  g.call('a', { quantity: 3, face: 4 });
  g.open('b');
  assert.deepEqual(g.nextRound(), { ok: true });
  assert.equal(g.phase, 'betting');
  assert.equal(g.bids.length, 0);
  assert.equal(g.loserId, null);
});

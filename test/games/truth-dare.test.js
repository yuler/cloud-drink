const { test } = require('node:test');
const assert = require('node:assert');
const {
  TruthOrDareGame,
  pickTarget,
  pickQuestion,
  TRUTH_QUESTIONS,
  DARE_TASKS,
} = require('../../server/games/truth-dare');

test('pickTarget returns a member of the list', () => {
  const ids = ['a', 'b', 'c'];
  for (let i = 0; i < 20; i++) assert.ok(ids.includes(pickTarget(ids)));
});

test('pickQuestion returns from matching bank', () => {
  assert.ok(TRUTH_QUESTIONS.includes(pickQuestion('truth')));
  assert.ok(DARE_TASKS.includes(pickQuestion('dare')));
});

test('nextRound picks target and enters choosing phase', () => {
  const g = new TruthOrDareGame(['a', 'b', 'c']);
  assert.deepEqual(g.nextRound(), { ok: true });
  assert.equal(g.phase, 'choosing');
  assert.ok(['a', 'b', 'c'].includes(g.targetId));
});

test('only target can choose', () => {
  const g = new TruthOrDareGame(['a', 'b']);
  g.nextRound();
  g.targetId = 'b';
  assert.equal(g.choose('a', 'truth').error, '只有被选中的人可以选择');
  assert.deepEqual(g.choose('b', 'dare'), { ok: true });
  assert.equal(g.questionType, 'dare');
  assert.ok(DARE_TASKS.includes(g.question));
  assert.equal(g.phase, 'showing');
});

test('choose rejects bad type', () => {
  const g = new TruthOrDareGame(['a']);
  g.nextRound();
  assert.equal(g.choose('a', 'spin').error, '选择不合法');
});

test('choose only valid in choosing phase', () => {
  const g = new TruthOrDareGame(['a']);
  g.nextRound();
  g.choose('a', 'truth');
  assert.equal(g.choose('a', 'truth').error, '当前不是选择阶段');
});

test('done ends round with target as loser', () => {
  const g = new TruthOrDareGame(['a', 'b']);
  g.nextRound();
  g.targetId = 'a';
  g.choose('a', 'truth');
  assert.deepEqual(g.done('a'), { ok: true });
  assert.equal(g.phase, 'roundEnd');
  assert.equal(g.loserId, 'a');
});

test('done rejects non-target', () => {
  const g = new TruthOrDareGame(['a', 'b']);
  g.nextRound();
  g.targetId = 'a';
  g.choose('a', 'truth');
  assert.equal(g.done('b').error, '只有被选中的人可以确认');
});

test('publicState mirrors game fields', () => {
  const g = new TruthOrDareGame(['a', 'b']);
  g.nextRound();
  g.targetId = 'a';
  g.choose('a', 'truth');
  const s = g.publicState();
  assert.equal(s.game, 'truth');
  assert.equal(s.phase, 'showing');
  assert.equal(s.targetId, 'a');
  assert.equal(s.questionType, 'truth');
  assert.ok(s.question.length > 0);
  assert.deepEqual(s.playerIds, ['a', 'b']);
});

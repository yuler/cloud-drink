const { test, before, after } = require('node:test');
const assert = require('node:assert');
const { io } = require('socket.io-client');
const { createGameServer } = require('../server/app');

let srv;
let port;

before(async () => {
  srv = createGameServer();
  await new Promise((r) => srv.httpServer.listen(0, r));
  port = srv.httpServer.address().port;
});

after(async () => {
  srv.close();
  await new Promise((r) => srv.httpServer.close(r));
});

function connect() {
  return io(`http://localhost:${port}`, { transports: ['websocket'], forceNew: true });
}

function waitForEvent(socket, event) {
  return new Promise((resolve) => socket.once(event, resolve));
}

test('GET / returns the landing page', async () => {
  const res = await fetch(`http://localhost:${port}/`);
  assert.equal(res.status, 200);
  const html = await res.text();
  assert.match(html, /云喝酒/);
});

test('GET /vendor/three/three.module.js serves three.js', async () => {
  const res = await fetch(`http://localhost:${port}/vendor/three/three.module.js`);
  assert.equal(res.status, 200);
});

test('create and join broadcast room state to both players', async () => {
  const a = connect();
  const b = connect();
  try {
    const bState = waitForEvent(b, 'room:state');
    const createRes = await new Promise((resolve) =>
      a.emit('room:create', { playerId: 'pa', nickname: '阿明', characterId: 'fox' }, resolve)
    );
    assert.equal(createRes.ok, true);
    const roomId = createRes.roomId;
    const joinRes = await new Promise((resolve) =>
      b.emit('room:join', { roomId, playerId: 'pb', nickname: '小红', characterId: 'cat' }, resolve)
    );
    assert.equal(joinRes.ok, true);
    const state = await bState;
    assert.equal(state.room.id, roomId);
    assert.equal(state.room.players.length, 2);
  } finally {
    a.close();
    b.close();
  }
});

test('join unknown room returns error', async () => {
  const a = connect();
  try {
    const res = await new Promise((resolve) =>
      a.emit('room:join', { roomId: 'ZZZZ', playerId: 'px', nickname: 'X', characterId: 'fox' }, resolve)
    );
    assert.equal(res.ok, false);
    assert.equal(res.error, '房间不存在');
  } finally {
    a.close();
  }
});

test('owner starts liar game and each player sees own dice', async () => {
  const a = connect();
  const b = connect();
  try {
    const gsA = waitForEvent(a, 'game:state');
    const gsB = waitForEvent(b, 'game:state');
    const createRes = await new Promise((resolve) =>
      a.emit('room:create', { playerId: 'pa2', nickname: '阿明', characterId: 'fox' }, resolve)
    );
    await new Promise((resolve) =>
      b.emit('room:join', { roomId: createRes.roomId, playerId: 'pb2', nickname: '小红', characterId: 'cat' }, resolve)
    );
    const startRes = await new Promise((resolve) =>
      a.emit('game:start', { game: 'liar', playerId: 'pa2' }, resolve)
    );
    assert.equal(startRes.ok, true);
    const [sa, sb] = await Promise.all([gsA, gsB]);
    assert.equal(sa.game, 'liar');
    assert.equal(sa.phase, 'betting');
    assert.equal(sa.myDice.length, 5);
    assert.equal(sb.myDice.length, 5);
    assert.equal(sa.turnPlayerId, 'pa2');
  } finally {
    a.close();
    b.close();
  }
});

test('non-owner cannot start a game', async () => {
  const a = connect();
  const b = connect();
  try {
    const createRes = await new Promise((resolve) =>
      a.emit('room:create', { playerId: 'pa3', nickname: '阿明', characterId: 'fox' }, resolve)
    );
    await new Promise((resolve) =>
      b.emit('room:join', { roomId: createRes.roomId, playerId: 'pb3', nickname: '小红', characterId: 'cat' }, resolve)
    );
    const res = await new Promise((resolve) =>
      b.emit('game:start', { game: 'liar', playerId: 'pb3' }, resolve)
    );
    assert.equal(res.ok, false);
    assert.equal(res.error, '只有房主可以开始');
  } finally {
    a.close();
    b.close();
  }
});

test('liar call and open resolve to roundEnd with loser', async () => {
  const a = connect();
  const b = connect();
  try {
    let lastA = null;
    a.on('game:state', (s) => { lastA = s; });
    const gsA = waitForEvent(a, 'game:state');
    const createRes = await new Promise((resolve) =>
      a.emit('room:create', { playerId: 'pa4', nickname: '阿明', characterId: 'fox' }, resolve)
    );
    await new Promise((resolve) =>
      b.emit('room:join', { roomId: createRes.roomId, playerId: 'pb4', nickname: '小红', characterId: 'cat' }, resolve)
    );
    await new Promise((resolve) => a.emit('game:start', { game: 'liar', playerId: 'pa4' }, resolve));
    await gsA;

    const callRes = await new Promise((resolve) =>
      a.emit('liar:call', { bid: { quantity: 3, face: 4 }, playerId: 'pa4' }, resolve)
    );
    assert.equal(callRes.ok, true);
    const openRes = await new Promise((resolve) => b.emit('liar:open', { playerId: 'pb4' }, resolve));
    assert.equal(openRes.ok, true);

    await new Promise((r) => setTimeout(r, 100));
    assert.equal(lastA.phase, 'roundEnd');
    assert.ok(lastA.loserId === 'pa4' || lastA.loserId === 'pb4');
    assert.ok(lastA.message.length > 0);
  } finally {
    a.close();
    b.close();
  }
});

test('non-current player call is rejected', async () => {
  const a = connect();
  const b = connect();
  try {
    const createRes = await new Promise((resolve) =>
      a.emit('room:create', { playerId: 'pa5', nickname: '阿明', characterId: 'fox' }, resolve)
    );
    await new Promise((resolve) =>
      b.emit('room:join', { roomId: createRes.roomId, playerId: 'pb5', nickname: '小红', characterId: 'cat' }, resolve)
    );
    await new Promise((resolve) => a.emit('game:start', { game: 'liar', playerId: 'pa5' }, resolve));
    const err = await new Promise((resolve) =>
      b.emit('liar:call', { bid: { quantity: 3, face: 4 }, playerId: 'pb5' }, resolve)
    );
    assert.equal(err.ok, false);
    assert.equal(err.error, '还没轮到你叫数');
  } finally {
    a.close();
    b.close();
  }
});

test('truth game full flow increments loser drinkCount', async () => {
  const a = connect();
  const b = connect();
  try {
    let lastRoom = null;
    a.on('room:state', (s) => { lastRoom = s; });
    const gs = waitForEvent(a, 'game:state');
    const createRes = await new Promise((resolve) =>
      a.emit('room:create', { playerId: 'pa6', nickname: '阿明', characterId: 'fox' }, resolve)
    );
    await new Promise((resolve) =>
      b.emit('room:join', { roomId: createRes.roomId, playerId: 'pb6', nickname: '小红', characterId: 'cat' }, resolve)
    );
    const startRes = await new Promise((resolve) =>
      a.emit('game:start', { game: 'truth', playerId: 'pa6' }, resolve)
    );
    assert.equal(startRes.ok, true);
    const state = await gs;
    const target = state.targetId;
    const targetSocket = target === 'pa6' ? a : b;

    const chooseRes = await new Promise((resolve) =>
      targetSocket.emit('truth:choose', { type: 'truth' }, resolve)
    );
    assert.equal(chooseRes.ok, true);
    const doneRes = await new Promise((resolve) => targetSocket.emit('truth:done', {}, resolve));
    assert.equal(doneRes.ok, true);

    await new Promise((r) => setTimeout(r, 100));
    const player = lastRoom.room.players.find((p) => p.id === target);
    assert.equal(player.drinkCount, 1);
  } finally {
    a.close();
    b.close();
  }
});

test('toast is broadcast to the room', async () => {
  const a = connect();
  const b = connect();
  try {
    const createRes = await new Promise((resolve) =>
      a.emit('room:create', { playerId: 'pa7', nickname: '阿明', characterId: 'fox' }, resolve)
    );
    await new Promise((resolve) =>
      b.emit('room:join', { roomId: createRes.roomId, playerId: 'pb7', nickname: '小红', characterId: 'cat' }, resolve)
    );
    const toast = waitForEvent(b, 'table:toast');
    await new Promise((resolve) => a.emit('table:toast', { playerId: 'pa7' }, resolve));
    const evt = await toast;
    assert.equal(evt.from, 'pa7');
  } finally {
    a.close();
    b.close();
  }
});

test('game switch returns to lobby for owner', async () => {
  const a = connect();
  const b = connect();
  try {
    const createRes = await new Promise((resolve) =>
      a.emit('room:create', { playerId: 'pa8', nickname: '阿明', characterId: 'fox' }, resolve)
    );
    await new Promise((resolve) =>
      b.emit('room:join', { roomId: createRes.roomId, playerId: 'pb8', nickname: '小红', characterId: 'cat' }, resolve)
    );
    await new Promise((resolve) => a.emit('game:start', { game: 'liar', playerId: 'pa8' }, resolve));
    const switchRes = await new Promise((resolve) =>
      a.emit('game:switch', { game: null, playerId: 'pa8' }, resolve)
    );
    assert.equal(switchRes.ok, true);
    await new Promise((r) => setTimeout(r, 50));
    const room = srv.rooms.getRoom(createRes.roomId);
    assert.equal(room.game, null);
    assert.equal(room.gameInstance, null);
  } finally {
    a.close();
    b.close();
  }
});

test('non-current player cannot impersonate current player on liar:call', async () => {
  const a = connect();
  const b = connect();
  try {
    let lastA = null;
    a.on('game:state', (s) => { lastA = s; });
    const gsA = waitForEvent(a, 'game:state');
    const createRes = await new Promise((resolve) =>
      a.emit('room:create', { playerId: 'paC1', nickname: '阿明', characterId: 'fox' }, resolve)
    );
    await new Promise((resolve) =>
      b.emit('room:join', { roomId: createRes.roomId, playerId: 'pbC1', nickname: '小红', characterId: 'cat' }, resolve)
    );
    const startRes = await new Promise((resolve) =>
      a.emit('game:start', { game: 'liar', playerId: 'paC1' }, resolve)
    );
    assert.equal(startRes.ok, true);
    await gsA;
    assert.equal(lastA.turnPlayerId, 'paC1');

    const err = await new Promise((resolve) =>
      b.emit('liar:call', { bid: { quantity: 3, face: 4 }, playerId: 'paC1' }, resolve)
    );
    assert.equal(err.ok, false);
    assert.equal(err.error, '还没轮到你叫数');

    const callRes = await new Promise((resolve) =>
      a.emit('liar:call', { bid: { quantity: 3, face: 4 }, playerId: 'paC1' }, resolve)
    );
    assert.equal(callRes.ok, true);
    await new Promise((r) => setTimeout(r, 50));
    assert.equal(lastA.turnPlayerId, 'pbC1');
  } finally {
    a.close();
    b.close();
  }
});

test('non-owner cannot start a game with owner impersonation', async () => {
  const a = connect();
  const b = connect();
  try {
    const createRes = await new Promise((resolve) =>
      a.emit('room:create', { playerId: 'paC2', nickname: '阿明', characterId: 'fox' }, resolve)
    );
    await new Promise((resolve) =>
      b.emit('room:join', { roomId: createRes.roomId, playerId: 'pbC2', nickname: '小红', characterId: 'cat' }, resolve)
    );
    const err = await new Promise((resolve) =>
      b.emit('game:start', { game: 'liar', playerId: 'paC2' }, resolve)
    );
    assert.equal(err.ok, false);
    assert.equal(err.error, '只有房主可以开始');
    const ok = await new Promise((resolve) =>
      a.emit('game:start', { game: 'liar', playerId: 'paC2' }, resolve)
    );
    assert.equal(ok.ok, true);
  } finally {
    a.close();
    b.close();
  }
});

test('rejoin cannot rebind identity on an established socket', async () => {
  const s1 = connect();
  try {
    const createRes = await new Promise((resolve) =>
      s1.emit('room:create', { playerId: 'paC1x', nickname: '阿明', characterId: 'fox' }, resolve)
    );
    assert.equal(createRes.ok, true);
    const res = await new Promise((resolve) =>
      s1.emit('room:rejoin', { roomId: createRes.roomId, playerId: 'someone-else' }, resolve)
    );
    assert.equal(res.ok, false);
    assert.match(res.error, /非法/);
  } finally {
    s1.close();
  }
});

test('game excludes offline players from the instance', async () => {
  const a = connect();
  const b = connect();
  const c = connect();
  try {
    let lastA = null;
    a.on('game:state', (s) => { lastA = s; });
    const gsA = waitForEvent(a, 'game:state');
    const createRes = await new Promise((resolve) =>
      a.emit('room:create', { playerId: 'paC4', nickname: '阿明', characterId: 'fox' }, resolve)
    );
    await new Promise((resolve) =>
      b.emit('room:join', { roomId: createRes.roomId, playerId: 'pbC4', nickname: '小红', characterId: 'cat' }, resolve)
    );
    await new Promise((resolve) =>
      c.emit('room:join', { roomId: createRes.roomId, playerId: 'pcC4', nickname: '小刚', characterId: 'bear' }, resolve)
    );
    b.disconnect();
    await new Promise((r) => setTimeout(r, 100));

    const startRes = await new Promise((resolve) =>
      a.emit('game:start', { game: 'liar', playerId: 'paC4' }, resolve)
    );
    assert.equal(startRes.ok, true);
    await gsA;
    assert.ok(lastA.playerIds.includes('paC4'));
    assert.ok(!lastA.playerIds.includes('pbC4'));
    assert.ok(lastA.playerIds.includes('pcC4'));
  } finally {
    a.close();
    c.close();
  }
});

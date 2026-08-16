const { test } = require('node:test');
const assert = require('node:assert');
const { RoomManager, MAX_PLAYERS, randomRoomCode } = require('../server/rooms');

test('randomRoomCode returns unique 4-char codes', () => {
  const existing = new Set(['AAAA']);
  const code = randomRoomCode(existing);
  assert.equal(code.length, 4);
  assert.ok(!existing.has(code));
});

test('createRoom makes owner with seat 0', () => {
  const rooms = new RoomManager();
  const { room, player } = rooms.createRoom({ playerId: 'p1', nickname: '阿明', characterId: 'fox' });
  assert.ok(player.isOwner);
  assert.equal(player.seat, 0);
  assert.equal(room.ownerId, 'p1');
  assert.equal(room.players.length, 1);
});

test('joinRoom adds a player to the next seat', () => {
  const rooms = new RoomManager();
  const { room } = rooms.createRoom({ playerId: 'p1', nickname: 'A', characterId: 'fox' });
  const { player } = rooms.joinRoom({ roomId: room.id, playerId: 'p2', nickname: 'B', characterId: 'cat' });
  assert.equal(player.seat, 1);
  assert.equal(room.players.length, 2);
});

test('joinRoom rejects unknown room', () => {
  const rooms = new RoomManager();
  assert.throws(
    () => rooms.joinRoom({ roomId: 'ZZZZ', playerId: 'p1', nickname: 'A', characterId: 'fox' }),
    { code: 'ROOM_NOT_FOUND' }
  );
});

test('joinRoom rejects full room', () => {
  const rooms = new RoomManager();
  const { room } = rooms.createRoom({ playerId: 'p0', nickname: '0', characterId: 'fox' });
  for (let i = 1; i < MAX_PLAYERS; i++) {
    rooms.joinRoom({ roomId: room.id, playerId: `p${i}`, nickname: `${i}`, characterId: 'fox' });
  }
  assert.throws(
    () => rooms.joinRoom({ roomId: room.id, playerId: 'px', nickname: 'x', characterId: 'fox' }),
    { code: 'ROOM_FULL' }
  );
});

test('leaveRoom removes player and transfers owner', () => {
  const rooms = new RoomManager();
  const { room } = rooms.createRoom({ playerId: 'p1', nickname: 'A', characterId: 'fox' });
  rooms.joinRoom({ roomId: room.id, playerId: 'p2', nickname: 'B', characterId: 'cat' });
  rooms.leaveRoom({ roomId: room.id, playerId: 'p1' });
  assert.equal(room.players.length, 1);
  assert.equal(room.ownerId, 'p2');
  assert.equal(room.players[0].isOwner, true);
  assert.equal(room.players[0].seat, 0);
});

test('leaveRoom deletes empty room', () => {
  const rooms = new RoomManager();
  const { room } = rooms.createRoom({ playerId: 'p1', nickname: 'A', characterId: 'fox' });
  rooms.leaveRoom({ roomId: room.id, playerId: 'p1' });
  assert.equal(rooms.getRoom(room.id), null);
});

test('leaveRoom during game ends the game', () => {
  const rooms = new RoomManager();
  const { room } = rooms.createRoom({ playerId: 'p1', nickname: 'A', characterId: 'fox' });
  rooms.joinRoom({ roomId: room.id, playerId: 'p2', nickname: 'B', characterId: 'cat' });
  room.game = 'liar';
  room.gameInstance = {};
  rooms.leaveRoom({ roomId: room.id, playerId: 'p2' });
  assert.equal(room.game, null);
  assert.equal(room.gameInstance, null);
});

test('markOffline and rejoin', () => {
  const rooms = new RoomManager();
  const { room } = rooms.createRoom({ playerId: 'p1', nickname: 'A', characterId: 'fox' });
  rooms.markOffline({ roomId: room.id, playerId: 'p1' });
  assert.equal(room.players[0].isOnline, false);
  const { room: room2 } = rooms.rejoin({ roomId: room.id, playerId: 'p1' });
  assert.equal(room2.players[0].isOnline, true);
  assert.equal(room2.players[0].disconnectedAt, 0);
});

test('rejoin rejects unknown player', () => {
  const rooms = new RoomManager();
  const { room } = rooms.createRoom({ playerId: 'p1', nickname: 'A', characterId: 'fox' });
  assert.throws(() => rooms.rejoin({ roomId: room.id, playerId: 'nobody' }), { code: 'PLAYER_NOT_FOUND' });
});

test('cleanup transfers owner when the owner goes offline and expires', () => {
  const rooms = new RoomManager();
  const { room } = rooms.createRoom({ playerId: 'p1', nickname: 'A', characterId: 'fox' });
  rooms.joinRoom({ roomId: room.id, playerId: 'p2', nickname: 'B', characterId: 'cat' });
  rooms.markOffline({ roomId: room.id, playerId: 'p1' });
  room.players[0].disconnectedAt = Date.now() - 60000;
  rooms.cleanup({ now: Date.now(), offlineTimeoutMs: 30000 });
  assert.equal(room.players.length, 1);
  assert.equal(room.ownerId, 'p2');
  assert.equal(room.players[0].isOwner, true);
});

test('cleanup removes long-offline players and empty rooms', () => {
  const rooms = new RoomManager();
  const { room } = rooms.createRoom({ playerId: 'p1', nickname: 'A', characterId: 'fox' });
  rooms.joinRoom({ roomId: room.id, playerId: 'p2', nickname: 'B', characterId: 'cat' });
  rooms.markOffline({ roomId: room.id, playerId: 'p2' });
  room.players[1].disconnectedAt = Date.now() - 60000;
  const changed = rooms.cleanup({ now: Date.now(), offlineTimeoutMs: 30000 });
  assert.equal(room.players.length, 1);
  assert.equal(room.players[0].id, 'p1');
  assert.ok(changed.includes(room));

  rooms.markOffline({ roomId: room.id, playerId: 'p1' });
  room.players[0].disconnectedAt = Date.now() - 60000;
  rooms.cleanup({ now: Date.now(), offlineTimeoutMs: 30000 });
  assert.equal(rooms.getRoom(room.id), null);
});

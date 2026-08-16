const { LiarsDiceGame } = require('./games/liars-dice');
const { TruthOrDareGame } = require('./games/truth-dare');

function serializeRoom(room) {
  return {
    id: room.id,
    ownerId: room.ownerId,
    game: room.game,
    players: room.players.map((p) => ({
      id: p.id,
      nickname: p.nickname,
      characterId: p.characterId,
      isOwner: p.isOwner,
      isOnline: p.isOnline,
      drinkCount: p.drinkCount,
      seat: p.seat,
    })),
  };
}

function broadcastRoom(io, room) {
  io.to(room.id).emit('room:state', { room: serializeRoom(room) });
}

function broadcastGame(io, room) {
  if (!room.gameInstance) return;
  for (const p of room.players) {
    io.to(p.id).emit('game:state', room.gameInstance.publicState(p.id));
  }
}

function currentRoom(socket, rooms) {
  return rooms.getRoom(socket.data.roomId);
}

function maybeDrink(io, room) {
  if (room.gameInstance && room.gameInstance.loserId) {
    const loser = room.players.find((p) => p.id === room.gameInstance.loserId);
    if (loser) loser.drinkCount += 1;
    broadcastRoom(io, room);
  }
}

function attachSocketHandlers(io, rooms) {
  io.on('connection', (socket) => {
    socket.on('room:create', ({ playerId, nickname, characterId }, ack) => {
      try {
        const { room } = rooms.createRoom({ playerId, nickname, characterId });
        socket.data.playerId = playerId;
        socket.data.roomId = room.id;
        socket.join(room.id);
        socket.join(playerId);
        broadcastRoom(io, room);
        ack && ack({ ok: true, roomId: room.id });
      } catch (e) {
        ack && ack({ ok: false, error: e.message });
      }
    });

    socket.on('room:join', ({ roomId, playerId, nickname, characterId }, ack) => {
      try {
        const { room } = rooms.joinRoom({ roomId, playerId, nickname, characterId });
        socket.data.playerId = playerId;
        socket.data.roomId = room.id;
        socket.join(room.id);
        socket.join(playerId);
        broadcastRoom(io, room);
        ack && ack({ ok: true });
      } catch (e) {
        ack && ack({ ok: false, error: e.message });
      }
    });

    socket.on('room:leave', ({ playerId } = {}, ack) => {
      const roomId = socket.data.roomId;
      const pid = playerId || socket.data.playerId;
      if (roomId && pid) {
        rooms.leaveRoom({ roomId, playerId: pid });
        const room = rooms.getRoom(roomId);
        if (room) broadcastRoom(io, room);
      }
      socket.data.roomId = null;
      ack && ack({ ok: true });
    });

    socket.on('room:rejoin', ({ roomId, playerId }, ack) => {
      try {
        const { room } = rooms.rejoin({ roomId, playerId });
        socket.data.playerId = playerId;
        socket.data.roomId = room.id;
        socket.join(room.id);
        socket.join(playerId);
        broadcastRoom(io, room);
        broadcastGame(io, room);
        ack && ack({ ok: true });
      } catch (e) {
        ack && ack({ ok: false, error: e.message });
      }
    });

    socket.on('disconnect', () => {
      const { roomId, playerId } = socket.data;
      if (roomId && playerId) {
        rooms.markOffline({ roomId, playerId });
        const room = rooms.getRoom(roomId);
        if (room) broadcastRoom(io, room);
      }
    });

    socket.on('game:start', ({ game, playerId } = {}, ack) => {
      const room = currentRoom(socket, rooms);
      if (!room) return ack && ack({ ok: false, error: '不在房间中' });
      const p = room.players.find((x) => x.id === playerId);
      if (!p || !p.isOwner) return ack && ack({ ok: false, error: '只有房主可以开始' });
      if (room.players.filter((x) => x.isOnline).length < 2) {
        return ack && ack({ ok: false, error: '至少需要 2 人在线' });
      }
      let instance;
      if (game === 'liar') {
        instance = new LiarsDiceGame(room.players.map((x) => x.id));
      } else if (game === 'truth') {
        instance = new TruthOrDareGame(room.players.map((x) => x.id));
      } else {
        return ack && ack({ ok: false, error: '未知游戏' });
      }
      const res = instance.start ? instance.start() : instance.nextRound();
      if (res && res.error) return ack && ack({ ok: false, error: res.error });
      room.game = game;
      room.gameInstance = instance;
      broadcastRoom(io, room);
      broadcastGame(io, room);
      ack && ack({ ok: true });
    });

    socket.on('game:next', ({ playerId } = {}, ack) => {
      const room = currentRoom(socket, rooms);
      if (!room || !room.gameInstance) return ack && ack({ ok: false, error: '没有进行中的游戏' });
      const p = room.players.find((x) => x.id === playerId);
      if (!p || !p.isOwner) return ack && ack({ ok: false, error: '只有房主可以继续' });
      const res = room.gameInstance.nextRound();
      if (res && res.error) return ack && ack({ ok: false, error: res.error });
      broadcastGame(io, room);
      ack && ack({ ok: true });
    });

    socket.on('game:switch', ({ playerId } = {}, ack) => {
      const room = currentRoom(socket, rooms);
      if (!room) return ack && ack({ ok: false, error: '不在房间中' });
      const p = room.players.find((x) => x.id === playerId);
      if (!p || !p.isOwner) return ack && ack({ ok: false, error: '只有房主可以切换' });
      room.game = null;
      room.gameInstance = null;
      broadcastRoom(io, room);
      ack && ack({ ok: true });
    });

    socket.on('liar:call', ({ bid, playerId }, ack) => {
      const room = currentRoom(socket, rooms);
      if (!room || !room.gameInstance) return ack && ack({ ok: false, error: '没有进行中的游戏' });
      const res = room.gameInstance.call(playerId, bid);
      if (res && res.error) return ack && ack({ ok: false, error: res.error });
      broadcastGame(io, room);
      ack && ack({ ok: true });
    });

    socket.on('liar:open', ({ playerId }, ack) => {
      const room = currentRoom(socket, rooms);
      if (!room || !room.gameInstance) return ack && ack({ ok: false, error: '没有进行中的游戏' });
      const res = room.gameInstance.open(playerId);
      if (res && res.error) return ack && ack({ ok: false, error: res.error });
      broadcastGame(io, room);
      maybeDrink(io, room);
      ack && ack({ ok: true });
    });

    socket.on('truth:choose', ({ type, playerId }, ack) => {
      const room = currentRoom(socket, rooms);
      if (!room || !room.gameInstance) return ack && ack({ ok: false, error: '没有进行中的游戏' });
      const res = room.gameInstance.choose(playerId, type);
      if (res && res.error) return ack && ack({ ok: false, error: res.error });
      broadcastGame(io, room);
      ack && ack({ ok: true });
    });

    socket.on('truth:done', ({ playerId }, ack) => {
      const room = currentRoom(socket, rooms);
      if (!room || !room.gameInstance) return ack && ack({ ok: false, error: '没有进行中的游戏' });
      const res = room.gameInstance.done(playerId);
      if (res && res.error) return ack && ack({ ok: false, error: res.error });
      broadcastGame(io, room);
      maybeDrink(io, room);
      ack && ack({ ok: true });
    });

    socket.on('table:toast', ({ playerId }, ack) => {
      const room = currentRoom(socket, rooms);
      if (!room) return ack && ack({ ok: false, error: '不在房间中' });
      io.to(room.id).emit('table:toast', { from: playerId });
      ack && ack({ ok: true });
    });
  });
}

module.exports = { attachSocketHandlers, broadcastRoom, broadcastGame, serializeRoom };

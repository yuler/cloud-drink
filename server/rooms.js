const ROOM_CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const CODE_LENGTH = 4;
const MAX_PLAYERS = 6;

function randomRoomCode(existingCodes) {
  let code;
  do {
    code = Array.from(
      { length: CODE_LENGTH },
      () => ROOM_CODE_CHARS[Math.floor(Math.random() * ROOM_CODE_CHARS.length)]
    ).join('');
  } while (existingCodes.has(code));
  return code;
}

function makePlayer(id, nickname, characterId, face, accessory, extra = {}) {
  return {
    id,
    nickname,
    characterId,
    face: face || extra.eyes || 'smile',
    accessory: accessory || extra.hair || 'none',
    hair: extra.hair || accessory || 'short',
    eyes: extra.eyes || face || 'smile',
    faceShape: extra.faceShape || 'round',
    isOwner: false,
    isOnline: true,
    drinkCount: 0,
    seat: -1,
    disconnectedAt: 0,
  };
}

function err(message, code) {
  const e = new Error(message);
  e.code = code;
  return e;
}

class Room {
  constructor(roomId, ownerPlayer) {
    this.id = roomId;
    this.players = [ownerPlayer];
    this.ownerId = ownerPlayer.id;
    this.game = null;
    this.gameInstance = null;
  }
}

class RoomManager {
  constructor() {
    this.rooms = new Map();
    this.playerRoom = new Map();
  }

  createRoom({ playerId, nickname, characterId, face, accessory, hair, eyes, faceShape }) {
    const roomId = randomRoomCode(this.rooms);
    const player = makePlayer(playerId, nickname, characterId, face, accessory, { hair, eyes, faceShape });
    player.isOwner = true;
    player.seat = 0;
    const room = new Room(roomId, player);
    this.rooms.set(roomId, room);
    this.playerRoom.set(playerId, roomId);
    return { room, player };
  }

  joinRoom({ roomId, playerId, nickname, characterId, face, accessory, hair, eyes, faceShape }) {
    const room = this.rooms.get(roomId);
    if (!room) throw err('房间不存在', 'ROOM_NOT_FOUND');
    if (this.playerRoom.has(playerId)) throw err('你已经在别的房间了', 'ALREADY_IN_ROOM');
    if (room.players.length >= MAX_PLAYERS) throw err('房间已满', 'ROOM_FULL');
    const player = makePlayer(playerId, nickname, characterId, face, accessory, { hair, eyes, faceShape });
    player.seat = room.players.length;
    room.players.push(player);
    this.playerRoom.set(playerId, roomId);
    return { room, player };
  }

  leaveRoom({ roomId, playerId }) {
    const room = this.rooms.get(roomId);
    if (!room) return;
    room.players = room.players.filter((p) => p.id !== playerId);
    this.playerRoom.delete(playerId);
    if (room.players.length === 0) {
      this.rooms.delete(roomId);
      return;
    }
    room.ownerId = room.players[0].id;
    this._renumber(room);
    if (room.gameInstance) {
      room.game = null;
      room.gameInstance = null;
    }
  }

  _renumber(room) {
    room.players.forEach((p, i) => {
      p.seat = i;
      p.isOwner = p.id === room.ownerId;
    });
  }

  getRoom(roomId) {
    return this.rooms.get(roomId) || null;
  }

  findPlayerRoom(playerId) {
    const roomId = this.playerRoom.get(playerId);
    return roomId ? this.rooms.get(roomId) || null : null;
  }

  markOffline({ roomId, playerId }) {
    const room = this.rooms.get(roomId);
    if (!room) return;
    const player = room.players.find((p) => p.id === playerId);
    if (player) {
      player.isOnline = false;
      player.disconnectedAt = Date.now();
    }
  }

  rejoin({ roomId, playerId }) {
    const room = this.rooms.get(roomId);
    if (!room) throw err('房间不存在', 'ROOM_NOT_FOUND');
    const player = room.players.find((p) => p.id === playerId);
    if (!player) throw err('你已不在房间中', 'PLAYER_NOT_FOUND');
    player.isOnline = true;
    player.disconnectedAt = 0;
    this.playerRoom.set(playerId, roomId);
    return { room, player };
  }

  cleanup({ now = Date.now(), offlineTimeoutMs = 30000 } = {}) {
    const changed = [];
    for (const [roomId, room] of this.rooms) {
      const before = room.players.length;
      const removed = room.players.filter((p) => !p.isOnline && now - p.disconnectedAt > offlineTimeoutMs);
      for (const p of removed) this.playerRoom.delete(p.id);
      room.players = room.players.filter((p) => p.isOnline || now - p.disconnectedAt <= offlineTimeoutMs);
      if (room.players.length === 0) {
        this.rooms.delete(roomId);
        continue;
      }
      if (removed.some((p) => p.id === room.ownerId)) {
        room.ownerId = room.players[0].id;
      }
      this._renumber(room);
      if (room.gameInstance) {
        room.game = null;
        room.gameInstance = null;
      }
      if (room.players.length !== before) changed.push(room);
    }
    return changed;
  }
}

module.exports = { RoomManager, MAX_PLAYERS, randomRoomCode };

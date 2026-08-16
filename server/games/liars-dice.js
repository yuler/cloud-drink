const DICE_COUNT = 5;

function rollDie() {
  return 1 + Math.floor(Math.random() * 6);
}

function rollDiceSet(count = DICE_COUNT) {
  return Array.from({ length: count }, () => rollDie());
}

function isValidFirstBid(bid) {
  return (
    bid &&
    Number.isInteger(bid.quantity) &&
    Number.isInteger(bid.face) &&
    bid.quantity >= 1 &&
    bid.face >= 1 &&
    bid.face <= 6
  );
}

function bidGreaterThan(a, b) {
  return a.quantity > b.quantity || (a.quantity === b.quantity && a.face > b.face);
}

function countBid(diceById, bid) {
  let count = 0;
  for (const set of diceById.values()) {
    for (const d of set) {
      if (d === bid.face) count += 1;
    }
  }
  return count;
}

class LiarsDiceGame {
  constructor(playerIds) {
    this.playerIds = playerIds;
    this.phase = 'idle';
    this.turnIndex = 0;
    this.bids = [];
    this.diceById = new Map();
    this.loserId = null;
    this.winnerId = null;
    this.message = '';
  }

  start() {
    if (this.playerIds.length < 2) return { error: '至少需要 2 名玩家' };
    this.roll();
    this.phase = 'betting';
    this.turnIndex = 0;
    this.bids = [];
    return { ok: true };
  }

  roll() {
    this.diceById = new Map(this.playerIds.map((id) => [id, rollDiceSet()]));
  }

  currentPlayerId() {
    return this.playerIds[this.turnIndex];
  }

  nextTurn() {
    this.turnIndex = (this.turnIndex + 1) % this.playerIds.length;
  }

  call(playerId, bid) {
    if (this.phase !== 'betting') return { error: '当前不是叫数阶段' };
    if (playerId !== this.currentPlayerId()) return { error: '还没轮到你叫数' };
    if (!isValidFirstBid(bid)) return { error: '叫数不合法' };
    const last = this.bids[this.bids.length - 1];
    if (last && !bidGreaterThan(bid, last)) return { error: '叫数必须比上家大' };
    this.bids.push({ quantity: bid.quantity, face: bid.face, by: playerId });
    this.nextTurn();
    return { ok: true };
  }

  open(playerId) {
    if (this.phase !== 'betting') return { error: '当前不是叫数阶段' };
    if (playerId !== this.currentPlayerId()) return { error: '还没轮到你开' };
    if (this.bids.length === 0) return { error: '还没有人叫数' };
    const last = this.bids[this.bids.length - 1];
    const actual = countBid(this.diceById, last);
    const callerWins = actual >= last.quantity;
    this.winnerId = callerWins ? last.by : playerId;
    this.loserId = callerWins ? playerId : last.by;
    this.phase = 'roundEnd';
    this.message = callerWins
      ? `${last.quantity} 个 ${last.face} 实际有 ${actual} 个，叫家赢，开家喝`
      : `${last.quantity} 个 ${last.face} 实际只有 ${actual} 个，叫家喝`;
    return { ok: true };
  }

  nextRound() {
    if (this.phase !== 'roundEnd') return { error: '当前回合未结束' };
    this.roll();
    this.phase = 'betting';
    this.turnIndex = 0;
    this.bids = [];
    this.loserId = null;
    this.winnerId = null;
    this.message = '';
    return { ok: true };
  }

  publicState(viewerId) {
    const state = {
      game: 'liar',
      phase: this.phase,
      playerIds: this.playerIds,
      turnPlayerId: this.phase === 'betting' ? this.currentPlayerId() : null,
      bids: this.bids,
      myDice: this.diceById.get(viewerId) || [],
      loserId: this.loserId,
      winnerId: this.winnerId,
      message: this.message,
    };
    if (this.phase === 'roundEnd') {
      state.allDice = {};
      for (const [id, dice] of this.diceById) state.allDice[id] = dice;
    }
    return state;
  }
}

module.exports = {
  LiarsDiceGame,
  rollDiceSet,
  isValidFirstBid,
  bidGreaterThan,
  countBid,
};

const TRUTH_QUESTIONS = [
  '最近一次让你心跳加速的瞬间？',
  '你微信里最想删掉的一条聊天记录是什么？',
  '如果明天是世界末日，你今天会做什么？',
  '你从小到大做过最丢脸的事是什么？',
  '你现在最想对在座某个人说什么？',
  '你上一次哭是因为什么？',
];

const DARE_TASKS = [
  '用三句话夸自己，不能重复',
  '模仿一个在座朋友最有辨识度的动作',
  '用播音腔朗读在座某人名字三遍',
  '学一声动物叫，直到大家满意',
  '用你最快的语速说十遍“干杯”',
  '对着镜头做一个你最帅/最美的表情',
];

function pickQuestion(type) {
  const bank = type === 'truth' ? TRUTH_QUESTIONS : DARE_TASKS;
  return bank[Math.floor(Math.random() * bank.length)];
}

function pickTarget(playerIds) {
  return playerIds[Math.floor(Math.random() * playerIds.length)];
}

class TruthOrDareGame {
  constructor(playerIds) {
    this.playerIds = playerIds;
    this.phase = 'idle';
    this.targetId = null;
    this.questionType = null;
    this.question = '';
    this.loserId = null;
  }

  nextRound() {
    if (this.playerIds.length < 1) return { error: '房间里没有人' };
    this.targetId = pickTarget(this.playerIds);
    this.questionType = null;
    this.question = '';
    this.loserId = null;
    this.phase = 'choosing';
    return { ok: true };
  }

  choose(playerId, type) {
    if (this.phase !== 'choosing') return { error: '当前不是选择阶段' };
    if (playerId !== this.targetId) return { error: '只有被选中的人可以选择' };
    if (type !== 'truth' && type !== 'dare') return { error: '选择不合法' };
    this.questionType = type;
    this.question = pickQuestion(type);
    this.phase = 'showing';
    return { ok: true };
  }

  done(playerId) {
    if (this.phase !== 'showing') return { error: '当前不是展示阶段' };
    if (playerId !== this.targetId) return { error: '只有被选中的人可以确认' };
    this.loserId = this.targetId;
    this.phase = 'roundEnd';
    return { ok: true };
  }

  publicState() {
    return {
      game: 'truth',
      phase: this.phase,
      playerIds: this.playerIds,
      targetId: this.targetId,
      questionType: this.questionType,
      question: this.question,
      loserId: this.loserId,
    };
  }
}

module.exports = { TruthOrDareGame, TRUTH_QUESTIONS, DARE_TASKS, pickQuestion, pickTarget };

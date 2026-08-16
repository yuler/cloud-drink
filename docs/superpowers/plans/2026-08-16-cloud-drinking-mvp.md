# 云喝酒 MVP 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 构建一个 H5 云喝酒 MVP：2-6 人通过浏览器进入同一虚拟酒桌，玩大话骰和真心话大冒险，输家触发 3D 角色干杯动画与音效。

**Architecture:** Node.js + Express 托管静态页面，Socket.IO 负责房间与游戏状态同步。游戏逻辑全部在服务端（权威服务器），客户端只发指令、收状态。前端 three.js 渲染 3D 圆桌/角色/骰子，UI 用普通 DOM。

**Tech Stack:** Node.js ≥18.17、Express 4、Socket.IO 4、three.js（前端静态托管）、socket.io-client（测试用）、内置 node:test 测试框架。

## Global Constraints

- 服务端游戏逻辑必须为权威来源：所有叫数、开牌、胜负判定、干杯触发都在服务端完成
- 玩家无账号系统，昵称即身份；`playerId` 用客户端 `crypto.randomUUID()` 生成并存于 `sessionStorage`
- 房间码 4 位，字符集 `ABCDEFGHJKLMNPQRSTUVWXYZ23456789`（避免 0/O、1/I/L）
- 每桌最多 6 人，开局由房主手动开始，不强制满员
- 所有 UI 文案为中文
- 游戏逻辑模块（`server/games/`、`server/rooms.js`）不依赖 Socket.IO，保持纯逻辑可测
- Node 内置测试：`npm test` = `node --test test/`
- 不做账号系统、实时语音/视频、捏脸商城、陌生人大厅、App 打包、数据持久化
- 前端仅现代手机浏览器（iOS Safari / Chrome），不支持 IE

---

### Task 1: 项目脚手架与静态服务器

**Files:**
- Create: `package.json`
- Create: `.gitignore`
- Create: `server/index.js`
- Create: `server/app.js`
- Create: `public/index.html`（占位，Task 6 重写）
- Test: `test/server.test.js`

**Interfaces:**
- Produces: `createGameServer()` → `{ app, httpServer }`（Task 5 会扩展返回 `io`、`rooms`）

- [ ] **Step 1: 创建 package.json**

```json
{
  "name": "cloud-drink",
  "version": "0.1.0",
  "private": true,
  "description": "异地好友云喝酒——H5 虚拟酒桌，2-6 人游戏互动",
  "main": "server/index.js",
  "scripts": {
    "start": "node server/index.js",
    "dev": "node --watch server/index.js",
    "test": "node --test test/"
  },
  "engines": {
    "node": ">=18.17"
  },
  "dependencies": {
    "express": "^4.19.2",
    "socket.io": "^4.7.5",
    "three": "^0.165.0"
  },
  "devDependencies": {
    "socket.io-client": "^4.7.5"
  }
}
```

- [ ] **Step 2: 创建 .gitignore**

```gitignore
node_modules/
.DS_Store
*.log
.env
```

- [ ] **Step 3: 安装依赖**

Run: `npm install`
Expected: 依赖安装成功，`node_modules/` 出现。

- [ ] **Step 4: 写失败测试**

`test/server.test.js`:

```js
const { test, before, after } = require('node:test');
const assert = require('node:assert');

let srv;
let port;

before(async () => {
  srv = require('../server/app').createGameServer();
  await new Promise((r) => srv.httpServer.listen(0, r));
  port = srv.httpServer.address().port;
});

after(() => new Promise((r) => srv.httpServer.close(r)));

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
```

- [ ] **Step 5: 运行测试确认失败**

Run: `npm test`
Expected: FAIL，报 `Cannot find module '../server/app'`。

- [ ] **Step 6: 实现最小服务器**

`server/app.js`:

```js
const http = require('http');
const path = require('path');
const express = require('express');

function createGameServer() {
  const app = express();
  const httpServer = http.createServer(app);
  app.use(express.static(path.join(__dirname, '..', 'public')));
  app.use('/vendor/three', express.static(path.join(__dirname, '..', 'node_modules', 'three', 'build')));
  return { app, httpServer };
}

module.exports = { createGameServer };
```

`server/index.js`:

```js
const { createGameServer } = require('./app');

const PORT = process.env.PORT || 3000;
const { httpServer } = createGameServer();

httpServer.listen(PORT, () => {
  console.log(`Cloud Drink listening on http://localhost:${PORT}`);
});
```

`public/index.html`（占位，含测试匹配文案）:

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>云喝酒</title>
</head>
<body>
  <h1>云喝酒</h1>
</body>
</html>
```

- [ ] **Step 7: 运行测试确认通过**

Run: `npm test`
Expected: PASS（2 个用例）。

- [ ] **Step 8: 提交**

```bash
git add package.json package-lock.json .gitignore server test public/index.html
git commit -m "feat: scaffold express static server with tests"
```

---

### Task 2: 大话骰游戏逻辑（服务端纯逻辑）

**Files:**
- Create: `server/games/liars-dice.js`
- Test: `test/games/liars-dice.test.js`

**Interfaces:**
- Consumes: 无
- Produces:
  - `rollDiceSet(count=5)` → `number[]`（1..6）
  - `isValidFirstBid(bid)` → `boolean`
  - `bidGreaterThan(a, b)` → `boolean`
  - `countBid(diceById, bid)` → `number`
  - `class LiarsDiceGame`
    - `constructor(playerIds: string[])`
    - `start()` → `{ok:true}` 或 `{error:string}`（要求 ≥2 人，掷骰，phase=`betting`）
    - `call(playerId, bid)` → `{ok:true}` 或 `{error:string}`
    - `open(playerId)` → `{ok:true}` 或 `{error:string}`
    - `nextRound()` → `{ok:true}` 或 `{error:string}`（仅 phase=`roundEnd` 时）
    - `publicState(viewerId)` → 玩家视图对象（Task 5 使用）

- [ ] **Step 1: 写失败测试**

`test/games/liars-dice.test.js`:

```js
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
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npm test`
Expected: FAIL，报 `Cannot find module '../../server/games/liars-dice'`。

- [ ] **Step 3: 实现模块**

`server/games/liars-dice.js`:

```js
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
```

- [ ] **Step 4: 运行测试确认通过**

Run: `npm test`
Expected: PASS（全部用例，含 Task 1 的 2 个）。

- [ ] **Step 5: 提交**

```bash
git add server/games/liars-dice.js test/games/liars-dice.test.js
git commit -m "feat: add liars dice game logic with tests"
```

---

### Task 3: 真心话大冒险游戏逻辑（服务端纯逻辑）

**Files:**
- Create: `server/games/truth-dare.js`
- Test: `test/games/truth-dare.test.js`

**Interfaces:**
- Consumes: 无
- Produces:
  - `pickTarget(playerIds)` → `string`
  - `pickQuestion(type)` → `string`
  - `TRUTH_QUESTIONS`, `DARE_TASKS`：字符串数组
  - `class TruthOrDareGame`
    - `constructor(playerIds)`
    - `nextRound()` → `{ok:true}` 或 `{error}`（选目标，phase=`choosing`）
    - `choose(playerId, type)` → `{ok:true}` 或 `{error}`（仅目标玩家，type ∈ truth/dare）
    - `done(playerId)` → `{ok:true}` 或 `{error}`（仅目标玩家，phase=`roundEnd`，loserId=target）
    - `publicState()` → 视图对象

- [ ] **Step 1: 写失败测试**

`test/games/truth-dare.test.js`:

```js
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
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npm test`
Expected: FAIL，报 `Cannot find module '../../server/games/truth-dare'`。

- [ ] **Step 3: 实现模块**

`server/games/truth-dare.js`:

```js
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
```

- [ ] **Step 4: 运行测试确认通过**

Run: `npm test`
Expected: PASS（全部用例）。

- [ ] **Step 5: 提交**

```bash
git add server/games/truth-dare.js test/games/truth-dare.test.js
git commit -m "feat: add truth or dare game logic with tests"
```

---

### Task 4: 房间管理器（服务端纯逻辑）

**Files:**
- Create: `server/rooms.js`
- Test: `test/rooms.test.js`

**Interfaces:**
- Consumes: 无
- Produces:
  - `MAX_PLAYERS = 6`
  - `randomRoomCode(existingCodes: Set)` → `string`
  - `class RoomManager`
    - `createRoom({playerId, nickname, characterId})` → `{room, player}`
    - `joinRoom({roomId, playerId, nickname, characterId})` → `{room, player}`（throw）
    - `leaveRoom({roomId, playerId})`
    - `getRoom(roomId)` → `Room|null`
    - `markOffline({roomId, playerId})`
    - `rejoin({roomId, playerId})` → `{room, player}`（throw）
    - `cleanup({now, offlineTimeoutMs})` → `Room[]`（被清理过玩家的剩余房间）
  - `Room` 对象字段：`id`、`players[]`、`ownerId`、`game`、`gameInstance`
  - `player` 对象字段：`id`、`nickname`、`characterId`、`isOwner`、`isOnline`、`drinkCount`、`seat`、`disconnectedAt`
  - 错误对象带 `err.code`（`ROOM_NOT_FOUND` / `ALREADY_IN_ROOM` / `ROOM_FULL` / `PLAYER_NOT_FOUND`）

- [ ] **Step 1: 写失败测试**

`test/rooms.test.js`:

```js
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
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npm test`
Expected: FAIL，报 `Cannot find module '../server/rooms'`。

- [ ] **Step 3: 实现模块**

`server/rooms.js`:

```js
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

function makePlayer(id, nickname, characterId) {
  return { id, nickname, characterId, isOwner: false, isOnline: true, drinkCount: 0, seat: -1, disconnectedAt: 0 };
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

  createRoom({ playerId, nickname, characterId }) {
    const roomId = randomRoomCode(this.rooms);
    const player = makePlayer(playerId, nickname, characterId);
    player.isOwner = true;
    player.seat = 0;
    const room = new Room(roomId, player);
    this.rooms.set(roomId, room);
    this.playerRoom.set(playerId, roomId);
    return { room, player };
  }

  joinRoom({ roomId, playerId, nickname, characterId }) {
    const room = this.rooms.get(roomId);
    if (!room) throw err('房间不存在', 'ROOM_NOT_FOUND');
    if (this.playerRoom.has(playerId)) throw err('你已经在别的房间了', 'ALREADY_IN_ROOM');
    if (room.players.length >= MAX_PLAYERS) throw err('房间已满', 'ROOM_FULL');
    const player = makePlayer(playerId, nickname, characterId);
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
      this._renumber(room);
      if (room.players.length === 0) {
        this.rooms.delete(roomId);
        continue;
      }
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
```

- [ ] **Step 4: 运行测试确认通过**

Run: `npm test`
Expected: PASS（全部用例）。

- [ ] **Step 5: 提交**

```bash
git add server/rooms.js test/rooms.test.js
git commit -m "feat: add room manager with tests"
```

---

### Task 5: Socket.IO 接线（房间生命周期 + 游戏控制）

**Files:**
- Create: `server/sockets.js`
- Modify: `server/app.js`（加入 io/rooms/sockets/cleanup）
- Test: `test/server.test.js`（追加集成测试）

**Interfaces:**
- Consumes:
  - `RoomManager`（Task 4）
  - `LiarsDiceGame`（Task 2）
  - `TruthOrDareGame`（Task 3）
- Produces:
  - `attachSocketHandlers(io, rooms)`
  - `broadcastRoom(io, room)`：向房间发 `room:state`
  - `broadcastGame(io, room)`：向每个玩家发各自视图的 `game:state`
  - `serializeRoom(room)` → 纯 JSON 房间对象
  - Socket 事件表：
    - 客户端→服务端：`room:create`、`room:join`、`room:leave`、`room:rejoin`、`game:start`、`game:next`、`game:switch`、`liar:call`、`liar:open`、`truth:choose`、`truth:done`、`table:toast`（均带 ack 回调 `(res) => res.ok|res.error`）
    - 服务端→客户端：`room:state`、`game:state`、`table:toast`、`error`

- [ ] **Step 1: 追加失败集成测试**

在 `test/server.test.js` 顶部加入依赖，并在文件末尾追加用例。先修改文件顶部：

```js
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

after(() => new Promise((r) => srv.httpServer.close(r)));

function connect() {
  return io(`http://localhost:${port}`, { transports: ['websocket'], forceNew: true });
}

function waitForEvent(socket, event) {
  return new Promise((resolve) => socket.once(event, resolve));
}
```

在文件末尾追加：

```js
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
      a.emit('room:create', { playerId: 'pa', nickname: '阿明', characterId: 'fox' }, resolve)
    );
    await new Promise((resolve) =>
      b.emit('room:join', { roomId: createRes.roomId, playerId: 'pb', nickname: '小红', characterId: 'cat' }, resolve)
    );
    const startRes = await new Promise((resolve) =>
      a.emit('game:start', { game: 'liar', playerId: 'pa' }, resolve)
    );
    assert.equal(startRes.ok, true);
    const [sa, sb] = await Promise.all([gsA, gsB]);
    assert.equal(sa.game, 'liar');
    assert.equal(sa.phase, 'betting');
    assert.equal(sa.myDice.length, 5);
    assert.equal(sb.myDice.length, 5);
    assert.equal(sa.turnPlayerId, 'pa');
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
      a.emit('room:create', { playerId: 'pa', nickname: '阿明', characterId: 'fox' }, resolve)
    );
    await new Promise((resolve) =>
      b.emit('room:join', { roomId: createRes.roomId, playerId: 'pb', nickname: '小红', characterId: 'cat' }, resolve)
    );
    const res = await new Promise((resolve) =>
      b.emit('game:start', { game: 'liar', playerId: 'pb' }, resolve)
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
      a.emit('room:create', { playerId: 'pa', nickname: '阿明', characterId: 'fox' }, resolve)
    );
    await new Promise((resolve) =>
      b.emit('room:join', { roomId: createRes.roomId, playerId: 'pb', nickname: '小红', characterId: 'cat' }, resolve)
    );
    await new Promise((resolve) => a.emit('game:start', { game: 'liar', playerId: 'pa' }, resolve));
    await gsA;

    const callRes = await new Promise((resolve) =>
      a.emit('liar:call', { bid: { quantity: 3, face: 4 }, playerId: 'pa' }, resolve)
    );
    assert.equal(callRes.ok, true);
    const openRes = await new Promise((resolve) => b.emit('liar:open', { playerId: 'pb' }, resolve));
    assert.equal(openRes.ok, true);

    await new Promise((r) => setTimeout(r, 100));
    assert.equal(lastA.phase, 'roundEnd');
    assert.ok(lastA.loserId === 'pa' || lastA.loserId === 'pb');
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
      a.emit('room:create', { playerId: 'pa', nickname: '阿明', characterId: 'fox' }, resolve)
    );
    await new Promise((resolve) =>
      b.emit('room:join', { roomId: createRes.roomId, playerId: 'pb', nickname: '小红', characterId: 'cat' }, resolve)
    );
    await new Promise((resolve) => a.emit('game:start', { game: 'liar', playerId: 'pa' }, resolve));
    const err = await new Promise((resolve) =>
      b.emit('liar:call', { bid: { quantity: 3, face: 4 }, playerId: 'pb' }, resolve)
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
      a.emit('room:create', { playerId: 'pa', nickname: '阿明', characterId: 'fox' }, resolve)
    );
    await new Promise((resolve) =>
      b.emit('room:join', { roomId: createRes.roomId, playerId: 'pb', nickname: '小红', characterId: 'cat' }, resolve)
    );
    const startRes = await new Promise((resolve) =>
      a.emit('game:start', { game: 'truth', playerId: 'pa' }, resolve)
    );
    assert.equal(startRes.ok, true);
    const state = await gs;
    const target = state.targetId;

    const chooseRes = await new Promise((resolve) =>
      a.emit('truth:choose', { type: 'truth', playerId: target }, resolve)
    );
    assert.equal(chooseRes.ok, true);
    const doneRes = await new Promise((resolve) => a.emit('truth:done', { playerId: target }, resolve));
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
      a.emit('room:create', { playerId: 'pa', nickname: '阿明', characterId: 'fox' }, resolve)
    );
    await new Promise((resolve) =>
      b.emit('room:join', { roomId: createRes.roomId, playerId: 'pb', nickname: '小红', characterId: 'cat' }, resolve)
    );
    const toast = waitForEvent(b, 'table:toast');
    await new Promise((resolve) => a.emit('table:toast', { playerId: 'pa' }, resolve));
    const evt = await toast;
    assert.equal(evt.from, 'pa');
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
      a.emit('room:create', { playerId: 'pa', nickname: '阿明', characterId: 'fox' }, resolve)
    );
    await new Promise((resolve) =>
      b.emit('room:join', { roomId: createRes.roomId, playerId: 'pb', nickname: '小红', characterId: 'cat' }, resolve)
    );
    await new Promise((resolve) => a.emit('game:start', { game: 'liar', playerId: 'pa' }, resolve));
    const switchRes = await new Promise((resolve) =>
      a.emit('game:switch', { game: null, playerId: 'pa' }, resolve)
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
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npm test`
Expected: FAIL，集成用例报错（`io` 未接线，ack 不返回或 `createGameServer` 无 `io`/`rooms`）。

- [ ] **Step 3: 实现 sockets.js**

`server/sockets.js`:

```js
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
```

- [ ] **Step 4: 更新 app.js**

`server/app.js`（整体替换）:

```js
const http = require('http');
const path = require('path');
const express = require('express');
const { Server } = require('socket.io');
const { RoomManager } = require('./rooms');
const { attachSocketHandlers, broadcastRoom } = require('./sockets');

function createGameServer() {
  const app = express();
  const httpServer = http.createServer(app);
  const io = new Server(httpServer);
  const rooms = new RoomManager();

  app.use(express.static(path.join(__dirname, '..', 'public')));
  app.use('/vendor/three', express.static(path.join(__dirname, '..', 'node_modules', 'three', 'build')));

  attachSocketHandlers(io, rooms);

  setInterval(() => {
    for (const room of rooms.cleanup()) broadcastRoom(io, room);
  }, 5000);

  return { app, httpServer, io, rooms };
}

module.exports = { createGameServer };
```

- [ ] **Step 5: 运行测试确认通过**

Run: `npm test`
Expected: PASS（全部用例，含 8 个新集成用例）。

- [ ] **Step 6: 提交**

```bash
git add server/sockets.js server/app.js test/server.test.js
git commit -m "feat: wire socket.io room and game events with integration tests"
```

---

### Task 6: 前端页面结构与落地页

**Files:**
- Create: `public/css/style.css`
- Create: `public/index.html`（整体替换 Task 1 占位）
- Create: `public/table.html`
- Create: `public/js/main.js`

**Interfaces:**
- Consumes:
  - 服务端事件：`room:create` / `room:join`（ack 返回 `{ok, roomId}` 或 `{ok:false, error}`）
  - `sessionStorage` 键：`cloudDrink:playerId`、`cloudDrink:roomId`
- Produces:
  - `public/table.html` 完整结构（Task 9 的 table.js 使用的 DOM id）
  - `public/js/main.js`：落地页逻辑（建房/加入后跳转 `/table.html`）

**Global note:** 本任务的 `table.html` 引用 `/js/table.js`，但该文件在 Task 9 才创建；本阶段浏览器访问 `/table.html` 会因模块加载失败报错，属预期。验证只针对落地页流程。

- [ ] **Step 1: 实现 style.css**

`public/css/style.css`:

```css
* { box-sizing: border-box; margin: 0; padding: 0; }
html, body { height: 100%; }
body {
  font-family: -apple-system, "PingFang SC", "Helvetica Neue", sans-serif;
  background: #0f1020;
  color: #fff;
  overflow: hidden;
}
.hidden { display: none !important; }

/* landing */
.landing { display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 100vh; padding: 24px; overflow-y: auto; }
.logo { font-size: 40px; margin-bottom: 8px; }
.tagline { color: #9aa0b5; margin-bottom: 24px; }
.panel {
  background: #1c1d33; border: 1px solid #2c2e4a; border-radius: 16px;
  padding: 20px; width: 100%; max-width: 360px;
}
.panel label { display: block; color: #9aa0b5; font-size: 13px; margin: 12px 0 6px; }
input[type=text] {
  width: 100%; padding: 12px; border-radius: 10px; border: 1px solid #35365c;
  background: #12132a; color: #fff; font-size: 16px;
}
.character-picker { display: flex; gap: 10px; justify-content: space-between; }
.character {
  --c: #888; width: 44px; height: 44px; border-radius: 50%;
  background: radial-gradient(circle at 35% 35%, #fff, var(--c)); border: 3px solid transparent; cursor: pointer;
}
.character.selected { border-color: #ffd24a; }
.actions { display: flex; flex-direction: column; gap: 10px; margin-top: 16px; }
button {
  padding: 12px 16px; border-radius: 10px; border: none; background: #2c2e4a; color: #fff;
  font-size: 16px; cursor: pointer;
}
button.primary { background: linear-gradient(135deg, #ff9a3d, #ff6b5e); color: #fff; }
button:disabled { opacity: 0.4; cursor: not-allowed; }
.divider { text-align: center; color: #6a6d8a; font-size: 13px; }
.error { color: #ff6b5e; font-size: 13px; margin-top: 10px; min-height: 18px; }

/* table */
#scene { position: fixed; inset: 0; }
.hud {
  position: fixed; top: 12px; left: 12px; right: 12px; display: flex; justify-content: space-between;
  align-items: center; z-index: 10; pointer-events: none;
}
.hud > * { pointer-events: auto; background: rgba(20,21,40,0.85); border: 1px solid #2c2e4a; border-radius: 10px; padding: 8px 12px; }
#lobby-panel { position: fixed; bottom: 16px; left: 50%; transform: translateX(-50%); width: calc(100% - 32px); max-width: 420px; z-index: 10; }
.player-list { display: flex; flex-wrap: wrap; gap: 8px; margin: 10px 0; }
.player-row { background: #262849; padding: 6px 10px; border-radius: 8px; font-size: 14px; }
.chip { display: inline-block; width: 10px; height: 10px; border-radius: 50%; }
.owner-controls { display: flex; gap: 10px; }
.owner-controls button { flex: 1; }
#game-panel { position: fixed; top: 64px; left: 50%; transform: translateX(-50%); width: calc(100% - 32px); max-width: 420px; z-index: 10; }
#game-title { font-weight: 700; margin-bottom: 10px; }
.bids, .turn-hint, .result, .question-card { background: #262849; padding: 12px; border-radius: 10px; margin-bottom: 10px; font-size: 15px; }
.bid-panel { display: flex; gap: 8px; align-items: center; margin-bottom: 10px; flex-wrap: wrap; }
.bid-panel .num { width: 64px; padding: 10px; border-radius: 10px; border: 1px solid #35365c; background: #12132a; color: #fff; font-size: 16px; }
.toast { position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); background: rgba(0,0,0,0.8); padding: 14px 22px; border-radius: 12px; z-index: 40; font-size: 18px; }
.toast.error { color: #ff6b5e; }
.overlay { position: fixed; inset: 0; display: flex; align-items: center; justify-content: center; background: rgba(15,16,32,0.85); z-index: 50; font-size: 24px; }
#drink-overlay { background: rgba(255,107,94,0.25); }
```

- [ ] **Step 2: 实现 index.html（整体替换）**

`public/index.html`:

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <title>云喝酒</title>
  <link rel="stylesheet" href="/css/style.css" />
</head>
<body>
  <main class="landing">
    <h1 class="logo">🍻 云喝酒</h1>
    <p class="tagline">异地好友，线上干杯</p>

    <section class="panel">
      <label>你的昵称</label>
      <input id="nickname" type="text" maxlength="12" placeholder="输入昵称" />
      <label>选个角色</label>
      <div id="character-picker" class="character-picker"></div>
      <div class="actions">
        <button id="btn-create" class="primary">创建房间</button>
        <div class="divider">或</div>
        <input id="room-code" type="text" maxlength="4" placeholder="输入 4 位房号" />
        <button id="btn-join">加入房间</button>
      </div>
      <p id="error" class="error"></p>
    </section>
  </main>
  <script src="/socket.io/socket.io.js"></script>
  <script src="/js/main.js"></script>
</body>
</html>
```

- [ ] **Step 3: 实现 table.html**

`public/table.html`:

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <title>酒桌</title>
  <link rel="stylesheet" href="/css/style.css" />
</head>
<body>
  <div id="scene"></div>

  <div id="hud" class="hud">
    <span id="room-code-label">房号 --</span>
    <button id="btn-toast">干杯 🍻</button>
    <button id="btn-leave">离开</button>
  </div>

  <div id="lobby-panel" class="panel hidden">
    <h2>等好友入座</h2>
    <div id="player-list" class="player-list"></div>
    <div id="owner-controls" class="owner-controls hidden">
      <button data-game="liar" class="game-btn">开始：大话骰</button>
      <button data-game="truth" class="game-btn">开始：真心话大冒险</button>
    </div>
  </div>

  <div id="game-panel" class="panel hidden">
    <div id="game-title"></div>
    <div id="game-content"></div>
    <div id="owner-game-controls" class="owner-controls hidden"></div>
  </div>

  <div id="toast" class="toast hidden"></div>
  <div id="reconnect-overlay" class="overlay hidden">网络断开，重连中…</div>
  <div id="drink-overlay" class="overlay hidden">🍻 干杯！</div>

  <script src="/socket.io/socket.io.js"></script>
  <script type="module" src="/js/table.js"></script>
</body>
</html>
```

- [ ] **Step 4: 实现 main.js**

`public/js/main.js`:

```js
const CHARACTERS = [
  { id: 'fox', name: '小狐狸', color: '#f28b45' },
  { id: 'cat', name: '小橘猫', color: '#f5a623' },
  { id: 'bear', name: '棕熊', color: '#a9744f' },
  { id: 'panda', name: '熊猫', color: '#5a5a5a' },
  { id: 'rabbit', name: '兔子', color: '#e8e8e8' },
  { id: 'frog', name: '青蛙', color: '#4caf50' },
];

function getPlayerId() {
  let id = sessionStorage.getItem('cloudDrink:playerId');
  if (!id) {
    id = crypto.randomUUID();
    sessionStorage.setItem('cloudDrink:playerId', id);
  }
  return id;
}

let selectedCharacter = 'fox';

function renderCharacterPicker() {
  const container = document.getElementById('character-picker');
  container.innerHTML = '';
  for (const c of CHARACTERS) {
    const el = document.createElement('button');
    el.type = 'button';
    el.className = 'character';
    el.dataset.id = c.id;
    el.style.setProperty('--c', c.color);
    el.title = c.name;
    if (c.id === selectedCharacter) el.classList.add('selected');
    el.addEventListener('click', () => {
      selectedCharacter = c.id;
      renderCharacterPicker();
    });
    container.appendChild(el);
  }
}

function showError(msg) {
  document.getElementById('error').textContent = msg || '';
}

function saveRoom(roomId) {
  sessionStorage.setItem('cloudDrink:roomId', roomId);
}

function goToTable(roomId, ok) {
  if (!ok) {
    showError(ok.error);
    return;
  }
  saveRoom(roomId);
  location.href = '/table.html';
}

function main() {
  renderCharacterPicker();
  const nicknameInput = document.getElementById('nickname');
  const roomCodeInput = document.getElementById('room-code');

  document.getElementById('btn-create').addEventListener('click', () => {
    const nickname = nicknameInput.value.trim();
    if (!nickname) return showError('请输入昵称');
    showError('');
    const socket = io();
    socket.emit('room:create', { playerId: getPlayerId(), nickname, characterId: selectedCharacter }, (res) => {
      socket.close();
      goToTable(res.roomId, res);
    });
  });

  document.getElementById('btn-join').addEventListener('click', () => {
    const nickname = nicknameInput.value.trim();
    const roomId = roomCodeInput.value.trim().toUpperCase();
    if (!nickname) return showError('请输入昵称');
    if (!roomId) return showError('请输入房号');
    showError('');
    const socket = io();
    socket.emit('room:join', { roomId, playerId: getPlayerId(), nickname, characterId: selectedCharacter }, (res) => {
      socket.close();
      goToTable(roomId, res);
    });
  });
}

main();
```

- [ ] **Step 5: 验证落地页流程**

Run: `npm start`，浏览器打开 `http://localhost:3000/`。

手动验证清单：
- [ ] 页面显示"云喝酒"标题、昵称输入框、6 个角色圆点、创建/加入按钮
- [ ] 不输入昵称点"创建房间"→ 显示"请输入昵称"
- [ ] 输入昵称、选角色、点"创建房间"→ 跳转到 `/table.html`（页面出现"房号 --"即路由成功；table.js 尚未创建导致的报错可忽略）
- [ ] 回到首页，输入昵称 + 不存在的 4 位房号 → 显示"房间不存在"

- [ ] **Step 6: 提交**

```bash
git add public/css/style.css public/index.html public/table.html public/js/main.js
git commit -m "feat: add landing page and table shell with character picker"
```

---

### Task 7: 3D 场景（three.js）

**Files:**
- Create: `public/js/scene.js`
- Create: `public/js/table.js`（最小 demo 版，Task 9 重写为完整控制器）

**Interfaces:**
- Consumes: `three`（经 `/vendor/three/three.module.js` 引入）
- Produces:
  - `CHARACTER_COLORS`：characterId → 颜色
  - `class TableScene`
    - `constructor(container)`：初始化渲染器/相机/灯光/圆桌，启动动画循环
    - `addPlayer(seatIndex, {characterId})`
    - `removePlayer(seatIndex)`
    - `playDrink(seatIndex)`
    - `playToast(seatIndex)`
    - `setDrunkLevel(seatIndex, level)`（0..3）
    - `showDice(seatIndex, values)` / `removeDice(seatIndex)`
    - `resize()`

- [ ] **Step 1: 实现 scene.js**

`public/js/scene.js`:

```js
import * as THREE from '/vendor/three/three.module.js';

const SEAT_COUNT = 6;
const TABLE_RADIUS = 2.2;
const SEAT_RADIUS = 3.4;

export const CHARACTER_COLORS = {
  fox: 0xf28b45,
  cat: 0xf5a623,
  bear: 0xa9744f,
  panda: 0x5a5a5a,
  rabbit: 0xe8e8e8,
  frog: 0x4caf50,
};

function tween(duration, onUpdate, onDone) {
  let start = null;
  function tick(now) {
    if (start === null) start = now;
    const t = Math.min((now - start) / duration, 1);
    onUpdate(t);
    if (t < 1) requestAnimationFrame(tick);
    else if (onDone) onDone();
  }
  requestAnimationFrame(tick);
}

export class TableScene {
  constructor(container) {
    this.container = container;
    this.seats = new Map();
    this.diceGroups = new Map();
    this.baseColors = new Map(); // seatIndex -> base color
    this._init();
  }

  _init() {
    const width = this.container.clientWidth || window.innerWidth;
    const height = this.container.clientHeight || window.innerHeight;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x1b1b2f);

    this.camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
    this.camera.position.set(0, 5.5, 6.2);
    this.camera.lookAt(0, 0, 0);

    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.container.appendChild(this.renderer.domElement);

    const ambient = new THREE.AmbientLight(0xffffff, 0.6);
    this.scene.add(ambient);
    const main = new THREE.DirectionalLight(0xffffff, 0.9);
    main.position.set(4, 8, 4);
    this.scene.add(main);

    const top = new THREE.Mesh(
      new THREE.CylinderGeometry(TABLE_RADIUS, TABLE_RADIUS, 0.15, 48),
      new THREE.MeshStandardMaterial({ color: 0x5a3a22 })
    );
    top.position.y = 0.9;
    this.scene.add(top);
    const leg = new THREE.Mesh(
      new THREE.CylinderGeometry(0.25, 0.35, 0.9, 16),
      new THREE.MeshStandardMaterial({ color: 0x3f2a18 })
    );
    leg.position.y = 0.45;
    this.scene.add(leg);

    window.addEventListener('resize', () => this.resize());
    this._clock = new THREE.Clock();
    this._loop();
  }

  seatPosition(index) {
    const angle = (index / SEAT_COUNT) * Math.PI * 2 - Math.PI / 2;
    return new THREE.Vector3(Math.cos(angle) * SEAT_RADIUS, 0, Math.sin(angle) * SEAT_RADIUS);
  }

  addPlayer(seatIndex, { characterId }) {
    if (this.seats.has(seatIndex)) return;
    const color = CHARACTER_COLORS[characterId] || CHARACTER_COLORS.fox;
    this.baseColors.set(seatIndex, color);
    const group = this._makeCharacter(color);
    const pos = this.seatPosition(seatIndex);
    pos.y = 0.9;
    group.position.copy(pos);
    group.rotation.y = Math.atan2(-pos.x, -pos.z) + Math.PI;
    this.scene.add(group);
    this.seats.set(seatIndex, { group, drunkLevel: 0 });
  }

  removePlayer(seatIndex) {
    const entry = this.seats.get(seatIndex);
    if (!entry) return;
    this.scene.remove(entry.group);
    this._removeDice(seatIndex);
    this.seats.delete(seatIndex);
    this.baseColors.delete(seatIndex);
  }

  _makeCharacter(color) {
    const group = new THREE.Group();
    const bodyMat = new THREE.MeshStandardMaterial({ color });

    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.55, 1.1, 16), bodyMat);
    body.position.y = 0.55;
    group.add(body);

    const head = new THREE.Mesh(new THREE.SphereGeometry(0.42, 24, 24), bodyMat);
    head.position.y = 1.35;
    group.add(head);

    const eyeMat = new THREE.MeshStandardMaterial({ color: 0x111111 });
    const eyeL = new THREE.Mesh(new THREE.SphereGeometry(0.05, 12, 12), eyeMat);
    eyeL.position.set(-0.14, 1.42, 0.36);
    group.add(eyeL);
    const eyeR = new THREE.Mesh(new THREE.SphereGeometry(0.05, 12, 12), eyeMat);
    eyeR.position.set(0.14, 1.42, 0.36);
    group.add(eyeR);

    const cup = new THREE.Group();
    const cupBody = new THREE.Mesh(
      new THREE.CylinderGeometry(0.12, 0.09, 0.28, 16),
      new THREE.MeshStandardMaterial({ color: 0xd8d8d8 })
    );
    cup.add(cupBody);
    cup.position.set(0.45, 0.35, 0.1);
    group.add(cup);

    group.userData = { bodyMat, cup };
    return group;
  }

  setDrunkLevel(seatIndex, level) {
    const entry = this.seats.get(seatIndex);
    if (!entry) return;
    entry.drunkLevel = Math.min(Math.max(level, 0), 3);
    const base = this.baseColors.get(seatIndex) || CHARACTER_COLORS.fox;
    const t = entry.drunkLevel / 3;
    const c = new THREE.Color(base).lerp(new THREE.Color(0xff6b5e), t);
    entry.group.userData.bodyMat.color.copy(c);
  }

  playDrink(seatIndex) {
    const entry = this.seats.get(seatIndex);
    if (!entry) return;
    const { cup } = entry.group.userData;
    const startY = cup.position.y;
    tween(1200, (t) => {
      const phase = t < 0.5 ? t / 0.5 : 1 - (t - 0.5) / 0.5;
      cup.position.y = startY + 0.8 * phase;
      cup.rotation.x = -0.8 * phase;
    }, () => {
      cup.position.y = startY;
      cup.rotation.x = 0;
    });
  }

  playToast(seatIndex) {
    const entry = this.seats.get(seatIndex);
    if (!entry) return;
    const pos = entry.group.position.clone();
    pos.y += 1.6;
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(0.3, 0.05, 8, 24),
      new THREE.MeshBasicMaterial({ color: 0xffd24a, transparent: true, opacity: 1 })
    );
    ring.position.copy(pos);
    this.scene.add(ring);
    tween(700, (t) => {
      ring.scale.setScalar(1 + t * 2);
      ring.material.opacity = 1 - t;
    }, () => this.scene.remove(ring));
  }

  _makePipTexture(face) {
    const size = 64;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, size, size);
    ctx.fillStyle = '#222';
    const dot = (x, y) => { ctx.beginPath(); ctx.arc(x, y, 7, 0, Math.PI * 2); ctx.fill(); };
    const p = { l: 16, c: 32, r: 48, t: 16, m: 32, b: 48 };
    const map = {
      1: [[p.c, p.m]],
      2: [[p.l, p.t], [p.r, p.b]],
      3: [[p.l, p.t], [p.c, p.m], [p.r, p.b]],
      4: [[p.l, p.t], [p.r, p.t], [p.l, p.b], [p.r, p.b]],
      5: [[p.l, p.t], [p.r, p.t], [p.c, p.m], [p.l, p.b], [p.r, p.b]],
      6: [[p.l, p.t], [p.r, p.t], [p.l, p.m], [p.r, p.m], [p.l, p.b], [p.r, p.b]],
    };
    for (const [x, y] of map[face]) dot(x, y);
    return new THREE.CanvasTexture(canvas);
  }

  _makeDie(value) {
    const mat = (f) => new THREE.MeshStandardMaterial({ map: this._makePipTexture(f) });
    const materials = [mat(1), mat(2), mat(value), mat(4), mat(5), mat(6)];
    return new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.3, 0.3), materials);
  }

  showDice(seatIndex, values) {
    this._removeDice(seatIndex);
    const pos = this.seatPosition(seatIndex).clone();
    pos.y = 1.15;
    const group = new THREE.Group();
    values.forEach((v, i) => {
      const die = this._makeDie(v);
      die.position.set((i - 2) * 0.35, 0.1, 0);
      group.add(die);
    });
    group.position.copy(pos);
    this.scene.add(group);
    this.diceGroups.set(seatIndex, group);
  }

  removeDice(seatIndex) {
    this._removeDice(seatIndex);
  }

  _removeDice(seatIndex) {
    const g = this.diceGroups.get(seatIndex);
    if (g) {
      this.scene.remove(g);
      this.diceGroups.delete(seatIndex);
    }
  }

  resize() {
    const width = this.container.clientWidth || window.innerWidth;
    const height = this.container.clientHeight || window.innerHeight;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }

  _loop() {
    requestAnimationFrame(() => this._loop());
    const t = this._clock.getElapsedTime();
    for (const entry of this.seats.values()) {
      const sway = entry.drunkLevel * 0.06;
      entry.group.rotation.z = Math.sin(t * 2) * 0.02 + Math.sin(t * 3.1) * sway;
      entry.group.position.y = 0.9 + Math.sin(t * 2) * 0.02;
    }
    this.renderer.render(this.scene, this.camera);
  }
}
```

- [ ] **Step 2: 实现最小 demo 版 table.js**

`public/js/table.js`（Task 9 会整体重写）:

```js
import { TableScene } from '/js/scene.js';

const scene = new TableScene(document.getElementById('scene'));

const DEMO = ['fox', 'cat', 'bear', 'panda', 'rabbit', 'frog'];

for (let i = 0; i < DEMO.length; i++) {
  scene.addPlayer(i, { characterId: DEMO[i] });
}

let seat = 0;
setInterval(() => {
  scene.playDrink(seat);
  scene.playToast(seat);
  scene.setDrunkLevel(seat, seat + 1);
  scene.showDice(seat, [1, 3, 5, 2, 6]);
  seat = (seat + 1) % DEMO.length;
}, 2500);
```

- [ ] **Step 3: 验证 3D 场景**

Run: `npm start`，浏览器打开 `http://localhost:3000/table.html`（无 sessionStorage 时直接访问页面即可看 demo）。

手动验证清单：
- [ ] 页面渲染出圆桌和 6 个彩色角色围坐，角色轻微上下浮动
- [ ] 每 2.5 秒：某个角色做举杯/放杯的干杯动画、头顶出现金色扩散圆环
- [ ] 越喝角色颜色越红、身体晃动幅度增大（醉意效果）
- [ ] 角色前方出现一排骰子，点数正确显示
- [ ] 缩放窗口，画面自适应不拉伸变形

- [ ] **Step 4: 提交**

```bash
git add public/js/scene.js public/js/table.js
git commit -m "feat: add three.js table scene with character, drink, toast and dice animations"
```

---

### Task 8: 合成音效

**Files:**
- Create: `public/js/audio.js`

**Interfaces:**
- Consumes: 无（纯 Web Audio API）
- Produces:
  - `playClink()`：碰杯声
  - `playGulp()`：咕咚声
  - `playCheer()`：欢呼声
  - `playWhistle()`：哨声

- [ ] **Step 1: 实现 audio.js**

`public/js/audio.js`:

```js
let ctx = null;

function audioCtx() {
  if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

function tone(freq, delay, duration, { type = 'sine', gain = 0.2, freqEnd } = {}) {
  const c = audioCtx();
  const t0 = c.currentTime + delay;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (freqEnd) osc.frequency.exponentialRampToValueAtTime(freqEnd, t0 + duration);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(gain, t0 + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
  osc.connect(g).connect(c.destination);
  osc.start(t0);
  osc.stop(t0 + duration + 0.05);
}

export function playClink() {
  tone(1400, 0, 0.15, { type: 'triangle', gain: 0.25 });
  tone(2100, 0, 0.12, { type: 'triangle', gain: 0.12 });
  tone(700, 0.05, 0.2, { type: 'triangle', gain: 0.1 });
}

export function playGulp() {
  tone(420, 0, 0.09, { type: 'sine', gain: 0.3, freqEnd: 220 });
  tone(420, 0.16, 0.09, { type: 'sine', gain: 0.3, freqEnd: 220 });
}

export function playCheer() {
  tone(880, 0, 0.1, { type: 'square', gain: 0.06 });
  tone(880, 0.12, 0.1, { type: 'square', gain: 0.06 });
  tone(660, 0, 0.2, { type: 'triangle', gain: 0.1 });
}

export function playWhistle() {
  tone(1200, 0, 0.3, { type: 'sine', gain: 0.12, freqEnd: 1600 });
}
```

- [ ] **Step 2: 验证音效**

在浏览器控制台（先访问 `/table.html`，因为该页为 module 上下文）执行冒烟测试：

```js
const sfx = await import('/js/audio.js');
sfx.playClink();
sfx.playGulp();
sfx.playCheer();
sfx.playWhistle();
```

手动验证清单：
- [ ] 依次听到短促的"叮"（碰杯）、低沉的"咕咚"（吞咽）、嘈杂的欢呼、上扬的口哨声
- [ ] 无声卡报错

- [ ] **Step 3: 提交**

```bash
git add public/js/audio.js
git commit -m "feat: add synthesized audio effects"
```

---

### Task 9: 牌桌控制器（table.js 完整接线）

**Files:**
- Modify: `public/js/table.js`（整体重写为完整控制器）

**Interfaces:**
- Consumes:
  - `TableScene`（Task 7）
  - `audio.js`（Task 8）
  - `sessionStorage`：`cloudDrink:roomId`、`cloudDrink:playerId`
  - 服务端事件（Task 5）：`room:rejoin`、`room:state`、`game:state`、`table:toast`、`error`、`room:leave`、`game:start`、`game:next`、`game:switch`、`liar:call`、`liar:open`、`truth:choose`、`truth:done`、`table:toast`（发送）
- Produces: 无（终端页面）

- [ ] **Step 1: 实现完整 table.js**

`public/js/table.js`（整体替换 Task 7 版本）:

```js
import { TableScene } from '/js/scene.js';
import * as sfx from '/js/audio.js';

const roomId = sessionStorage.getItem('cloudDrink:roomId');
const playerId = sessionStorage.getItem('cloudDrink:playerId');
if (!roomId || !playerId) location.href = '/';

const socket = io();
const scene = new TableScene(document.getElementById('scene'));

let room = null;
let gameState = null;
let lastRoundLoser = null;

const el = {
  code: document.getElementById('room-code-label'),
  playerList: document.getElementById('player-list'),
  lobbyPanel: document.getElementById('lobby-panel'),
  ownerControls: document.getElementById('owner-controls'),
  gamePanel: document.getElementById('game-panel'),
  gameTitle: document.getElementById('game-title'),
  gameContent: document.getElementById('game-content'),
  ownerGameControls: document.getElementById('owner-game-controls'),
  toast: document.getElementById('toast'),
  reconnect: document.getElementById('reconnect-overlay'),
  drinkOverlay: document.getElementById('drink-overlay'),
};

function escapeHtml(s) {
  const d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
}

function showToast(text, isError) {
  el.toast.textContent = text;
  el.toast.classList.toggle('error', !!isError);
  el.toast.classList.remove('hidden');
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => el.toast.classList.add('hidden'), 2200);
}

function seatOf(pid) {
  if (!room) return -1;
  const p = room.players.find((x) => x.id === pid);
  return p ? p.seat : -1;
}

function nameOf(pid) {
  if (!room) return '';
  const p = room.players.find((x) => x.id === pid);
  return p ? p.nickname : '未知';
}

function me() {
  return room ? room.players.find((p) => p.id === playerId) : null;
}

function isOwner() {
  return !!room && room.ownerId === playerId;
}

// ---------- socket events ----------

socket.on('connect', () => {
  el.reconnect.classList.add('hidden');
  socket.emit('room:rejoin', { roomId, playerId }, (res) => {
    if (!res.ok) {
      sessionStorage.removeItem('cloudDrink:roomId');
      location.href = '/';
    }
  });
});

socket.on('disconnect', () => {
  el.reconnect.classList.remove('hidden');
});

socket.on('room:state', (data) => {
  room = data.room;
  if (!room.game) gameState = null;
  renderRoom();
});

socket.on('game:state', (state) => {
  gameState = state;
  renderGame();
});

socket.on('table:toast', ({ from }) => {
  const seat = seatOf(from);
  if (seat !== -1) {
    scene.playToast(seat);
    sfx.playClink();
  }
});

socket.on('error', (msg) => showToast(msg || '出错了', true));

// ---------- room render ----------

function syncSeats() {
  for (let i = 0; i < 6; i++) scene.removePlayer(i);
  if (room) {
    for (const p of room.players) scene.addPlayer(p.seat, { characterId: p.characterId });
  }
}

function renderRoom() {
  if (!room) return;
  el.code.textContent = `房号 ${room.id}`;
  document.title = `云喝酒 · ${room.id}`;
  syncSeats();

  el.playerList.innerHTML = '';
  for (const p of room.players) {
    const item = document.createElement('div');
    item.className = 'player-row';
    item.innerHTML = `<span class="chip"></span> <b>${escapeHtml(p.nickname)}</b> ${p.isOwner ? '👑' : ''} ${p.isOnline ? '' : '（离线）'}`;
    el.playerList.appendChild(item);
  }

  el.ownerControls.classList.toggle('hidden', !isOwner() || !!room.game);
  el.lobbyPanel.classList.toggle('hidden', !!room.game);
  el.ownerGameControls.classList.toggle('hidden', !isOwner() || !room.game);
}

// ---------- game render ----------

function renderGame() {
  if (!gameState || !room) return;
  el.lobbyPanel.classList.add('hidden');
  el.gamePanel.classList.remove('hidden');
  el.gameTitle.textContent = gameState.game === 'liar' ? '大话骰' : '真心话大冒险';

  for (const p of room.players) scene.setDrunkLevel(p.seat, p.drinkCount);

  if (gameState.game === 'liar') renderLiar();
  else renderTruth();

  const loserId = gameState.loserId || null;
  if (loserId && loserId !== lastRoundLoser) {
    const seat = seatOf(loserId);
    if (seat !== -1) {
      scene.playDrink(seat);
      sfx.playGulp();
      showDrinkOverlay();
    }
    lastRoundLoser = loserId;
  }

  renderOwnerGameControls();
}

function renderOwnerGameControls() {
  el.ownerGameControls.innerHTML = '';
  if (!isOwner() || !room || !room.game) return;
  const again = document.createElement('button');
  again.className = 'primary';
  again.textContent = '再来一局';
  again.addEventListener('click', () => {
    socket.emit('game:next', { playerId }, (res) => { if (!res.ok) showToast(res.error, true); });
  });
  const back = document.createElement('button');
  back.textContent = '返回选游戏';
  back.addEventListener('click', () => {
    socket.emit('game:switch', { playerId }, (res) => { if (!res.ok) showToast(res.error, true); });
  });
  el.ownerGameControls.append(again, back);
}

function renderLiar() {
  const c = el.gameContent;
  c.innerHTML = '';

  const bidsDiv = document.createElement('div');
  bidsDiv.className = 'bids';
  const last = gameState.bids[gameState.bids.length - 1];
  bidsDiv.textContent = last
    ? `${nameOf(last.by)} 叫了 ${last.quantity} 个 ${last.face}`
    : '等待第一位叫数…';
  c.appendChild(bidsDiv);

  if (gameState.phase === 'betting') {
    const myTurn = gameState.turnPlayerId === playerId;
    const turnDiv = document.createElement('div');
    turnDiv.className = 'turn-hint';
    turnDiv.textContent = myTurn ? '轮到你！' : `等待 ${nameOf(gameState.turnPlayerId)} 叫数…`;
    c.appendChild(turnDiv);

    const reveal = document.createElement('button');
    reveal.className = 'ghost';
    reveal.textContent = '亮出我的骰子';
    reveal.addEventListener('click', () => scene.showDice(seatOf(playerId), gameState.myDice));
    c.appendChild(reveal);

    if (myTurn) {
      const panel = document.createElement('div');
      panel.className = 'bid-panel';
      const q = document.createElement('input');
      q.type = 'number'; q.min = '1'; q.max = '30'; q.value = '1'; q.className = 'num';
      const f = document.createElement('select');
      f.className = 'num';
      for (let i = 1; i <= 6; i++) {
        const opt = document.createElement('option');
        opt.value = i;
        opt.textContent = `${i} 点`;
        f.appendChild(opt);
      }
      const btnCall = document.createElement('button');
      btnCall.className = 'primary';
      btnCall.textContent = '叫数';
      btnCall.addEventListener('click', () => {
        const bid = { quantity: parseInt(q.value, 10) || 1, face: parseInt(f.value, 10) };
        socket.emit('liar:call', { bid, playerId }, (res) => { if (!res.ok) showToast(res.error, true); });
      });
      const btnOpen = document.createElement('button');
      btnOpen.textContent = '开';
      btnOpen.disabled = gameState.bids.length === 0;
      btnOpen.addEventListener('click', () => {
        socket.emit('liar:open', { playerId }, (res) => { if (!res.ok) showToast(res.error, true); });
      });
      panel.append(q, f, btnCall, btnOpen);
      c.appendChild(panel);
    }
  } else if (gameState.phase === 'roundEnd') {
    for (const pid of Object.keys(gameState.allDice || {})) {
      scene.showDice(seatOf(pid), gameState.allDice[pid]);
    }
    const msg = document.createElement('div');
    msg.className = 'result';
    msg.innerHTML = `${escapeHtml(gameState.message)}<br/><b>${escapeHtml(nameOf(gameState.loserId))} 干杯！🍻</b>`;
    c.appendChild(msg);
  }
}

function renderTruth() {
  const c = el.gameContent;
  c.innerHTML = '';

  if (gameState.phase === 'choosing') {
    const hint = document.createElement('div');
    hint.className = 'turn-hint';
    hint.textContent = `🎯 骰子选中了：${nameOf(gameState.targetId)}`;
    c.appendChild(hint);
    if (gameState.targetId === playerId) {
      const panel = document.createElement('div');
      panel.className = 'bid-panel';
      const t = document.createElement('button');
      t.textContent = '真心话';
      t.addEventListener('click', () => {
        socket.emit('truth:choose', { type: 'truth', playerId }, (res) => { if (!res.ok) showToast(res.error, true); });
      });
      const d = document.createElement('button');
      d.textContent = '大冒险';
      d.addEventListener('click', () => {
        socket.emit('truth:choose', { type: 'dare', playerId }, (res) => { if (!res.ok) showToast(res.error, true); });
      });
      panel.append(t, d);
      c.appendChild(panel);
    }
  } else if (gameState.phase === 'showing') {
    const card = document.createElement('div');
    card.className = 'question-card';
    card.textContent = `${nameOf(gameState.targetId)} 的${gameState.questionType === 'truth' ? '真心话' : '大冒险'}：${gameState.question}`;
    c.appendChild(card);
    if (gameState.targetId === playerId) {
      const btn = document.createElement('button');
      btn.className = 'primary';
      btn.textContent = '我完成啦';
      btn.addEventListener('click', () => {
        socket.emit('truth:done', { playerId }, (res) => { if (!res.ok) showToast(res.error, true); });
      });
      c.appendChild(btn);
    }
  } else if (gameState.phase === 'roundEnd') {
    const msg = document.createElement('div');
    msg.className = 'result';
    msg.innerHTML = `<b>${escapeHtml(nameOf(gameState.loserId))} 干杯！🍻</b>`;
    c.appendChild(msg);
  }
}

function showDrinkOverlay() {
  el.drinkOverlay.classList.remove('hidden');
  clearTimeout(showDrinkOverlay._t);
  showDrinkOverlay._t = setTimeout(() => el.drinkOverlay.classList.add('hidden'), 1600);
}

// ---------- hud ----------

document.getElementById('btn-toast').addEventListener('click', () => {
  socket.emit('table:toast', { playerId });
});

document.getElementById('btn-leave').addEventListener('click', () => {
  socket.emit('room:leave', { playerId }, () => {
    sessionStorage.removeItem('cloudDrink:roomId');
    location.href = '/';
  });
});

el.ownerControls.querySelectorAll('.game-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    socket.emit('game:start', { game: btn.dataset.game, playerId }, (res) => {
      if (!res.ok) showToast(res.error, true);
    });
  });
});
```

- [ ] **Step 2: 双浏览器完整联调**

Run: `npm start`。用两个浏览器窗口（普通窗口 + 无痕窗口）分别做房主与好友。

手动验证清单（A=房主，B=好友）：
- [ ] A 建房进入 `/table.html`，顶部显示 4 位房号，底部大厅面板显示 A，出现"开始：大话骰 / 开始：真心话大冒险"
- [ ] B 在首页输房号加入，A 与 B 都看到 2 名玩家（B 无房主按钮）
- [ ] A 点"开始：大话骰"→ 双方进入大话骰面板，B 可"亮出我的骰子"看到自己 5 颗骰子
- [ ] 轮到 B 叫数时 A 无法操作（B 点叫数正常推进，A 点叫数 toast 报"还没轮到你叫数"）
- [ ] 一方点"开"→ 双方显示判定结果，输家角色做干杯动画 + 咕咚音效 + "干杯！"全屏提示
- [ ] A 点"再来一局"→ 新一局开始；A 点"返回选游戏"→ 回到大厅面板
- [ ] A 点"开始：真心话大冒险"→ 显示被选中者，选中者选"真心话/大冒险"→ 展示题目 → 点"我完成啦"→ 该玩家干杯，其 drinkCount +1，角色更红/晃动更明显
- [ ] 任意玩家点"干杯 🍻"→ 双方该角色头顶出现金色圆环 + 碰杯音
- [ ] B 断网（无痕窗口刷新前先断开）→ A 看到 B 标"（离线）"；B 恢复后 A 看到恢复在线
- [ ] B 点"离开"→ A 大厅只剩自己；A 点"离开"回首页

- [ ] **Step 3: 回归测试**

Run: `npm test`
Expected: PASS（全部服务端用例）。

- [ ] **Step 4: 提交**

```bash
git add public/js/table.js
git commit -m "feat: wire table controller to socket events and 3D scene"
```

---

### Task 10: README 与收尾

**Files:**
- Create: `README.md`

- [ ] **Step 1: 编写 README**

`README.md`:

```markdown
# 云喝酒 (Cloud Drink)

异地好友线上干杯的 H5 虚拟酒桌。2-6 人通过浏览器进入同一房间，玩大话骰 / 真心话大冒险，输家触发 3D 角色干杯动画与音效。

## 快速开始

```bash
npm install
npm start
# 打开 http://localhost:3000
```

房主"创建房间"得到 4 位房号，把房号或页面地址发给好友，好友"加入房间"即可同桌。

## 测试

```bash
npm test
```

## 玩法

- 大话骰：每人 5 颗骰子，轮流叫数，下家加叫或"开"，服务端裁决，输家干杯。
- 真心话大冒险：骰子随机选中一人，选真心话或大冒险，完成后该玩家干杯。
- 干杯：输家角色自动举杯一饮而尽；任何玩家可点"干杯 🍻"送出碰杯助兴特效。喝得越多角色越红、越晃。

## 技术栈

Node.js + Express + Socket.IO（服务端权威游戏逻辑）+ three.js（3D 渲染）。无账号系统、无持久化。

## 结构

```
server/           服务端：app / sockets / rooms / games
public/           前端：落地页、牌桌页、three.js 场景、音效
test/             node:test 测试（服务端纯逻辑 + Socket.IO 集成）
```

## 部署提示

`npm start` 监听 `PORT` 环境变量（默认 3000）。部署到支持 Node 的平台（Render / Railway / Fly.io）时设为静态 3000 或设置 `PORT` 即可；WebSocket 需保持长连接。
```

- [ ] **Step 2: 全量回归**

Run: `npm test`
Expected: PASS（全部用例）。

Run: `npm start`，手动快速走一遍 Task 9 Step 2 的关键链路（建房、加入、一局大话骰到干杯、离开）。
Expected: 正常。

- [ ] **Step 3: 提交**

```bash
git add README.md
git commit -m "docs: add README with quick start and gameplay"
```

---

## Self-Review

**1. Spec coverage:**
- 产品形态（H5 / 游戏互动 / 轻量 3D / 2-6 人 / 两个游戏）→ Task 1（H5 静态）、2/3（游戏）、4（房间上限）、5（接线）、7（3D）、9（交互）
- 玩家流程（建房→分享→加入→开局→干杯）→ Task 5、6、9
- 房主手动开始、不强制满员 → Task 5 `game:start` 仅 owner、≥2 在线；Task 6 大厅 UI
- 干杯环节（动画/音效/醉意值/助兴特效）→ Task 7 `playDrink/playToast/setDrunkLevel`、Task 8、Task 9 接线
- 大话骰简化规则、真心话题库 → Task 2、3
- 边界处理（断线 30s、房主转移、满房拒入、房间不存在）→ Task 4（rooms 测试）+ Task 5（join ack error）+ Task 9（断线 overlay、离开回首页）
- 非目标 → Global Constraints 声明，未实现
- 架构（权威服务器、客户端只发指令收状态）→ Task 5 `broadcastGame` 按玩家视角下发 `publicState(viewerId)`

**2. Placeholder scan:** 无 TBD/TODO；所有代码步骤含完整实现。

**3. Type consistency:**
- `LiarsDiceGame.publicState(viewerId)` / `TruthOrDareGame.publicState()` 均在 Task 5 `broadcastGame` 中按此签名调用；Task 9 读取 `gameState.myDice / allDice / loserId / message / targetId / question / questionType / phase / turnPlayerId / bids`，与 Task 2/3 输出一致
- `serializeRoom` 输出字段（id/ownerId/game/players[].seat/drinkCount/isOnline/isOwner/nickname/characterId）与 Task 9 使用一致
- `rooms.cleanup()` 返回房间数组，Task 5 app.js 用 `broadcastRoom` 广播，与 Task 4 测试一致
- socket 事件名在 Task 5 定义、Task 6/9 使用，逐一对齐

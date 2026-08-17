import { WorldView } from '/js/world.js';
import * as sfx from '/js/audio.js';
import { bodyOf } from '/js/engine/catalog.js';

const roomId = sessionStorage.getItem('cloudDrink:roomId');
const playerId = sessionStorage.getItem('cloudDrink:playerId');
if (!roomId || !playerId) location.href = '/';

const socket = io();
const world = new WorldView();

let room = null;
let gameState = null;
let lastRoundLoser = null;
let prevGamePhase = null;
let lastTurnId = null;
let liarMode = 'bid';

const el = {
  code: document.getElementById('room-code-label'),
  mode: document.getElementById('room-mode-label'),
  count: document.getElementById('room-count-label'),
  start: document.getElementById('btn-start'),
  lobbyActions: document.getElementById('lobby-actions'),
  gameActions: document.getElementById('game-actions'),
  bubble: document.getElementById('speech-bubble'),
  diceStrip: document.getElementById('dice-strip'),
  resultOverlay: document.getElementById('result-overlay'),
  resultMessage: document.getElementById('result-message'),
  endOverlay: document.getElementById('end-overlay'),
  scoreboard: document.getElementById('scoreboard'),
  endActions: document.getElementById('end-actions'),
  toast: document.getElementById('toast'),
  reconnect: document.getElementById('reconnect-overlay'),
  drinkOverlay: document.getElementById('drink-overlay'),
  emojiPop: document.getElementById('emoji-pop'),
  modal: document.getElementById('modal'),
  modalTitle: document.getElementById('modal-title'),
  modalBody: document.getElementById('modal-body'),
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

function isOwner() {
  return !!room && room.ownerId === playerId;
}

function openModal(title, html) {
  el.modalTitle.textContent = title;
  el.modalBody.innerHTML = html;
  el.modal.classList.remove('hidden');
}

document.getElementById('modal-close').addEventListener('click', () => {
  el.modal.classList.add('hidden');
});

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
    world.playDrink(seat);
    world.playToast(seat);
    sfx.playClink();
  }
});

socket.on('error', (msg) => showToast(msg || '出错了', true));

// ---------- room render ----------

function syncSeats() {
  const present = new Set();
  if (room) {
    for (const p of room.players) present.add(p.seat);
  }
  for (let i = 0; i < 6; i++) {
    if (!present.has(i)) world.removePlayer(i);
  }
  if (room) {
    for (const p of room.players) {
      world.addPlayer(p.seat, {
        characterId: p.characterId,
        face: p.face,
        accessory: p.accessory,
        hair: p.hair,
        eyes: p.eyes,
        faceShape: p.faceShape,
        nickname: p.nickname,
        isYou: p.id === playerId,
      });
    }
  }
  world.setLocalSeat(seatOf(playerId));
}

function renderRoom() {
  if (!room) return;
  el.code.textContent = room.id;
  el.count.textContent = `${room.players.length}/6`;
  el.mode.textContent = room.game ? '大话骰 · 初级场' : '大厅';
  document.title = `云喝酒 · ${room.id}`;
  syncSeats();
  for (const p of room.players) world.setDrunkLevel(p.seat, p.drinkCount);

  const inGame = !!room.game;
  el.start.classList.toggle('hidden', !isOwner() || inGame);
  el.lobbyActions.classList.toggle('hidden', inGame);
  if (!inGame) {
    el.gameActions.classList.add('hidden');
    el.bubble.classList.add('hidden');
    el.diceStrip.classList.add('hidden');
    el.resultOverlay.classList.add('hidden');
    el.endOverlay.classList.add('hidden');
    world.setBg('/assets/bg-room.png');
    world.removeDice();
  }
}

// ---------- game render ----------

function renderGame() {
  if (!gameState || !room) return;
  el.lobbyActions.classList.add('hidden');
  el.mode.textContent = '大话骰 · 初级场';

  for (const p of room.players) world.setDrunkLevel(p.seat, p.drinkCount);

  if (gameState.phase === 'betting' && prevGamePhase !== 'betting') {
    world.removeDice();
    world.setBg('/assets/bg-table-close.png');
    world.rollDice(gameState.myDice);
    sfx.playRattle();
    setTimeout(() => sfx.playThud(), 900);
    renderEndBoard._shown = false;
    el.endOverlay.classList.add('hidden');
    el.resultOverlay.classList.add('hidden');
  }
  if (gameState.phase === 'roundEnd' && prevGamePhase !== 'roundEnd') {
    world.revealDice();
  }
  prevGamePhase = gameState.phase;

  if (gameState.turnPlayerId !== lastTurnId) {
    lastTurnId = gameState.turnPlayerId;
    liarMode = gameState.bids.length === 0 ? 'bid' : 'react';
  }

  renderLiar();

  const loserId = gameState.loserId || null;
  if (loserId) {
    if (loserId !== lastRoundLoser) {
      const seat = seatOf(loserId);
      if (seat !== -1) {
        world.playDrink(seat);
        showDrinkOverlay();
      }
      lastRoundLoser = loserId;
    }
  } else {
    lastRoundLoser = null;
  }
}

function renderLiar() {
  const last = gameState.bids[gameState.bids.length - 1];
  if (last && gameState.phase === 'betting') {
    el.bubble.classList.remove('hidden');
    el.bubble.textContent = `${nameOf(last.by)}：我叫 ${last.quantity} 个 ${last.face}！`;
    world.setSpeech(seatOf(last.by), `我叫 ${last.quantity} 个 ${last.face}！`);
  } else {
    el.bubble.classList.add('hidden');
    world.setSpeech(-1, '');
  }

  if (gameState.phase === 'betting' && gameState.myDice && gameState.myDice.length) {
    el.diceStrip.classList.remove('hidden');
    el.diceStrip.textContent = `你的骰子  ${gameState.myDice.join(' · ')}`;
  } else {
    el.diceStrip.classList.add('hidden');
  }

  const keepEnd = gameState.phase === 'roundEnd' && renderEndBoard._shown && !el.endOverlay.classList.contains('hidden');
  if (!keepEnd) {
    el.resultOverlay.classList.add('hidden');
    el.endOverlay.classList.add('hidden');
  }
  el.gameActions.innerHTML = '';
  el.gameActions.classList.add('hidden');

  if (gameState.phase === 'betting') {
    const myTurn = gameState.turnPlayerId === playerId;
    if (!myTurn) return;
    el.gameActions.classList.remove('hidden');
    if (liarMode === 'react' && gameState.bids.length > 0) {
      const row = document.createElement('div');
      row.className = 'react-row';
      const no = document.createElement('button');
      no.className = 'btn-danger';
      no.textContent = '不信';
      no.addEventListener('click', () => {
        socket.emit('liar:open', {}, (res) => { if (!res.ok) showToast(res.error, true); });
      });
      const yes = document.createElement('button');
      yes.className = 'btn-ok';
      yes.textContent = '信了';
      yes.addEventListener('click', () => {
        liarMode = 'bid';
        renderLiar();
      });
      row.append(no, yes);
      el.gameActions.appendChild(row);
      return;
    }
    el.gameActions.appendChild(buildBidPanel());
  } else if (gameState.phase === 'roundEnd') {
    el.resultOverlay.classList.remove('hidden');
    el.resultMessage.innerHTML = `${escapeHtml(gameState.message)}<br/><b>${escapeHtml(nameOf(gameState.loserId))} 喝一杯！</b>`;
    renderEndBoard();
  }
}

function buildBidPanel() {
  const panel = document.createElement('div');
  panel.className = 'bid-panel';
  const q = document.createElement('input');
  q.type = 'number';
  q.min = '1';
  q.max = '30';
  q.value = lastBidQuantity();
  q.className = 'num';
  const f = document.createElement('select');
  f.className = 'num';
  for (let i = 1; i <= 6; i++) {
    const opt = document.createElement('option');
    opt.value = i;
    opt.textContent = `${i} 点`;
    f.appendChild(opt);
  }
  const last = gameState.bids[gameState.bids.length - 1];
  if (last) f.value = String(last.face);
  const btnCall = document.createElement('button');
  btnCall.className = 'btn-gold btn-wide';
  btnCall.textContent = '叫数';
  btnCall.addEventListener('click', () => {
    const bid = { quantity: parseInt(q.value, 10) || 1, face: parseInt(f.value, 10) };
    socket.emit('liar:call', { bid }, (res) => { if (!res.ok) showToast(res.error, true); });
  });
  panel.append(q, f, btnCall);
  return panel;
}

function lastBidQuantity() {
  const last = gameState.bids[gameState.bids.length - 1];
  return last ? String(last.quantity) : '1';
}

function renderEndBoard() {
  const ranked = [...room.players].sort((a, b) => {
    if (a.id === gameState.winnerId) return -1;
    if (b.id === gameState.winnerId) return 1;
    return (a.drinkCount || 0) - (b.drinkCount || 0);
  });
  el.scoreboard.innerHTML = ranked.map((p, i) => {
    const win = p.id === gameState.winnerId;
    const color = bodyOf(p.characterId).color;
    return `<div class="score-row${win ? ' win' : ''}">
      <span>${i + 1}</span>
      <span class="score-avatar" style="--c:${color}"></span>
      <span>${escapeHtml(p.nickname)}${win ? '（胜利）' : ''}${p.id === playerId ? ' ·你' : ''}</span>
      <span>+${p.drinkCount || 0}</span>
    </div>`;
  }).join('');

  el.endActions.innerHTML = '';
  if (isOwner()) {
    const again = document.createElement('button');
    again.className = 'btn-gold btn-wide';
    again.textContent = '再来一局';
    again.addEventListener('click', () => {
      socket.emit('game:next', {}, (res) => { if (!res.ok) showToast(res.error, true); });
    });
    const back = document.createElement('button');
    back.className = 'link-btn';
    back.textContent = '返回房间';
    back.addEventListener('click', () => {
      socket.emit('game:switch', {}, (res) => { if (!res.ok) showToast(res.error, true); });
    });
    el.endActions.append(again, back);
  } else {
    const wait = document.createElement('p');
    wait.className = 'tagline';
    wait.textContent = '等待房主再开一局…';
    el.endActions.append(wait);
  }

  if (!renderEndBoard._shown) {
    renderEndBoard._shown = true;
    clearTimeout(renderEndBoard._t);
    renderEndBoard._t = setTimeout(() => {
      el.resultOverlay.classList.add('hidden');
      el.endOverlay.classList.remove('hidden');
    }, 2200);
  }
}

function showDrinkOverlay() {
  const title = document.getElementById('drink-title');
  const hero = document.getElementById('drink-hero');
  const loser = room && gameState && room.players.find((p) => p.id === gameState.loserId);
  if (title && loser) title.textContent = `${loser.nickname} 喝一杯！`;
  if (hero && loser) hero.src = bodyOf(loser.characterId).img;
  const timerEl = document.getElementById('drink-timer');
  let left = 2.5;
  if (timerEl) timerEl.textContent = '2.5s';
  clearInterval(showDrinkOverlay._i);
  showDrinkOverlay._i = setInterval(() => {
    left = Math.max(0, left - 0.1);
    if (timerEl) timerEl.textContent = `${left.toFixed(1)}s`;
    if (left <= 0) clearInterval(showDrinkOverlay._i);
  }, 100);
  el.drinkOverlay.classList.remove('hidden');
  el.drinkOverlay.classList.remove('show');
  requestAnimationFrame(() => el.drinkOverlay.classList.add('show'));
  sfx.playGulp();
  setTimeout(() => sfx.playClink(), 400);
  clearTimeout(showDrinkOverlay._t);
  showDrinkOverlay._t = setTimeout(() => hideDrinkOverlay(), 2500);
}

function hideDrinkOverlay() {
  clearInterval(showDrinkOverlay._i);
  el.drinkOverlay.classList.add('hidden');
  el.drinkOverlay.classList.remove('show');
}

el.drinkOverlay.querySelectorAll('[data-act]').forEach((btn) => {
  btn.addEventListener('click', () => {
    const act = btn.dataset.act;
    const seat = seatOf(playerId);
    if (act === 'skip') {
      hideDrinkOverlay();
      return;
    }
    if (act === 'cheers' || act === 'clink' || act === 'refill') {
      socket.emit('table:toast', {});
    }
    if (act === 'gulp' && seat !== -1) {
      world.playDrink(seat);
      sfx.playGulp();
    }
  });
});

// ---------- hud ----------

document.getElementById('btn-mute').addEventListener('click', (e) => {
  const next = !sfx.isMuted();
  sfx.setMuted(next);
  e.currentTarget.textContent = next ? '🔇' : '🔊';
  e.currentTarget.classList.toggle('muted', next);
});

document.getElementById('btn-emoji').addEventListener('click', () => {
  el.emojiPop.classList.toggle('hidden');
});

el.emojiPop.addEventListener('click', (e) => {
  const b = e.target.closest('[data-emoji]');
  if (!b) return;
  el.emojiPop.classList.add('hidden');
  showToast(b.dataset.emoji);
  if (b.dataset.emoji === '🍻') socket.emit('table:toast', {});
  else sfx.playCheer();
});

document.getElementById('btn-settings').addEventListener('click', () => {
  openModal('设置', `<ul>
    <li>声音：点右上角喇叭开关。</li>
    <li>走动：拖动右下角摇杆环视酒桌。</li>
    <li>麦克风将在后续版本开放。</li>
  </ul>`);
});

document.getElementById('btn-cheers').addEventListener('click', () => {
  el.resultOverlay.classList.add('hidden');
  showDrinkOverlay();
  socket.emit('table:toast', {});
});

document.getElementById('btn-info').addEventListener('click', () => {
  if (!room) return;
  const names = room.players.map((p) => `${p.nickname}${p.isOwner ? '（房主）' : ''}${p.isOnline ? '' : '（离线）'}`).join('、');
  openModal('房间信息', `<p>房号 ${escapeHtml(room.id)}</p><p>玩家：${escapeHtml(names)}</p>`);
});

document.getElementById('btn-rules').addEventListener('click', () => {
  openModal('大话骰规则', `<ul>
    <li>每人 5 颗骰子，只看自己的。</li>
    <li>轮流叫「几个几点」，必须比上家更大。</li>
    <li>下家点「信了」继续加叫，点「不信」开盅。</li>
    <li>实际数量不够，叫家喝；够了，开家喝。</li>
  </ul>`);
});

document.getElementById('btn-share').addEventListener('click', async () => {
  if (!room) return;
  const url = `${location.origin}/?room=${room.id}`;
  if (navigator.share) {
    try {
      await navigator.share({ title: '云喝酒', text: `来我的酒桌一起喝！房号 ${room.id}`, url });
      return;
    } catch (e) {
      /* user cancelled */
    }
  }
  try {
    await navigator.clipboard.writeText(url);
    showToast(`已复制邀请链接（房号 ${room.id}）`);
  } catch (e) {
    showToast(`房号 ${room.id}，邀请链接：${url}`, true);
  }
});

document.getElementById('btn-leave').addEventListener('click', () => {
  socket.emit('room:leave', {}, () => {
    sessionStorage.removeItem('cloudDrink:roomId');
    location.href = '/';
  });
});

el.start.addEventListener('click', () => {
  socket.emit('game:start', { game: 'liar' }, (res) => {
    if (!res.ok) showToast(res.error, true);
  });
});

// joystick orbit
(function bindWalkPad() {
  const pad = document.getElementById('walk-pad');
  const knob = document.getElementById('walk-knob');
  let dragging = false;
  function pos(ev) {
    const t = ev.touches ? ev.touches[0] : ev;
    const r = pad.getBoundingClientRect();
    const x = t.clientX - r.left - r.width / 2;
    const y = t.clientY - r.top - r.height / 2;
    const max = 22;
    const len = Math.hypot(x, y) || 1;
    const k = Math.min(1, max / len);
    const nx = x * k;
    const ny = y * k;
    knob.style.transform = `translate(${nx}px, ${ny}px)`;
    world.setWalkInput(nx / 22, ny / 22);
  }
  function end() {
    dragging = false;
    knob.style.transform = '';
    world.setWalkInput(0, 0);
  }
  pad.addEventListener('pointerdown', (e) => { dragging = true; pad.setPointerCapture(e.pointerId); pos(e); });
  pad.addEventListener('pointermove', (e) => { if (dragging) pos(e); });
  pad.addEventListener('pointerup', end);
  pad.addEventListener('pointercancel', end);
}());

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
  const present = new Set();
  if (room) {
    for (const p of room.players) present.add(p.seat);
  }
  for (let i = 0; i < 6; i++) {
    if (!present.has(i)) scene.removePlayer(i);
  }
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

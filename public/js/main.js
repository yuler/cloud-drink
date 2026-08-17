import { BODIES, HAIRS, EYES, FACE_SHAPES, bodyOf } from '/js/engine/catalog.js';

const STEPS = [
  { key: 'body', title: '选择角色形象', items: BODIES, get: () => selectedCharacter, set: (id) => { selectedCharacter = id; } },
  { key: 'hair', title: '选择发型', items: HAIRS, get: () => selectedHair, set: (id) => { selectedHair = id; } },
  { key: 'eyes', title: '选择眼睛', items: EYES, get: () => selectedEyes, set: (id) => { selectedEyes = id; } },
  { key: 'face', title: '选择脸型', items: FACE_SHAPES, get: () => selectedFace, set: (id) => { selectedFace = id; } },
];

function getPlayerId() {
  let id = sessionStorage.getItem('cloudDrink:playerId');
  if (!id) {
    id = crypto.randomUUID();
    sessionStorage.setItem('cloudDrink:playerId', id);
  }
  return id;
}

let selectedCharacter = 'rabbit';
let selectedHair = 'short';
let selectedEyes = 'smile';
let selectedFace = 'round';
let pendingJoinRoom = '';
let stepIndex = 0;

function appearance() {
  return {
    characterId: selectedCharacter,
    hair: selectedHair,
    eyes: selectedEyes,
    faceShape: selectedFace,
    face: selectedEyes,
    accessory: selectedHair === 'cap' ? 'cap' : 'none',
  };
}

function showError(msg) {
  const el = document.getElementById('error');
  if (el) el.textContent = msg || '';
}

function goToTable(roomId, ok) {
  if (!ok || !ok.ok) {
    document.getElementById('create-screen').classList.add('hidden');
    document.getElementById('login-screen').classList.remove('hidden');
    document.querySelector('.login-hero')?.classList.remove('hidden');
    showError(ok && ok.error);
    return;
  }
  sessionStorage.setItem('cloudDrink:roomId', roomId);
  location.href = '/table.html';
}

function paintProgress() {
  const el = document.getElementById('create-progress');
  el.innerHTML = STEPS.map((s, i) => {
    const cls = i === stepIndex ? 'dot on' : (i < stepIndex ? 'dot done' : 'dot');
    return `<span class="${cls}" data-step="${i}">${i + 1}</span><span class="dot-label">${s.title.replace('选择', '')}</span>`;
  }).join('');
}

function paintStep() {
  const step = STEPS[stepIndex];
  document.getElementById('create-step-title').textContent = `${stepIndex + 1}/${STEPS.length}  ${step.title}`;
  const root = document.getElementById('create-cols');
  root.innerHTML = '';
  const selectedId = step.get();
  for (const it of step.items) {
    const el = document.createElement('button');
    el.type = 'button';
    el.className = 'pick-thumb' + (it.id === selectedId ? ' selected' : '');
    el.innerHTML = `<img src="${it.img || it.thumb}" alt="${it.name}" /><span>${it.name}</span>`;
    el.addEventListener('click', () => {
      step.set(it.id);
      paintStep();
      syncPreview();
    });
    root.appendChild(el);
  }
  paintProgress();
  const back = document.getElementById('btn-back');
  const next = document.getElementById('btn-complete');
  back.disabled = stepIndex === 0;
  next.textContent = stepIndex === STEPS.length - 1 ? '完成创建' : '下一步';
}

function syncPreview() {
  document.getElementById('create-hero').src = bodyOf(selectedCharacter).img;
}

function showCreate() {
  stepIndex = 0;
  document.getElementById('login-screen').classList.add('hidden');
  document.getElementById('create-screen').classList.remove('hidden');
  document.querySelector('.login-hero')?.classList.add('hidden');
  paintStep();
  syncPreview();
}

function goCreate(joinRoom) {
  const nickname = document.getElementById('nickname').value.trim();
  if (!nickname) return showError('请输入昵称');
  pendingJoinRoom = joinRoom || '';
  showError('');
  showCreate();
}

function completeCreate() {
  const nickname = document.getElementById('nickname').value.trim();
  if (!nickname) return showError('请输入昵称');
  const socket = io();
  const payload = { playerId: getPlayerId(), nickname, ...appearance() };
  if (pendingJoinRoom) {
    socket.emit('room:join', { roomId: pendingJoinRoom, ...payload }, (res) => {
      socket.close();
      goToTable(pendingJoinRoom, res);
    });
    return;
  }
  socket.emit('room:create', payload, (res) => {
    socket.close();
    goToTable(res.roomId, res);
  });
}

function main() {
  const urlRoom = (new URLSearchParams(location.search).get('room') || '').toUpperCase();
  if (urlRoom) {
    document.getElementById('room-code').value = urlRoom;
    document.getElementById('nickname').focus();
  }
  document.getElementById('btn-next').addEventListener('click', () => goCreate(''));
  document.getElementById('btn-join-next').addEventListener('click', () => {
    const roomId = document.getElementById('room-code').value.trim().toUpperCase();
    if (!roomId) return showError('请输入房号');
    goCreate(roomId);
  });
  document.getElementById('btn-back').addEventListener('click', () => {
    if (stepIndex > 0) {
      stepIndex -= 1;
      paintStep();
    }
  });
  document.getElementById('btn-complete').addEventListener('click', () => {
    if (stepIndex < STEPS.length - 1) {
      stepIndex += 1;
      paintStep();
      return;
    }
    completeCreate();
  });
}

main();

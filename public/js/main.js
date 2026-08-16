const CHARACTERS = [
  { id: 'fox', name: '小狐狸', color: '#f28b45' },
  { id: 'cat', name: '小橘猫', color: '#f5a623' },
  { id: 'bear', name: '棕熊', color: '#a9744f' },
  { id: 'panda', name: '熊猫', color: '#5a5a5a' },
  { id: 'rabbit', name: '兔子', color: '#e8e8e8' },
  { id: 'frog', name: '青蛙', color: '#4caf50' },
];

const FACES = [
  { id: 'smile', name: '微笑', emoji: '😊' },
  { id: 'cool', name: '酷', emoji: '😎' },
  { id: 'derp', name: '呆萌', emoji: '😜' },
];

const ACCESSORIES = [
  { id: 'none', name: '无', emoji: '' },
  { id: 'cap', name: '帽子', emoji: '🧢' },
  { id: 'glasses', name: '眼镜', emoji: '👓' },
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
let selectedFace = 'smile';
let selectedAccessory = 'none';

function colorOf(id) {
  const c = CHARACTERS.find((x) => x.id === id);
  return c ? c.color : '#888';
}

function renderPicker(container, items, selectedId, onSelect) {
  container.innerHTML = '';
  for (const it of items) {
    const el = document.createElement('button');
    el.type = 'button';
    el.className = 'pick-item';
    el.dataset.id = it.id;
    el.title = it.name;
    if (it.id === selectedId) el.classList.add('selected');
    if (it.color) {
      el.style.setProperty('--c', it.color);
      el.classList.add('color-item');
    } else {
      el.textContent = it.emoji || it.name;
      if (!it.emoji) el.classList.add('text-item');
    }
    el.addEventListener('click', () => {
      onSelect(it.id);
      renderPicker(container, items, it.id, onSelect);
      renderPreview();
    });
    container.appendChild(el);
  }
}

function renderPreview() {
  const preview = document.getElementById('avatar-preview');
  preview.style.setProperty('--c', colorOf(selectedCharacter));
  const face = FACES.find((x) => x.id === selectedFace);
  const acc = ACCESSORIES.find((x) => x.id === selectedAccessory);
  preview.innerHTML = `<span class="face-emoji">${face ? face.emoji : ''}</span><span class="acc-emoji">${acc && acc.emoji ? acc.emoji : ''}</span>`;
}

function renderAllPickers() {
  renderPicker(document.getElementById('color-picker'), CHARACTERS, selectedCharacter, (id) => { selectedCharacter = id; });
  renderPicker(document.getElementById('face-picker'), FACES, selectedFace, (id) => { selectedFace = id; });
  renderPicker(document.getElementById('accessory-picker'), ACCESSORIES, selectedAccessory, (id) => { selectedAccessory = id; });
  renderPreview();
}

function showError(msg) {
  document.getElementById('error').textContent = msg || '';
}

function saveRoom(roomId) {
  sessionStorage.setItem('cloudDrink:roomId', roomId);
}

function goToTable(roomId, ok) {
  if (!ok || !ok.ok) {
    showError(ok && ok.error);
    return;
  }
  saveRoom(roomId);
  location.href = '/table.html';
}

function appearance() {
  return { characterId: selectedCharacter, face: selectedFace, accessory: selectedAccessory };
}

function readRoomFromUrl() {
  const params = new URLSearchParams(location.search);
  return (params.get('room') || '').toUpperCase();
}

function main() {
  renderAllPickers();
  const nicknameInput = document.getElementById('nickname');
  const roomCodeInput = document.getElementById('room-code');

  const urlRoom = readRoomFromUrl();
  if (urlRoom) {
    roomCodeInput.value = urlRoom;
    nicknameInput.focus();
  }

  document.getElementById('btn-create').addEventListener('click', () => {
    const nickname = nicknameInput.value.trim();
    if (!nickname) return showError('请输入昵称');
    showError('');
    const socket = io();
    socket.emit('room:create', { playerId: getPlayerId(), nickname, ...appearance() }, (res) => {
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
    socket.emit('room:join', { roomId, playerId: getPlayerId(), nickname, ...appearance() }, (res) => {
      socket.close();
      goToTable(roomId, res);
    });
  });
}

main();

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

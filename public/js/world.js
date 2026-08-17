import { bodyOf, SEAT_LAYOUT } from '/js/engine/catalog.js';

export class WorldView {
  constructor() {
    this.seatsEl = document.getElementById('seats');
    this.bg = document.getElementById('world-bg');
    this.dice = document.getElementById('dice-art');
    this.diceStage = document.getElementById('dice-stage');
    this.diceRow = document.getElementById('dice-row');
    this.diceCup = document.getElementById('dice-cup');
    this.nodes = new Map();
    this.walk = { x: 0, y: 0 };
    this.offset = { x: 0, y: 0 };
    this.localSeat = -1;
    this._tick = this._tick.bind(this);
    requestAnimationFrame(this._tick);
  }

  setBg(src) {
    this.bg.src = src;
  }

  setWalkInput(x, y) {
    this.walk.x = x;
    this.walk.y = y;
  }

  setLocalSeat(index) {
    this.localSeat = index;
  }

  addPlayer(seatIndex, appearance) {
    let node = this.nodes.get(seatIndex);
    if (!node) {
      node = document.createElement('div');
      node.className = 'seat';
      const layout = SEAT_LAYOUT[seatIndex] || SEAT_LAYOUT[0];
      node.style.left = layout.left;
      node.style.top = layout.top;
      node.innerHTML = `<img class="seat-img" alt="" /><div class="seat-tag"></div><div class="seat-bubble hidden"></div>`;
      this.seatsEl.appendChild(node);
      this.nodes.set(seatIndex, node);
    }
    const img = node.querySelector('.seat-img');
    const tag = node.querySelector('.seat-tag');
    img.src = bodyOf(appearance.characterId).img;
    tag.textContent = appearance.isYou ? '你' : (appearance.nickname || '');
    tag.classList.toggle('you', !!appearance.isYou);
    node.classList.toggle('you', !!appearance.isYou);
  }

  removePlayer(seatIndex) {
    const node = this.nodes.get(seatIndex);
    if (!node) return;
    node.remove();
    this.nodes.delete(seatIndex);
  }

  setDrunkLevel(seatIndex, level) {
    const node = this.nodes.get(seatIndex);
    if (!node) return;
    node.classList.toggle('drunk', level >= 2);
  }

  playDrink(seatIndex) {
    const node = this.nodes.get(seatIndex);
    if (!node) return;
    node.classList.remove('drinking');
    void node.offsetWidth;
    node.classList.add('drinking');
    setTimeout(() => node.classList.remove('drinking'), 1800);
  }

  playToast(seatIndex) {
    const node = this.nodes.get(seatIndex);
    if (!node) return;
    node.classList.remove('toast-pop');
    void node.offsetWidth;
    node.classList.add('toast-pop');
    setTimeout(() => node.classList.remove('toast-pop'), 700);
  }

  _pips(face) {
    const map = {
      1: [4],
      2: [0, 8],
      3: [0, 4, 8],
      4: [0, 2, 6, 8],
      5: [0, 2, 4, 6, 8],
      6: [0, 2, 3, 5, 6, 8],
    };
    return map[face] || map[1];
  }

  _makeDie(face, i) {
    const die = document.createElement('div');
    die.className = 'die';
    die.style.animationDelay = `${0.35 + i * 0.08}s`;
    for (let c = 0; c < 9; c++) {
      const pip = document.createElement('span');
      pip.className = 'pip' + (this._pips(face).includes(c) ? ' on' : '');
      die.appendChild(pip);
    }
    return die;
  }

  rollDice(values) {
    if (!this.diceStage || !this.diceRow) return;
    this.dice.classList.add('hidden');
    this.diceStage.classList.remove('hidden');
    this.diceStage.classList.remove('revealed');
    this.diceRow.innerHTML = '';
    (values || [1, 2, 3, 4, 5]).forEach((v, i) => {
      this.diceRow.appendChild(this._makeDie(v, i));
    });
    this.diceStage.classList.remove('rolling');
    void this.diceStage.offsetWidth;
    this.diceStage.classList.add('rolling');
    clearTimeout(this._rollT);
    this._rollT = setTimeout(() => this.diceStage.classList.add('landed'), 1100);
  }

  revealDice() {
    if (!this.diceStage) return;
    this.diceStage.classList.remove('hidden');
    this.diceStage.classList.add('revealed');
  }

  showDice() {
    if (this.diceStage && this.diceRow && this.diceRow.children.length) {
      this.diceStage.classList.remove('hidden');
      return;
    }
    this.dice.classList.remove('hidden');
  }

  removeDice() {
    this.dice.classList.add('hidden');
    if (this.diceStage) {
      this.diceStage.classList.add('hidden');
      this.diceStage.classList.remove('rolling', 'landed', 'revealed');
    }
    if (this.diceRow) this.diceRow.innerHTML = '';
  }

  setSpeech(seatIndex, text) {
    for (const n of this.nodes.values()) {
      const b = n.querySelector('.seat-bubble');
      b.classList.add('hidden');
      b.textContent = '';
    }
    if (seatIndex < 0 || !text) return;
    const node = this.nodes.get(seatIndex);
    if (!node) return;
    const b = node.querySelector('.seat-bubble');
    b.textContent = text;
    b.classList.remove('hidden');
  }

  _tick() {
    requestAnimationFrame(this._tick);
    if (Math.abs(this.walk.x) > 0.12 || Math.abs(this.walk.y) > 0.12) {
      this.offset.x += this.walk.x * 4;
      this.offset.y += this.walk.y * 4;
      this.offset.x = Math.max(-80, Math.min(80, this.offset.x));
      this.offset.y = Math.max(-50, Math.min(50, this.offset.y));
    }
    const node = this.nodes.get(this.localSeat);
    if (node) {
      node.style.setProperty('--walk-x', `${this.offset.x}px`);
      node.style.setProperty('--walk-y', `${this.offset.y}px`);
    }
  }
}

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
    }, () => {
      ring.geometry.dispose();
      if (ring.material.map) ring.material.map.dispose();
      ring.material.dispose();
      this.scene.remove(ring);
    });
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
      g.traverse((obj) => {
        if (obj.geometry) obj.geometry.dispose();
        if (obj.material) {
          const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
          for (const m of mats) {
            if (m.map) m.map.dispose();
            m.dispose();
          }
        }
      });
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

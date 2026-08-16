import * as THREE from '/vendor/three/three.module.js';

const SEAT_COUNT = 6;
const TABLE_RADIUS = 2.2;
const SEAT_RADIUS = 3.4;
const DICE_RADIUS = 1.7;

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
    this.camera.position.set(0, 6.5, 7.5);
    this.camera.lookAt(0, 0.8, 0);

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
      new THREE.MeshStandardMaterial({ color: 0x6b4a2c })
    );
    top.position.y = 0.9;
    this.scene.add(top);
    const leg = new THREE.Mesh(
      new THREE.CylinderGeometry(0.25, 0.35, 0.9, 16),
      new THREE.MeshStandardMaterial({ color: 0x4a3018 })
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

  addPlayer(seatIndex, { characterId, face, accessory }) {
    if (this.seats.has(seatIndex)) return;
    const color = CHARACTER_COLORS[characterId] || CHARACTER_COLORS.fox;
    this.baseColors.set(seatIndex, color);
    const group = this._makeCharacter(color, face, accessory);
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

  _makeCharacter(color, face, accessory) {
    const group = new THREE.Group();
    const bodyMat = new THREE.MeshStandardMaterial({ color });

    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.55, 1.1, 16), bodyMat);
    body.position.y = 0.55;
    group.add(body);

    // head group (rotatable for the drink animation)
    const headGroup = new THREE.Group();
    headGroup.position.y = 1.35;
    group.add(headGroup);

    const head = new THREE.Mesh(new THREE.SphereGeometry(0.42, 24, 24), bodyMat);
    headGroup.add(head);

    this._makeFace(headGroup, face);
    this._makeAccessory(headGroup, accessory);

    // cup (independent, animated during drinking)
    const cup = new THREE.Group();
    const cupBody = new THREE.Mesh(
      new THREE.CylinderGeometry(0.12, 0.09, 0.28, 16),
      new THREE.MeshStandardMaterial({ color: 0xe8e0d0 })
    );
    cup.add(cupBody);
    cup.position.set(0.45, 0.35, 0.1);
    group.add(cup);

    group.userData = { bodyMat, headGroup, cup, cupStart: cup.position.clone() };
    return group;
  }

  _makeFace(headGroup, face) {
    const eyeMat = new THREE.MeshStandardMaterial({ color: 0x111111 });
    const eyeL = new THREE.Mesh(new THREE.SphereGeometry(0.05, 12, 12), eyeMat);
    const eyeR = new THREE.Mesh(new THREE.SphereGeometry(0.05, 12, 12), eyeMat);

    if (face === 'cool') {
      eyeL.scale.set(1, 0.45, 1);
      eyeR.scale.set(1, 0.45, 1);
      eyeL.position.set(-0.15, 1.44, 0.37);
      eyeR.position.set(0.15, 1.44, 0.37);
    } else if (face === 'derp') {
      eyeL.scale.set(1.3, 1.3, 1.3);
      eyeR.scale.set(1.3, 1.3, 1.3);
      eyeL.position.set(-0.15, 1.46, 0.36);
      eyeR.position.set(0.15, 1.46, 0.36);
    } else {
      eyeL.position.set(-0.14, 1.45, 0.37);
      eyeR.position.set(0.14, 1.45, 0.37);
    }
    headGroup.add(eyeL);
    headGroup.add(eyeR);

    const mouthMat = new THREE.MeshStandardMaterial({ color: 0x111111 });
    let mouth;
    if (face === 'cool') {
      mouth = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.03, 0.03), mouthMat);
      mouth.position.set(0, 1.26, 0.37);
    } else if (face === 'derp') {
      mouth = new THREE.Mesh(new THREE.SphereGeometry(0.055, 12, 12), mouthMat);
      mouth.position.set(0, 1.26, 0.37);
    } else {
      mouth = new THREE.Mesh(new THREE.TorusGeometry(0.14, 0.035, 8, 16, Math.PI), mouthMat);
      mouth.rotation.z = Math.PI;
      mouth.position.set(0, 1.3, 0.37);
    }
    headGroup.add(mouth);
  }

  _makeAccessory(headGroup, accessory) {
    if (accessory === 'cap') {
      const capMat = new THREE.MeshStandardMaterial({ color: 0x2f2f3a });
      const dome = new THREE.Mesh(
        new THREE.SphereGeometry(0.46, 16, 16, 0, Math.PI * 2, 0, Math.PI / 2),
        capMat
      );
      dome.position.y = 0.05;
      headGroup.add(dome);
      const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.05, 16), capMat);
      brim.rotation.x = Math.PI / 2;
      brim.position.set(0, 0.02, 0.38);
      headGroup.add(brim);
    } else if (accessory === 'glasses') {
      const rimMat = new THREE.MeshStandardMaterial({ color: 0x111111 });
      const ringL = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.022, 8, 20), rimMat);
      ringL.position.set(-0.14, 1.45, 0.4);
      headGroup.add(ringL);
      const ringR = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.022, 8, 20), rimMat);
      ringR.position.set(0.14, 1.45, 0.4);
      headGroup.add(ringR);
      const bridge = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.025, 0.025), rimMat);
      bridge.position.set(0, 1.45, 0.4);
      headGroup.add(bridge);
    }
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
    const { cup, headGroup, cupStart } = entry.group.userData;
    const mouth = { x: 0.18, y: 1.25, z: 0.35 };
    tween(1400, (t) => {
      let k;
      if (t < 0.35) k = t / 0.35;
      else if (t < 0.7) k = 1;
      else k = 1 - (t - 0.7) / 0.3;
      cup.position.set(
        cupStart.x + (mouth.x - cupStart.x) * k,
        cupStart.y + (mouth.y - cupStart.y) * k,
        cupStart.z + (mouth.z - cupStart.z) * k
      );
      cup.rotation.x = -0.9 * k;
      headGroup.rotation.x = -0.45 * k;
    }, () => {
      cup.position.copy(cupStart);
      cup.rotation.x = 0;
      headGroup.rotation.x = 0;
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
    const angle = (seatIndex / SEAT_COUNT) * Math.PI * 2 - Math.PI / 2;
    const group = new THREE.Group();
    values.forEach((v, i) => {
      const die = this._makeDie(v);
      die.position.set((i - 2) * 0.36, 0, 0);
      group.add(die);
    });
    group.position.set(Math.cos(angle) * DICE_RADIUS, 1.0, Math.sin(angle) * DICE_RADIUS);
    group.rotation.y = -angle;
    this.scene.add(group);
    this.diceGroups.set(seatIndex, group);
    this._playDiceRoll(group, angle);
  }

  _playDiceRoll(group, angle) {
    const startY = 3.2;
    const targetY = 1.0;
    group.position.y = startY;
    tween(800, (t) => {
      let y;
      if (t < 0.6) {
        const k = t / 0.6;
        const e = 1 - Math.pow(1 - k, 3);
        y = startY + (targetY - startY) * e;
      } else {
        const k = (t - 0.6) / 0.4;
        y = targetY + Math.sin(k * Math.PI) * 0.12 * (1 - k);
      }
      group.position.y = y;
      group.rotation.x += 0.35;
      group.rotation.y += 0.5;
    }, () => {
      group.position.y = targetY;
      group.rotation.set(0, -angle, 0);
    });
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


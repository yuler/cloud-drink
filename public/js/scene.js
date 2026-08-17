import * as THREE from 'three';
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import { createChibi } from '/js/engine/chibi.js';
import { buildTavern, seatPosition, SEAT_COUNT, DICE_RADIUS } from '/js/engine/tavern.js';
import { toonGradient } from '/js/engine/textures.js';

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
    this.baseColors = new Map();
    this.localSeat = -1;
    this._walk = { x: 0, y: 0 };
    this._init();
  }

  _init() {
    const width = this.container.clientWidth || window.innerWidth;
    const height = this.container.clientHeight || window.innerHeight;
    toonGradient();

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x140c08);
    this.scene.fog = new THREE.FogExp2(0x140c08, 0.035);

    this._orbitAngle = Math.PI * 0.22;
    this._orbitRadius = 11.5;
    this._orbitHeight = 9.2;

    this.camera = new THREE.PerspectiveCamera(38, width / height, 0.1, 80);
    this._applyOrbit();

    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.container.appendChild(this.renderer.domElement);

    this.labelRenderer = new CSS2DRenderer();
    this.labelRenderer.setSize(width, height);
    this.labelRenderer.domElement.style.position = 'absolute';
    this.labelRenderer.domElement.style.inset = '0';
    this.labelRenderer.domElement.style.pointerEvents = 'none';
    this.container.appendChild(this.labelRenderer.domElement);

    const ambient = new THREE.AmbientLight(0xffe0b8, 0.45);
    this.scene.add(ambient);
    const main = new THREE.DirectionalLight(0xffd27a, 1.05);
    main.position.set(6, 12, 5);
    main.castShadow = true;
    main.shadow.mapSize.set(1024, 1024);
    this.scene.add(main);
    const fill = new THREE.PointLight(0xff9a3d, 1.4, 18);
    fill.position.set(0, 5.2, 0);
    this.scene.add(fill);

    buildTavern(this.scene);

    window.addEventListener('resize', () => this.resize());
    this._clock = new THREE.Clock();
    this._loop();
  }

  _applyOrbit() {
    this.camera.position.set(
      Math.sin(this._orbitAngle) * this._orbitRadius,
      this._orbitHeight,
      Math.cos(this._orbitAngle) * this._orbitRadius
    );
    this.camera.lookAt(0, 0.9, 0);
  }

  orbit(dx, dy) {
    this._orbitAngle += dx * 0.04;
    this._orbitHeight = Math.min(12, Math.max(4.2, this._orbitHeight + dy * 0.08));
    this._applyOrbit();
  }

  setWalkInput(x, y) {
    this._walk.x = x;
    this._walk.y = y;
  }

  setLocalSeat(index) {
    this.localSeat = index;
  }

  addPlayer(seatIndex, appearance) {
    if (this.seats.has(seatIndex)) {
      this._setTag(seatIndex, appearance);
      return;
    }
    const group = createChibi(appearance);
    const pos = seatPosition(seatIndex);
    pos.y = 0.62;
    group.position.copy(pos);
    group.lookAt(0, 0.62, 0);
    group.rotateY(Math.PI);
    this.scene.add(group);

    const tag = document.createElement('div');
    tag.className = 'seat-tag';
    const obj = new CSS2DObject(tag);
    obj.position.set(0, 2.15, 0);
    group.add(obj);

    this.seats.set(seatIndex, { group, drunkLevel: 0, tag, home: pos.clone() });
    this.baseColors.set(seatIndex, appearance.characterId);
    this._setTag(seatIndex, appearance);
  }

  _setTag(seatIndex, appearance) {
    const entry = this.seats.get(seatIndex);
    if (!entry) return;
    const you = appearance.isYou ? '你' : (appearance.nickname || '');
    entry.tag.textContent = you;
    entry.tag.classList.toggle('you', !!appearance.isYou);
  }

  removePlayer(seatIndex) {
    const entry = this.seats.get(seatIndex);
    if (!entry) return;
    this.scene.remove(entry.group);
    this._removeDice(seatIndex);
    this.seats.delete(seatIndex);
    this.baseColors.delete(seatIndex);
  }

  setDrunkLevel(seatIndex, level) {
    const entry = this.seats.get(seatIndex);
    if (!entry) return;
    entry.drunkLevel = Math.min(Math.max(level, 0), 3);
    const mat = entry.group.userData.bodyMat;
    if (!mat) return;
    const t = entry.drunkLevel / 3;
    const base = new THREE.Color(mat.color);
    mat.color.copy(base).lerp(new THREE.Color(0xff6b5e), t * 0.35);
  }

  playDrink(seatIndex) {
    const entry = this.seats.get(seatIndex);
    if (!entry) return;
    const { cup, headGroup, cupStart, armR } = entry.group.userData;
    tween(1400, (t) => {
      let k;
      if (t < 0.35) k = t / 0.35;
      else if (t < 0.7) k = 1;
      else k = 1 - (t - 0.7) / 0.3;
      if (armR) armR.rotation.x = -1.1 * k;
      if (headGroup) headGroup.rotation.x = -0.45 * k;
      if (cup && cupStart) {
        cup.position.set(cupStart.x, cupStart.y + 0.1 * k, cupStart.z + 0.08 * k);
        cup.rotation.x = -0.9 * k;
      }
    }, () => {
      if (armR) armR.rotation.x = 0;
      if (headGroup) headGroup.rotation.x = 0;
      if (cup && cupStart) {
        cup.position.copy(cupStart);
        cup.rotation.x = 0;
      }
    });
  }

  playToast(seatIndex) {
    const entry = this.seats.get(seatIndex);
    if (!entry) return;
    const pos = entry.group.position.clone();
    pos.y += 1.7;
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(0.3, 0.05, 8, 24),
      new THREE.MeshBasicMaterial({ color: 0xffb800, transparent: true, opacity: 1 })
    );
    ring.position.copy(pos);
    this.scene.add(ring);
    tween(700, (t) => {
      ring.scale.setScalar(1 + t * 2);
      ring.material.opacity = 1 - t;
    }, () => {
      ring.geometry.dispose();
      ring.material.dispose();
      this.scene.remove(ring);
    });
  }

  setSpeech(seatIndex, text) {
    for (const e of this.seats.values()) {
      if (e.bubble) {
        e.group.remove(e.bubble);
        e.bubble = null;
      }
    }
    if (seatIndex < 0 || !text) return;
    const entry = this.seats.get(seatIndex);
    if (!entry) return;
    const el = document.createElement('div');
    el.className = 'world-bubble';
    el.textContent = text;
    const obj = new CSS2DObject(el);
    obj.position.set(0.2, 2.45, 0);
    entry.group.add(obj);
    entry.bubble = obj;
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
    return new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.28, 0.28), materials);
  }

  showDice(seatIndex, values) {
    this._removeDice(seatIndex);
    const angle = (seatIndex / SEAT_COUNT) * Math.PI * 2 - Math.PI / 2;
    const group = new THREE.Group();
    values.forEach((v, i) => {
      const die = this._makeDie(v);
      die.position.set((i - 2) * 0.32, 0, 0);
      group.add(die);
    });
    group.position.set(Math.cos(angle) * DICE_RADIUS, 1.28, Math.sin(angle) * DICE_RADIUS);
    group.rotation.y = -angle;
    this.scene.add(group);
    this.diceGroups.set(seatIndex, group);
    this._playDiceRoll(group, angle);
  }

  _playDiceRoll(group, angle) {
    const startY = 3.2;
    const targetY = 1.28;
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
    if (!g) return;
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

  resize() {
    const width = this.container.clientWidth || window.innerWidth;
    const height = this.container.clientHeight || window.innerHeight;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
    this.labelRenderer.setSize(width, height);
  }

  _loop() {
    requestAnimationFrame(() => this._loop());
    const dt = this._clock.getDelta();
    const t = this._clock.getElapsedTime();

    const local = this.seats.get(this.localSeat);
    if (local && (Math.abs(this._walk.x) > 0.12 || Math.abs(this._walk.y) > 0.12)) {
      const camDir = new THREE.Vector3();
      this.camera.getWorldDirection(camDir);
      camDir.y = 0;
      camDir.normalize();
      const right = new THREE.Vector3().crossVectors(camDir, new THREE.Vector3(0, 1, 0)).normalize();
      local.group.position.addScaledVector(right, this._walk.x * 3.2 * dt);
      local.group.position.addScaledVector(camDir, -this._walk.y * 3.2 * dt);
      const p = local.group.position;
      const r = Math.hypot(p.x, p.z);
      if (r < 2.5) {
        p.x *= 2.5 / r;
        p.z *= 2.5 / r;
      }
      if (r > 8) {
        p.x *= 8 / r;
        p.z *= 8 / r;
      }
      p.y = 0.62;
      local.group.lookAt(p.x + this._walk.x, 0.62, p.z - this._walk.y);
    }

    for (const entry of this.seats.values()) {
      const sway = entry.drunkLevel * 0.06;
      entry.group.rotation.z = Math.sin(t * 2) * 0.02 + Math.sin(t * 3.1) * sway;
    }
    this.renderer.render(this.scene, this.camera);
    this.labelRenderer.render(this.scene, this.camera);
  }
}

import * as THREE from 'three';
import { createChibi } from '/js/engine/chibi.js';
import { buildTavern } from '/js/engine/tavern.js';
import { toonGradient } from '/js/engine/textures.js';

export class StudioScene {
  constructor(container, { tavern = true, cameraZ = 4.2 } = {}) {
    this.container = container;
    toonGradient();
    const width = container.clientWidth || 400;
    const height = container.clientHeight || 400;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x1a100a);
    this.scene.fog = new THREE.FogExp2(0x1a100a, tavern ? 0.04 : 0.02);

    this.camera = new THREE.PerspectiveCamera(32, width / height, 0.1, 60);
    this.camera.position.set(0, tavern ? 2.4 : 1.7, cameraZ);
    this.camera.lookAt(0, tavern ? 1.2 : 1.3, 0);

    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(this.renderer.domElement);

    this.scene.add(new THREE.AmbientLight(0xffe0b8, 0.7));
    const key = new THREE.DirectionalLight(0xffd27a, 1.1);
    key.position.set(3, 6, 4);
    this.scene.add(key);
    this.scene.add(new THREE.PointLight(0xff9a3d, 1.2, 12).translateY(3));

    if (tavern) buildTavern(this.scene);

    this.hero = createChibi({ characterId: 'rabbit', hair: 'short', eyes: 'smile', faceShape: 'round' });
    this.hero.position.set(0, tavern ? 0.62 : 0, tavern ? 2.2 : 0);
    this.scene.add(this.hero);

    this._clock = new THREE.Clock();
    this._alive = true;
    this._loop();
    window.addEventListener('resize', () => this.resize());
  }

  setAppearance(appearance) {
    const pos = this.hero.position.clone();
    this.scene.remove(this.hero);
    this.hero = createChibi(appearance);
    this.hero.position.copy(this._heroPos || pos);
    this.scene.add(this.hero);
  }

  placeHero(x, y, z) {
    this._heroPos = new THREE.Vector3(x, y, z);
    this.hero.position.copy(this._heroPos);
  }

  resize() {
    const width = this.container.clientWidth || 400;
    const height = this.container.clientHeight || 400;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }

  _loop() {
    if (!this._alive) return;
    requestAnimationFrame(() => this._loop());
    const t = this._clock.getElapsedTime();
    if (this.hero) this.hero.rotation.y = Math.sin(t * 0.6) * 0.35;
    this.renderer.render(this.scene, this.camera);
  }

  dispose() {
    this._alive = false;
    this.renderer.dispose();
  }
}

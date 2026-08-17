import * as THREE from 'three';
import { toonMat } from '/js/engine/textures.js';
import { bodyOf, hairOf } from '/js/engine/catalog.js';

function add(parent, geo, mat, x, y, z, rx = 0, ry = 0, rz = 0) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.rotation.set(rx, ry, rz);
  m.castShadow = true;
  parent.add(m);
  return m;
}

function makeHair(style, color) {
  const g = new THREE.Group();
  const mat = toonMat(color);
  if (style === 'cap') {
    add(g, new THREE.SphereGeometry(0.48, 16, 12, 0, Math.PI * 2, 0, Math.PI / 2), mat, 0, 0.08, 0);
    add(g, new THREE.CylinderGeometry(0.52, 0.52, 0.06, 16), mat, 0, 0.04, 0.28, Math.PI / 2, 0, 0);
    return g;
  }
  if (style === 'spiky') {
    for (let i = 0; i < 7; i++) {
      const spike = add(g, new THREE.ConeGeometry(0.12, 0.38, 6), mat, Math.sin(i) * 0.22, 0.38, Math.cos(i) * 0.18);
      spike.rotation.x = -0.4;
    }
    add(g, new THREE.SphereGeometry(0.44, 16, 12, 0, Math.PI * 2, 0, 1.2), mat, 0, 0.02, 0);
    return g;
  }
  if (style === 'long') {
    add(g, new THREE.SphereGeometry(0.46, 16, 12, 0, Math.PI * 2, 0, 1.3), mat, 0, 0.06, 0);
    add(g, new THREE.CapsuleGeometry(0.18, 0.7, 6, 10), mat, 0.28, -0.2, -0.05);
    add(g, new THREE.CapsuleGeometry(0.18, 0.7, 6, 10), mat, -0.28, -0.2, -0.05);
    add(g, new THREE.CapsuleGeometry(0.22, 0.55, 6, 10), mat, 0, -0.15, -0.28);
    return g;
  }
  if (style === 'side') {
    add(g, new THREE.SphereGeometry(0.46, 16, 12, 0, Math.PI * 2, 0, 1.15), mat, 0, 0.08, 0);
    add(g, new THREE.SphereGeometry(0.2, 10, 8), mat, 0.28, 0.12, 0.12);
    return g;
  }
  add(g, new THREE.SphereGeometry(0.47, 16, 12, 0, Math.PI * 2, 0, 1.2), mat, 0, 0.04, 0);
  add(g, new THREE.SphereGeometry(0.16, 10, 8), mat, 0, 0.28, 0.18);
  return g;
}

function makeEyes(head, kind) {
  const white = toonMat(0xfff7ea);
  const iris = toonMat(0x1a120c);
  const hl = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const scale = kind === 'derp' ? 1.35 : kind === 'cool' ? 0.7 : 1;
  const y = kind === 'cool' ? 0.08 : 0.1;
  [[-0.16, 0.16], [0.16, 0.16]].forEach(([x, z]) => {
    const eye = add(head, new THREE.SphereGeometry(0.09, 12, 12), white, x, y, z);
    eye.scale.set(1, kind === 'cool' ? 0.45 : 1, 0.6);
    eye.scale.multiplyScalar(scale);
    const ball = add(head, new THREE.SphereGeometry(0.045, 10, 10), iris, x, y, z + 0.055);
    ball.scale.setScalar(kind === 'cool' ? 0.7 : 1);
    add(head, new THREE.SphereGeometry(0.018, 8, 8), hl, x - 0.02, y + 0.03, z + 0.08);
  });
  if (kind === 'lash') {
    const lash = toonMat(0x111111);
    add(head, new THREE.BoxGeometry(0.16, 0.02, 0.02), lash, -0.16, y + 0.1, 0.18, 0, 0, 0.2);
    add(head, new THREE.BoxGeometry(0.16, 0.02, 0.02), lash, 0.16, y + 0.1, 0.18, 0, 0, -0.2);
  }
}

export function createChibi(appearance = {}) {
  const body = bodyOf(appearance.characterId);
  const hair = hairOf(appearance.hair || appearance.accessory);
  const eyes = appearance.eyes || appearance.face || 'smile';
  const shape = appearance.faceShape || 'round';
  const skin = toonMat(body.skin);
  const cloth = toonMat(body.color);
  const dark = toonMat(0x2a211c);

  const root = new THREE.Group();
  const hip = new THREE.Group();
  hip.position.y = 0.55;
  root.add(hip);

  add(hip, new THREE.CapsuleGeometry(0.12, 0.28, 6, 10), dark, -0.16, -0.35, 0);
  add(hip, new THREE.CapsuleGeometry(0.12, 0.28, 6, 10), dark, 0.16, -0.35, 0);
  add(hip, new THREE.SphereGeometry(0.16, 12, 12), dark, -0.16, -0.55, 0.04);
  add(hip, new THREE.SphereGeometry(0.16, 12, 12), dark, 0.16, -0.55, 0.04);

  const torso = add(hip, new THREE.CapsuleGeometry(0.38, 0.55, 8, 14), cloth, 0, 0.35, 0);
  add(hip, new THREE.SphereGeometry(0.4, 14, 12, 0, Math.PI * 2, 0, 1.2), cloth, 0, 0.55, 0);

  const armL = new THREE.Group();
  armL.position.set(-0.48, 0.55, 0);
  hip.add(armL);
  add(armL, new THREE.CapsuleGeometry(0.1, 0.42, 6, 10), cloth, 0, -0.22, 0);
  add(armL, new THREE.SphereGeometry(0.11, 10, 10), skin, 0, -0.48, 0.04);

  const armR = new THREE.Group();
  armR.position.set(0.48, 0.55, 0);
  hip.add(armR);
  add(armR, new THREE.CapsuleGeometry(0.1, 0.42, 6, 10), cloth, 0, -0.22, 0);

  const cup = new THREE.Group();
  const glass = new THREE.Mesh(
    new THREE.CylinderGeometry(0.11, 0.09, 0.28, 16),
    new THREE.MeshPhysicalMaterial({ color: 0xe8f4ff, transparent: true, opacity: 0.45, roughness: 0.1 })
  );
  cup.add(glass);
  const beer = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.075, 0.16, 12), toonMat(0xf0c14a));
  beer.position.y = -0.02;
  cup.add(beer);
  cup.position.set(0.08, -0.42, 0.16);
  armR.add(cup);

  const headGroup = new THREE.Group();
  headGroup.position.set(0, 1.18, 0);
  hip.add(headGroup);

  let headGeo = new THREE.SphereGeometry(0.48, 22, 18);
  const head = new THREE.Mesh(headGeo, skin);
  if (shape === 'oval') head.scale.set(0.9, 1.12, 0.95);
  if (shape === 'square') head.scale.set(1.05, 0.92, 1);
  head.castShadow = true;
  headGroup.add(head);

  makeEyes(headGroup, eyes);

  const brow = toonMat(0x2a211c);
  add(headGroup, new THREE.CapsuleGeometry(0.02, 0.12, 4, 6), brow, -0.16, 0.22, 0.4, 0, 0, 0.15);
  add(headGroup, new THREE.CapsuleGeometry(0.02, 0.12, 4, 6), brow, 0.16, 0.22, 0.4, 0, 0, -0.15);

  const mouth = new THREE.Mesh(
    eyes === 'cool'
      ? new THREE.BoxGeometry(0.16, 0.025, 0.03)
      : new THREE.TorusGeometry(0.1, 0.025, 8, 12, Math.PI),
    toonMat(0xc45c5c)
  );
  if (eyes !== 'cool') mouth.rotation.z = Math.PI;
  mouth.position.set(0, eyes === 'cool' ? -0.12 : -0.08, 0.42);
  headGroup.add(mouth);

  const hairMesh = makeHair(hair.id === 'none' ? 'short' : hair.id, hair.color);
  hairMesh.position.y = 0.12;
  headGroup.add(hairMesh);

  root.userData = {
    bodyMat: cloth,
    headGroup,
    cup,
    cupStart: cup.position.clone(),
    hip,
    armR,
  };
  return root;
}

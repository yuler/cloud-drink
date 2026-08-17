import * as THREE from 'three';
import { woodTexture, plasterTexture, toonMat } from '/js/engine/textures.js';

export const SEAT_COUNT = 6;
export const TABLE_RADIUS = 2.15;
export const SEAT_RADIUS = 3.35;
export const DICE_RADIUS = 1.65;

export function seatPosition(index) {
  const angle = (index / SEAT_COUNT) * Math.PI * 2 - Math.PI / 2;
  return new THREE.Vector3(Math.cos(angle) * SEAT_RADIUS, 0, Math.sin(angle) * SEAT_RADIUS);
}

export function buildTavern(scene) {
  const wood = woodTexture();
  const plaster = plasterTexture();
  const floorMat = new THREE.MeshStandardMaterial({ map: wood, roughness: 0.85, metalness: 0.02 });
  const wallMat = new THREE.MeshStandardMaterial({ map: plaster, roughness: 0.9, color: 0x3a2418 });
  const darkWood = toonMat(0x4a2c18);

  const floor = new THREE.Mesh(new THREE.BoxGeometry(22, 0.2, 18), floorMat);
  floor.position.y = -0.1;
  floor.receiveShadow = true;
  scene.add(floor);

  const wall = (w, h, d, x, y, z) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), wallMat);
    m.position.set(x, y, z);
    m.receiveShadow = true;
    scene.add(m);
    return m;
  };
  wall(22, 7, 0.4, 0, 3.4, -8.8);
  wall(0.4, 7, 18, -10.8, 3.4, 0);
  wall(0.4, 7, 18, 10.8, 3.4, 0);

  const bar = new THREE.Mesh(new THREE.BoxGeometry(10, 1.1, 1.4), darkWood);
  bar.position.set(0, 0.55, -7.4);
  bar.castShadow = true;
  scene.add(bar);
  const barTop = new THREE.Mesh(new THREE.BoxGeometry(10.3, 0.12, 1.7), toonMat(0x6b4226));
  barTop.position.set(0, 1.16, -7.4);
  scene.add(barTop);

  for (let i = -4; i <= 4; i++) {
    const bottle = new THREE.Mesh(
      new THREE.CylinderGeometry(0.08, 0.1, 0.55, 8),
      toonMat(i % 2 ? 0x8b1e3f : 0x2e5a3c)
    );
    bottle.position.set(i * 0.7, 1.55, -7.55);
    scene.add(bottle);
  }

  const beamMat = toonMat(0x3a2214);
  for (let i = -3; i <= 3; i++) {
    const beam = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.28, 16), beamMat);
    beam.position.set(i * 2.4, 6.6, 0);
    scene.add(beam);
  }

  [[-5, -4], [5, -4], [-6, 4], [6, 4]].forEach(([x, z]) => {
    const lamp = new THREE.PointLight(0xffb347, 1.1, 10);
    lamp.position.set(x, 4.4, z);
    scene.add(lamp);
    const shade = new THREE.Mesh(new THREE.ConeGeometry(0.35, 0.4, 12), toonMat(0xc45c2a));
    shade.position.set(x, 4.2, z);
    scene.add(shade);
  });

  const tableMat = new THREE.MeshStandardMaterial({ map: woodTexture('#8a5530', '#4a2a14'), roughness: 0.7 });
  const top = new THREE.Mesh(new THREE.CylinderGeometry(TABLE_RADIUS, TABLE_RADIUS, 0.16, 48), tableMat);
  top.position.y = 0.92;
  top.castShadow = true;
  top.receiveShadow = true;
  scene.add(top);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(TABLE_RADIUS, 0.06, 8, 48), toonMat(0x3d2414));
  rim.rotation.x = Math.PI / 2;
  rim.position.y = 1.0;
  scene.add(rim);
  const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.32, 0.92, 12), darkWood);
  leg.position.y = 0.46;
  scene.add(leg);

  for (let i = 0; i < SEAT_COUNT; i++) {
    const pos = seatPosition(i);
    const chair = new THREE.Group();
    const seat = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.12, 0.7), darkWood);
    seat.position.y = 0.55;
    chair.add(seat);
    const back = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.7, 0.1), darkWood);
    back.position.set(0, 0.95, -0.3);
    chair.add(back);
    const cl = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.55, 8), darkWood);
    cl.position.set(-0.25, 0.28, -0.25);
    chair.add(cl);
    chair.add(cl.clone().translateX(0.5));
    chair.position.copy(pos);
    chair.lookAt(0, 0.55, 0);
    scene.add(chair);

    const cup = new THREE.Mesh(
      new THREE.CylinderGeometry(0.22, 0.24, 0.28, 16),
      toonMat(0xc4a574)
    );
    const a = (i / SEAT_COUNT) * Math.PI * 2 - Math.PI / 2;
    cup.position.set(Math.cos(a) * DICE_RADIUS, 1.12, Math.sin(a) * DICE_RADIUS);
    scene.add(cup);
  }

  const rug = new THREE.Mesh(
    new THREE.CircleGeometry(5.2, 48),
    new THREE.MeshStandardMaterial({ color: 0x5a1e1e, roughness: 1 })
  );
  rug.rotation.x = -Math.PI / 2;
  rug.position.y = 0.01;
  scene.add(rug);
}

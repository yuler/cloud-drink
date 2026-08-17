import * as THREE from 'three';

export function toonGradient() {
  const c = document.createElement('canvas');
  c.width = 4;
  c.height = 1;
  const ctx = c.getContext('2d');
  const cols = ['#3a2a1c', '#7a5a38', '#c4a06a', '#ffe9c4'];
  cols.forEach((col, i) => {
    ctx.fillStyle = col;
    ctx.fillRect(i, 0, 1, 1);
  });
  const tex = new THREE.CanvasTexture(c);
  tex.minFilter = THREE.NearestFilter;
  tex.magFilter = THREE.NearestFilter;
  return tex;
}

export function woodTexture(base = '#6b3f24', streak = '#3d2214') {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 256;
  const ctx = c.getContext('2d');
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 28; i++) {
    ctx.strokeStyle = streak;
    ctx.globalAlpha = 0.12 + (i % 5) * 0.03;
    ctx.lineWidth = 2 + (i % 3);
    ctx.beginPath();
    const y = i * 9 + 4;
    ctx.moveTo(0, y);
    ctx.bezierCurveTo(70, y + 6, 170, y - 6, 256, y + 2);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(4, 4);
  return tex;
}

export function plasterTexture() {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 128;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#2a1c14';
  ctx.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 80; i++) {
    ctx.fillStyle = `rgba(0,0,0,${Math.random() * 0.12})`;
    ctx.fillRect(Math.random() * 128, Math.random() * 128, 3, 3);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(6, 3);
  return tex;
}

let _toon;
export function toonMat(color, gradient) {
  if (!_toon) _toon = gradient || toonGradient();
  return new THREE.MeshToonMaterial({ color, gradientMap: _toon });
}

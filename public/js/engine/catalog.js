export const BODIES = [
  { id: 'fox', name: '暖橙卫衣', color: '#e67e22', img: '/assets/char-fox.png' },
  { id: 'cat', name: '明黄外套', color: '#f5c542', img: '/assets/char-cat.png' },
  { id: 'bear', name: '棕褐夹克', color: '#8d5a3b', img: '/assets/char-bear.png' },
  { id: 'panda', name: '深灰卫衣', color: '#3d3d44', img: '/assets/char-panda.png' },
  { id: 'rabbit', name: '米白卫衣', color: '#efe6d8', img: '/assets/char-rabbit.png' },
  { id: 'frog', name: '青绿外套', color: '#3d9b6e', img: '/assets/char-frog.png' },
];

export const HAIRS = [
  { id: 'short', name: '短发', thumb: '/assets/hair-short.png' },
  { id: 'side', name: '分缝', thumb: '/assets/hair-side.png' },
  { id: 'spiky', name: '刺头', thumb: '/assets/hair-spiky.png' },
  { id: 'long', name: '长发', thumb: '/assets/hair-long.png' },
  { id: 'blonde', name: '金发', thumb: '/assets/hair-blonde.png' },
  { id: 'cap', name: '帽子', thumb: '/assets/hair-cap.png' },
];

export const EYES = [
  { id: 'smile', name: '圆眼', thumb: '/assets/eye-smile.png' },
  { id: 'cool', name: '细眼', thumb: '/assets/eye-cool.png' },
  { id: 'derp', name: '大眼', thumb: '/assets/eye-derp.png' },
  { id: 'lash', name: '长睫', thumb: '/assets/eye-lash.png' },
];

export const FACE_SHAPES = [
  { id: 'round', name: '圆脸', thumb: '/assets/face-round.png' },
  { id: 'oval', name: '鹅蛋', thumb: '/assets/face-oval.png' },
  { id: 'square', name: '方脸', thumb: '/assets/face-square.png' },
];

export function bodyOf(id) {
  return BODIES.find((x) => x.id === id) || BODIES[0];
}

export function hairOf(id) {
  return HAIRS.find((x) => x.id === id) || HAIRS[0];
}

export const SEAT_LAYOUT = [
  { left: '50%', top: '78%' },
  { left: '24%', top: '62%' },
  { left: '76%', top: '62%' },
  { left: '18%', top: '40%' },
  { left: '82%', top: '40%' },
  { left: '50%', top: '30%' },
];

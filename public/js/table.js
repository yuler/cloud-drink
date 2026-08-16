import { TableScene } from '/js/scene.js';

const scene = new TableScene(document.getElementById('scene'));

const DEMO = ['fox', 'cat', 'bear', 'panda', 'rabbit', 'frog'];

for (let i = 0; i < DEMO.length; i++) {
  scene.addPlayer(i, { characterId: DEMO[i] });
}

let seat = 0;
setInterval(() => {
  scene.playDrink(seat);
  scene.playToast(seat);
  scene.setDrunkLevel(seat, seat + 1);
  scene.showDice(seat, [1, 3, 5, 2, 6]);
  seat = (seat + 1) % DEMO.length;
}, 2500);

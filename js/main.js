import { World } from './World.js';

const world = new World();
world.init();

// Animate loop
function loop() {
  requestAnimationFrame(loop);

  world.update();
  world.render();
}

loop();
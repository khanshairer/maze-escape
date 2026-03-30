import { World } from './World.js';
import { Game } from './gameLogic/game.js';

const world = new World();
world.init();
const game = new Game(world);

// Animate loop
function loop() {
  requestAnimationFrame(loop);
  
  game.update();
  world.update();
  world.render();
}

loop();
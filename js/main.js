import { World } from './World.js';
import { Game } from './gameLogic/game.js';

const world = new World();
world.init();
const game = new Game(world);

// Animate loop
function loop() {
  requestAnimationFrame(loop); // Schedule the next frame
  
  game.update(); // Update game logic, including collision checks and win condition checks
  world.update(); // Update the world state, including player and enemy movements
  world.render(); // Render the current state of the world to the screen
}

loop(); // Start the animation loop
/*
  Purpose: The Game class manages the overall game state, including win and loss conditions, and handles game logic updates.
  It checks for collisions between the player and enemies, determines when the player has won by reaching the exit, 
  and provides methods for restarting the game. The class also includes a method for displaying UI overlays when the game is over or won.
  
  Parameters: The constructor takes a world object that contains the game world and its entities. 
  The class has methods for checking collisions, checking win conditions, handling game over and game won scenarios, showing UI overlays, 
  restarting the game, and updating the game state on each frame.

  */
export class Game {

  constructor(world) {
    
    this.world = world;
    this.isGameOver = false;
    this.isGameWon = false;

    // listen for restart key
    window.addEventListener('keydown', (e) => {
      
      if (e.key.toLowerCase() === 'r' && (this.isGameOver || this.isGameWon)) {
        
        this.restart();
      
      }
    });
  }

  // check collision between player and attackers
  /*
  Purpose: checkCollision is a method that checks for collisions between the player and various types of enemies in the game.
  It iterates through the ground attackers, drones, and dungeon guard to determine if the player is within a certain distance of any of 
  these enemies.
  
  */
  checkCollision() {
  
    if (this.isGameOver || this.isGameWon) return;

  const player = this.world.main_character;
  const attackers = this.world.ground_attackers;
  const drones = this.world.drones;
  const dungeonGuard = this.world.dungeonGuard;

  if (!player) return;

  if (attackers) {
    
    for (let npc of attackers) {
      
      const distance = player.position.distanceTo(npc.position);

      if (distance < 1.5) {
        
        this.gameOver();
        return;
      
      }
    }
  }

  if (drones) {
    
    for (let npc of drones) {
      
      if (npc.respawnTimer > 0 || !npc.mesh.visible) {
       
        continue;
      
      }

      const currentStateName = npc.fsm?.state?.constructor?.name;

      // only dangerous in Fight / Attack / Chase state
      const isDangerous =
        currentStateName === "FightState" ||
        currentStateName === "AttackState" ||
        currentStateName === "ChaseState";

      if (!isDangerous) {
       
        continue;
      
      }

      const distance = player.position.distanceTo(npc.position);

      if (distance < 1.5) {
        
        this.gameOver();
        return;
      
      }
    }
  }

  if (dungeonGuard) {
    
    const distance = player.position.distanceTo(dungeonGuard.position);
    const catchRadius = dungeonGuard.catchRadius ?? 1.5;

    if (distance < catchRadius) {
      
      this.gameOver();
      return;
    
    }
  }
}

/*
Purpose: checkWinCondition is a method that checks if the player has met the conditions to win the game.
It checks if the player is at the unlocked controller exit, and if so, it calls the gameWon method to handle the win scenario.

*/
  checkWinCondition() {
    if (this.isGameOver || this.isGameWon) return;

    if (this.world.isPlayerAtUnlockedControllerExit()) {
      
      this.gameWon();
    
    }
  }

  // GAME OVER
  /*
Purpose: gameOver is a method that is called when the player loses the game. It sets the game over state, stops all movement of the player 
and enemies, and displays a "GAME OVER" overlay on the screen with instructions to restart the game.
  

*/
  gameOver() {
    
    if (this.isGameOver || this.isGameWon) return;

    this.isGameOver = true;

    // stop player
    if (this.world.main_character) {
      
      this.world.main_character.velocity.set(0, 0, 0);
    
    }

    // stop attackers
    for (let npc of this.world.ground_attackers) {
      
      npc.velocity.set(0, 0, 0);
    
    }

    for (let npc of this.world.drones) {
      
      npc.velocity.set(0, 0, 0);
    
    }

    // stop ALL updates
    this.world.isGameOver = true;

    // UI
    this.showOverlay("GAME OVER\nPress R to Restart", "red");
  }

  // GAME WON
  /*

  Purpose: gameWon is a method that is called when the player wins the game. It sets the game won state, stops all movement of the player 
and enemies, and displays a "CONTROLLER ROOM SECURED\nYOU ESCAPED" overlay on the screen with instructions to restart the game.

*/
  gameWon() {
    
    if (this.isGameOver || this.isGameWon) return;

    this.isGameWon = true;
    this.world.controllerExitReached = true;

    if (this.world.main_character) {

      this.world.main_character.velocity.set(0, 0, 0);
    
    }

    for (let npc of this.world.ground_attackers) {
      
      npc.velocity.set(0, 0, 0);
    
    }

    for (let npc of this.world.drones) {
      
      npc.velocity.set(0, 0, 0);
    
    }

    this.world.isGameOver = true;
    this.showOverlay("CONTROLLER ROOM SECURED\nYOU ESCAPED\nPress R to Restart", "#33ff99");
  
  }

  // UI overlay
  /*
  Purpose: showOverlay is a method that creates and displays a UI overlay on the screen with a given message and color.
  It creates a div element, sets its text and styling properties, and appends it to the document body to display the overlay.
  Parameters: message - the text to be displayed in the overlay, color - the color of the text in the overlay.
  */
  showOverlay(message, color) {
    
    this.overlay = document.createElement("div");
    this.overlay.innerText = message;
    this.overlay.style.position = "absolute";
    this.overlay.style.top = "50%";
    this.overlay.style.left = "50%";
    this.overlay.style.transform = "translate(-50%, -50%)";
    this.overlay.style.fontSize = "40px";
    this.overlay.style.color = color;
    this.overlay.style.textAlign = "center";
    document.body.appendChild(this.overlay);
  
  }

  // RESTART GAME
  restart() {


  if (this.overlay) {
    
    document.body.removeChild(this.overlay);
    this.overlay = null;
  
  }

  this.isGameOver = false;
  this.isGameWon = false;
  this.world.isGameOver = false;

  this.world.reset();
  this.world.init();

}

  // called every frame
  update() {
    
    if (this.isGameOver || this.isGameWon) return;

    this.checkCollision();
    this.checkWinCondition();
  
  }

}

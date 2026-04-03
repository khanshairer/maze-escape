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

  checkWinCondition() {
    if (this.isGameOver || this.isGameWon) return;

    if (this.world.isPlayerAtUnlockedControllerExit()) {
      this.gameWon();
    }
  }

  // GAME OVER
  gameOver() {
    if (this.isGameOver || this.isGameWon) return;

    this.isGameOver = true;
    console.log("GAME OVER");

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

  gameWon() {
    if (this.isGameOver || this.isGameWon) return;

    this.isGameWon = true;
    this.world.controllerExitReached = true;
    console.log("YOU WIN");

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
  console.log("RESTARTING...");

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

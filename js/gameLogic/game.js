export class Game {

  constructor(world) {
    this.world = world;
    this.isGameOver = false;

    // listen for restart key
    window.addEventListener('keydown', (e) => {
      if (e.key.toLowerCase() === 'r' && this.isGameOver) {
        this.restart();
      }
    });
  }

  // check collision between player and attackers
  checkCollision() {
  if (this.isGameOver) return;

  const player = this.world.main_character;
  const attackers = this.world.ground_attackers;
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

  if (dungeonGuard) {
    const distance = player.position.distanceTo(dungeonGuard.position);
    const catchRadius = dungeonGuard.catchRadius ?? 1.5;

    if (distance < catchRadius) {
      this.gameOver();
      return;
    }
  }
}

  // GAME OVER
  gameOver() {
    if (this.isGameOver) return;

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

    // stop ALL updates
    this.world.isGameOver = true;

    // UI
    this.showGameOverUI();
  }

  // UI overlay
  showGameOverUI() {
    this.overlay = document.createElement("div");
    this.overlay.innerText = "GAME OVER\nPress R to Restart";
    this.overlay.style.position = "absolute";
    this.overlay.style.top = "50%";
    this.overlay.style.left = "50%";
    this.overlay.style.transform = "translate(-50%, -50%)";
    this.overlay.style.fontSize = "40px";
    this.overlay.style.color = "red";
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
  this.world.isGameOver = false;

  this.world.reset();
  this.world.init();
}

  // called every frame
  update() {
    if (this.isGameOver) return;

    this.checkCollision();
  }
}
export class WorldResetManager {
  constructor(world) {
    this.world = world;
  }

  // restart
  /*
  *purpose: reset the game state to its initial conditions by clearing all entities from the scene, resetting all game variables to their default values, 
   and preparing the world for a new playthrough. 
  *This function is called when the player chooses to restart the game after a game over, and ensures that all previous state is cleared and the game can start fresh.
  *@returns null
  */ 
  reset() {
    
    while (this.world.scene.children.length > 0) {

      this.world.scene.remove(this.world.scene.children[0]);
    }

    this.world.entities = [];
    this.world.ground_attackers = [];
    this.world.goals = [];
    this.world.npcs = [];
    this.world.drones = [];
    this.world.energyCells = [];
    this.world.mixers = [];
    this.world.collectedEnergyCells = 0;
    this.world.totalEnergyCells = 0;
    this.world.energyCellsRequiredForUnlock = 0;
    this.world.controllerExit = null;
    this.world.controllerExitTile = null;
    this.world.controllerExitUnlocked = false;
    this.world.controllerExitReached = false;

    this.world.main_character = null;
    this.world.groundVectorPathFinding = null;
    this.world.droneHierarchicalPathfinder = null;
    this.world.mazeGroup1 = null;
    this.world.mazeGroup2 = null;
    this.world.hallwayMesh = null;
    this.world.loadingSprite = null;
    this.world.hallwayBounds = null;

    this.world.dungeonGroup = null;
    this.world.dungeonRenderer = null;
    this.world.dungeonGuard = null;
    this.world.dungeonPatrolTiles = [];
    this.world.dungeonPatrolPath = [];
    this.world.dungeonPatrolLine = null;
    this.world.dungeonMap = null;
    this.world.hallwayMesh2 = null;
    this.world.hallwayBounds2 = null;
    this.world.dungeonOffset = null;
  }
}
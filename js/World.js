import * as THREE from 'three'; // for general 3D rendering and math utilities
import * as Setup from './setup.js'; // for setting up the scene, camera, renderer, and lighting
import { InputHandler } from './input/InputHandler.js'; // for handling player input(main character movement) and interactions with the world
import { DebugVisuals } from './debug/DebugVisuals.js'; // for deugging purposes..
import { ControllerExitManager } from './gameLogic/ControllerExitManager.js';
import { WorldInitializer } from './gameLogic/WorldInitializerManager.js';
import { WorldCollisionManager } from './gameLogic/WorldCollisionManager.js';
import { WorldResetManager } from './gameLogic/WorldResetManager.js'; 
import { WorldUpdateManager } from './gameLogic/WorldUpdateManager.js';
/**
 * World class holds all information about our game's world
 */

export class World {

  // Creates a world instance
  constructor() {

    this.scene = Setup.createScene();
    this.camera = Setup.createCamera();
    this.renderer = Setup.createRenderer();
    this.clock = new THREE.Clock();
    this.inputHandler = new InputHandler(this.camera);
    this.entities = [];
    // manager
    this.WorldResetManager = new WorldResetManager(this);
    this.worldCollisionManager = new WorldCollisionManager(this);
    this.WorldUpdateManager = new WorldUpdateManager(this);
    // added ................
    this.droneRespawnDelay = 0.8;
    this.controllerExitManager = new ControllerExitManager(this);
    this.goals = []; // store goals entities for easy access
    this.npcs = []; // store npc entities for easy access
    this.mixers = []; // store animation mixers for updating in the main loop ..for animation purposes
    this.ground_attackers = []; // store ground attacker entities for easy access and pathfinding updates in maze 1
    this.energyCells = []; // store energy cell entities for easy access and unlock logic...
    this.drones = []; // store drone entities for easy access and updates in maze 2
    this.collectedEnergyCells = 0; // track how many energy cells the player has collected for gameplay and unlocking the controller exit in the dungeon
    this.totalEnergyCells = 0; // track total energy cells in the world to determine unlock requirements for the controller exit in the dungeon
    this.unlockRequirementFraction = 0.8; // fraction of energy cells required to unlock the controller exit like 80% of total energy cells in the world 
    this.energyCellsRequiredForUnlock = 0; // calculated number of energy cells required to unlock the controller exit in the dungeon based on total energy cells
    this.energyCellCollectionRadius = 1.5; // radius within which the player can collect energy cells in the world
    this.controllerExit = null; // reference to the controller exit object in the dungeon that gets unlocked when enough energy cells are collected 
    this.controllerExitTile = null; // reference to the tile in the dungeon where the controller exit is located for distance checks and unlocking logic
    this.controllerExitUnlocked = false; // boolean flag to track whether the controller exit in the dungeon is unlocked based on energy cell collection and determines if the player can win by reaching it
    this.controllerExitReached = false; // boolean flag to track whether the player has reached the controller exit in the dungeon after it is unlocked to trigger win condition and end the game
    this.controllerExitActivationRadius = 1.8; // radius within which the player can activate the controller exit in the dungeon to win the game after it is unlocked
    this.groundAttackerRespawnDelay = 4; // when ground attackers in maze 1 reach the door , it disappears for a few seconds and then respawns at a random walkable tile in maze 1 to keep up the pressure on the player and create dynamic gameplay
    this.droneClusterSize = 5; // cluster size for hierarchical pathfinding for drones in maze 2 to optimize their pathfinding performance while still providing challenging and intelligent movement as they navigate the larger and more complex maze 2 to chase the player and create engaging gamepla

    // Main character animation mixer and actions
    this.mainCharacterMixer = null;   // AnimationMixer for the main character model
    this.mainCharacterActions = {};   // stores AnimationAction objects by index/name
    this.currentMainAction = null;    // currently playing action

    // Movement speed (units per second)
    this.moveSpeed = 7.0; // Adjust as needed for gameplay feel
    // Steering force limit
    this.maxForce = 10.0; // Adjust as needed for responsive steering behavior

    // Add loading tracking
    this.modelsLoading = 0; // total number of models we are loading (incremented when we start loading a model)
    this.modelsLoaded = 0; // number of models that have finished loading (incremented in the onLoad callback of each model loader)
    this.loadingComplete = false; // boolean flag to track if all models have finished loading and we can hide the loading indicator and start the game

    // main character jump functionality variables
     this.jumpVelocity = 0;
     this.gravity = 18;
     this.jumpStrength = 11;
     this.isJumping = false;
     this.groundY = 0;

    // hallway proxy map (free movement inside hallway)
    this.hallwayMap = {
      handleCollisions: (entity) => entity.position.clone()
    };

    // debug visuals for vector pathfinding
    this.debugVisuals = new DebugVisuals(this.scene); // to see the arrows.

    // ========== ADDED missing property initializations ==========
    this.mainCharacterManager = null;      // set by WorldInitializer
    this.dungeonGuardManager = null;       // set by WorldInitializer
    this.groundAttackerManager = null;     // set by WorldInitializer
    this.droneManager = null;              // set by WorldInitializer
    this.energyCellManager = null;         // set by WorldInitializer
    this.map = null;                       // set by WorldInitializer (tile map)
    this.isGameOver = false;               // game state flag
    this.dungeonGuard = null;              // reference to dungeon guard entity
    this.dungeonOffset = { x: 0, z: 0 };   // used in clampPositionToDungeon
    this.dungeonMap = null;                // used for dungeon bounds
    // Dummy loading indicator manager to avoid errors if not yet set
    this.loadingIndicatorManager = {
      updateLoadingIndicator: () => {}
    };
    // ============================================================
  }

  // Initialize objects in our world
  /*
  Purpose : init is a method that initializes the game world by creating the tile maps for the mazes and dungeon, setting up the lighting, 
  rendering the mazes and dungeon in the scene, creating hallway connections between the mazes and dungeon, placing the main character and other entities in the world, 
  and setting up the necessary properties and references for gameplay mechanics such as energy cell collection and controller exit unlocking. 
  This method is called to set up everything in the world before the game starts running.
  */
  init() {
    const initializer = new WorldInitializer(this);
    initializer.init();
}

/*
Purpose: isInHallway is a method that checks if a given position (THREE.Vector3) is within the bounds of either of the two hallways connecting the mazes and dungeon in the world.
Parameters: position - a THREE.Vector3 representing the current position of the entity for which we want to check if it is within the hallway bounds.
*/
//this is wrapper
isInHallway(position) {
  
  return this.worldCollisionManager.isInHallway(position);
}


/*
Purpose: getMapForPosition is a method that determines which tile map (maze 1, maze 2, or dungeon) should be used for collision detection based on the given position 
of an entity in the world.

Parameters: position - a THREE.Vector3 representing the current position of the entity for which we want to determine the appropriate tile map for collision detection.
*/
// this is a wrapper..
getMapForPosition(position) {
  return this.worldCollisionManager.getMapForPosition(position);
}

 // Update loading indicator wrapper
  updateLoadingIndicator() {
  this.loadingIndicatorManager.updateLoadingIndicator();
}

  // Add an entity to the world
  /*
  * purpose: add an entity to the game world and manage its lifecycle.
  * approach: add the entity's mesh to the scene and include it in the entities list.
  * entity -> null
  */
  addEntityToWorld(entity) {
    
    this.scene.add(entity.mesh);
    this.entities.push(entity);
  
  }

// helper function to clamp position within hallway bounds (for main character)
/**
 * Returns the appropriate map adapter for a given position
 * @param {THREE.Vector3} position
 * @returns {Object} Map adapter with handleCollisions method
 */
// this is a wrapper for the world collision manager method that determines which map adapter to usewhether the position is in the hallway 
getMapAdapterForPosition(position) {
  
  return this.getMapForPosition(position);

}

//clamp main character in dungeon 3 helper function
/*
*purpose: if the character is in the dungeon, clamp their position to be within the dungeon bounds to prevent them from escaping into the hallway 
*approach: calculate the min and max x/z values based on the dungeon's position and size, and clamp the character's position to those bounds
*@param {THREE.Vector3} position
*@returns null
*/
clampPositionToDungeon(entity) {
  this.WorldResetManager.clampPositionToDungeon(entity);
}

//helper for Update Ground Attacker
/*
*purpose: determine the best adjacent tile for a ground attacker to move to in order to escape from the main character, by maximizing the distance from the main character
*approach: get the current tile of the NPC, find all walkable neighboring tiles, and calculate the distance from each neighbor to the main character. 
*Return the position of the neighbor
*@param {DynamicEntity} npc
*@returns {THREE.Vector3|null} position of the best escape tile, or null if no valid tiles are found
*/
getEscapeTargetFromCurrentTile(npc) {
  
  const tile = this.map.quantize(npc.position);
  const neighbours = this.map.getNeighbours(tile);

  if (!neighbours || neighbours.length === 0) return null;

  let bestTile = neighbours[0];
  let bestDist = -Infinity;

  for (let n of neighbours) {
    
    const pos = this.map.localize(n);
    const dist = pos.distanceTo(this.main_character.position);
    
    if (dist > bestDist) {
      
      bestDist = dist;
      bestTile = n;
    
    }
  }

  return this.map.localize(bestTile);
}

//keep the ground attacker on the ground, prevent it from escaping to maze 2, and add wander/chase/avoid behaviours

/*
*purpose: snap an entity to the nearest walkable tile
*approach: find the tile that the entity is on, and if it's not walkable, find the nearest walkable tile and move the entity there
*@param {DynamicEntity} entity
*@returns null
*/
snapEntityToWalkableTile(entity) {
  
  let tile = this.map.quantize(entity.position);

  if (tile && tile.isWalkable()) {
    
    return;
  
  }

  let bestTile = null;
  let bestDist = Infinity;

  for (let walkable of this.map.walkableTiles) {
    
    let pos = this.map.localize(walkable);
    let dist = pos.distanceTo(entity.position);

    if (dist < bestDist) {
      
      bestDist = dist;
      bestTile = walkable;
    
    }
  }

  if (bestTile) {
    
    let safePos = this.map.localize(bestTile);
    entity.position.x = safePos.x;
    entity.position.z = safePos.z;
    entity.velocity.set(0, 0, 0);
  
  }
}

// is player on safe tile in hallway 2 helper function
/*
*purpose: determine if the main character is currently standing on a safe tile (medium terrain) in maze 2, which would allow them to avoid detection by drones. 
*This is used to implement the stealth mechanic where players can hide from drones by standing on certain tiles. 
*The function checks if the character is within the bounds of maze 2, and if so, quantizes their position to find the corresponding tile and checks its type.
*@returns {boolean} true if the player is on a safe tile, false otherwise
*/

//this is a wrapper...
isPlayerOnSafeTile() {
  return this.worldCollisionManager.isPlayerOnSafeTile();
}

// controller exit wrapper 
isPlayerAtUnlockedControllerExit() {
  return this.controllerExitManager.isPlayerAtUnlockedControllerExit();
}
// restart world wrapper 
reset() {
  this.WorldResetManager.reset();
}

  // Update our world
  /*
  *purpose: update the game state on each frame by processing player input, updating entity positions and animations, handling collisions, and managing game logic 
   such as enemy behavior and energy cell collection. 
  
   *The function first checks if the game is over and stops all animations if so. If the game is still loading, it updates any animation mixers for entities 
   that have been loaded so far. 
  
  Once loading is complete, it updates the main character's movement and animation based on player input, updates the dungeon guard's behavior, updates all entities in the world, and ensures the main character stays within the bounds of the dungeon. 
  Finally, it updates the camera to follow the main character and logs the character's position for debugging purposes.
*@returns null
*/
 // wrapper 
  update() {
    this.WorldUpdateManager.update();
}

  // Render our world
  /*
  *purpose: render the current state of the game world to the screen using the Three.js renderer. 
  *This function is called on each animation frame after the update function has processed all game logic and updated entity positions.
  *@returns null
*/
  render() {
    this.renderer.render(this.scene, this.camera);
  }
}
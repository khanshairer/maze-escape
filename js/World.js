import * as THREE from 'three'; // for general 3D rendering and math utilities
import * as Setup from './setup.js'; // for setting up the scene, camera, renderer, and lighting
import { InputHandler } from './input/InputHandler.js'; // for handling player input(main character movement) and interactions with the world
import { Tile } from './maps/Tile.js'; // for representing individual tiles in the tile maps for the mazes and dungeon
import { TileMap } from './maps/TileMap.js'; // for creating and managing the tile-based maps for the mazes and dungeon 
import { TileMapRenderer } from './renderers/TileMapRenderer.js'; // for rendering the tile maps visually in the scene
import { VectorPathFinding } from './ai/pathfinding/vectorPathFinding.js'; // for implementing vector path finding..
import { HierarchicalAStar } from './ai/pathfinding/HierarchicalAStar.js'; // for implementing hierarchical pathfinding for drones in maze 2
import { DebugVisuals } from './debug/DebugVisuals.js'; // for deugging purposes..
import { DungeonGenerator } from './pcg/DungeonGenerator.js'; // for procedurally generating the dungeon map with rooms and corridors for the third part of the world
import { GroundAttackers } from './entities/GroundAttackers.js';
import { DroneEntity } from './entities/DroneEntity.js';
import { DungeonGuard } from './entities/DungeonGuard.js';
import { MainCharacter } from './entities/MainCharacter.js';
import { EnergyCellManager } from './gameLogic/EnergyCellManager.js';
import { ControllerExitManager } from './gameLogic/ControllerExitManager.js';
import { WorldLayoutManager } from './gameLogic/WorldLayoutManager.js';


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
  }

  // Initialize objects in our world
  /*
  Purpose : init is a method that initializes the game world by creating the tile maps for the mazes and dungeon, setting up the lighting, 
  rendering the mazes and dungeon in the scene, creating hallway connections between the mazes and dungeon, placing the main character and other entities in the world, 
  and setting up the necessary properties and references for gameplay mechanics such as energy cell collection and controller exit unlocking. 
  This method is called to set up everything in the world before the game starts running.
  */
  init() {
  // loading tracking variables
  this.loadingComplete = false;
  this.modelsLoaded = 0;
  this.modelsLoading = 0;

  // world layout manager to handle the creation of the mazes, dungeon, and hallway connections between them with proper alignment and walkable paths for the player to navigate through the world and reach the controller exit in the dungeon after collecting enough energy cells
  this.worldLayoutManager = new WorldLayoutManager(this);
  
  // ----- create two mazes -----
  // Maze 1 and Maze 2 use the TileMap DFS/backtracking generator.
  // The dungeon starts from the same tile grid, then gets replaced with BSP room generation below.
  this.map = new TileMap(2); // maze 1 is generated with algorithm 2 for more complexity and longer paths
  this.map2 = new TileMap(2); // maze 2 is also generated with algorithm 2 for more complexity and longer paths
  this.dungeonMap = new TileMap(2); // dungeon map is generated with algorithm 2 for more complexity and interesting layouts, but we will heavily modify it with our own dungeon generator to create a more structured and engaging dungeon experience
  DungeonGenerator.generate(this.dungeonMap, 4); // generate a dungeon with 4 rooms using the dungeon generator
   
  //lighting the surroundings
  Setup.createLight(this.scene);
  
  //Setup.showHelpers(this.scene, this.camera, this.renderer, this.map);

  // gap between first two mazes
  this.mazeGap = 4;

  // full width of one maze in world units
  this.mapWorldWidth = this.map.cols * this.map.tileSize;

  // offset for second maze
  this.map2Offset = new THREE.Vector3(this.mapWorldWidth + this.mazeGap, 0, 0);

  // ----- create hallway connection between mazes -----
  let preferredRow = Math.floor(this.map.rows / 2);
  let row1 = this.worldLayoutManager.findClosestWalkableRow(this.map, preferredRow, 'right');
  let row2 = this.worldLayoutManager.findClosestWalkableRow(this.map2, preferredRow, 'left');

  this.connectionRow = row1;
  if (this.map2.grid[this.connectionRow] && this.map2.grid[this.connectionRow][1].isWalkable()) {
    row2 = this.connectionRow;
  } else {
    this.connectionRow = row2;
    row1 = this.worldLayoutManager.findClosestWalkableRow(this.map, this.connectionRow, 'right');
  }

  this.worldLayoutManager.openMazeSide(this.map, row1, 'right');
  this.worldLayoutManager.openMazeSide(this.map2, row2, 'left');

  // ================================
  // THIRD DUNGEON with 4 rooms 
  // ================================

  this.dungeonGap = 4;
  this.map2WorldWidth = this.map2.cols * this.map2.tileSize;

  this.dungeonOffset = new THREE.Vector3(
    this.map2Offset.x + this.map2WorldWidth + this.dungeonGap,
    0,
    0
  );

  // ----- create hallway connection between map 2 and dungeon -----
  let rowMap2ToDungeon = this.worldLayoutManager.findClosestWalkableRow(this.map2, preferredRow, 'right');
  let row3 = this.worldLayoutManager.findClosestWalkableRow(this.dungeonMap, preferredRow, 'left');

  this.connectionRow2 = rowMap2ToDungeon;

  if (
    this.dungeonMap.grid[this.connectionRow2] &&
    this.dungeonMap.grid[this.connectionRow2][1] &&
    this.dungeonMap.grid[this.connectionRow2][1].isWalkable()
  ) {
    row3 = this.connectionRow2;
  } else {
    this.connectionRow2 = row3;
    rowMap2ToDungeon = this.worldLayoutManager.findClosestWalkableRow(this.map2, this.connectionRow2, 'right');
  }
  
  // open the sides of the mazes to create doorways for the hallways between map 1 and map 2, and between map 2 and the dungeon
  this.worldLayoutManager.openMazeSide(this.map2, rowMap2ToDungeon, 'right');
  this.worldLayoutManager.openMazeSide(this.dungeonMap, row3, 'left');

  // ONLY connect the dungeon door into the dungeon interior
  // do NOT carve through map2, that breaks maze2 movement
  this.worldLayoutManager.connectSideToInterior(this.dungeonMap, row3, 'left');

  this.map.walkableTiles = this.map.grid.flat().filter(tile => tile.isWalkable());
  this.map2.walkableTiles = this.map2.grid.flat().filter(tile => tile.isWalkable());
  this.dungeonMap.walkableTiles = this.dungeonMap.grid.flat().filter(tile => tile.isWalkable());
  // create hierarchical pathfinder for drones in maze 2 with cluster size of 5 for good performance and still challenging movement as they chase the player through the larger and more complex maze 2
  this.droneHierarchicalPathfinder = new HierarchicalAStar(this.map2, {
  clusterSize: this.droneClusterSize
});


// ADD EXTRA GREEN (SAFE) TILES IN MAP 2 for lowering the difficulites in maze 2 
this.worldLayoutManager.addExtraGreenTiles(this.map2, 8); // 8 tiles

  // ----- render first maze in the scene -----
  this.mazeGroup1 = new THREE.Group();
  this.scene.add(this.mazeGroup1);
 
  // render the first maze with fences as obstacles for more visual interest and to create more defined pathways and cover for the player as they navigate through maze 1, while also providing a consistent visual theme with the fence obstacles appearing throughout the world including in the second maze and dungeon
  this.tileMapRenderer = new TileMapRenderer(this.map, {
    useFenceObstacles: true,
    fencePath: '/fence/scene.gltf',
    fenceScale: new THREE.Vector3(0.4, 0.4, 0.4)
  });
  this.tileMapRenderer.render(this.mazeGroup1);

  // ----- render second maze in the scene -----
  this.mazeGroup2 = new THREE.Group();
  this.mazeGroup2.position.copy(this.map2Offset);
  this.scene.add(this.mazeGroup2);

  // render the second maze with fences as obstacles for more visual interest and to create more defined pathways and cover for the player as they navigate through maze 2, while also providing a consistent visual theme with the fence obstacles appearing throughout the world including in the first maze and dungeon
  this.tileMapRenderer2 = new TileMapRenderer(this.map2, {
    useFenceObstacles: true,
    fencePath: '/fence/scene.gltf',
    fenceScale: new THREE.Vector3(0.5, 0.5, 0.5)
  });
  // render the second maze with fences as obstacles for more visual interest and to create more defined pathways and cover for the player as they navigate through maze 2, while also providing a consistent visual theme with the fence obstacles appearing throughout the world including in the first maze and dungeon
  this.tileMapRenderer2.render(this.mazeGroup2);
  
  // `----- render dungeon in the scene -----`
  this.dungeonGroup = new THREE.Group(); // to hold all the meshes for the dungeon and allow us to easily position the entire dungeon in the world with an offset so that it is placed to the right of the second maze with a gap in between for the hallway connection, while also keeping all the dungeon meshes organized under one parent group in the scene graph for better structure and easier management of the dungeon as a whole
  this.dungeonGroup.position.copy(this.dungeonOffset);
  this.scene.add(this.dungeonGroup);

  this.dungeonRenderer = new TileMapRenderer(this.dungeonMap, {
    useFenceObstacles: false
  });
  this.dungeonRenderer.render(this.dungeonGroup);


  // ----- render hallway between map 1 and map 2 -----
  this.worldLayoutManager.createHallway(row1, row2);

  // ----- render hallway between map 2 and dungeon -----
  this.worldLayoutManager.createHallwayBetweenMap2AndDungeon(rowMap2ToDungeon, row3);

  this.dungeonEntryTile = this.dungeonMap.grid[row3][0];
  this.controllerExitTile = this.worldLayoutManager.findFarthestWalkableTile(
    this.dungeonMap,
    this.dungeonEntryTile
  );
  this.controllerExitManager.createControllerExit();

  // -------- DOOR GOAL --------
  this.doorGoal = this.map.grid[row1][this.map.cols - 1];
  if (!this.doorGoal.isWalkable()) {
    this.doorGoal = this.map.grid[row1][this.map.cols - 2];
  }

  // main character
  this.mainCharacterManager = new MainCharacter(this);
  this.mainCharacterManager.createMainCharacter();

  // crreate 10 ground attackers
  this.groundAttackerManager = new GroundAttackers(this);
  this.groundAttackerManager.create(7); // create 10 ground attackers in maze 1 to chase the player and create dynamic and challenging gameplay as they respawn after reaching the door goal to keep up the pressure on the player and make maze 1 more engaging

  // vector pathfinding 
  this.groundVectorPathFinding = new VectorPathFinding(
    this.map,
    this.ground_attackers,
    this.scene,
    this.debugVisuals
  );

  this.groundVectorPathFinding.buildCostField(this.doorGoal);
  this.groundVectorPathFinding.allTileArrows(this.doorGoal);

  
  //this.createGoals(5);
  this.createLoadingIndicator();
  
  // Drone manager
  this.droneManager = new DroneEntity(this);
  this.droneManager.create(3); // create 10 drones in maze 2 to chase the player and create dynamic and challenging gameplay as they navigate through the larger and more complex maze 2, while also showcasing the hierarchical pathfinding with a cluster size of 5 for good performance and still intelligent movement from the drones as they pursue the player through maze 2

  
  // Dungeon guard Mananager
  this.dungeonGuardManager = new DungeonGuard(this);

  this.dungeonGuardManager.createPatrolLoopInDungeon3();
  
  this.dungeonGuardManager.drawDungeon3PatrolLoop();

  this.dungeonGuardManager.createDungeonGuard();


  //create energy cells for unlocking controller exit
  this.energyCellManager = new EnergyCellManager(this);
  this.energyCellManager.createEnergyCells(3);

  //this.createGoalsForMap(this.map2, this.map2Offset, 5);
  //this.createNPCsForMap(this.map2, this.map2Offset, 10);
  this.energyCellManager.createEnergyCellsForMap(this.map2, this.map2Offset, 3);
  this.energyCellManager.createEnergyCellsForMap(this.dungeonMap, this.dungeonOffset, 3);
  this.controllerExitManager.updateEnergyUnlockRequirement();
}

/*
Purpose: isInHallway is a method that checks if a given position (THREE.Vector3) is within the bounds of either of the two hallways connecting the mazes and dungeon in the world.
Parameters: position - a THREE.Vector3 representing the current position of the entity for which we want to check if it is within the hallway bounds.
*/
isInHallway(position) {
  
  let inHallway1 = false;
  let inHallway2 = false;

  if (this.hallwayBounds) {
    
    inHallway1 =
      position.x >= this.hallwayBounds.minX &&
      position.x <= this.hallwayBounds.maxX &&
      position.z >= this.hallwayBounds.minZ &&
      position.z <= this.hallwayBounds.maxZ;
  }

  if (this.hallwayBounds2) {
    
    inHallway2 =
      position.x >= this.hallwayBounds2.minX &&
      position.x <= this.hallwayBounds2.maxX &&
      position.z >= this.hallwayBounds2.minZ &&
      position.z <= this.hallwayBounds2.maxZ;
  }

  return inHallway1 || inHallway2;
}

/*
Purpose: getMapForPosition is a method that determines which tile map (maze 1, maze 2, or dungeon) should be used for collision detection based on the given position 
of an entity in the world.

Parameters: position - a THREE.Vector3 representing the current position of the entity for which we want to determine the appropriate tile map for collision detection.
*/
getMapForPosition(position) {
  
  if (this.isInHallway(position)) {
    
    return this.hallwayMap;
  
  }

  const inMap1 =
    position.x >= this.map.minX &&
    position.x <= this.map.minX + this.map.cols * this.map.tileSize &&
    position.z >= this.map.minZ &&
    position.z <= this.map.minZ + this.map.rows * this.map.tileSize;

  const inMap2 =
    position.x >= this.map2Offset.x + this.map2.minX &&
    position.x <= this.map2Offset.x + this.map2.minX + this.map2.cols * this.map2.tileSize &&
    position.z >= this.map2.minZ &&
    position.z <= this.map2.minZ + this.map2.rows * this.map2.tileSize;

  const inDungeon =
    position.x >= this.dungeonOffset.x + this.dungeonMap.minX &&
    position.x <= this.dungeonOffset.x + this.dungeonMap.minX + this.dungeonMap.cols * this.dungeonMap.tileSize &&
    position.z >= this.dungeonMap.minZ &&
    position.z <= this.dungeonMap.minZ + this.dungeonMap.rows * this.dungeonMap.tileSize;

  if (inDungeon) {
    
    return {
      handleCollisions: (entity) => {
        const fakeEntity = {
          ...entity,
          position: entity.position.clone().sub(this.dungeonOffset)
        };

        const corrected = this.dungeonMap.handleCollisions(fakeEntity);
        
        return corrected.add(this.dungeonOffset);
      
      }
    };
  }

  if (inMap2) {
    
    return {
      handleCollisions: (entity) => {
        const fakeEntity = {
          ...entity,
          position: entity.position.clone().sub(this.map2Offset)
        };

        const corrected = this.map2.handleCollisions(fakeEntity);
        
        return corrected.add(this.map2Offset);
      
      }
    };
  }

  if (inMap1) {
    
    return this.map;
  
  }

  return this.hallwayMap;
}

  

  // Create a loading indicator in the scene
  /*
Purpose: createLoadingIndicator is a method that creates a visual loading indicator in the 3D scene to inform the player about the progress of loading 3D models 
for the drone enemies in the second maze (map2).
 
Parameters: This method does not take any parameters. It creates a canvas element, draws text and a progress bar on it, 
and then uses that canvas as a texture for a sprite that is added to the scene.
*/

  createLoadingIndicator() {
    // Create a text sprite or simple indicator
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = 'white';
    ctx.font = 'bold 24px Arial';
    ctx.fillText('Loading boats...', 10, 50);

    const texture = new THREE.CanvasTexture(canvas);
    const material = new THREE.SpriteMaterial({ map: texture });
    this.loadingSprite = new THREE.Sprite(material);
    this.loadingSprite.position.set(0, 5, 0);
    this.loadingSprite.scale.set(5, 2.5, 1);
    this.scene.add(this.loadingSprite);
  }

  // Update loading indicator
  /*
Purpose: updateLoadingIndicator is a method that updates the loading indicator displayed in the scene based on the progress of loading 3D models for the drone enemies.
 Parameters: This method does not take any parameters. It calculates the loading progress as a percentage based on the number of models loaded versus the total number of models to load, and updates the canvas texture of the loading sprite accordingly. Once all models are loaded.
  */
  updateLoadingIndicator() {
  
  if (this.loadingComplete) {
    return;
  }

  if (!this.loadingSprite) {
    return;
  }
  
  const progress = this.modelsLoading > 0
    ? (this.modelsLoaded / this.modelsLoading) * 100
    : 0;

  // Update canvas text
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = 'white';
  ctx.font = 'bold 24px Arial';
  ctx.fillText(`Loading: ${Math.round(progress)}%`, 10, 50);

  // Draw progress bar
  ctx.fillStyle = '#333';
  ctx.fillRect(10, 70, 200, 20);
  ctx.fillStyle = '#0f0';
  ctx.fillRect(10, 70, 200 * (progress / 100), 20);

  const texture = new THREE.CanvasTexture(canvas);
  this.loadingSprite.material.map = texture;
  this.loadingSprite.material.needsUpdate = true;

  if (
    this.modelsLoaded >= this.modelsLoading &&
    this.modelsLoading > 0
  ) {
    this.loadingComplete = true;
    setTimeout(() => {
      if (this.loadingSprite && this.loadingSprite.parent) {
        this.scene.remove(this.loadingSprite);
      }
      this.loadingSprite = null;
    }, 2000);
  }
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
  
  const minX = this.dungeonOffset.x + this.dungeonMap.minX + 0.1;
  const maxX = this.dungeonOffset.x + this.dungeonMap.minX + this.dungeonMap.cols * this.dungeonMap.tileSize - 0.1;
  const minZ = this.dungeonMap.minZ + 0.1;
  const maxZ = this.dungeonMap.minZ + this.dungeonMap.rows * this.dungeonMap.tileSize - 0.1;

  entity.position.x = THREE.MathUtils.clamp(entity.position.x, minX, maxX);
  entity.position.z = THREE.MathUtils.clamp(entity.position.z, minZ, maxZ);

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
isPlayerOnSafeTile() {
  
  if (!this.main_character) return false;

  const inMap2 =
    this.main_character.position.x >= this.map2Offset.x + this.map2.minX &&
    this.main_character.position.x <= this.map2Offset.x + this.map2.minX + this.map2.cols * this.map2.tileSize &&
    this.main_character.position.z >= this.map2.minZ &&
    this.main_character.position.z <= this.map2.minZ + this.map2.rows * this.map2.tileSize;

  if (!inMap2) return false;

  const localPos = this.main_character.position.clone().sub(this.map2Offset);
  const tile = this.map2.quantize(localPos);

  if (!tile) return false;

  return tile.type === Tile.Type.MediumTerrain;
}


// controller exit wrapper 
isPlayerAtUnlockedControllerExit() {
  return this.controllerExitManager.isPlayerAtUnlockedControllerExit();
}

// restart
/*
*purpose: reset the game state to its initial conditions by clearing all entities from the scene, resetting all game variables to their default values, 
 and preparing the world for a new playthrough. 
*This function is called when the player chooses to restart the game after a game over, and ensures that all previous state is cleared and the game can start fresh.
*@returns null
*/ 
reset() {
  
  while (this.scene.children.length > 0) {

    this.scene.remove(this.scene.children[0]);
  }

  this.entities = [];
  this.ground_attackers = [];
  this.goals = [];
  this.npcs = [];
  this.drones = [];
  this.energyCells = [];
  this.mixers = [];
  this.collectedEnergyCells = 0;
  this.totalEnergyCells = 0;
  this.energyCellsRequiredForUnlock = 0;
  this.controllerExit = null;
  this.controllerExitTile = null;
  this.controllerExitUnlocked = false;
  this.controllerExitReached = false;

  this.main_character = null;
  this.groundVectorPathFinding = null;
  this.droneHierarchicalPathfinder = null;
  this.mazeGroup1 = null;
  this.mazeGroup2 = null;
  this.hallwayMesh = null;
  this.loadingSprite = null;
  this.hallwayBounds = null;

  this.dungeonGroup = null;
  this.dungeonRenderer = null;
  this.dungeonGuard = null;
  this.dungeonPatrolTiles = [];
  this.dungeonPatrolPath = [];
  this.dungeonPatrolLine = null;
  this.dungeonMap = null;
  this.hallwayMesh2 = null;
  this.hallwayBounds2 = null;
  this.dungeonOffset = null;
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
  update() {
  if (this.isGameOver) {
    for (let mixer of this.mixers) {
      mixer.stopAllAction();
    }

    if (this.mainCharacterMixer) {
      this.mainCharacterMixer.stopAllAction();
    }

    return;
  }

  if (!this.main_character) return;

  let dt = this.clock.getDelta();

  if (!this.loadingComplete) {
    if (this.mainCharacterMixer) {
      this.mainCharacterMixer.update(dt);
    }

    for (let mixer of this.mixers) {
      mixer.update(dt);
    }

    return;
  }

  // Update main character movement and animation
  this.mainCharacterManager.updateMainCharacter(dt);
  this.dungeonGuardManager.updateDungeonGuard(dt);
  // Update main character animation mixer if present
  if (this.mainCharacterMixer) {
    
    this.mainCharacterMixer.update(dt);
  
  }

  // Update animation mixers for loaded boats
  for (let mixer of this.mixers) {
    
    mixer.update(dt);
  
  }

  //updateGroundAttacker with new steering behaviours
  this.groundAttackerManager.update();
  this.droneManager.update(dt);
  

  // Update all entities (this includes the main character)
  for (let e of this.entities) {
    
    if (e === this.dungeonGuard) continue;

    if (e.update) {
      
      e.update(dt, this.getMapAdapterForPosition(e.position));
    
    }
  }

  this.energyCellManager.updateEnergyCells(dt);
  this.controllerExitManager.updateControllerExitState(dt);

  // keep player stable inside dungeon bounds
  if (this.main_character) {
    const pos = this.main_character.position;

    const inDungeon =
      pos.x >= this.dungeonOffset.x + this.dungeonMap.minX &&
      pos.x <= this.dungeonOffset.x + this.dungeonMap.minX + this.dungeonMap.cols * this.dungeonMap.tileSize &&
      pos.z >= this.dungeonMap.minZ &&
      pos.z <= this.dungeonMap.minZ + this.dungeonMap.rows * this.dungeonMap.tileSize;

    if (inDungeon) {
      const minX = this.dungeonOffset.x + this.dungeonMap.minX + 0.1;
      const maxX = this.dungeonOffset.x + this.dungeonMap.minX + this.dungeonMap.cols * this.dungeonMap.tileSize - 0.1;
      const minZ = this.dungeonMap.minZ + 0.1;
      const maxZ = this.dungeonMap.minZ + this.dungeonMap.rows * this.dungeonMap.tileSize - 0.1;

      this.main_character.position.x = THREE.MathUtils.clamp(this.main_character.position.x, minX, maxX);
      this.main_character.position.z = THREE.MathUtils.clamp(this.main_character.position.z, minZ, maxZ);
    }
  }

  // Update camera to follow main character
  this.mainCharacterManager.updateCameraFollow();

  // Final position logging (once per second)
  if (!this.finalLogCounter) this.finalLogCounter = 0;
  this.finalLogCounter++;
  if (this.finalLogCounter >= 60) {
    this.finalLogCounter = 0;
  }
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

import * as THREE from 'three'; // for general 3D rendering and math utilities
import * as Setup from './setup.js'; // for setting up the scene, camera, renderer, and lighting
import { InputHandler } from './input/InputHandler.js'; // for handling player input(main character movement) and interactions with the world
import { TileMap } from './maps/TileMap.js'; // for creating and managing the tile-based maps for the mazes and dungeon 
import { Tile } from './maps/Tile.js'; // for representing individual tiles in the tile maps with properties like type and walkability
import { TileMapRenderer } from './renderers/TileMapRenderer.js'; // for rendering the tile maps visually in the scene
import { DynamicEntity } from './entities/DynamicEntity.js'; // for representing dynamic entities in the world
import { GroundAttacker } from './entities/GroundAttacker.js';
import { DroneEnemy } from './entities/DroneEnemy.js'; // for representing flying drone enemies in the second maze that chase the player 
import { DungeonGuard } from './entities/DungeonGuard.js';
import { EnergyCell } from './entities/EnergyCell.js'; // creating main goal objects in the world
import { GLTFLoader } from 'three/examples/jsm/Addons.js'; // for loading 3D models in GLTF format for the main character and other entities
import { VectorPathFinding } from './ai/pathfinding/vectorPathFinding.js'; // for implementing vector path finding..
import { HierarchicalAStar } from './ai/pathfinding/HierarchicalAStar.js'; // for implementing hierarchical pathfinding for drones in maze 2
import { DebugVisuals } from './debug/DebugVisuals.js'; // for deugging purposes..
import { DungeonGenerator } from './pcg/DungeonGenerator.js'; // for procedurally generating the dungeon map with rooms and corridors for the third part of the world
import { JPS } from './ai/pathfinding/JPS.js'; // importing jumppointsearch functionality 

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
    this.moveSpeed = 5.0; // Adjust as needed for gameplay feel
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

  // ----- create two mazes -----
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
  let row1 = this.findClosestWalkableRow(this.map, preferredRow, 'right');
  let row2 = this.findClosestWalkableRow(this.map2, preferredRow, 'left');

  this.connectionRow = row1;
  if (this.map2.grid[this.connectionRow] && this.map2.grid[this.connectionRow][1].isWalkable()) {
    row2 = this.connectionRow;
  } else {
    this.connectionRow = row2;
    row1 = this.findClosestWalkableRow(this.map, this.connectionRow, 'right');
  }

  this.openMazeSide(this.map, row1, 'right');
  this.openMazeSide(this.map2, row2, 'left');

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
  let rowMap2ToDungeon = this.findClosestWalkableRow(this.map2, preferredRow, 'right');
  let row3 = this.findClosestWalkableRow(this.dungeonMap, preferredRow, 'left');

  this.connectionRow2 = rowMap2ToDungeon;

  if (
    this.dungeonMap.grid[this.connectionRow2] &&
    this.dungeonMap.grid[this.connectionRow2][1] &&
    this.dungeonMap.grid[this.connectionRow2][1].isWalkable()
  ) {
    row3 = this.connectionRow2;
  } else {
    this.connectionRow2 = row3;
    rowMap2ToDungeon = this.findClosestWalkableRow(this.map2, this.connectionRow2, 'right');
  }
  
  // open the sides of the mazes to create doorways for the hallways between map 1 and map 2, and between map 2 and the dungeon
  this.openMazeSide(this.map2, rowMap2ToDungeon, 'right');
  this.openMazeSide(this.dungeonMap, row3, 'left');

  // ONLY connect the dungeon door into the dungeon interior
  // do NOT carve through map2, that breaks maze2 movement
  this.connectSideToInterior(this.dungeonMap, row3, 'left');

  this.map.walkableTiles = this.map.grid.flat().filter(tile => tile.isWalkable());
  this.map2.walkableTiles = this.map2.grid.flat().filter(tile => tile.isWalkable());
  this.dungeonMap.walkableTiles = this.dungeonMap.grid.flat().filter(tile => tile.isWalkable());
  // create hierarchical pathfinder for drones in maze 2 with cluster size of 5 for good performance and still challenging movement as they chase the player through the larger and more complex maze 2
  this.droneHierarchicalPathfinder = new HierarchicalAStar(this.map2, {
  clusterSize: this.droneClusterSize
});


// ADD EXTRA GREEN (SAFE) TILES IN MAP 2 for lowering the difficulites in maze 2 
this.addExtraGreenTiles(this.map2, 8); // 8 tiles

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
  this.createHallway(row1, row2);

  // ----- render hallway between map 2 and dungeon -----
  this.createHallwayBetweenMap2AndDungeon(rowMap2ToDungeon, row3);

  this.dungeonEntryTile = this.dungeonMap.grid[row3][0];
  this.controllerExitTile = this.findFarthestWalkableTile(
    this.dungeonMap,
    this.dungeonEntryTile
  );
  this.createControllerExit();

  // -------- DOOR GOAL --------
  this.doorGoal = this.map.grid[row1][this.map.cols - 1];
  if (!this.doorGoal.isWalkable()) {
    this.doorGoal = this.map.grid[row1][this.map.cols - 2];
  }

  // main character
  this.main_character = new DynamicEntity({
    position: new THREE.Vector3(0, 0, 0),
    velocity: new THREE.Vector3(0, 0, 0),
    topSpeed: this.moveSpeed,
    color: 0x3333ff,
    scale: new THREE.Vector3(1, 1, 1)
  });

  // crreate 10 ground attackers
  this.createGroundAttackers(10);

  // vector pathfinding 
  this.groundVectorPathFinding = new VectorPathFinding(
    this.map,
    this.ground_attackers,
    this.scene,
    this.debugVisuals
  );

  this.groundVectorPathFinding.buildCostField(this.doorGoal);
  this.groundVectorPathFinding.allTileArrows(this.doorGoal);

  // ----- MAIN CHARACTER LOADING -----
  const tempCubeGeo = new THREE.BoxGeometry(1.2, 1.2, 1.2);
  const tempCubeMat = new THREE.MeshStandardMaterial({
    color: 0x33aaff,
    emissive: 0x004466,
    transparent: true,
    opacity: 0.8
  });
  const tempCube = new THREE.Mesh(tempCubeGeo, tempCubeMat);
  tempCube.position.set(0, 0.75, 0);
  this.main_character.mesh.add(tempCube);

  const loadingRing = new THREE.Mesh(
    new THREE.TorusGeometry(0.8, 0.1, 16, 32),
    new THREE.MeshStandardMaterial({ color: 0xffff00, emissive: 0x442200 })
  );
  loadingRing.position.set(0, 1.2, 0);
  this.main_character.mesh.add(loadingRing);
  this.main_character.loadingRing = loadingRing;

  const loader = new GLTFLoader();
  loader.load(
    '/officer_with_gun/scene.gltf',
    (gltf) => {
      const model = gltf.scene;

      while (this.main_character.mesh.children.length > 0) {
        this.main_character.mesh.remove(this.main_character.mesh.children[0]);
      }

      model.scale.set(1.8, 1.8, 1.8);

      const box = new THREE.Box3().setFromObject(model);
      model.position.y = -box.min.y;

      this.main_character.mesh.add(model);

      if (gltf.animations && gltf.animations.length > 0) {
        const mixer = new THREE.AnimationMixer(model);
        this.mainCharacterMixer = mixer;

        gltf.animations.forEach((clip, idx) => {
          const action = mixer.clipAction(clip);
          this.mainCharacterActions[idx] = action;
        });

        const idleAction = this.mainCharacterActions[0];
        if (idleAction) {
          idleAction.play();
          this.currentMainAction = idleAction;
        }
      }
    }
  );

  this.addEntityToWorld(this.main_character);

  //this.createGoals(5);
  this.createLoadingIndicator();
  this.createGameplayDrones(3);
  //this.createNPCs(10);
  this.createPatrolLoopInDungeon3();
  this.drawDungeon3PatrolLoop();
  this.createDungeonGuard();

  //create energy cells for unlocking controller exit
  this.createEnergyCells(3);

//this.createGoalsForMap(this.map2, this.map2Offset, 5);
//this.createNPCsForMap(this.map2, this.map2Offset, 10);
this.createEnergyCellsForMap(this.map2, this.map2Offset, 3);
this.createEnergyCellsForMap(this.dungeonMap, this.dungeonOffset, 3);
this.updateEnergyUnlockRequirement();
}

 
/*  
Purpose : findFarthestWalkableTile is a method that takes in a tile map and a starting tile, and iterates through all the walkable tiles in the map 
to find the one that is farthest away from the starting tile based on Manhattan distance. This is used to place the controller exit in the dungeon as far away from the 
entry point as possible to create a more challenging and engaging gameplay experience for the player as they have to navigate through the dungeon to reach the exit 
after unlocking it by collecting energy cells. If no valid starting tile is provided,it will return a random walkable tile from the map as a fallback.

returns the tile that is farthest away from the starting tile based on Manhattan distance, or a random walkable tile if no valid starting tile is provided.
*/
findFarthestWalkableTile (map, fromTile) {

    if (!fromTile || !fromTile.isWalkable()) {
      return map.getRandomWalkableTile();
    }

    let farthestTile = fromTile;
    let farthestDistance = -Infinity;

    for (let tile of map.walkableTiles) {
      
      const distance =
        Math.abs(tile.row - fromTile.row) +
        Math.abs(tile.col - fromTile.col);

      if (distance > farthestDistance) {
        
        farthestDistance = distance;
        farthestTile = tile;
      }
    }

    return farthestTile;
  }


  /*
  Purpose : createControllerExit is a method that creates the controller exit object in the dungeon based on the controllerExitTile location, 
  and sets up its visual appearance and properties for unlocking and activation.
  
  */
  createControllerExit() {
    
    if (!this.controllerExitTile) {
      return;
    }

    const exitPosition = this.dungeonMap
      .localize(this.controllerExitTile)
      .clone()
      .add(this.dungeonOffset);

    const group = new THREE.Group();
    group.position.copy(exitPosition);

    const base = new THREE.Mesh(
      new THREE.CylinderGeometry(1.1, 1.3, 0.4, 24),
      new THREE.MeshStandardMaterial({
        color: 0x30363d,
        emissive: 0x111111
      })
    );

    base.position.y = 0.2;
    group.add(base);

    const coreMaterial = new THREE.MeshStandardMaterial({
      color: 0xff5533,
      emissive: 0x661100,
      emissiveIntensity: 1.2
    });

    const core = new THREE.Mesh(
      new THREE.CylinderGeometry(0.55, 0.55, 1.8, 18),
      coreMaterial
    );
    core.position.y = 1.2;
    group.add(core);

    const beacon = new THREE.Mesh(
      new THREE.TorusGeometry(0.95, 0.08, 12, 24),
      new THREE.MeshStandardMaterial({
        color: 0xffaa44,
        emissive: 0x553300,
        emissiveIntensity: 0.9
      })
    );
    beacon.rotation.x = Math.PI / 2;
    beacon.position.y = 1.2;
    group.add(beacon);

    group.userData = {
      base,
      core,
      beacon,
      lockedColor: 0xff5533,
      lockedEmissive: 0x661100,
      unlockedColor: 0x33ff99,
      unlockedEmissive: 0x116644
    };

    this.controllerExit = {
      mesh: group,
      position: exitPosition,
      tile: this.controllerExitTile
    };

    this.scene.add(group);
    this.updateControllerExitVisualState(0);
  }

  /*
  Purpose : updateControllerExitVisualState is a method that updates the visual appearance of the controller exit in the dungeon based on whether it is currently unlocked or locked.
  Parameters: timestep(dt) - the time elapsed since the last update
  */
  updateControllerExitVisualState(dt = 0) {
    
    if (!this.controllerExit) {
      return;
    }

    const { core, beacon, lockedColor, lockedEmissive, unlockedColor, unlockedEmissive } =
      this.controllerExit.mesh.userData;

    if (this.controllerExitUnlocked) {
      
      core.material.color.setHex(unlockedColor);
      core.material.emissive.setHex(unlockedEmissive);
      beacon.material.color.setHex(0xaaffdd);
      beacon.material.emissive.setHex(0x227755);
      beacon.rotation.z += dt * 1.5;
    
    } else {
      core.material.color.setHex(lockedColor);
      core.material.emissive.setHex(lockedEmissive);
      beacon.material.color.setHex(0xffaa44);
      beacon.material.emissive.setHex(0x553300);
      beacon.rotation.z += dt * 0.35;
    }
  }


  /*
  Purpose : updateControllerExitState is a method that checks if the controller exit in the dungeon should be unlocked based on the number of energy cells collected by the player
  Paramters : timestep(dt) - the time elapsed since the last update, which can be used to create smooth animations for the controller exit's visual state changes 
  when it transitions between locked and unlocked states based on energy cell collection. This method updates the controller exit's unlocked state and visual appearance accordingly.
  */
  updateControllerExitState(dt) {
    
    if (!this.controllerExit) {
      return;
    }

    this.controllerExitUnlocked =
      this.energyCellsRequiredForUnlock > 0 &&
      this.collectedEnergyCells >= this.energyCellsRequiredForUnlock;

    this.updateControllerExitVisualState(dt);
  }


  /*
  Purpose : updateEnergyUnlockRequirement is a method that calculates the number of energy cells required to unlock the controller exit in the dungeon based on the total number of energy cells in the world 
  and a predefined fraction that determines the unlock requirement.
  
  Parameters: none, but it uses the totalEnergyCells property of the world to calculate the energyCellsRequiredForUnlock based on the unlockRequirementFraction. 
  */
  updateEnergyUnlockRequirement() {
    
    this.energyCellsRequiredForUnlock = Math.ceil(
      this.totalEnergyCells * this.unlockRequirementFraction
    );
  }

  
  /*
  Purpose : isPlayerAtUnlockedControllerExit is a method that checks if the main character (player) is within a certain activation radius of the controller exit 
  in the dungeon and if the exit is unlocked, which would allow the player to win the game by reaching the exit after collecting enough energy cells to unlock it. 
  This method is used to determine if the player has successfully reached the win condition of the game by activating the controller exit after unlocking it.
  
  parameters: none, but it uses the main_character's position
  */
  isPlayerAtUnlockedControllerExit() {
    
    if (
      !this.main_character ||
      !this.controllerExit ||
      !this.controllerExitUnlocked
    ) {
      
      return false;
    }

    return (
      this.main_character.position.distanceTo(this.controllerExit.position) <=
      this.controllerExitActivationRadius
    );
  }

  /*
  Purpose: findClosestWalkableRow is a method that takes in a tile map, a preferred row index, and a side ('left' or 'right'), 
  and searches for the closest walkable row to the preferred row on the specified side of the map.
  
  Parameters: - map: the tile map in which to search for the closest walkable row, which provides information about walkable tiles and localization for positioning.
  */
  findClosestWalkableRow(map, preferredRow, side = 'right') {
    
    const col = side === 'right' ? map.cols - 2 : 1;

    for (let offset = 0; offset < map.rows; offset++) {
      
      const r1 = preferredRow + offset;
      const r2 = preferredRow - offset;

      if (r1 >= 1 && r1 < map.rows - 1 && map.grid[r1][col].isWalkable()) return r1;
      if (r2 >= 1 && r2 < map.rows - 1 && map.grid[r2][col].isWalkable()) return r2;
    }

    return Math.max(1, Math.min(map.rows - 2, preferredRow));
  }

  
  openMazeSide(map, row, side = 'right') {
    
    if (side === 'right') {
      
      map.grid[row][map.cols - 1].type = Tile.Type.EasyTerrain;
      map.grid[row][map.cols - 2].type = Tile.Type.EasyTerrain;
    
    } else {
      map.grid[row][0].type = Tile.Type.EasyTerrain;
      map.grid[row][1].type = Tile.Type.EasyTerrain;
    }
  }


  /*
  Purpose: createHallway is a method that takes in the row indices for the doorway connections in map 1 and map 2, 
  and creates a hallway mesh in the scene that visually connects the two mazes at those rows.
  
  Parameters: row1 - the index of the row in map 1 where the doorway for the hallway connection to map 2 is located.
  */
  createHallway(row1, row2) {
    
    const startTile1 = this.map.grid[row1][this.map.cols - 1];
    const startTile2 = this.map2.grid[row2][0];

    const p1 = this.map.localize(startTile1);
    const p2 = this.map2.localize(startTile2).clone().add(this.map2Offset);

    const hallwayY = 0.02;
    const hallwayThickness = 0.05;
    const hallwayDepth = this.map.tileSize;

    const straightCenterX = (p1.x + p2.x) / 2;
    const straightCenterZ = p1.z;
    const straightWidth = Math.abs(p2.x - p1.x);

    const straightGeo = new THREE.BoxGeometry(straightWidth, hallwayThickness, hallwayDepth);
    const straightMat = new THREE.MeshStandardMaterial({ color: 0xf0f0f0 });
    const straightHall = new THREE.Mesh(straightGeo, straightMat);
    straightHall.position.set(straightCenterX, hallwayY, straightCenterZ);
    this.scene.add(straightHall);

    this.hallwayMesh = straightHall;

    this.hallwayBounds = {
      minX: Math.min(p1.x, p2.x),
      maxX: Math.max(p1.x, p2.x),
      minZ: p1.z - hallwayDepth / 2,
      maxZ: p1.z + hallwayDepth / 2
    };

    // if the doorway rows are different, add a vertical connector near maze 2
    if (p1.z !== p2.z) {

      const verticalDepth = Math.abs(p2.z - p1.z) + hallwayDepth;
      const verticalCenterZ = (p1.z + p2.z) / 2;
      const verticalGeo = new THREE.BoxGeometry(this.map.tileSize, hallwayThickness, verticalDepth);
      const verticalMat = new THREE.MeshStandardMaterial({ color: 0xf0f0f0 });
      const verticalHall = new THREE.Mesh(verticalGeo, verticalMat);
      verticalHall.position.set(p2.x, hallwayY, verticalCenterZ);
      
      this.scene.add(verticalHall);
      this.hallwayBounds.minX = Math.min(this.hallwayBounds.minX, p2.x - this.map.tileSize / 2);
      this.hallwayBounds.maxX = Math.max(this.hallwayBounds.maxX, p2.x + this.map.tileSize / 2);
      this.hallwayBounds.minZ = Math.min(this.hallwayBounds.minZ, verticalCenterZ - verticalDepth / 2);
      this.hallwayBounds.maxZ = Math.max(this.hallwayBounds.maxZ, verticalCenterZ + verticalDepth / 2);
    }
  }

  // create doorway connection between maze 2 and dungeon
  /*
  Purpose: createHallwayBetweenMap2AndDungeon is a method that takes in the row indices for the doorway connections in map 2 and the dungeon, and creates a hallway 
  mesh in the scene that visually connects the two maps at those rows.
  
  Parameters: row2 - the index of the row in map 2 where the doorway for the hallway connection to the dungeon is located. 
  row3 - the index of the row in the dungeon where the doorway for the hallway connection from map 2 is located. 
  */
  createHallwayBetweenMap2AndDungeon(row2, row3) {
  
  const startTile2 = this.map2.grid[row2][this.map2.cols - 1];
  const startTile3 = this.dungeonMap.grid[row3][0];
  const p2 = this.map2.localize(startTile2).clone().add(this.map2Offset);
  const p3 = this.dungeonMap.localize(startTile3).clone().add(this.dungeonOffset);
  const hallwayY = 0.02;
  const hallwayThickness = 0.05;
  const hallwayDepth = this.map2.tileSize;
  const straightCenterX = (p2.x + p3.x) / 2;
  const straightCenterZ = p2.z;
  const straightWidth = Math.abs(p3.x - p2.x);
  const straightGeo = new THREE.BoxGeometry(straightWidth, hallwayThickness, hallwayDepth);
  const straightMat = new THREE.MeshStandardMaterial({ color: 0xf0f0f0 });
  const straightHall = new THREE.Mesh(straightGeo, straightMat);
  
  straightHall.position.set(straightCenterX, hallwayY, straightCenterZ);
  
  this.scene.add(straightHall);
  this.hallwayMesh2 = straightHall;
  
  this.hallwayBounds2 = {
    minX: Math.min(p2.x, p3.x),
    maxX: Math.max(p2.x, p3.x),
    minZ: p2.z - hallwayDepth / 2,
    maxZ: p2.z + hallwayDepth / 2
  };

  if (p2.z !== p3.z) {
    
    const verticalDepth = Math.abs(p3.z - p2.z) + hallwayDepth;
    const verticalCenterZ = (p2.z + p3.z) / 2;
    const verticalGeo = new THREE.BoxGeometry(this.map2.tileSize, hallwayThickness, verticalDepth);
    const verticalMat = new THREE.MeshStandardMaterial({ color: 0xf0f0f0 });
    const verticalHall = new THREE.Mesh(verticalGeo, verticalMat);
    
    verticalHall.position.set(p3.x, hallwayY, verticalCenterZ);
    
    this.scene.add(verticalHall);
    this.hallwayBounds2.minX = Math.min(this.hallwayBounds2.minX, p3.x - this.map2.tileSize / 2);
    this.hallwayBounds2.maxX = Math.max(this.hallwayBounds2.maxX, p3.x + this.map2.tileSize / 2);
    this.hallwayBounds2.minZ = Math.min(this.hallwayBounds2.minZ, verticalCenterZ - verticalDepth / 2);
    this.hallwayBounds2.maxZ = Math.max(this.hallwayBounds2.maxZ, verticalCenterZ + verticalDepth / 2);
  }
}

// make sure the door of dungeon is aligned with the hallway from map 2
/*
Purpose: connectSideToInterior is a method that takes in a tile map, a row index, and a side ('left' or 'right'), and modifies the tiles along that row on the specified side 
of the map to create a walkable path that connects the doorway created for the hallway 

Parameters: - map: the tile map in which to create the connection from the hallway doorway into the interior of the dungeon, which provides information about walkable tiles 
and localization for positioning. - row: the index of the row in the tile map where the doorway for the hallway is located and where we want to create the connection into the interior of the dungeon. 

*/
connectSideToInterior(map, row, side = 'left') {
  
  if (side === 'left') {
    let foundWalkable = false;

    for (let c = 0; c < map.cols; c++) {
      
      if (map.grid[row][c].isWalkable()) {
        foundWalkable = true;
        break;
      }
    }

    if (!foundWalkable) return;

    for (let c = 0; c < map.cols; c++) {
      
      map.grid[row][c].type = Tile.Type.EasyTerrain;
      
      if (c > 1 && map.grid[row][c + 1] && map.grid[row][c + 1].isWalkable()) {
        break;
      }
    }
  
  } else {
    let foundWalkable = false;

    for (let c = map.cols - 1; c >= 0; c--) {
      
      if (map.grid[row][c].isWalkable()) {
        foundWalkable = true;
        break;
      }
    }

    if (!foundWalkable) return;

    for (let c = map.cols - 1; c >= 0; c--) {
      
      map.grid[row][c].type = Tile.Type.EasyTerrain;
      
      if (c < map.cols - 2 && map.grid[row][c - 1] && map.grid[row][c - 1].isWalkable()) {
        break;
      }
    }
  }
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

  const dungeonStartX = this.dungeonOffset.x - this.dungeonMap.tileSize / 2;
  const map2StartX = this.map2Offset.x - this.map2.tileSize / 2;

  if (position.x >= dungeonStartX) {
    
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

  if (position.x >= map2StartX) {
    
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

  return this.map;
}

  
// for second maze ....create NPCs with offset
/*
Purpose: createNPCsForMap is a method that creates a specified number of NPC (non-player character) entities in a given tile map with a specified offset for positioning.
Parameters: - map: the tile map in which to create the NPCs, which provides information about walkable tiles and localization for positioning.
*/
createNPCsForMap(map, offset, numNPCs = 10) {
    
  this.modelsLoading += numNPCs;

    for (let i = 0; i < numNPCs; i++) {
      
      let randomTile =
        map.walkableTiles[Math.floor(Math.random() * map.walkableTiles.length)];

      let position = map.localize(randomTile).clone().add(offset);

      let npc = new DynamicEntity({
        position: position,
        velocity: new THREE.Vector3(0, 0, 0),
        color: 0xffaa33,
        scale: new THREE.Vector3(1, 1, 1)
      });

      npc.mesh.rotation.y = Math.random() * Math.PI * 2;
      npc.boatLoaded = false;

      const tempGeometry = new THREE.BoxGeometry(1.5, 1.5, 1.5);
      const tempMaterial = new THREE.MeshStandardMaterial({
        color: 0xffaa33,
        emissive: 0x442200,
        transparent: true,
        opacity: 0.7
      });
      const tempCube = new THREE.Mesh(tempGeometry, tempMaterial);
      tempCube.position.set(0, 0.75, 0);
      npc.mesh.add(tempCube);

      const indicatorGeo = new THREE.ConeGeometry(0.3, 0.8, 8);
      const indicatorMat = new THREE.MeshStandardMaterial({ color: 0xffff00 });
      const indicator = new THREE.Mesh(indicatorGeo, indicatorMat);
      indicator.position.set(0, 1.8, 0);
      indicator.userData = { spinSpeed: 0.1 };
      npc.mesh.add(indicator);
      npc.loadingIndicator = indicator;

      const loader = new GLTFLoader();
      loader.load(
        '/animated_drone/scene.gltf',
        (gltf) => {
          const model = gltf.scene;
          const currentRotation = npc.mesh.rotation.y;

          while (npc.mesh.children.length > 0) {
            npc.mesh.remove(npc.mesh.children[0]);
          }

          model.scale.set(10, 10, 10);
          model.position.set(0, -0.5, 0);

          const box = new THREE.Box3().setFromObject(model);
          model.position.y = -box.min.y;
          model.userData.forwardAxis = 'x';

          npc.mesh.add(model);
          npc.boatModel = model;
          npc.boatLoaded = true;
          npc.color = 0xff3333;
          npc.mesh.rotation.y = currentRotation;

          if (gltf.animations && gltf.animations.length > 0) {
            const mixer = new THREE.AnimationMixer(model);
            const action = mixer.clipAction(gltf.animations[0]);
            action.play();
            npc.mixer = mixer;
            this.mixers.push(mixer);
          }

          this.modelsLoaded++;
          this.updateLoadingIndicator();
        },
        undefined,
        () => {
          if (npc.mesh.children[0]) {
            npc.mesh.children[0].material.color.setHex(0xff0000);
          }

          npc.boatLoaded = true;
          npc.loadError = true;

          this.modelsLoaded++;
          this.updateLoadingIndicator();
        }
      );

      this.npcs.push(npc);
      this.addEntityToWorld(npc);
    }
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


/*
Purpose: createGameplayDrones is a method that generates a specified number of drone enemy entities in the second maze (map2) of the game world.
Parameters:- numDrones: the number of drone enemies to create in the second maze. The method ensures that each drone is spawned at a valid location that is not too close 
to other drones,
*/
createGameplayDrones(numDrones = 3) {
  
  this.drones = [];
  this.modelsLoading += numDrones;

  for (let i = 0; i < numDrones; i++) {
    
    const droneTile = this.getValidDroneSpawnTile(this.map2, this.drones);
    const dronePosition = this.map2.localize(droneTile).clone().add(this.map2Offset);

    const drone = new DroneEnemy({
      spawnTile: droneTile,
      homeTile: droneTile,
      patrolMap: this.map2,
      position: dronePosition.clone(),
      velocity: new THREE.Vector3(0, 0, 0),
      color: 0xffaa33,
      scale: new THREE.Vector3(1, 1, 1),
      topSpeed: 3.5
    });

    drone.position.y = 1;
    drone.mesh.rotation.y = Math.random() * Math.PI * 2;

    drone.initializeFSM({
      player: this.main_character,
      world: this
    });

    drone.setPathfinder(this.droneHierarchicalPathfinder);

    this.loadDroneVisual(drone);
    this.addDroneDetectionCircle(drone);

    this.drones.push(drone);
    this.addEntityToWorld(drone);
  }
}


/*
Purpose: getValidDroneSpawnTile is a method that attempts to find a valid tile for spawning a drone enemy in the second maze (map2) of the game world. 
It randomly selects walkable tiles and checks if they are at least 5 units away from any existing drones to prevent overcrowding and ensure better gameplay balance.
parameters:- map: the tile map (map2) in which to find a valid spawn tile for the drone.
- existingDrones: an array of existing drone entities that have already been spawned in the maze, used to check for proximity and ensure new drones do not spawn too close to them. 
*/
getValidDroneSpawnTile(map, existingDrones = []) {
  
  let spawnTile;
  let spawnPosition;
  let tries = 0;

  do {
    spawnTile = map.getRandomWalkableTile();
    spawnPosition = map.localize(spawnTile);
    tries++;
  } while (
    tries < 300 &&
    (
      existingDrones.some((drone) => {
        const droneLocalPos = drone.position.clone().sub(this.map2Offset);
        return droneLocalPos.distanceTo(spawnPosition) < 5;
      })
    )
  );

  return spawnTile;
}

/*
Purpose: loadDroneVisual is a method that takes a drone enemy entity as a parameter and loads its 3D model asynchronously using GLTFLoader. 
Once the model is loaded, it applies the model to the drone's mesh and sets up any animations if they are present in the GLTF file. 

Parameters:- drone: the drone enemy entity for which the visual model is being loaded. The method also handles loading errors by setting a flag on the drone.
*/
loadDroneVisual(drone) {
  
  const loader = new GLTFLoader();

  loader.load(
    '/animated_drone/scene.gltf',
    (gltf) => {
      drone.applyDroneModel(gltf, this.mixers);

      // attach detection circle AFTER model is applied
      if (drone._pendingDetectionCircle) {
        drone.mesh.add(drone._pendingDetectionCircle);
        drone.detectionCircle = drone._pendingDetectionCircle;
        drone._pendingDetectionCircle = null;
      }

      this.modelsLoaded++;
      this.updateLoadingIndicator();
    },
    undefined,
    () => {
      drone.handleLoadError();

      // still attach circle even if model fails
      if (drone._pendingDetectionCircle) {
        drone.mesh.add(drone._pendingDetectionCircle);
        drone.detectionCircle = drone._pendingDetectionCircle;
        drone._pendingDetectionCircle = null;
      }

      this.modelsLoaded++;
      this.updateLoadingIndicator();
    }
  );
}

/*
Purpose: addDroneDetectionCircle is a method that creates a circular mesh to visually represent the detection range of a drone enemy in the game world.
parameters:- drone: the drone enemy entity for which the detection circle is being created. The method calculates the radius of the circle based on the drone's detectRange
*/
addDroneDetectionCircle(drone) {
  
  const radius = drone.detectRange ?? drone.detectionRange ?? 6;
  const geometry = new THREE.CircleGeometry(radius, 64);

  const material = new THREE.MeshBasicMaterial({
    color: 0x66e0ff,      // bluish default
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.25,        
    depthWrite: false
  });

  const circle = new THREE.Mesh(geometry, material);
  circle.rotation.x = -Math.PI / 2;
  circle.position.y = 0.05;
  circle.renderOrder = 999;

  drone._pendingDetectionCircle = circle;
}

  // create 10 ground attackers in the first maze (for vector pathfinding testing)
  /*
  purpose: createGroundAttackers is a method that generates a specified number of ground attacker entities in the first maze of the game world. 
  Each attacker is represented by a 3D model of a sphere robot, which is loaded asynchronously using GLTFLoader. The attackers are placed at random walkable tiles in the maze, 
  with checks to ensure they are not too close to the player start position, the door goal, or each other to prevent overcrowding and ensure a more balanced gameplay experience. 
  Each attacker has properties to track whether their model has loaded successfully and to handle any loading errors, as well as an animation mixer if the model includes animations. This method also updates a loading indicator to show overall progress of attacker model loading.
  
  parameters:
- numAttackers: the number of ground attackers to create (default is 10)
  */
  createGroundAttackers(numAttackers = 10) {
    this.ground_attackers = [];
    this.modelsLoading += numAttackers;

    for (let i = 0; i < numAttackers; i++) {
      const attackerTile = GroundAttacker.findSpawnTile(this.map, {
        avoidPositions: [
          new THREE.Vector3(0, 0, 0),
          this.map.localize(this.doorGoal)
        ],
        peers: this.ground_attackers
      });

      const attackerPosition = this.map.localize(attackerTile);
      const attacker = new GroundAttacker({
        spawnTile: attackerTile,
        patrolMap: this.map,
        goalTile: this.doorGoal,
        position: attackerPosition.clone(),
        velocity: new THREE.Vector3(0, 0, 0),
        color: 0x660000,
        scale: new THREE.Vector3(1, 0.75, 1)
      });

      attacker.position.y = 1;
      attacker.loadVisual({
        mixers: this.mixers,
        onLoaded: () => {
          this.modelsLoaded++;
          this.updateLoadingIndicator();
        },
        onError: () => {
          this.modelsLoaded++;
          this.updateLoadingIndicator();
        }
      });

      this.ground_attackers.push(attacker);
      this.addEntityToWorld(attacker);
    }
  }

  // create npcs with visual loading feedback
  /*
  purpose: createNPCs is a method that generates a specified number of NPC entities in the game world, 
  each with visual feedback to indicate that their boat model is loading. 

parameters:
- numNPCs: the number of NPCs to create (default is 10)
Each NPC is initially represented by a temporary orange cube with a spinning yellow cone above it to indicate loading. Once the boat model is successfully loaded, 
the temporary visuals are removed and replaced with the actual boat model. 
If there is an error during loading, the cube turns red to indicate the failure. This method also updates a loading indicator to show overall progress of NPC model loading.
  */
  createNPCs(numNPCs = 10) {
    
    this.modelsLoading += numNPCs;

    for (let i = 0; i < numNPCs; i++) {
      
      let randomTile =
        this.map.walkableTiles[
          Math.floor(Math.random() * this.map.walkableTiles.length)
        ];
      
        let position = this.map.localize(randomTile);

      // Create NPC entity with a temporary loading cube
      let npc = new DynamicEntity({
        position: position,
        velocity: new THREE.Vector3(0, 0, 0),
        color: 0xffaa33, // Orange color for loading
        scale: new THREE.Vector3(1, 1, 1)
      });

      // Set initial rotation to face a random direction
      npc.mesh.rotation.y = Math.random() * Math.PI * 2;

      // Add a flag to indicate if boat is loaded
      npc.boatLoaded = false;

      // Add a temporary cube that shows it's loading
      const tempGeometry = new THREE.BoxGeometry(1.5, 1.5, 1.5);
      const tempMaterial = new THREE.MeshStandardMaterial({
        color: 0xffaa33,
        emissive: 0x442200,
        transparent: true,
        opacity: 0.7
      });
      
      const tempCube = new THREE.Mesh(tempGeometry, tempMaterial);
      tempCube.position.set(0, 0.75, 0);
      npc.mesh.add(tempCube);

      // Add a spinning indicator
      const indicatorGeo = new THREE.ConeGeometry(0.3, 0.8, 8);
      const indicatorMat = new THREE.MeshStandardMaterial({
        color: 0xffff00
      });
      
      const indicator = new THREE.Mesh(indicatorGeo, indicatorMat);
      indicator.position.set(0, 1.8, 0);
      indicator.userData = { spinSpeed: 0.1 };
      npc.mesh.add(indicator);
      npc.loadingIndicator = indicator;

      // Load boat model
      const loader = new GLTFLoader();
      loader.load(
        '/animated_drone/scene.gltf',
        (gltf) => {
          const model = gltf.scene;
          console.log('Boat model loaded:', gltf.scene);

          const currentRotation = npc.mesh.rotation.y;

          // Remove temporary loading visuals
          while (npc.mesh.children.length > 0) {
            npc.mesh.remove(npc.mesh.children[0]);
          }

          // Scale and position the boat
          model.scale.set(10, 10, 10);
          model.position.set(0, -0.5, 0);

          // Center the boat on ground
          const box = new THREE.Box3().setFromObject(model);
          model.position.y = -box.min.y;

          model.userData.forwardAxis = 'x';

          // Add the boat model WITHOUT rotating it first
          npc.mesh.add(model);

          // Store reference to the boat model for rotation calculations
          npc.boatModel = model;

          // Mark boat as loaded
          npc.boatLoaded = true;

          // Update color to final color
          npc.color = 0xff3333;

          // Restore the rotation we had
          npc.mesh.rotation.y = currentRotation;

          // Handle animations
          if (gltf.animations && gltf.animations.length > 0) {
            const mixer = new THREE.AnimationMixer(model);
            const action = mixer.clipAction(gltf.animations[0]);
            action.play();
            npc.mixer = mixer;
            this.mixers.push(mixer);
          }

          // Track loading progress
          this.modelsLoaded++;

          // Update loading indicator
          this.updateLoadingIndicator();
        },
        (progress) => {
          // Optional: show per-NPC progress
        },
        (error) => {
          // Make the loading cube red to show error
          if (npc.mesh.children[0]) {
            npc.mesh.children[0].material.color.setHex(0xff0000);
          }

          // Mark as loaded (with error) so it can be considered for movement if needed
          npc.boatLoaded = true;
          npc.loadError = true;

          this.modelsLoaded++;
          this.updateLoadingIndicator();
        }
      );

      this.npcs.push(npc);
      this.addEntityToWorld(npc);
    }
  }


  // create energy cells in the first maze
  createEnergyCells(numCells = 5) {
    
  this.spawnEnergyCells(this.map, new THREE.Vector3(0, 0, 0), numCells);
  
}

  // create energy cells for a specific map with offset (for second maze)
  createEnergyCellsForMap(map, offset, numCells = 5) {
    
    this.spawnEnergyCells(map, offset, numCells);
  }

  // Spawn energy cells in a given map with offset, ensuring they are placed on valid tiles
  /*
  purpose: spawn energy cells in a specified map with a positional offset, ensuring that they are placed on valid tiles that are walkable, 
  not occupied by other energy cells, and not on the player's current tile.

  parameters:
- map: the map in which to spawn energy cells
- offset: the positional offset to apply when placing energy cells (used for second maze)
- numCells: the number of energy cells to spawn (default is 5)
  */
  spawnEnergyCells(map, offset, numCells = 5) {
    
    let createdCount = 0;
    let attempts = 0;
    const maxAttempts = 1000;

    while (createdCount < numCells && attempts < maxAttempts) {
      attempts++;

      const randomTile =
        map.walkableTiles[Math.floor(Math.random() * map.walkableTiles.length)];

      if (!this.isValidEnergyCellTile(map, randomTile, offset)) {
        continue;
      }

      const cell = new EnergyCell({
        
        tile: randomTile,
        map,
        offset,
        position: map.localize(randomTile).clone().add(offset)
      
      });

      this.energyCells.push(cell);
      this.totalEnergyCells++;
      this.scene.add(cell.mesh);
      createdCount++;
    }
  }

  // Check if a tile is valid for placing an energy cell (walkable, not occupied, not on player)
  /*
  Purpose: determine if a given tile is suitable for placing an energy cell by checking if it's walkable, not already occupied by another energy cell, 
  and not the player's current tile.
  
  parameters:
- map: the map to check against
- tile: the tile being evaluated for energy cell placement
- offset: the positional offset to apply when checking against the player's position (used for second maze)

  */
  isValidEnergyCellTile(map, tile, offset) {
    
    if (!tile || !tile.isWalkable()) {
      
      return false;
    
    }

    const occupied = this.energyCells.some(
      
      (cell) =>
        cell.map === map &&
        cell.tile.row === tile.row &&
        cell.tile.col === tile.col
    
      );

    if (occupied) {
      
      return false;
    
    }

    if (!this.main_character || map !== this.map) {
      
      return true;
    
    }

    const playerTile = map.quantize(
      
      this.main_character.position.clone().sub(offset)
    
    );

    return !(playerTile.row === tile.row && playerTile.col === tile.col);
  }

  
  // Update energy cells - check for collection and update state
  /*
  * purpose: update the state of energy cells and check for collection by the main character.
  * approach: iterate through each energy cell, update its state, and check if it has been collected.
  */
  updateEnergyCells(dt) {
    
    if (!this.main_character || this.energyCells.length === 0) {
      
      return;
    
    }

    for (let cell of this.energyCells) {
      
      if (cell.collected) {
        
        continue;

      }

      cell.update(dt);

      if (
        
        this.main_character.position.distanceTo(cell.position) <=
        this.energyCellCollectionRadius
      
      ) {
        
        cell.collect();
        this.collectedEnergyCells++;
      
      }
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

  // ----- Movement and animation methods (steering based) -----
  /*
  purpose: when a ground attacker is "defeated", respawn it at a valid location in the first maze after a cooldown. 
  This involves finding a new spawn tile that is not too close to the player, the door goal, or other attackers, and resetting the attacker's position and state.
  
  approach: use getRandomWalkableTile to find a new spawn location in the first maze that is not too close to the player, door goal, or other attackers, 
  then reset the attacker's position, velocity, and acceleration.
  
  */
  respawnGroundAttacker(npc) {
    npc.respawn(this.map, {
      goalTile: this.doorGoal,
      playerSpawnPosition: new THREE.Vector3(0, 0, 0),
      peers: this.ground_attackers
    });
  }

  
 /*
 purpose: when a drone is "defeated", respawn it at a valid location in maze 2 after a cooldown. This involves finding a new spawn tile that is not too close to other drones, 
 and resetting the drone's position and state.
 
  approach: use getValidDroneSpawnTile to find a new spawn location in maze 2 that is not too close to existing drones, then reset the drone's position, 
  spawn tile, home tile, and patrol map.
  
  */
  respawnDrone(npc) {
  
    const spawnTile = this.getValidDroneSpawnTile(
    this.map2,
    this.drones.filter((drone) => drone !== npc)
  
  );

  const spawnPos = this.map2.localize(spawnTile).clone().add(this.map2Offset);
  npc.spawnTile = spawnTile;
  npc.homeTile = spawnTile;
  npc.patrolMap = this.map2;
  npc.resetToSpawn(spawnPos);
}

 
/*
purpose: when a drone is "defeated", start a respawn cooldown by hiding it and resetting its position, then after the cooldown it will be respawned at a valid location 
in maze 2. This gives a visual feedback of defeat and prevents immediate respawn on top of the player.

approach: set a respawn timer on the npc, reset its velocity and acceleration, hide its mesh, and move it below the ground. The main update loop will check the respawn timer
 and call respawnDrone when it reaches 0.

 npc -> null
*/
  startDroneRespawnCooldown(npc) {
    
    npc.respawnTimer = this.groundAttackerRespawnDelay;
    npc.velocity.set(0, 0, 0);
    
    if (npc.acceleration) {
      npc.acceleration.set(0, 0, 0);
    }

    npc.mesh.visible = false;
    npc.position.y = -100;
  
  }

  // Update main character movement using steering behaviours
  /*
*purpose: compute a steering force based on player input to move the main character, and handle jumping physics. Also switch between idle and walk animations based on movement.

*approach: calculate desired velocity from input, compute steering force as the difference between desired and current velocity, apply it to the character,
 and handle jump initiation and physics. For animation, check if the character is moving and crossfade between idle and walk animations.

 *timeStep -> null
*/
  updateMainCharacter(dt) {
    
    const input = this.inputHandler;
    
    if (!input) return;

    // Compute desired movement direction in world space
    let desiredVelocity = input.getForce(this.moveSpeed);

    // Steering force = (desired - current) clamped to maxForce
    const currentVel = this.main_character.velocity;
    const steering = desiredVelocity.clone().sub(currentVel);
    steering.clampLength(0, this.maxForce);

    // Apply the steering force to the character
    this.main_character.applyForce(steering);

    // Start jump when space is pressed
    if (input.keys.space && !this.isJumping) {
      
      this.isJumping = true;
      this.jumpVelocity = this.jumpStrength;
    
    }

    // Apply jump physics
    if (this.isJumping) {
      
      this.main_character.position.y += this.jumpVelocity * dt;
      this.jumpVelocity -= this.gravity * dt;

      if (this.main_character.position.y <= this.groundY) {
        
        this.main_character.position.y = this.groundY;
        this.jumpVelocity = 0;
        this.isJumping = false;
      
      }
    }

    // Debug logging (once per second)
    if (!this.logCounter) this.logCounter = 0;
    
    this.logCounter++;
    
    if (this.logCounter >= 60) {
      
      this.logCounter = 0;
    }

    // Animation switching based on speed
    const isMoving = desiredVelocity.length() > 0.1;
    
    if (isMoving) {
      
      const walkAction = this.mainCharacterActions[3];
      const idleAction = this.mainCharacterActions[0];
      
      if (walkAction && this.currentMainAction !== walkAction) {
        
        if (idleAction) idleAction.fadeOut(0.2);
        walkAction.reset().fadeIn(0.2).play();
        this.currentMainAction = walkAction;
      }
    
    } else {
      
      const idleAction = this.mainCharacterActions[0];
      const walkAction = this.mainCharacterActions[1];
      
      if (idleAction && this.currentMainAction !== idleAction) {
        
        if (walkAction) walkAction.fadeOut(0.2);
        
        idleAction.reset().fadeIn(0.2).play();
        this.currentMainAction = idleAction;
      
      }
    }
}

/*
purpose : update the camera to follow the main character 
approach: smoothly interpolate the camera position to a point above and behind the character, and look slightly ahead of the character for better visibility
null -> null
*/
updateCameraFollow() {
  
  if (!this.main_character) return;
  const target = this.main_character.position.clone();

  // higher + a bit farther back so drones are easier to see
  const desiredPosition = target.clone().add(new THREE.Vector3(0, 24, 14));

  this.camera.position.lerp(desiredPosition, 0.08);

  // look slightly ahead instead of directly at player feet
  this.camera.lookAt(target.x, target.y + 2, target.z);

}

// for maze 2 position update
/*
purpose: determine which map (maze 1, maze 2, hallway, or dungeon) the character is currently in based on their position, and return the appropriate map object for collision handling
approach: check the character's position against the bounds of the hallway first, then check against the bounds of maze 1, maze 2, and dungeon in order. 
For maze 2 and dungeon, return a wrapper object that adjusts entity positions
vector -> map object with handleCollisions method 
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

/*
*purpose: update the position of ground attackers by keeping them on the ground, preventing them from escaping to maze 2, and 
adding simple wander/chase/avoid behaviours based on the player's position

*approach: for each ground attacker, first clamp their y position to keep them on the ground. Then check if they have reached the door goal tile - if so, respawn them. 
Next, run the vector field pathfinding to update their path to the door goal. Finally, clamp their position within the bounds of maze 1 and 
snap them to walkable tiles to prevent them from escaping into maze 2.

*@returns null
*/
updateGroundAttackers() {
  
  if (!this.ground_attackers || this.ground_attackers.length === 0) return;
  
  if (!this.doorGoal || !this.groundVectorPathFinding) return;

  for (let npc of this.ground_attackers) {
    npc.prepareForUpdate();

    if (npc.isAtGoalTile(this.doorGoal, this.map)) {
      this.respawnGroundAttacker(npc);
    }
  }

  this.groundVectorPathFinding.runVectorFieldPathFinding(this.doorGoal);

  for (let npc of this.ground_attackers) {
    npc.finalizeMovement(this.map);
  }
}

// Update FSM-driven drone gameplay behaviour.
/*
*purpose: update the position and state of drones in the world
*approach: for each drone, update its position and state based on the finite state machine, and clamp its position within the bounds of maze 2
*@param {number} dt - the time step for the update
*@returns null
*/
updateDrones(dt) {
  
  if (!this.drones || this.drones.length === 0) return;

  for (let drone of this.drones) {
    
    if (drone.respawnTimer > 0) {
      
      drone.respawnTimer -= dt;

      if (drone.respawnTimer <= 0) {
        
        this.respawnDrone(drone);
      
      }

      continue;
    }

    drone.position.y = 1;
    
    if (drone.velocity) drone.velocity.y = 0;
    
    if (drone.acceleration) drone.acceleration.y = 0;

    drone.updateFSM(dt, {
      player: this.main_character,
      world: this
    });
  }

  const minX = this.map2Offset.x + this.map2.minX + 1;
  const maxX = this.map2Offset.x + this.map2.minX + this.map2.cols * this.map2.tileSize - 1;
  const minZ = this.map2.minZ + 1;
  const maxZ = this.map2.minZ + this.map2.rows * this.map2.tileSize - 1;

  for (let drone of this.drones) {
    
    if (drone.respawnTimer > 0) continue;

    drone.position.x = THREE.MathUtils.clamp(drone.position.x, minX, maxX);
    drone.position.z = THREE.MathUtils.clamp(drone.position.z, minZ, maxZ);

    let localPos = drone.position.clone().sub(this.map2Offset);
    let tile = this.map2.quantize(localPos);

    if (!tile || !tile.isWalkable()) {
      let bestTile = null;
      let bestDist = Infinity;

      for (let walkable of this.map2.walkableTiles) {
        let safePos = this.map2.localize(walkable).clone().add(this.map2Offset);
        let dist = safePos.distanceTo(drone.position);

        if (dist < bestDist) {
          bestDist = dist;
          bestTile = walkable;
        }
      }

      if (bestTile) {
        let correctedPos = this.map2.localize(bestTile).clone().add(this.map2Offset);
        drone.position.x = correctedPos.x;
        drone.position.z = correctedPos.z;
        drone.velocity.set(0, 0, 0);
        
        if (drone.acceleration) drone.acceleration.set(0, 0, 0);
      
      }
    }

    drone.position.y = 1;
  }
}

// helper function to create partol loop 
/*
*purpose: create a patrol loop for the dungeon guard in dungeon 3 by finding walkable anchor points near the corners of the dungeon,
 and using JPS pathfinding to connect them into a loop. 
*The resulting patrol path is stored in this.dungeonPatrolPath, and can be visualized with drawDungeon3PatrolLoop
*@returns null
*/
createPatrolLoopInDungeon3() {
  
  if (!this.dungeonMap.walkableTiles || this.dungeonMap.walkableTiles.length === 0) {
    this.dungeonMap.walkableTiles =
      this.dungeonMap.grid.flat().filter(t => t.isWalkable());
  }

  const nearestWalkable = (r, c) => {
    let best = null;
    let bestDist = Infinity;

    for (let t of this.dungeonMap.walkableTiles) {
      
      let d = Math.abs(t.row - r) + Math.abs(t.col - c);
      
      if (d < bestDist) {
        bestDist = d;
        best = t;
      }
    }
    return best;
  };

  const anchors = [
    nearestWalkable(2, 2),
    nearestWalkable(2, this.dungeonMap.cols - 3),
    nearestWalkable(this.dungeonMap.rows - 3, this.dungeonMap.cols - 3),
    nearestWalkable(this.dungeonMap.rows - 3, 2)
  ].filter(Boolean);

  const uniqueAnchors = [];
  const seen = new Set();

  for (let tile of anchors) {
    
    const key = `${tile.row},${tile.col}`;
    
    if (!seen.has(key)) {
      seen.add(key);
      uniqueAnchors.push(tile);
    }
  }

  if (uniqueAnchors.length < 2) {
    this.dungeonPatrolTiles = [];
    this.dungeonPatrolPath = [];
    return;
  }

  const pathfinder = new JPS(this.dungeonMap);

  this.dungeonPatrolTiles = [];

  for (let i = 0; i < uniqueAnchors.length; i++) {
    
    const start = uniqueAnchors[i];
    const goal = uniqueAnchors[(i + 1) % uniqueAnchors.length];

    let segment = pathfinder.findPath(start, goal);

    if (!segment || segment.length === 0) {

      continue;
    
    }

    if (i > 0) {

      segment.shift();
    
    }

    this.dungeonPatrolTiles.push(...segment);
  }

  if (!this.dungeonPatrolTiles || this.dungeonPatrolTiles.length < 2) {
    
    this.dungeonPatrolPath = [];
    return;
  
  }

  this.dungeonPatrolPath = this.dungeonPatrolTiles.map(tile =>
  this.dungeonMap.localize(tile).clone().add(this.dungeonOffset)
  
);
}

// helper function to visualize the patrol loop in dungeon 3
/*
*purpose: visualize the patrol loop for the dungeon guard in dungeon 3 by creating a THREE.LineLoop object that connects the points in this.dungeonPatrolPath. 
*The line is added to the scene and stored in this.dungeonPatrolLine for later removal if needed.
*@returns null
*/
drawDungeon3PatrolLoop() {
  
  if (!this.dungeonPatrolPath || this.dungeonPatrolPath.length < 2) return;

  if (this.dungeonPatrolLine) {
    
    this.scene.remove(this.dungeonPatrolLine);
  
  }

  const points = this.dungeonPatrolPath.map(p => new THREE.Vector3(p.x, 1.5, p.z));
  const geometry = new THREE.BufferGeometry().setFromPoints(points);
  const material = new THREE.LineBasicMaterial({ color: 0xffff00 });

  this.dungeonPatrolLine = new THREE.LineLoop(geometry, material);
  this.scene.add(this.dungeonPatrolLine);

}

// create dungeon guard patrol loop in dungeon 3
/**purpose: create a dungeon guard entity in dungeon 3 that patrols along the path defined by this.dungeonPatrolPath. 
*The guard is represented as a DynamicEntity with a GLTF model, and has properties for chasing the player when they are within a certain radius. 
*The guard's update method will use steering behaviors to either follow the patrol path or pursue the player based on their distance.
*@returns null
*/
createDungeonGuard() {
  
  if (!this.dungeonPatrolPath || this.dungeonPatrolPath.length < 2) {
    
    return;
  
  }

  const spawnIndex = Math.floor(this.dungeonPatrolPath.length / 2);
  const startPos = this.dungeonPatrolPath[spawnIndex].clone();

  this.dungeonGuard = new DungeonGuard({
    patrolPath: this.dungeonPatrolPath,
    spawnIndex,
    position: new THREE.Vector3(startPos.x, 1.0, startPos.z),
    velocity: new THREE.Vector3(0, 0, 0),
    topSpeed: 4.4,
    color: 0xff0000,
    scale: new THREE.Vector3(1, 1, 1)
  });

  this.dungeonGuard.maxForce = 8.0;
  this.dungeonGuard.loadVisual({
    mixers: this.mixers
  });

  this.addEntityToWorld(this.dungeonGuard);

}

// Update the dungeon guard's movement and chasing behaviour in dungeon 3
/*
*purpose: update the position and behavior of the dungeon guard in dungeon 3 by using steering behaviors to either follow its patrol path or pursue the player when they are within a certain radius. 
*The guard will also be clamped within the bounds of the dungeon and will snap to walkable tiles to prevent it from escaping into the hallway.
*@param {number} dt - the time step for the update
*@returns null
*/
updateDungeonGuard(dt) {
  if (!this.dungeonGuard) return;

  this.dungeonGuard.updateBehavior(dt, {
    player: this.main_character,
    dungeonMap: this.dungeonMap,
    dungeonOffset: this.dungeonOffset
  });
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


// for safe exit 
/**purpose: randomly convert a certain number of walkable tiles in maze 2 to medium terrain tiles, which serve as safe spots for the player to hide from drones. 
*The function first collects all valid walkable tiles that are not already medium terrain, shuffles them randomly, and then converts the first N tiles to medium terrain.
*@param {Map} map - the map object representing maze 2
*@param {number} count - the number of tiles to convert to medium terrain (default is 8)
*@returns null
*/
addExtraGreenTiles(map, count = 8) {
  // get ALL valid tiles first
  let candidates = map.walkableTiles.filter(
    tile => tile.type !== Tile.Type.MediumTerrain
  );

  // shuffle randomly
  for (let i = candidates.length - 1; i > 0; i--) {
    
    let j = Math.floor(Math.random() * (i + 1));
    [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
  
  }

  // take first N tiles
  let selected = candidates.slice(0, count);

  // convert to green
  for (let tile of selected) {
    
    tile.type = Tile.Type.EasyTerrain;
  
  }
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
  this.updateMainCharacter(dt);
  this.updateDungeonGuard(dt);
  // Update main character animation mixer if present
  if (this.mainCharacterMixer) {
    
    this.mainCharacterMixer.update(dt);
  
  }

  // Update animation mixers for loaded boats
  for (let mixer of this.mixers) {
    
    mixer.update(dt);
  
  }

  //updateGroundAttacker with new steering behaviours
  this.updateGroundAttackers();
  this.updateDrones(dt);

  // Update all entities (this includes the main character)
  for (let e of this.entities) {
    
    if (e === this.dungeonGuard) continue;

    if (e.update) {
      
      e.update(dt, this.getMapAdapterForPosition(e.position));
    
    }
  }

  this.updateEnergyCells(dt);
  this.updateControllerExitState(dt);

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
  this.updateCameraFollow();

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

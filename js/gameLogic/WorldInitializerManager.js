import * as THREE from 'three';
import * as Setup from '../setup.js';
import { TileMap } from '../maps/TileMap.js';
import { TileMapRenderer } from '../renderers/TileMapRenderer.js';
import { VectorPathFinding } from '../ai/pathfinding/vectorPathFinding.js';
import { HierarchicalAStar } from '../ai/pathfinding/HierarchicalAStar.js';
import { DungeonGenerator } from '../pcg/DungeonGenerator.js';
import { GroundAttackers } from '../entities/GroundAttackers.js';
import { DroneEntity } from '../entities/DroneEntity.js';
import { DungeonGuard } from '../entities/DungeonGuard.js';
import { MainCharacter } from '../entities/MainCharacter.js';
import { EnergyCellManager } from './EnergyCellManager.js';
import { WorldLayoutManager } from './WorldLayoutManager.js';
import { WorldCollisionManager } from './WorldCollisionManager.js';
import { LoadingManager } from './LoadingManager.js';
import { WorldResetManager } from './WorldResetManager.js';

/*
Purpose : The WorldInitializer class is responsible for setting up the game world by creating the tile maps for the mazes and dungeon, 
rendering them in the scene, creating hallway connections between the mazes and dungeon, placing the main character 
and other entities in the world, and initializing the necessary properties and references for gameplay mechanics such as energy cell collection
 and controller exit unlocking. 

 This class serves as the central point for initializing all aspects of the game world before the game starts running.
*/
export class WorldInitializer {
  constructor(world) {
    this.world = world;
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
  this.world.loadingComplete = false;
  this.world.modelsLoaded = 0;
  this.world.modelsLoading = 0;

  // world layout manager to handle the creation of the mazes, dungeon, and hallway connections between them with proper alignment and walkable paths for the player to navigate through the world and reach the controller exit in the dungeon after collecting enough energy cells
  this.world.worldLayoutManager = new WorldLayoutManager(this.world);
  this.world.worldCollisionManager = new WorldCollisionManager(this.world);
  
  // ----- create two mazes -----
  this.world.map = new TileMap(2); // maze 1 is generated with algorithm 2 for more complexity and longer paths
  this.world.map2 = new TileMap(2); // maze 2 is also generated with algorithm 2 for more complexity and longer paths
  this.world.dungeonMap = new TileMap(2); // dungeon map is generated with algorithm 2 for more complexity and interesting layouts, but we will heavily modify it with our own dungeon generator to create a more structured and engaging dungeon experience
  DungeonGenerator.generate(this.world.dungeonMap, 4); // generate a dungeon with 4 rooms using the dungeon generator
   
  //lighting the surroundings
  Setup.createLight(this.world.scene);
  
  //Setup.showHelpers(this.world.scene, this.world.camera, this.world.renderer, this.world.map);

  // gap between first two mazes
  this.world.mazeGap = 4;

  // full width of one maze in world units
  this.world.mapWorldWidth = this.world.map.cols * this.world.map.tileSize;

  // offset for second maze
  this.world.map2Offset = new THREE.Vector3(this.world.mapWorldWidth + this.world.mazeGap, 0, 0);

  // ----- create hallway connection between mazes -----
  let preferredRow = Math.floor(this.world.map.rows / 2);
  let row1 = this.world.worldLayoutManager.findClosestWalkableRow(this.world.map, preferredRow, 'right');
  let row2 = this.world.worldLayoutManager.findClosestWalkableRow(this.world.map2, preferredRow, 'left');

  this.world.connectionRow = row1;
  if (this.world.map2.grid[this.world.connectionRow] && this.world.map2.grid[this.world.connectionRow][1].isWalkable()) {
    row2 = this.world.connectionRow;
  } else {
    this.world.connectionRow = row2;
    row1 = this.world.worldLayoutManager.findClosestWalkableRow(this.world.map, this.world.connectionRow, 'right');
  }

  this.world.worldLayoutManager.openMazeSide(this.world.map, row1, 'right');
  this.world.worldLayoutManager.openMazeSide(this.world.map2, row2, 'left');

  // ================================
  // THIRD DUNGEON with 4 rooms 
  // ================================

  this.world.dungeonGap = 4;
  this.world.map2WorldWidth = this.world.map2.cols * this.world.map2.tileSize;

  this.world.dungeonOffset = new THREE.Vector3(
    this.world.map2Offset.x + this.world.map2WorldWidth + this.world.dungeonGap,
    0,
    0
  );

  // ----- create hallway connection between map 2 and dungeon -----
  let rowMap2ToDungeon = this.world.worldLayoutManager.findClosestWalkableRow(this.world.map2, preferredRow, 'right');
  let row3 = this.world.worldLayoutManager.findClosestWalkableRow(this.world.dungeonMap, preferredRow, 'left');

  this.world.connectionRow2 = rowMap2ToDungeon;

  if (
    this.world.dungeonMap.grid[this.world.connectionRow2] &&
    this.world.dungeonMap.grid[this.world.connectionRow2][1] &&
    this.world.dungeonMap.grid[this.world.connectionRow2][1].isWalkable()
  ) {
    row3 = this.world.connectionRow2;
  } else {
    this.world.connectionRow2 = row3;
    rowMap2ToDungeon = this.world.worldLayoutManager.findClosestWalkableRow(this.world.map2, this.world.connectionRow2, 'right');
  }
  
  // open the sides of the mazes to create doorways for the hallways between map 1 and map 2, and between map 2 and the dungeon
  this.world.worldLayoutManager.openMazeSide(this.world.map2, rowMap2ToDungeon, 'right');
  this.world.worldLayoutManager.openMazeSide(this.world.dungeonMap, row3, 'left');

  // ONLY connect the dungeon door into the dungeon interior
  // do NOT carve through map2, that breaks maze2 movement
  this.world.worldLayoutManager.connectSideToInterior(this.world.dungeonMap, row3, 'left');

  this.world.map.walkableTiles = this.world.map.grid.flat().filter(tile => tile.isWalkable());
  this.world.map2.walkableTiles = this.world.map2.grid.flat().filter(tile => tile.isWalkable());
  this.world.dungeonMap.walkableTiles = this.world.dungeonMap.grid.flat().filter(tile => tile.isWalkable());
  // create hierarchical pathfinder for drones in maze 2 with cluster size of 5 for good performance and still challenging movement as they chase the player through the larger and more complex maze 2
  this.world.droneHierarchicalPathfinder = new HierarchicalAStar(this.world.map2, {
  clusterSize: this.world.droneClusterSize
});


  // ADD EXTRA GREEN (SAFE) TILES IN MAP 2 for lowering the difficulites in maze 2 
  this.world.worldLayoutManager.addExtraGreenTiles(this.world.map2, 8); // 8 tiles

  // ----- render first maze in the scene -----
  this.world.mazeGroup1 = new THREE.Group();
  this.world.scene.add(this.world.mazeGroup1);
 
  // render the first maze with fences as obstacles for more visual interest and to create more defined pathways and cover for the player as they navigate through maze 1, while also providing a consistent visual theme with the fence obstacles appearing throughout the world including in the second maze and dungeon
  this.world.tileMapRenderer = new TileMapRenderer(this.world.map, {
    useFenceObstacles: true,
    fencePath: '/fence/scene.gltf',
    fenceScale: new THREE.Vector3(0.4, 0.4, 0.4)
  });
  this.world.tileMapRenderer.render(this.world.mazeGroup1);

  // ----- render second maze in the scene -----
  this.world.mazeGroup2 = new THREE.Group();
  this.world.mazeGroup2.position.copy(this.world.map2Offset);
  this.world.scene.add(this.world.mazeGroup2);

  // render the second maze with fences as obstacles for more visual interest and to create more defined pathways and cover for the player as they navigate through maze 2, while also providing a consistent visual theme with the fence obstacles appearing throughout the world including in the first maze and dungeon
  this.world.tileMapRenderer2 = new TileMapRenderer(this.world.map2, {
    useFenceObstacles: true,
    fencePath: '/fence/scene.gltf',
    fenceScale: new THREE.Vector3(0.5, 0.5, 0.5)
  });
  // render the second maze with fences as obstacles for more visual interest and to create more defined pathways and cover for the player as they navigate through maze 2, while also providing a consistent visual theme with the fence obstacles appearing throughout the world including in the first maze and dungeon
  this.world.tileMapRenderer2.render(this.world.mazeGroup2);
  
  // `----- render dungeon in the scene -----`
  this.world.dungeonGroup = new THREE.Group(); // to hold all the meshes for the dungeon and allow us to easily position the entire dungeon in the world with an offset so that it is placed to the right of the second maze with a gap in between for the hallway connection, while also keeping all the dungeon meshes organized under one parent group in the scene graph for better structure and easier management of the dungeon as a whole
  this.world.dungeonGroup.position.copy(this.world.dungeonOffset);
  this.world.scene.add(this.world.dungeonGroup);

  this.world.dungeonRenderer = new TileMapRenderer(this.world.dungeonMap, {
    useFenceObstacles: false
  });
  this.world.dungeonRenderer.render(this.world.dungeonGroup);


  // ----- render hallway between map 1 and map 2 -----
  this.world.worldLayoutManager.createHallway(row1, row2);

  // ----- render hallway between map 2 and dungeon -----
  this.world.worldLayoutManager.createHallwayBetweenMap2AndDungeon(rowMap2ToDungeon, row3);

  this.world.dungeonEntryTile = this.world.dungeonMap.grid[row3][0];
  this.world.controllerExitTile = this.world.worldLayoutManager.findFarthestWalkableTile(
    this.world.dungeonMap,
    this.world.dungeonEntryTile
  );
  this.world.controllerExitManager.createControllerExit();

  // -------- DOOR GOAL --------
  this.world.doorGoal = this.world.map.grid[row1][this.world.map.cols - 1];
  if (!this.world.doorGoal.isWalkable()) {
    this.world.doorGoal = this.world.map.grid[row1][this.world.map.cols - 2];
  }

  // main character
  this.world.mainCharacterManager = new MainCharacter(this.world);
  this.world.mainCharacterManager.createMainCharacter();

  // crreate 10 ground attackers
  this.world.groundAttackerManager = new GroundAttackers(this.world);
  this.world.groundAttackerManager.create(7); // create 10 ground attackers in maze 1 to chase the player and create dynamic and challenging gameplay as they respawn after reaching the door goal to keep up the pressure on the player and make maze 1 more engaging

  // vector pathfinding 
  this.world.groundVectorPathFinding = new VectorPathFinding(
    this.world.map,
    this.world.ground_attackers,
    this.world.scene,
    this.world.debugVisuals
  );

  this.world.groundVectorPathFinding.buildCostField(this.world.doorGoal);
  this.world.groundVectorPathFinding.allTileArrows(this.world.doorGoal);

  
  //this.createGoals(5);
  this.world.loadingIndicatorManager = new LoadingManager(this.world);
  this.world.loadingIndicatorManager.createLoadingIndicator();
  this.world.worldResetManager = new WorldResetManager(this.world);
  // Drone manager
  this.world.droneManager = new DroneEntity(this.world);
  this.world.droneManager.create(3); // create 10 drones in maze 2 to chase the player and create dynamic and challenging gameplay as they navigate through the larger and more complex maze 2, while also showcasing the hierarchical pathfinding with a cluster size of 5 for good performance and still intelligent movement from the drones as they pursue the player through maze 2

  
  // Dungeon guard Mananager
  this.world.dungeonGuardManager = new DungeonGuard(this.world);

  this.world.dungeonGuardManager.createPatrolLoopInDungeon3();
  
  this.world.dungeonGuardManager.drawDungeon3PatrolLoop();

  this.world.dungeonGuardManager.createDungeonGuard();


  //create energy cells for unlocking controller exit
  this.world.energyCellManager = new EnergyCellManager(this.world);
  this.world.energyCellManager.createEnergyCells(3);

  //this.createGoalsForMap(this.world.map2, this.world.map2Offset, 5);
  //this.createNPCsForMap(this.world.map2, this.world.map2Offset, 10);
  this.world.energyCellManager.createEnergyCellsForMap(this.world.map2, this.world.map2Offset, 3);
  this.world.energyCellManager.createEnergyCellsForMap(this.world.dungeonMap, this.world.dungeonOffset, 3);
  this.world.controllerExitManager.updateEnergyUnlockRequirement();
  }
}
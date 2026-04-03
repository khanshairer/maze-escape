import * as THREE from 'three';
import * as Setup from './setup.js';
import { InputHandler } from './input/InputHandler.js';
import { TileMap } from './maps/TileMap.js';
import { Tile } from './maps/Tile.js';
import { TileMapRenderer } from './renderers/TileMapRenderer.js';
import { DynamicEntity } from './entities/DynamicEntity.js';
import { DroneEnemy } from './entities/DroneEnemy.js';
import { EnergyCell } from './entities/EnergyCell.js';
import { GLTFLoader } from 'three/examples/jsm/Addons.js';
import { VectorPathFinding } from './ai/pathfinding/vectorPathFinding.js';
import { HierarchicalAStar } from './ai/pathfinding/HierarchicalAStar.js';
import { DebugVisuals } from './debug/DebugVisuals.js';
import { DungeonGenerator } from './pcg/DungeonGenerator.js';
import { JPS } from './ai/pathfinding/JPS.js';
import { ReynoldsPathFollowing } from './ai/steering/ReynoldsPathFollowing.js';
import { SteeringBehaviours } from './ai/steering/SteeringBehaviours.js';
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
    this.goals = [];
    this.npcs = [];
    this.mixers = [];
    this.ground_attackers = [];
    this.energyCells = [];
    this.drones = [];
    this.collectedEnergyCells = 0;
    this.totalEnergyCells = 0;
    this.unlockRequirementFraction = 0.5;
    this.energyCellsRequiredForUnlock = 0;
    this.energyCellCollectionRadius = 1.5;
    this.controllerExit = null;
    this.controllerExitTile = null;
    this.controllerExitUnlocked = false;
    this.controllerExitReached = false;
    this.controllerExitActivationRadius = 1.8;
    this.groundAttackerRespawnDelay = 4;
    this.droneClusterSize = 5;

    // Main character animation mixer and actions
    this.mainCharacterMixer = null;
    this.mainCharacterActions = {};   // stores AnimationAction objects by index/name
    this.currentMainAction = null;    // currently playing action

    // Movement speed (units per second)
    this.moveSpeed = 5.0;
    // Steering force limit
    this.maxForce = 10.0;

    // Add loading tracking
    this.modelsLoading = 0;
    this.modelsLoaded = 0;
    this.loadingComplete = false;

    // for jumping 
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
    this.debugVisuals = new DebugVisuals(this.scene);
  }

  // Initialize objects in our world
  // Initialize objects in our world
init() {
  this.loadingComplete = false;
  this.modelsLoaded = 0;
  this.modelsLoading = 0;

  // ----- create two mazes -----
  this.map = new TileMap(2);
  this.map2 = new TileMap(2);
  this.dungeonMap = new TileMap(2);
  DungeonGenerator.generate(this.dungeonMap, 4);

  Setup.createLight(this.scene);
  Setup.showHelpers(this.scene, this.camera, this.renderer, this.map);

  // gap between the two mazes
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
  // THIRD DUNGEON
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

  this.openMazeSide(this.map2, rowMap2ToDungeon, 'right');
  this.openMazeSide(this.dungeonMap, row3, 'left');

  // ONLY connect the dungeon door into the dungeon interior
  // do NOT carve through map2, that breaks maze2 movement
  this.connectSideToInterior(this.dungeonMap, row3, 'left');

  this.map.walkableTiles = this.map.grid.flat().filter(tile => tile.isWalkable());
  this.map2.walkableTiles = this.map2.grid.flat().filter(tile => tile.isWalkable());
  this.dungeonMap.walkableTiles = this.dungeonMap.grid.flat().filter(tile => tile.isWalkable());
  this.droneHierarchicalPathfinder = new HierarchicalAStar(this.map, {
    clusterSize: this.droneClusterSize
  });

  // ----- render first maze -----
  this.mazeGroup1 = new THREE.Group();
  this.scene.add(this.mazeGroup1);

  this.tileMapRenderer = new TileMapRenderer(this.map, {
    useFenceObstacles: true,
    fencePath: '/fence/scene.gltf',
    fenceScale: new THREE.Vector3(0.4, 0.4, 0.4)
  });
  this.tileMapRenderer.render(this.mazeGroup1);

  // ----- render second maze -----
  this.mazeGroup2 = new THREE.Group();
  this.mazeGroup2.position.copy(this.map2Offset);
  this.scene.add(this.mazeGroup2);

  this.tileMapRenderer2 = new TileMapRenderer(this.map2, {
    useFenceObstacles: true,
    fencePath: '/fence/scene.gltf',
    fenceScale: new THREE.Vector3(0.5, 0.5, 0.5)
  });
  this.tileMapRenderer2.render(this.mazeGroup2);

  this.dungeonGroup = new THREE.Group();
  this.dungeonGroup.position.copy(this.dungeonOffset);
  this.scene.add(this.dungeonGroup);

  this.dungeonRenderer = new TileMapRenderer(this.dungeonMap, {
    useFenceObstacles: false
  });
  this.dungeonRenderer.render(this.dungeonGroup);

  // ================================

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

  // attackers
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
  this.createGameplayDrones(4);
  this.createNPCs(10);
  this.createPatrolLoopInDungeon3();
  this.drawDungeon3PatrolLoop();
  this.createDungeonGuard();
  this.createEnergyCells(5);

  //this.createGoalsForMap(this.map2, this.map2Offset, 5);
  this.createNPCsForMap(this.map2, this.map2Offset, 10);
  this.createEnergyCellsForMap(this.map2, this.map2Offset, 5);
  this.updateEnergyUnlockRequirement();
}

  findFarthestWalkableTile(map, fromTile) {
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

  updateControllerExitState(dt) {
    if (!this.controllerExit) {
      return;
    }

    this.controllerExitUnlocked =
      this.energyCellsRequiredForUnlock > 0 &&
      this.collectedEnergyCells >= this.energyCellsRequiredForUnlock;

    this.updateControllerExitVisualState(dt);
  }

  updateEnergyUnlockRequirement() {
    this.energyCellsRequiredForUnlock = Math.ceil(
      this.totalEnergyCells * this.unlockRequirementFraction
    );
  }

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

  createGameplayDrones(numDrones = 4) {
    this.drones = [];
    this.modelsLoading += numDrones;

    for (let i = 0; i < numDrones; i++) {
      const droneTile = this.getValidDroneSpawnTile(this.map, this.drones);
      const dronePosition = this.map.localize(droneTile);

      const drone = new DroneEnemy({
        spawnTile: droneTile,
        homeTile: droneTile,
        patrolMap: this.map,
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
      this.drones.push(drone);
      this.addEntityToWorld(drone);
    }
  }

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
        spawnPosition.distanceTo(new THREE.Vector3(0, 0, 0)) < 6 ||
        spawnPosition.distanceTo(this.map.localize(this.doorGoal)) < 6 ||
        existingDrones.some((drone) => drone.position.distanceTo(spawnPosition) < 5)
      )
    );

    return spawnTile;
  }

  loadDroneVisual(drone) {
    const loader = new GLTFLoader();
    loader.load(
      '/animated_drone/scene.gltf',
      (gltf) => {
        drone.applyDroneModel(gltf, this.mixers);
        this.modelsLoaded++;
        this.updateLoadingIndicator();
      },
      undefined,
      () => {
        drone.handleLoadError();
        this.modelsLoaded++;
        this.updateLoadingIndicator();
      }
    );
  }


  // create 10 ground attackers in the first maze (for vector pathfinding testing)
  createGroundAttackers(numAttackers = 10) {
  this.ground_attackers = [];
  this.modelsLoading += numAttackers;

  for (let i = 0; i < numAttackers; i++) {
    let attackerTile;
    let attackerPosition;
    let tries = 0;

    do {
      attackerTile = this.map.getRandomWalkableTile();
      attackerPosition = this.map.localize(attackerTile);
      tries++;
    } while (
      tries < 300 &&
      (
        attackerPosition.distanceTo(new THREE.Vector3(0, 0, 0)) < 6 ||
        attackerPosition.distanceTo(this.map.localize(this.doorGoal)) < 6 ||
        this.ground_attackers.some(a => a.position.distanceTo(attackerPosition) < 5)
      )
    );

    let attacker = new DynamicEntity({
      position: attackerPosition.clone(),
      velocity: new THREE.Vector3(0, 0, 0),
      color: 0x660000,
      scale: new THREE.Vector3(1, 0.75, 1)
    });

    attacker.boatLoaded = false;
    attacker.position.y = 1;
    attacker.modelFacingOffset = 0;

    const loader = new GLTFLoader();
    loader.load(
      '/sphere_robot/scene.gltf',
      (gltf) => {
        const model = gltf.scene;

        while (attacker.mesh.children.length > 0) {
          attacker.mesh.remove(attacker.mesh.children[0]);
        }

        model.scale.set(2.2, 2.2, 2.2);

        const box = new THREE.Box3().setFromObject(model);
        model.position.y = -box.min.y;
        model.rotation.y = 0;

        attacker.mesh.add(model);
        attacker.robotModel = model;
        attacker.boatLoaded = true;

        if (gltf.animations && gltf.animations.length > 0) {
          const mixer = new THREE.AnimationMixer(model);
          const action = mixer.clipAction(gltf.animations[0]);
          action.play();
          attacker.mixer = mixer;
          this.mixers.push(mixer);
        }

        this.modelsLoaded++;
        this.updateLoadingIndicator();
      },
      undefined,
      (error) => {
        console.log('❌ failed to load sphere_robot:', error);
        attacker.boatLoaded = true;
        attacker.loadError = true;
        this.modelsLoaded++;
        this.updateLoadingIndicator();
      }
    );

    this.ground_attackers.push(attacker);
    this.addEntityToWorld(attacker);
  }
}

  // create npcs with visual loading feedback
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

  createEnergyCells(numCells = 5) {
    this.spawnEnergyCells(this.map, new THREE.Vector3(0, 0, 0), numCells);
  }

  createEnergyCellsForMap(map, offset, numCells = 5) {
    this.spawnEnergyCells(map, offset, numCells);
  }

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
  addEntityToWorld(entity) {
    this.scene.add(entity.mesh);
    this.entities.push(entity);
  }

  // ----- Movement and animation methods (steering based) -----
  respawnGroundAttacker(npc) {
  let spawnTile;
  let spawnPos;
  let tries = 0;

  do {
    spawnTile = this.map.getRandomWalkableTile();
    spawnPos = this.map.localize(spawnTile);
    tries++;
  } while (
    tries < 300 &&
    (
      spawnPos.distanceTo(new THREE.Vector3(0, 0, 0)) < 6 ||
      spawnPos.distanceTo(this.map.localize(this.doorGoal)) < 6 ||
      this.ground_attackers.some(a =>
        a !== npc && a.position.distanceTo(spawnPos) < 5
      )
    )
  );

  npc.position.copy(spawnPos);
  npc.position.y = 1;

  npc.velocity.set(0, 0, 0);
  if (npc.acceleration) npc.acceleration.set(0, 0, 0);
}

  respawnDrone(npc) {
    const spawnTile = this.getValidDroneSpawnTile(
      this.map,
      this.drones.filter((drone) => drone !== npc)
    );
    const spawnPos = this.map.localize(spawnTile);

    npc.spawnTile = spawnTile;
    npc.homeTile = spawnTile;
    npc.resetToSpawn(spawnPos);
  }

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
      console.log('[DEBUG] Input:', {
        w: input.keys.w,
        a: input.keys.a,
        s: input.keys.s,
        d: input.keys.d,
        space: input.keys.space
      });
      
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

  updateCameraFollow() {
  if (!this.main_character) return;

  const target = this.main_character.position.clone();

  // closer + lower camera
  const desiredPosition = target.clone().add(new THREE.Vector3(0, 15, 8));

  // smooth follow
  this.camera.position.lerp(desiredPosition, 0.08);

  // look at player
  this.camera.lookAt(target.x, target.y, target.z);
}

// for maze 2 position update 
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
getMapAdapterForPosition(position) {
  return this.getMapForPosition(position);
}
//clamp main character in dungeon 3 helper function
clampPositionToDungeon(entity) {
  const minX = this.dungeonOffset.x + this.dungeonMap.minX + 0.1;
  const maxX = this.dungeonOffset.x + this.dungeonMap.minX + this.dungeonMap.cols * this.dungeonMap.tileSize - 0.1;
  const minZ = this.dungeonMap.minZ + 0.1;
  const maxZ = this.dungeonMap.minZ + this.dungeonMap.rows * this.dungeonMap.tileSize - 0.1;

  entity.position.x = THREE.MathUtils.clamp(entity.position.x, minX, maxX);
  entity.position.z = THREE.MathUtils.clamp(entity.position.z, minZ, maxZ);
}

//helper for Update Ground Attacker
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

// add wander behaviour for ground attacker
updateGroundAttackers() {
  if (!this.ground_attackers || this.ground_attackers.length === 0) return;
  if (!this.doorGoal || !this.groundVectorPathFinding) return;

  for (let npc of this.ground_attackers) {
    npc.position.y = 1;
    if (npc.velocity) npc.velocity.y = 0;
    if (npc.acceleration) npc.acceleration.y = 0;

    const currentTile = this.map.quantize(npc.position);

    // respawn as soon as attacker reaches the goal tile
    if (
      currentTile &&
      currentTile.row === this.doorGoal.row &&
      currentTile.col === this.doorGoal.col
    ) {
      this.respawnGroundAttacker(npc);
      continue;
    }
  }

  this.groundVectorPathFinding.runVectorFieldPathFinding(this.doorGoal);

  const minX = this.map.minX + 1;
  const maxX = this.map.minX + this.map.cols * this.map.tileSize - 1;
  const minZ = this.map.minZ + 1;
  const maxZ = this.map.minZ + this.map.rows * this.map.tileSize - 1;

  for (let npc of this.ground_attackers) {
    npc.position.x = THREE.MathUtils.clamp(npc.position.x, minX, maxX);
    npc.position.z = THREE.MathUtils.clamp(npc.position.z, minZ, maxZ);
    this.snapEntityToWalkableTile(npc);
    npc.position.y = 1;
  }
}

// Update FSM-driven drone gameplay behaviour.
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

  const minX = this.map.minX + 1;
  const maxX = this.map.minX + this.map.cols * this.map.tileSize - 1;
  const minZ = this.map.minZ + 1;
  const maxZ = this.map.minZ + this.map.rows * this.map.tileSize - 1;

  for (let drone of this.drones) {
    drone.position.x = THREE.MathUtils.clamp(drone.position.x, minX, maxX);
    drone.position.z = THREE.MathUtils.clamp(drone.position.z, minZ, maxZ);
    this.snapEntityToWalkableTile(drone);
    drone.position.y = 1;
  }
}

// helper function to create partol loop 
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

    console.log('JPS segment:', start, '->', goal, '=', segment ? segment.length : 0);

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
createDungeonGuard() {
  if (!this.dungeonPatrolPath || this.dungeonPatrolPath.length < 2) {
    console.log("❌ dungeon patrol path not ready");
    return;
  }

  const spawnIndex = Math.floor(this.dungeonPatrolPath.length / 2);
  const startPos = this.dungeonPatrolPath[spawnIndex].clone();

  this.dungeonGuard = new DynamicEntity({
    position: new THREE.Vector3(startPos.x, 1.0, startPos.z),
    velocity: new THREE.Vector3(0, 0, 0),
    topSpeed: 4.4,
    color: 0xff0000,
    scale: new THREE.Vector3(1, 1, 1)
  });

  this.dungeonGuard.isDungeonGuard = true;
  this.dungeonGuard.maxForce = 8.0;

  this.dungeonGuard.pathFollower = {
    path: this.dungeonPatrolPath,
    segmentIndex: spawnIndex,
    pathRadius: 0.25,
    predictDistance: 0.15,
    targetOffset: 0.08
  };

  this.dungeonGuard.modelFacingOffset = 0;

  this.dungeonGuard.detectRadius = 12;
  this.dungeonGuard.catchRadius = 1.5;
  this.dungeonGuard.isChasing = false;
  this.dungeonGuard.lookAhead = 0.6;

  const tempBody = new THREE.Mesh(
    new THREE.BoxGeometry(1.2, 2.0, 1.2),
    new THREE.MeshStandardMaterial({
      color: 0xff0000,
      emissive: 0x330000
    })
  );
  tempBody.position.set(0, 1.0, 0);
  this.dungeonGuard.mesh.add(tempBody);
  this.dungeonGuard.tempBody = tempBody;

  const loader = new GLTFLoader();
  loader.load(
    '/walking_mario/scene.gltf',
    (gltf) => {
      const model = gltf.scene;

      if (this.dungeonGuard.tempBody) {
        this.dungeonGuard.mesh.remove(this.dungeonGuard.tempBody);
        this.dungeonGuard.tempBody.geometry.dispose();
        this.dungeonGuard.tempBody.material.dispose();
        this.dungeonGuard.tempBody = null;
      }

      while (this.dungeonGuard.mesh.children.length > 0) {
        this.dungeonGuard.mesh.remove(this.dungeonGuard.mesh.children[0]);
      }

      model.scale.set(0.015, 0.015, 0.015);

      const box = new THREE.Box3().setFromObject(model);
      model.position.y = -box.min.y;
      model.rotation.y = 0;

      this.dungeonGuard.mesh.add(model);
      this.dungeonGuard.guardModel = model;

      if (gltf.animations && gltf.animations.length > 0) {
        const mixer = new THREE.AnimationMixer(model);
        this.dungeonGuard.mixer = mixer;
        this.mixers.push(mixer);

        const clipIndex = gltf.animations[1] ? 1 : 0;
        const action = mixer.clipAction(gltf.animations[clipIndex]);
        action.reset();
        action.setEffectiveTimeScale(0.35);
        action.play();

        this.dungeonGuard.currentAction = action;

        console.log("✅ dungeon guard animation playing:", clipIndex);
      } else {
        console.log("⚠️ no animations found on walking_mario");
      }
    },
    undefined,
    (error) => {
      console.log("❌ failed to load walking_mario:", error);
    }
  );

  this.addEntityToWorld(this.dungeonGuard);

  console.log("✅ dungeon guard created at:", this.dungeonGuard.position);
}

updateDungeonGuard(dt) {
  if (!this.dungeonGuard) return;
  if (!this.dungeonGuard.pathFollower) return;
  if (!this.main_character) return;

  const pf = this.dungeonGuard.pathFollower;
  const path = pf.path;

  if (!path || path.length < 2) return;

  const toPlayer = this.main_character.position.clone().sub(this.dungeonGuard.position);
  toPlayer.y = 0;
  const playerDistance = toPlayer.length();

  this.dungeonGuard.isChasing = playerDistance <= this.dungeonGuard.detectRadius;

  let steering;

  if (this.dungeonGuard.isChasing) {
    steering = SteeringBehaviours.pursue(
      this.dungeonGuard,
      this.main_character,
      this.dungeonGuard.lookAhead
    );
  } else {
    steering = ReynoldsPathFollowing.followLoop(this.dungeonGuard);
  }

  steering.clampLength(0, this.dungeonGuard.maxForce);
  this.dungeonGuard.applyForce(steering);

  const dungeonAdapter = {
    handleCollisions: (entity) => {
      const fakeEntity = {
        ...entity,
        position: entity.position.clone().sub(this.dungeonOffset)
      };

      const corrected = this.dungeonMap.handleCollisions(fakeEntity);
      return corrected.add(this.dungeonOffset);
    }
  };

  this.dungeonGuard.update(dt, dungeonAdapter);
  this.dungeonGuard.position.y = 1.0;

  this.dungeonGuard.velocity.y = 0;
  this.dungeonGuard.velocity.clampLength(0, this.dungeonGuard.topSpeed);

  let facingDir = new THREE.Vector3();

  if (this.dungeonGuard.isChasing) {
    facingDir = this.main_character.position.clone().sub(this.dungeonGuard.position);
    facingDir.y = 0;
  } else {
    const a = path[pf.segmentIndex % path.length];
    const b = path[(pf.segmentIndex + 1) % path.length];

    const ab = b.clone().sub(a);
    const abLenSq = ab.lengthSq();

    if (abLenSq > 0) {
      const ap = this.dungeonGuard.position.clone().sub(a);
      let t = ap.dot(ab) / abLenSq;
      t = THREE.MathUtils.clamp(t, 0, 1);

      const closestPoint = a.clone().add(ab.clone().multiplyScalar(t));
      const offsetFromPath = this.dungeonGuard.position.clone().sub(closestPoint);
      offsetFromPath.y = 0;

      const maxDrift = pf.pathRadius ?? 0.25;

      if (offsetFromPath.length() > maxDrift) {
        const correctedPos = closestPoint.clone();
        correctedPos.y = 1.0;
        this.dungeonGuard.position.lerp(correctedPos, 0.2);

        this.dungeonGuard.velocity.multiplyScalar(0.5);
        this.dungeonGuard.velocity.y = 0;
        this.dungeonGuard.velocity.clampLength(0, this.dungeonGuard.topSpeed);
      }
    }

    facingDir = b.clone().sub(a);
    facingDir.y = 0;
  }

  if (facingDir.lengthSq() > 0.0001) {
    facingDir.normalize();

    const moveAngle = Math.atan2(facingDir.x, facingDir.z);
    const facingOffset = this.dungeonGuard.modelFacingOffset ?? 0;
    this.dungeonGuard.mesh.rotation.y = moveAngle + facingOffset;
  }
}
// restart 
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
  render() {
    this.renderer.render(this.scene, this.camera);
  }
}

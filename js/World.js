import * as THREE from 'three';
import * as Setup from './setup.js';
import { InputHandler } from './input/InputHandler.js';
import { TileMap } from './maps/TileMap.js';
import { Tile } from './maps/Tile.js';
import { TileMapRenderer } from './renderers/TileMapRenderer.js';
import { DynamicEntity } from './entities/DynamicEntity.js';
import { GLTFLoader } from 'three/examples/jsm/Addons.js';
import { VectorPathFinding } from './ai/pathfinding/vectorPathFinding.js';
import { DebugVisuals } from './debug/DebugVisuals.js';
import { DungeonGenerator } from './pcg/DungeonGenerator.js';
import { DungeonGuard } from './enemies/dungeon_guard.js';
import { AStar } from './ai/pathfinding/aStar.js';
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
    this.dungeon_guards = [];

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

  this.mazeGap = 4;
  this.mapWorldWidth = this.map.cols * this.map.tileSize;
  this.map2Offset = new THREE.Vector3(this.mapWorldWidth + this.mazeGap, 0, 0);

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

  let row3 = this.findClosestWalkableRow(this.dungeonMap, preferredRow, 'left');
  let rowMap2ToDungeon = this.findClosestWalkableRow(this.map2, preferredRow, 'right');

  this.openMazeSide(this.map2, rowMap2ToDungeon, 'right');
  this.openMazeSide(this.dungeonMap, row3, 'left');

  this.connectSideToInterior(this.dungeonMap, row3, 'left');

  this.map.walkableTiles = this.map.grid.flat().filter(tile => tile.isWalkable());
  this.map2.walkableTiles = this.map2.grid.flat().filter(tile => tile.isWalkable());
  this.dungeonMap.walkableTiles = this.dungeonMap.grid.flat().filter(tile => tile.isWalkable());

  // ----- render first maze -----
  this.mazeGroup1 = new THREE.Group();
  this.scene.add(this.mazeGroup1);

  this.tileMapRenderer = new TileMapRenderer(this.map);
  this.tileMapRenderer.render(this.mazeGroup1);

  // ----- render second maze -----
  this.mazeGroup2 = new THREE.Group();
  this.mazeGroup2.position.copy(this.map2Offset);
  this.scene.add(this.mazeGroup2);

  this.tileMapRenderer2 = new TileMapRenderer(this.map2);
  this.tileMapRenderer2.render(this.mazeGroup2);

  // ----- render dungeon -----
  this.dungeonGroup = new THREE.Group();
  this.dungeonGroup.position.copy(this.dungeonOffset);
  this.scene.add(this.dungeonGroup);

  this.dungeonRenderer = new TileMapRenderer(this.dungeonMap);
  this.dungeonRenderer.render(this.dungeonGroup);

  // ======================================
  // ✅ CREATE 4 DUNGEON GUARDS (NEW)
  // ======================================
  this.dungeon_guards = [];

  for (let i = 0; i < 4; i++) {
    let guard = DungeonGuard.spawnInDungeon(this.dungeonMap, this.dungeonOffset);

    if (guard) {
      this.dungeon_guards.push(guard);
      this.addEntityToWorld(guard);
    }
  }
  // ======================================

  // ----- render hallway -----
  this.createHallway(row1, row2);
  this.createHallwayBetweenMap2AndDungeon(rowMap2ToDungeon, row3);

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
  loader.load('/officer_with_gun/scene.gltf', (gltf) => {
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
  });

  this.addEntityToWorld(this.main_character);

  this.createGoals(5);
  this.createLoadingIndicator();
  this.createNPCs(10);

  this.createGoalsForMap(this.map2, this.map2Offset, 5);
  this.createNPCsForMap(this.map2, this.map2Offset, 10);
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

  // for second maze, we need to offset the positions of goals and NPCs
  createGoalsForMap(map, offset, numGoals = 5) {
    let goalCount = 0;
    let maxAttempts = 1000;
    let attempts = 0;

    while (goalCount < numGoals && attempts < maxAttempts) {
      attempts++;

      let randomTile =
        map.walkableTiles[Math.floor(Math.random() * map.walkableTiles.length)];

      let position = map.localize(randomTile).clone().add(offset);

      const tempGeometry = new THREE.BoxGeometry(1.5, 1.5, 1.5);
      const tempMaterial = new THREE.MeshStandardMaterial({
        color: 0xffdd44,
        emissive: 0x442200,
        transparent: true,
        opacity: 0.8
      });
      const tempMarker = new THREE.Mesh(tempGeometry, tempMaterial);
      tempMarker.position.copy(position);
      tempMarker.position.y = 1;
      this.scene.add(tempMarker);

      const loader = new GLTFLoader();
      loader.load(
        '/pier/scene.gltf',
        (gltf) => {
          const model = gltf.scene;
          this.scene.remove(tempMarker);

          const box = new THREE.Box3().setFromObject(model);
          const center = new THREE.Vector3();
          box.getCenter(center);
          const size = new THREE.Vector3();
          box.getSize(size);

          const pierGroup = new THREE.Group();
          model.position.copy(center.clone().negate());
          pierGroup.add(model);

          pierGroup.scale.set(0.3, 0.5, 0.3);
          pierGroup.position.copy(position);

          const scaledHeight = size.y * 0.5;
          pierGroup.position.y = scaledHeight / 2;
          pierGroup.rotation.y = Math.random() * Math.PI * 2;

          this.scene.add(pierGroup);
        },
        undefined,
        () => {}
      );

      goalCount++;
    }
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


  // create 10 ground attackers in the first maze (for vector pathfinding testing)
  createGroundAttackers(numAttackers = 10) {
  this.ground_attackers = [];

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

    attacker.boatLoaded = true;
    attacker.position.y = 1;

    this.ground_attackers.push(attacker);
    this.addEntityToWorld(attacker);
  }
}

  // create 5 random goal in the world
  // create goals in the world with pier models
  // create goals in the world with pier models
  createGoals(numGoals = 5) {
    var goalCount = 0;
    var maxAttempts = 1000;
    var attempts = 0;

    // Store pier entities for loading tracking
    this.piers = [];
    this.piersLoading = numGoals;
    this.piersLoaded = 0;

    while (goalCount < numGoals && attempts < maxAttempts) {
      attempts++;

      let randomTile =
        this.map.walkableTiles[
          Math.floor(Math.random() * this.map.walkableTiles.length)
        ];

      if (
        this.goals.some(
          (g) => g.row === randomTile.row && g.col === randomTile.col
        )
      ) {
        continue;
      }

      // Check all 8 adjacent directions for existing goals
      let isAdjacentToGoal = this.goals.some((goal) => {
        let rowDiff = Math.abs(goal.row - randomTile.row);
        let colDiff = Math.abs(goal.col - randomTile.col);

        return (
          rowDiff <= 1 &&
          colDiff <= 1 &&
          !(rowDiff === 0 && colDiff === 0)
        );
      });

      if (!isAdjacentToGoal) {
        // Get position for this goal - this should already be the tile center
        let position = this.map.localize(randomTile);

        // Create a temporary visual marker (colored cube) while pier loads
        const tempGeometry = new THREE.BoxGeometry(1.5, 1.5, 1.5);
        const tempMaterial = new THREE.MeshStandardMaterial({
          color: 0xffdd44,
          emissive: 0x442200,
          transparent: true,
          opacity: 0.8
        });
        const tempMarker = new THREE.Mesh(tempGeometry, tempMaterial);
        tempMarker.position.copy(position);
        tempMarker.position.y = 1; // Lift slightly above ground
        this.scene.add(tempMarker);

        // Load pier model
        const loader = new GLTFLoader();
        loader.load(
          '/pier/scene.gltf',
          (gltf) => {
            const model = gltf.scene;

            // Remove temporary marker
            this.scene.remove(tempMarker);

            // First, get the original bounds to center properly
            const box = new THREE.Box3().setFromObject(model);
            const center = new THREE.Vector3();
            box.getCenter(center);
            const size = new THREE.Vector3();
            box.getSize(size);

            // Create a container group to hold the pier
            const pierGroup = new THREE.Group();

            // Add model to group and offset so it's centered
            model.position.copy(center.clone().negate());
            pierGroup.add(model);

            // Scale the group
            pierGroup.scale.set(0.3, 0.5, 0.3);

            // Position the group at the tile center
            pierGroup.position.copy(position);

            // Adjust Y position to sit on ground
            const scaledHeight = size.y * 0.5;
            pierGroup.position.y = scaledHeight / 2;

            // Add random rotation for variety
            pierGroup.rotation.y = Math.random() * Math.PI * 2;

            // Add to scene
            this.scene.add(pierGroup);

            // Store reference to the group
            this.piers.push({
              mesh: pierGroup,
              tile: randomTile,
              position: position
            });

            // Add a small debug sphere at the exact tile center to verify alignment
            const debugSphere = new THREE.Mesh(
              new THREE.SphereGeometry(0.2, 8, 8),
              new THREE.MeshBasicMaterial({ color: 0x00ff00 })
            );
            debugSphere.position.copy(position);
            debugSphere.position.y = 0.5;
            this.scene.add(debugSphere);

            // Remove debug sphere after 5 seconds
            setTimeout(() => this.scene.remove(debugSphere), 5000);

            // Track loading progress
            this.piersLoaded++;
          },
          (progress) => {
            // Optional progress
          },
          (error) => {
            // Keep temporary marker as fallback but make it solid
            tempMarker.material.wireframe = false;
            tempMarker.material.color.setHex(0xffaa00);
            tempMarker.material.emissive.setHex(0x332200);
            tempMarker.material.transparent = false;

            // Still store as goal
            this.piers.push({
              mesh: tempMarker,
              tile: randomTile,
              position: position
            });

            this.piersLoaded++;
          }
        );

        // Mark this tile as a goal
        this.goals.push(randomTile);
        goalCount++;
      }
    }
  }

  // create npcs with visual loading feedback
  createNPCs(numNPCs = 10) {
    this.modelsLoading = numNPCs;
    this.modelsLoaded = 0;

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

// dungeon guard movement functionalities start here 
updateDungeonGuards(dt) {
  if (!this.dungeon_guards || this.dungeon_guards.length === 0) return;
  if (!this.main_character) return;

  const playerPos = this.main_character.position.clone();

  const playerInDungeon =
    playerPos.x >= this.dungeonOffset.x + this.dungeonMap.minX &&
    playerPos.x <= this.dungeonOffset.x + this.dungeonMap.minX + this.dungeonMap.cols * this.dungeonMap.tileSize &&
    playerPos.z >= this.dungeonMap.minZ &&
    playerPos.z <= this.dungeonMap.minZ + this.dungeonMap.rows * this.dungeonMap.tileSize;

  for (let guard of this.dungeon_guards) {
    guard.applyGroundLock();

    const distanceToPlayer = guard.position.distanceTo(playerPos);

    // state switching
    if (playerInDungeon && distanceToPlayer <= guard.detectionRadius) {
      guard.state = 'chase';
      guard.isAlerted = true;
    } else if (guard.state === 'chase') {
      guard.state = 'patrol';
      guard.isAlerted = false;
      guard.lastKnownPlayerTile = null;
      guard.resetPath();
    }

    if (guard.state === 'patrol') {
      this.updateDungeonGuardPatrol(guard, dt);
    } else if (guard.state === 'chase') {
      this.updateDungeonGuardChase(guard, dt);
    }
  }
}

updateDungeonGuards(dt) {
  if (!this.dungeon_guards || this.dungeon_guards.length === 0) return;
  if (!this.main_character) return;

  const playerPos = this.main_character.position.clone();

  const playerInDungeon =
    playerPos.x >= this.dungeonOffset.x + this.dungeonMap.minX &&
    playerPos.x <= this.dungeonOffset.x + this.dungeonMap.minX + this.dungeonMap.cols * this.dungeonMap.tileSize &&
    playerPos.z >= this.dungeonMap.minZ &&
    playerPos.z <= this.dungeonMap.minZ + this.dungeonMap.rows * this.dungeonMap.tileSize;

  for (let guard of this.dungeon_guards) {
    guard.applyGroundLock();

    const distanceToPlayer = guard.position.distanceTo(playerPos);

    // state switching
    if (playerInDungeon && distanceToPlayer <= guard.detectionRadius) {
      guard.state = 'chase';
      guard.isAlerted = true;
    } else if (guard.state === 'chase') {
      guard.state = 'patrol';
      guard.isAlerted = false;
      guard.lastKnownPlayerTile = null;
      guard.resetPath();
    }

    if (guard.state === 'patrol') {
      this.updateDungeonGuardPatrol(guard, dt);
    } else if (guard.state === 'chase') {
      this.updateDungeonGuardChase(guard, dt);
    }
  }
}

updateDungeonGuardPatrol(guard, dt) {
  const localPos = guard.position.clone().sub(this.dungeonOffset);
  const currentTile = this.dungeonMap.quantize(localPos);

  if (!currentTile) return;

  if (!guard.targetTile || guard.path.length === 0 || guard.pathIndex >= guard.path.length) {
    let foundPath = false;
    let tries = 0;

    while (!foundPath && tries < 20) {
      let randomTile =
        this.dungeonMap.walkableTiles[
          Math.floor(Math.random() * this.dungeonMap.walkableTiles.length)
        ];

      let newPath = AStar.findPath(currentTile, randomTile, this.dungeonMap);

      if (newPath && newPath.length > 1) {
        guard.targetTile = randomTile;
        guard.path = newPath;
        guard.pathIndex = 1; // skip current tile
        foundPath = true;
      }

      tries++;
    }

    if (!foundPath) {
      guard.path = [];
      guard.pathIndex = 0;
      return;
    }
  }

  this.followDungeonGuardPath(guard);
}

updateDungeonGuardChase(guard, dt) {
  const localGuardPos = guard.position.clone().sub(this.dungeonOffset);
  const localPlayerPos = this.main_character.position.clone().sub(this.dungeonOffset);

  const currentTile = this.dungeonMap.quantize(localGuardPos);
  const playerTile = this.dungeonMap.quantize(localPlayerPos);

  if (!currentTile || !playerTile) return;

  guard.repathTimer -= dt;

  if (guard.repathTimer <= 0 || guard.path.length === 0) {
    guard.path = AStar.findPath(currentTile, playerTile, this.dungeonMap);
    guard.pathIndex = 0;
    guard.repathTimer = 0.4;
    guard.lastKnownPlayerTile = playerTile;
  }

  this.followDungeonGuardPath(guard);
}

followDungeonGuardPath(guard) {
  if (!guard.path || guard.path.length === 0) return;
  if (guard.pathIndex >= guard.path.length) return;

  const waypoint = this.dungeonMap
    .localize(guard.path[guard.pathIndex])
    .clone()
    .add(this.dungeonOffset);

  let desired = waypoint.clone().sub(guard.position);
  desired.y = 0;

  // move to next waypoint
  if (desired.length() < 0.35) {
    guard.pathIndex++;
    return;
  }

  // arrival behavior
  let speed = guard.topSpeed || 3.0;
  if (desired.length() < guard.arrivalRadius) {
    speed = speed * (desired.length() / guard.arrivalRadius);
  }

  if (desired.length() > 0.001) {
    desired.setLength(Math.max(speed, 0.2));
  }

  let steering = desired.sub(guard.velocity);
  steering.clampLength(0, guard.maxSteeringForce || 4.0);

  // separation from other guards
  let separation = this.computeDungeonGuardSeparation(guard);
  steering.add(separation);

  guard.applyForce(steering);
}

computeDungeonGuardSeparation(guard) {
  let force = new THREE.Vector3();

  for (let other of this.dungeon_guards) {
    if (other === guard) continue;

    let offset = guard.position.clone().sub(other.position);
    let dist = offset.length();

    if (dist > 0 && dist < guard.separationRadius) {
      offset.normalize();
      offset.divideScalar(dist);
      force.add(offset);
    }
  }

  if (force.length() > 0) {
    force.setLength(guard.separationStrength);
  }

  return force;
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
  this.mixers = [];

  this.main_character = null;
  this.groundVectorPathFinding = null;
  this.mazeGroup1 = null;
  this.mazeGroup2 = null;
  this.hallwayMesh = null;
  this.loadingSprite = null;

  this.dungeonGroup = null;
  this.dungeonRenderer = null;
  this.dungeonMap = null;
  this.hallwayMesh2 = null;
  this.hallwayBounds2 = null;
  this.dungeonOffset = null;
  this.dungeon_guards = [];
  this.isGameOver = false;
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

  // Update dungeon guards
  this.updateDungeonGuards(dt);

  // Update all entities (this includes the main character)
  for (let e of this.entities) {
    if (e.update) {
      e.update(dt, this.getMapAdapterForPosition(e.position));
    }
  }

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
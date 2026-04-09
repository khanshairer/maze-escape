import * as THREE from 'three';
import { Tile } from '../maps/Tile.js';

/*
Purpose : The WorldLayoutManager class is responsible for managing the layout of the game world, including the placement 
of walkable tiles, creation of hallways between different areas, and ensuring that the player has a navigable path through the maze 
and dungeon. 

It provides methods for finding suitable tiles for spawning entities, opening
pathways in the maze, and creating hallways that connect the different sections of the game world.
*/
export class WorldLayoutManager {
  // Initialize the manager with a reference to the world object
  constructor(world) {
    this.world = world;
  }

  // Find the farthest walkable tile from a given starting tile, used for placing entities away from the player
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

  // Find the closest walkable tile to a preferred row on a given side of the map, used for opening pathways in the maze
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

  // Open a pathway in the maze on the specified side by changing the tile types to walkable terrain
  openMazeSide(map, row, side = 'right') {
    if (side === 'right') {
      map.grid[row][map.cols - 1].type = Tile.Type.EasyTerrain;
      map.grid[row][map.cols - 2].type = Tile.Type.EasyTerrain;
    } else {
      map.grid[row][0].type = Tile.Type.EasyTerrain;
      map.grid[row][1].type = Tile.Type.EasyTerrain;
    }
  }

  // Connect the side of the maze to the interior by changing tile types to create a navigable path for the player
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

  // Create a hallway between two rows in the maze, connecting the main map to the second map or the second map to the dungeon
  createHallway(row1, row2) {
    const world = this.world;

    const startTile1 = world.map.grid[row1][world.map.cols - 1];
    const startTile2 = world.map2.grid[row2][0];

    const p1 = world.map.localize(startTile1);
    const p2 = world.map2.localize(startTile2).clone().add(world.map2Offset);

    const hallwayY = 0.02;
    const hallwayThickness = 0.05;
    const hallwayDepth = world.map.tileSize;

    const straightCenterX = (p1.x + p2.x) / 2;
    const straightCenterZ = p1.z;
    const straightWidth = Math.abs(p2.x - p1.x);

    const straightGeo = new THREE.BoxGeometry(
      straightWidth,
      hallwayThickness,
      hallwayDepth
    );
    const straightMat = new THREE.MeshStandardMaterial({ color: 0xf0f0f0 });
    const straightHall = new THREE.Mesh(straightGeo, straightMat);

    straightHall.position.set(straightCenterX, hallwayY, straightCenterZ);
    world.scene.add(straightHall);

    world.hallwayMesh = straightHall;

    world.hallwayBounds = {
      minX: Math.min(p1.x, p2.x),
      maxX: Math.max(p1.x, p2.x),
      minZ: p1.z - hallwayDepth / 2,
      maxZ: p1.z + hallwayDepth / 2
    };

    // if the doorway rows are different, add a vertical connector near maze 2
    if (p1.z !== p2.z) {
      const verticalDepth = Math.abs(p2.z - p1.z) + hallwayDepth;
      const verticalCenterZ = (p1.z + p2.z) / 2;

      const verticalGeo = new THREE.BoxGeometry(
        world.map.tileSize,
        hallwayThickness,
        verticalDepth
      );
      const verticalMat = new THREE.MeshStandardMaterial({ color: 0xf0f0f0 });
      const verticalHall = new THREE.Mesh(verticalGeo, verticalMat);

      verticalHall.position.set(p2.x, hallwayY, verticalCenterZ);
      world.scene.add(verticalHall);

      world.hallwayBounds.minX = Math.min(
        world.hallwayBounds.minX,
        p2.x - world.map.tileSize / 2
      );
      world.hallwayBounds.maxX = Math.max(
        world.hallwayBounds.maxX,
        p2.x + world.map.tileSize / 2
      );
      world.hallwayBounds.minZ = Math.min(
        world.hallwayBounds.minZ,
        verticalCenterZ - verticalDepth / 2
      );
      world.hallwayBounds.maxZ = Math.max(
        world.hallwayBounds.maxZ,
        verticalCenterZ + verticalDepth / 2
      );
    }
  }

  // Create a hallway between the second maze and the dungeon, connecting the two areas for player navigation
  createHallwayBetweenMap2AndDungeon(row2, row3) {
    const world = this.world;

    const startTile2 = world.map2.grid[row2][world.map2.cols - 1];
    const startTile3 = world.dungeonMap.grid[row3][0];

    const p2 = world.map2.localize(startTile2).clone().add(world.map2Offset);
    const p3 = world.dungeonMap.localize(startTile3).clone().add(world.dungeonOffset);

    const hallwayY = 0.02;
    const hallwayThickness = 0.05;
    const hallwayDepth = world.map2.tileSize;

    const straightCenterX = (p2.x + p3.x) / 2;
    const straightCenterZ = p2.z;
    const straightWidth = Math.abs(p3.x - p2.x);

    const straightGeo = new THREE.BoxGeometry(
      straightWidth,
      hallwayThickness,
      hallwayDepth
    );
    const straightMat = new THREE.MeshStandardMaterial({ color: 0xf0f0f0 });
    const straightHall = new THREE.Mesh(straightGeo, straightMat);

    straightHall.position.set(straightCenterX, hallwayY, straightCenterZ);
    world.scene.add(straightHall);

    world.hallwayMesh2 = straightHall;

    world.hallwayBounds2 = {
      minX: Math.min(p2.x, p3.x),
      maxX: Math.max(p2.x, p3.x),
      minZ: p2.z - hallwayDepth / 2,
      maxZ: p2.z + hallwayDepth / 2
    };

    if (p2.z !== p3.z) {
      const verticalDepth = Math.abs(p3.z - p2.z) + hallwayDepth;
      const verticalCenterZ = (p2.z + p3.z) / 2;

      const verticalGeo = new THREE.BoxGeometry(
        world.map2.tileSize,
        hallwayThickness,
        verticalDepth
      );
      const verticalMat = new THREE.MeshStandardMaterial({ color: 0xf0f0f0 });
      const verticalHall = new THREE.Mesh(verticalGeo, verticalMat);

      verticalHall.position.set(p3.x, hallwayY, verticalCenterZ);
      world.scene.add(verticalHall);

      world.hallwayBounds2.minX = Math.min(
        world.hallwayBounds2.minX,
        p3.x - world.map2.tileSize / 2
      );
      world.hallwayBounds2.maxX = Math.max(
        world.hallwayBounds2.maxX,
        p3.x + world.map2.tileSize / 2
      );
      world.hallwayBounds2.minZ = Math.min(
        world.hallwayBounds2.minZ,
        verticalCenterZ - verticalDepth / 2
      );
      world.hallwayBounds2.maxZ = Math.max(
        world.hallwayBounds2.maxZ,
        verticalCenterZ + verticalDepth / 2
      );
    }
  }

  // Add extra walkable tiles to the map to create more navigable paths for the player, enhancing the gameplay experience
  addExtraGreenTiles(map, count = 8) {
    let candidates = map.walkableTiles.filter(
      tile => tile.type !== Tile.Type.MediumTerrain
    );

    for (let i = candidates.length - 1; i > 0; i--) {
      let j = Math.floor(Math.random() * (i + 1));
      [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
    }

    let selected = candidates.slice(0, count);

    for (let tile of selected) {
      tile.type = Tile.Type.EasyTerrain;
    }
  }
}
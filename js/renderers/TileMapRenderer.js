import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/Addons.js';
import { Tile } from '../maps/Tile';

// Tile map renderer
/*
Purpose: The TileMapRenderer class is responsible for rendering a tile-based map in a 3D environment using Three.js. 
It takes a TileMap object and generates visual representations of the walkable tiles and obstacles. The class provides methods for creating tile
 meshes, apply colors based on tile types, and optionally render decorative fence segments around obstacles. It uses instanced meshes for 
 efficient rendering of multiple tiles and can be customized with different materials and models for obstacles.

Parameters: The constructor takes a TileMap object and an options object that can include:
- useFenceObstacles: A boolean indicating whether to render decorative fences around obstacle tiles.
- fencePath: The file path to the 3D model used for the fence segments.
- fenceScale: A THREE.Vector3 object specifying the scale of the fence model.

The class includes methods for creating tile transformations, determining tile colors, checking for obstacles, rendering obstacle boxes, 
adding fence segments, and rendering the entire tile map in the scene.
*/
export class TileMapRenderer {

  constructor(tileMap, options = {}) {
    
    this.map = tileMap;
    this.useFenceObstacles = options.useFenceObstacles ?? false;
    this.fencePath = options.fencePath ?? '/fence/scene.gltf';
    this.fenceScale = options.fenceScale ?? new THREE.Vector3(1, 1, 1);

    let geometry = new THREE.BoxGeometry();
    let material = new THREE.MeshStandardMaterial();

    this.walkableTiles = this.map.grid.flat().filter(tile => tile.type !== Tile.Type.Obstacle);

    this.mesh = new THREE.InstancedMesh(
      geometry,
      material,
      this.walkableTiles.length
    );

    for (let i = 0; i < this.walkableTiles.length; i++) {
      
      this.createTile(this.walkableTiles[i], i);
    
    }

    this.fenceTemplate = null;
    this.loader = new GLTFLoader();
  }

  createTile(tile, index) {
    
    this.mesh.setMatrixAt(index, this.getTileTransformation(tile));
    this.mesh.setColorAt(index, this.getTileColor(tile));
  
  }

  getTileTransformation(tile) {
    
    let height = 1;
    let pos = this.map.localize(tile);
    pos.y = height / 2;

    let matrix = new THREE.Matrix4();
    matrix.makeScale(this.map.tileSize, height, this.map.tileSize);
    matrix.setPosition(pos);
    
    return matrix;
  
  }

  getObstacleTransformation(tile) {

    let height = 2;
    let pos = this.map.localize(tile);
    pos.y = height / 2;

    let matrix = new THREE.Matrix4();
    matrix.makeScale(this.map.tileSize, height, this.map.tileSize);
    matrix.setPosition(pos);
    
    return matrix;
  
  }

  getTileColor(tile) {
    
    switch (tile.type) {
      
      case Tile.Type.EasyTerrain: return new THREE.Color('#dcdcdc');
      
      case Tile.Type.MediumTerrain: return new THREE.Color('#90ec6b');
      
      case Tile.Type.DifficultTerrain: return new THREE.Color('#75ccff');
      
      case Tile.Type.Obstacle: return new THREE.Color('#3d3d3d');
      
      default: return new THREE.Color('black');
    }
  }

  setTileColor(tile, color) {
    
    let index = this.walkableTiles.indexOf(tile);
    
    if (index >= 0) {
      
      this.mesh.setColorAt(index, color);
      this.mesh.instanceColor.needsUpdate = true;
    
    }
  }

  isObstacle(row, col) {
    
    if (row < 0 || row >= this.map.rows || col < 0 || col >= this.map.cols) {
      
      return false;
    
    }

    return this.map.grid[row][col].type === Tile.Type.Obstacle;
  
  }

  renderObstacleBoxes(scene) {
    
    const obstacleTiles = this.map.grid.flat().filter(tile => tile.type === Tile.Type.Obstacle);

    if (obstacleTiles.length === 0) return;

    let geometry = new THREE.BoxGeometry();
    let material = new THREE.MeshStandardMaterial({ color: '#3d3d3d' });

    const obstacleMesh = new THREE.InstancedMesh(
      
      geometry,
      material,
      obstacleTiles.length
    
    );

    for (let i = 0; i < obstacleTiles.length; i++) {
      
      const tile = obstacleTiles[i];
      obstacleMesh.setMatrixAt(i, this.getObstacleTransformation(tile));
      obstacleMesh.setColorAt(i, new THREE.Color('#3d3d3d'));
    
    }

    scene.add(obstacleMesh);
  }

  addFenceSegment(scene, tile, side) {
    
    const fence = this.fenceTemplate.clone(true);
    const pos = this.map.localize(tile);
    const half = this.map.tileSize / 2;

    fence.scale.copy(this.fenceScale);

    if (side === 'north') {
      
      fence.position.set(pos.x, 2.0, pos.z - half);
      fence.rotation.y = 0;
    
    } else if (side === 'south') {
      
      fence.position.set(pos.x, 2.0, pos.z + half);
      fence.rotation.y = 0;
    
    } else if (side === 'west') {
      
      fence.position.set(pos.x - half, 2.0, pos.z);
      fence.rotation.y = Math.PI / 2;
    
    } else if (side === 'east') {
      
      fence.position.set(pos.x + half, 2.0, pos.z);
      fence.rotation.y = Math.PI / 2;
    }

    const box = new THREE.Box3().setFromObject(fence);
    fence.position.y += -box.min.y;

    scene.add(fence);
  }

  renderFenceBorders(scene) {
    
    const obstacleTiles = this.map.grid.flat().filter(tile => tile.type === Tile.Type.Obstacle);

    if (obstacleTiles.length === 0) return;

    this.loader.load(
      this.fencePath,
      (gltf) => {
        this.fenceTemplate = gltf.scene;

        for (let tile of obstacleTiles) {
          const r = tile.row;
          const c = tile.col;

          if (!this.isObstacle(r - 1, c)) this.addFenceSegment(scene, tile, 'north');
          if (!this.isObstacle(r + 1, c)) this.addFenceSegment(scene, tile, 'south');
          if (!this.isObstacle(r, c - 1)) this.addFenceSegment(scene, tile, 'west');
          if (!this.isObstacle(r, c + 1)) this.addFenceSegment(scene, tile, 'east');
        }
      },
      undefined,
      (error) => {
      }
    );
  }

  getWallTransformations() {
    
    let wallMatrices = [];
    let wallThickness = this.map.tileSize * 0.25;
    let wallHeight = 2;
    let tileSize = this.map.tileSize;
    let half = tileSize / 2;

    for (let tile of this.map.grid.flat()) {
      let pos = this.map.localize(tile);

      if (tile.walls?.north) {
        let matrix = new THREE.Matrix4();
        matrix.makeScale(tileSize, wallHeight, wallThickness);
        matrix.setPosition(pos.x, wallHeight / 2, pos.z - half);
        wallMatrices.push(matrix);
      }

      if (tile.walls?.west) {
        let matrix = new THREE.Matrix4();
        matrix.makeScale(wallThickness, wallHeight, tileSize);
        matrix.setPosition(pos.x - half, wallHeight / 2, pos.z);
        wallMatrices.push(matrix);
      }

      // render outer south border only
      if (tile.walls?.south && tile.row === this.map.rows - 1) {
        let matrix = new THREE.Matrix4();
        matrix.makeScale(tileSize, wallHeight, wallThickness);
        matrix.setPosition(pos.x, wallHeight / 2, pos.z + half);
        wallMatrices.push(matrix);
      }

      // render outer east border only
      if (tile.walls?.east && tile.col === this.map.cols - 1) {
        let matrix = new THREE.Matrix4();
        matrix.makeScale(wallThickness, wallHeight, tileSize);
        matrix.setPosition(pos.x + half, wallHeight / 2, pos.z);
        wallMatrices.push(matrix);
      }
    }

    return wallMatrices;
  }

  renderWallBoxes(scene) {
    
    const wallMatrices = this.getWallTransformations();

    if (wallMatrices.length === 0) return;

    let geometry = new THREE.BoxGeometry();
    let material = new THREE.MeshStandardMaterial({ color: '#63b5b7' });

    const wallMesh = new THREE.InstancedMesh(
      geometry,
      material,
      wallMatrices.length
    );

    for (let i = 0; i < wallMatrices.length; i++) {
      wallMesh.setMatrixAt(i, wallMatrices[i]);
      wallMesh.setColorAt(i, new THREE.Color('#3d3d3d'));
    }

    scene.add(wallMesh);
  }

  render(scene) {
    scene.add(this.mesh);

    // always render solid obstacle blocks
    this.renderObstacleBoxes(scene);

    // render solid wall segments only for wall-based mazes
    if (this.map.useMazeGenerator) {
      this.renderWallBoxes(scene);
    }

    // optionally add fence border decoration on top
    if (this.useFenceObstacles) {
      if (this.map.useMazeGenerator) {
        // optional, usually not needed if using wall boxes
      } else if (this.map.grid.flat().some(tile => tile.type === Tile.Type.Obstacle)) {
        this.renderFenceBorders(scene);
      }
    }
  }
}
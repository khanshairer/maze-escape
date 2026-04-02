import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/Addons.js';
import { Tile } from '../maps/Tile';

// Tile map renderer
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
        console.log('❌ failed to load fence model:', error);
      }
    );
  }

  render(scene) {
    scene.add(this.mesh);

    // always render solid obstacle blocks
    this.renderObstacleBoxes(scene);

    // optionally add fence border decoration on top
    if (this.useFenceObstacles) {
      this.renderFenceBorders(scene);
    }
  }
}
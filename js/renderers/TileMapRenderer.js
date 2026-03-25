import * as THREE from 'three';
import { Tile } from '../maps/Tile';

// Tile map renderer
export class TileMapRenderer {

  // Constructor takes in a tile map
  constructor(tileMap) {
    this.map = tileMap;

    let geometry = new THREE.BoxGeometry();
    let material = new THREE.MeshStandardMaterial();

    // Creates an instanced mesh
    this.mesh = new THREE.InstancedMesh(geometry, material, this.map.rows * this.map.cols);

    // For each tile, create a tile rendering
    for (let r = 0; r < this.map.rows; r++) {
      for (let c = 0; c < this.map.cols; c++) {
        this.createTile(this.map.grid[r][c]);
      }
    }
  }

  // Create the tile by setting the instanced mesh
  // at the tiles index to the tiles transformation
  // and the desired tile colour
  createTile(tile) {
    let index = tile.row * this.map.cols + tile.col;
    this.mesh.setMatrixAt(index, this.getTileTransformation(tile));
    this.mesh.setColorAt(index, this.getTileColor(tile));
  }

  // Get the tile transformation matrix
  getTileTransformation(tile) {
    let height = tile.type == Tile.Type.Obstacle ? 2 : 1;
    let pos = this.map.localize(tile);
    pos.y = height / 2;

    let matrix = new THREE.Matrix4();
    matrix.makeScale(this.map.tileSize, height, this.map.tileSize);
    matrix.setPosition(pos);
    return matrix;
  }
  
  // Get the tile colour
  getTileColor(tile) {
    switch (tile.type) {
      case Tile.Type.EasyTerrain:   return new THREE.Color('#dcdcdc');
      case Tile.Type.MediumTerrain: return new THREE.Color('#90ec6b');
      case Tile.Type.DifficultTerrain: return new THREE.Color('#75ccff');
      case Tile.Type.Obstacle: return new THREE.Color('#3d3d3d');
      default:                 return new THREE.Color('black');
    }
  }

  // Set the tile colour
  setTileColor(tile, color) {
    let index = tile.row * this.map.cols + tile.col;
    this.mesh.setColorAt(index, color);
  }

  // Render to our scene
  render(scene) {
    scene.add(this.mesh);
  }

}

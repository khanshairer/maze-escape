import { Tile } from "./Tile";
import { LevelMap } from "./LevelMap";
import * as THREE from "three";


// TileMap class will hold information about our Tile grid
export class TileMap extends LevelMap {

  // TileMap constructor
  constructor(
    tileSize = 1,

    ...levelMapConfig
  ) {
    super(levelMapConfig);

    this.tileSize = tileSize;
    this.cols = Math.floor(this.width/this.tileSize);
    this.rows = Math.floor(this.depth/this.tileSize);

    this.grid = [];
    this.generateGrid();

    // Hold walkable tiles to get random walkable tile
    this.walkableTiles = this.grid.flat().filter(tile => tile.isWalkable());
  }

  // Generate the tile grid
  generateGrid() {
    for (let r = 0; r < this.rows; r++) {
      let row = [];

      for (let c = 0; c < this.cols; c++) {

        let random = Math.random();
        let type =
          random < 0.1 ? Tile.Type.Obstacle :
          random < 0.2 ? Tile.Type.DifficultTerrain :
          random < 0.3 ? Tile.Type.MediumTerrain :
          Tile.Type.EasyTerrain;

        row.push(
          new Tile(r, c, type)
        );
      }
      this.grid.push(row);
    }
  }

  // Get neighbours for a particular tile
  getNeighbours(tile) {

    let neighbours = []

    // we can move in 4 possible directions
    let directions = [[-1,0], [1,0], [0,-1], [0,1]];

    // Iterate over the directions
    for (let d of directions) {
      let r = tile.row + d[0];
      let c = tile.col + d[1];

      // If the neighbouring tile is walkable
      // and it exists, add it to our list of neighbours
      if (this.isInGrid(r, c) && this.grid[r][c].isWalkable()) {
        neighbours.push(this.grid[r][c]);
      }
    }
    return neighbours;
  }

  // Test if in the grid
  isInGrid(row, col) {
    return (
      row >= 0 && row < this.rows &&
      col >= 0 && col < this.cols
    );
  }

  // Quantize
  // Converts from Vector3 position to a tile
  quantize(position) {
    let row = Math.floor((position.z - this.minZ) / this.tileSize);
    let col = Math.floor((position.x - this.minX) / this.tileSize);
    return this.grid[row][col];
  }

  // Localize
  // Converts from a tile to a Vector3 position
  localize(tile) {
    return new THREE.Vector3(
      tile.col * this.tileSize + this.minX + this.tileSize / 2, 
      1,
      tile.row * this.tileSize + this.minZ + this.tileSize / 2
    );
  }

  // Get random walkable tile
  getRandomWalkableTile() {
    let index = Math.floor(Math.random() * this.walkableTiles.length);
    return this.walkableTiles[index];
  }

  // Returns a position applied to the entity so that
  // it will move between tiles where there is no edge
  // Applied in DynamicEntity update() in place of wrapPosition()
  handleCollisions(entity) {

    let pos = entity.position.clone();
    let radius = Math.max(entity.scale.x, entity.scale.z) / 2;

    let tile = this.quantize(pos);
    let neighbours = this.getNeighbours(tile);

    let center = this.localize(tile);
    let half = this.tileSize / 2;

    // pushes position.z if collision north
    if (tile.row === 0 || !neighbours.includes(this.grid[tile.row - 1][tile.col])) {
      let dz = pos.z - (center.z - half);
      if (Math.abs(dz) < radius)
        pos.z += Math.sign(dz) * (radius - Math.abs(dz));
    }

    // pushes position.z if collision south
    if (tile.row === this.rows - 1 || !neighbours.includes(this.grid[tile.row + 1][tile.col])) {
      let dz = pos.z - (center.z + half);
      if (Math.abs(dz) < radius)
        pos.z += Math.sign(dz) * (radius - Math.abs(dz));
    }

    // pushes position.x if collision west
    if (tile.col === 0 || !neighbours.includes(this.grid[tile.row][tile.col - 1])) {
      let dx = pos.x - (center.x - half);
      if (Math.abs(dx) < radius)
        pos.x += Math.sign(dx) * (radius - Math.abs(dx));
    }

    // pushes position.x if collision east
    if (tile.col === this.cols - 1 || !neighbours.includes(this.grid[tile.row][tile.col + 1])) {
      let dx = pos.x - (center.x + half);
      if (Math.abs(dx) < radius)
        pos.x += Math.sign(dx) * (radius - Math.abs(dx));
    }

    return pos;
  }

}
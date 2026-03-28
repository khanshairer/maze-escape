import { Tile } from "./Tile";
import { LevelMap } from "./LevelMap";
import * as THREE from "three";

// TileMap class will hold information about our Tile grid
export class TileMap extends LevelMap {

  // TileMap constructor
  constructor(
    tileSize = 4,
    ...levelMapConfig
  ) {
    super(levelMapConfig);

    this.tileSize = tileSize;
    this.cols = Math.floor(this.width / this.tileSize);
    this.rows = Math.floor(this.depth / this.tileSize);

    this.grid = [];
    this.generateGrid();

    // Hold walkable tiles to get random walkable tile
    this.walkableTiles = this.grid.flat().filter(tile => tile.isWalkable());
  }

  // Generate the tile grid as a maze
  generateGrid() {
    // Step 1: fill the whole grid with obstacles
    for (let r = 0; r < this.rows; r++) {
      let row = [];

      for (let c = 0; c < this.cols; c++) {
        row.push(new Tile(r, c, Tile.Type.Obstacle));
      }

      this.grid.push(row);
    }

    // Step 2: choose a valid starting cell
    // using odd indices works best for DFS maze carving
    let startRow = 1;
    let startCol = 1;

    // make sure start is inside the grid
    if (startRow >= this.rows) startRow = 0;
    if (startCol >= this.cols) startCol = 0;

    // Step 3: carve the maze
    this.carveMaze(startRow, startCol);

    // Step 4: optional - assign terrain difficulty to carved walkable tiles
    this.assignTerrainToPaths();
  }

  // Recursive DFS maze carving
  carveMaze(row, col) {
    this.grid[row][col].type = Tile.Type.EasyTerrain;

    let directions = [
      [-2, 0], // north
      [ 2, 0], // south
      [ 0,-2], // west
      [ 0, 2]  // east
    ];

    this.shuffle(directions);

    for (let d of directions) {
      let newRow = row + d[0];
      let newCol = col + d[1];

      // stay inside bounds, leaving border intact
      if (
        newRow > 0 && newRow < this.rows - 1 &&
        newCol > 0 && newCol < this.cols - 1 &&
        !this.grid[newRow][newCol].isWalkable()
      ) {
        // carve the wall between current cell and next cell
        let wallRow = row + d[0] / 2;
        let wallCol = col + d[1] / 2;

        this.grid[wallRow][wallCol].type = Tile.Type.EasyTerrain;
        this.grid[newRow][newCol].type = Tile.Type.EasyTerrain;

        this.carveMaze(newRow, newCol);
      }
    }
  }

  // Assign random terrain types only on walkable path tiles
  assignTerrainToPaths() {
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        let tile = this.grid[r][c];

        if (tile.isWalkable()) {
          let random = Math.random();

          tile.type =
            random < 0.10 ? Tile.Type.DifficultTerrain :
            random < 0.20 ? Tile.Type.MediumTerrain :
            Tile.Type.EasyTerrain;
        }
      }
    }
  }

  // Shuffle helper
  shuffle(array) {
    for (let i = array.length - 1; i > 0; i--) {
      let j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
  }

  // Get neighbours for a particular tile
  getNeighbours(tile) {
    let neighbours = [];

    // we can move in 4 possible directions
    let directions = [[-1, 0], [1, 0], [0, -1], [0, 1]];

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

    // clamp for safety
    row = Math.max(0, Math.min(this.rows - 1, row));
    col = Math.max(0, Math.min(this.cols - 1, col));

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
        pos.z += Math.sign(dz || 1) * (radius - Math.abs(dz));
    }

    // pushes position.z if collision south
    if (tile.row === this.rows - 1 || !neighbours.includes(this.grid[tile.row + 1][tile.col])) {
      let dz = pos.z - (center.z + half);
      if (Math.abs(dz) < radius)
        pos.z += Math.sign(dz || 1) * (radius - Math.abs(dz));
    }

    // pushes position.x if collision west
    if (tile.col === 0 || !neighbours.includes(this.grid[tile.row][tile.col - 1])) {
      let dx = pos.x - (center.x - half);
      if (Math.abs(dx) < radius)
        pos.x += Math.sign(dx || 1) * (radius - Math.abs(dx));
    }

    // pushes position.x if collision east
    if (tile.col === this.cols - 1 || !neighbours.includes(this.grid[tile.row][tile.col + 1])) {
      let dx = pos.x - (center.x + half);
      if (Math.abs(dx) < radius)
        pos.x += Math.sign(dx || 1) * (radius - Math.abs(dx));
    }

    return pos;
  }
}
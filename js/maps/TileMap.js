import { Tile } from "./Tile";
import { LevelMap } from "./LevelMap";
import * as THREE from "three";
import { MazeGenerator } from "../pcg/MazeGenerator.js";
import { Perlin } from "../pcg/Perlin.js";

// TileMap class will hold information about our Tile grid
export class TileMap extends LevelMap {

  // TileMap constructor
  constructor(
    tileSize = 4,
    options = {},
    ...levelMapConfig
  ) {
    super(levelMapConfig);

    this.tileSize = tileSize;

    this.useMazeGenerator = options.useMazeGenerator ?? false;
    this.usePerlinGenerator = options.usePerlinGenerator ?? false;

    this.perlinConfig = {
      size: options.perlinSize ?? 64,
      baseFrequency: options.baseFrequency ?? 0.08,
      numOctaves: options.numOctaves ?? 4,
      persistence: options.persistence ?? 0.5,
      lacunarity: options.lacunarity ?? 2.0,

      // Keep obstacles low so drones can move freely
      obstacleThreshold: options.obstacleThreshold ?? 0.12,
      difficultThreshold: options.difficultThreshold ?? 0.22,
      mediumThreshold: options.mediumThreshold ?? 0.38
    };

    this.cols = Math.floor(this.width / this.tileSize);
    this.rows = Math.floor(this.depth / this.tileSize);

    this.grid = [];
    this.generateGrid();

    // Hold walkable tiles to get random walkable tile
    this.walkableTiles = this.grid.flat().filter(tile => tile.isWalkable());
  }

  // Generate the tile grid
  generateGrid() {
    // reset in case this gets called again
    this.grid = [];

    // Step 1: fill the whole grid with tiles
    for (let r = 0; r < this.rows; r++) {
      let row = [];

      for (let c = 0; c < this.cols; c++) {
        let type = Tile.Type.Obstacle;
        row.push(new Tile(r, c, type));
      }

      this.grid.push(row);
    }

    // Step 2: choose generation style
    if (this.usePerlinGenerator) {
      this.generatePerlinTerrain();
    } else if (this.useMazeGenerator) {
      for (let r = 0; r < this.rows; r++) {
        for (let c = 0; c < this.cols; c++) {
          this.grid[r][c].type = Tile.Type.EasyTerrain;
          this.grid[r][c].cost = Tile.Cost.get(Tile.Type.EasyTerrain);
        }
      }

      MazeGenerator.generate(this);
      this.assignTerrainToPaths();
    } else {
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

    this.walkableTiles = this.grid.flat().filter(tile => tile.isWalkable());
  }

  generatePerlinTerrain() {
    const {
      size,
      baseFrequency,
      numOctaves,
      persistence,
      lacunarity,
      obstacleThreshold,
      difficultThreshold,
      mediumThreshold
    } = this.perlinConfig;

    const perlin = new Perlin(size);

    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        const tile = this.grid[r][c];

        const noiseValue = perlin.octaveNoise(
          r,
          c,
          baseFrequency,
          numOctaves,
          persistence,
          lacunarity
        );

        // Small obstacle ratio, mostly open for drone wandering
        if (noiseValue < obstacleThreshold) {
          tile.type = Tile.Type.Obstacle;
        } else if (noiseValue < difficultThreshold) {
          tile.type = Tile.Type.DifficultTerrain;
        } else if (noiseValue < mediumThreshold) {
          tile.type = Tile.Type.MediumTerrain;
        } else {
          tile.type = Tile.Type.EasyTerrain;
        }

        tile.cost = Tile.Cost.get(tile.type);
      }
    }

    // Optional: keep borders blocked if you want containment
    for (let c = 0; c < this.cols; c++) {
      this.grid[0][c].type = Tile.Type.Obstacle;
      this.grid[0][c].cost = Tile.Cost.get(Tile.Type.Obstacle);

      this.grid[this.rows - 1][c].type = Tile.Type.Obstacle;
      this.grid[this.rows - 1][c].cost = Tile.Cost.get(Tile.Type.Obstacle);
    }

    for (let r = 0; r < this.rows; r++) {
      this.grid[r][0].type = Tile.Type.Obstacle;
      this.grid[r][0].cost = Tile.Cost.get(Tile.Type.Obstacle);

      this.grid[r][this.cols - 1].type = Tile.Type.Obstacle;
      this.grid[r][this.cols - 1].cost = Tile.Cost.get(Tile.Type.Obstacle);
    }
  }

  // Recursive DFS maze carving
  carveMaze(row, col) {
    this.grid[row][col].type = Tile.Type.EasyTerrain;
    this.grid[row][col].cost = Tile.Cost.get(Tile.Type.EasyTerrain);

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
        this.grid[wallRow][wallCol].cost = Tile.Cost.get(Tile.Type.EasyTerrain);

        this.grid[newRow][newCol].type = Tile.Type.EasyTerrain;
        this.grid[newRow][newCol].cost = Tile.Cost.get(Tile.Type.EasyTerrain);

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

          tile.cost = Tile.Cost.get(tile.type);
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

  // Get adjacent tiles regardless of walls
  getAdjacentTiles(tile) {
    let adjacentTiles = [];

    let directions = [[-1, 0], [1, 0], [0, -1], [0, 1]];

    for (let d of directions) {
      let r = tile.row + d[0];
      let c = tile.col + d[1];

      if (this.isInGrid(r, c)) {
        adjacentTiles.push(this.grid[r][c]);
      }
    }

    return adjacentTiles;
  }

  // Get neighbours for a particular tile
  getNeighbours(tile) {
    let neighbours = [];

    let row = tile.row;
    let col = tile.col;

    if (this.useMazeGenerator) {
      if (!tile.walls.north && this.isInGrid(row - 1, col) && this.grid[row - 1][col].isWalkable()) {
        neighbours.push(this.grid[row - 1][col]);
      }

      if (!tile.walls.south && this.isInGrid(row + 1, col) && this.grid[row + 1][col].isWalkable()) {
        neighbours.push(this.grid[row + 1][col]);
      }

      if (!tile.walls.west && this.isInGrid(row, col - 1) && this.grid[row][col - 1].isWalkable()) {
        neighbours.push(this.grid[row][col - 1]);
      }

      if (!tile.walls.east && this.isInGrid(row, col + 1) && this.grid[row][col + 1].isWalkable()) {
        neighbours.push(this.grid[row][col + 1]);
      }
    } else {
      let directions = [[-1, 0], [1, 0], [0, -1], [0, 1]];

      for (let d of directions) {
        let r = tile.row + d[0];
        let c = tile.col + d[1];

        if (this.isInGrid(r, c) && this.grid[r][c].isWalkable()) {
          neighbours.push(this.grid[r][c]);
        }
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
    let walkableTiles = this.walkableTiles;

    if (!walkableTiles || walkableTiles.length === 0) {
      walkableTiles = this.grid.flat().filter(tile => tile.isWalkable());
    }

    let index = Math.floor(Math.random() * walkableTiles.length);

    return walkableTiles[index];
  }

  // Returns a position applied to the entity so that
  // it will move between tiles where there is no edge
  // Applied in DynamicEntity update() in place of wrapPosition()
  handleCollisions(entity) {
    let pos = entity.position.clone();
    let radius = Math.max(entity.scale.x, entity.scale.z) / 2;

    let tile = this.quantize(pos);
    let center = this.localize(tile);
    let half = this.tileSize / 2;

    if (this.useMazeGenerator) {
      if (tile.row === 0 || tile.walls.north) {
        let dz = pos.z - (center.z - half);
        if (Math.abs(dz) < radius)
          pos.z += Math.sign(dz || 1) * (radius - Math.abs(dz));
      }

      if (tile.row === this.rows - 1 || tile.walls.south) {
        let dz = pos.z - (center.z + half);
        if (Math.abs(dz) < radius)
          pos.z += Math.sign(dz || 1) * (radius - Math.abs(dz));
      }

      if (tile.col === 0 || tile.walls.west) {
        let dx = pos.x - (center.x - half);
        if (Math.abs(dx) < radius)
          pos.x += Math.sign(dx || 1) * (radius - Math.abs(dx));
      }

      if (tile.col === this.cols - 1 || tile.walls.east) {
        let dx = pos.x - (center.x + half);
        if (Math.abs(dx) < radius)
          pos.x += Math.sign(dx || 1) * (radius - Math.abs(dx));
      }
    } else {
      let neighbours = this.getNeighbours(tile);

      if (tile.row === 0 || !neighbours.includes(this.grid[tile.row - 1][tile.col])) {
        let dz = pos.z - (center.z - half);
        if (Math.abs(dz) < radius)
          pos.z += Math.sign(dz || 1) * (radius - Math.abs(dz));
      }

      if (tile.row === this.rows - 1 || !neighbours.includes(this.grid[tile.row + 1][tile.col])) {
        let dz = pos.z - (center.z + half);
        if (Math.abs(dz) < radius)
          pos.z += Math.sign(dz || 1) * (radius - Math.abs(dz));
      }

      if (tile.col === 0 || !neighbours.includes(this.grid[tile.row][tile.col - 1])) {
        let dx = pos.x - (center.x - half);
        if (Math.abs(dx) < radius)
          pos.x += Math.sign(dx || 1) * (radius - Math.abs(dx));
      }

      if (tile.col === this.cols - 1 || !neighbours.includes(this.grid[tile.row][tile.col + 1])) {
        let dx = pos.x - (center.x + half);
        if (Math.abs(dx) < radius)
          pos.x += Math.sign(dx || 1) * (radius - Math.abs(dx));
      }
    }

    return pos;
  }
}
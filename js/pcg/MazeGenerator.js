export class MazeGenerator {

  static generate(map) {
    let visited = new Set();
    let start = map.getRandomWalkableTile();
    this.carve(start, visited, map);
  }

  static carve(tile, visited, map) {

    let id = tile.row * map.cols + tile.col;
    visited.add(id);

    let adjacentTiles = map.getAdjacentTiles(tile);
    this.shuffle(adjacentTiles);

    for (let n of adjacentTiles) {

      let nID = n.row * map.cols + n.col;

      if (!visited.has(nID)) {

        let dr = n.row - tile.row;
        let dc = n.col - tile.col;

        // South
        if (dr === 1) {
          tile.walls.south = false;
          n.walls.north = false;
        }

        // North
        else if (dr === -1) {
          tile.walls.north = false;
          n.walls.south = false;
        }

        // East
        else if (dc === 1) {
          tile.walls.east = false;
          n.walls.west = false;
        }

        // West
        else if (dc === -1) {
          tile.walls.west = false;
          n.walls.east = false;
        }

        this.carve(n, visited, map);
      }

    }
  }

  static braidedGenerate(map, probability) {

    // Create a perfect maze using dfs
    this.generate(map);

    for (let r = 0; r < map.rows; r++) {
      for (let c = 0; c < map.cols; c++) {

        let tile = map.grid[r][c];

        // get all neighbours (i.e. connected tiles)
        let neighbours = map.getNeighbours(tile);
        if (neighbours.length !== 1 || Math.random() > probability) continue;

        let adjacent = map.getAdjacentTiles(tile);
        let connected = neighbours[0];

        // Filter our adjacent tiles to remove the connected one
        let options = adjacent.filter(t => t !== connected);

        let n = options[Math.floor(Math.random() * options.length)];

        let dr = n.row - tile.row;
        let dc = n.col - tile.col;

        // South
        if (dr === 1) {
          tile.walls.south = false;
          n.walls.north = false;
        }

        // North
        else if (dr === -1) {
          tile.walls.north = false;
          n.walls.south = false;
        }

        // East
        else if (dc === 1) {
          tile.walls.east = false;
          n.walls.west = false;
        }

        // West
        else if (dc === -1) {
          tile.walls.west = false;
          n.walls.east = false;
        }

      }
    }

  }



  static shuffle(array) {
    for (let i = array.length - 1; i > 0; i--) {
      let j = Math.floor(Math.random() * (i + 1));
      let temp = array[j];
      array[j] = array[i];
      array[i] = temp;
    }
  }


}
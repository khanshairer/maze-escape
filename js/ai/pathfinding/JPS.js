import { MinHeap } from './util/MinHeap.js';

/*
Purpose : Implement Jump Point Search (JPS) pathfinding algorithm for grid-based maps, optimizing A* 
by skipping unnecessary nodes and directly jumping to key points in the path.
*/
export class JPS {
  // constuctor takes in a map object with properties rows, cols, and grid (2D array of tiles)
  constructor(map) {
    this.map = map;
  }

  // Generate a unique key for a tile based on its row and column
  key(tile) {
    return `${tile.row},${tile.col}`;
  }

  // Get a tile object at the specified row and column, or null if out of bounds
  getTile(row, col) {
    if (
      row < 0 || row >= this.map.rows ||
      col < 0 || col >= this.map.cols
    ) {
      return null;
    }

    return this.map.grid[row][col];
  }

  // Check if the tile at the specified row and column is walkable
  isWalkable(row, col) {
    const tile = this.getTile(row, col);
    return !!(tile && tile.isWalkable());
  }
  
  // Manhattan distance heuristic for estimating cost from tile a to tile b
  heuristic(a, b) {
    return Math.abs(a.row - b.row) + Math.abs(a.col - b.col);
  }

  // Manhattan distance between two tiles, used for calculating gScore and fScore
  distance(a, b) {
    return Math.abs(a.row - b.row) + Math.abs(a.col - b.col);
  }

  // Reconstruct the jump point path from the cameFrom map, starting from the goal tile
  reconstructJumpPath(cameFrom, current) {
    const path = [current];

    while (cameFrom.has(this.key(current))) {
      current = cameFrom.get(this.key(current));
      path.push(current);
    }

    return path.reverse();
  }
 
  // Get the direction of movement from one tile to another as a pair of dr and dc
  getDirection(from, to) {
    return {
      dr: Math.sign(to.row - from.row),
      dc: Math.sign(to.col - from.col)
    };
  }
  
  // Determine which directions to explore from the current tile based on the parent tile and pruning rules
  pruneDirections(current, parent) {
    if (!parent) {
      return [
        { dr: -1, dc: 0 },
        { dr: 1, dc: 0 },
        { dr: 0, dc: -1 },
        { dr: 0, dc: 1 }
      ];
    }

    const { dr, dc } = this.getDirection(parent, current);
    const dirs = [];

    if (dr !== 0) {
      
      dirs.push({ dr, dc: 0 });
      dirs.push({ dr: 0, dc: -1 });
      dirs.push({ dr: 0, dc: 1 });
    
    } else if (dc !== 0) {
      
      dirs.push({ dr: 0, dc });
      dirs.push({ dr: -1, dc: 0 });
      dirs.push({ dr: 1, dc: 0 });
    
    }

    return dirs;
  }
 
  // Check if moving from the current tile to the next tile in the direction of dr and dc would encounter a forced neighbor
  hasForcedNeighbour(currentRow, currentCol, nextRow, nextCol, dr, dc) {
    
    if (dr !== 0) {
      
      if (
        this.isWalkable(nextRow, nextCol - 1) &&
        !this.isWalkable(currentRow, currentCol - 1)
      ) {
        return true;
      }

      if (
        this.isWalkable(nextRow, nextCol + 1) &&
        !this.isWalkable(currentRow, currentCol + 1)
      ) {
        return true;
      }
    }

    if (dc !== 0) {
      
      if (
        this.isWalkable(nextRow - 1, nextCol) &&
        !this.isWalkable(currentRow - 1, currentCol)
      ) {
        return true;
      }

      if (
        this.isWalkable(nextRow + 1, nextCol) &&
        !this.isWalkable(currentRow + 1, currentCol)
      ) {
        return true;
      }
    }

    return false;
  }

  // Recursively jump from the current tile in the direction of dr and dc until a jump point is found or an obstacle is encountered
  jump(node, dr, dc, goal) {
    
    const currentRow = node.row;
    const currentCol = node.col;

    const nextRow = currentRow + dr;
    const nextCol = currentCol + dc;

    if (!this.isWalkable(nextRow, nextCol)) {
      
      return null;
    
    }

    const nextTile = this.getTile(nextRow, nextCol);

    if (nextTile.row === goal.row && nextTile.col === goal.col) {
      
      return nextTile;
    
    }

    if (this.hasForcedNeighbour(currentRow, currentCol, nextRow, nextCol, dr, dc)) {
      
      return nextTile;
    
    }

    // Vertical-first bias, matching the lecture-style 4-direction version
    if (dr !== 0) {
      
      if (
        
        this.jump(nextTile, 0, -1, goal) ||
        this.jump(nextTile, 0, 1, goal)
      
      ) {
        
        return nextTile;
      
      }
    }

    return this.jump(nextTile, dr, dc, goal);
  
  }

  // Identify successor jump points from the current tile by pruning directions and performing jumps in those directions
  identifySuccessors(current, goal, cameFrom) {

    const parent = cameFrom.get(this.key(current)) || null;
    const directions = this.pruneDirections(current, parent);
    const successors = [];

    for (const dir of directions) {
      
      const jumpPoint = this.jump(current, dir.dr, dir.dc, goal);
      
      if (jumpPoint) {
        
        successors.push(jumpPoint);
      
      }
    }

    return successors;
  
  }

  // Expand a segment of the path between two jump points into the full list of tiles along that segment
  expandSegment(a, b) {
    
    const tiles = [];

    const dr = Math.sign(b.row - a.row);
    const dc = Math.sign(b.col - a.col);

    let row = a.row;
    let col = a.col;

    tiles.push(a);

    while (row !== b.row || col !== b.col) {
     
      row += dr;
      col += dc;

      const tile = this.getTile(row, col);
      
      if (!tile) {
        
        break;
      
      }

      tiles.push(tile);
    
    }

    return tiles;
  }

  // Expand the entire jump point path into the full list of tiles along the path
  expandJumpPath(jumpPath) {
    
    if (!jumpPath || jumpPath.length === 0) return [];
    
    if (jumpPath.length === 1) return jumpPath;

    const fullPath = [];

    for (let i = 0; i < jumpPath.length - 1; i++) {
      
      let segment = this.expandSegment(jumpPath[i], jumpPath[i + 1]);

      if (i > 0) {
        
        segment.shift();
      
      }

      fullPath.push(...segment);
    }

    return fullPath;
  }


// Main method to find a path from start tile to goal tile using the JPS algorithm
  findPath(start, goal) {
    
    if (!start || !goal || !start.isWalkable() || !goal.isWalkable()) {
     
      return [];
    
    }

    const openSet = new MinHeap();
    const closed = new Set();

    const cameFrom = new Map();
    const gScore = new Map();
    const fScore = new Map();

    const startKey = this.key(start);
    gScore.set(startKey, 0);
    fScore.set(startKey, this.heuristic(start, goal));

    openSet.enqueue(start, fScore.get(startKey));

    while (!openSet.isEmpty()) {
      
      const current = openSet.dequeue();
      const currentKey = this.key(current);

      if (closed.has(currentKey)) {
        
        continue;
      
      }

      if (current.row === goal.row && current.col === goal.col) {
        
        const jumpPath = this.reconstructJumpPath(cameFrom, current);
        return this.expandJumpPath(jumpPath);
      
      }

      closed.add(currentKey);

      const successors = this.identifySuccessors(current, goal, cameFrom);

      for (const successor of successors) {
        const successorKey = this.key(successor);

        if (closed.has(successorKey)) {
          continue;
        }

        const tentativeG =
          (gScore.get(currentKey) ?? Infinity) + this.distance(current, successor);

        if (tentativeG < (gScore.get(successorKey) ?? Infinity)) {
          
          cameFrom.set(successorKey, current);
          gScore.set(successorKey, tentativeG);

          const successorF = tentativeG + this.heuristic(successor, goal);
          fScore.set(successorKey, successorF);

          openSet.enqueue(successor, successorF);
        }
      }
    }

    return [];
  }
}
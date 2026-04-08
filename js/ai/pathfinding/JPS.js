import { MinHeap } from './util/MinHeap.js';

export class JPS {
  constructor(map) {
    this.map = map;
  }

  key(tile) {
    return `${tile.row},${tile.col}`;
  }

  getTile(row, col) {
    if (
      row < 0 || row >= this.map.rows ||
      col < 0 || col >= this.map.cols
    ) {
      return null;
    }

    return this.map.grid[row][col];
  }

  isWalkable(row, col) {
    const tile = this.getTile(row, col);
    return !!(tile && tile.isWalkable());
  }

  heuristic(a, b) {
    return Math.abs(a.row - b.row) + Math.abs(a.col - b.col);
  }

  distance(a, b) {
    return Math.abs(a.row - b.row) + Math.abs(a.col - b.col);
  }

  reconstructJumpPath(cameFrom, current) {
    const path = [current];

    while (cameFrom.has(this.key(current))) {
      current = cameFrom.get(this.key(current));
      path.push(current);
    }

    return path.reverse();
  }

  getDirection(from, to) {
    return {
      dr: Math.sign(to.row - from.row),
      dc: Math.sign(to.col - from.col)
    };
  }

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
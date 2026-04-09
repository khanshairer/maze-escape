/*
Purpose : Do clustering for HPAStar
*/
export class ClusterGraph {
  // constructor 
  constructor(map, clusterSize = 5) {
    this.map = map;
    this.clusterSize = clusterSize;
    this.clusterRows = Math.ceil(map.rows / clusterSize);
    this.clusterCols = Math.ceil(map.cols / clusterSize);
    this.clusters = new Map();
    this.portalsByEdge = new Map();

    this.buildClusters();
    this.buildPortals();
  }

  // 
  buildClusters() {
    for (let clusterRow = 0; clusterRow < this.clusterRows; clusterRow++) {
      for (let clusterCol = 0; clusterCol < this.clusterCols; clusterCol++) {
        const id = this.getClusterId(clusterRow, clusterCol);
        const minRow = clusterRow * this.clusterSize;
        const maxRow = Math.min(this.map.rows - 1, minRow + this.clusterSize - 1);
        const minCol = clusterCol * this.clusterSize;
        const maxCol = Math.min(this.map.cols - 1, minCol + this.clusterSize - 1);

        this.clusters.set(id, {
          id,
          row: clusterRow,
          col: clusterCol,
          minRow,
          maxRow,
          minCol,
          maxCol,
          neighbours: new Set()
        });
      }
    }
  }

  buildPortals() {
    for (let clusterRow = 0; clusterRow < this.clusterRows; clusterRow++) {
      for (let clusterCol = 0; clusterCol < this.clusterCols; clusterCol++) {
        const clusterId = this.getClusterId(clusterRow, clusterCol);

        if (clusterCol < this.clusterCols - 1) {
          this.buildVerticalBoundaryPortals(
            clusterId,
            this.getClusterId(clusterRow, clusterCol + 1)
          );
        }

        if (clusterRow < this.clusterRows - 1) {
          this.buildHorizontalBoundaryPortals(
            clusterId,
            this.getClusterId(clusterRow + 1, clusterCol)
          );
        }
      }
    }
  }

  buildVerticalBoundaryPortals(leftClusterId, rightClusterId) {
    const leftCluster = this.clusters.get(leftClusterId);
    const boundaryCol = leftCluster.maxCol;

    let currentEntrance = [];

    for (let row = leftCluster.minRow; row <= leftCluster.maxRow; row++) {
      if (!this.map.isInGrid(row, boundaryCol + 1)) {
        this.commitEntrance(leftClusterId, rightClusterId, currentEntrance);
        currentEntrance = [];
        continue;
      }

      const leftTile = this.map.grid[row][boundaryCol];
      const rightTile = this.map.grid[row][boundaryCol + 1];

      if (leftTile.isWalkable() && rightTile.isWalkable()) {
        currentEntrance.push({
          clusterAId: leftClusterId,
          clusterBId: rightClusterId,
          tileA: leftTile,
          tileB: rightTile
        });
      } else {
        this.commitEntrance(leftClusterId, rightClusterId, currentEntrance);
        currentEntrance = [];
      }
    }

    this.commitEntrance(leftClusterId, rightClusterId, currentEntrance);
  }

  buildHorizontalBoundaryPortals(topClusterId, bottomClusterId) {
    const topCluster = this.clusters.get(topClusterId);
    const boundaryRow = topCluster.maxRow;

    let currentEntrance = [];

    for (let col = topCluster.minCol; col <= topCluster.maxCol; col++) {
      if (!this.map.isInGrid(boundaryRow + 1, col)) {
        this.commitEntrance(topClusterId, bottomClusterId, currentEntrance);
        currentEntrance = [];
        continue;
      }

      const topTile = this.map.grid[boundaryRow][col];
      const bottomTile = this.map.grid[boundaryRow + 1][col];

      if (topTile.isWalkable() && bottomTile.isWalkable()) {
        currentEntrance.push({
          clusterAId: topClusterId,
          clusterBId: bottomClusterId,
          tileA: topTile,
          tileB: bottomTile
        });
      } else {
        this.commitEntrance(topClusterId, bottomClusterId, currentEntrance);
        currentEntrance = [];
      }
    }

    this.commitEntrance(topClusterId, bottomClusterId, currentEntrance);
  }

  commitEntrance(clusterAId, clusterBId, entrance) {
    if (!entrance || entrance.length === 0) {
      return;
    }

    const selectedTransition = this.selectTransitionFromEntrance(entrance);
    this.addPortal(
      clusterAId,
      clusterBId,
      selectedTransition.tileA,
      selectedTransition.tileB
    );
  }

  selectTransitionFromEntrance(entrance) {
    if (entrance.length === 1) {
      return entrance[0];
    }

    const middleIndex = Math.floor(entrance.length / 2);
    return entrance[middleIndex];
  }

  addPortal(clusterAId, clusterBId, tileA, tileB) {
    const edgeKey = this.getEdgeKey(clusterAId, clusterBId);
    if (!this.portalsByEdge.has(edgeKey)) {
      this.portalsByEdge.set(edgeKey, []);
    }

    this.portalsByEdge.get(edgeKey).push({
      clusterAId,
      clusterBId,
      tileA,
      tileB
    });

    this.clusters.get(clusterAId).neighbours.add(clusterBId);
    this.clusters.get(clusterBId).neighbours.add(clusterAId);
  }

  getClusterId(clusterRow, clusterCol) {
    return `${clusterRow},${clusterCol}`;
  }

  getEdgeKey(clusterAId, clusterBId) {
    return [clusterAId, clusterBId].sort().join('|');
  }

  getClusterForTile(tile) {
    if (!tile) {
      return null;
    }

    const clusterRow = Math.floor(tile.row / this.clusterSize);
    const clusterCol = Math.floor(tile.col / this.clusterSize);
    return this.clusters.get(this.getClusterId(clusterRow, clusterCol)) || null;
  }

  getClusterIdForTile(tile) {
    const cluster = this.getClusterForTile(tile);
    return cluster ? cluster.id : null;
  }

  getPortalsBetween(clusterAId, clusterBId) {
    return this.portalsByEdge.get(this.getEdgeKey(clusterAId, clusterBId)) || [];
  }

  getClusterNeighbours(clusterId) {
    const cluster = this.clusters.get(clusterId);
    return cluster ? Array.from(cluster.neighbours) : [];
  }

  heuristic(clusterAId, clusterBId) {
    const clusterA = this.clusters.get(clusterAId);
    const clusterB = this.clusters.get(clusterBId);

    if (!clusterA || !clusterB) {
      return Infinity;
    }

    return Math.abs(clusterA.row - clusterB.row) + Math.abs(clusterA.col - clusterB.col);
  }
}
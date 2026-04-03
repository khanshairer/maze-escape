import { Pathfinder } from './Pathfinder.js';
import { ClusterGraph } from './ClusterGraph.js';

export class HierarchicalAStar extends Pathfinder {
  constructor(map, { clusterSize = 5 } = {}) {
    super();
    this.map = map;
    this.clusterGraph = new ClusterGraph(map, clusterSize);
  }

  getClusterIdForTile(tile) {
    return this.clusterGraph.getClusterIdForTile(tile);
  }

  findPath(start, end, mapOverride = this.map) {
    const map = mapOverride || this.map;

    if (!start || !end || !map || !start.isWalkable() || !end.isWalkable()) {
      return [];
    }

    if (start === end) {
      return [start];
    }

    const startClusterId = this.clusterGraph.getClusterIdForTile(start);
    const endClusterId = this.clusterGraph.getClusterIdForTile(end);

    if (!startClusterId || !endClusterId) {
      return [];
    }

    if (startClusterId === endClusterId) {
      return this.lowLevelAStar(start, end, new Set([startClusterId]));
    }

    const clusterRoute = this.findClusterRoute(startClusterId, endClusterId);
    if (clusterRoute.length === 0) {
      return [];
    }

    return this.buildHierarchicalPath(start, end, clusterRoute);
  }

  findClusterRoute(startClusterId, endClusterId) {
    const open = [startClusterId];
    const openSet = new Set(open);
    const cameFrom = new Map();
    const gScore = new Map([[startClusterId, 0]]);
    const fScore = new Map([
      [startClusterId, this.clusterGraph.heuristic(startClusterId, endClusterId)]
    ]);

    while (open.length > 0) {
      open.sort((a, b) => (fScore.get(a) ?? Infinity) - (fScore.get(b) ?? Infinity));
      const current = open.shift();
      openSet.delete(current);

      if (current === endClusterId) {
        return this.tracePath(cameFrom, startClusterId, endClusterId);
      }

      for (const neighbourId of this.clusterGraph.getClusterNeighbours(current)) {
        const tentativeG = (gScore.get(current) ?? Infinity) + 1;

        if (tentativeG < (gScore.get(neighbourId) ?? Infinity)) {
          cameFrom.set(neighbourId, current);
          gScore.set(neighbourId, tentativeG);
          fScore.set(
            neighbourId,
            tentativeG + this.clusterGraph.heuristic(neighbourId, endClusterId)
          );

          if (!openSet.has(neighbourId)) {
            open.push(neighbourId);
            openSet.add(neighbourId);
          }
        }
      }
    }

    return [];
  }

  buildHierarchicalPath(start, end, clusterRoute) {
    let currentTile = start;
    const finalPath = [start];

    for (let i = 0; i < clusterRoute.length - 1; i++) {
      const currentClusterId = clusterRoute[i];
      const nextClusterId = clusterRoute[i + 1];
      const selectedPortal = this.selectPortalForStep(
        currentTile,
        end,
        currentClusterId,
        nextClusterId
      );

      if (!selectedPortal) {
        return this.lowLevelAStar(start, end, new Set(clusterRoute));
      }

      const segmentToPortal = this.lowLevelAStar(
        currentTile,
        selectedPortal.fromTile,
        new Set([currentClusterId])
      );

      if (segmentToPortal.length === 0) {
        return this.lowLevelAStar(start, end, new Set(clusterRoute));
      }

      this.appendPath(finalPath, segmentToPortal);
      this.appendTile(finalPath, selectedPortal.toTile);
      currentTile = selectedPortal.toTile;
    }

    const endClusterId = clusterRoute[clusterRoute.length - 1];
    const finalSegment = this.lowLevelAStar(
      currentTile,
      end,
      new Set([endClusterId])
    );

    if (finalSegment.length === 0) {
      return [];
    }

    this.appendPath(finalPath, finalSegment);
    return finalPath;
  }

  selectPortalForStep(currentTile, endTile, currentClusterId, nextClusterId) {
    const portals = this.clusterGraph.getPortalsBetween(currentClusterId, nextClusterId);
    let bestPortal = null;
    let bestScore = Infinity;

    for (const portal of portals) {
      const orientedPortal =
        portal.clusterAId === currentClusterId
          ? { fromTile: portal.tileA, toTile: portal.tileB }
          : { fromTile: portal.tileB, toTile: portal.tileA };

      const segment = this.lowLevelAStar(
        currentTile,
        orientedPortal.fromTile,
        new Set([currentClusterId])
      );

      if (segment.length === 0) {
        continue;
      }

      const score =
        this.pathCost(segment) +
        this.tileHeuristic(orientedPortal.toTile, endTile);

      if (score < bestScore) {
        bestScore = score;
        bestPortal = orientedPortal;
      }
    }

    return bestPortal;
  }

  lowLevelAStar(start, end, allowedClusterIds) {
    if (start === end) {
      return [start];
    }

    const open = [start];
    const openSet = new Set(open);
    const cameFrom = new Map();
    const gScore = new Map([[start, 0]]);
    const fScore = new Map([[start, this.tileHeuristic(start, end)]]);

    while (open.length > 0) {
      open.sort((a, b) => (fScore.get(a) ?? Infinity) - (fScore.get(b) ?? Infinity));
      const current = open.shift();
      openSet.delete(current);

      if (current === end) {
        return this.tracePath(cameFrom, start, end);
      }

      for (const neighbour of this.map.getNeighbours(current)) {
        if (!this.isTileAllowed(neighbour, allowedClusterIds, end)) {
          continue;
        }

        const tentativeG = (gScore.get(current) ?? Infinity) + neighbour.cost;

        if (tentativeG < (gScore.get(neighbour) ?? Infinity)) {
          cameFrom.set(neighbour, current);
          gScore.set(neighbour, tentativeG);
          fScore.set(neighbour, tentativeG + this.tileHeuristic(neighbour, end));

          if (!openSet.has(neighbour)) {
            open.push(neighbour);
            openSet.add(neighbour);
          }
        }
      }
    }

    return [];
  }

  isTileAllowed(tile, allowedClusterIds, endTile) {
    if (tile === endTile) {
      return true;
    }

    const clusterId = this.clusterGraph.getClusterIdForTile(tile);
    return allowedClusterIds.has(clusterId);
  }

  tileHeuristic(tileA, tileB) {
    return Math.abs(tileA.row - tileB.row) + Math.abs(tileA.col - tileB.col);
  }

  pathCost(path) {
    return path.reduce((total, tile) => total + (tile.cost ?? 1), 0);
  }

  appendPath(target, segment) {
    for (const tile of segment) {
      this.appendTile(target, tile);
    }
  }

  appendTile(target, tile) {
    if (target[target.length - 1] !== tile) {
      target.push(tile);
    }
  }
}

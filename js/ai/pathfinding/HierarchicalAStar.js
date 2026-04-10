import { Pathfinder } from './Pathfinder.js';
import { ClusterGraph } from './ClusterGraph.js';
import { MinHeap } from './util/MinHeap.js';

/*
Purpose : The HierarchicalAStar class implements a hierarchical pathfinding algorithm that combines high-level
 cluster-based pathfinding with low-level A* search.
*/

export class HierarchicalAStar extends Pathfinder {
  // Initialize the pathfinder with a reference to the map and create a cluster graph based on the map and specified cluster size
  constructor(map, { clusterSize = 5 } = {}) {
    super();
    this.map = map;
    this.clusterSize = clusterSize;
    this.clusterGraph = new ClusterGraph(map, clusterSize);
  }

  /**
   * Rebuild the hierarchical pathfinder for a new map.
   * Use this when the tilemap changes (new level, procedural generation).
   */
  rebuild(map) {
    this.map = map;
    this.clusterGraph = new ClusterGraph(map, this.clusterSize);
  }

  // Get the cluster ID for a given tile by querying the cluster graph, which allows the pathfinder 
  // to determine which cluster a tile belongs to for high-level pathfinding
  getClusterIdForTile(tile) {
    return this.clusterGraph.getClusterIdForTile(tile);
  }

  // Find a path from a start tile to an end tile, optionally using a specific map for pathfinding. 
  // The method first checks if the start and end tiles are valid and walkable,
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

  // Find a route through the cluster graph from the start cluster to the end cluster using A* search, which provides 
  // a high-level path that can then be refined with low-level pathfinding
  findClusterRoute(startClusterId, endClusterId) {
    const open = new MinHeap();
    const openSet = new Set();
    const cameFrom = new Map();
    const gScore = new Map([[startClusterId, 0]]);
    const fScore = new Map([
      [startClusterId, this.clusterGraph.heuristic(startClusterId, endClusterId)]
    ]);

    open.enqueue(startClusterId, fScore.get(startClusterId));
    openSet.add(startClusterId);

    while (!open.isEmpty()) {
      const current = open.dequeue();
      openSet.delete(current);

      if (current === endClusterId) {
        return this.tracePath(cameFrom, startClusterId, endClusterId);
      }

      for (const neighbourId of this.clusterGraph.getClusterNeighbours(current)) {
        const tentativeG = (gScore.get(current) ?? Infinity) + 1;

        if (tentativeG < (gScore.get(neighbourId) ?? Infinity)) {
          cameFrom.set(neighbourId, current);
          gScore.set(neighbourId, tentativeG);

          const priority =
            tentativeG + this.clusterGraph.heuristic(neighbourId, endClusterId);

          fScore.set(neighbourId, priority);
          open.enqueue(neighbourId, priority);
          openSet.add(neighbourId);
        }
      }
    }

    return [];
  }

  // Get the appropriate map adapter for a given position by checking which map the position falls within and 
  // returning an object with a handleCollisions method that adjusts entity positions based on the specific map's collision handling
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

  // Select the best portal to use for transitioning between clusters based on a combination of 
  // the low-level path cost to the portal and a heuristic estimate of the remaining distance to the end tile
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

  // Perform a low-level A* search between two tiles while restricting the search to a specified set of allowed cluster IDs,
  lowLevelAStar(start, end, allowedClusterIds) {
    if (start === end) {
      return [start];
    }

    const open = new MinHeap();
    const openSet = new Set();
    const cameFrom = new Map();
    const gScore = new Map([[start, 0]]);
    const fScore = new Map([[start, this.tileHeuristic(start, end)]]);

    open.enqueue(start, fScore.get(start));
    openSet.add(start);

    while (!open.isEmpty()) {
      const current = open.dequeue();
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

          const priority = tentativeG + this.tileHeuristic(neighbour, end);
          fScore.set(neighbour, priority);

          open.enqueue(neighbour, priority);
          openSet.add(neighbour);
        }
      }
    }

    return [];
  }

  // Check if a tile is allowed for traversal based on whether it is the end tile or if its 
  // cluster ID is in the set of allowed cluster IDs,
  isTileAllowed(tile, allowedClusterIds, endTile) {
    if (tile === endTile) {
      return true;
    }

    const clusterId = this.clusterGraph.getClusterIdForTile(tile);
    return allowedClusterIds.has(clusterId);
  }

  // Calculate a heuristic estimate of the distance between two tiles using Manhattan distance, which is suitable for grid-based maps
  tileHeuristic(tileA, tileB) {
    return Math.abs(tileA.row - tileB.row) + Math.abs(tileA.col - tileB.col);
  }

  // Calculate the total cost of a path by summing the cost of each tile in the path, using a 
  // default cost of 1 if a tile does not have a specific cost defined
  pathCost(path) {
    return path.reduce((total, tile) => total + (tile.cost ?? 1), 0);
  }

  // Append a segment of tiles to the target path, ensuring that the last tile of the target is not 
  // duplicated if it is the same as the first tile of the segment
  appendPath(target, segment) {
    for (const tile of segment) {
      this.appendTile(target, tile);
    }
  }

  // Append a single tile to the target path if it is not the same as the last tile in the target,
  appendTile(target, tile) {
    if (target[target.length - 1] !== tile) {
      target.push(tile);
    }
  }
}
import { MinHeap } from "./util/MinHeap";
import { Pathfinder } from "./Pathfinder";


export class Dijkstra extends Pathfinder {

  constructor() {
    super();
  }

  // Implement our findPath as Dijkstra
  findPath(start, end, map) {
  
    // Keep track of three things
    let open = new MinHeap();
    let costs = new Map();
    let parents = new Map();

    // It costs nothing to get to start
    costs.set(start, 0);

    // There is no parent of start
    parents.set(start, null);

    // Enqueue at a cost of 0
    open.enqueue(start, 0);

    while (!open.isEmpty()) {

      let current = open.dequeue();

      if (current === end) {
        return this.tracePath(parents, start, end);
      }

      for (let neighbour of map.getNeighbours(current)) {
        let newCost = costs.get(current) + neighbour.cost;

        if (!costs.has(neighbour) || newCost < costs.get(neighbour)) {
          parents.set(neighbour, current);
          costs.set(neighbour, newCost);
          open.enqueue(neighbour, newCost);
        }
      }
    }
    return [];
  }

  totalCost(path) {
    let total = 0;
    for (let tile of path) {
      total += tile.cost;
    }
    return total;
  }

  // Get the costs of the neighbours of a tile
  getNeighboursCosts(tile, goal, map) {
    // Add validation
    if (!tile || !goal || !map) {
      console.warn('Invalid inputs to getNeighboursCosts');
      return new Map();
    }
    
    let neighbours = map.getNeighbours(tile);
    let costs = new Map();
     
    for (let neighbour of neighbours) {
      // Skip if neighbour is undefined
      if (!neighbour) continue;
      
      let path = this.findPath(neighbour, goal, map);
      
      // Only calculate cost if path exists
      if (path && path.length > 0) {
        let temp = this.totalCost(path);
        costs.set(neighbour, temp);
      } else {
        // If no path exists, set infinite cost
        costs.set(neighbour, Infinity);
      }
    }
    return costs;
  }
  
}
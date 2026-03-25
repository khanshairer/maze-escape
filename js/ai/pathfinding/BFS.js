import { Pathfinder } from "./Pathfinder";


export class BFS extends Pathfinder {

  constructor() {
    super();
  }

  // Find path implementing BFS
  findPath(start, end, map) {

    let open = [start];
    let parents = new Map();
    parents.set(start, null);

    while (open.length > 0) {

      // Dequeue from our open queue
      let current = open.shift();

      if (current === end) {
        return this.tracePath(parents, start, end);
      }

      for (let neighbour of map.getNeighbours(current)) {
        if (!parents.has(neighbour)) {
          open.push(neighbour);
          parents.set(neighbour, current);
        }
      }
    }
    return [];
  }

}
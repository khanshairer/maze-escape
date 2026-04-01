export class AStar {
  static heuristic(a, b) {
    return Math.abs(a.row - b.row) + Math.abs(a.col - b.col);
  }

  static findPath(start, goal, map) {
    let openSet = [start];
    let cameFrom = new Map();

    let gScore = new Map();
    let fScore = new Map();

    gScore.set(start, 0);
    fScore.set(start, this.heuristic(start, goal));

    while (openSet.length > 0) {
      openSet.sort((a, b) => (fScore.get(a) || Infinity) - (fScore.get(b) || Infinity));
      let current = openSet.shift();

      if (current === goal) {
        return this.reconstructPath(cameFrom, current);
      }

      for (let neighbor of map.getNeighbours(current)) {
        let tentativeG = (gScore.get(current) || Infinity) + neighbor.cost;

        if (tentativeG < (gScore.get(neighbor) || Infinity)) {
          cameFrom.set(neighbor, current);
          gScore.set(neighbor, tentativeG);
          fScore.set(neighbor, tentativeG + this.heuristic(neighbor, goal));

          if (!openSet.includes(neighbor)) {
            openSet.push(neighbor);
          }
        }
      }
    }

    return [];
  }

  static reconstructPath(cameFrom, current) {
    let path = [current];

    while (cameFrom.has(current)) {
      current = cameFrom.get(current);
      path.unshift(current);
    }

    return path;
  }
}
import { Tile } from '../maps/Tile.js';
import { Partition } from './Partition.js';
import { Room } from './Room.js';

export class DungeonGenerator {

  static generate(map, minRoomSize = 4) {
    // Fill the whole map with obstacles first
    for (let r = 0; r < map.rows; r++) {
      for (let c = 0; c < map.cols; c++) {
        map.grid[r][c].type = Tile.Type.Obstacle;
      }
    }

    let root = new Partition(0, 0, map.cols, map.rows);

    // Slightly bigger than room size so partitions can contain rooms
    let minPartitionSize = minRoomSize + 2;
    root.split(minPartitionSize);

    let leaves = root.getLeaves();
    let rooms = this.createRooms(leaves, map, minRoomSize);
    let connections = this.createConnections(rooms);

    for (let connection of connections) {
      this.carveCorridor(connection.from, connection.to, map);
    }

    map.walkableTiles = map.grid.flat().filter(tile => tile.isWalkable());

    return {
      root,
      leaves,
      rooms,
      connections
    };
  }

  static createRooms(partitions, map, minRoomSize) {
    let rooms = [];

    for (let partition of partitions) {
      let maxRoomWidth = partition.width - 2;
      let maxRoomHeight = partition.height - 2;

      if (maxRoomWidth < minRoomSize || maxRoomHeight < minRoomSize) {
        continue;
      }

      let roomWidth = randomInt(minRoomSize, maxRoomWidth);
      let roomHeight = randomInt(minRoomSize, maxRoomHeight);

      let roomX = randomInt(
        partition.x + 1,
        partition.x + partition.width - roomWidth - 1
      );

      let roomY = randomInt(
        partition.y + 1,
        partition.y + partition.height - roomHeight - 1
      );

      let room = new Room(roomX, roomY, roomWidth, roomHeight);
      rooms.push(room);

      for (let r = room.y; r < room.y + room.height; r++) {
        for (let c = room.x; c < room.x + room.width; c++) {
          if (map.isInGrid(r, c)) {
            map.grid[r][c].type = Tile.Type.EasyTerrain;
          }
        }
      }
    }

    return rooms;
  }

  static createConnections(rooms) {
    let connections = [];

    if (rooms.length <= 1) {
      return connections;
    }

    let connected = new Set();
    let remaining = new Set();

    connected.add(rooms[0]);

    for (let i = 1; i < rooms.length; i++) {
      remaining.add(rooms[i]);
    }

    while (remaining.size > 0) {
      let bestFrom = null;
      let bestTo = null;
      let bestDistance = Infinity;

      for (let from of connected) {
        for (let to of remaining) {
          let dist = this.manhattanDistance(from.center(), to.center());

          if (dist < bestDistance) {
            bestDistance = dist;
            bestFrom = from;
            bestTo = to;
          }
        }
      }

      if (bestFrom && bestTo) {
        connections.push({ from: bestFrom, to: bestTo });
        connected.add(bestTo);
        remaining.delete(bestTo);
      } else {
        break;
      }
    }

    return connections;
  }

  static carveCorridor(a, b, map) {
    let centerA = a.center();
    let centerB = b.center();

    let horizontalFirst = Math.random() < 0.5;

    if (horizontalFirst) {
      this.carveHorizontal(centerA.x, centerB.x, centerA.y, map);
      this.carveVertical(centerA.y, centerB.y, centerB.x, map);
    } else {
      this.carveVertical(centerA.y, centerB.y, centerA.x, map);
      this.carveHorizontal(centerA.x, centerB.x, centerB.y, map);
    }
  }

  static carveHorizontal(x1, x2, y, map) {
    let start = Math.min(x1, x2);
    let end = Math.max(x1, x2);

    for (let x = start; x <= end; x++) {
      if (map.isInGrid(y, x)) {
        map.grid[y][x].type = Tile.Type.EasyTerrain;
      }
    }
  }

  static carveVertical(y1, y2, x, map) {
    let start = Math.min(y1, y2);
    let end = Math.max(y1, y2);

    for (let y = start; y <= end; y++) {
      if (map.isInGrid(y, x)) {
        map.grid[y][x].type = Tile.Type.EasyTerrain;
      }
    }
  }

  static manhattanDistance(a, b) {
    return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
  }
}

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
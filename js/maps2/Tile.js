import * as THREE from 'three';

// Tile class, which is our nodes
export class Tile {

  // Possible tile types
  static Type = Object.freeze({
    EasyTerrain: Symbol("EasyTerrain"),
    MediumTerrain: Symbol("MediumTerrain"),
    DifficultTerrain: Symbol("DifficultTerrain"),
    Obstacle: Symbol("Obstacle")
  });

  // Map to hold costs associated with types
  static Cost = new Map([
    [Tile.Type.EasyTerrain, 1],
    [Tile.Type.MediumTerrain, 3],
    [Tile.Type.DifficultTerrain, 5],
    [Tile.Type.Obstacle, 10]
  ]);

  // Tile constructor
  constructor(row, col, type = Tile.Type.EasyTerrain) {
    this.row = row;
    this.col = col;
    this.type = type;
    this.cost = Tile.Cost.get(this.type);
    
    // added for pathfinding algorithms
    this.pathCost = Infinity; 
    this.flowVector = new THREE.Vector3(0,0,0);

  }

  // Check to see if we can walk on this tile
  isWalkable() {
    return this.type !== Tile.Type.Obstacle;
  }

}

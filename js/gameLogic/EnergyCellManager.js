import * as THREE from 'three';
import { EnergyCell } from '../entities/EnergyCell.js';
/*
Purpose : The EnergyCellManager class is responsible for managing the creation, placement, and collection of energy cells in the game world. 
It handles spawning energy cells on valid tiles, ensuring they do not overlap with the player or each other, 
and updating their state as the player collects them.
*/
export class EnergyCellManager {
  // Initialize the manager with a reference to the world object
  constructor(world) {
    this.world = world;
  }

  // Create energy cells in the world, either for the main map or a specific map with an offset
  createEnergyCells(numCells = 5) {
    this.spawnEnergyCells(this.world.map, new THREE.Vector3(0, 0, 0), numCells);
  }

  // Create energy cells for a specific map with an offset, used for spawning in the second maze or dungeon
  createEnergyCellsForMap(map, offset, numCells = 5) {
    this.spawnEnergyCells(map, offset, numCells);
  }

  // Spawn energy cells on valid tiles within the specified map and offset, ensuring they do not overlap with the player or each other
  spawnEnergyCells(map, offset, numCells = 5) {
    let createdCount = 0;
    let attempts = 0;
    const maxAttempts = 1000;

    while (createdCount < numCells && attempts < maxAttempts) {
      attempts++;

      const randomTile =
        map.walkableTiles[Math.floor(Math.random() * map.walkableTiles.length)];

      if (!this.isValidEnergyCellTile(map, randomTile, offset)) {
        continue;
      }

      const cell = new EnergyCell({
        tile: randomTile,
        map,
        offset,
        position: map.localize(randomTile).clone().add(offset)
      });

      this.world.energyCells.push(cell);
      this.world.totalEnergyCells++;
      this.world.scene.add(cell.mesh);
      createdCount++;
    }
  }

  // Check if a tile is valid for placing an energy cell, ensuring it is walkable, not occupied by another cell, 
  // and not on the player's current tile
  isValidEnergyCellTile(map, tile, offset) {
    if (!tile || !tile.isWalkable()) {
      return false;
    }

    const occupied = this.world.energyCells.some(
      (cell) =>
        cell.map === map &&
        cell.tile.row === tile.row &&
        cell.tile.col === tile.col
    );

    if (occupied) {
      return false;
    }

    if (!this.world.main_character || map !== this.world.map) {
      return true;
    }

    const playerTile = map.quantize(
      this.world.main_character.position.clone().sub(offset)
    );

    return !(playerTile.row === tile.row && playerTile.col === tile.col);
  }

  // Update the state of energy cells, checking for collection by the player and updating their visual state
  updateEnergyCells(dt) {
    if (!this.world.main_character || this.world.energyCells.length === 0) {
      return;
    }

    for (let cell of this.world.energyCells) {
      if (cell.collected) {
        continue;
      }

      cell.update(dt);

      if (
        this.world.main_character.position.distanceTo(cell.position) <=
        this.world.energyCellCollectionRadius
      ) {
        cell.collect();
        this.world.collectedEnergyCells++;
      }
    }
  }
}
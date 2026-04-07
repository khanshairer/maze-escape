import * as THREE from 'three';
import { EnergyCell } from '../entities/EnergyCell.js';

export class EnergyCellManager {
  constructor(world) {
    this.world = world;
  }

  createEnergyCells(numCells = 5) {
    this.spawnEnergyCells(this.world.map, new THREE.Vector3(0, 0, 0), numCells);
  }

  createEnergyCellsForMap(map, offset, numCells = 5) {
    this.spawnEnergyCells(map, offset, numCells);
  }

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
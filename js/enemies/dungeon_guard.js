import * as THREE from 'three';
import { DynamicEntity } from '../entities/DynamicEntity.js';

export class DungeonGuard extends DynamicEntity {
  constructor(position) {
    super({
      position: position.clone(),
      velocity: new THREE.Vector3(0, 0, 0),
      color: 0x8800ff,
      scale: new THREE.Vector3(1, 1, 1),
      topSpeed: 3.0
    });

    this.position.y = 1;
    this.isDungeonGuard = true;

    // AI state
    this.state = 'patrol';
    this.path = [];
    this.pathIndex = 0;
    this.targetTile = null;
    this.repathTimer = 0;

    // behavior tuning
    this.detectionRadius = 10;
    this.attackRadius = 1.5;
    this.maxSteeringForce = 4.0;
    this.separationRadius = 3.0;
    this.separationStrength = 2.0;
    this.arrivalRadius = 1.2;

    // patrol / chase helpers
    this.homeTile = null;
    this.homePosition = position.clone();
    this.lastKnownPlayerTile = null;
    this.isAlerted = false;
  }

  static spawnInDungeon(dungeonMap, dungeonOffset) {
    if (!dungeonMap.walkableTiles || dungeonMap.walkableTiles.length === 0) {
      return null;
    }

    let tile =
      dungeonMap.walkableTiles[
        Math.floor(Math.random() * dungeonMap.walkableTiles.length)
      ];

    let pos = dungeonMap.localize(tile).clone().add(dungeonOffset);

    let guard = new DungeonGuard(pos);
    guard.homeTile = tile;
    guard.targetTile = tile;

    return guard;
  }

  resetPath() {
    this.path = [];
    this.pathIndex = 0;
  }

  setTargetTile(tile) {
    this.targetTile = tile;
    this.resetPath();
  }

  clearTargetTile() {
    this.targetTile = null;
    this.resetPath();
  }

  reachedAttackRange(targetPosition) {
    return this.position.distanceTo(targetPosition) <= this.attackRadius;
  }

  canDetectTarget(targetPosition) {
    return this.position.distanceTo(targetPosition) <= this.detectionRadius;
  }

  applyGroundLock() {
    this.position.y = 1;

    if (this.velocity) {
      this.velocity.y = 0;
    }

    if (this.acceleration) {
      this.acceleration.y = 0;
    }
  }
}
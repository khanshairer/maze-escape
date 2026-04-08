import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/Addons.js';
import { DroneEnemy } from './DroneEnemy.js';

export class DroneEntity {
  constructor(world) {
    this.world = world;
    this.loader = new GLTFLoader();
  }

  create(numDrones = 3) {
    this.world.drones = [];
    this.world.modelsLoading += numDrones;

    for (let i = 0; i < numDrones; i++) {
      const droneTile = this.getValidSpawnTile(
        this.world.map2,
        this.world.drones
      );

      const dronePosition = this.world.map2
        .localize(droneTile)
        .clone()
        .add(this.world.map2Offset);

      const drone = new DroneEnemy({
        spawnTile: droneTile,
        homeTile: droneTile,
        patrolMap: this.world.map2,
        position: dronePosition.clone(),
        velocity: new THREE.Vector3(0, 0, 0),
        color: 0xffaa33,
        scale: new THREE.Vector3(1, 1, 1),
        topSpeed: 3.5
      });

      drone.position.y = 1;
      drone.mesh.rotation.y = Math.random() * Math.PI * 2;

      drone.initializeFSM({
        player: this.world.main_character,
        world: this.world
      });

      drone.setPathfinder(this.world.droneHierarchicalPathfinder);

      this.addDetectionCircle(drone);
      this.loadVisual(drone);

      this.world.drones.push(drone);
      this.world.addEntityToWorld(drone);
    }
  }

  getValidSpawnTile(map, existingDrones = []) {
    let spawnTile;
    let spawnPosition;
    let tries = 0;

    do {
      spawnTile = map.getRandomWalkableTile();
      spawnPosition = map.localize(spawnTile);
      tries++;
    } while (
      tries < 300 &&
      existingDrones.some((drone) => {
        const droneLocalPos = drone.position.clone().sub(this.world.map2Offset);
        return droneLocalPos.distanceTo(spawnPosition) < 5;
      })
    );

    return spawnTile;
  }

  loadVisual(drone) {
    this.loader.load(
      '/animated_drone/scene.gltf',
      (gltf) => {
        drone.applyDroneModel(gltf, this.world.mixers);

        if (drone._pendingDetectionCircle) {
          drone.mesh.add(drone._pendingDetectionCircle);
          drone.detectionCircle = drone._pendingDetectionCircle;
          drone._pendingDetectionCircle = null;
        }

        this.world.modelsLoaded++;
        this.world.updateLoadingIndicator();
      },
      undefined,
      () => {
        drone.handleLoadError();

        if (drone._pendingDetectionCircle) {
          drone.mesh.add(drone._pendingDetectionCircle);
          drone.detectionCircle = drone._pendingDetectionCircle;
          drone._pendingDetectionCircle = null;
        }

        this.world.modelsLoaded++;
        this.world.updateLoadingIndicator();
      }
    );
  }

  addDetectionCircle(drone) {
    const radius = drone.detectRange ?? drone.detectionRange ?? 6;
    const geometry = new THREE.CircleGeometry(radius, 64);

    const material = new THREE.MeshBasicMaterial({
      color: 0x66e0ff,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.25,
      depthWrite: false
    });

    const circle = new THREE.Mesh(geometry, material);
    circle.rotation.x = -Math.PI / 2;
    circle.position.y = 0.05;
    circle.renderOrder = 999;

    drone._pendingDetectionCircle = circle;
  }

  respawn(npc) {
    const spawnTile = this.getValidSpawnTile(
      this.world.map2,
      this.world.drones.filter((drone) => drone !== npc)
    );

    const spawnPos = this.world.map2
      .localize(spawnTile)
      .clone()
      .add(this.world.map2Offset);

    npc.spawnTile = spawnTile;
    npc.homeTile = spawnTile;
    npc.patrolMap = this.world.map2;

    if (typeof npc.resetToSpawn === 'function') {
      npc.resetToSpawn(spawnPos);
    } else {
      npc.position.copy(spawnPos);
      npc.position.y = 1;
      npc.velocity.set(0, 0, 0);

      if (npc.acceleration) {
        npc.acceleration.set(0, 0, 0);
      }

      npc.mesh.visible = true;
    }

    npc.respawnTimer = 0;
    npc.position.y = 1;
    npc.mesh.visible = true;
  }

  startRespawnCooldown(npc) {
    const delay =
      this.world.droneRespawnDelay ??
      this.world.groundAttackerRespawnDelay ??
      4;

    npc.respawnTimer = delay;
    npc.velocity.set(0, 0, 0);

    if (npc.acceleration) {
      npc.acceleration.set(0, 0, 0);
    }

    npc.mesh.visible = false;
    npc.position.y = -100;
  }

  update(dt) {
    if (!this.world.drones || this.world.drones.length === 0) return;

    for (let drone of this.world.drones) {
      if (!drone) continue;

      if (drone.respawnTimer > 0) {
        drone.respawnTimer -= dt;

        if (drone.respawnTimer <= 0) {
          this.respawn(drone);
        }

        continue;
      }

      drone.position.y = 1;

      if (drone.velocity) drone.velocity.y = 0;
      if (drone.acceleration) drone.acceleration.y = 0;

      // THIS is the missing FSM call from your old code
      if (typeof drone.updateFSM === 'function') {
        drone.updateFSM(dt, {
          player: this.world.main_character,
          world: this.world
        });
      }
    }

    const minX = this.world.map2Offset.x + this.world.map2.minX + 1;
    const maxX =
      this.world.map2Offset.x +
      this.world.map2.minX +
      this.world.map2.cols * this.world.map2.tileSize -
      1;

    const minZ = this.world.map2.minZ + 1;
    const maxZ =
      this.world.map2.minZ +
      this.world.map2.rows * this.world.map2.tileSize -
      1;

    for (let drone of this.world.drones) {
      if (!drone || drone.respawnTimer > 0) continue;

      drone.position.x = THREE.MathUtils.clamp(drone.position.x, minX, maxX);
      drone.position.z = THREE.MathUtils.clamp(drone.position.z, minZ, maxZ);

      const localPos = drone.position.clone().sub(this.world.map2Offset);
      const tile = this.world.map2.quantize(localPos);

      if (!tile || !tile.isWalkable()) {
        let bestTile = null;
        let bestDist = Infinity;

        for (let walkable of this.world.map2.walkableTiles) {
          const safePos = this.world.map2
            .localize(walkable)
            .clone()
            .add(this.world.map2Offset);

          const dist = safePos.distanceTo(drone.position);

          if (dist < bestDist) {
            bestDist = dist;
            bestTile = walkable;
          }
        }

        if (bestTile) {
          const correctedPos = this.world.map2
            .localize(bestTile)
            .clone()
            .add(this.world.map2Offset);

          drone.position.copy(correctedPos);
          drone.velocity.set(0, 0, 0);

          if (drone.acceleration) {
            drone.acceleration.set(0, 0, 0);
          }
        }
      }

      drone.position.y = 1;
    }
  }
}
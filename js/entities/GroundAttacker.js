import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/Addons.js';
import { DynamicEntity } from './DynamicEntity.js';

export class GroundAttacker extends DynamicEntity {
  constructor({
    spawnTile = null,
    patrolMap = null,
    goalTile = null,
    ...entityConfig
  } = {}) {
    super(entityConfig);

    this.spawnTile = spawnTile;
    this.patrolMap = patrolMap;
    this.goalTile = goalTile;
    this.boatLoaded = false;
    this.loadError = false;
    this.modelFacingOffset = 0;
  }

  static findSpawnTile(map, {
    avoidPositions = [],
    avoidDistance = 6,
    peers = [],
    peerDistance = 5,
    maxTries = 300
  } = {}) {
    let spawnTile = map.getRandomWalkableTile();
    let spawnPosition = map.localize(spawnTile);
    let tries = 0;

    do {
      spawnTile = map.getRandomWalkableTile();
      spawnPosition = map.localize(spawnTile);
      tries++;
    } while (
      tries < maxTries &&
      (
        avoidPositions.some((position) => spawnPosition.distanceTo(position) < avoidDistance) ||
        peers.some((peer) => peer.position.distanceTo(spawnPosition) < peerDistance)
      )
    );

    return spawnTile;
  }

  loadVisual({ mixers = [], onLoaded = null, onError = null } = {}) {
    const loader = new GLTFLoader();

    loader.load(
      '/sphere_robot/scene.gltf',
      (gltf) => {
        const model = gltf.scene;

        while (this.mesh.children.length > 0) {
          this.mesh.remove(this.mesh.children[0]);
        }

        model.scale.set(2.2, 2.2, 2.2);

        const box = new THREE.Box3().setFromObject(model);
        model.position.y = -box.min.y;
        model.rotation.y = 0;

        this.mesh.add(model);
        this.robotModel = model;
        this.boatLoaded = true;

        if (gltf.animations && gltf.animations.length > 0) {
          const mixer = new THREE.AnimationMixer(model);
          const action = mixer.clipAction(gltf.animations[0]);
          action.play();
          this.mixer = mixer;
          mixers.push(mixer);
        }

        if (onLoaded) {
          onLoaded(gltf);
        }
      },
      undefined,
      (error) => {
        this.boatLoaded = true;
        this.loadError = true;

        if (onError) {
          onError(error);
        }
      }
    );
  }

  prepareForUpdate() {
    this.position.y = 1;

    if (this.velocity) {
      this.velocity.y = 0;
    }

    if (this.acceleration) {
      this.acceleration.y = 0;
    }
  }

  isAtGoalTile(goalTile = this.goalTile, map = this.patrolMap) {
    if (!goalTile || !map) {
      return false;
    }

    const currentTile = map.quantize(this.position);
    if (!currentTile) {
      return false;
    }

    return (
      currentTile.row === goalTile.row &&
      currentTile.col === goalTile.col
    );
  }

  resetToSpawn(position, tile = this.spawnTile) {
    this.spawnTile = tile;
    this.position.copy(position);
    this.position.y = 1;
    this.velocity.set(0, 0, 0);

    if (this.acceleration) {
      this.acceleration.set(0, 0, 0);
    }
  }

  respawn(map, {
    goalTile = this.goalTile,
    playerSpawnPosition = new THREE.Vector3(0, 0, 0),
    peers = []
  } = {}) {
    const avoidPositions = [playerSpawnPosition];

    if (goalTile) {
      avoidPositions.push(map.localize(goalTile));
    }

    const spawnTile = GroundAttacker.findSpawnTile(map, {
      avoidPositions,
      peers: peers.filter((peer) => peer !== this)
    });

    const spawnPosition = map.localize(spawnTile);
    this.resetToSpawn(spawnPosition, spawnTile);
  }

  snapToWalkableTile(map) {
    const tile = map.quantize(this.position);

    if (tile && tile.isWalkable()) {
      return;
    }

    let bestTile = null;
    let bestDistance = Infinity;

    for (const walkableTile of map.walkableTiles) {
      const walkablePosition = map.localize(walkableTile);
      const distance = walkablePosition.distanceTo(this.position);

      if (distance < bestDistance) {
        bestDistance = distance;
        bestTile = walkableTile;
      }
    }

    if (!bestTile) {
      return;
    }

    const safePosition = map.localize(bestTile);
    this.position.x = safePosition.x;
    this.position.z = safePosition.z;
    this.velocity.set(0, 0, 0);
  }

  clampToMap(map, margin = 1) {
    const minX = map.minX + margin;
    const maxX = map.minX + map.cols * map.tileSize - margin;
    const minZ = map.minZ + margin;
    const maxZ = map.minZ + map.rows * map.tileSize - margin;

    this.position.x = THREE.MathUtils.clamp(this.position.x, minX, maxX);
    this.position.z = THREE.MathUtils.clamp(this.position.z, minZ, maxZ);
  }

  finalizeMovement(map) {
    this.clampToMap(map);
    this.snapToWalkableTile(map);
    this.position.y = 1;
  }
}

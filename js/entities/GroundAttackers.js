import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/Addons.js';
import { DynamicEntity } from './DynamicEntity.js';

export class GroundAttackers {
  constructor(world) {
    this.world = world;
  }

  create(numAttackers = 10) {
    this.world.ground_attackers = [];
    this.world.modelsLoading += numAttackers;

    for (let i = 0; i < numAttackers; i++) {
      let attackerTile;
      let attackerPosition;
      let tries = 0;

      do {
        attackerTile = this.world.map.getRandomWalkableTile();
        attackerPosition = this.world.map.localize(attackerTile);
        tries++;
      } while (
        tries < 300 &&
        (
          attackerPosition.distanceTo(new THREE.Vector3(0, 0, 0)) < 6 ||
          attackerPosition.distanceTo(this.world.map.localize(this.world.doorGoal)) < 6 ||
          this.world.ground_attackers.some(a => a.position.distanceTo(attackerPosition) < 5)
        )
      );

      let attacker = new DynamicEntity({
        position: attackerPosition.clone(),
        velocity: new THREE.Vector3(0, 0, 0),
        color: 0x660000,
        scale: new THREE.Vector3(1, 0.75, 1)
      });

      attacker.boatLoaded = false;
      attacker.position.y = 1;
      attacker.modelFacingOffset = 0;

      this.loadVisual(attacker);

      this.world.ground_attackers.push(attacker);
      this.world.addEntityToWorld(attacker);
    }
  }

  loadVisual(attacker) {
    const loader = new GLTFLoader();

    loader.load(
      './public/sphere_robot/scene.gltf',
      (gltf) => {
        const model = gltf.scene;

        while (attacker.mesh.children.length > 0) {
          attacker.mesh.remove(attacker.mesh.children[0]);
        }

        model.scale.set(2.2, 2.2, 2.2);

        const box = new THREE.Box3().setFromObject(model);
        model.position.y = -box.min.y;
        model.rotation.y = 0;

        attacker.mesh.add(model);
        attacker.robotModel = model;
        attacker.boatLoaded = true;

        if (gltf.animations && gltf.animations.length > 0) {
          const mixer = new THREE.AnimationMixer(model);
          const action = mixer.clipAction(gltf.animations[0]);
          action.play();
          attacker.mixer = mixer;
          this.world.mixers.push(mixer);
        }

        this.world.modelsLoaded++;
        this.world.updateLoadingIndicator();
      },
      undefined,
      () => {
        attacker.boatLoaded = true;
        attacker.loadError = true;
        this.world.modelsLoaded++;
        this.world.updateLoadingIndicator();
      }
    );
  }

  respawn(npc) {
    let spawnTile;
    let spawnPos;
    let tries = 0;

    do {
      spawnTile = this.world.map.getRandomWalkableTile();
      spawnPos = this.world.map.localize(spawnTile);
      tries++;
    } while (
      tries < 300 &&
      (
        spawnPos.distanceTo(new THREE.Vector3(0, 0, 0)) < 6 ||
        spawnPos.distanceTo(this.world.map.localize(this.world.doorGoal)) < 6 ||
        this.world.ground_attackers.some(a =>
          a !== npc && a.position.distanceTo(spawnPos) < 5
        )
      )
    );

    npc.position.copy(spawnPos);
    npc.position.y = 1;

    npc.velocity.set(0, 0, 0);
    if (npc.acceleration) npc.acceleration.set(0, 0, 0);
  }

  snapEntityToWalkableTile(entity) {
    let tile = this.world.map.quantize(entity.position);

    if (tile && tile.isWalkable()) {
      return;
    }

    let bestTile = null;
    let bestDist = Infinity;

    for (let walkable of this.world.map.walkableTiles) {
      let pos = this.world.map.localize(walkable);
      let dist = pos.distanceTo(entity.position);

      if (dist < bestDist) {
        bestDist = dist;
        bestTile = walkable;
      }
    }

    if (bestTile) {
      let safePos = this.world.map.localize(bestTile);
      entity.position.x = safePos.x;
      entity.position.z = safePos.z;
      entity.velocity.set(0, 0, 0);
    }
  }

  update() {
    if (!this.world.ground_attackers || this.world.ground_attackers.length === 0) return;
    if (!this.world.doorGoal || !this.world.groundVectorPathFinding) return;

    for (let npc of this.world.ground_attackers) {
      npc.position.y = 1;

      if (npc.velocity) npc.velocity.y = 0;
      if (npc.acceleration) npc.acceleration.y = 0;

      const currentTile = this.world.map.quantize(npc.position);

      if (
        currentTile &&
        currentTile.row === this.world.doorGoal.row &&
        currentTile.col === this.world.doorGoal.col
      ) {
        this.respawn(npc);
        continue;
      }
    }

    this.world.groundVectorPathFinding.runVectorFieldPathFinding(this.world.doorGoal);

    const minX = this.world.map.minX + 1;
    const maxX = this.world.map.minX + this.world.map.cols * this.world.map.tileSize - 1;
    const minZ = this.world.map.minZ + 1;
    const maxZ = this.world.map.minZ + this.world.map.rows * this.world.map.tileSize - 1;

    for (let npc of this.world.ground_attackers) {
      npc.position.x = THREE.MathUtils.clamp(npc.position.x, minX, maxX);
      npc.position.z = THREE.MathUtils.clamp(npc.position.z, minZ, maxZ);
      this.snapEntityToWalkableTile(npc);
      npc.position.y = 1;
    }
  }
}
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/Addons.js';
import { DynamicEntity } from './DynamicEntity.js';
import { JPS } from '../ai/pathfinding/JPS.js';
import { ReynoldsPathFollowing } from '../ai/steering/ReynoldsPathFollowing.js';
import { SteeringBehaviours } from '../ai/steering/SteeringBehaviours.js';

export class DungeonGuard {
  constructor(world) {
    this.world = world;
  }

  createPatrolLoopInDungeon3() {
    if (!this.world.dungeonMap.walkableTiles || this.world.dungeonMap.walkableTiles.length === 0) {
      this.world.dungeonMap.walkableTiles =
        this.world.dungeonMap.grid.flat().filter(t => t.isWalkable());
    }

    const nearestWalkable = (r, c) => {
      let best = null;
      let bestDist = Infinity;

      for (let t of this.world.dungeonMap.walkableTiles) {
        let d = Math.abs(t.row - r) + Math.abs(t.col - c);

        if (d < bestDist) {
          bestDist = d;
          best = t;
        }
      }

      return best;
    };

    const anchors = [
      nearestWalkable(2, 2),
      nearestWalkable(2, this.world.dungeonMap.cols - 3),
      nearestWalkable(this.world.dungeonMap.rows - 3, this.world.dungeonMap.cols - 3),
      nearestWalkable(this.world.dungeonMap.rows - 3, 2)
    ].filter(Boolean);

    const uniqueAnchors = [];
    const seen = new Set();

    for (let tile of anchors) {
      const key = `${tile.row},${tile.col}`;

      if (!seen.has(key)) {
        seen.add(key);
        uniqueAnchors.push(tile);
      }
    }

    if (uniqueAnchors.length < 2) {
      this.world.dungeonPatrolTiles = [];
      this.world.dungeonPatrolPath = [];
      return;
    }

    const pathfinder = new JPS(this.world.dungeonMap);
    this.world.dungeonPatrolTiles = [];

    for (let i = 0; i < uniqueAnchors.length; i++) {
      const start = uniqueAnchors[i];
      const goal = uniqueAnchors[(i + 1) % uniqueAnchors.length];

      let segment = pathfinder.findPath(start, goal);

      if (!segment || segment.length === 0) {
        continue;
      }

      if (i > 0) {
        segment.shift();
      }

      this.world.dungeonPatrolTiles.push(...segment);
    }

    if (!this.world.dungeonPatrolTiles || this.world.dungeonPatrolTiles.length < 2) {
      this.world.dungeonPatrolPath = [];
      return;
    }

    this.world.dungeonPatrolPath = this.world.dungeonPatrolTiles.map(tile =>
      this.world.dungeonMap.localize(tile).clone().add(this.world.dungeonOffset)
    );
  }

  drawDungeon3PatrolLoop() {
    if (!this.world.dungeonPatrolPath || this.world.dungeonPatrolPath.length < 2) return;

    if (this.world.dungeonPatrolLine) {
      this.world.scene.remove(this.world.dungeonPatrolLine);
    }

    const points = this.world.dungeonPatrolPath.map(
      p => new THREE.Vector3(p.x, 1.5, p.z)
    );
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const material = new THREE.LineBasicMaterial({ color: 0xffff00 });

    this.world.dungeonPatrolLine = new THREE.LineLoop(geometry, material);
    this.world.scene.add(this.world.dungeonPatrolLine);
  }

  createDungeonGuard() {
  if (!this.world.dungeonPatrolPath || this.world.dungeonPatrolPath.length < 2) {
    return;
  }

  const spawnIndex = Math.floor(this.world.dungeonPatrolPath.length / 2);
  const startPos = this.world.dungeonPatrolPath[spawnIndex].clone();

  this.world.dungeonGuard = new DynamicEntity({
    position: new THREE.Vector3(startPos.x, 1.0, startPos.z),
    velocity: new THREE.Vector3(0, 0, 0),
    topSpeed: 4.4,
    color: 0xff0000,
    scale: new THREE.Vector3(1, 1, 1)
  });

  this.world.dungeonGuard.isDungeonGuard = true;
  this.world.dungeonGuard.maxForce = 8.0;

  this.world.dungeonGuard.pathFollower = {
    path: this.world.dungeonPatrolPath,
    segmentIndex: spawnIndex,
    pathRadius: 0.25,
    predictDistance: 0.15,
    targetOffset: 0.08
  };

  this.world.dungeonGuard.modelFacingOffset = 0;
  this.world.dungeonGuard.detectRadius = 12;
  this.world.dungeonGuard.catchRadius = 1.5;
  this.world.dungeonGuard.isChasing = false;
  this.world.dungeonGuard.lookAhead = 0.6;

  const tempBody = new THREE.Mesh(
    new THREE.BoxGeometry(1.2, 2.0, 1.2),
    new THREE.MeshStandardMaterial({
      color: 0xff0000,
      emissive: 0x330000
    })
  );
  tempBody.position.set(0, 1.0, 0);
  this.world.dungeonGuard.mesh.add(tempBody);
  this.world.dungeonGuard.tempBody = tempBody;

  const loader = new GLTFLoader();
  loader.load(
    '/walking_mario/scene.gltf',
    (gltf) => {
      const model = gltf.scene;

      if (this.world.dungeonGuard.tempBody) {
        this.world.dungeonGuard.mesh.remove(this.world.dungeonGuard.tempBody);
        this.world.dungeonGuard.tempBody.geometry.dispose();
        this.world.dungeonGuard.tempBody.material.dispose();
        this.world.dungeonGuard.tempBody = null;
      }

      while (this.world.dungeonGuard.mesh.children.length > 0) {
        this.world.dungeonGuard.mesh.remove(this.world.dungeonGuard.mesh.children[0]);
      }

      model.scale.set(0.015, 0.015, 0.015);

      const box = new THREE.Box3().setFromObject(model);
      model.position.y = -box.min.y;
      model.rotation.y = 0;

      this.world.dungeonGuard.mesh.add(model);
      this.world.dungeonGuard.guardModel = model;

      if (gltf.animations && gltf.animations.length > 0) {
        const mixer = new THREE.AnimationMixer(model);
        this.world.dungeonGuard.mixer = mixer;
        this.world.mixers.push(mixer);

        const clipIndex = gltf.animations[1] ? 1 : 0;
        const action = mixer.clipAction(gltf.animations[clipIndex]);
        action.reset();
        action.setEffectiveTimeScale(0.35);
        action.play();

        this.world.dungeonGuard.currentAction = action;
      }
    },
    undefined,
    (error) => {
    }
  );

  this.world.addEntityToWorld(this.world.dungeonGuard);
}

  updateDungeonGuard(dt) {
  if (!this.world.dungeonGuard) return;
  if (!this.world.dungeonGuard.pathFollower) return;

  const pf = this.world.dungeonGuard.pathFollower;
  const path = pf.path;

  if (!path || path.length < 2) return;

  const toPlayer = this.world.main_character.position.clone().sub(this.world.dungeonGuard.position);
  toPlayer.y = 0;
  const playerDistance = toPlayer.length();

  this.world.dungeonGuard.isChasing =
    playerDistance <= this.world.dungeonGuard.detectRadius;

  let steering;
  if (this.world.dungeonGuard.isChasing) {
    steering = SteeringBehaviours.pursue(
      this.world.dungeonGuard,
      this.world.main_character,
      this.world.dungeonGuard.lookAhead
    );
  } else {
    steering = ReynoldsPathFollowing.followLoop(this.world.dungeonGuard);
  }

  steering.clampLength(0, this.world.dungeonGuard.maxForce);
  this.world.dungeonGuard.applyForce(steering);

  const dungeonAdapter = {
    handleCollisions: (entity) => {
      const fakeEntity = {
        ...entity,
        position: entity.position.clone().sub(this.world.dungeonOffset)
      };

      const corrected = this.world.dungeonMap.handleCollisions(fakeEntity);
      return corrected.add(this.world.dungeonOffset);
    }
  };

  this.world.dungeonGuard.update(dt, dungeonAdapter);
  this.world.dungeonGuard.position.y = 1.0;
  this.world.dungeonGuard.velocity.y = 0;
  this.world.dungeonGuard.velocity.clampLength(0, this.world.dungeonGuard.topSpeed);

  let facingDir = new THREE.Vector3();

  if (this.world.dungeonGuard.isChasing) {
    facingDir = this.world.main_character.position.clone().sub(this.world.dungeonGuard.position);
    facingDir.y = 0;
  } else {
    const a = path[pf.segmentIndex % path.length];
    const b = path[(pf.segmentIndex + 1) % path.length];
    const ab = b.clone().sub(a);
    const abLenSq = ab.lengthSq();

    if (abLenSq > 0) {
      const ap = this.world.dungeonGuard.position.clone().sub(a);
      let t = ap.dot(ab) / abLenSq;
      t = THREE.MathUtils.clamp(t, 0, 1);
      facingDir = ab.clone();
    }
  }

  if (facingDir.lengthSq() > 0.0001) {
    facingDir.normalize();
    const yaw = Math.atan2(facingDir.x, facingDir.z);
    this.world.dungeonGuard.mesh.rotation.y =
      yaw + (this.world.dungeonGuard.modelFacingOffset || 0);
  }

  const minX = this.world.dungeonOffset.x + this.world.dungeonMap.minX + 0.1;
  const maxX =
    this.world.dungeonOffset.x +
    this.world.dungeonMap.minX +
    this.world.dungeonMap.cols * this.world.dungeonMap.tileSize - 0.1;

  const minZ = this.world.dungeonMap.minZ + 0.1;
  const maxZ =
    this.world.dungeonMap.minZ +
    this.world.dungeonMap.rows * this.world.dungeonMap.tileSize - 0.1;

  this.world.dungeonGuard.position.x = THREE.MathUtils.clamp(
    this.world.dungeonGuard.position.x,
    minX,
    maxX
  );
  this.world.dungeonGuard.position.z = THREE.MathUtils.clamp(
    this.world.dungeonGuard.position.z,
    minZ,
    maxZ
  );

  const localPos = this.world.dungeonGuard.position.clone().sub(this.world.dungeonOffset);
  let tile = this.world.dungeonMap.quantize(localPos);

  if (!tile || !tile.isWalkable()) {
    let bestTile = null;
    let bestDist = Infinity;

    for (let walkable of this.world.dungeonMap.walkableTiles) {
      const pos = this.world.dungeonMap.localize(walkable).clone().add(this.world.dungeonOffset);
      const dist = pos.distanceTo(this.world.dungeonGuard.position);

      if (dist < bestDist) {
        bestDist = dist;
        bestTile = walkable;
      }
    }

    if (bestTile) {
      const safePos = this.world.dungeonMap.localize(bestTile).clone().add(this.world.dungeonOffset);
      this.world.dungeonGuard.position.x = safePos.x;
      this.world.dungeonGuard.position.z = safePos.z;
      this.world.dungeonGuard.velocity.set(0, 0, 0);
    }
  }
}
}
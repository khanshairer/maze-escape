import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/Addons.js';
import { DynamicEntity } from './DynamicEntity.js';
import { ReynoldsPathFollowing } from '../ai/steering/ReynoldsPathFollowing.js';
import { SteeringBehaviours } from '../ai/steering/SteeringBehaviours.js';

export class DungeonGuard extends DynamicEntity {
  constructor({
    patrolPath = [],
    spawnIndex = 0,
    detectRadius = 12,
    catchRadius = 1.5,
    lookAhead = 0.6,
    pathRadius = 0.25,
    predictDistance = 0.15,
    targetOffset = 0.08,
    ...entityConfig
  } = {}) {
    super(entityConfig);

    this.isDungeonGuard = true;
    this.detectRadius = detectRadius;
    this.catchRadius = catchRadius;
    this.lookAhead = lookAhead;
    this.isChasing = false;
    this.modelFacingOffset = 0;
    this.guardModel = null;
    this.tempBody = null;
    this.currentAction = null;

    this.pathFollower = {
      path: patrolPath,
      segmentIndex: spawnIndex,
      pathRadius,
      predictDistance,
      targetOffset
    };
  }

  loadVisual({ mixers = [], onLoaded = null, onError = null } = {}) {
    this.tempBody = new THREE.Mesh(
      new THREE.BoxGeometry(1.2, 2.0, 1.2),
      new THREE.MeshStandardMaterial({
        color: 0xff0000,
        emissive: 0x330000
      })
    );
    this.tempBody.position.set(0, 1.0, 0);
    this.mesh.add(this.tempBody);

    const loader = new GLTFLoader();
    loader.load(
      '/walking_mario/scene.gltf',
      (gltf) => {
        const model = gltf.scene;

        if (this.tempBody) {
          this.mesh.remove(this.tempBody);
          this.tempBody.geometry.dispose();
          this.tempBody.material.dispose();
          this.tempBody = null;
        }

        while (this.mesh.children.length > 0) {
          this.mesh.remove(this.mesh.children[0]);
        }

        model.scale.set(0.015, 0.015, 0.015);

        const box = new THREE.Box3().setFromObject(model);
        model.position.y = -box.min.y;
        model.rotation.y = 0;

        this.mesh.add(model);
        this.guardModel = model;

        if (gltf.animations && gltf.animations.length > 0) {
          const mixer = new THREE.AnimationMixer(model);
          this.mixer = mixer;
          mixers.push(mixer);

          const clipIndex = gltf.animations[1] ? 1 : 0;
          const action = mixer.clipAction(gltf.animations[clipIndex]);
          action.reset();
          action.setEffectiveTimeScale(0.35);
          action.play();
          this.currentAction = action;
        }

        if (onLoaded) {
          onLoaded(gltf);
        }
      },
      undefined,
      (error) => {
        if (onError) {
          onError(error);
        }
      }
    );
  }

  createCollisionAdapter(dungeonMap, dungeonOffset) {
    return {
      handleCollisions: (entity) => {
        const fakeEntity = {
          ...entity,
          position: entity.position.clone().sub(dungeonOffset)
        };

        const corrected = dungeonMap.handleCollisions(fakeEntity);
        return corrected.add(dungeonOffset);
      }
    };
  }

  updateBehavior(dt, { player, dungeonMap, dungeonOffset }) {
    if (!player || !this.pathFollower?.path || this.pathFollower.path.length < 2) {
      return;
    }

    const toPlayer = player.position.clone().sub(this.position);
    toPlayer.y = 0;

    this.isChasing = toPlayer.length() <= this.detectRadius;

    let steering;
    if (this.isChasing) {
      steering = SteeringBehaviours.pursue(this, player, this.lookAhead);
    } else {
      steering = ReynoldsPathFollowing.followLoop(this);
    }

    steering.clampLength(0, this.maxForce);
    this.applyForce(steering);

    this.update(dt, this.createCollisionAdapter(dungeonMap, dungeonOffset));
    this.position.y = 1.0;
    this.velocity.y = 0;
    this.velocity.clampLength(0, this.topSpeed);

    this.correctPathDrift();
    this.updateFacing(player);
  }

  correctPathDrift() {
    const path = this.pathFollower?.path;
    if (!path || path.length < 2 || this.isChasing) {
      return;
    }

    const segmentIndex = this.pathFollower.segmentIndex % path.length;
    const a = path[segmentIndex];
    const b = path[(segmentIndex + 1) % path.length];

    const ab = b.clone().sub(a);
    const abLenSq = ab.lengthSq();

    if (abLenSq <= 0) {
      return;
    }

    const ap = this.position.clone().sub(a);
    let t = ap.dot(ab) / abLenSq;
    t = THREE.MathUtils.clamp(t, 0, 1);

    const closestPoint = a.clone().add(ab.clone().multiplyScalar(t));
    const offsetFromPath = this.position.clone().sub(closestPoint);
    offsetFromPath.y = 0;

    const maxDrift = this.pathFollower.pathRadius ?? 0.25;

    if (offsetFromPath.length() <= maxDrift) {
      return;
    }

    const correctedPosition = closestPoint.clone();
    correctedPosition.y = 1.0;
    this.position.lerp(correctedPosition, 0.2);
    this.velocity.multiplyScalar(0.5);
    this.velocity.y = 0;
    this.velocity.clampLength(0, this.topSpeed);
  }

  updateFacing(player) {
    const path = this.pathFollower?.path;
    if (!path || path.length < 2) {
      return;
    }

    let facingDirection = new THREE.Vector3();

    if (this.isChasing) {
      facingDirection = player.position.clone().sub(this.position);
      facingDirection.y = 0;
    } else {
      const segmentIndex = this.pathFollower.segmentIndex % path.length;
      const a = path[segmentIndex];
      const b = path[(segmentIndex + 1) % path.length];
      facingDirection = b.clone().sub(a);
      facingDirection.y = 0;
    }

    if (facingDirection.lengthSq() <= 0.0001) {
      return;
    }

    facingDirection.normalize();
    const moveAngle = Math.atan2(facingDirection.x, facingDirection.z);
    this.mesh.rotation.y = moveAngle + (this.modelFacingOffset ?? 0);
  }
}

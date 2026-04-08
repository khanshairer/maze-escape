import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/Addons.js';
import { DynamicEntity } from './DynamicEntity.js';

export class MainCharacter {
  constructor(world) {
    this.world = world;
  }

  createMainCharacter() {
    this.world.main_character = new DynamicEntity({
      position: new THREE.Vector3(0, 0, 0),
      velocity: new THREE.Vector3(0, 0, 0),
      topSpeed: this.world.moveSpeed,
      color: 0x3333ff,
      scale: new THREE.Vector3(1, 1, 1)
    });

    const tempCubeGeo = new THREE.BoxGeometry(1.2, 1.2, 1.2);
    const tempCubeMat = new THREE.MeshStandardMaterial({
      color: 0x33aaff,
      emissive: 0x004466,
      transparent: true,
      opacity: 0.8
    });
    const tempCube = new THREE.Mesh(tempCubeGeo, tempCubeMat);
    tempCube.position.set(0, 0.75, 0);
    this.world.main_character.mesh.add(tempCube);

    const loadingRing = new THREE.Mesh(
      new THREE.TorusGeometry(0.8, 0.1, 16, 32),
      new THREE.MeshStandardMaterial({ color: 0xffff00, emissive: 0x442200 })
    );
    loadingRing.position.set(0, 1.2, 0);
    this.world.main_character.mesh.add(loadingRing);
    this.world.main_character.loadingRing = loadingRing;

    const loader = new GLTFLoader();
    loader.load(
      '/officer_with_gun/scene.gltf',
      (gltf) => {
        const model = gltf.scene;

        while (this.world.main_character.mesh.children.length > 0) {
          this.world.main_character.mesh.remove(
            this.world.main_character.mesh.children[0]
          );
        }

        model.scale.set(1.8, 1.8, 1.8);

        const box = new THREE.Box3().setFromObject(model);
        model.position.y = -box.min.y;

        this.world.main_character.mesh.add(model);

        if (gltf.animations && gltf.animations.length > 0) {
          const mixer = new THREE.AnimationMixer(model);
          this.world.mainCharacterMixer = mixer;

          gltf.animations.forEach((clip, idx) => {
            const action = mixer.clipAction(clip);
            this.world.mainCharacterActions[idx] = action;
          });

          const idleAction = this.world.mainCharacterActions[0];
          if (idleAction) {
            idleAction.play();
            this.world.currentMainAction = idleAction;
          }
        }
      }
    );

    this.world.addEntityToWorld(this.world.main_character);
  }

  updateMainCharacter(dt) {
    const input = this.world.inputHandler;
    if (!input) return;

    let desiredVelocity = input.getForce(this.world.moveSpeed);

    const currentVel = this.world.main_character.velocity;
    const steering = desiredVelocity.clone().sub(currentVel);
    steering.clampLength(0, this.world.maxForce);

    this.world.main_character.applyForce(steering);

    if (input.keys.space && !this.world.isJumping) {
      this.world.isJumping = true;
      this.world.jumpVelocity = this.world.jumpStrength;
    }

    if (this.world.isJumping) {
      this.world.main_character.position.y += this.world.jumpVelocity * dt;
      this.world.jumpVelocity -= this.world.gravity * dt;

      if (this.world.main_character.position.y <= this.world.groundY) {
        this.world.main_character.position.y = this.world.groundY;
        this.world.jumpVelocity = 0;
        this.world.isJumping = false;
      }
    }

    if (!this.world.logCounter) this.world.logCounter = 0;
    this.world.logCounter++;

    if (this.world.logCounter >= 60) {
      this.world.logCounter = 0;
    }

    const isMoving = desiredVelocity.length() > 0.1;

    if (isMoving) {
      const walkAction = this.world.mainCharacterActions[3];
      const idleAction = this.world.mainCharacterActions[0];

      if (walkAction && this.world.currentMainAction !== walkAction) {
        if (idleAction) idleAction.fadeOut(0.2);
        walkAction.reset().fadeIn(0.2).play();
        this.world.currentMainAction = walkAction;
      }
    } else {
      const idleAction = this.world.mainCharacterActions[0];
      const walkAction = this.world.mainCharacterActions[1];

      if (idleAction && this.world.currentMainAction !== idleAction) {
        if (walkAction) walkAction.fadeOut(0.2);
        idleAction.reset().fadeIn(0.2).play();
        this.world.currentMainAction = idleAction;
      }
    }
  }

  updateCameraFollow() {
    if (!this.world.main_character) return;

    const target = this.world.main_character.position.clone();
    const desiredPosition = target.clone().add(new THREE.Vector3(0, 24, 14));

    this.world.camera.position.lerp(desiredPosition, 0.08);
    this.world.camera.lookAt(target.x, target.y + 2, target.z);
  }
}
import * as THREE from 'three';
/*
Purpose: The ControllerExitManager class is responsible for managing the visual representation 
and state of the controller exit in the game world. It creates a visually distinct exit object in the scene, 
updates its appearance based on whether it is locked or unlocked, and checks if the player has reached the unlocked 
exit to trigger the end of the game.
*/
export class ControllerExitManager {
  // Initialize the manager with a reference to the world object
  constructor(world) {
    this.world = world;
  }
  
  // Create the controller exit object in the scene based on the designated tile position
  createControllerExit() {
    if (!this.world.controllerExitTile) {
      return;
    }

    const exitPosition = this.world.dungeonMap
      .localize(this.world.controllerExitTile)
      .clone()
      .add(this.world.dungeonOffset);

    const group = new THREE.Group();
    group.position.copy(exitPosition);

    const base = new THREE.Mesh(
      new THREE.CylinderGeometry(1.1, 1.3, 0.4, 24),
      new THREE.MeshStandardMaterial({
        color: 0x30363d,
        emissive: 0x111111
      })
    );

    base.position.y = 0.2;
    group.add(base);

    const coreMaterial = new THREE.MeshStandardMaterial({
      color: 0xff5533,
      emissive: 0x661100,
      emissiveIntensity: 1.2
    });

    const core = new THREE.Mesh(
      new THREE.CylinderGeometry(0.55, 0.55, 1.8, 18),
      coreMaterial
    );
    core.position.y = 1.2;
    group.add(core);

    const beacon = new THREE.Mesh(
      new THREE.TorusGeometry(0.95, 0.08, 12, 24),
      new THREE.MeshStandardMaterial({
        color: 0xffaa44,
        emissive: 0x553300,
        emissiveIntensity: 0.9
      })
    );
    beacon.rotation.x = Math.PI / 2;
    beacon.position.y = 1.2;
    group.add(beacon);

    group.userData = {
      base,
      core,
      beacon,
      lockedColor: 0xff5533,
      lockedEmissive: 0x661100,
      unlockedColor: 0x33ff99,
      unlockedEmissive: 0x116644
    };

    this.world.controllerExit = {
      mesh: group,
      position: exitPosition,
      tile: this.world.controllerExitTile
    };

    this.world.scene.add(group);
    this.updateControllerExitVisualState(0);
  }

  // Update the visual state of the controller exit based on whether it is locked or unlocked
  updateControllerExitVisualState(dt = 0) {
    if (!this.world.controllerExit) {
      return;
    }

    const {
      core,
      beacon,
      lockedColor,
      lockedEmissive,
      unlockedColor,
      unlockedEmissive
    } = this.world.controllerExit.mesh.userData;

    if (this.world.controllerExitUnlocked) {
      core.material.color.setHex(unlockedColor);
      core.material.emissive.setHex(unlockedEmissive);
      beacon.material.color.setHex(0xaaffdd);
      beacon.material.emissive.setHex(0x227755);
      beacon.rotation.z += dt * 1.5;
    } else {
      core.material.color.setHex(lockedColor);
      core.material.emissive.setHex(lockedEmissive);
      beacon.material.color.setHex(0xffaa44);
      beacon.material.emissive.setHex(0x553300);
      beacon.rotation.z += dt * 0.35;
    }
  }

  // Update the state of the controller exit, checking if it should be unlocked and updating its visual state accordingly
  updateControllerExitState(dt) {
    if (!this.world.controllerExit) {
      return;
    }

    this.world.controllerExitUnlocked =
      this.world.energyCellsRequiredForUnlock > 0 &&
      this.world.collectedEnergyCells >= this.world.energyCellsRequiredForUnlock;

    this.updateControllerExitVisualState(dt);
  }

  // Check if the player has reached the unlocked controller exit to trigger the end of the game
  updateEnergyUnlockRequirement() {
    this.world.energyCellsRequiredForUnlock = Math.ceil(
      this.world.totalEnergyCells * this.world.unlockRequirementFraction
    );
  }

  // Check if the player is within the activation radius of the unlocked controller exit
  isPlayerAtUnlockedControllerExit() {
    if (
      !this.world.main_character ||
      !this.world.controllerExit ||
      !this.world.controllerExitUnlocked
    ) {
      return false;
    }

    return (
      this.world.main_character.position.distanceTo(this.world.controllerExit.position) <=
      this.world.controllerExitActivationRadius
    );
  }
}
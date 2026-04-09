import * as THREE from 'three';

export class WorldUpdateManager {
  constructor(world) {
    this.world = world;
  }

  // Update our world
  /*
  *purpose: update the game state on each frame by processing player input, updating entity positions and animations, handling collisions, and managing game logic 
   such as enemy behavior and energy cell collection. 
  
   *The function first checks if the game is over and stops all animations if so. If the game is still loading, it updates any animation mixers for entities 
   that have been loaded so far. 
  
  Once loading is complete, it updates the main character's movement and animation based on player input, updates the dungeon guard's behavior, updates all entities in the world, and ensures the main character stays within the bounds of the dungeon. 
  Finally, it updates the camera to follow the main character and logs the character's position for debugging purposes.
*@returns null
*/
  update() {
  if (this.world.isGameOver) {
    for (let mixer of this.world.mixers) {
      mixer.stopAllAction();
    }

    if (this.world.mainCharacterMixer) {
      this.world.mainCharacterMixer.stopAllAction();
    }

    return;
  }

  if (!this.world.main_character) return;

  let dt = this.world.clock.getDelta();

  if (!this.world.loadingComplete) {
    if (this.world.mainCharacterMixer) {
      this.world.mainCharacterMixer.update(dt);
    }

    for (let mixer of this.world.mixers) {
      mixer.update(dt);
    }

    return;
  }

  // Update main character movement and animation
  this.world.mainCharacterManager.updateMainCharacter(dt);
  this.world.dungeonGuardManager.updateDungeonGuard(dt);
  // Update main character animation mixer if present
  if (this.world.mainCharacterMixer) {
    
    this.world.mainCharacterMixer.update(dt);
  
  }

  // Update animation mixers for loaded boats
  for (let mixer of this.world.mixers) {
    
    mixer.update(dt);
  
  }

  //updateGroundAttacker with new steering behaviours
  this.world.groundAttackerManager.update();
  this.world.droneManager.update(dt);
  

  // Update all entities (this includes the main character)
  for (let e of this.world.entities) {
    
    if (e === this.world.dungeonGuard) continue;

    if (e.update) {
      
      e.update(dt, this.world.getMapAdapterForPosition(e.position));
    
    }
  }

  this.world.energyCellManager.updateEnergyCells(dt);
  this.world.controllerExitManager.updateControllerExitState(dt);

  // keep player stable inside dungeon bounds
  if (this.world.main_character) {
    const pos = this.world.main_character.position;

    const inDungeon =
      pos.x >= this.world.dungeonOffset.x + this.world.dungeonMap.minX &&
      pos.x <= this.world.dungeonOffset.x + this.world.dungeonMap.minX + this.world.dungeonMap.cols * this.world.dungeonMap.tileSize &&
      pos.z >= this.world.dungeonMap.minZ &&
      pos.z <= this.world.dungeonMap.minZ + this.world.dungeonMap.rows * this.world.dungeonMap.tileSize;

    if (inDungeon) {
      const minX = this.world.dungeonOffset.x + this.world.dungeonMap.minX + 0.1;
      const maxX = this.world.dungeonOffset.x + this.world.dungeonMap.minX + this.world.dungeonMap.cols * this.world.dungeonMap.tileSize - 0.1;
      const minZ = this.world.dungeonMap.minZ + 0.1;
      const maxZ = this.world.dungeonMap.minZ + this.world.dungeonMap.rows * this.world.dungeonMap.tileSize - 0.1;

      this.world.main_character.position.x = THREE.MathUtils.clamp(this.world.main_character.position.x, minX, maxX);
      this.world.main_character.position.z = THREE.MathUtils.clamp(this.world.main_character.position.z, minZ, maxZ);
    }
  }

  // Update camera to follow main character
  this.world.mainCharacterManager.updateCameraFollow();

  // Final position logging (once per second)
  if (!this.world.finalLogCounter) this.world.finalLogCounter = 0;
  this.world.finalLogCounter++;
  if (this.world.finalLogCounter >= 60) {
    this.world.finalLogCounter = 0;
  }
}
}
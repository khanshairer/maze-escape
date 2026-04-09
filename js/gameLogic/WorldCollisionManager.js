import * as THREE from 'three';
import { Tile } from '../maps/Tile.js';

/*
Purpose : The WorldCollisionManager class is responsible for managing collision detection and response in the game world. 
It determines which tile map to use for collision checks based on the player's position, handles clamping the player within the dungeon bounds,
 and checks if the player is on a safe tile in maze 2 to implement stealth mechanics against drones.
*/
export class WorldCollisionManager {
  // Initialize the manager with a reference to the world object
    constructor(world) {
    this.world = world;
  }

  /*
  Purpose: isInHallway is a method that checks if a given position (THREE.Vector3) is within the bounds of either of the two hallways connecting the mazes and dungeon in the world.
  Parameters: position - a THREE.Vector3 representing the current position of the entity for which we want to check if it is within the hallway bounds.
  */
  isInHallway(position) {
    
    let inHallway1 = false;
    let inHallway2 = false;

    if (this.world.hallwayBounds) {
      
      inHallway1 =
        position.x >= this.world.hallwayBounds.minX &&
        position.x <= this.world.hallwayBounds.maxX &&
        position.z >= this.world.hallwayBounds.minZ &&
        position.z <= this.world.hallwayBounds.maxZ;
    }

    if (this.world.hallwayBounds2) {
      
      inHallway2 =
        position.x >= this.world.hallwayBounds2.minX &&
        position.x <= this.world.hallwayBounds2.maxX &&
        position.z >= this.world.hallwayBounds2.minZ &&
        position.z <= this.world.hallwayBounds2.maxZ;
    }

    return inHallway1 || inHallway2;
  }

  /*
  Purpose: getMapForPosition is a method that determines which tile map (maze 1, maze 2, or dungeon) should be used for collision detection based on the given position 
  of an entity in the world.

  Parameters: position - a THREE.Vector3 representing the current position of the entity for which we want to determine the appropriate tile map for collision detection.
  */
  getMapForPosition(position) {
    
    if (this.isInHallway(position)) {
      
      return this.world.hallwayMap;
    
    }

    const inMap1 =
      position.x >= this.world.map.minX &&
      position.x <= this.world.map.minX + this.world.map.cols * this.world.map.tileSize &&
      position.z >= this.world.map.minZ &&
      position.z <= this.world.map.minZ + this.world.map.rows * this.world.map.tileSize;

    const inMap2 =
      position.x >= this.world.map2Offset.x + this.world.map2.minX &&
      position.x <= this.world.map2Offset.x + this.world.map2.minX + this.world.map2.cols * this.world.map2.tileSize &&
      position.z >= this.world.map2.minZ &&
      position.z <= this.world.map2.minZ + this.world.map2.rows * this.world.map2.tileSize;

    const inDungeon =
      position.x >= this.world.dungeonOffset.x + this.world.dungeonMap.minX &&
      position.x <= this.world.dungeonOffset.x + this.world.dungeonMap.minX + this.world.dungeonMap.cols * this.world.dungeonMap.tileSize &&
      position.z >= this.world.dungeonMap.minZ &&
      position.z <= this.world.dungeonMap.minZ + this.world.dungeonMap.rows * this.world.dungeonMap.tileSize;

    if (inDungeon) {
      
      return {
        handleCollisions: (entity) => {
          const fakeEntity = {
            ...entity,
            position: entity.position.clone().sub(this.world.dungeonOffset)
          };

          const corrected = this.world.dungeonMap.handleCollisions(fakeEntity);
          
          return corrected.add(this.world.dungeonOffset);
        
        }
      };
    }

    if (inMap2) {
      
      return {
        handleCollisions: (entity) => {
          const fakeEntity = {
            ...entity,
            position: entity.position.clone().sub(this.world.map2Offset)
          };

          const corrected = this.world.map2.handleCollisions(fakeEntity);
          
          return corrected.add(this.world.map2Offset);
        
        }
      };
    }

    if (inMap1) {
      
      return this.world.map;
    
    }

    return this.world.hallwayMap;
  }

  // helper function to clamp position within hallway bounds (for main character)
  /**
   * Returns the appropriate map adapter for a given position
   * @param {THREE.Vector3} position
   * @returns {Object} Map adapter with handleCollisions method
   */
  getMapAdapterForPosition(position) {
    
    return this.getMapForPosition(position);

  }

  //clamp main character in dungeon 3 helper function
  /*
  *purpose: if the character is in the dungeon, clamp their position to be within the dungeon bounds to prevent them from escaping into the hallway 
  *approach: calculate the min and max x/z values based on the dungeon's position and size, and clamp the character's position to those bounds
  *@param {THREE.Vector3} position
  *@returns null
  */
  clampPositionToDungeon(entity) {
    
    const minX = this.world.dungeonOffset.x + this.world.dungeonMap.minX + 0.1;
    const maxX = this.world.dungeonOffset.x + this.world.dungeonMap.minX + this.world.dungeonMap.cols * this.world.dungeonMap.tileSize - 0.1;
    const minZ = this.world.dungeonMap.minZ + 0.1;
    const maxZ = this.world.dungeonMap.minZ + this.world.dungeonMap.rows * this.world.dungeonMap.tileSize - 0.1;

    entity.position.x = THREE.MathUtils.clamp(entity.position.x, minX, maxX);
    entity.position.z = THREE.MathUtils.clamp(entity.position.z, minZ, maxZ);

  }

  // is player on safe tile in hallway 2 helper function
  /*
  *purpose: determine if the main character is currently standing on a safe tile (medium terrain) in maze 2, which would allow them to avoid detection by drones. 
  *This is used to implement the stealth mechanic where players can hide from drones by standing on certain tiles. 
  *The function checks if the character is within the bounds of maze 2, and if so, quantizes their position to find the corresponding tile and checks its type.
  *@returns {boolean} true if the player is on a safe tile, false otherwise
  */
  isPlayerOnSafeTile() {
    
    if (!this.world.main_character) return false;

    const inMap2 =
      this.world.main_character.position.x >= this.world.map2Offset.x + this.world.map2.minX &&
      this.world.main_character.position.x <= this.world.map2Offset.x + this.world.map2.minX + this.world.map2.cols * this.world.map2.tileSize &&
      this.world.main_character.position.z >= this.world.map2.minZ &&
      this.world.main_character.position.z <= this.world.map2.minZ + this.world.map2.rows * this.world.map2.tileSize;

    if (!inMap2) return false;

    const localPos = this.world.main_character.position.clone().sub(this.world.map2Offset);
    const tile = this.world.map2.quantize(localPos);

    if (!tile) return false;

    return tile.type === Tile.Type.MediumTerrain;
  }
}
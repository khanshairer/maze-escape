import * as THREE from 'three';

// LevelMap holds our bounds of the map
export class LevelMap {
  
  constructor({
    width = 30,
    depth = 30
  } = {}) {

    this.width = width;
    this.depth = depth;
  
    this.minX = -width/2;
    this.maxX = width/2;

    this.minZ = -depth/2;
    this.maxZ = depth/2;
  
  }

  // Method for wrapping!
  wrapPosition(position) {
    
    let wrapped = position.clone();

    // x component
    wrapped.x = THREE.MathUtils.euclideanModulo(
      wrapped.x - this.minX,
      this.width
    ) + this.minX;

    // z component
    wrapped.z = THREE.MathUtils.euclideanModulo(
      wrapped.z - this.minZ,
      this.depth
    ) + this.minZ;

    return wrapped;
  }

  // Method to clamp position
  clampPosition(entity) {
    return new THREE.Vector3(
      THREE.MathUtils.clamp(entity.position.x, this.minX + entity.scale.x/2, this.maxX - entity.scale.x/2),
      entity.position.y,
      THREE.MathUtils.clamp(entity.position.z, this.minZ + entity.scale.z/2, this.maxZ -  entity.scale.z/2)
    );
  }

  // Method to get a random position
  getRandomPosition() {
    return new THREE.Vector3(
      this.minX + this.width * Math.random(),
      0,
      this.minZ + this.depth * Math.random()
    );
  }

}

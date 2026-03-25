import * as THREE from 'three';
import { Entity } from './Entity.js';

/**
* A round entity (x, z dimensions produces a circle)
 */

export class RoundEntity extends Entity {

  constructor({
    radius = 1,
    height = 1,
    
    ...entityConfig
  } = {}) {
    super({
      scale: new THREE.Vector3(radius * 2, height, radius * 2),

      ...entityConfig,
    });
    this.radius = radius;
  }

  // Default entity mesh
  createDefaultMesh(color) {
    return new THREE.Mesh(
      new THREE.CylinderGeometry(this.scale.x/2, this.scale.x/2, this.scale.y, 32),
      new THREE.MeshStandardMaterial({ color: color })
    )
  }

}
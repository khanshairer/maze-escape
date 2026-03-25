import * as THREE from 'three';
import { Entity } from './Entity.js';

/**
 * Our DynamicEntity class will be used 
 * for any entity that moves or changes
 */

export class DynamicEntity extends Entity {

  constructor({
    velocity = new THREE.Vector3(0,0,0),
    acceleration = new THREE.Vector3(0,0,0),
    topSpeed = 3,
    mass = 1,
    friction = 1.0,
    maxForce = 15,

    ...entityConfig
  } = {}) {

    super(entityConfig);
    
    this.velocity = velocity.clone();
    this.acceleration = acceleration.clone();
    this.topSpeed = topSpeed;
    this.mass = mass;
    this.friction = friction;
    this.maxForce = maxForce;
  }

  // Override the parent method
  // To create a cone mesh
  createDefaultMesh(color) {
    let temp = new THREE.Mesh(
      new THREE.ConeGeometry(this.scale.x/2, this.scale.y, 30),
      new THREE.MeshStandardMaterial( {color: color} )
    );

    temp.rotation.x = Math.PI/2;

    let mesh = new THREE.Group();
    mesh.add(temp);
    return mesh;
  }

  // Set the colour of our mesh 
  // assuming the primary mesh is at children[0]
  setColor(color) {
    this.mesh.children[0].material = new THREE.MeshStandardMaterial({color:color});
  }

  // Apply a force to our dynamic entity
  applyForce(force) {
    force.clampLength(0, this.maxForce);
    let a = force.clone().divideScalar(this.mass);
    this.acceleration.add(a);
  }
  
  update(deltaTime, map) {
    
    // Update our velocity by acceleration
    this.velocity.addScaledVector(this.acceleration, deltaTime);

    // Apply friction
    this.velocity.multiplyScalar(this.friction);

    // Clamp velocity by top speed
    this.velocity.clampLength(0, this.topSpeed);

    // Point in the direction of velocity
    let angle = Math.atan2(this.velocity.x, this.velocity.z);
    this.mesh.rotation.y = angle;

    // Update position by velocity
    this.position.addScaledVector(this.velocity, deltaTime);

    // Handle collisions via entity's position
    this.position = map.handleCollisions(this);

    // Set the mesh position to our DynamicEntity position
    this.mesh.position.copy(this.position);

    // Set the MESH y position to be half the height of our entity
    this.mesh.position.y += this.scale.y/2;

    // Reset acceleration to 0 after applying forces
    this.acceleration.set(0,0,0);
  }
}
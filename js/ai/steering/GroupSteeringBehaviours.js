import * as THREE from 'three';
import { SteeringBehaviours } from './ai/SteeringBehaviours';

// Namespace for group steering behaviours
export class GroupSteeringBehaviours {

  // Separate
  static separate(entity, others, radius) {

    let count = 0;
    let steer = new THREE.Vector3();

    // For all other entities
    for (let other of others) {
      
      // if the entity is our current npc, 
      // continue
      if (other === entity) continue;

      let offset = entity.position.clone().sub(other.position);
      let distance = offset.length();

      // If we are within the distance
      // where we need to separate
      // add the offset to our steering vector
      if (distance < radius) {

        offset.setLength(1/distance);
        steer.add(offset);
        count++;

      }
    }

    // If we have added vectors
    // to our steering force
    if (count > 0) {
      steer.divideScalar(count);
      steer.setLength(entity.topSpeed);
      steer.sub(entity.velocity);
    }
    
    return steer;
  }

}
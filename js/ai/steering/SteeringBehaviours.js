import * as THREE from 'three';


// This is our static namespace essentially
// for creating static steering behaviours
// that we can use on our NPCs
export class SteeringBehaviours {

  // Seek
  static seek(entity, target) {

    // This way we can pass in either 
    // an entity or a position itself
    let targetPos = target.position || target;

    let desired = targetPos.clone().sub(entity.position);
    desired.setLength(entity.topSpeed);

    let force = desired.sub(entity.velocity);
    return force;

  }

  // Flee
  static flee(entity, target) {
    let targetPos = target.position || target;

    let desired = entity.position.clone().sub(targetPos);
    desired.setLength(entity.topSpeed);

    let force = desired.sub(entity.velocity);

    return force;
  }

  // Pursue
  static pursue(entity, target, lookAhead) {
    // Target will always be a dynamic entity

    let futureLocation = target.position.clone();
    futureLocation.addScaledVector(target.velocity, lookAhead);

    return SteeringBehaviours.seek(entity, futureLocation);
  }

  // Evade
  static evade(entity, target, lookAhead) {
    // Target will always be a dynamic entity

    let futureLocation = target.position.clone();
    futureLocation.addScaledVector(target.velocity, lookAhead);

    return SteeringBehaviours.flee(entity, futureLocation);
  }

  // Arrive
  static arrive(entity, target, radius, stopRadius) {

    let targetPos = target.position || target;

    let desired = targetPos.clone().sub(entity.position);
    let distance = desired.length();

    // If the distance is REALLY close
    // Then stop
    if (distance < stopRadius) {
      return entity.velocity.clone().multiplyScalar(-entity.maxForce);
    }


    let speed = entity.topSpeed;
    if (distance < radius) {
      speed = speed * (distance / radius);
    }

    desired.setLength(speed);

    // Steering = desired velocity - current velocity
    let steer = desired.sub(entity.velocity);
    return steer;

  }

  // Wander using the classic projected-circle approach.
  static wander(entity, {
    distance = 3.2,
    radius = 1.7,
    jitter = 0.55
  } = {}) {

    if (entity.wanderAngle === undefined) {
      entity.wanderAngle = Math.random() * Math.PI * 2;
    }

    let forward = entity.velocity.clone();
    if (forward.lengthSq() < 0.0001) {
      forward.set(0, 0, 1);
    } else {
      forward.normalize();
    }

    const circleCenter = entity.position
      .clone()
      .add(forward.multiplyScalar(distance));

    entity.wanderAngle += (Math.random() * 2 - 1) * jitter;

    const offset = new THREE.Vector3(
      Math.sin(entity.wanderAngle) * radius,
      0,
      Math.cos(entity.wanderAngle) * radius
    );

    const target = circleCenter.add(offset);
    return SteeringBehaviours.seek(entity, target);
  }

}

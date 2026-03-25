import * as THREE from 'three';
import { SteeringBehaviours } from './SteeringBehaviours';


export class PathFollowSteering {

  // Simple Path Following
  static simple(entity, threshold) {
    
    // Get the path follower object
    let pf = entity.pathFollower;

    // Get the target
    let target = pf.path.get(pf.index);


    // If the distance between our entity and the target
    // is less than some threshold
    // and the path follow index is less than our last index
    // increment the path follower index
    if (
      entity.position.distanceTo(target) < threshold &&
      pf.index < pf.path.size() - 1
    ) {
      pf.index++;
    }

    // If at the last index, arrive
    if (pf.index === pf.path.size() - 1) {
      return SteeringBehaviours.arrive(entity, target, threshold, 0.5);
    }

    // Call seek
    return SteeringBehaviours.seek(entity, target);

  }

  // Reynolds path following
  static reynolds(entity, lookAhead, extraMag, debug) {

    // Empty steering force to return
    let steer = new THREE.Vector3();

    // Getting our predictedLocation
    let predictedChange = entity.velocity.clone().multiplyScalar(lookAhead);
    let predictedLocation = entity.position.clone().add(predictedChange);


    // Get the path follower object
    let pf = entity.pathFollower;

    // Test to see if we are on our last index
    if (pf.index === pf.path.size() - 1) {
      let arriveLocation = pf.path.get(pf.index);
      return SteeringBehaviours.arrive(entity, arriveLocation, extraMag, 0.5);
    }

    // This is the start and end of our path segment
    let start = pf.path.get(pf.index);
    let end = pf.path.get(pf.index+1);

    // Get our two vectors for projection
    let startToPredict = predictedLocation.clone().sub(start);
    let startToEnd = end.clone().sub(start);
    
    // Get our scalar projection
    let scalarProjection = startToPredict.dot(startToEnd)/startToEnd.length();

    // If our scalar projection is < 0, we set it to 0
    scalarProjection = Math.max(0, scalarProjection);

    // If our scalar projection is
    // Greater than the length of our path segment
    // Move on
    if (scalarProjection > startToEnd.length()) {
      pf.index++;
    }

    // Get our vector projection (position on the path)
    let vectorProjection = startToEnd.clone().setLength(scalarProjection);
    let positionOnPath = start.clone().add(vectorProjection);

    // Get the distance
    let distance = positionOnPath.distanceTo(predictedLocation);

    // Get our little bit extra!
    let extra = startToEnd.clone().setLength(extraMag);
    extra.add(positionOnPath);


    // If the distance is > path radius
    // We seek towards our extra
    if (distance > pf.path.radius) {
      steer = SteeringBehaviours.seek(entity, extra);
    }
    
    // Just to debug
    debug.updatePositions([ predictedLocation, positionOnPath, extra ]);

    return steer;

  }

}
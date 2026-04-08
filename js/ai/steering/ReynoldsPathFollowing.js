/*

My implementation follows the Reynolds path following framework directly.
 It predicts a future position, projects that point onto the current path segment using scalar projection, measures the distance
  from the predicted position to the path, and seeks a target slightly ahead when the agent deviates too far.

The remaining differences are practical adjustments for a real-time game environment.
 I use a looped path to allow continuous patrol, switch segments using a distance threshold near the end of each segment, 
 and apply a small forward steering force even when the agent is within the path radius.

These modifications are not part of the basic lecture version, but they improve smoothness, continuity, 
and overall stability of the movement in the game.

*/

import * as THREE from 'three';
/*
Purpose : Implement Reynolds' path following behavior for agents, allowing them to follow a predefined path smoothly by 
predicting future positions and steering towards a target point on the path.
*/

export class ReynoldsPathFollowing {

  // Helper function to get a point on a looped path based on an index, allowing for continuous patrol behavior
  static getLoopPathPoint(path, index) {
    const size = path.length;
    return path[((index % size) + size) % size];
  }

  // Projects a point onto a line segment defined by points a and b ...exact reynolds style, 
static projectPointOnSegment(point, a, b) {
  const ap = point.clone().sub(a);
  const ab = b.clone().sub(a);

  const abLength = ab.length();

  if (abLength === 0) {
    return a.clone();
  }

  const abNormalized = ab.clone().normalize();

  // scalar projection
  let scalarProj = ap.dot(abNormalized);

  // clamp to segment
  scalarProj = THREE.MathUtils.clamp(scalarProj, 0, abLength);

  // vector projection (normal point)
  return a.clone().add(abNormalized.multiplyScalar(scalarProj));
}
  
// Seek behavior to steer the entity towards a target point, with clamping to max force for stability
  static seek(entity, target) {
    const desired = target.clone().sub(entity.position);
    desired.y = 0;

    if (desired.lengthSq() === 0) {
      return new THREE.Vector3(0, 0, 0);
    }

    desired.normalize().multiplyScalar(entity.topSpeed);

    const currentVel = entity.velocity.clone();
    currentVel.y = 0;

    const steering = desired.sub(currentVel);
    steering.y = 0;

    const maxForce = entity.maxForce ?? entity.maxforce ?? 8.0;
    steering.clampLength(0, maxForce);

    return steering;
  }

  // Main path following function that implements the Reynolds framework with practical adjustments for game use
  static followLoop(entity, debug = null) {
    if (!entity || !entity.pathFollower) {
      return new THREE.Vector3(0, 0, 0);
    }

    const pf = entity.pathFollower;
    const path = pf.path;

    if (!path || path.length < 2) {
      return new THREE.Vector3(0, 0, 0);
    }

    const predictDistance = pf.predictDistance ?? 2.5;
    const pathRadius = pf.pathRadius ?? 0.8;
    const targetOffset = pf.targetOffset ?? 2.0;

    let velocity = entity.velocity.clone();
    velocity.y = 0;

    let futurePos;

    if (velocity.lengthSq() < 0.0001) {
      const a = this.getLoopPathPoint(path, pf.segmentIndex ?? 0);
      const b = this.getLoopPathPoint(path, (pf.segmentIndex ?? 0) + 1);
      const dir = b.clone().sub(a);

      if (dir.lengthSq() < 0.0001) {
        futurePos = entity.position.clone();
      } else {
        futurePos = entity.position.clone().add(
          dir.normalize().multiplyScalar(predictDistance)
        );
      }
    } else {
      futurePos = entity.position.clone().add(
        velocity.normalize().multiplyScalar(predictDistance)
      );
    }

    const segIndex = pf.segmentIndex ?? 0;
    const a = this.getLoopPathPoint(path, segIndex);
    const b = this.getLoopPathPoint(path, segIndex + 1);
    
    const normalPoint = this.projectPointOnSegment(futurePos, a, b);
    const segmentDir = b.clone().sub(a).normalize();
    const target = normalPoint.clone().add(
      segmentDir.multiplyScalar(targetOffset)
    );

    const distToEnd = normalPoint.distanceTo(b);
    if (distToEnd < targetOffset) {
      pf.segmentIndex = (segIndex + 1) % path.length;
    }

    const distanceFromPath = futurePos.distanceTo(normalPoint);

    let steering;

    if (distanceFromPath > pathRadius) {
      steering = this.seek(entity, target);
    } else {
      const nextPoint = this.getLoopPathPoint(path, (pf.segmentIndex ?? 0) + 1);
      steering = this.seek(entity, nextPoint);
      steering.multiplyScalar(0.35);
    }

    if (debug) {
      debug.futurePos = futurePos.clone();
      debug.normalPoint = normalPoint.clone();
      debug.target = target.clone();
    }

    return steering;
  }
}
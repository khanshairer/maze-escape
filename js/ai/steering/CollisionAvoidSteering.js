import * as THREE from 'three';
import { SteeringBehaviours } from './SteeringBehaviours.js';



export class CollisionAvoidSteering {

  // Predictive containment against the outer map bounds.
  static bounds(entity, map, lookAhead = 1.5, margin = 1.2) {
    if (!map) {
      return new THREE.Vector3();
    }

    const predicted = entity.position
      .clone()
      .add(entity.velocity.clone().multiplyScalar(lookAhead));

    const minX = map.minX + margin;
    const maxX = map.minX + map.cols * map.tileSize - margin;
    const minZ = map.minZ + margin;
    const maxZ = map.minZ + map.rows * map.tileSize - margin;

    const target = predicted.clone();
    let needsAvoid = false;

    if (predicted.x < minX) {
      target.x = minX + margin * 0.5;
      needsAvoid = true;
    } else if (predicted.x > maxX) {
      target.x = maxX - margin * 0.5;
      needsAvoid = true;
    }

    if (predicted.z < minZ) {
      target.z = minZ + margin * 0.5;
      needsAvoid = true;
    } else if (predicted.z > maxZ) {
      target.z = maxZ - margin * 0.5;
      needsAvoid = true;
    }

    if (!needsAvoid) {
      return new THREE.Vector3();
    }

    return SteeringBehaviours.seek(entity, target);
  }

  // Predictive steering away from blocked tile edges in the current maze.
  static tileWalls(entity, map, lookAhead = 1.1, probeOffset = 0.9) {
    if (!map) {
      return new THREE.Vector3();
    }

    const forward = entity.velocity.clone();
    if (forward.lengthSq() < 0.0001) {
      return new THREE.Vector3();
    }

    forward.normalize();
    const predicted = entity.position
      .clone()
      .add(forward.clone().multiplyScalar(lookAhead));

    const tile = map.quantize(predicted);
    if (!tile || !tile.isWalkable()) {
      return new THREE.Vector3();
    }

    const tileCenter = map.localize(tile);
    const neighbours = map.getNeighbours(tile);
    const half = map.tileSize / 2;
    const avoidTarget = predicted.clone();
    let needsAvoid = false;

    const northWalkable =
      tile.row > 0 &&
      neighbours.includes(map.grid[tile.row - 1][tile.col]);
    const southWalkable =
      tile.row < map.rows - 1 &&
      neighbours.includes(map.grid[tile.row + 1][tile.col]);
    const westWalkable =
      tile.col > 0 &&
      neighbours.includes(map.grid[tile.row][tile.col - 1]);
    const eastWalkable =
      tile.col < map.cols - 1 &&
      neighbours.includes(map.grid[tile.row][tile.col + 1]);

    if (!northWalkable && predicted.z < tileCenter.z - (half - probeOffset)) {
      avoidTarget.z = tileCenter.z - (half - probeOffset);
      needsAvoid = true;
    }

    if (!southWalkable && predicted.z > tileCenter.z + (half - probeOffset)) {
      avoidTarget.z = tileCenter.z + (half - probeOffset);
      needsAvoid = true;
    }

    if (!westWalkable && predicted.x < tileCenter.x - (half - probeOffset)) {
      avoidTarget.x = tileCenter.x - (half - probeOffset);
      needsAvoid = true;
    }

    if (!eastWalkable && predicted.x > tileCenter.x + (half - probeOffset)) {
      avoidTarget.x = tileCenter.x + (half - probeOffset);
      needsAvoid = true;
    }

    if (!needsAvoid) {
      return new THREE.Vector3();
    }

    return SteeringBehaviours.seek(entity, avoidTarget);
  }

  // Produces a steering behaviour to 
  // avoid a round obstacle
  static round(entity, obstacle, lookAhead, howFar, debug) {

  let steer = new THREE.Vector3();

  // Safe debug – if debug is null/undefined, use a dummy that does nothing
  const safeDebug = debug || {
    showLine: () => {},
    showSphere: () => {},
    hideObjs: () => {}
  };

  // First, get the future location of our character
  let predictedChange = entity.velocity.clone().multiplyScalar(lookAhead);
  let predictedLocation = entity.position.clone().add(predictedChange);

  // show via a line
  safeDebug.showLine("predictedLocation", entity.position, predictedLocation, 'black');

  // Get the closest point on the line segment from 
  // our entity --> it's predicted location
  // to the center of the round obstacle 
  let closestPoint = CollisionAvoidSteering.getClosestPointOnSegment(
      entity.position,
      predictedLocation,
      obstacle.position
    );

  // show via a sphere
  safeDebug.showSphere("closestPoint", closestPoint);

  // Check to see if there is a collision
  let isCollision =
    closestPoint.distanceTo(obstacle.position) <= obstacle.radius;

  let collisionPoint = new THREE.Vector3();
  let target = new THREE.Vector3();

  if (isCollision) {
    collisionPoint = CollisionAvoidSteering.getLineCircleCollisionPoint(
        entity.position, 
        predictedLocation, 
        obstacle.position, 
        obstacle.radius
      );

    // Get the avoid target
    target = CollisionAvoidSteering.getAvoidTarget(collisionPoint, obstacle, howFar);

    steer = SteeringBehaviours.seek(entity, target);

    // show line in yellow
    // safeDebug.showLine("predictedLocation", entity.position, predictedLocation, 'yellow');

    // show via spheres
    safeDebug.showSphere("collisionPoint", collisionPoint);
    safeDebug.showSphere("target", target);

  }
  else {
    // hide unnecessary spheres
    safeDebug.hideObjs(["collisionPoint", "target"]);
  }

  return steer;
}

  // Get the avoid target
  static getAvoidTarget(collisionPoint, obstacle, howFar) {

    let normal = collisionPoint.clone().sub(obstacle.position);
    normal.setLength(howFar);

    let target = collisionPoint.clone().add(normal);

    return target;
  }

  // Get the closest point on the line
  // to the center of the obstacle
  // this is applicable only to circle collision
  static getClosestPointOnSegment(start, end, point) {
    let segment = end.clone().sub(start);
    let toPoint = point.clone().sub(start);

    let sp = toPoint.dot(segment)/segment.length();

    let clampedSP = THREE.MathUtils.clamp(sp, 0, segment.length());

    let closest = segment.clone().setLength(clampedSP);
    closest.add(start);

    return closest;
  }

  // Get the collision point between
  // a line and a circle
  static getLineCircleCollisionPoint(start, end, circlePos, radius) {

    let line = end.clone().sub(start);

    let toCircle = circlePos.clone().sub(start);
    let sp = toCircle.dot(line)/line.length();

    // Point on line closest to center
    let projectionPoint = line.clone().setLength(sp);
    projectionPoint.add(start);

    let opposite = projectionPoint.clone().sub(circlePos);
    let adjacent = Math.sqrt(radius * radius - opposite.length() ** 2);

    let collisionLength = sp - adjacent;

    let collisionPoint = line.clone().setLength(collisionLength);
    collisionPoint.add(start);

    return collisionPoint;
  }




  // Wall avoidance (containment via Reynolds)
  static wall(entity, wallStart, wallEnd, lookAhead, howFar, debug) {

    debug.showLine("wall", wallStart, wallEnd, 'red');

    let steer = new THREE.Vector3();

    // First, get the future location of our character
    let predictedChange = entity.velocity.clone().multiplyScalar(lookAhead);
    let predictedLocation = entity.position.clone().add(predictedChange);

    // show via a line
    debug.showLine("predictedLocation", entity.position, predictedLocation, 'black');

    let collisionPoint = 
      CollisionAvoidSteering.getLineLineCollisionPoint(
        entity.position, 
        predictedLocation,
        wallStart,
        wallEnd
      );

    if (collisionPoint) {
      debug.showSphere('collisionPoint', collisionPoint);

      // 1. Get wall direction vector (along the wall)
      let wallDirection = wallEnd.clone().sub(wallStart);

      // 2. Get wall normal (perpendicular to wall in XZ plane)
      let wallNormal = new THREE.Vector3(-wallDirection.z, 0, wallDirection.x);

      // 3. Ensure normal opposes velocity (points away from approach direction)
      if (wallNormal.dot(entity.velocity) > 0) {
        wallNormal.multiplyScalar(-1);
      }

      // 4. Calculate target point away from wall
      let target = collisionPoint.clone().add(wallNormal.setLength(howFar));
      debug.showSphere('target', target);

      // 5. Seek to target
      steer = SteeringBehaviours.seek(entity, target);

    } else {
      debug.hideObjs(['target', 'collisionPoint']);
    }

    return steer;
  }

  // Get the collision point between
  // two lines
  static getLineLineCollisionPoint(start1, end1, start2, end2) {

    // Direction vectors for both lines
    let dir1 = end1.clone().sub(start1);
    let dir2 = end2.clone().sub(start2);

    let denominator = dir1.x * dir2.z - dir1.z * dir2.x;

    if (denominator === 0) {
      return null;
    }
    // Calculate parameters u1 and u2
    let dx = start2.x - start1.x;
    let dz = start2.z - start1.z;
    
    let u1 = (dx * dir2.z - dz * dir2.x) / denominator;
    let u2 = (dx * dir1.z - dz * dir1.x) / denominator;

    // If both u1 and u2 are within 0 and 1 it's on the lines
    if (u1 < 0 || u1 > 1 || u2 < 0 || u2 > 1) {
      return null;
    }


    let collisionPoint = new THREE.Vector3();
    collisionPoint.x = start1.x + u1 * dir1.x;
    collisionPoint.y = 0;
    collisionPoint.z = start1.z + u1 * dir1.z;

    return collisionPoint;
  }

}

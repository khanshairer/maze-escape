import * as THREE from 'three';

export class ReynoldsPathFollowing {
  static getLoopPathPoint(path, index) {
    const size = path.length;
    return path[((index % size) + size) % size];
  }

  static closestPointOnSegment(point, a, b) {
    const ab = b.clone().sub(a);
    const abLenSq = ab.lengthSq();

    if (abLenSq === 0) {
      return a.clone();
    }

    const ap = point.clone().sub(a);
    let t = ap.dot(ab) / abLenSq;
    t = THREE.MathUtils.clamp(t, 0, 1);

    return a.clone().add(ab.multiplyScalar(t));
  }

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

    const normalPoint = this.closestPointOnSegment(futurePos, a, b);
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
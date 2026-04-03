import { State } from './State.js';
import { SteeringBehaviours } from '../../steering/SteeringBehaviours.js';
import { AlertState } from './AlertState.js';

export class GuardState extends State {
  enter(entity, data) {
    entity.topSpeed = 3;
    entity.setColor('blue');
    entity.setDetectionCircleColor(0x66e0ff, 0.45);
    console.log("Entering Guard State");
  }

  update(entity, data, dt) {
    const target = data.player;
    const world = data.world;

    if (!target || !world) return;

    if (world.isPlayerOnSafeTile()) {
      const wanderForce = SteeringBehaviours.wander(entity);
      entity.applyForce(wanderForce);
      return;
    }

    if (entity.position.distanceTo(target.position) <= 6) {
      entity.fsm.change(new AlertState());
      return;
    }

    const wanderForce = SteeringBehaviours.wander(entity);
    entity.applyForce(wanderForce);
  }

  exit(entity, data) {
    console.log("Leaving Guard State");
  }
}
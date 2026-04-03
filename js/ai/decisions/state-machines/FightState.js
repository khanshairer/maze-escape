import { State } from './State.js';
import { SteeringBehaviours } from '../../steering/SteeringBehaviours.js';
import { RestState } from './RestState.js';
import { GuardState } from './GuardState.js';

export class FightState extends State {
  enter(entity, data) {
    entity.topSpeed = 6;
    entity.setColor('red');
    entity.setDetectionCircleColor(0xff3333, 0.6);
    console.log("Entering Fight State");
  }

  update(entity, data, dt) {
    const target = data.player;
    const world = data.world;

    if (!target || !world) return;

    if (world.isPlayerOnSafeTile()) {
      entity.fsm.change(new GuardState());
      return;
    }

    if (entity.position.distanceTo(target.position) >= 10) {
      entity.fsm.change(new RestState());
      return;
    }

    const pursueForce = SteeringBehaviours.pursue(entity, target, 1);
    entity.applyForce(pursueForce);
  }

  exit(entity, data) {
    console.log("Leaving Fight State");
  }
}
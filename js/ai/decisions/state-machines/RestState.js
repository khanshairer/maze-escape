import { State } from './State.js';
import { GuardState } from './GuardState.js';

export class RestState extends State {
  enter(entity, data) {
    entity.setColor('white');
    entity.setDetectionCircleColor(0x66e0ff, 0.35);
    entity.restTimer = 2;
    console.log("Entering Rest State");
  }

  update(entity, data, dt) {
    entity.restTimer -= dt;

    if (entity.restTimer <= 0) {
      entity.fsm.change(new GuardState());
      return;
    }

    const stopForce = entity.velocity.clone().negate();
    entity.applyForce(stopForce);
  }

  exit(entity, data) {
    console.log("Leaving Rest State");
  }
}
import { State } from './State.js';
import { FightState } from './FightState.js';
import { GuardState } from './GuardState.js';

export class AlertState extends State {
  enter(entity, data) {
    entity.topSpeed = 0;
    entity.setColor('orange');
    entity.setDetectionCircleColor(0xffdd55, 0.55);
    entity.alertTimer = 1.5;
    console.log("Entering Alert State");
  }

  update(entity, data, dt) {
    const target = data.player;
    const world = data.world;

    if (!target || !world) return;

    if (world.isPlayerOnSafeTile()) {
      entity.fsm.change(new GuardState());
      return;
    }

    entity.alertTimer -= dt;

    if (entity.position.distanceTo(target.position) > 6) {
      entity.fsm.change(new GuardState());
      return;
    }

    if (entity.alertTimer <= 0) {
      entity.fsm.change(new FightState());
      return;
    }

    const stopForce = entity.velocity.clone().negate();
    entity.applyForce(stopForce);
  }

  exit(entity, data) {
    console.log("Leaving Alert State");
  }
}
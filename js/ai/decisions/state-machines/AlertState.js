import { State } from './State.js';
import { ChaseState } from './ChaseState.js';
import { SearchState } from './SearchState.js';

/*
Purpose : Represent FSM Alter State..
*/
export class AlertState extends State {

  enter(entity, data) {
    entity.stateTag = 'alert';
    entity.alertTimer = entity.alertDuration;
    entity.topSpeed = 3.0;
    entity.setDetectionCircleColor(0xffcc33, 0.35);
  }

  update(entity, data, dt) {
    const player = data?.player;
    if (!player) return;

    if (!entity.canDetectPlayer(player)) {
      entity.fsm.change(new SearchState());
      return;
    }

    entity.rememberPlayer(player.position);

    if (entity.canChasePlayer(player)) {
      entity.fsm.change(new ChaseState());
      return;
    }

    const pursueForce = entity.getPursueForce(player);
    entity.applyBlendedSteering(pursueForce, data);
  }

  exit(entity, data) {}
}
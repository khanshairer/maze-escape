import { State } from './State.js';
import { SearchState } from './SearchState.js';

/*
Purpose ; Represent FSM ChaseState
*/
export class ChaseState extends State {

  enter(entity, data) {
    entity.stateTag = 'chase';
    entity.topSpeed = 7.7;
    entity.setDetectionCircleColor(0xff4444, 0.45);
  }

  update(entity, data, dt) {
    const player = data?.player;
    if (!player) return;

    if (!entity.canDetectPlayer(player)) {
      entity.fsm.change(new SearchState());
      return;
    }

    entity.rememberPlayer(player.position);

    const seekForce = entity.getSeekForce(player.position);
    entity.applyBlendedSteering(seekForce, data);
  }

  exit(entity, data) {}
}
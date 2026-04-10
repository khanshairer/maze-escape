import { State } from './State.js';
import { AlertState } from './AlertState.js';

export class PatrolState extends State {

  enter(entity, data) {
    entity.stateTag = 'patrol';
    entity.clearStateTimers();
    entity.topSpeed = 4.0;
    entity.setDetectionCircleColor(0x66e0ff, 0.25);
  }

  update(entity, data, dt) {
    const player = data?.player;

    if (player && entity.canDetectPlayer(player)) {
      entity.rememberPlayer(player.position);
      entity.fsm.change(new AlertState());
      return;
    }

    const wanderForce = entity.getWanderForce();
    entity.applyBlendedSteering(wanderForce, data);
  }

  exit(entity, data) {}
}
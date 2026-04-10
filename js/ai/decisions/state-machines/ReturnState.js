import { State } from './State.js';
import { SteeringBehaviours } from '../../steering/SteeringBehaviours.js';
import { PatrolState } from './PatrolState.js';
import { AlertState } from './AlertState.js';

function reacquireIfDetected(entity, data) {
  const player = data.player;
  if (!player) return false;
  if (entity.canDetectPlayer(player)) {
    entity.rememberPlayer(player.position);
    entity.fsm.change(new AlertState());
    return true;
  }
  return false;
}

export class ReturnState extends State {
  enter(entity) {
    entity.stateTag = 'return';
    entity.topSpeed = 2.6;
    entity.clearNavigationPath();
  }

  update(entity, data) {
    if (reacquireIfDetected(entity, data)) return;

    const homePosition = entity.getHomePosition();
    const returnForce = SteeringBehaviours.arrive(entity, homePosition, 3, 0.4);
    const hasPath = entity.ensureHierarchicalPath(homePosition, 'return');
    const movementForce = hasPath ? entity.getHierarchicalPathForce() : returnForce;
    entity.applyBlendedSteering(movementForce, data, 1.05);

    if (entity.position.distanceTo(homePosition) <= 1.2) {
      entity.fsm.change(new PatrolState());
    }
  }

  exit() {}
}
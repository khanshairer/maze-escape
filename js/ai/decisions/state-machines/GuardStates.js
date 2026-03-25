import { State } from './State.js';
import { SteeringBehaviours } from '../../steering/SteeringBehaviours.js';

// Patrol state:
// guard will wander until it sees the target
// when it sees the target (player) switch to FIGHT
export class PatrolState extends State {

  enter(entity, data) {
    entity.topSpeed = 3;
    entity.setColor('blue');
    console.log("Entering Patrol State");
  }

  update(entity, data, dt) {
    let target = data.target;

    if (entity.position.distanceTo(target.position) <= 6) {
      entity.fsm.change(new FightState());
      return;
    }

    let wanderForce = SteeringBehaviours.wander(entity);
    entity.applyForce(wanderForce);
  }

  exit(entity, data) {
    console.log("Leaving Patrol State");
  }

}

// Fight state:
// guard chases the target
// until it loses them, when it loses them
// switch to rest
export class FightState extends State {

  enter(entity, data) {
    entity.topSpeed = 6;
    entity.setColor('yellow');
    console.log("Entering Fight State");
  }

  update(entity, data, dt) {
    let target = data.target;

    if (entity.position.distanceTo(target.position) >= 10) {
      // we want to switch to rest state
      entity.fsm.change(new RestState());
      return;
    }

    let seekForce = SteeringBehaviours.seek(entity, target);
    entity.applyForce(seekForce);
  }

  exit(entity, data) {
    console.log("Leaving Fight State");
  }

}

// Rest state:
// Guard will slow down to a stop
// Start a 2s timer upon entry
// When the 2s timer runs our we switch to Patrol
export class RestState extends State {

  enter(entity, data) {
    entity.setColor("white");
    entity.restTimer = 2;
    console.log("Entering Rest State");
  }

  update(entity, data, dt) {
    entity.restTimer -= dt;

    if (entity.restTimer <= 0) {
      entity.fsm.change(new PatrolState());
      return;
    }
 
    let stopForce = entity.velocity.clone().negate();
    entity.applyForce(stopForce);

  }

  exit(entity, data) {
    console.log("Leaving Rest State");
  }

}
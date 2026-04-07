import { State } from './State.js';
import { SteeringBehaviours } from "../../steering/SteeringBehaviours.js";

/*
Purpose: This file defines the various states for the DroneEnemy's finite state machine (FSM), 
including PatrolState, AlertState, ChaseState, SearchState, and ReturnState.

Parameters: Each state class contains methods for entering the state, updating the state on each frame, and exiting the state.

*/
function reacquireIfDetected(entity, data) {
  
  const player = data.player;
  
  if (!player) {
    
    return false;
  
  }

  if (entity.canDetectPlayer(player)) {
    
    entity.rememberPlayer(player.position);
    entity.fsm.change(new AlertState());
    
    return true;
  }

  return false;
}

/*
Purpose : PatrolState is the default state for the DroneEnemy, where it wanders around its patrol area. If it detects the player, 
it transitions to AlertState.

AlertState is triggered when the DroneEnemy detects the player, causing it to stop and prepare for a chase. If the player is lost, 
it transitions to SearchState.

ChaseState is active when the DroneEnemy is actively pursuing the player. If the player is lost during the chase, 
it transitions to SearchState.

SearchState is used when the DroneEnemy has lost sight of the player but still remembers their last known position. 
It will search for the player in that area. If it fails to find the player within a certain time, it transitions to ReturnState.

ReturnState is activated when the DroneEnemy gives up searching for the player and returns to its patrol area. Once it reaches its home position, it transitions back to PatrolState.
*/
export class PatrolState extends State {
  
  enter(entity) {
    
    entity.stateTag = 'patrol';
    entity.topSpeed = 2.2;
    entity.clearStateTimers();
    entity.clearNavigationPath();
  
  }

  update(entity, data) {
    
    const player = data.player;
    
    if (player && entity.canDetectPlayer(player)) {
      
      entity.rememberPlayer(player.position);
      entity.fsm.change(new AlertState());
      
      return;
    
    }

    const homePosition = entity.getHomePosition();
    const distanceFromHome = entity.position.distanceTo(homePosition);
    const wanderForce = SteeringBehaviours.wander(entity, {
      distance: entity.wanderDistance,
      radius: entity.wanderRadius,
      jitter: entity.wanderJitter
    
    });

    if (distanceFromHome > entity.patrolRadius) {
      
      const returnForce = SteeringBehaviours.arrive(
        entity,
        homePosition,
        entity.patrolRadius,
        0.35
      
      );
      
      entity.applyBlendedSteering(returnForce, data, 1.8);
      return;
    }

    let patrolForce = wanderForce;

    if (distanceFromHome > entity.softPatrolRadius) {
      
      const homeBias = SteeringBehaviours.arrive(
        entity,
        homePosition,
        entity.patrolRadius,
        0.4
      );
      
      patrolForce = patrolForce.add(homeBias.multiplyScalar(0.6));
    
    }

    entity.applyBlendedSteering(patrolForce, data);
  }

  exit() {}
}

export class AlertState extends State {
  
  enter(entity) {
    
    entity.stateTag = 'alert';
    entity.topSpeed = 0;
    entity.alertTimer = entity.alertDuration;
    entity.clearNavigationPath();
  
  }

  update(entity, data, dt) {
    
    const player = data.player;

    if (player && entity.canDetectPlayer(player)) {
      
      entity.rememberPlayer(player.position);
    
    }

    entity.applyBlendedSteering(entity.velocity.clone().negate(), data, 0.8);
    entity.alertTimer -= dt;

    if (entity.alertTimer <= 0) {
      
      entity.fsm.change(new ChaseState());
    
    }
  }

  exit() {}
}

export class ChaseState extends State {
  
  enter(entity) {
    
    entity.stateTag = 'chase';
    entity.topSpeed = 3.6;
    entity.clearNavigationPath();
  
  }

  update(entity, data) {
    
    const player = data.player;
    
    if (!player) {
      
      entity.fsm.change(new ReturnState());
      return;
    
    }

    if (entity.canChasePlayer(player)) {
      
      entity.rememberPlayer(player.position);
      const hasPath = entity.ensureHierarchicalPath(player.position, 'chase');
      const chaseForce = hasPath
        ? entity.getHierarchicalPathForce()
        : SteeringBehaviours.seek(entity, player.position);
      entity.applyBlendedSteering(chaseForce, data, 1.2);
      
      return;
    }

    entity.fsm.change(new SearchState());
  }

  exit() {}
}

export class SearchState extends State {
  
  enter(entity) {
    
    entity.stateTag = 'search';
    entity.topSpeed = 2.8;
    entity.searchTimer = entity.searchDuration;
    entity.clearNavigationPath();
  
  }

  update(entity, data, dt) {
    
    if (reacquireIfDetected(entity, data)) {
      
      return;
    
    }

    entity.searchTimer -= dt;

    if (entity.lastKnownPlayerPosition) {
      
      const hasPath = entity.ensureHierarchicalPath(
        entity.lastKnownPlayerPosition,
        'search'
      );
      const searchForce = hasPath
        ? entity.getHierarchicalPathForce()
        : SteeringBehaviours.arrive(
            entity,
            entity.lastKnownPlayerPosition,
            3,
            0.35
          );
      entity.applyBlendedSteering(searchForce, data, 1.05);
    } else {
      entity.applyBlendedSteering(entity.velocity.clone().negate(), data, 0.8);
    }

    if (entity.searchTimer <= 0) {
      
      entity.fsm.change(new ReturnState());
    
    }
  }

  exit() {}
}

export class ReturnState extends State {
  
  enter(entity) {
    
    entity.stateTag = 'return';
    entity.topSpeed = 2.6;
    entity.clearNavigationPath();
  
  }

  update(entity, data) {
    
    if (reacquireIfDetected(entity, data)) {
      
      return;
    
    }

    const homePosition = entity.getHomePosition();
    const returnForce = SteeringBehaviours.arrive(
      entity,
      homePosition,
      3,
      0.4
    );
    const hasPath = entity.ensureHierarchicalPath(homePosition, 'return');
    const movementForce = hasPath
      ? entity.getHierarchicalPathForce()
      : returnForce;
    entity.applyBlendedSteering(movementForce, data, 1.05);

    if (entity.position.distanceTo(homePosition) <= 1.2) {
      entity.fsm.change(new PatrolState());
    }
  }

  exit() {}
}

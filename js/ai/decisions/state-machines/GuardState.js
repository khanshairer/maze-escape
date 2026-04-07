import { State } from './State.js';
import { SteeringBehaviours } from '../../steering/SteeringBehaviours.js';
import { AlertState } from './AlertState.js';

/*

Purpose: GuardState is a state in the finite state machine (FSM) for an enemy character in the game. 
When the enemy is in the GuardState, it wanders around and checks for the player's presence. 
If the player comes within a certain distance and is not on a safe tile, the enemy transitions to the AlertState to indicate 
that it has detected the player. If the player is on a safe tile, the enemy continues to wander without transitioning to AlertState.

Parameters: Each method in the GuardState class takes an entity (the enemy character), data (an object containing relevant information about the game world and player), and dt (the time elapsed since the last update) as parameters. The enter method initializes the enemy's properties when it enters the GuardState, the update method handles the logic for wandering and detecting the player, and the exit method is defined for consistency and future extensibility but does not have specific behavior in this state.

*/
export class GuardState extends State {
  
  enter(entity, data) {
    
    entity.topSpeed = 3;
    entity.setColor('blue');
    entity.setDetectionCircleColor(0x66e0ff, 0.45);
  
  }
 
  /*
  
  Purpose: update is a method that is called on each frame while the enemy character is in the GuardState. 
  It handles the logic for wandering around and checking for the player's presence. If the player comes within a certain distance 
  and is not on a safe tile, the enemy transitions to the AlertState to indicate that it has detected the player. If the player 
  is on a safe tile, the enemy continues to wander without transitioning to AlertState.
  
  Parameters: entity - the enemy character that is currently in the GuardState, data - an object containing relevant information about
  the game world and player that the enemy can use to determine its behavior in this state, dt - the time elapsed since the last update,
  which can be used for timing and smooth movement calculations.
  
  */

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
 
  // No specific exit behavior needed for GuardState, but the method is defined for consistency and future extensibility
  exit(entity, data) {
  }
}
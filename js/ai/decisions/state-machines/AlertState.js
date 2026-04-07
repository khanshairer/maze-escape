import { State } from './State.js';
import { FightState } from './FightState.js';
import { GuardState } from './GuardState.js';
/*
Purpose: AlertState is a state in the finite state machine (FSM) for an enemy character in the game.
When the enemy enters the AlertState, it stops moving and changes its color to indicate that it has detected the player.
In the update method, the enemy checks if the player is still within a certain distance and if the player is on a safe tile. 
If the player is too far away or on a safe tile, the enemy transitions back to the GuardState. If the alert timer runs out while 
the player is still within range, the enemy transitions to the FightState to engage the player in combat.

*/
export class AlertState extends State {

  /*
  Purpse: enter is a method that is called when the enemy character transitions into the AlertState.
  Parameters: entity - the enemy character that is entering the AlertState, data - an object containing relevant information about 
  the game world and player that the enemy can use to determine its behavior in this state.
  */
  enter(entity, data) {
    
    entity.topSpeed = 0;
    entity.setColor('orange');
    entity.setDetectionCircleColor(0xffdd55, 0.55);
    entity.alertTimer = 1.5;
  
  }

 /*
 Purpose: update is a method that is called on each frame while the enemy character is in the AlertState.
  Parameters: entity - the enemy character that is currently in the AlertState, data - an object containing relevant information about 
  the game world and player that the enemy can use to determine its behavior in this state, dt - the time elapsed since the last update,
  which can be used for timing and smooth movement calculations.
 */
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
    
  
  }
}
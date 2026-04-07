import { State } from './State.js';
import { GuardState } from './GuardState.js';

export class RestState extends State {
 
  /*
  
  Purpose: enter is a method that is called when the enemy character transitions into the RestState. It sets the enemy's color 
  and detection circle color to indicate that it is in a resting state, and initializes a rest timer that determines 
  how long the enemy will remain in this state before transitioning back to the GuardState.
  Parameters: entity - the enemy character that is entering the RestState, data - an object containing relevant information about 
  the game world and player that the enemy can use to determine its behavior in this state.
  
  */
  enter(entity, data) {
    
    entity.setColor('white');
    entity.setDetectionCircleColor(0x66e0ff, 0.35);
    entity.restTimer = 0.5;

  }
 
  /*
  
  Purpose : update is a method that is called on each frame while the enemy character is in the RestState. 
  It handles the timing for how long the enemy should remain in the RestState, and applies a stopping force to the enemy to 
  keep it stationary during this time. If the rest timer runs out, it transitions the enemy back to the GuardState.
  Parameters: entity - the enemy character that is currently in the RestState, data - an object containing relevant information about 
  the game world and player that the enemy can use to determine its behavior in this state, dt - the time elapsed since the last update,
  which can be used for timing and smooth movement calculations.
  
  */
  update(entity, data, dt) {
    
    entity.restTimer -= dt;

    if (entity.restTimer <= 0) {
      entity.fsm.change(new GuardState());
      return;
    
    }

    const stopForce = entity.velocity.clone().negate();
    entity.applyForce(stopForce);
  }
 
  // No specific exit behavior needed for RestState, but the method is defined for consistency and future extensibility
  exit(entity, data) {
  }
}
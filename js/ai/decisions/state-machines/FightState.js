import { State } from './State.js';
import { SteeringBehaviours } from '../../steering/SteeringBehaviours.js';
import { RestState } from './RestState.js';
import { GuardState } from './GuardState.js';

/*
  
  Purpose: enter is a method that is called when the enemy character transitions into the FightState. It sets the enemy's color 
  and detection circle color to indicate that it is in a fighting state, and initializes the enemy's top speed.
  Parameters: entity - the enemy character that is entering the FightState, data - an object containing relevant information about 
  the game world and player that the enemy can use to determine its behavior in this state.
  
  */
export class FightState extends State {
  
  /*
  
  Purpose: update is a method that is called on each frame while the enemy character is in the FightState. 
  It handles the logic for pursuing the player, checking if the player is on a safe tile, and determining when to transition to other states based on the player's position and the enemy's distance from the player.
  
  Parameters: entity - the enemy character that is currently in the FightState, data - an object containing relevant information about 
  the game world and player that the enemy can use to determine its behavior in this state, dt - the time elapsed since the last update,
  
  */
  enter(entity, data) {
    entity.topSpeed = 6;
    entity.setColor('red');
    entity.setDetectionCircleColor(0xff3333, 0.6);

  }

  // No specific exit behavior needed for FightState, but the method is defined for consistency and future extensibility
  update(entity, data, dt) {
    
    const target = data.player;
    const world = data.world;

    if (!target || !world) return;

    if (world.isPlayerOnSafeTile()) {
      
      entity.fsm.change(new GuardState());
      return;
    }

    if (entity.position.distanceTo(target.position) >= 10) {
      
      entity.fsm.change(new RestState());
      return;
    
    }

    const pursueForce = SteeringBehaviours.pursue(entity, target, 1);
    entity.applyForce(pursueForce);
  }

  // No specific exit behavior needed for FightState, but the method is defined for consistency and future extensibility
  exit(entity, data) {
  }
}
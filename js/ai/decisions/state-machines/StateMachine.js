/**
 * Generic state machine class
*/

export class StateMachine {

  constructor(entity, initialState, data = {}) {
    this.entity = entity;
    this.state = initialState;
    this.data = data; // this can store anything!
    
    // Entering that initial state
    this.state.enter(this.entity, this.data);
  }

  // Switch to a new state
  change(newState) {
    this.state.exit(this.entity, this.data);
    this.state = newState;
    this.state.enter(this.entity, this.data);
  }

  // Update our current state
  update(dt) {
    this.state.update(this.entity, this.data, dt);
  }


}
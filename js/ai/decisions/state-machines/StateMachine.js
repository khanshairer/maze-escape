/**
 * Generic state machine class
 */
export class StateMachine {

  constructor(entity, initialState, data = {}) {
    
    this.entity = entity;
    this.state = initialState;
    this.data = data;

    if (this.state && this.state.enter) {
      
      this.state.enter(this.entity, this.data);
    
    }
  }

  // Switch to a new state
  change(newState) {
    
    if (this.state && this.state.exit) {
      
      this.state.exit(this.entity, this.data);
    
    }

    this.state = newState;

    if (this.state && this.state.enter) {
      
      this.state.enter(this.entity, this.data);
    
    }
  }

  // Update shared data
  setData(data = {}) {
    
    this.data = data;
  
  }

  // Update our current state
  update(dt, data = null) {
    
    if (data) {
      
      this.data = data;
    
    }

    
    if (this.state && this.state.update) {
      
      this.state.update(this.entity, this.data, dt);
    
    }
  }
}
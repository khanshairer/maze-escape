import * as THREE from 'three';
import { DynamicEntity } from './DynamicEntity.js';
import { StateMachine } from '../ai/decisions/state-machines/StateMachine.js';
import { PatrolState } from '../ai/decisions/state-machines/DroneStates.js';
import { GroupSteeringBehaviours } from '../ai/steering/GroupSteeringBehaviours.js';
import { CollisionAvoidSteering } from '../ai/steering/CollisionAvoidSteering.js';
import { Path } from '../maps/Path.js';
import { PathFollowSteering } from '../ai/steering/PathFollowSteering.js';

/*

Purpose: DroneEnemy is a class that represents an enemy character in the game that has specific behaviors and properties.
When a DroneEnemy is created, it can be configured with various parameters such as its spawn location, patrol area,
detection and chase ranges, and timing for searching and alerting.
The DroneEnemy uses a finite state machine (FSM) to manage its behavior, transitioning between states such as patrolling, 
alerting, chasing, and searching based on the player's actions and its own timers.

*/
export class DroneEnemy extends DynamicEntity {
  
  constructor({
    spawnTile,
    homeTile = spawnTile,
    patrolMap = null,
    detectionRange = 8,
    alertRange = 12,
    chaseRange = 18,
    searchDuration = 4,
    alertDuration = 1.5,
    ...entityConfig
  } = {}) {
    super(entityConfig);

    this.spawnTile = spawnTile;
    this.homeTile = homeTile;
    this.patrolMap = patrolMap;

    this.detectionRange = detectionRange;
    this.alertRange = alertRange;
    this.chaseRange = chaseRange;
    this.searchDuration = searchDuration;
    this.alertDuration = alertDuration;

    this.lastKnownPlayerPosition = null;
    this.currentPath = [];
    this.currentPathIndex = 0;
    this.pathTarget = null;
    this.respawnTimer = 0;
    this.stateTag = 'patrol';
    this.alertTimer = 0;
    this.searchTimer = 0;
    this.fsm = null;
    this.fsmData = null;
    this.wanderAngle = Math.random() * Math.PI * 2;
    this.wanderDistance = 3.2;
    this.wanderRadius = 1.7;
    this.wanderJitter = 0.55;
    this.patrolRadius = 4.5;
    this.softPatrolRadius = 2.5;
    this.primarySteeringWeight = 1;
    this.separationRadius = 2.25;
    this.separationWeight = 1.15;
    this.boundsAvoidLookAhead = 1.35;
    this.boundsAvoidMargin = 1.35;
    this.boundsAvoidWeight = 0.9;
    this.wallAvoidLookAhead = 1.05;
    this.wallAvoidProbeOffset = 0.95;
    this.wallAvoidWeight = 0.8;
    this.hierarchicalPathfinder = null;
    this.pathFollower = null;
    this.pathStateTag = null;
    this.pathTargetPosition = null;
    this.pathTargetClusterId = null;
    this.pathStartTileKey = null;
    this.pathRefreshTimer = 0;
    this.pathRefreshInterval = 0.35;
    this.pathRecomputeDistance = 3;
    this.pathFollowThreshold = 0.8;

    this.modelLoaded = false;
    this.boatLoaded = false;
    this.loadError = false;
    this.mixer = null;

    this.createLoadingVisuals();
  }

  /*
  
  Purpose : initializeFSM is a method that sets up the finite state machine (FSM) for the DroneEnemy, 
  initializing it with the provided data and setting the initial state to PatrolState from the active
  drone FSM architecture.
  
  Parameters: data - an object containing relevant information about the game world and player 
  that the enemy can use to determine its behavior in the FSM.
  
  */
  initializeFSM(data) {
    this.fsmData = data;
    this.fsm = new StateMachine(this, new PatrolState(), data);
  }

  /*
  
  Purpose: updateFSM is a method that updates the state of the FSM on each frame, allowing the DroneEnemy to react to changes in the game world
  and player actions.
  
  Parameters: dt - the time elapsed since the last update, which can be used for timing and smooth movement calculations, 
  dataOverride - an optional object containing relevant information about the game world and player that can override the existing FSM data 
  for this update cycle.
  
  */
  updateFSM(dt, dataOverride = null) {
    
    if (!this.fsm) {
      
      return;
    
    }

    if (dataOverride) {
      
      this.fsm.data = dataOverride;
      this.fsmData = dataOverride;
    
    }

    this.pathRefreshTimer = Math.max(0, this.pathRefreshTimer - dt);
    this.fsm.update(dt);
  }

  /*
  
  Purpose: clearStateTimers is a method that resets the alert and search timers for the DroneEnemy,
  allowing it to transition between states in the FSM without being affected by previous timer values.
  
  */
  clearStateTimers() {
    
    this.alertTimer = 0;
    this.searchTimer = 0;
  
  }

  /*
  
  Purpose: rememberPlayer is a method that stores the last known position of the player for the DroneEnemy,
  allowing it to track the player's movements even when they are not in the enemy's detection range.
  
  Parameters: position - the position of the player at the time they were last seen.
  
  */
  rememberPlayer(position) {
    this.lastKnownPlayerPosition = position.clone();
  }

  
  /*
  Purpose: getHomePosition is a method that returns the home position of the DroneEnemy, which is typically the location 
  it patrols around or returns to after chasing the player.
  
  Parameters: None
  */
  getHomePosition() {

    if (!this.patrolMap || !this.homeTile) {
      
      return this.position.clone();
    
    }

    return this.patrolMap.localize(this.homeTile);
  }

  
  /*
  Purpose: canDetectPlayer is a method that checks if the player is within the detection range of the DroneEnemy,
allowing it to determine whether it should transition to the AlertState in the FSM and start reacting to the player's presence.

Parameters: player - the player character that the DroneEnemy is trying to detect, which contains information about the player's position 
and other relevant properties.
  */
  canDetectPlayer(player) {
    
    return this.position.distanceTo(player.position) <= this.detectionRange;
  
  }

  
  /*
  Purpose: canChasePlayer is a method that checks if the player is within the chase range of the DroneEnemy,
  allowing it to determine whether it should transition to the ChaseState in the FSM and start pursuing the player.

  Parameters: player - the player character that the DroneEnemy is trying to chase, which contains information about the player's position
   and other relevant properties.
  */

  canChasePlayer(player) {
    
    return this.position.distanceTo(player.position) <= this.chaseRange;
  
  }

  
  /*
  Purpose: setPathfinder is a method that sets the hierarchical pathfinder for the DroneEnemy,
  allowing it to compute paths through the game world.

  Parameters: pathfinder - the hierarchical pathfinder instance that the DroneEnemy will use for pathfinding.
  */
  setPathfinder(pathfinder) {
    
    this.hierarchicalPathfinder = pathfinder;
  }

  /*
  Purpose: getCurrentTile is a method that returns the current tile that the DroneEnemy is occupying in the patrol map,
  allowing it to determine its position relative to the patrol area and make decisions based on its location.
  Parameters: None
  */
  getCurrentTile() {
    
    return this.patrolMap ? this.patrolMap.quantize(this.position) : null;
  
  }

  /*
  Purpose: getTileKey is a method that returns a unique key for a given tile, which can be used for efficient lookup and comparison.
  Parameters: tile - the tile for which to generate a key.
  */
  getTileKey(tile) {
    
    return tile ? `${tile.row},${tile.col}` : null;
  
  }

  /*
  Purpose: clearNavigationPath is a method that resets all properties related to the current navigation path of the DroneEnemy,
  allowing it to start fresh when computing a new path or transitioning between states in the FSM.
  Parameters: None
  */
  clearNavigationPath() {
    
    this.currentPath = [];
    this.currentPathIndex = 0;
    this.pathTarget = null;
    this.pathFollower = null;
    this.pathStateTag = null;
    this.pathTargetPosition = null;
    this.pathTargetClusterId = null;
    this.pathStartTileKey = null;
    this.pathRefreshTimer = 0;
  }

 /*
  Purpose: shouldRecomputePath is a method that determines whether the DroneEnemy needs to recompute its navigation path to the target 
  position,
 Parameters: targetPosition - the position that the DroneEnemy is trying to navigate to, stateTag - 
 a tag representing the current state of the FSM,
  
 */ 
  shouldRecomputePath(targetPosition, stateTag) {
    
    if (!this.hierarchicalPathfinder || !this.patrolMap || !targetPosition) {
      
      return false;
    
    }

    const startTile = this.getCurrentTile();
    const targetTile = this.patrolMap.quantize(targetPosition);

    if (!startTile || !targetTile || !targetTile.isWalkable()) {
      
      return false;
    
    }

    if (!this.pathFollower || this.pathFollower.path.size() === 0) {
      
      return true;
    
    }

    if (this.pathStateTag !== stateTag) {
      
      return true;
    
    }

    const targetClusterId = this.hierarchicalPathfinder.getClusterIdForTile(targetTile);
    
    if (this.pathTargetClusterId !== targetClusterId) {
      
      return true;
    
    }

    if (!this.pathTargetPosition) {
      
      return true;
    
    }

    if (this.pathTargetPosition.distanceTo(targetPosition) > this.pathRecomputeDistance) {
      
      return true;
    
    }

    if (this.pathFollower.index >= this.pathFollower.path.size() - 1) {
      
      const lastPoint = this.pathFollower.path.get(this.pathFollower.path.size() - 1);
      
      if (!lastPoint || this.position.distanceTo(lastPoint) > this.pathFollowThreshold) {
        
        return true;
      
      }
    }

    return false;
  }

  
  /*
  Purpose: ensureHierarchicalPath is a method that checks if the DroneEnemy has a valid navigation path to the target position 
  and computes a new path if necessary,
  
  Parameters: targetPosition - the position that the DroneEnemy is trying to navigate to, stateTag -
   a tag representing the current state of the FSM,
  */
  ensureHierarchicalPath(targetPosition, stateTag) {
    
    if (!this.hierarchicalPathfinder || !this.patrolMap || !targetPosition) {
      
      return false;
    
    }

    const startTile = this.getCurrentTile();
    const targetTile = this.patrolMap.quantize(targetPosition);

    if (!startTile || !targetTile || !targetTile.isWalkable()) {
      
      return false;
    
    }

    if (!this.shouldRecomputePath(targetPosition, stateTag)) {
      
      return !!this.pathFollower && this.pathFollower.path.size() > 0;
    
    }

    if (this.pathRefreshTimer > 0) {
      
      return !!this.pathFollower && this.pathFollower.path.size() > 0;
    
    }

    const tilePath = this.hierarchicalPathfinder.findPath(startTile, targetTile, this.patrolMap);
    this.pathRefreshTimer = this.pathRefreshInterval;

    if (!tilePath || tilePath.length === 0) {
      
      return false;
    
    }

    const positionPath = new Path({
      
      points: tilePath.map((tile) => this.patrolMap.localize(tile)),
      radius: this.pathFollowThreshold
    
    });

    this.currentPath = tilePath;
    this.currentPathIndex = 0;
    this.pathFollower = { path: positionPath, index: 0 };
    this.pathStateTag = stateTag;
    this.pathTargetPosition = targetPosition.clone();
    this.pathTargetClusterId = this.hierarchicalPathfinder.getClusterIdForTile(targetTile);
    this.pathStartTileKey = this.getTileKey(startTile);
    this.pathTarget = targetPosition.clone();

    return true;
  }

  /*
  Purpose: getHierarchicalPathForce is a method that calculates the steering force for the DroneEnemy to follow its current navigation path,
  allowing it to move towards its target position while navigating around obstacles and other entities in the game world.
  
  Parameters: None
  */
  getHierarchicalPathForce() {
    
    if (!this.pathFollower || this.pathFollower.path.size() === 0) {
      
      return null;
    
    }

    return PathFollowSteering.simple(this, this.pathFollowThreshold);
  }

  
  /*
  Purpose: getActivePeers is a method that returns an array of all active drone peers in the game world,
  excluding the current DroneEnemy instance.
  
  Parameters: world - the game world object containing the drone entities
  */

  getActivePeers(world) {
    
    if (!world || !Array.isArray(world.drones)) {
      
      return [];
    
    }

    return world.drones.filter((drone) => (
      
      drone !== this &&
      drone.mesh.visible &&
      drone.respawnTimer <= 0
    
    ));
  }

  /*
  Purpose: computeAvoidanceSteering is a method that calculates the combined steering force for the DroneEnemy to avoid collisions with other
   entities and obstacles in the game world,allowing it to navigate safely while pursuing its target.
  */
  computeAvoidanceSteering(data) {
    
    const world = data?.world;
    const activePeers = this.getActivePeers(world);

    const separationForce = GroupSteeringBehaviours.separate(
      this,
      activePeers,
      this.separationRadius
    ).multiplyScalar(this.separationWeight);

    const boundsForce = CollisionAvoidSteering.bounds(
      this,
      this.patrolMap,
      this.boundsAvoidLookAhead,
      this.boundsAvoidMargin
    ).multiplyScalar(this.boundsAvoidWeight);

    const wallForce = CollisionAvoidSteering.tileWalls(
      this,
      this.patrolMap,
      this.wallAvoidLookAhead,
      this.wallAvoidProbeOffset
    ).multiplyScalar(this.wallAvoidWeight);

    return separationForce.add(boundsForce).add(wallForce);
  }

  /*
  Purpose: applyBlendedSteering is a method that applies the combined steering forces to the DroneEnemy, allowing it to move towards 
  its target while avoiding collisions.
  
  Parameters: primaryForce - the main steering force for moving towards the target, data - an object containing relevant information 
  about the game world and player that can be used for calculating avoidance forces, primaryWeight - a scalar value that determines
   how much influence the primary steering force has compared to the avoidance forces.
  */
  applyBlendedSteering(primaryForce, data, primaryWeight = this.primarySteeringWeight) {
    
    const combinedForce = new THREE.Vector3();

    if (primaryForce) {
      
      combinedForce.add(primaryForce.clone().multiplyScalar(primaryWeight));
    
    }

    combinedForce.add(this.computeAvoidanceSteering(data));
    this.applyForce(combinedForce);
  }

  /*
  Purpose: createLoadingVisuals is a method that sets up temporary visual elements for the DroneEnemy while its model is loading,
allowing players to see a representation of the enemy in the game world even if the final model has not yet been loaded.

  */
  createLoadingVisuals() {
    
    const tempGeometry = new THREE.BoxGeometry(1.5, 1.5, 1.5);
    const tempMaterial = new THREE.MeshStandardMaterial({
      color: 0xffaa33,
      emissive: 0x442200,
      transparent: true,
      opacity: 0.7
    });
    const tempCube = new THREE.Mesh(tempGeometry, tempMaterial);
    tempCube.position.set(0, 0.75, 0);
    this.mesh.add(tempCube);

    const indicatorGeo = new THREE.ConeGeometry(0.3, 0.8, 8);
    const indicatorMat = new THREE.MeshStandardMaterial({ color: 0xffff00 });
    const indicator = new THREE.Mesh(indicatorGeo, indicatorMat);
    indicator.position.set(0, 1.8, 0);
    indicator.userData = { spinSpeed: 0.1 };
    this.mesh.add(indicator);

    this.loadingIndicator = indicator;
  }

  /*
  Purpose: updateLoadingVisuals is a method that updates the temporary visual elements for the DroneEnemy while its model is loading,
  allowing for dynamic effects such as spinning indicators to enhance the visual feedback during the loading process.
  */
  applyDroneModel(gltf, mixers) {
    
    const model = gltf.scene;
    const currentRotation = this.mesh.rotation.y;

    while (this.mesh.children.length > 0) {
      this.mesh.remove(this.mesh.children[0]);
    }

    model.scale.set(10, 10, 10);
    model.position.set(0, -0.5, 0);

    const box = new THREE.Box3().setFromObject(model);
    model.position.y = -box.min.y;
    model.userData.forwardAxis = 'x';

    this.mesh.add(model);
    this.boatModel = model;
    this.mesh.rotation.y = currentRotation;

    if (gltf.animations && gltf.animations.length > 0) {
      
      const mixer = new THREE.AnimationMixer(model);
      const action = mixer.clipAction(gltf.animations[0]);
      action.play();
      this.mixer = mixer;
      mixers.push(mixer);
    
    }

    this.modelLoaded = true;
    this.boatLoaded = true;
    this.loadError = false;
  }

  /*
  
  Purpose: handleLoadError is a method that handles errors that occur during the loading of the DroneEnemy's model,
  providing visual feedback by changing the color of the loading indicator and setting flags to indicate that the model failed to load.

  */
  handleLoadError() {
    
    if (this.mesh.children[0]) {
      
      this.mesh.children[0].material.color.setHex(0xff0000);
    
    }

    this.modelLoaded = false;
    this.boatLoaded = true;
    this.loadError = true;
  }

  // different state different color for detection circle to help with debugging
 /*
Purpose: setDetectionCircleColor is a method that changes the color and opacity of the DroneEnemy's detection circle,
allowing for visual feedback on the enemy's detection state, which can be useful for debugging and gameplay clarity.
Parameters: hexColor - the hexadecimal color value to set for the detection circle, opacity - a scalar value between 0 and 1 
that determines the transparency of the detection circle.
 */
  setDetectionCircleColor(hexColor, opacity = 0.45) {
  
  const ring = this.detectionCircle || this._pendingDetectionCircle;
  
  if (!ring || !ring.material) return;

  ring.material.color.setHex(hexColor);
  ring.material.opacity = opacity;
  ring.material.needsUpdate = true;
}

/*
Purpose: resetToSpawn is a method that resets the DroneEnemy to its initial spawn position and state,
allowing it to be reused after being defeated or when the player respawns, ensuring that the enemy can continue to provide 
a challenge throughout the game.

Parameters: spawnPosition - the position to which the DroneEnemy should be reset, typically the location of its spawn tile.
*/  
resetToSpawn(spawnPosition) {
    
    this.position.copy(spawnPosition);
    this.position.y = 1;
    this.velocity.set(0, 0, 0);
    this.acceleration.set(0, 0, 0);
    this.mesh.visible = true;
    this.respawnTimer = 0;
    this.lastKnownPlayerPosition = null;
    this.currentPath = [];
    this.currentPathIndex = 0;
    this.pathTarget = null;
    this.stateTag = 'patrol';
    this.clearStateTimers();
    this.wanderAngle = Math.random() * Math.PI * 2;
    this.clearNavigationPath();

    if (this.fsm) {
      
      this.fsm.change(new PatrolState());
    
    }
  }
}

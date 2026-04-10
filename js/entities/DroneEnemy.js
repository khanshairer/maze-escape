import * as THREE from 'three';
import { DynamicEntity } from './DynamicEntity.js';
import { StateMachine } from '../ai/decisions/state-machines/StateMachine.js';
import { PatrolState } from '../ai/decisions/state-machines/PatrolState.js';
import { GroupSteeringBehaviours } from '../ai/steering/GroupSteeringBehaviours.js';
import { CollisionAvoidSteering } from '../ai/steering/CollisionAvoidSteering.js';
import { SteeringBehaviours } from '../ai/steering/SteeringBehaviours.js';

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
    this.respawnTimer = 0;
    this.stateTag = 'patrol';
    this.alertTimer = 0;
    this.searchTimer = 0;
    this.fsm = null;
    this.fsmData = null;

    this.wanderAngle = Math.random() * Math.PI * 2;
    //stronger
    this.wanderDistance = 5.5;
    this.wanderRadius = 3.0;
    this.wanderJitter = 0.9;

    this.patrolSpeed = 3.0;
    this.alertSpeed = 4.5;
    this.chaseSpeed = 6.8;
    this.searchSpeed = 3.8;

    this.primarySteeringWeight = 1;
    this.separationRadius = 2.6;
    this.separationWeight = 0.95;

    this.whiskerLookAhead = 3.2;
    this.whiskerSideLookAhead = 2.4;
    this.whiskerAngle = Math.PI / 6;
    this.wallAvoidWeight = 12.0;

    this.droneAvoidLookAhead = 6.4;
    this.droneAvoidHowFar = 6.2;
    this.droneAvoidWeight = 12.1;

    this.wanderTarget = null;
    this.searchTarget = null;

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
  Purpose: getWanderForce is a method that returns a wandering steering force for the DroneEnemy,
  allowing it to move freely around the Perlin map using SteeringBehaviours.wander.
  
  Parameters: None
  */
  getWanderForce() {
    
    return SteeringBehaviours.wander(this, {
      distance: this.wanderDistance,
      radius: this.wanderRadius,
      jitter: this.wanderJitter
    });
  }

  /*
  Purpose: getSeekForce is a method that returns a direct seek steering force toward a target position.
  
  Parameters: targetPosition - the position that the DroneEnemy should seek.
  */
  getSeekForce(targetPosition) {
    
    if (!targetPosition) {
      
      return new THREE.Vector3();
    
    }

    return SteeringBehaviours.seek(this, targetPosition);
  }

  /*
  Purpose: getPursueForce is a method that returns a pursue steering force toward the predicted future player location.
  
  Parameters: player - the player character that the DroneEnemy is trying to pursue, lookAhead - how far ahead to predict.
  */
  getPursueForce(player, lookAhead = 0.35) {
    
    if (!player) {
      
      return new THREE.Vector3();
    
    }

    return SteeringBehaviours.pursue(this, player, lookAhead);
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
  Purpose: getForwardVector is a method that returns the DroneEnemy's forward direction based on velocity,
  falling back to mesh rotation if velocity is too small.
  
  Parameters: None
  */
  getForwardVector() {
    
    const forward = new THREE.Vector3(this.velocity.x, 0, this.velocity.z);

    if (forward.lengthSq() > 0.0001) {
      forward.normalize();
      return forward;
    }

    const fallback = new THREE.Vector3(0, 0, 1);
    fallback.applyAxisAngle(new THREE.Vector3(0, 1, 0), this.mesh.rotation.y);
    fallback.normalize();
    return fallback;
  }

  /*
  Purpose: rotateVectorY is a helper method that rotates a vector around the Y-axis by the given angle,
  allowing the DroneEnemy to create left and right whisker directions.
  
  Parameters: vec - the vector to rotate, angle - the rotation angle in radians.
  */
  rotateVectorY(vec, angle) {
    
    return vec.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), angle);
  }

  /*
  Purpose: getWallSegments is a method that returns the outer boundary wall segments of the patrol map
  in local map space so whisker collision detection can test against them.
  
  Parameters: None
  */
  getWallSegments() {
    
    if (!this.patrolMap) {
      return [];
    }

    const minX = this.patrolMap.minX;
    const maxX = this.patrolMap.minX + this.patrolMap.cols * this.patrolMap.tileSize;
    const minZ = this.patrolMap.minZ;
    const maxZ = this.patrolMap.minZ + this.patrolMap.rows * this.patrolMap.tileSize;

    return [
      {
        start: new THREE.Vector3(minX, 0, minZ),
        end: new THREE.Vector3(maxX, 0, minZ)
      },
      {
        start: new THREE.Vector3(maxX, 0, minZ),
        end: new THREE.Vector3(maxX, 0, maxZ)
      },
      {
        start: new THREE.Vector3(maxX, 0, maxZ),
        end: new THREE.Vector3(minX, 0, maxZ)
      },
      {
        start: new THREE.Vector3(minX, 0, maxZ),
        end: new THREE.Vector3(minX, 0, minZ)
      }
    ];
  }

  /*
  Purpose: getWhiskerWallAvoidForce is a method that uses forward, left, and right whiskers to proactively detect upcoming wall
  collisions and steer the DroneEnemy away from them before it gets stuck in a corner.
  
  Parameters: data - an object containing world information needed to convert the DroneEnemy to patrolMap local space.
  */
  getWhiskerWallAvoidForce(data) {
    
    const world = data?.world;
    if (!this.patrolMap || !world?.map2Offset) {
      return new THREE.Vector3();
    }

    const localPos = this.position.clone().sub(world.map2Offset);
    const forward = this.getForwardVector();

    const whiskers = [
      {
        key: 'main',
        dir: forward.clone(),
        length: this.whiskerLookAhead
      },
      {
        key: 'left',
        dir: this.rotateVectorY(forward, this.whiskerAngle),
        length: this.whiskerSideLookAhead
      },
      {
        key: 'right',
        dir: this.rotateVectorY(forward, -this.whiskerAngle),
        length: this.whiskerSideLookAhead
      }
    ];

    const wallSegments = this.getWallSegments();

    let strongestForce = new THREE.Vector3();
    let hitSomething = false;

    for (let whisker of whiskers) {
      const whiskerEnd = localPos.clone().add(whisker.dir.clone().multiplyScalar(whisker.length));

      for (let wall of wallSegments) {
        const collisionPoint = CollisionAvoidSteering.getLineLineCollisionPoint(
          localPos,
          whiskerEnd,
          wall.start,
          wall.end
        );

        if (!collisionPoint) {
          continue;
        }

        hitSomething = true;

        const wallDirection = wall.end.clone().sub(wall.start);
        let wallNormal = new THREE.Vector3(-wallDirection.z, 0, wallDirection.x).normalize();

        if (wallNormal.dot(whisker.dir) > 0) {
          wallNormal.multiplyScalar(-1);
        }

        const pushBack = wallNormal.clone().multiplyScalar(this.wallAvoidWeight);

        if (pushBack.lengthSq() > strongestForce.lengthSq()) {
          strongestForce.copy(pushBack);
        }
      }
    }

    if (!hitSomething) {
      return new THREE.Vector3();
    }

    return strongestForce;
  }

  /*
  Purpose: getDroneAvoidForce is a method that uses round collision avoidance against other active drones so the DroneEnemy
  can steer around peers without waiting for a collision overlap.
  
  Parameters: data - an object containing world information needed to access active peers and optional debug visuals.
  */
  getDroneAvoidForce(data) {
    
    const world = data?.world;
    const peers = this.getActivePeers(world);

    let totalForce = new THREE.Vector3();

    for (let peer of peers) {
      const obstacle = {
        position: peer.position.clone(),
        radius: this.separationRadius
      };

      const avoidForce = CollisionAvoidSteering.round(
        this,
        obstacle,
        this.droneAvoidLookAhead,
        this.droneAvoidHowFar,
        null
      );

      totalForce.add(avoidForce);
    }

    return totalForce.multiplyScalar(this.droneAvoidWeight);
  }

  /*
  Purpose: getUnstuckForce is a method that provides a small push away from tile edges or corners when the DroneEnemy
  slows down too much near walls, helping it recover from deadlocks caused by separation and wall avoidance fighting each other.

  Parameters: data - an object containing world information needed to convert the DroneEnemy to patrolMap local space.
  */
  getUnstuckForce(data) {
    
    const world = data?.world;
    if (!this.patrolMap || !world?.map2Offset) {
      return new THREE.Vector3();
    }

    const localPos = this.position.clone().sub(world.map2Offset);
    const tile = this.patrolMap.quantize(localPos);

    if (!tile) {
      return new THREE.Vector3();
    }

    const center = this.patrolMap.localize(tile);
    let force = new THREE.Vector3();

    const edgeThreshold = this.patrolMap.tileSize * 0.28;

    const nearNorth = localPos.z < center.z - edgeThreshold;
    const nearSouth = localPos.z > center.z + edgeThreshold;
    const nearWest = localPos.x < center.x - edgeThreshold;
    const nearEast = localPos.x > center.x + edgeThreshold;

    const speed2D = new THREE.Vector3(this.velocity.x, 0, this.velocity.z).length();

    if (speed2D > 0.25) {
      return force;
    }

    if (nearNorth) force.z += 1;
    if (nearSouth) force.z -= 1;
    if (nearWest) force.x += 1;
    if (nearEast) force.x -= 1;

    if (force.lengthSq() > 0.0001) {
      force.normalize().multiplyScalar((this.maxForce ?? 1) * 1.6);
    }

    return force;
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

    const droneAvoidForce = this.getDroneAvoidForce(data);
    const wallAvoidForce = this.getWhiskerWallAvoidForce(data);

    return separationForce.add(droneAvoidForce).add(wallAvoidForce);
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
    combinedForce.add(this.getUnstuckForce(data));

    if (this.maxForce !== undefined) {
      combinedForce.clampLength(0, this.maxForce * 1.8);
    }

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
    this.stateTag = 'patrol';
    this.clearStateTimers();
    this.wanderAngle = Math.random() * Math.PI * 2;
    this.wanderTarget = null;
    this.searchTarget = null;

    if (this.fsm) {
      
      this.fsm.change(new PatrolState());
    
    }
  }
}
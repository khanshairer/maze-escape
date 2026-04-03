import * as THREE from 'three';
import { DynamicEntity } from './DynamicEntity.js';
import { StateMachine } from '../ai/decisions/state-machines/StateMachine.js';
import { GuardState } from '../ai/decisions/state-machines/GuardState.js';
import { GroupSteeringBehaviours } from '../ai/steering/GroupSteeringBehaviours.js';
import { CollisionAvoidSteering } from '../ai/steering/CollisionAvoidSteering.js';
import { Path } from '../maps/Path.js';
import { PathFollowSteering } from '../ai/steering/PathFollowSteering.js';

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

  initializeFSM(data) {
    this.fsmData = data;
    this.fsm = new StateMachine(this, new GuardState(), data);
  }

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

  clearStateTimers() {
    this.alertTimer = 0;
    this.searchTimer = 0;
  }

  rememberPlayer(position) {
    this.lastKnownPlayerPosition = position.clone();
  }

  getHomePosition() {
    if (!this.patrolMap || !this.homeTile) {
      return this.position.clone();
    }

    return this.patrolMap.localize(this.homeTile);
  }

  canDetectPlayer(player) {
    return this.position.distanceTo(player.position) <= this.detectionRange;
  }

  canChasePlayer(player) {
    return this.position.distanceTo(player.position) <= this.chaseRange;
  }

  setPathfinder(pathfinder) {
    this.hierarchicalPathfinder = pathfinder;
  }

  getCurrentTile() {
    return this.patrolMap ? this.patrolMap.quantize(this.position) : null;
  }

  getTileKey(tile) {
    return tile ? `${tile.row},${tile.col}` : null;
  }

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

  getHierarchicalPathForce() {
    if (!this.pathFollower || this.pathFollower.path.size() === 0) {
      return null;
    }

    return PathFollowSteering.simple(this, this.pathFollowThreshold);
  }

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

  applyBlendedSteering(primaryForce, data, primaryWeight = this.primarySteeringWeight) {
    const combinedForce = new THREE.Vector3();

    if (primaryForce) {
      combinedForce.add(primaryForce.clone().multiplyScalar(primaryWeight));
    }

    combinedForce.add(this.computeAvoidanceSteering(data));
    this.applyForce(combinedForce);
  }

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

  handleLoadError() {
    if (this.mesh.children[0]) {
      this.mesh.children[0].material.color.setHex(0xff0000);
    }

    this.modelLoaded = false;
    this.boatLoaded = true;
    this.loadError = true;
  }

  // different state different color for detection circle to help with debugging
 setDetectionCircleColor(hexColor, opacity = 0.45) {
  const ring = this.detectionCircle || this._pendingDetectionCircle;
  if (!ring || !ring.material) return;

  ring.material.color.setHex(hexColor);
  ring.material.opacity = opacity;
  ring.material.needsUpdate = true;
}

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
      this.fsm.change(new GuardState());
    }
  }
}
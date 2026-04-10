import * as THREE from 'three';
import { State } from './State.js';
import { AlertState } from './AlertState.js';
import { PatrolState } from './PatrolState.js';

export class SearchState extends State {

  enter(entity, data) {
    entity.stateTag = 'search';
    entity.searchTimer = entity.searchDuration;
    entity.topSpeed = 2.5;
    entity.setDetectionCircleColor(0xaa66ff, 0.30);
    entity.searchTarget = null;
  }

  update(entity, data, dt) {
    const player = data?.player;
    if (!player) return;

    if (entity.canDetectPlayer(player)) {
      entity.rememberPlayer(player.position);
      entity.fsm.change(new AlertState());
      return;
    }

    entity.searchTimer -= dt;

    const anchor = entity.lastKnownPlayerPosition;

    if (!anchor) {
      entity.fsm.change(new PatrolState());
      return;
    }

    if (!entity.searchTarget || entity.position.distanceTo(entity.searchTarget) < 1.5) {
      const angle = Math.random() * Math.PI * 2;
      const distance = 2 + Math.random() * 4;

      entity.searchTarget = anchor.clone().add(
        new THREE.Vector3(
          Math.cos(angle) * distance,
          0,
          Math.sin(angle) * distance
        )
      );
    }

    const searchForce = entity.getSeekForce(entity.searchTarget);
    entity.applyBlendedSteering(searchForce, data);

    if (entity.searchTimer <= 0) {
      entity.lastKnownPlayerPosition = null;
      entity.searchTarget = null;
      entity.fsm.change(new PatrolState());
    }
  }

  exit(entity, data) {}
}
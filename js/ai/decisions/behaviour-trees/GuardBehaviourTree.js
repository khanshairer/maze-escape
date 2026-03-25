import * as BT from "./BehaviourTree";
import { SteeringBehaviours } from "../../steering/SteeringBehaviours";

/**
 * Generic in range to intruder node
 * suceeds if the guard is within radius of the player
 */
export class InRangeToIntruder extends BT.Node {
  constructor(guard, player, radius) {
    super();
    this.guard = guard;
    this.player = player;
    this.radius = radius;
  }

  run() {
    if (this.guard.position.distanceTo(this.player.position) < this.radius) {
      return BT.Node.Status.Success;
    }
    return BT.Node.Status.Failure;
  }

}

/**
 * Attack node
 * seeks at high speed
 */
export class Attack extends BT.Node {
  constructor(guard, player) {
    super();
    this.guard = guard;
    this.player = player;
  }

  run() {
    this.guard.topSpeed = 20;
    this.guard.setColor("red");
    let force = SteeringBehaviours.seek(this.guard, this.player);
    this.guard.applyForce(force);
    return BT.Node.Status.Success;
  }
}

/**
 * Chase node
 * pursues at moderate speed
 */
export class Chase extends BT.Node {
  constructor(guard, player) {
    super();
    this.guard = guard;
    this.player = player;
  }

  run() {
    this.guard.topSpeed = 6;
    this.guard.setColor("yellow");
    let force = SteeringBehaviours.pursue(this.guard, this.player, 1);
    this.guard.applyForce(force);
    return BT.Node.Status.Success;
  }
}

/**
 * Patrol
 * wanders at low speed
 */
export class Patrol extends BT.Node {
  constructor(guard) {
    super();
    this.guard = guard;
  }

  run() {
    this.guard.topSpeed = 3;
    this.guard.setColor("lightgreen");
    let force = SteeringBehaviours.wander(this.guard);
    this.guard.applyForce(force);
    return BT.Node.Status.Success;
  }
}

/**
 * Guard Behaviour Tree
 */
export class GuardBehaviourTree extends BT.BehaviourTree {

  constructor(guard, player, chaseDist, attackDist) {
    let root = new BT.Selector();

    let attackSequence = new BT.Sequence([
      new InRangeToIntruder(guard, player, attackDist),
      new Attack(guard, player)
    ]);

    let chaseSequence = new BT.Sequence([
      new InRangeToIntruder(guard, player, chaseDist),
      new Chase(guard, player)
    ]);

    let patrol = new Patrol(guard);

    root.children.push(attackSequence, chaseSequence, patrol);
    
    super(root);
  }


}
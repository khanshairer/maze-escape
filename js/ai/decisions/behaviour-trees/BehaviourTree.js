/**
 * BehaviourTree class manages the root node
 * and it updates the tree
 */
export class BehaviourTree {
  constructor(root) {
    this.root = root;
  }

  update() {
    return this.root.run();
  }
}

/**
 * Base Node class (abstract)
 * Cannot be instantiated
 * Subclasses must implement run
 */
export class Node {

  static Status = Object.freeze({
    Success: Symbol('Success'),
    Failure: Symbol('Failure'),
    Running: Symbol('Running')
  });

  constructor() {
    if (new.target === Node) {
      throw new Error("Cannot instantiate abstract class Node");
    }
  }

  run() {
    throw new Error("run() must be implemented");
  }

}

// COMPOSITE NODE CLASSES

/**
 * Sequence
 * Run children in order
 * Fails upon first failure
 * Returns running if any child is running
 * Succeeds if all children succeed
 */
export class Sequence extends Node {

  constructor(children = []) {
    super();
    this.children = children;
  }

  run() {
    for (let child of this.children) {
      let status = child.run();

      if (status === Node.Status.Failure) return Node.Status.Failure;
      if (status === Node.Status.Running) return Node.Status.Running;
    }
    return Node.Status.Success;
  }

}

/**
 * Selector
 * Run children in order
 * Succeeds on first success
 * Returns running if any child is running
 * Fails if all children fail
 */
export class Selector extends Node {
  constructor(children = []) {
    super();
    this.children = children;
  }

  run() {
    for (let child of this.children) {
      let status = child.run();

      if (status === Node.Status.Success) return Node.Status.Success;
      if (status === Node.Status.Running) return Node.Status.Running;
    }
    return Node.Status.Failure;
  }
}
export class Partition {
  constructor(x, y, width, height) {
    this.x = x;
    this.y = y;
    this.width = width;
    this.height = height;

    this.left = null;
    this.right = null;
  }

  isLeaf() {
    return this.left === null && this.right === null;
  }

  getLeaves() {
    if (this.isLeaf()) {
      return [this];
    }

    let leaves = [];

    if (this.left) {
      leaves.push(...this.left.getLeaves());
    }

    if (this.right) {
      leaves.push(...this.right.getLeaves());
    }

    return leaves;
  }

  split(minSize) {
    let canSplitHorizontally = this.height >= minSize * 2;
    let canSplitVertically = this.width >= minSize * 2;

    if (!canSplitHorizontally && !canSplitVertically) {
      return;
    }

    let splitHorizontal;

    if (canSplitHorizontally && canSplitVertically) {
      splitHorizontal = Math.random() < 0.5;
    } else {
      splitHorizontal = canSplitHorizontally;
    }

    if (splitHorizontal) {
      let split = randomInt(minSize, this.height - minSize);

      this.left = new Partition(
        this.x,
        this.y,
        this.width,
        split
      );

      this.right = new Partition(
        this.x,
        this.y + split,
        this.width,
        this.height - split
      );
    } else {
      let split = randomInt(minSize, this.width - minSize);

      this.left = new Partition(
        this.x,
        this.y,
        split,
        this.height
      );

      this.right = new Partition(
        this.x + split,
        this.y,
        this.width - split,
        this.height
      );
    }

    this.left.split(minSize);
    this.right.split(minSize);
  }
}

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
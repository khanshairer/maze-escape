/*

Partition is a class that represents a rectangular area of the maze and is used for the binary space partitioning (BSP) algorithm to generate 
the maze layout. 

Each Partition instance has properties for its position (x, y) and dimensions (width, height), as well as references to its left and right 
child partitions. 

The split method divides the partition into two smaller partitions either horizontally or vertically based on random choice and 
the minimum size constraint. 

The getLeaves method retrieves all the leaf partitions, which represent the final rooms in the maze after all splits are completed.

*/
export class Partition {
  // Initialize the partition with its position and dimensions, and set child references to null
  constructor(x, y, width, height) {
    this.x = x;
    this.y = y;
    this.width = width;
    this.height = height;

    this.left = null;
    this.right = null;
  }

  // Check if the partition is a leaf node (i.e., it has no child partitions)
  isLeaf() {
    return this.left === null && this.right === null;
  }

  // Retrieve all leaf partitions by recursively checking child partitions and collecting those that are leaves
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

  // Split the partition into two smaller partitions either horizontally or vertically based on random choice and minimum size constraint
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

// Utility function to generate a random integer between min and max (inclusive)
function randomInt(min, max) {

  return Math.floor(Math.random() * (max - min + 1)) + min;

}
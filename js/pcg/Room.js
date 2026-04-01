export class Room {
  constructor(x, y, width, height) {
    this.x = x;
    this.y = y;
    this.width = width;
    this.height = height;
  }

  center() {
    return {
      x: Math.floor(this.x + this.width / 2),
      y: Math.floor(this.y + this.height / 2)
    };
  }
}
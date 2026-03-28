export class Path {
  constructor({ points = [], radius = 2 } = {}) {
    this.points = points;
    this.radius = radius;
  }

  add(point) {
    this.points.push(point);
  }

  get(i) {
    return this.points[i];
  }

  size() {
    return this.points.length;
  }

}

import * as THREE from 'three';

/*

Purpose: The Path class represents a sequence of points that can be used for pathfinding or navigation in the game.
Parameters: The constructor takes an object with the following properties:
  - points: An array of THREE.Vector3 objects representing the points in the path.
  - radius: A number representing the radius around each point that can be considered as "reached" when navigating the path.
The class includes methods for adding points to the path, retrieving a specific point, and getting the total number of points in the path.

*/
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
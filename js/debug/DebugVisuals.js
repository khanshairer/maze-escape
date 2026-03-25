import * as THREE from 'three';
import * as BufferGeometryUtils from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { Line2 } from 'three/examples/jsm/lines/Line2.js';
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js';
import { LineGeometry } from 'three/examples/jsm/lines/LineGeometry.js';



export class DebugVisuals {

  constructor(scene) {
    this.scene = scene;
    this.enabled = true;

    this.colors = [ 'red', 'yellow', 'green', 'cyan', 'blue', 'purple', 'pink' ];
    this.debugObjects =  new Map();
  }

  // Create a debug sphere
  createSphere(key, pos, color, size = 1) {
    let geometry = new THREE.SphereGeometry(size/2);
    let material = new THREE.MeshStandardMaterial({ color: color });
    let mesh = new THREE.Mesh(geometry, material);
    mesh.position.copy(pos);
    mesh.position.y = 0.5;
    mesh.visible = true;
    this.debugObjects.set(key, mesh);
    this.scene.add(mesh);
  }

  // Create an arrow
  createArrow(tile, direction, map, color = 0x000000, scale = 0.6) {

    if (!direction || direction.lengthSq() === 0) return;

    // Normalize direction
    let dir = direction.clone().normalize();

    // Get tile center in world space
    let center = map.localize(tile);
    center.y += 1.2;

    // Arrow length relative to tile size
    let length = map.tileSize * scale;

    // Shift origin backward so arrow is centered
    let origin = center.clone().add(
      dir.clone().multiplyScalar(-length / 2)
    );

    let arrow = new THREE.ArrowHelper(
      dir,
      origin,
      length,
      color,
      length * 0.3,   // head length
      length * 0.25   // head width
    );

    let key = 'tile-'+tile.row+"-"+tile.col;
    this.debugObjects.set(key, arrow);
    this.scene.add(arrow);
  }

  // Create a debug line
  createLine(key, start, end, color, width) {
    const geometry = new LineGeometry();
    geometry.setPositions([
     start.x, 0.5, start.z,
     end.x, 0.5, end.z
    ]);

    let material = new LineMaterial({ 
        color: color,
        linewidth: width,
        worldUnits: true
      });
    let mesh = new Line2(geometry, material);
    mesh.computeLineDistances();
    this.debugObjects.set(key, mesh);
    this.scene.add(mesh);
  }

  // Show line
  showLine(key, start, end, color = 0x000000, width = 0.1) {

    let obj = this.debugObjects.get(key);
    if (!obj) {
      this.createLine(key, start, end, color, width);
      return;
    }

    // Update positions 
    obj.geometry.setPositions([
      start.x, 0.5, start.z,
      end.x,   0.5, end.z
    ]);

    // Update color
    obj.material.color.set(color);
    obj.computeLineDistances();
    obj.visible = true;
  }

  // Show a sphere with reference key at given position
  showSphere(key, pos) {
    console.log(key)
    // if does not exist, create it
    // update its position
    let obj = this.debugObjects.get(key);
    if (!obj) {
      let color = this.colors[this.debugObjects.size%this.colors.length];
      this.createSphere(key, pos, color);
      return;
    }
    obj.position.copy(pos);
    obj.position.y = 0.5;
    obj.visible = true;
  }
  
  // Hide object with key
  hide(key) {
    let obj = this.debugObjects.get(key);
    if (obj) obj.visible = false;
  }

  // Hide multiple objects (list of keys)
  hideObjs(keys) {
    for (let key of keys) {
      this.hide(key);
    }
  }

}
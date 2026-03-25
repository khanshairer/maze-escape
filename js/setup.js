import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// Creates and returns the scene
export function createScene() {
  const scene = new THREE.Scene();  
  scene.background = new THREE.Color('#ffffff');
  return scene;
}

// Creates and returns the camera
export function createCamera() {
  const camera = new THREE.PerspectiveCamera(
    75,
    window.innerWidth / window.innerHeight,
    0.1, 
    1000
  );

  // Move our camera to a position upwards on y
  // then look at the origin
  camera.position.y = 25;
  camera.lookAt(0, 0, 0);
  return camera;
}

// Creates and returns the renderer
export function createRenderer() {
  const renderer = new THREE.WebGLRenderer();
  renderer.setSize(window.innerWidth, window.innerHeight);
  document.body.appendChild(renderer.domElement);
  return renderer;
}

// Creates light and adds it to the scene
export function createLight(scene) {
  const light = new THREE.DirectionalLight(0xffffff, 2);
  light.position.set(0, 5, 5);
  scene.add(light);
  const ambientLight = new THREE.AmbientLight(0xffffff, 2);
  scene.add(ambientLight);
  //added second ambient light to make the scene brighter
  const ambientLight2 = new THREE.AmbientLight(0xffffff, 0.5);
  scene.add(ambientLight2);
}

// Shows axesHelper, gridHelper, and OrbitControls
export function showHelpers(scene, camera, renderer, levelMap) {
  // Include an axes helper to understand our 3D world
  const axesHelper = new THREE.AxesHelper(100);
  scene.add(axesHelper);

  // Add orbit controls
  // Let's us fly around the scene
  const orbitControls = new OrbitControls(camera, renderer.domElement);

  // Add our grid helper so we can see the floor
  const gridHelper = new THREE.GridHelper(levelMap.width, levelMap.depth);
  scene.add(gridHelper);
}

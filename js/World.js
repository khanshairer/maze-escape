import * as THREE from 'three';
import * as Setup from './setup.js';
import { InputHandler } from './input/InputHandler.js';
import { TileMap } from './maps/TileMap.js';
import { TileMapRenderer } from './renderers/TileMapRenderer.js';
import { DynamicEntity } from './entities/DynamicEntity.js';
import { GLTFLoader } from 'three/examples/jsm/Addons.js';

/**
 * World class holds all information about our game's world
 */
export class World {

  // Creates a world instance
  constructor() {
    this.scene = Setup.createScene();
    this.camera = Setup.createCamera();
    this.renderer = Setup.createRenderer();

    this.clock = new THREE.Clock();

    this.inputHandler = new InputHandler(this.camera);

    this.entities = [];

    // added ................
    this.goals = [];
    this.npcs = [];
    this.mixers = [];

    // Main character animation mixer
    this.mainCharacterMixer = null;

    // Add loading tracking
    this.modelsLoading = 0;
    this.modelsLoaded = 0;
    this.loadingComplete = false;
  }

  // Initialize objects in our world
  init() {
    this.map = new TileMap(2);
    Setup.createLight(this.scene);
    Setup.showHelpers(this.scene, this.camera, this.renderer, this.map);

    this.tileMapRenderer = new TileMapRenderer(this.map);
    this.tileMapRenderer.render(this.scene);

    // Create main character on the ground
    this.main_character = new DynamicEntity({
      position: new THREE.Vector3(0, 0, 0),
      velocity: new THREE.Vector3(0, 0, 0),
      color: 0x3333ff,
      scale: new THREE.Vector3(1, 1, 1)
    });

    // ----- Load officer_with_gun model for main character -----
    // Add temporary loading visuals (colored cube + spinning ring)
    const tempCubeGeo = new THREE.BoxGeometry(1.2, 1.2, 1.2);
    const tempCubeMat = new THREE.MeshStandardMaterial({
      color: 0x33aaff,
      emissive: 0x004466,
      transparent: true,
      opacity: 0.8
    });
    const tempCube = new THREE.Mesh(tempCubeGeo, tempCubeMat);
    tempCube.position.set(0, 0.75, 0);
    this.main_character.mesh.add(tempCube);

    const loadingRing = new THREE.Mesh(
      new THREE.TorusGeometry(0.8, 0.1, 16, 32),
      new THREE.MeshStandardMaterial({ color: 0xffff00, emissive: 0x442200 })
    );
    loadingRing.position.set(0, 1.2, 0);
    this.main_character.mesh.add(loadingRing);
    this.main_character.loadingRing = loadingRing;

    const loader = new GLTFLoader();
    loader.load(
      '../public/officer_with_gun/scene.gltf',
      (gltf) => {
        const model = gltf.scene;

        // Remove temporary visuals
        while (this.main_character.mesh.children.length > 0) {
          this.main_character.mesh.remove(this.main_character.mesh.children[0]);
        }

        // Scale and position the model
        model.scale.set(1.8, 1.8, 1.8); // Adjust scale as needed
        model.position.set(0, -0.5, 0);

        // Center vertically (bottom at ground level)
        const box = new THREE.Box3().setFromObject(model);
        model.position.y = -box.min.y;

        // Add model to character's mesh
        this.main_character.mesh.add(model);
        this.main_character.model = model; // store for reference

        // Handle animations if present
        if (gltf.animations && gltf.animations.length > 0) {
          const mixer = new THREE.AnimationMixer(model);
          const action = mixer.clipAction(gltf.animations[0]);
          action.play();
          this.mainCharacterMixer = mixer;
        }

        // Update color (optional)
        this.main_character.color = 0x44aaff;
      },
      undefined, // onProgress (optional)
      (error) => {
        console.error('Error loading officer_with_gun model:', error);
        // Keep temporary cube but make it red to indicate error
        if (this.main_character.mesh.children[0]) {
          this.main_character.mesh.children[0].material.color.setHex(0xff0000);
          this.main_character.mesh.children[0].material.transparent = false;
        }
        if (this.main_character.loadingRing) {
          this.main_character.loadingRing.material.color.setHex(0xff0000);
        }
      }
    );

    // Add main character to world (replace the erroneous npc2 line)
    this.addEntityToWorld(this.main_character);

    // Create ocean wave with animations
    //this.createOceanWave();

    // debug arrow visuals for walkable tiles
    this.createGoals(5);

    // Create NPCs with loading feedback
    this.createNPCs(10);

    // Add loading indicator
    this.createLoadingIndicator();
  }

  // Create a loading indicator in the scene
  createLoadingIndicator() {
    // Create a text sprite or simple indicator
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = 'white';
    ctx.font = 'bold 24px Arial';
    ctx.fillText('Loading boats...', 10, 50);

    const texture = new THREE.CanvasTexture(canvas);
    const material = new THREE.SpriteMaterial({ map: texture });
    this.loadingSprite = new THREE.Sprite(material);
    this.loadingSprite.position.set(0, 5, 0);
    this.loadingSprite.scale.set(5, 2.5, 1);
    this.scene.add(this.loadingSprite);
  }

  // Update loading indicator
  updateLoadingIndicator() {
    if (this.loadingComplete) {
      return;
    }

    const progress = (this.modelsLoaded / this.modelsLoading) * 100;

    // Update canvas text
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = 'white';
    ctx.font = 'bold 24px Arial';
    ctx.fillText(`Loading: ${Math.round(progress)}%`, 10, 50);

    // Draw progress bar
    ctx.fillStyle = '#333';
    ctx.fillRect(10, 70, 200, 20);
    ctx.fillStyle = '#0f0';
    ctx.fillRect(10, 70, 200 * (progress / 100), 20);

    const texture = new THREE.CanvasTexture(canvas);
    this.loadingSprite.material.map = texture;
    this.loadingSprite.material.needsUpdate = true;

    if (
      this.modelsLoaded === this.modelsLoading &&
      this.modelsLoading > 0
    ) {
      this.loadingComplete = true;
      setTimeout(() => {
        this.scene.remove(this.loadingSprite);
      }, 2000);
    }
  }

  // create 5 random goal in the world
  // create goals in the world with pier models
  // create goals in the world with pier models
  createGoals(numGoals = 5) {

    var goalCount = 0;
    var maxAttempts = 1000;
    var attempts = 0;

    // Store pier entities for loading tracking
    this.piers = [];
    this.piersLoading = numGoals;
    this.piersLoaded = 0;

    while (goalCount < numGoals && attempts < maxAttempts) {
      attempts++;

      let randomTile =
        this.map.walkableTiles[
          Math.floor(Math.random() * this.map.walkableTiles.length)
        ];

      if (
        this.goals.some(
          (g) => g.row === randomTile.row && g.col === randomTile.col
        )
      ) {
        continue;
      }

      // Check all 8 adjacent directions for existing goals
      let isAdjacentToGoal = this.goals.some((goal) => {
        let rowDiff = Math.abs(goal.row - randomTile.row);
        let colDiff = Math.abs(goal.col - randomTile.col);

        return (
          rowDiff <= 1 &&
          colDiff <= 1 &&
          !(rowDiff === 0 && colDiff === 0)
        );
      });

      if (!isAdjacentToGoal) {
        // Get position for this goal - this should already be the tile center
        let position = this.map.localize(randomTile);

        // Create a temporary visual marker (colored cube) while pier loads
        const tempGeometry = new THREE.BoxGeometry(1.5, 1.5, 1.5);
        const tempMaterial = new THREE.MeshStandardMaterial({
          color: 0xffdd44,
          emissive: 0x442200,
          transparent: true,
          opacity: 0.8
        });
        const tempMarker = new THREE.Mesh(tempGeometry, tempMaterial);
        tempMarker.position.copy(position);
        tempMarker.position.y = 1; // Lift slightly above ground
        this.scene.add(tempMarker);

        // Load pier model
        const loader = new GLTFLoader();
        loader.load(
          '../public/pier/scene.gltf',
          (gltf) => {

            const model = gltf.scene;

            // Remove temporary marker
            this.scene.remove(tempMarker);

            // First, get the original bounds to center properly
            const box = new THREE.Box3().setFromObject(model);
            const center = new THREE.Vector3();
            box.getCenter(center);
            const size = new THREE.Vector3();
            box.getSize(size);

            // Create a container group to hold the pier
            const pierGroup = new THREE.Group();

            // Add model to group and offset so it's centered
            model.position.copy(center.clone().negate());
            pierGroup.add(model);

            // Scale the group
            pierGroup.scale.set(0.3, 0.5, 0.3);

            // Position the group at the tile center
            pierGroup.position.copy(position);

            // Adjust Y position to sit on ground
            // The bottom of the model should be at ground level
            const scaledHeight = size.y * 0.5;
            pierGroup.position.y = scaledHeight / 2; // Half height above ground

            // Add random rotation for variety
            pierGroup.rotation.y = Math.random() * Math.PI * 2;

            // Add to scene
            this.scene.add(pierGroup);

            // Store reference to the group
            this.piers.push({
              mesh: pierGroup,
              tile: randomTile,
              position: position
            });

            // Add a small debug sphere at the exact tile center to verify alignment
            const debugSphere = new THREE.Mesh(
              new THREE.SphereGeometry(0.2, 8, 8),
              new THREE.MeshBasicMaterial({ color: 0x00ff00 })
            );
            debugSphere.position.copy(position);
            debugSphere.position.y = 0.5;
            this.scene.add(debugSphere);

            // Remove debug sphere after 5 seconds
            setTimeout(() => this.scene.remove(debugSphere), 5000);

            // Track loading progress
            this.piersLoaded++;
          },
          (progress) => {
            // Optional progress
          },
          (error) => {

            // Keep temporary marker as fallback but make it solid
            tempMarker.material.wireframe = false;
            tempMarker.material.color.setHex(0xffaa00);
            tempMarker.material.emissive.setHex(0x332200);
            tempMarker.material.transparent = false;

            // Still store as goal
            this.piers.push({
              mesh: tempMarker,
              tile: randomTile,
              position: position
            });

            this.piersLoaded++;
          }
        );

        // Mark this tile as a goal
        this.goals.push(randomTile);
        goalCount++;
      }
    }
  }

  // create npcs with visual loading feedback
  createNPCs(numNPCs = 10) {

    this.modelsLoading = numNPCs;
    this.modelsLoaded = 0;

    for (let i = 0; i < numNPCs; i++) {
      let randomTile =
        this.map.walkableTiles[
          Math.floor(Math.random() * this.map.walkableTiles.length)
        ];
      let position = this.map.localize(randomTile);

      // Create NPC entity with a temporary loading cube
      let npc = new DynamicEntity({
        position: position,
        velocity: new THREE.Vector3(0, 0, 0),
        color: 0xffaa33, // Orange color for loading
        scale: new THREE.Vector3(1, 1, 1)
      });

      // Set initial rotation to face a random direction
      // This prevents the default cone from facing the wrong way
      npc.mesh.rotation.y = Math.random() * Math.PI * 2;

      // Add a flag to indicate if boat is loaded
      npc.boatLoaded = false;

      // Add a temporary cube that shows it's loading
      const tempGeometry = new THREE.BoxGeometry(1.5, 1.5, 1.5);
      const tempMaterial = new THREE.MeshStandardMaterial({
        color: 0xffaa33,
        emissive: 0x442200,
        transparent: true,
        opacity: 0.7
      });
      const tempCube = new THREE.Mesh(tempGeometry, tempMaterial);
      tempCube.position.set(0, 0.75, 0);
      npc.mesh.add(tempCube);

      // Add a spinning indicator
      const indicatorGeo = new THREE.ConeGeometry(0.3, 0.8, 8);
      const indicatorMat = new THREE.MeshStandardMaterial({
        color: 0xffff00
      });
      const indicator = new THREE.Mesh(indicatorGeo, indicatorMat);
      indicator.position.set(0, 1.8, 0);
      indicator.userData = { spinSpeed: 0.1 };
      npc.mesh.add(indicator);
      npc.loadingIndicator = indicator;

      // Load boat model
      const loader = new GLTFLoader();
      loader.load(
        '../public/animated_drone/scene.gltf', // Updated path
        (gltf) => {

          const model = gltf.scene;
          console.log('Boat model loaded:', gltf.scene);

          // Store position before clearing
          const npcPosition = npc.position.clone();
          // Store current rotation
          const currentRotation = npc.mesh.rotation.y;

          // Remove temporary loading visuals
          while (npc.mesh.children.length > 0) {
            npc.mesh.remove(npc.mesh.children[0]);
          }

          // Scale and position the boat
          model.scale.set(10, 10, 10);
          model.position.set(0, -0.5, 0);

          // Center the boat on ground
          const box = new THREE.Box3().setFromObject(model);
          model.position.y = -box.min.y;

          // Store the forward direction for rotation helper
          // Try different values if the boat faces wrong direction:
          // 'x' for boats facing +X, '-x' for -X, 'z' for +Z, '-z' for -Z
          model.userData.forwardAxis = 'x'; // Try 'x' first for wooden_boat

          // Add the boat model WITHOUT rotating it first
          npc.mesh.add(model);

          // Store reference to the boat model for rotation calculations
          npc.boatModel = model;

          // Mark boat as loaded
          npc.boatLoaded = true;

          // Update color to final color
          npc.color = 0xff3333;

          // Restore the rotation we had
          npc.mesh.rotation.y = currentRotation;

          // Handle animations
          if (gltf.animations && gltf.animations.length > 0) {
            const mixer = new THREE.AnimationMixer(model);
            const action = mixer.clipAction(gltf.animations[0]);
            action.play();
            npc.mixer = mixer;
            this.mixers.push(mixer);
          }

          // Track loading progress
          this.modelsLoaded++;

          // Update loading indicator
          this.updateLoadingIndicator();
        },
        (progress) => {
          // Optional: show per-NPC progress
        },
        (error) => {

          // Make the loading cube red to show error
          if (npc.mesh.children[0]) {
            npc.mesh.children[0].material.color.setHex(0xff0000);
          }

          // Mark as loaded (with error) so it can be considered for movement if needed
          npc.boatLoaded = true;
          npc.loadError = true;

          this.modelsLoaded++;
          this.updateLoadingIndicator();
        }
      );

      this.npcs.push(npc);
      this.addEntityToWorld(npc);
    }
  }

  // Add an entity to the world
  addEntityToWorld(entity) {
    this.scene.add(entity.mesh);
    this.entities.push(entity);
  }

  // Update our world
  update() {
    let dt = this.clock.getDelta();

    // Update main character animation mixer if present
    if (this.mainCharacterMixer) {
      this.mainCharacterMixer.update(dt);
    }

    // Update animation mixers for loaded boats
    for (let mixer of this.mixers) {
      mixer.update(dt);
    }

    // Update custom ocean wave animation if it exists
    
    // Update all entities
    for (let e of this.entities) {
      if (e.update) {
        e.update(dt, this.map);
      }
    }
  }

  // Render our world
  render() {
    this.renderer.render(this.scene, this.camera);
  }
}
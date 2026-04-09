import * as THREE from 'three';

export class LoadingManager {
  constructor(world) {
    this.world = world;
  }

  // Create a loading indicator in the scene
  /*
Purpose: createLoadingIndicator is a method that creates a visual loading indicator in the 3D scene to inform the player about the progress of loading 3D models 
for the drone enemies in the second maze (map2).
 
Parameters: This method does not take any parameters. It creates a canvas element, draws text and a progress bar on it, 
and then uses that canvas as a texture for a sprite that is added to the scene.
*/

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
    this.world.loadingSprite = new THREE.Sprite(material);
    this.world.loadingSprite.position.set(0, 5, 0);
    this.world.loadingSprite.scale.set(5, 2.5, 1);
    this.world.scene.add(this.world.loadingSprite);
  }

  // Update loading indicator
  /*
Purpose: updateLoadingIndicator is a method that updates the loading indicator displayed in the scene based on the progress of loading 3D models for the drone enemies.
 Parameters: This method does not take any parameters. It calculates the loading progress as a percentage based on the number of models loaded versus the total number of models to load, and updates the canvas texture of the loading sprite accordingly. Once all models are loaded.
  */
  updateLoadingIndicator() {
  
  if (this.world.loadingComplete) {
    return;
  }

  if (!this.world.loadingSprite) {
    return;
  }
  
  const progress = this.world.modelsLoading > 0
    ? (this.world.modelsLoaded / this.world.modelsLoading) * 100
    : 0;

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
  this.world.loadingSprite.material.map = texture;
  this.world.loadingSprite.material.needsUpdate = true;

  if (
    this.world.modelsLoaded >= this.world.modelsLoading &&
    this.world.modelsLoading > 0
  ) {
    this.world.loadingComplete = true;
    setTimeout(() => {
      if (this.world.loadingSprite && this.world.loadingSprite.parent) {
        this.world.scene.remove(this.world.loadingSprite);
      }
      this.world.loadingSprite = null;
    }, 2000);
  }
}
}
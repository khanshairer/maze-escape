import * as THREE from 'three';

/*
  Purpose: The EnergyCell class represents a collectible item in the game that the player can interact with.
  Each energy cell has a position, a visual representation (mesh), and a state indicating whether it has been collected.
  The class includes methods for creating the mesh, updating its animation, and handling the collection logic when the player interacts with it.
  
  Parameters: The constructor takes an object with the following properties:
    - tile: The tile where the energy cell is located.
    - position: The 3D position of the energy cell.
    - map: The game map.
    - offset: An optional offset for the energy cell's position.
*/
export class EnergyCell {
  
  constructor({
    tile,
    position,
    map,
    offset = new THREE.Vector3()
  }) {
    
    this.tile = tile;
    this.map = map;
    this.offset = offset.clone();
    this.position = position.clone();
    this.collected = false;
    this.animationTime = Math.random() * 10;

    this.mesh = this.createMesh();
    this.mesh.position.copy(this.position);
  }

  /*
  Purpose: createMesh is a method that constructs the visual representation of the energy cell using Three.js.
  It creates a group containing a golden core and a rotating golden ring

  Parameters: None. The method uses predefined geometries and materials to create the mesh
  */
  createMesh() {
    
    const group = new THREE.Group();

    // Golden core
    const core = new THREE.Mesh(
      
      new THREE.OctahedronGeometry(0.45, 0),
      new THREE.MeshStandardMaterial({
        color: 0xffaa44,           // bright gold
        emissive: 0xaa5511,        // warm orange-gold glow
        emissiveIntensity: 1.2
      
      })
    );
    core.position.y = 1.1;
    group.add(core);

    // Golden ring
    const ring = new THREE.Mesh(
      
      new THREE.TorusGeometry(0.7, 0.08, 12, 24),
      new THREE.MeshStandardMaterial({
        color: 0xffcc66,           // lighter gold
        emissive: 0xcc8822,        // deeper gold emission
        emissiveIntensity: 0.9
      
      })
    );
    
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 1.1;
    group.add(ring);

    group.userData = {
      bobOffset: Math.random() * Math.PI * 2,
      core,
      ring
    };

    return group;
  }

  /*
  
  Purpose: update is a method that is called on each frame to animate the energy cell. 
  It handles the bobbing motion and rotation of the ring to create a dynamic visual effect. 
  If the energy cell has been collected or is not visible, the method returns early without updating the animation.
  
  */
  update(dt) {
    
    if (this.collected || !this.mesh.visible) {
      
      return;
    
    }

    this.animationTime += dt;

    const { core, ring, bobOffset } = this.mesh.userData;
    const bob = Math.sin(this.animationTime * 2.5 + bobOffset) * 0.15;

    core.position.y = 1.1 + bob;
    ring.position.y = 1.1 + bob;
    ring.rotation.z += 0.03;
  
  }

  // collect is a method that is called when the player interacts with the energy cell to collect it.
  // It sets the collected state to true and makes the mesh invisible to indicate that the energy cell has been collected.
  collect() {
    
    this.collected = true;
    this.mesh.visible = false;
  
  }
}
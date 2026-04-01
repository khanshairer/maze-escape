import * as THREE from 'three';

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

  createMesh() {
    const group = new THREE.Group();

    const core = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.45, 0),
      new THREE.MeshStandardMaterial({
        color: 0x7fffd4,
        emissive: 0x1b8a6b,
        emissiveIntensity: 1.4
      })
    );
    core.position.y = 1.1;
    group.add(core);

    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(0.7, 0.08, 12, 24),
      new THREE.MeshStandardMaterial({
        color: 0xb8fff1,
        emissive: 0x2d9c85,
        emissiveIntensity: 1.1
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

  collect() {
    this.collected = true;
    this.mesh.visible = false;
  }
}

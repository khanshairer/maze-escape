import * as THREE from 'three';

/**
 * Input handler handles WASD user input
 */
export class InputHandler {

    constructor(camera) {

        this.camera = camera;

        // Track which WASD keys are pressed
        this.keys = { w: false, a: false, s: false, d: false, space: false };

        // Listen for key down events and mark keys as pressed
        window.addEventListener('keydown', (e) => {
            let key = e.key.toLowerCase();

            if (e.code === 'Space')
                this.keys.space = true;
            else if (key in this.keys)
                this.keys[key] = true;
        });

        // Listen for key up events and mark keys as not pressed
        window.addEventListener('keyup', (e) => {
            let key = e.key.toLowerCase();

            if (e.code === 'Space')
                this.keys.space = false;
            else if (key in this.keys)
                this.keys[key] = false;
        });
    
    }

    // Returns a force vector based on pressed keys and camera direction
    /*
    Purpose: getForce is a method that calculates a movement force vector based on the currently pressed WASD keys 
    and the direction the camera is facing. It first checks which movement keys are pressed to determine the intended direction of movement, then it calculates the camera's forward direction and applies the camera's rotation to the movement vector. Finally, it scales the force vector by a given strength value before returning it.
    
    Parameters: strength - a scalar value that determines how strong the resulting force vector should be.
    */
    getForce(strength) {
        let force = new THREE.Vector3();

        // WASD for forward/back/left/right movement
        if (this.keys.w) force.z += 1;
        if (this.keys.s) force.z -= 1;
        if (this.keys.a) force.x += 1;
        if (this.keys.d) force.x -= 1;

        // Only process if there is input
        if (force.length() > 0) {

            // Get the direction the camera is facing
            let cameraDirection = new THREE.Vector3();
            this.camera.getWorldDirection(cameraDirection);
            cameraDirection.y = 0;

            // Calculate camera rotation angle and apply it to the force
            let cameraAngle = Math.atan2(cameraDirection.x, cameraDirection.z);
            force.applyAxisAngle(new THREE.Vector3(0,1,0), cameraAngle);

            // Set force to strength argument
            force.setLength(strength);
        }

        return force;
    }

}
import * as THREE from "three";
import { Dijkstra } from './Dijkstra.js';

export class VectorPathFinding {
    constructor(map, npcs, scene, debugVisuals) {
        this.path = [];
        this.debugVisuals = debugVisuals;
        this.map = map;
        this.npcs = npcs;
        this.scene = scene;
        this.Pathfinder = new Dijkstra();
    }

    // get the path
    shortestPathCost(start, end) {
        let path = this.Pathfinder.findPath(start, end, this.map);
        if (path.length === 0) {
            return Infinity;
        }
        return this.Pathfinder.totalCost(path);
    }

    // build the uniform cost field for one given goal
    buildCostField(goal) {
        if (!goal) return;

        // Reset all tiles
        for (let row of this.map.grid) {
            for (let tile of row) {
                tile.pathCost = Infinity;
            }
        }

        // Single-source Dijkstra
        let open = [];
        goal.pathCost = 0;
        open.push(goal);

        while (open.length > 0) {
            open.sort((a, b) => a.pathCost - b.pathCost);
            let current = open.shift();

            let neighbours = this.map.getNeighbours(current);

            for (let neighbor of neighbours) {
                let newCost = current.pathCost + neighbor.cost;

                if (newCost < neighbor.pathCost) {
                    neighbor.pathCost = newCost;
                    open.push(neighbor);
                }
            }
        }
    }

    isGoal(tile, goal) {
        if (!goal) return false;
        return tile.row === goal.row && tile.col === goal.col;
    }

    allTileArrows(goal) {
        for (let row of this.map.grid) {
            for (let tile of row) {
                if (!tile.isWalkable()) {
                    continue;
                }

                if (this.isGoal(tile, goal)) {
                    tile.flowVector.set(0, 0, 0);
                    continue;
                }

                let direction = this.lowerCostNeighborDirection(tile, this.map);
                tile.flowVector.copy(direction);

                if (direction.lengthSq() > 0) {
                    this.drawArrow(tile, direction);
                }
            }
        }
    }

    bestNeighbor(center, map) {
        let neighbours = map.getNeighbours(center);
        let bestNeighbor = null;
        let lowestCost = center.pathCost;

        for (let neighbor of neighbours) {
            if (neighbor.pathCost < lowestCost) {
                lowestCost = neighbor.pathCost;
                bestNeighbor = neighbor;
            }
        }

        return bestNeighbor;
    }

    // return the downhill direction for flow field
    lowerCostNeighborDirection(center, map) {
        let neighbours = map.getNeighbours(center);
        let sum = new THREE.Vector3(0, 0, 0);
        let validNeighborsCount = 0;

        let lowestNeighbor = null;
        let lowestCost = center.pathCost;

        for (let neighbor of neighbours) {
            // Skip non-walkable neighbors
            if (!neighbor.isWalkable()) {
                continue;
            }

            validNeighborsCount++;

            let delta = center.pathCost - neighbor.pathCost;

            // Track the lowest cost neighbor
            if (neighbor.pathCost < lowestCost) {
                lowestCost = neighbor.pathCost;
                lowestNeighbor = neighbor;
            }

            // Only consider neighbors with LOWER cost (downhill)
            if (delta > 0) {
                let dx = neighbor.col - center.col;
                let dz = neighbor.row - center.row;

                // For diagonal neighbors, we need to account for sqrt(2) distance
                // But for flow field, we want the vector to point exactly to the neighbor tile center
                let dir = new THREE.Vector3(dx, 0, dz);

                // we want the vector to point exactly to the neighbor
                // This ensures the arrow points directly to the next tile center

                sum.add(dir.multiplyScalar(delta));
            }
        }

        // Return the weighted direction
        if (sum.lengthSq() > 0) {
            // keep the vector pointing to the actual tile center
            // This ensures the arrow points exactly to the next tile
            return sum;
        }

        // Fallback to steepest descent
        if (lowestNeighbor && lowestCost < center.pathCost) {
            let dx = lowestNeighbor.col - center.col;
            let dz = lowestNeighbor.row - center.row;
            return new THREE.Vector3(dx, 0, dz);
        }

        return new THREE.Vector3(0, 0, 0);
    }

    // Make boats follow the flow field arrows EXACTLY
    runVectorFieldPathFinding(goal) {
        let speed = 3.5;

        for (let npc of this.npcs) {
            // ONLY move boats that have finished loading
            if (!npc.boatLoaded) {
                // Still loading - just spin the indicator
                if (npc.loadingIndicator) {
                    npc.loadingIndicator.rotation.y += 0.1;
                }
                continue;
            }

            let currentTile = this.map.quantize(npc.position);

            // Safety check
            if (!currentTile || !currentTile.isWalkable()) {
                continue;
            }

            if (this.isGoal(currentTile, goal)) {
                npc.velocity.set(0, 0, 0);
                continue;
            }

            // Get the flow vector from the tile (this points to the next tile center)
            let flowVector = currentTile.flowVector.clone();

            if (flowVector.lengthSq() > 0.001) {
                // Calculate the target position (center of the next tile)
                let targetCol = currentTile.col + flowVector.x;
                let targetRow = currentTile.row + flowVector.z;

                // Create a target tile reference
                let targetTile = this.map.grid[targetRow]?.[targetCol];

                if (targetTile && targetTile.isWalkable()) {
                    // Get the world position of the target tile center
                    let targetPos = this.map.localize(targetTile);

                    // Calculate direction to target tile center
                    let dirToTarget = targetPos.clone().sub(npc.position);

                    // If close to the target, move directly to it
                    let distanceToTarget = dirToTarget.length();

                    if (distanceToTarget < 0.1) {
                        // We're at the target - get next flow vector
                        npc.velocity.set(0, 0, 0);
                    } else {
                        // Move toward target tile center
                        let dir = dirToTarget.clone().normalize();

                        // Don't overshoot the target
                        let moveSpeed = Math.min(speed, distanceToTarget);
                        npc.velocity.copy(dir.multiplyScalar(moveSpeed));

                        // Calculate rotation angle from velocity
                        let angle = Math.atan2(npc.velocity.x, npc.velocity.z);

                        // Smooth rotation
                        let currentAngle = npc.mesh.rotation.y;
                        let angleDiff = angle - currentAngle;

                        while (angleDiff > Math.PI) {
                            angleDiff -= Math.PI * 2;
                        }
                        while (angleDiff < -Math.PI) {
                            angleDiff += Math.PI * 2;
                        }

                        npc.mesh.rotation.y += angleDiff * 0.1;
                    }
                } else {
                    // Target tile not walkable - find best neighbor
                    let bestNeighbor = this.bestNeighbor(currentTile, this.map);
                    if (bestNeighbor) {
                        let targetPos = this.map.localize(bestNeighbor);
                        let newDir = targetPos.clone().sub(npc.position).normalize();
                        npc.velocity.copy(newDir.multiplyScalar(speed * 0.5));
                    } else {
                        npc.velocity.set(0, 0, 0);
                    }
                }
            } else {
                // No flow direction - stop
                npc.velocity.set(0, 0, 0);
            }
        }
    }

    // Update the arrow drawing to show exact paths
    drawArrow(tile, direction, color = 0x00FF00, length = 0.6) {
        // Don't normalize - draw arrow pointing exactly to next tile center
        let arrow = this.debugVisuals.createArrow(
            tile,
            direction,
            this.map,
            color,
            length
        );

        if (!arrow) {
            return;
        }
        this.scene.add(arrow);
    }
}
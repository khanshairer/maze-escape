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
                    //this.drawArrow(tile, direction);
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

    // Return a one-tile downhill direction so the stored flow field and
    // the follow logic both speak the same language.
    lowerCostNeighborDirection(center, map) {
        const bestNeighbor = this.bestNeighbor(center, map);

        if (bestNeighbor && bestNeighbor.pathCost < center.pathCost) {
            const dx = bestNeighbor.col - center.col;
            const dz = bestNeighbor.row - center.row;
            return new THREE.Vector3(dx, 0, dz);
        }

        return new THREE.Vector3(0, 0, 0);
    }

    getFlowTargetTile(currentTile) {
        if (!currentTile) {
            return null;
        }

        const flowVector = currentTile.flowVector;
        const targetRow = currentTile.row + flowVector.z;
        const targetCol = currentTile.col + flowVector.x;
        const targetTile = this.map.grid[targetRow]?.[targetCol];

        if (targetTile && targetTile.isWalkable()) {
            return targetTile;
        }

        const bestNeighbor = this.bestNeighbor(currentTile, this.map);
        if (bestNeighbor && bestNeighbor.pathCost < currentTile.pathCost) {
            return bestNeighbor;
        }

        return null;
    }

    // Move each attacker toward the next downhill tile selected by the flow field.
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

            const targetTile = this.getFlowTargetTile(currentTile);

            if (targetTile) {
                const targetPos = this.map.localize(targetTile);
                const dirToTarget = targetPos.clone().sub(npc.position);
                const distanceToTarget = dirToTarget.length();

                if (distanceToTarget < 0.1) {
                    npc.velocity.set(0, 0, 0);
                } else {
                    const dir = dirToTarget.clone().normalize();
                    const moveSpeed = Math.min(speed, distanceToTarget);
                    npc.velocity.copy(dir.multiplyScalar(moveSpeed));

                    let angle = Math.atan2(npc.velocity.x, npc.velocity.z);
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

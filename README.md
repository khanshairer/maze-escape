# Project Title
Maze Escape AI System

This project demonstrates AI techniques including FSM, steering behaviors, hierarchical pathfinding, and flow-field navigation in a three.js game.

Short description:
Maze Escape AI System is a small three.js game where the player moves through two maze areas and a dungeon while avoiding different enemy types. The project focuses on AI for Games course topics like steering, FSMs, pathfinding, and procedural generation.

---

# How to Run
- Install dependencies: `npm install`
- Run the Vite dev server: `npm exec vite`
- Open the local URL shown in the terminal
- Build for production if needed: `npm exec vite build`

---

# Controls
- `W` / `A` / `S` / `D` = move the player
- `Space` = jump
- `R` = restart after game over or win

---

# Final Project Requirements Mapping

## 1. Complex Movement Algorithms
I implemented steering-based movement for multiple enemies.

- Drone steering uses wander, arrive, seek, separation, and collision avoidance
- Dungeon guard uses Reynolds path following while patrolling and pursue while chasing
- Player movement also uses steering-style force application instead of instant position changes

Code locations:
- `js/entities/DroneEnemy.js`
- `js/entities/DungeonGuard.js`
- `js/entities/GroundAttacker.js`
- `js/ai/steering/SteeringBehaviours.js`
- `js/ai/steering/GroupSteeringBehaviours.js`
- `js/ai/steering/CollisionAvoidSteering.js`
- `js/ai/steering/ReynoldsPathFollowing.js`

How to observe it in game:
- Drones patrol, spread out, avoid walls, and then chase the player
- The dungeon guard follows a patrol loop smoothly and switches to chase when the player gets close
- Ground attackers follow the flow-field movement toward the goal

## 2. Decision Making
The main decision-making system is a finite state machine for the drone enemies.

States used:
- `Patrol`
- `Alert`
- `Chase`
- `Search`
- `Return`

Code locations:
- `js/ai/decisions/state-machines/StateMachine.js`
- `js/ai/decisions/state-machines/State.js`
- `js/ai/decisions/state-machines/DroneStates.js`
- `js/entities/DroneEnemy.js`

How to see it in gameplay:
- Drones wander around their home area first
- When the player is detected, they pause briefly in alert state
- After that, they chase the player
- If the player escapes, they search the last known area and then return to patrol

## 3. Pathfinding
This project uses multiple pathfinding approaches.

Algorithms used:
- Hierarchical A* for drone navigation
- JPS for generating the dungeon guard patrol loop
- Flow field pathfinding for ground attackers

Code locations:
- `js/ai/pathfinding/HierarchicalAStar.js`
- `js/ai/pathfinding/ClusterGraph.js`
- `js/ai/pathfinding/JPS.js`
- `js/ai/pathfinding/vectorPathFinding.js`
- `js/ai/pathfinding/Dijkstra.js`
- `js/World.js`

How they affect gameplay:
- Drones use hierarchical pathfinding when chasing and returning home
- The dungeon guard patrol path is built from JPS path segments inside the dungeon
- Ground attackers move using a flow field toward the maze goal

## 4. Procedural Content Generation (PCG)
The game world is procedurally generated instead of using one fixed hand-made level.
The environment is not static — each run generates a new layout using procedural generation.

What is generated:
- The maze tile maps are generated in `TileMap`
- The dungeon area is generated with a dungeon generator using partitions, rooms, and corridors

Code locations:
- `js/maps/TileMap.js`
- `js/pcg/DungeonGenerator.js`
- `js/pcg/Partition.js`
- `js/pcg/Room.js`

How it affects gameplay:
- The player goes through generated maze space first
- The final dungeon layout is generated with rooms and corridors
- Enemy positions and collectible positions are placed into those generated spaces

## 5. Additional Topic
The additional topic used in this project is Flow-Field Navigation.
This is implemented as a grid-based vector field that guides ground enemies toward a goal using precomputed directions.

Why I chose this:
- It is clearly different from the FSM and HPA* systems
- It drives a different enemy type with a different movement style

Code locations:
- `js/ai/pathfinding/vectorPathFinding.js`
- `js/entities/GroundAttacker.js`
- `js/World.js`

How it appears in game:
- The ground enemies in the first maze use the generated flow field to move toward the door goal
- They keep respawning and continue following the field, so this behavior is easy to observe

---

# Architecture Overview

- `World.js` handles world-level setup and orchestration
- `js/entities` contains actor-specific behavior
- `js/ai/decisions` contains decision systems like the FSM
- `js/ai/steering` contains steering behaviors
- `js/ai/pathfinding` contains the different pathfinding systems

In the current structure:
- `js/World.js` sets up maps, entities, pathfinding systems, collectibles, and the update loop
- `js/entities/DroneEnemy.js` owns drone logic
- `js/entities/GroundAttacker.js` owns ground-attacker logic
- `js/entities/DungeonGuard.js` owns dungeon-guard logic

---

# Key Files Guide (VERY IMPORTANT)

- `js/World.js` → world setup, spawning, orchestration, collectibles, and update coordination
- `js/gameLogic/game.js` → game over, win condition, restart flow
- `js/entities/DroneEnemy.js` → drone behavior, FSM integration, path use
- `js/entities/GroundAttacker.js` → ground enemy setup, respawn, path-follow cleanup
- `js/entities/DungeonGuard.js` → dungeon guard patrol and chase logic
- `js/entities/EnergyCell.js` → collectible energy cells
- `js/entities/DynamicEntity.js` → base moving-entity behavior
- `js/ai/decisions/state-machines/StateMachine.js` → generic FSM class
- `js/ai/decisions/state-machines/DroneStates.js` → drone states and transitions
- `js/ai/steering/SteeringBehaviours.js` → seek, flee, pursue, arrive, wander
- `js/ai/steering/GroupSteeringBehaviours.js` → separation
- `js/ai/steering/CollisionAvoidSteering.js` → collision and wall avoidance
- `js/ai/steering/ReynoldsPathFollowing.js` → loop patrol following
- `js/ai/pathfinding/HierarchicalAStar.js` → hierarchical pathfinding
- `js/ai/pathfinding/ClusterGraph.js` → cluster abstraction for HPA*
- `js/ai/pathfinding/JPS.js` → jump point search
- `js/ai/pathfinding/vectorPathFinding.js` → flow-field pathfinding logic
- `js/maps/TileMap.js` → maze grid generation and collision handling
- `js/maps/Tile.js` → tile types and terrain data
- `js/pcg/DungeonGenerator.js` → dungeon room and corridor generation
- `js/pcg/Partition.js` → dungeon partition splitting
- `js/pcg/Room.js` → room representation

---

# Creative Additions

- Multiple enemy types with different behaviors
- Energy cell collection system
- Controller room unlock system based on collecting 50% of energy cells, rounded up
- Two maze spaces plus a final dungeon area
- Win and game-over overlays
- Animated 3D models and patrol/chase behavior

---

# Notes

- The easiest systems to observe quickly are the drones, the dungeon guard, and the ground attackers in the first maze
- The controller exit only unlocks after enough energy cells are collected
- Ground attackers, drones, and the dungeon guard all use different AI combinations, so the project mixes several course topics in one game
- There are some older helper files still in the repo, but the main gameplay flow is centered around `World.js`, the entity classes, and the AI folders

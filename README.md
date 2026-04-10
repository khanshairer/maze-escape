# Project Title
Robot Maze Escape AI System

Robot Maze Escape is a three-stage AI game built with three.js. The player crosses two procedurally generated mazes and a final dungeon while the project demonstrates steering, finite state machines, hierarchical pathfinding, Jump Point Search, flow-field navigation, and procedural content generation.

---

# YouTube Demo Video

- Link: [https://youtu.be/m4wiBuLuVY8]
  The video shows the full gameplay flow, including maze navigation, enemy behavior, energy-cell collection, and the final controller room objective.

---

# How to Run
1. Install dependencies:
   ```bash
   npm install
   ```
2. Start the Vite development server:
   ```bash
   npx vite
   ```
3. Open the local browser URL shown in the terminal.

---

# Controls
- `W`, `A`, `S`, `D` move the player relative to the camera.
- `Space` jumps.
- `R` restarts after a loss or a win.

---

# How to Play

Move through the world with `W`, `A`, `S`, and `D`. Movement is relative to the camera, so the player moves in the direction the camera is facing. Press `Space` to jump when you need extra movement control.

The main objective is to collect energy cells, unlock the controller room, and escape through the final exit. The controller room unlocks after collecting 80% of the spawned energy cells, so the player needs to explore the world instead of rushing straight to the end.

In Maze 1, the ground attackers follow a shared flow field toward the exit corridor. They create continuous pressure by moving toward the same goal area, and the player must avoid contact with them.

In Maze 2, drones use a finite state machine: patrol, alert, chase, search, and return. Green safe tiles prevent drone detection and interrupt ongoing alert or chase behavior. Green tiles are visually distinct in the maze and indicate safe zones where drones cannot detect or chase the player. When the player leaves a safe tile, the drones resume normal detection behavior.

The drone visual system helps show the current state. Blue/cyan means patrol, yellow/orange means alert or search, red means chase and danger, and white/cyan means return. The detection circle color is tied to the active FSM state.

In the dungeon, the guard patrols a loop using Reynolds Path Following and can chase the player when the player gets too close. The final goal is to reach the controller room exit after it has been unlocked.

---

# Project Overview

The game is structured as a progression through three connected spaces: Maze 1, Maze 2, and a final dungeon that contains the controller room exit. The player starts in the first maze, crosses into the second maze, then reaches the dungeon and escapes only after enough energy cells have been collected.

The main objective is to collect energy cells and unlock the controller room exit. The current implementation requires **80% of all spawned energy cells** before the controller room can be activated. This value is set in `js/World.js` through `unlockRequirementFraction = 0.8`. This higher threshold was chosen to force real exploration across all three spaces instead of letting the player skip most of the level and rush the ending.

Each area uses different AI to create different gameplay pressure:
- Maze 1 uses ground attackers that follow a flow field toward the exit corridor, creating constant pressure and crowd movement.
- Maze 2 uses drones with a class-based FSM and hierarchical pathfinding so they patrol, detect, chase, search, and return.
- The dungeon uses a guard that patrols a loop with Reynolds Path Following and uses Jump Point Search to build that patrol route efficiently.

This gives each zone a different AI identity instead of repeating the same enemy logic across the whole game.

---

# Course Requirement Mapping

## 1. Complex Movement Algorithms

### Reynolds Path Following

**What:**  
This is the movement system used by the dungeon guard when it is not directly chasing the player. It predicts a future position, projects that point onto the current path segment, checks deviation from the path, and steers toward a point ahead on the loop.

**Where:**  
- `js/ai/steering/ReynoldsPathFollowing.js`
- `js/entities/DungeonGuard.js`

**How to observe:**  
Reach the dungeon and watch the guard patrol around the room loop. The guard follows a continuous loop smoothly rather than snapping from waypoint to waypoint.

**Why used:**  
Reynolds Path Following matches the course material well for smooth patrol behavior. It was a better fit than simple waypoint seeking because the guard needed to move continuously around a looped patrol route and still look stable when turning corners.

### Collision Avoidance / Steering

**What:**  
The drones combine a primary movement force with separation, map-bounds avoidance, and wall avoidance. Ground attackers also use short-range forward avoidance to reduce clustering collisions.

**Where:**  
- `js/ai/steering/CollisionAvoidSteering.js`
- `js/ai/steering/GroupSteeringBehaviours.js`
- `js/ai/steering/SteeringBehaviours.js`
- `js/entities/DroneEnemy.js`
- `js/entities/GroundAttackers.js`

**How to observe:**  
In Maze 2, drones avoid piling directly into each other while they patrol or chase. In Maze 1, ground attackers still follow the flow field, but they also apply local push forces when another attacker is directly in front.

**Why used:**  
The game has multiple active agents in narrow grid spaces. Steering-based avoidance keeps movement readable and prevents the enemies from feeling stuck or artificial.

---

## 2. Decision Making (FSM)

The drones now use one clear runtime FSM:

`Patrol -> Alert -> Chase -> Search -> Return`

**Where:**  
- `js/ai/decisions/state-machines/DroneStates.js`
- `js/ai/decisions/state-machines/State.js`
- `js/ai/decisions/state-machines/StateMachine.js`
- `js/entities/DroneEnemy.js`
- `js/gameLogic/game.js`

**How transitions work:**  
- `PatrolState`: the drone wanders around its home area. It only detects the player when the player is not on a safe tile.
- `AlertState`: when the player is detected, the drone briefly pauses and prepares to engage. If the player reaches a safe tile, it returns to patrol.
- `ChaseState`: the drone actively pursues the player and becomes dangerous. If the player reaches a safe tile, the chase is interrupted and the drone returns to patrol.
- `SearchState`: if the player is lost, the drone moves toward the last known player position and searches for a short time. Search does not reacquire the player while the player is on a safe tile.
- `ReturnState`: if search fails, the drone heads back home and resumes patrol. Return can reacquire the player only when the player is not on a safe tile.

The active runtime initialization and reset are handled in `js/entities/DroneEnemy.js`, which now starts drones in `PatrolState` and resets them back to `PatrolState` as well. `js/gameLogic/game.js` also treats drones as dangerous only in `ChaseState`, which keeps the runtime behavior consistent with the FSM story.

Drones are only considered dangerous during `ChaseState`, which ensures gameplay behavior matches the FSM design clearly.

The active FSM also drives the drone visual state through `setDetectionCircleColor()` in `js/entities/DroneEnemy.js`: patrol uses blue/cyan, alert uses orange/yellow, chase uses red, search uses a dimmer yellow, and return uses a dimmer cyan/white state.

**How to observe:**  
In Maze 2, approach a drone to trigger detection. It will move from patrol into alert, then chase. If you break distance, it transitions into search and then eventually returns to its patrol area. Standing on a safe tile stops drone detection or interrupts an active alert/chase, and leaving the safe tile allows normal detection behavior to resume. The drone color and detection circle color change with the active FSM state.

**Why this FSM design was chosen:**  
This class-based FSM is easy to explain, easy to grade, and fits the course style better than embedding decisions directly in `World.js`. It also follows the course design pattern more closely, which makes the runtime behavior easier to debug and evaluate. It also creates clearer gameplay than a simple two-state enemy because the drone visibly reacts in stages instead of instantly toggling between idle and attack.

---

## 3. Pathfinding

### Hierarchical A*

**What:**  
Hierarchical A* is the main pathfinding system for drones in Maze 2. The maze is divided into clusters, portals are created between neighboring clusters, and the drone first plans a high-level route through clusters before refining each segment with low-level A*.

**Where:**  
- `js/ai/pathfinding/HierarchicalAStar.js`
- `js/ai/pathfinding/ClusterGraph.js`
- `js/entities/DroneEnemy.js`
- `js/ai/decisions/state-machines/DroneStates.js`
- `js/gameLogic/WorldInitializerManager.js`

**How used:**  
The pathfinder is created during world initialization for Maze 2. During `ChaseState`, `SearchState`, and `ReturnState`, the drone asks for a hierarchical path and then follows that path using steering. `js/entities/DroneEnemy.js` converts Maze 2 world positions into map-local coordinates before tile quantization, then converts path points back into world coordinates for movement.

**Why chosen:**  
Maze 2 is larger than the first maze and is the most navigation-heavy part of the project. HPA* makes the drone pathfinding easier to scale and easier to justify than recomputing a full flat search every time the target changes.

**Simplifications / modifications:**  
This is a simplified course-style HPA* implementation. The cluster graph keeps one selected portal per entrance region instead of building a more complex abstract graph with many transition nodes. That keeps the implementation explainable while still showing the hierarchical idea clearly.

### Jump Point Search (JPS)

**What:**  
Jump Point Search is used to generate efficient grid paths between anchor tiles in the dungeon. Those segments are combined into the patrol loop that the dungeon guard follows.

**Where:**  
- `js/ai/pathfinding/JPS.js`
- `js/entities/DungeonGuard.js`

**How used:**  
When the dungeon is created, the guard manager chooses anchor tiles near the dungeon corners. JPS computes the path between each pair of anchors, and the resulting segments are merged into one patrol loop.

**Why chosen:**  
JPS is a good fit for uniform-cost grid movement in the dungeon. It reduces unnecessary exploration compared with a plain A* search and gives a clean example of a course pathfinding topic being used for a real gameplay task.

**Simplifications / modifications:**  
The project uses JPS for patrol-loop construction rather than for the main chase behavior. This is still meaningful, but it is narrower than using JPS for all live enemy pursuit.

### Flow-Field Navigation

**What:**  
Flow-field navigation is the movement system for the ground attackers in Maze 1. A reverse Dijkstra pass builds a cost field outward from the goal tile, then each walkable tile stores a downhill direction toward a lower-cost neighbor. The attackers move according to that stored direction.

**Where:**  
- `js/ai/pathfinding/vectorPathFinding.js`
- `js/ai/pathfinding/Dijkstra.js`
- `js/entities/GroundAttackers.js`
- `js/gameLogic/WorldInitializerManager.js`

**How used:**  
The cost field is built once using the Maze 1 doorway as the goal. Each attacker reads the flow direction on its current tile, resolves the next downhill tile, and moves toward that tile center.

**Why chosen:**  
Flow fields are a strong choice for groups of agents that all share the same destination. The ground attackers do not need individually optimal paths as much as they need coordinated pressure toward the same exit corridor.

**Simplifications / modifications:**  
The current version intentionally uses a clean tile-to-tile downhill direction instead of a more blended vector field. That makes the algorithm easier to explain: reverse Dijkstra computes the costs, every tile points downhill, and movement follows that downhill choice consistently. In the current branch, the movement logic directly follows the generated downhill field, so the path computation and runtime behavior use the same representation.

---

## 4. Procedural Content Generation (PCG)

**The environment is not static — each run generates a new layout using procedural generation.**

### DFS Maze Generation

**What:**  
The first two maze spaces are generated with a depth-first search backtracking maze generator.

**Where:**  
- `js/pcg/MazeGenerator.js`
- `js/maps/TileMap.js`
- `js/gameLogic/WorldInitializerManager.js`

**How:**  
`MazeGenerator.generate()` starts from a random walkable tile, recursively visits neighbors, and carves passages by removing walls between tiles.

**How to observe:**  
Restart the game several times. The internal layout of Maze 1 and Maze 2 changes across runs.

**Why chosen:**  
DFS backtracking is one of the clearest course-aligned ways to generate traversable mazes. It produces strong directional maze structure and is easy to connect to the pathfinding and enemy systems.

### BSP Dungeon Generation

**What:**  
The final dungeon is generated separately using binary space partitioning.

**Where:**  
- `js/pcg/DungeonGenerator.js`
- `js/pcg/Partition.js`
- `js/pcg/Room.js`
- `js/gameLogic/WorldInitializerManager.js`

**How:**  
The dungeon space is split into partitions, rooms are created inside leaf partitions, and corridors connect rooms by carving through the grid.

**How to observe:**  
Restart the game several times to observe changes in the final dungeon layout. Room sizes, placement, and corridor structure vary between runs.

**Why chosen:**  
The dungeon needed a different feel from the mazes. BSP produces room-and-corridor layouts that are better for the final controller-room area and for the guard patrol loop.

---

## 5. Additional Topic

### Flow-Field Navigation

**What:**  
Flow-field navigation is the project’s additional topic. It is a navigation method where one global cost field is built for a shared target, and each tile stores the next downhill direction agents should follow.

**Where:**  
- `js/ai/pathfinding/vectorPathFinding.js`
- `js/entities/GroundAttackers.js`

**How enemies use it:**  
The ground attackers in Maze 1 all use the same field toward the maze doorway. This gives them coordinated movement without running a separate search for each attacker on every update.

**Why chosen:**  
It adds a different style of navigation from HPA* and JPS. That gives the project broader AI coverage and makes Maze 1 feel different from the drone and dungeon spaces.

---

# Changes from Original Proposal

The final version is more focused on using different AI stacks in different parts of the map instead of forcing one algorithm everywhere.

Main changes:
- Drone navigation moved toward a clearer hierarchical pathfinding setup in Maze 2 using HPA*.
- Ground enemies use flow-field navigation instead of individual path searches so they behave like a coordinated pressure system in Maze 1.
- The drone behavior is now centered on a cleaner class-based FSM with patrol, alert, chase, search, and return states.
- The dungeon guard uses JPS to build a patrol loop and Reynolds Path Following to move along it, which gives the dungeon its own distinct AI identity.
- The final layout became a mixed PCG structure: two DFS mazes followed by a BSP-generated dungeon.

These changes improved both the gameplay and the requirement coverage. Instead of repeating one enemy pattern across the whole game, each space now demonstrates a different AI topic in a visible way.

---

# Algorithm Modifications

### Reynolds
- The implementation in `js/ai/steering/ReynoldsPathFollowing.js` follows the lecture idea directly, but adapts it to a looped path instead of a one-pass path.
- It also uses segment switching thresholds and a small forward steering force when the guard is already near the path.
- These changes improve patrol continuity and reduce jitter in a real-time game.

### HPA*
- `js/ai/pathfinding/HierarchicalAStar.js` uses a simplified cluster-and-portal approach.
- `js/ai/pathfinding/ClusterGraph.js` chooses a representative portal for each entrance region instead of keeping a dense abstract graph.
- `js/entities/DroneEnemy.js` handles the Maze 2 world-to-map coordinate conversion before HPA* tile quantization, then converts the result back to world-space path points for steering.
- This makes the implementation smaller and easier to explain while still demonstrating hierarchical search.

### JPS
- `js/ai/pathfinding/JPS.js` is used for building the dungeon patrol loop rather than all runtime pursuit behavior.
- This is a narrower use than a full JPS-driven chase enemy, but it still demonstrates the algorithm clearly in the final level setup.

### Flow-Field
- `js/ai/pathfinding/vectorPathFinding.js` uses reverse Dijkstra to build the cost field, then stores a one-step downhill direction on each walkable tile.
- The movement code now follows that same representation directly by moving toward the next downhill tile center.
- This is a deliberate simplification for clarity and consistency. It is easier to defend than a blended vector output that is harder to interpret at runtime.

### FSM
- The project keeps the class-based FSM structure in `js/ai/decisions/state-machines`, but the final runtime path has been cleaned up so drones actively use `Patrol -> Alert -> Chase -> Search -> Return`.
- The active drone FSM now checks `world.isPlayerOnSafeTile()` so safe tiles prevent detection/reacquisition and interrupt alert or chase behavior.
- State entry also updates the drone color and detection-circle color, making patrol, alert, chase, search, and return easier to see during testing.
- This was done to remove ambiguity between older and newer state systems and make the runtime behavior match the architecture description.

---

# Architecture Overview

- `js/World.js` acts as the top-level world object and orchestration layer. It owns shared world state and delegates setup, updates, collisions, resets, and controller-exit logic to managers.
- `js/gameLogic/WorldInitializerManager.js`, `js/gameLogic/WorldUpdateManager.js`, `js/gameLogic/WorldCollisionManager.js`, and `js/gameLogic/WorldResetManager.js` handle the main world management tasks.
- `js/entities` contains entity-specific behavior such as drones, ground attackers, the dungeon guard, the player, and collectibles.
- `js/ai/decisions` contains FSM logic.
- `js/ai/steering` contains steering behaviors and movement support.
- `js/ai/pathfinding` contains the navigation systems: HPA*, JPS, Dijkstra, and flow-field support.
- `js/maps` and `js/pcg` contain map structures and procedural generation systems.

This keeps the project closer to the course style than putting all AI and gameplay decisions directly in `World.js`.

---

# Key Files Guide

- `js/entities/DroneEnemy.js`  
  Runtime drone behavior, hierarchical path usage, blended steering, and FSM initialization/reset.

- `js/entities/DungeonGuard.js`  
  Builds the dungeon patrol loop with JPS and updates the guard with Reynolds Path Following or pursuit.

- `js/entities/GroundAttackers.js`  
  Spawns and updates Maze 1 attackers that follow the flow field and apply local collision pressure.

- `js/ai/decisions/state-machines/DroneStates.js`  
  Class-based drone FSM with Patrol, Alert, Chase, Search, and Return.

- `js/ai/steering/ReynoldsPathFollowing.js`  
  Reynolds path following used for the dungeon guard loop.

- `js/ai/steering/SteeringBehaviours.js`  
  Shared steering behaviors including seek, arrive, pursue, and wander.

- `js/ai/steering/CollisionAvoidSteering.js`  
  Steering support for obstacle and boundary avoidance.

- `js/ai/pathfinding/HierarchicalAStar.js`  
  High-level cluster-based drone pathfinding.

- `js/ai/pathfinding/ClusterGraph.js`  
  Cluster and portal abstraction used by HPA*.

- `js/ai/pathfinding/JPS.js`  
  Jump Point Search for the dungeon patrol loop.

- `js/ai/pathfinding/vectorPathFinding.js`  
  Reverse Dijkstra cost field plus downhill flow-field following.

- `js/pcg/MazeGenerator.js`  
  DFS maze generation for Maze 1 and Maze 2.

- `js/pcg/DungeonGenerator.js`  
  BSP room-and-corridor generation for the final dungeon.

- `js/gameLogic/WorldInitializerManager.js`  
  Main world setup, map creation, AI system setup, enemy spawning, and energy-cell placement.

---

# Creative Additions

### Multiple Enemy Types
The game uses three different enemy roles: ground attackers, drones, and a dungeon guard. This improves gameplay by making each area feel mechanically different instead of repeating one enemy across the whole project.

### Energy Cell System
Energy cells are distributed across all three areas through `js/gameLogic/EnergyCellManager.js`. This gives the player a collection objective beyond simple movement from start to end.

### Controller Room Objective
The final goal is not just reaching the last map. The player must unlock and activate the controller room exit managed by `js/gameLogic/ControllerExitManager.js`. This gives the dungeon a clear objective state instead of functioning as a generic end zone.

### 80% Unlock Requirement
The controller exit unlocks only after collecting 80% of all spawned energy cells. This improves pacing because the player cannot ignore most of the world and run straight to the end.

### Combined AI Systems
The project combines flow fields, HPA*, JPS, Reynolds path following, steering, and FSMs in one game. This improves gameplay variety and also makes the project stronger as a course submission because each area demonstrates a different AI idea in a visible way.

---

# Quick Testing Guide

### Verify FSM transitions
Go into Maze 2 and approach a drone. Watch it patrol first, then enter alert, then chase. Break distance and keep moving away to see search and return behavior. Step onto a safe tile to confirm detection/chase stops, then leave the safe tile to confirm normal detection can resume. The drone color and detection circle should change as the FSM state changes.

### Verify flow-field movement
Start in Maze 1 and watch the ground attackers. They should all move toward the same doorway using the shared field, while still adjusting locally when another attacker is directly in front of them.

### Verify Reynolds Path Following
Reach the dungeon and watch the guard before entering its detection radius. It should patrol a smooth loop rather than jumping between discrete patrol points.

### Verify JPS usage
Restart a few times and reach the dungeon. The patrol loop will be rebuilt from new dungeon geometry, using JPS segments between anchor points.

### Verify HPA*
In Maze 2, let a drone begin chasing from a distance. Its movement should still work across the maze rather than behaving like only local steering, including across the world-offset Maze 2 layout.

### Verify PCG changes
Restart the game multiple times. Maze 1, Maze 2, and the dungeon should all generate new layouts.

### Verify unlock logic
Collect energy cells across the maps and check the controller room state in the dungeon. The exit should unlock only after the required number of cells has been collected.

### Verify win and restart
After unlocking the controller room, enter the exit to win. Press `R` on the win or game-over screen to restart the full run.

---

# Notes for Grader

- The game is designed around three connected AI spaces rather than one repeated behavior. Maze 1 emphasizes flow-field group movement, Maze 2 emphasizes FSM plus HPA*, and the dungeon emphasizes JPS plus Reynolds path following.
- Drone danger is intentionally restricted to `ChaseState` so the runtime gameplay matches the FSM explanation cleanly.
- JPS is used for patrol-loop construction instead of live chase behavior. This is still a real use of the algorithm, but it is not the only navigation method in the project.
- The HPA* implementation is a simplified educational version using clusters and representative portals. It is intended to be clear and defensible rather than fully optimized.
- There are older state-machine files in the repository from earlier iterations, but the active runtime drone logic on this branch uses `DroneStates.js`.

---

# Contributors

Mamun Rashid  
- Drone FSM implementation and cleanup
- Flow-field logic cleanup and consistency fixes
- Hierarchical pathfinding integration
- Final debugging and gameplay fixes
- README writing and polishing

Shahrier Khan  
- Initial world and manager architecture refactor
- Ground attacker system
- Dungeon guard system, including Reynolds and JPS integration
- Procedural generation systems for maze and dungeon layouts
- Base gameplay structure

---

# References

AI Assistance  
- ChatGPT (OpenAI)

Used for:
- Debugging assistance
- Algorithm clarification
- Code cleanup guidance
- README structure and polishing

# Robot Maze Escape AI System

Robot Maze Escape AI System is a three-stage maze escape game built with three.js. The project focuses on AI in gameplay by combining steering behaviours, finite state machines, multiple pathfinding systems, and procedural content generation in one connected world.

---

# YouTube Demo Video
- Link: [PASTE VIDEO LINK HERE]

---

# How to Run
1. Install dependencies:
   ```bash
   npm install
   ```
2. Run the Vite development server:
   ```bash
   npx vite
   ```
3. Open the local URL shown in the terminal in a browser.

---

# Controls
- `W`, `A`, `S`, `D`: move the player
- `Space`: jump
- `R`: restart after game over or victory

There are no dedicated gameplay debug hotkeys in the current build. The main debug support is visual and code-based, such as patrol path drawing and optional flow-field arrow rendering.

---

# Project Overview

The game is structured as a connected escape scenario. The player starts in the first maze, survives enemy pressure while moving across the world, collects energy cells, reaches the dungeon, and finally unlocks and activates the controller room exit.

The current objective flow is:
- escape the first maze while avoiding ground attackers
- move through the second maze while avoiding drones
- collect energy cells across the world
- enter the dungeon
- unlock the controller exit by collecting enough energy cells
- reach the controller room to win

The AI systems are used to make each region play differently:
- ground attackers use flow-field navigation to keep advancing toward the first maze exit
- drones use a class-based FSM plus hierarchical pathfinding to patrol, detect, chase, search, and return
- the dungeon guard follows a patrol loop using Reynolds path following and switches to pursuit when the player gets close

This makes the project more than a simple maze game. Each enemy type demonstrates a different AI technique while still contributing to one clear gameplay goal.

---

# Course Requirement Mapping

## 1. Complex Movement Algorithms

### Reynolds Path Following

**What:**  
Reynolds path following is used to keep the dungeon guard moving smoothly along a patrol route. The implementation predicts a future position, projects that point onto the active path segment, and steers toward a target slightly ahead on the path.

**Where:**  
- `js/ai/steering/ReynoldsPathFollowing.js`
- `js/entities/DungeonGuard.js`

**How to observe in game:**  
After reaching the dungeon, watch the guard move around the patrol loop before the player enters its detection range. The guard follows a smooth continuous loop rather than snapping between waypoints.

**Why this approach was used:**  
This behaviour fits the dungeon guard well because it gives a readable patrol pattern while still looking more natural than direct waypoint seeking. It also matches the course path-following topic closely.

### Collision Avoidance / Steering

**What:**  
Steering behaviours are used for movement blending and local avoidance. Drones use separation, wall avoidance, and boundary avoidance while ground attackers use close-range pushing behaviour to reduce piling and overlap.

**Where:**  
- `js/ai/steering/SteeringBehaviours.js`
- `js/ai/steering/CollisionAvoidSteering.js`
- `js/ai/steering/GroupSteeringBehaviours.js`
- `js/entities/DroneEnemy.js`
- `js/entities/GroundAttackers.js`

**How to observe in game:**  
- Drones in Maze 2 do not simply travel as straight path followers. They also react to other drones and map boundaries.
- Ground attackers in Maze 1 keep moving toward their goal while pushing apart when they get too close in front of one another.

**Why this approach was used:**  
Using steering on top of high-level navigation makes the enemies more stable and believable. It also follows the course pattern of combining decision/path systems with local movement control instead of depending on raw path nodes alone.

---

## 2. Decision Making (FSM)

**What:**  
The drones use a class-based finite state machine with five active states:
- Patrol
- Alert
- Chase
- Search
- Return

**Where:**  
- `js/ai/decisions/state-machines/DroneStates.js`
- `js/ai/decisions/state-machines/State.js`
- `js/ai/decisions/state-machines/StateMachine.js`
- `js/entities/DroneEnemy.js`

**How transitions work:**  
- `PatrolState`: the drone wanders near its home tile and checks for the player
- `AlertState`: the drone briefly stops after detection to create a readable transition
- `ChaseState`: the drone actively follows a path toward the player
- `SearchState`: the drone moves toward the last known player position if line-of-contact is lost
- `ReturnState`: the drone returns to its patrol area and then switches back to patrol

The runtime drone setup now consistently starts in `PatrolState` through `js/entities/DroneEnemy.js`, so the active implementation matches the FSM structure in `DroneStates.js`.

**How to observe in gameplay:**  
In Maze 2, approach a drone and then move away or break contact. The drone behaviour should clearly move through patrol, alert, chase, search, and return stages instead of acting like a single-state pursuer.

**Why this FSM design was chosen:**  
This structure is easy to explain and grade because each state has a single responsibility. It also fits the course FSM style better than mixing runtime logic across older guard-style states and newer drone-specific states.

---

## 3. Pathfinding

### Hierarchical A*

**What:**  
Hierarchical A* is used for drone navigation in Maze 2. The maze is divided into clusters, the system finds a route across clusters, and then local low-level paths are built between portals and the final target.

**Where:**  
- `js/ai/pathfinding/HierarchicalAStar.js`
- `js/ai/pathfinding/ClusterGraph.js`
- `js/entities/DroneEnemy.js`
- `js/World.js`

**How it is used in the game:**  
When drones enter `ChaseState`, `SearchState`, or `ReturnState`, they request paths through the hierarchical system and then follow those paths using the path-following helper stored on the drone.

**Why this algorithm was chosen:**  
Maze 2 is the largest active navigation area used by pursuing enemies. HPA* keeps the idea of informed pathfinding but scales better for repeated drone navigation requests than re-running a plain low-level search every time.

**Simplifications / modifications compared to course demos:**  
The current implementation is a simplified course-style HPA* rather than a full abstract graph system with the same exact demo classes. It still preserves the important structure: cluster partitioning, abstract routing, portal selection, and low-level refinement.

### Jump Point Search (JPS)

**What:**  
Jump Point Search is used to generate the dungeon guard’s patrol loop efficiently across the dungeon grid. The algorithm prunes directions and jumps over intermediate nodes until it reaches meaningful jump points.

**Where:**  
- `js/ai/pathfinding/JPS.js`
- `js/entities/DungeonGuard.js`

**How it is used in the game:**  
When the dungeon guard patrol route is created, JPS finds the path segments between anchor points in the dungeon. Those tile paths are then converted into world positions for the Reynolds patrol loop.

**Why this algorithm was chosen:**  
JPS fits well on the 4-direction tile grid used by the dungeon. It also gives a clear way to demonstrate a second pathfinding topic beyond HPA*.

**Simplifications / modifications compared to course demos:**  
In this project, JPS is used for patrol path construction rather than as the main live chase algorithm. That keeps the guard behaviour stable and easy to observe while still showing a valid JPS implementation in the codebase.

### Flow-Field Pathfinding

**What:**  
The ground attackers use reverse Dijkstra pathfinding to build a cost field from the goal tile, then convert that field into a downhill flow direction on each walkable tile.

**Where:**  
- `js/ai/pathfinding/vectorPathFinding.js`
- `js/ai/pathfinding/Dijkstra.js`
- `js/entities/GroundAttackers.js`
- `js/World.js`

**How it is used in the game:**  
In Maze 1, all ground attackers continuously move toward the same exit goal. The flow field lets multiple enemies share the same navigation data instead of each one computing an independent path.

**Why this algorithm was chosen:**  
This is a good fit for many agents moving toward one shared target. It also makes the first maze feel different from Maze 2, where enemy behaviour is more state-driven and individualized.

**Simplifications / modifications compared to course demos:**  
The current cleanup pass intentionally stores explicit one-step downhill directions instead of more complex weighted vectors. That makes the algorithm story cleaner: reverse Dijkstra builds the cost field, each tile points to its best lower-cost neighbor, and the attackers move toward that next tile center.

---

## 4. Procedural Content Generation (PCG)

### DFS Maze Generation

**What:**  
Maze 1 and Maze 2 are created using DFS/backtracking-style grid carving. The generator starts from a valid grid cell, carves passages recursively, and then assigns terrain costs across walkable tiles.

**Where:**  
- `js/maps/TileMap.js`

**How it works:**  
The map begins filled with obstacle tiles. The generator carves paths by moving in 2-cell steps, opening the wall between cells, and recursively continuing until the maze structure is formed.

**How to observe in game:**  
Restart the game multiple times. The first two maze layouts and walkable route structure change from run to run.

**Why this approach was used:**  
DFS maze generation is a direct fit for the course PCG material and works well for creating narrow, readable chase spaces for the first two zones.

### BSP Dungeon Generation

**What:**  
The dungeon is generated using binary space partitioning. The space is recursively divided into partitions, rooms are created inside those partitions, and corridors connect the rooms.

**Where:**  
- `js/pcg/DungeonGenerator.js`
- `js/pcg/Partition.js`
- `js/pcg/Room.js`
- `js/World.js`

**How it works:**  
The dungeon map is first reset to obstacles, then split into partitions. Rooms are carved into valid leaves, and corridors connect room centers to produce a room-and-hallway dungeon layout.

**How to observe in game:**  
Restart the game multiple times and reach the dungeon. The room placement and corridor structure vary between runs.

**Why this approach was used:**  
Using BSP for the final area makes the dungeon visually and structurally different from the first two mazes. That gives the project a second clear PCG technique instead of repeating the same style everywhere.

---

## 5. Additional Topic

### Flow-Field Navigation

**What:**  
Flow-field navigation is the shared navigation layer used by the ground attackers. Each walkable tile stores a direction that points toward a lower-cost neighbor, so agents can follow the field instead of owning full individual paths.

**Where:**  
- `js/ai/pathfinding/vectorPathFinding.js`
- `js/entities/GroundAttackers.js`

**How enemies use it:**  
The world builds a cost field from the door goal in Maze 1. Each attacker checks its current tile, reads the stored downhill direction, resolves the next target tile, and moves toward that tile center.

**Why it was chosen:**  
This topic works especially well when many agents share one destination. It keeps the first maze readable, efficient, and clearly different from the drone navigation stack in Maze 2.

---

# Changes from Original Proposal

The final project is more focused on distinct AI layers than a simpler single-algorithm maze game would have been. Based on the current implementation, the main evolution points are:

- the project now uses different enemy types for different AI demonstrations instead of making every enemy behave the same way
- Maze 2 uses Hierarchical A* for drones rather than relying on one basic pathfinding method everywhere
- flow-field navigation was added as a strong shared-navigation system for the ground attackers
- the drone logic was cleaned up into one active class-based FSM architecture
- the dungeon uses both JPS and Reynolds path following to create a patrol system that is easy to observe and explain
- the final objective is larger than simple escape because it includes energy-cell collection, unlock logic, and a controller room finish condition

These changes improve both gameplay variety and traceability to course topics. They also make it easier to show that different AI techniques were chosen for different design problems instead of being added randomly.

---

# Algorithm Modifications

This section is important because several systems were adapted from course-style demos to fit this project.

## Reynolds Path Following
- Implemented in `js/ai/steering/ReynoldsPathFollowing.js`
- Modified to support a looped patrol path for the dungeon guard
- Includes practical tuning such as segment switching near path ends and a small forward correction even when the guard is close to the path
- These changes were made so the guard patrol remains smooth and readable in a real game loop

## Hierarchical A*
- Implemented in `js/ai/pathfinding/HierarchicalAStar.js`
- Uses a simplified cluster graph and portal selection process instead of reproducing every course demo class exactly
- The core idea remains the same: abstract cluster routing plus refined low-level pathfinding
- This was done to keep the system manageable inside the project while still preserving the course concept

## Jump Point Search
- Implemented in `js/ai/pathfinding/JPS.js`
- Used for patrol route construction rather than as the guard’s live chase system
- This keeps the JPS usage visible in code while avoiding unstable patrol behaviour

## Flow-Field Navigation
- Implemented in `js/ai/pathfinding/vectorPathFinding.js`
- The cleaned-up version stores explicit downhill neighbor directions instead of weighted multi-neighbor vectors
- The follower logic then moves toward the next downhill tile center
- This modification was necessary to keep the cost field and movement interpretation internally consistent and easy to explain

## Drone FSM
- Implemented in `js/ai/decisions/state-machines/DroneStates.js`
- The active runtime now consistently uses this drone-specific FSM through `js/entities/DroneEnemy.js`
- This was done to remove ambiguity and make the decision-making architecture match the course FSM style more clearly

---

# Architecture Overview

The project is organized so that the main systems are separated by responsibility.

- `js/World.js`: high-level orchestration, world creation, system wiring, and update flow
- `js/entities`: concrete gameplay actors and entity-specific behaviour
- `js/ai/decisions`: decision logic, especially the class-based FSM
- `js/ai/steering`: steering behaviours and local movement control
- `js/ai/pathfinding`: HPA*, JPS, Dijkstra, and flow-field navigation
- `js/maps`: tile maps, paths, and map-related data structures
- `js/pcg`: procedural generation systems for the dungeon and supporting structures
- `js/gameLogic`: gameplay systems such as energy cells, controller exit logic, and world layout connections

This structure keeps the project explainable: orchestration in `World.js`, active behaviour in entities, decisions in `ai/decisions`, steering in `ai/steering`, and navigation in `ai/pathfinding`.

---

# Key Files Guide

- `js/World.js`  
  Creates the three connected zones, wires the AI systems together, and runs the main gameplay setup.

- `js/entities/DroneEnemy.js`  
  Holds the active drone runtime behaviour, path requests, steering blending, and FSM integration.

- `js/entities/GroundAttackers.js`  
  Spawns and updates the Maze 1 attackers that use the shared flow field.

- `js/entities/DungeonGuard.js`  
  Builds the dungeon patrol route using JPS and updates the guard using Reynolds path following and pursuit.

- `js/ai/decisions/state-machines/DroneStates.js`  
  Contains the active drone FSM states: Patrol, Alert, Chase, Search, and Return.

- `js/ai/steering/SteeringBehaviours.js`  
  Base steering behaviours such as seek, flee, pursue, arrive, and wander.

- `js/ai/steering/ReynoldsPathFollowing.js`  
  Path-following implementation for the dungeon guard patrol loop.

- `js/ai/steering/CollisionAvoidSteering.js`  
  Local avoidance for walls, boundaries, and nearby obstacles.

- `js/ai/pathfinding/HierarchicalAStar.js`  
  Abstract-plus-local pathfinding for drones in Maze 2.

- `js/ai/pathfinding/JPS.js`  
  Jump Point Search implementation used for the dungeon patrol route.

- `js/ai/pathfinding/vectorPathFinding.js`  
  Reverse Dijkstra cost-field generation and flow-field following for ground attackers.

- `js/maps/TileMap.js`  
  DFS/backtracking maze generation, tile neighbors, tile localization, and collision support.

- `js/pcg/DungeonGenerator.js`  
  BSP room partitioning and corridor generation for the dungeon.

- `js/gameLogic/EnergyCellManager.js`  
  Spawns and tracks collectible energy cells.

- `js/gameLogic/ControllerExitManager.js`  
  Handles controller-room unlock state and victory activation.

---

# Creative Additions

## Multiple Enemy Types

**What:**  
The project uses three distinct enemy roles:
- ground attackers in Maze 1
- drones in Maze 2
- a dungeon guard in the final area

**Why it improves gameplay:**  
This makes each zone feel different and lets each AI technique be demonstrated in a meaningful gameplay context.

## Energy Cell System

**What:**  
Energy cells are scattered across the world and collected by proximity.

**Where:**  
- `js/entities/EnergyCell.js`
- `js/gameLogic/EnergyCellManager.js`

**Why it improves gameplay:**  
This turns the game into more than simple escape. The player has to move through the world and interact with multiple systems before the final exit becomes available.

## Controller Room Objective

**What:**  
The final win condition is not just reaching the end of a maze. The player must unlock and activate the controller exit in the dungeon.

**Where:**  
- `js/gameLogic/ControllerExitManager.js`
- `js/gameLogic/game.js`

**Why it improves gameplay:**  
This creates a stronger final objective and gives the dungeon a clear purpose.

## Unlock Logic

**What:**  
The current implementation requires 80% of all spawned energy cells to be collected before the controller exit unlocks.

**Where:**  
- `js/World.js`
- `js/gameLogic/ControllerExitManager.js`

**Why it improves gameplay:**  
Requiring most, but not all, collectibles creates tension without forcing a perfect run. It also makes exploration across all zones matter.

## Combined AI Systems

**What:**  
The project combines FSMs, steering, HPA*, JPS, flow-field navigation, DFS maze generation, and BSP dungeon generation in one game.

**Why it improves gameplay:**  
The systems are not isolated demos. They support different enemy roles and create a more varied and complete final project.

---

# Quick Testing Guide

To verify the main systems quickly:

- Move through Maze 1 and observe ground attackers following the flow field toward the exit
- Enter Maze 2 and approach drones to trigger FSM transitions (Patrol → Alert → Chase → Search → Return)
- Reach the dungeon and observe the guard’s patrol loop and chase behavior
- Restart multiple times to confirm procedural generation changes the layout
- Collect energy cells until 80% is reached and observe controller exit unlocking
- Reach the controller room to trigger win condition
- Press R to restart and verify systems reset correctly

---

# Notes

Here is the fastest way to test the main features:

- Start the game and observe Maze 1:
  ground attackers should continuously move toward the first maze exit using the shared flow field

- Move into Maze 2:
  drones should patrol first, then react through alert, chase, search, and return behaviour

- Reach the dungeon:
  the guard should patrol on a loop before switching to pursuit when the player comes close

- Restart the game multiple times:
  Maze 1, Maze 2, and the dungeon layout should not be identical each run

- Collect energy cells:
  the controller exit should remain locked until enough cells have been collected, then visually change to its unlocked state

Assumptions and minor limitations:
- there is no root README in the repository history for this branch, so this document was written directly from the current codebase
- the “Changes from Original Proposal” section is based on the final implementation direction visible in the code rather than a proposal file stored in the repo
- the ground attacker file in the project is `js/entities/GroundAttackers.js`, not `GroundAttacker.js`
- there are no dedicated debug keys in the current build, but some debug-oriented visuals and hooks still exist in the code

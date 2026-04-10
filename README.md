# Project Title
Robot Maze Escape AI System

Robot Maze Escape is a three-stage AI game built with three.js. The player travels through Maze(map 1), Perlin(map 2), and a final dungeon(map 3) while interacting with multiple AI systems, including finite state machines, steering behaviours, flow-field navigation, Jump Point Search, and procedural content generation.

---

# YouTube Demo Video
- Link: [https://youtu.be/S_kUdUqbpb0]

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
- Jump and move at the same time to escape the ground attackers in maze-1
- `R` restarts after a loss or a win.

---

# Main Gameplay Objective

The player must:
1. survive enemy pressure across all three areas,
2. collect energy cells distributed throughout the world,
3. unlock the controller exit in the dungeon,
4. reach the unlocked controller room to win.

The game ends in two ways:
- **Loss:** the player is caught by a ground attacker, a drone in its dangerous chase state, or the dungeon guard.
- **Win:** the player reaches the controller exit after the required number of energy cells(80% for this version) has been collected.

---

# Project Overview

The game is organised as a connected three-area progression:
- **Maze 1** introduces group pressure through ground attackers.
- **Maze 2** focuses on drone decision making and local steering behaviour.
- **The dungeon** contains the controller-room exit and a patrol guard.

The player begins in Maze 1, crosses into Maze 2, then enters the dungeon. However, reaching the dungeon is not enough to win. The player must collect enough energy cells to unlock the controller exit before escape is possible.

The unlocking rule is controlled by `unlockRequirementFraction = 0.8` in `js/World.js`, meaning the player must collect **80% of all spawned energy cells**. This requirement encourages exploration across the full environment rather than allowing a direct rush to the end.

A major design goal of the project is to give each area a different AI identity:
- **Maze 1** uses flow-field navigation for ground attackers.
- **Maze 2** uses a class-based finite state machine for drones, combined with steering and avoidance.
- **The dungeon** uses Jump Point Search to build a patrol loop and Reynolds Path Following to move the guard smoothly along that loop.

This separation makes the game easier to explain academically and also makes the gameplay more varied.

---

# Course Requirement Mapping

## 1. Complex Movement Algorithms

### Reynolds Path Following

**What:**  
Reynolds Path Following is used for the dungeon guard during patrol. Instead of jumping from one waypoint to the next, the guard predicts its future position, projects toward the patrol path, and steers smoothly along the loop.

**Where:**  
- `js/ai/steering/ReynoldsPathFollowing.js`
- `js/entities/DungeonGuard.js`

**How to observe:**  
Reach the dungeon and watch the guard before it notices the player. Its movement follows a continuous loop rather than a simple stop-and-turn waypoint pattern.

**Why used:**  
This was a suitable movement algorithm for a guard patrol because the dungeon needed motion that looked smooth and continuous. It also matches the course theme of steering-based movement well.

### Collision Avoidance and Steering Blending

**What:**  
The drones use blended steering. Their main steering force is combined with local avoidance forces such as separation, wall avoidance, and unsticking behaviour. Ground attackers also use local avoidance so that they do not heavily overlap while moving through Maze 1.

**Where:**  
- `js/ai/steering/CollisionAvoidSteering.js`
- `js/ai/steering/GroupSteeringBehaviours.js`
- `js/ai/steering/SteeringBehaviours.js`
- `js/entities/DroneEnemy.js`
- `js/entities/GroundAttackers.js`

**How to observe:**  
In Maze 2, drones try not to pile into each other or remain stuck at boundaries. In Maze 1, attackers still move toward the shared goal, but local corrections reduce obvious crowding.

**Why used:**
The game contains multiple moving agents in relatively narrow spaces. For maze 1, only vector path finding was not enough since two ground attackers could collide. So, we used some sort of collsion avoidance. For map2,Pure wander would not work
because there are obstacles. So, we use steering behaviours like wander, seek, pursue along with
collsion avoidance to prevent collsion from other drones and wall obstackles.

---

## 2. Decision Making (Finite State Machine)

### Active Drone FSM

The drones use the following active runtime FSM:

`Patrol -> Alert -> Chase -> Search -> Patrol`

**Where:**  
- `js/ai/decisions/state-machines/PatrolState.js`
- `js/ai/decisions/state-machines/AlertState.js`
- `js/ai/decisions/state-machines/ChaseState.js`
- `js/ai/decisions/state-machines/SearchState.js`
- `js/ai/decisions/state-machines/State.js`
- `js/ai/decisions/state-machines/StateMachine.js`
- `js/entities/DroneEnemy.js`
- `js/entities/DroneEntity.js`
- `js/gameLogic/game.js`

**How the states work:**
- `PatrolState`: the drone wanders around Maze 2.
- `AlertState`: once the player is detected, the drone reacts and prepares to engage.
- `ChaseState`: the drone actively pursues the player and becomes dangerous.
- `SearchState`: if the player is lost, the drone searches around the last known player location.
- After search ends, the drone returns to `PatrolState`.


**How to observe:**  
In Maze 2, approach a drone. It will move from patrol to alert, then to chase. If the drone loses the player, it enters search and eventually resumes patrol.

**Why this FSM design was chosen:**  
A class-based FSM is easy to match with professor's implementation because the states, transitions, and responsibilities are clearly separated. It is also easier to debug than placing all decision logic inside one large update method.

**Gameplay consequence:**  
In `js/gameLogic/game.js`, drones are only treated as dangerous during `ChaseState`. This makes the win/loss logic consistent with the FSM design.

---

## 3. Pathfinding

### Jump Point Search (JPS)

**What:**  
Jump Point Search is used in the dungeon to generate efficient path segments between selected anchor tiles. These segments are combined into the patrol loop used by the dungeon guard( yellow lines in dungeon).

**Where:**  
- `js/ai/pathfinding/JPS.js`
- `js/entities/DungeonGuard.js`

**How used:**  
When the dungeon is created, anchor tiles are selected near the dungeon corners. JPS computes paths between successive anchors, and the combined result becomes the guard’s patrol loop.

**Why chosen:**  
JPS is a strong match for uniform-cost grid maps. This project provides a clear pathfinding component for the dungeon while keeping the guard patrol efficient and easy to explain. 

**Modification in this project:**

JPS is used for patrol-loop construction rather than live chase pathfinding. This is still a valid application because it directly supports runtime guard behaviour.Moreover, we used priority queue as shown in class. Using A*, HP A* would make things more complecated. In this use case, we found JPS is the best fit.

### Flow-Field Navigation

**What:**  
Flow-field navigation is used by the ground attackers in Maze 1. A reverse cost-field computation is built from the exit doorway, and each walkable tile stores a downhill direction toward a lower-cost neighbour.(Not including in Grading Criteria..Should be considered for creativity)

**Where:**  
- `js/ai/pathfinding/vectorPathFinding.js`
- `js/ai/pathfinding/Dijkstra.js`
- `js/entities/GroundAttackers.js`
- `js/gameLogic/WorldInitializerManager.js`

**How used:**  
The field is built once from the Maze 1 goal tile. Each ground attacker checks the current tile, finds the next downhill direction, and moves toward the centre of the next selected tile.

**Why chosen:**  
Flow fields are especially suitable when many agents share the same destination. That is the case in Maze 1, where all attackers pressure the player by moving toward the same goal area.

**Modification in this project:**  
The current version stores a discrete one-step downhill direction rather than a more continuous blended vector field. This makes the algorithm more transparent and easier to defend in a report.

---

## 4. Procedural Content Generation (PCG)

The environment is procedurally generated rather than fixed. Every new restart will give new look to the world.

### DFS Maze Generation

**What:**  
Maze 1 is created using the maze-generation option in `TileMap`, and the maze generator uses depth-first search backtracking to carve passages.

**Where:**  
- `js/pcg/MazeGenerator.js`
- `js/maps/TileMap.js`
- `js/gameLogic/WorldInitializerManager.js`

**How to observe:**  
Restart the game multiple times. The layout of Maze 1 changes across runs.

**Why chosen:**  
DFS backtracking is a clear and standard procedural maze-generation algorithm. It reliably creates connected maze layouts and is easy to explain( since professor provided the code and told us we are
free to use that. He just wants to see we can implement in real life).

### Perlin-Based Terrain for Maze 2

**What:**  
The second area is not generated as another strict DFS maze. Instead, it is configured in `WorldInitializerManager` using Perlin-based terrain parameters, creating a more open map with different terrain types.

**Where:**  
- `js/pcg/Perlin.js`
- `js/maps/TileMap.js`
- `js/gameLogic/WorldInitializerManager.js`

**How to observe:**  
Maze 2 has a more open structure than Maze 1, which supports drone wandering and detection behaviour more naturally.

**Why chosen:**  
This design gives the second stage a different spatial identity. It also supports the drone FSM better than a narrow maze would.

### BSP Dungeon Generation

**What:**  
The final dungeon is created using binary space partitioning.

**Where:**  
- `js/pcg/DungeonGenerator.js`
- `js/pcg/Partition.js`
- `js/pcg/Room.js`
- `js/gameLogic/WorldInitializerManager.js`

**How to observe:**  
Restart the game several times and compare the final dungeon layout. The room arrangement and corridors vary.

**Why chosen:**  
The dungeon needed a room-and-corridor structure rather than another maze. BSP is well suited for producing that kind of final level.

---

## 5. Additional Topic

### Energy-Cell Gating as a Progression Mechanic

**What:**  
The project includes a collection-based progression system through energy cells and a controller-room unlock condition.

**Where:**  
- `js/gameLogic/EnergyCellManager.js`
- `js/gameLogic/ControllerExitManager.js`
- `js/World.js`

**How it works:**  
Energy cells are distributed across Maze 1, Maze 2, and the dungeon. The controller exit remains locked until the required fraction of total cells has been collected.

**Why included:**  
This mechanic strengthens the structure of the game by connecting navigation, survival, and exploration into one clear objective. It also prevents the project from feeling like a simple start-to-end movement demo.

---

# Description of Each Area

## Maze 1
Maze 1 is the opening pressure zone. It is more maze-like in structure, and the main AI feature is the group behaviour of ground attackers. These enemies repeatedly use the shared flow field built toward the map exit, which creates coordinated pressure.

## Maze 2
Maze 2 is the drone zone. Its more open terrain supports wandering, detection, alerting, pursuit, and local search. Safe tiles are also added here through the layout manager to soften the difficulty and support evasion.

## Dungeon
The dungeon is the final objective area. It uses BSP generation and contains the controller exit. The dungeon guard patrols on a loop built from JPS path segments and moves using Reynolds Path Following until the player enters detection range.

---


# Algorithm Modifications and Practical Adaptations

### Reynolds Path Following
- adapted for a looped patrol path rather than a one-directional path,
- used together with live chase switching when the player enters detection range,
- tuned for smoother movement in a real-time game environment.

### Jump Point Search
- used to connect anchor tiles into a patrol loop,
- serves a practical gameplay purpose rather than being included only as a standalone demonstration.

### Flow-Field Navigation
- implemented using reverse cost propagation and downhill tile selection,
- simplified to a discrete tile-to-tile guidance system for clarity and consistency.

### Drone FSM
- kept as a modular class-based system,
- dangerous drone behaviour is restricted to `ChaseState`,
- final implemented transition sequence is simpler and exactly matches the class style.

---

# Architecture Overview

The codebase is organised into clear subsystems.

- `js/World.js` is the top-level orchestration class.
- `js/gameLogic/WorldInitializerManager.js` builds the maps, entities, hallways, objectives, and managers.
- `js/gameLogic/WorldUpdateManager.js` runs the frame-by-frame update process.
- `js/gameLogic/WorldCollisionManager.js` selects the correct collision map and handles area-specific collision logic.
- `js/gameLogic/WorldResetManager.js` clears the world and prepares it for a fresh restart.
- `js/gameLogic/ControllerExitManager.js` manages the final objective and unlocking state.
- `js/gameLogic/EnergyCellManager.js` manages collectible placement and collection.
- `js/entities/` contains the player, drones, guard, attackers, and collectible entities.
- `js/ai/decisions/state-machines/` contains the finite state machine implementation.
- `js/ai/steering/` contains steering behaviours and path-following logic.
- `js/ai/pathfinding/` contains the implemented navigation algorithms.
- `js/pcg/` contains procedural generation systems.

This organisation is appropriate for an academic submission because it separates world management, AI, procedural generation, and gameplay systems.

---

# Key Files Guide

- `js/World.js`  
  Top-level world state, shared configuration, and wrapper methods.

- `js/gameLogic/WorldInitializerManager.js`  
  Creates the three connected areas, hallways, pathfinding support, enemy managers, and collectibles.

- `js/gameLogic/WorldUpdateManager.js`  
  Updates the player, enemies, animations, collectibles, and controller exit every frame.

- `js/gameLogic/game.js`  
  Handles win/loss logic and restart behaviour.

- `js/entities/DroneEnemy.js`  
  Drone steering, FSM integration, detection, search memory, and visual state control.

- `js/entities/DroneEntity.js`  
  Drone creation, spawn handling, model loading, and per-frame drone manager update logic.

- `js/entities/GroundAttackers.js`  
  Ground attacker spawning, visual setup, and flow-field-based movement updates.

- `js/entities/DungeonGuard.js`  
  Dungeon guard patrol-loop creation, patrol update, and chase switching.

- `js/ai/pathfinding/vectorPathFinding.js`  
  Builds the Maze 1 flow field and supports attacker navigation.

- `js/ai/pathfinding/JPS.js`  
  Jump Point Search is used for dungeon patrol path generation.

- `js/ai/steering/ReynoldsPathFollowing.js`  
  Smooth loop-following movement for the dungeon guard.

- `js/ai/decisions/state-machines/`  
  Active drone FSM state definitions and state machine infrastructure.

- `js/pcg/MazeGenerator.js`, `js/pcg/Perlin.js`, `js/pcg/DungeonGenerator.js`  
  Procedural generation systems for the different world areas.

---

# Quick Testing Guide

## Verify the drone FSM
Go to Maze 2 and approach a drone. Observe patrol first, then alert, then chase. Move away until the drone loses you and enters search before returning to patrol.

## Verify drone danger logic
Touch a drone in patrol or alert and note that it should not trigger defeat immediately. During `ChaseState`, collision with the drone should cause game over.

## Verify flow-field navigation
In Maze 1, watch several ground attackers. They should generally move toward the same doorway while still showing local avoidance corrections.

## Verify dungeon patrol
Reach the dungeon and observe the guard before entering its detection radius. The patrol should follow a visible loop.

## Verify procedural generation
Restart the game several times. The first maze and the dungeon should visibly change. Maze 2 should still retain its open terrain style with varied tile structure.

## Verify unlock condition
Collect energy cells across the three areas. The controller exit should only unlock after the required number has been reached.

## Verify restart
After a win or loss, press `R` and confirm that the world is rebuilt from scratch.

---

# Notes for Grading
 - Perfect Code Structure as we have done in class(w3 Style)
- The project demonstrates multiple AI topics in one connected game, which is fun and engaging.
- The strongest directly observable course topics  are:
  - finite state machines(class based as shown in class),
  - steering and avoidance(wander,seek,pursue and whisker base collision avoidance),
  - Reynold's Path Following,
  - Jump Point Search,
  - procedural generation(map1-directly used professor's code)(I mean the maze generator).
- The dungeon guard combines path generation and steering-based movement in a way that looks cute.
- The energy-cell unlock system improves the overall structure of the game by tying exploration to the win condition.

---

# Conclusion

Robot Maze Escape is a multi-area AI game that combines procedural level generation, enemy decision making, steering-based movement, group navigation, and an objective-driven progression system. The final implementation is strongest when described area by area: Maze 1 for coordinated flow-field pressure, Maze 2 for drone FSM behaviour, and the dungeon for JPS-based patrol generation with Reynolds Path Following. 

# Further Direction

We can make multiple level by tuning the map creation parameter in world init or by adding more energy cells. Add more AI enemies in future..

---

# Contributors

Mamun Rashid (201960713)   

Shahrier Khan (201856192)   

Please find the CONTRIBUTIONS.md file for detailed report in project root.   


---

# References

AI Assistance  
- ChatGPT (OpenAI)

Used for:
- Debugging assistance
- Algorithm clarification
- Code cleanup guidance
- README structure and polishing

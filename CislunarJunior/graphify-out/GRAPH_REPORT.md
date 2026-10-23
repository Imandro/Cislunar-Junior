# Graph Report - CislunarJunior  (2026-10-22)

## Corpus Check
- cluster-only mode — file stats not available

## Summary
- 484 nodes · 1000 edges · 26 communities (21 shown, 5 thin omitted)
- Extraction: 88% EXTRACTED · 12% INFERRED · 0% AMBIGUOUS · INFERRED: 119 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `9cccbd52`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- Community 0
- Community 1
- Community 2
- Community 3
- Community 4
- Community 5
- Community 6
- Community 7
- Community 8
- Community 10
- Community 11
- Community 12
- Community 13
- Community 14
- Community 15
- Community 16
- Community 17
- Community 18
- Community 19
- Community 21
- Community 22
- Community 23
- Community 24

## God Nodes (most connected - your core abstractions)
1. `MissionModel` - 116 edges
2. `CislunarSimulator` - 84 edges
3. `LaunchVehicleController` - 39 edges
4. `MissionModelTests` - 28 edges
5. `LaunchVehicleState` - 20 edges
6. `LaunchVehiclePlayModeTests` - 17 edges
7. `FlightPhase` - 15 edges
8. `CislunarAssetFactory` - 11 edges
9. `com.unity.modules.imgui` - 9 edges
10. `com.unity.modules.jsonserialize` - 9 edges

## Surprising Connections (you probably didn't know these)
- `CislunarSimulator` --references--> `LaunchVehicleController`  [EXTRACTED]
  Assets/Scripts/CislunarSimulator.cs → Assets/Scripts/LaunchVehicleController.cs
- `CislunarSimulator` --references--> `CockpitFocus`  [EXTRACTED]
  Assets/Scripts/CislunarSimulator.cs → Assets/Scripts/MissionModel.cs
- `CislunarSimulator` --references--> `FlightPhase`  [EXTRACTED]
  Assets/Scripts/CislunarSimulator.cs → Assets/Scripts/MissionModel.cs
- `CislunarSimulator` --references--> `LaunchVehicleState`  [EXTRACTED]
  Assets/Scripts/CislunarSimulator.cs → Assets/Scripts/MissionModel.cs
- `CislunarSimulator` --references--> `MissionModel`  [EXTRACTED]
  Assets/Scripts/CislunarSimulator.cs → Assets/Scripts/MissionModel.cs

## Import Cycles
- None detected.

## Communities (26 total, 5 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.09
Nodes (12): CislunarScenePreview, LaunchVehicleController, CameraTarget, CoreStage, ICPS, RocketRoot, SRBLeft, SRBRight (+4 more)

### Community 1 - "Community 1"
Cohesion: 0.04
Nodes (56): MissionModel, AccelerationMs2, AltitudeKm, AtmosphereColor, AtmosphereName, CanSeparateStage, Communications, CoreSeparated (+48 more)

### Community 2 - "Community 2"
Cohesion: 0.09
Nodes (6): CislunarSimulator, EnvironmentSnapshot, ViewMode, Cockpit, Exterior, Route

### Community 3 - "Community 3"
Cohesion: 0.06
Nodes (26): CockpitFocus, Flight, Overview, Route, Systems, LaunchVehicleState, Ascent, CoreSeparation (+18 more)

### Community 4 - "Community 4"
Cohesion: 0.14
Nodes (3): CislunarAssetFactory, CislunarBuild, CislunarProjectSetup

### Community 5 - "Community 5"
Cohesion: 0.08
Nodes (25): dependencies, com.gamelovers.mcp-unity, com.unity.modules.accessibility, com.unity.modules.adaptiveperformance, com.unity.modules.physics, com.unity.modules.physicscore2d, com.unity.modules.tetgen, com.unity.modules.timelinefoundation (+17 more)

### Community 8 - "Community 8"
Cohesion: 0.10
Nodes (21): dependencies, depth, hash, source, version, dependencies, depth, source (+13 more)

### Community 10 - "Community 10"
Cohesion: 0.12
Nodes (16): com.unity.modules.physics, com.unity.modules.physicscore2d, com.unity.modules.ui, com.unity.test-framework, com.unity.editorcoroutines, com.unity.ext.nunit, com.unity.modules.animation, com.unity.modules.audio (+8 more)

### Community 11 - "Community 11"
Cohesion: 0.15
Nodes (12): FlightPhase, Arrival, Ascent, Complete, Descent, Launch, Pad, ParkingOrbit (+4 more)

### Community 12 - "Community 12"
Cohesion: 0.18
Nodes (11): dependencies, depth, source, version, dependencies, depth, source, version (+3 more)

### Community 13 - "Community 13"
Cohesion: 0.18
Nodes (11): dependencies, depth, source, version, dependencies, depth, source, version (+3 more)

### Community 14 - "Community 14"
Cohesion: 0.20
Nodes (10): dependencies, depth, source, version, dependencies, depth, source, version (+2 more)

### Community 15 - "Community 15"
Cohesion: 0.20
Nodes (10): dependencies, depth, source, version, dependencies, depth, source, version (+2 more)

### Community 16 - "Community 16"
Cohesion: 0.20
Nodes (10): dependencies, depth, source, version, dependencies, depth, source, version (+2 more)

### Community 17 - "Community 17"
Cohesion: 0.20
Nodes (10): dependencies, depth, source, version, dependencies, depth, source, version (+2 more)

### Community 18 - "Community 18"
Cohesion: 0.20
Nodes (10): dependencies, depth, source, version, dependencies, depth, source, version (+2 more)

### Community 19 - "Community 19"
Cohesion: 0.22
Nodes (9): depth, source, version, dependencies, depth, source, version, com.unity.modules.uielements (+1 more)

### Community 21 - "Community 21"
Cohesion: 0.33
Nodes (6): dependencies, depth, source, version, dependencies, com.unity.modules.accessibility

### Community 22 - "Community 22"
Cohesion: 0.40
Nodes (5): dependencies, depth, source, version, com.unity.modules.physics

### Community 23 - "Community 23"
Cohesion: 0.40
Nodes (5): dependencies, depth, source, version, com.unity.modules.tetgen

### Community 24 - "Community 24"
Cohesion: 0.40
Nodes (5): dependencies, depth, source, version, com.unity.modules.ui

## Knowledge Gaps
- **129 isolated node(s):** `State`, `RocketRoot`, `SRBLeft`, `SRBRight`, `CoreStage` (+124 more)
  These have ≤1 connection - possible missing edges. (Counts symbols only; 246 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **5 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `MissionModel` connect `Community 1` to `Community 0`, `Community 2`, `Community 3`, `Community 6`, `Community 7`, `Community 9`, `Community 11`, `Community 25`?**
  _High betweenness centrality (0.221) - this node is a cross-community bridge._
- **Are the 33 inferred relationships involving `MissionModel` (e.g. with `.Awake()` and `.AdvancingPhaseDoesNotTeleportTelemetry()`) actually correct?**
  _`MissionModel` has 33 INFERRED edges - model-reasoned connections that need verification._
- **What connects `State`, `RocketRoot`, `SRBLeft` to the rest of the system?**
  _129 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.08653846153846154 - nodes in this community are weakly interconnected._
- **Why does `CislunarSimulator` connect `Community 2` to `Community 0`, `Community 1`, `Community 3`, `Community 4`, `Community 7`, `Community 11`?**
  _High betweenness centrality (0.176) - this node is a cross-community bridge._
- **Should `Community 1` be split into smaller, more focused modules?**
  _Cohesion score 0.03508771929824561 - nodes in this community are weakly interconnected._
- **Why does `dependencies` connect `Community 21` to `Community 8`, `Community 10`, `Community 12`, `Community 13`, `Community 14`, `Community 15`, `Community 16`, `Community 17`, `Community 18`, `Community 19`, `Community 22`, `Community 23`, `Community 24`?**
  _High betweenness centrality (0.072) - this node is a cross-community bridge._
# Graph Report - databricks  (2026-09-13)

## Corpus Check
- Corpus is ~5,983 words - fits in a single context window. You may not need a graph.

## Summary
- 121 nodes · 136 edges · 15 communities (8 shown, 4 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- Squad Suggestions UI
- App Layout & Package
- TypeScript Config
- FPL API Routes
- Database Layer
- Research Team Manager
- Dev Dependencies
- Runtime Dependencies
- Next.js Config
- DB Table Creation
- Next Env Types
- Credential Tests

## God Nodes (most connected - your core abstractions)
1. `compilerOptions` - 16 edges
2. `fetchFplJson()` - 7 edges
3. `fetchPredictions()` - 4 edges
4. `fetchPlayers()` - 4 edges
5. `scripts` - 4 edges
6. `GET()` - 3 edges
7. `GET()` - 3 edges
8. `Home()` - 3 edges
9. `getPool()` - 3 edges
10. `chooseGameweek()` - 3 edges

## Surprising Connections (you probably didn't know these)
- `GET()` --calls--> `fetchFplJson()`  [EXTRACTED]
  frontend/app/api/manager/route.ts → frontend/lib/fpl.ts
- `GET()` --calls--> `fetchFplJson()`  [EXTRACTED]
  frontend/app/api/picks/route.ts → frontend/lib/fpl.ts
- `GET()` --calls--> `chooseGameweek()`  [EXTRACTED]
  frontend/app/api/bootstrap/route.ts → frontend/lib/fpl.ts
- `GET()` --calls--> `fetchFplJson()`  [EXTRACTED]
  frontend/app/api/bootstrap/route.ts → frontend/lib/fpl.ts
- `GET()` --calls--> `fetchPlayers()`  [EXTRACTED]
  frontend/app/api/data/route.ts → frontend/lib/db.ts

## Import Cycles
- None detected.

## Communities (15 total, 4 thin omitted)

### Community 0 - "Squad Suggestions UI"
Cohesion: 0.12
Nodes (14): Bootstrap, Home(), Manager, POS_COLORS, PredictionRow, findReplacements(), generateSuggestions(), POS_BY_ELEMENT (+6 more)

### Community 1 - "App Layout & Package"
Cohesion: 0.10
Nodes (17): metadata, name, private, scripts, build, dev, start, version (+9 more)

### Community 2 - "TypeScript Config"
Cohesion: 0.11
Nodes (18): compilerOptions, allowJs, esModuleInterop, incremental, isolatedModules, jsx, lib, module (+10 more)

### Community 3 - "FPL API Routes"
Cohesion: 0.26
Nodes (8): GET(), GET(), GET(), BASE_URL, chooseGameweek(), fetchFplJson(), HEADERS, TeamRow

### Community 4 - "Database Layer"
Cohesion: 0.26
Nodes (9): GET(), fs, { Pool }, fetchPlayers(), fetchPredictions(), getPool(), GwPrediction, PlayerRow (+1 more)

### Community 5 - "Research Team Manager"
Cohesion: 0.22
Nodes (8): build_team_rows(), choose_gameweek(), fetch_fpl_json(), find_replacements(), Fetch and decode one FPL API endpoint., Find replacement candidates, optionally preferring ones that reinvest budget., Use the requested GW, otherwise current GW, then most recently finished GW., Join pick records to readable player, club, and position information.

### Community 6 - "Dev Dependencies"
Cohesion: 0.25
Nodes (8): devDependencies, autoprefixer, postcss, tailwindcss, @types/node, @types/pg, @types/react, typescript

### Community 7 - "Runtime Dependencies"
Cohesion: 0.40
Nodes (5): dependencies, next, pg, react, react-dom

## Knowledge Gaps
- **56 isolated node(s):** `fs`, `{ Pool }`, `metadata`, `Manager`, `Bootstrap` (+51 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 78 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **4 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `react` connect `Squad Suggestions UI` to `App Layout & Package`?**
  _High betweenness centrality (0.130) - this node is a cross-community bridge._
- **Why does `pg` connect `Database Layer` to `App Layout & Package`?**
  _High betweenness centrality (0.094) - this node is a cross-community bridge._
- **Why does `devDependencies` connect `Dev Dependencies` to `App Layout & Package`?**
  _High betweenness centrality (0.073) - this node is a cross-community bridge._
- **What connects `fs`, `{ Pool }`, `metadata` to the rest of the system?**
  _56 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Squad Suggestions UI` be split into smaller, more focused modules?**
  _Cohesion score 0.12380952380952381 - nodes in this community are weakly interconnected._
- **Should `App Layout & Package` be split into smaller, more focused modules?**
  _Cohesion score 0.1 - nodes in this community are weakly interconnected._
- **Should `TypeScript Config` be split into smaller, more focused modules?**
  _Cohesion score 0.10526315789473684 - nodes in this community are weakly interconnected._
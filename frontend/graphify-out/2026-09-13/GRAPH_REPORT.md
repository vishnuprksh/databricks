# Graph Report - frontend  (2026-09-13)

## Corpus Check
- cluster-only mode — file stats not available

## Summary
- 106 nodes · 125 edges · 11 communities (7 shown, 2 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `0a15a519`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- suggestions.ts
- package.json
- compilerOptions
- fpl.ts
- db.ts
- devDependencies
- dependencies
- next.config.js
- next-env.d.ts

## God Nodes (most connected - your core abstractions)
1. `compilerOptions` - 16 edges
2. `fetchFplJson()` - 7 edges
3. `fetchPlayers()` - 4 edges
4. `fetchPredictions()` - 4 edges
5. `scripts` - 4 edges
6. `TeamRow` - 3 edges
7. `Home()` - 3 edges
8. `generateSuggestions()` - 3 edges
9. `GET()` - 3 edges
10. `chooseGameweek()` - 3 edges

## Surprising Connections (you probably didn't know these)
- `GET()` --calls--> `fetchFplJson()`  [EXTRACTED]
  app/api/manager/route.ts → lib/fpl.ts
- `GET()` --calls--> `fetchFplJson()`  [EXTRACTED]
  app/api/picks/route.ts → lib/fpl.ts
- `Home()` --calls--> `generateSuggestions()`  [EXTRACTED]
  app/page.tsx → lib/suggestions.ts
- `GET()` --calls--> `chooseGameweek()`  [EXTRACTED]
  app/api/bootstrap/route.ts → lib/fpl.ts
- `GET()` --calls--> `fetchFplJson()`  [EXTRACTED]
  app/api/bootstrap/route.ts → lib/fpl.ts

## Import Cycles
- None detected.

## Communities (11 total, 2 thin omitted)

### Community 0 - "suggestions.ts"
Cohesion: 0.12
Nodes (14): Bootstrap, Home(), Manager, POS_COLORS, PredictionRow, findReplacements(), generateSuggestions(), POS_BY_ELEMENT (+6 more)

### Community 1 - "package.json"
Cohesion: 0.10
Nodes (17): metadata, name, private, scripts, build, dev, start, version (+9 more)

### Community 2 - "compilerOptions"
Cohesion: 0.11
Nodes (18): compilerOptions, allowJs, esModuleInterop, incremental, isolatedModules, jsx, lib, module (+10 more)

### Community 3 - "fpl.ts"
Cohesion: 0.26
Nodes (8): GET(), GET(), GET(), BASE_URL, chooseGameweek(), fetchFplJson(), HEADERS, TeamRow

### Community 4 - "db.ts"
Cohesion: 0.26
Nodes (9): GET(), fs, { Pool }, fetchPlayers(), fetchPredictions(), getPool(), GwPrediction, PlayerRow (+1 more)

### Community 5 - "devDependencies"
Cohesion: 0.25
Nodes (8): devDependencies, autoprefixer, postcss, tailwindcss, @types/node, @types/pg, @types/react, typescript

### Community 6 - "dependencies"
Cohesion: 0.40
Nodes (5): dependencies, next, pg, react, react-dom

## Knowledge Gaps
- **56 isolated node(s):** `Bootstrap`, `Manager`, `Replacement`, `TransferRecord`, `GwPrediction` (+51 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 69 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **2 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `react` connect `suggestions.ts` to `package.json`?**
  _High betweenness centrality (0.169) - this node is a cross-community bridge._
- **Why does `pg` connect `db.ts` to `package.json`?**
  _High betweenness centrality (0.123) - this node is a cross-community bridge._
- **Why does `devDependencies` connect `devDependencies` to `package.json`?**
  _High betweenness centrality (0.095) - this node is a cross-community bridge._
- **What connects `Bootstrap`, `Manager`, `Replacement` to the rest of the system?**
  _56 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `suggestions.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.12380952380952381 - nodes in this community are weakly interconnected._
- **Should `package.json` be split into smaller, more focused modules?**
  _Cohesion score 0.1 - nodes in this community are weakly interconnected._
- **Should `compilerOptions` be split into smaller, more focused modules?**
  _Cohesion score 0.10526315789473684 - nodes in this community are weakly interconnected._
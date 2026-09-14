# Graph Report - frontend  (2026-09-13)

## Corpus Check
- 17 files · ~4,410 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 3 file(s) not represented in the graph (top: .example 1, (none) 1, .css 1)

## Summary
- 115 nodes · 135 edges · 12 communities (8 shown, 2 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `46c204c7`
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
- FPL Team Manager — Vercel Frontend

## God Nodes (most connected - your core abstractions)
1. `compilerOptions` - 16 edges
2. `fetchFplJson()` - 7 edges
3. `FPL Team Manager — Vercel Frontend` - 5 edges
4. `Home()` - 4 edges
5. `fetchPredictions()` - 4 edges
6. `fetchPlayers()` - 4 edges
7. `scripts` - 4 edges
8. `GET()` - 3 edges
9. `GET()` - 3 edges
10. `getPool()` - 3 edges

## Surprising Connections (you probably didn't know these)
- `GET()` --calls--> `fetchFplJson()`  [EXTRACTED]
  app/api/manager/route.ts → lib/fpl.ts
- `GET()` --calls--> `fetchFplJson()`  [EXTRACTED]
  app/api/picks/route.ts → lib/fpl.ts
- `GET()` --calls--> `chooseGameweek()`  [EXTRACTED]
  app/api/bootstrap/route.ts → lib/fpl.ts
- `GET()` --calls--> `fetchFplJson()`  [EXTRACTED]
  app/api/bootstrap/route.ts → lib/fpl.ts
- `GET()` --calls--> `fetchPlayers()`  [EXTRACTED]
  app/api/data/route.ts → lib/db.ts

## Import Cycles
- None detected.

## Communities (12 total, 2 thin omitted)

### Community 0 - "suggestions.ts"
Cohesion: 0.11
Nodes (17): Bootstrap, Home(), Manager, POS_COLORS, PredictionRow, findReplacements(), generateSuggestions(), OptimizeResult (+9 more)

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

### Community 11 - "FPL Team Manager — Vercel Frontend"
Cohesion: 0.33
Nodes (5): API routes, Deploy to Vercel, Env vars, FPL Team Manager — Vercel Frontend, Setup (local dev)

## Knowledge Gaps
- **61 isolated node(s):** `fs`, `{ Pool }`, `metadata`, `Manager`, `Bootstrap` (+56 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 75 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **2 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `react` connect `suggestions.ts` to `package.json`?**
  _High betweenness centrality (0.155) - this node is a cross-community bridge._
- **Why does `pg` connect `db.ts` to `package.json`?**
  _High betweenness centrality (0.110) - this node is a cross-community bridge._
- **Why does `devDependencies` connect `devDependencies` to `package.json`?**
  _High betweenness centrality (0.084) - this node is a cross-community bridge._
- **What connects `fs`, `{ Pool }`, `metadata` to the rest of the system?**
  _61 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `suggestions.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.11231884057971014 - nodes in this community are weakly interconnected._
- **Should `package.json` be split into smaller, more focused modules?**
  _Cohesion score 0.1 - nodes in this community are weakly interconnected._
- **Should `compilerOptions` be split into smaller, more focused modules?**
  _Cohesion score 0.10526315789473684 - nodes in this community are weakly interconnected._
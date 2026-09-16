# Graph Report - frontend  (2026-09-16)

## Corpus Check
- 17 files · ~4,760 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 3 file(s) not represented in the graph (top: .example 1, (none) 1, .css 1)

## Summary
- 116 nodes · 144 edges · 12 communities (8 shown, 2 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `be137e82`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- suggestions.ts
- package.json
- compilerOptions
- fpl.ts
- db.ts
- devDependencies
- FPL Team Manager — Vercel Frontend
- dependencies
- next.config.js
- next-env.d.ts

## God Nodes (most connected - your core abstractions)
1. `compilerOptions` - 16 edges
2. `fetchFplJson()` - 7 edges
3. `Home()` - 5 edges
4. `findBestTransfer()` - 5 edges
5. `FPL Team Manager — Vercel Frontend` - 5 edges
6. `fetchPredictions()` - 4 edges
7. `fetchPlayers()` - 4 edges
8. `generateSuggestions()` - 4 edges
9. `optimizeStartingEleven()` - 4 edges
10. `scripts` - 4 edges

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
Cohesion: 0.14
Nodes (16): Bootstrap, Home(), Manager, POS_COLORS, findBestTransfer(), findReplacements(), generateSuggestions(), OptimizeResult (+8 more)

### Community 1 - "package.json"
Cohesion: 0.10
Nodes (18): metadata, name, private, scripts, build, dev, start, version (+10 more)

### Community 2 - "compilerOptions"
Cohesion: 0.11
Nodes (18): compilerOptions, allowJs, esModuleInterop, incremental, isolatedModules, jsx, lib, module (+10 more)

### Community 3 - "fpl.ts"
Cohesion: 0.26
Nodes (8): GET(), GET(), GET(), BASE_URL, chooseGameweek(), fetchFplJson(), HEADERS, TeamRow

### Community 4 - "db.ts"
Cohesion: 0.23
Nodes (10): GET(), fs, { Pool }, fetchPlayers(), fetchPredictions(), getPool(), GwPrediction, PlayerRow (+2 more)

### Community 5 - "devDependencies"
Cohesion: 0.25
Nodes (8): devDependencies, autoprefixer, postcss, tailwindcss, @types/node, @types/pg, @types/react, typescript

### Community 6 - "FPL Team Manager — Vercel Frontend"
Cohesion: 0.33
Nodes (5): API routes, Deploy to Vercel, Env vars, FPL Team Manager — Vercel Frontend, Setup (local dev)

### Community 7 - "dependencies"
Cohesion: 0.40
Nodes (5): dependencies, next, pg, react, react-dom

## Knowledge Gaps
- **61 isolated node(s):** `fs`, `{ Pool }`, `metadata`, `Manager`, `Bootstrap` (+56 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 75 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **2 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `react` connect `package.json` to `suggestions.ts`?**
  _High betweenness centrality (0.162) - this node is a cross-community bridge._
- **Why does `pg` connect `db.ts` to `package.json`?**
  _High betweenness centrality (0.100) - this node is a cross-community bridge._
- **Why does `devDependencies` connect `devDependencies` to `package.json`?**
  _High betweenness centrality (0.083) - this node is a cross-community bridge._
- **What connects `fs`, `{ Pool }`, `metadata` to the rest of the system?**
  _61 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `suggestions.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.1422924901185771 - nodes in this community are weakly interconnected._
- **Should `package.json` be split into smaller, more focused modules?**
  _Cohesion score 0.09523809523809523 - nodes in this community are weakly interconnected._
- **Should `compilerOptions` be split into smaller, more focused modules?**
  _Cohesion score 0.10526315789473684 - nodes in this community are weakly interconnected._
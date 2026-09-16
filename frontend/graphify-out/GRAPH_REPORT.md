# Graph Report - frontend  (2026-09-16)

## Corpus Check
- cluster-only mode — file stats not available

## Summary
- 119 nodes · 150 edges · 13 communities (8 shown, 3 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `f7bf2daa`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- suggestions.ts
- package.json
- compilerOptions
- db.ts
- fpl.ts
- devDependencies
- FPL Team Manager — Vercel Frontend
- dependencies
- layout.tsx
- next.config.js
- next-env.d.ts

## God Nodes (most connected - your core abstractions)
1. `compilerOptions` - 16 edges
2. `fetchFplJson()` - 7 edges
3. `Home()` - 5 edges
4. `findBestTransfer()` - 5 edges
5. `FPL Team Manager — Vercel Frontend` - 5 edges
6. `PredictionRow` - 4 edges
7. `generateSuggestions()` - 4 edges
8. `optimizeStartingEleven()` - 4 edges
9. `fetchPlayers()` - 4 edges
10. `fetchPredictions()` - 4 edges

## Surprising Connections (you probably didn't know these)
- `GET()` --calls--> `fetchFplJson()`  [EXTRACTED]
  app/api/manager/route.ts → lib/fpl.ts
- `GET()` --calls--> `fetchFplJson()`  [EXTRACTED]
  app/api/picks/route.ts → lib/fpl.ts
- `Home()` --calls--> `findBestTransfer()`  [EXTRACTED]
  app/page.tsx → lib/suggestions.ts
- `Home()` --calls--> `generateSuggestions()`  [EXTRACTED]
  app/page.tsx → lib/suggestions.ts
- `Home()` --calls--> `optimizeStartingEleven()`  [EXTRACTED]
  app/page.tsx → lib/suggestions.ts

## Import Cycles
- None detected.

## Communities (13 total, 3 thin omitted)

### Community 0 - "suggestions.ts"
Cohesion: 0.14
Nodes (16): Bootstrap, Home(), Manager, POS_COLORS, findBestTransfer(), findReplacements(), generateSuggestions(), OptimizeResult (+8 more)

### Community 1 - "package.json"
Cohesion: 0.10
Nodes (18): fs, { Pool }, name, private, scripts, build, dev, start (+10 more)

### Community 2 - "compilerOptions"
Cohesion: 0.11
Nodes (18): compilerOptions, allowJs, esModuleInterop, incremental, isolatedModules, jsx, lib, module (+10 more)

### Community 3 - "db.ts"
Cohesion: 0.21
Nodes (10): GET(), POS_COLORS, SortKey, fetchPlayers(), fetchPredictions(), getPool(), GwPrediction, PlayerRow (+2 more)

### Community 4 - "fpl.ts"
Cohesion: 0.26
Nodes (8): GET(), GET(), GET(), BASE_URL, chooseGameweek(), fetchFplJson(), HEADERS, TeamRow

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
- **62 isolated node(s):** `Bootstrap`, `Manager`, `Replacement`, `TransferRecord`, `GwPrediction` (+57 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 77 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **3 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `react` connect `db.ts` to `suggestions.ts`, `package.json`?**
  _High betweenness centrality (0.186) - this node is a cross-community bridge._
- **Why does `pg` connect `package.json` to `db.ts`?**
  _High betweenness centrality (0.094) - this node is a cross-community bridge._
- **Why does `devDependencies` connect `devDependencies` to `package.json`?**
  _High betweenness centrality (0.084) - this node is a cross-community bridge._
- **What connects `Bootstrap`, `Manager`, `Replacement` to the rest of the system?**
  _62 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `suggestions.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.1422924901185771 - nodes in this community are weakly interconnected._
- **Should `package.json` be split into smaller, more focused modules?**
  _Cohesion score 0.1 - nodes in this community are weakly interconnected._
- **Should `compilerOptions` be split into smaller, more focused modules?**
  _Cohesion score 0.10526315789473684 - nodes in this community are weakly interconnected._
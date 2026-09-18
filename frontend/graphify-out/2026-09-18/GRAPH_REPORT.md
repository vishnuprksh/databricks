# Graph Report - frontend  (2026-09-18)

## Corpus Check
- cluster-only mode — file stats not available

## Summary
- 170 nodes · 228 edges · 17 communities (11 shown, 3 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `527cf90c`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- suggestions.ts
- db.ts
- package.json
- compilerOptions
- app/page.tsx
- fpl.ts
- devDependencies
- fixtures/page.tsx
- FPL Team Manager — Vercel Frontend
- layout.tsx
- dependencies
- javascript-lp-solver.d.ts
- next.config.js
- next-env.d.ts

## God Nodes (most connected - your core abstractions)
1. `compilerOptions` - 16 edges
2. `fetchFplJson()` - 9 edges
3. `optimizeStartingEleven()` - 6 edges
4. `getPool()` - 6 edges
5. `FPL Team Manager — Vercel Frontend` - 6 edges
6. `PredictionRow` - 5 edges
7. `findBestTransferPlan()` - 5 edges
8. `optimizeDream15()` - 5 edges
9. `fetchPlayerMatchDetails()` - 5 edges
10. `react` - 5 edges

## Surprising Connections (you probably didn't know these)
- `Dream15Page()` --calls--> `optimizeDream15()`  [EXTRACTED]
  app/dream15/page.tsx → lib/suggestions.ts
- `GET()` --calls--> `fetchFplJson()`  [EXTRACTED]
  app/api/data/route.ts → lib/fpl.ts
- `GET()` --calls--> `fetchPlayerMatchDetails()`  [EXTRACTED]
  app/api/fixtures/route.ts → lib/db.ts
- `GET()` --calls--> `getPool()`  [EXTRACTED]
  app/api/fixture-matrix/route.ts → lib/db.ts
- `GET()` --calls--> `fetchFplJson()`  [EXTRACTED]
  app/api/manager/route.ts → lib/fpl.ts

## Import Cycles
- None detected.

## Communities (17 total, 3 thin omitted)

### Community 0 - "suggestions.ts"
Cohesion: 0.09
Nodes (21): Dream15Page(), POS_COLORS, ROW_BG, ROW_ORDER, Home(), Dream15Result, dreamPlayers(), findBestTransfer() (+13 more)

### Community 1 - "db.ts"
Cohesion: 0.13
Nodes (18): GET(), dynamic, FixtureMatrixRow, GET(), dynamic, GET(), POS_COLORS, SortKey (+10 more)

### Community 2 - "package.json"
Cohesion: 0.10
Nodes (19): fs, { Pool }, name, private, scripts, build, dev, start (+11 more)

### Community 3 - "compilerOptions"
Cohesion: 0.11
Nodes (18): compilerOptions, allowJs, esModuleInterop, incremental, isolatedModules, jsx, lib, module (+10 more)

### Community 4 - "app/page.tsx"
Cohesion: 0.14
Nodes (10): Bootstrap, injuryCardClass(), isLegalFplSubstitution(), Manager, MINI_CARD_TONE, Pitch(), PlayerCard(), POS_COLORS (+2 more)

### Community 5 - "fpl.ts"
Cohesion: 0.26
Nodes (8): GET(), GET(), GET(), BASE_URL, chooseGameweek(), fetchFplJson(), HEADERS, TeamRow

### Community 6 - "devDependencies"
Cohesion: 0.25
Nodes (8): devDependencies, autoprefixer, postcss, tailwindcss, @types/node, @types/pg, @types/react, typescript

### Community 7 - "fixtures/page.tsx"
Cohesion: 0.38
Nodes (6): Direction, FixtureRow, FixturesPage(), fmtKickoff(), probColor(), react

### Community 8 - "FPL Team Manager — Vercel Frontend"
Cohesion: 0.29
Nodes (6): API routes, Deploy to Vercel, Env vars, FPL Team Manager — Vercel Frontend, Pages, Setup (local dev)

### Community 9 - "layout.tsx"
Cohesion: 0.40
Nodes (3): metadata, SiteHeader(), next

### Community 10 - "dependencies"
Cohesion: 0.33
Nodes (6): dependencies, javascript-lp-solver, next, pg, react, react-dom

## Knowledge Gaps
- **76 isolated node(s):** `TransferRecord`, `FixtureDifficultyRow`, `GwPrediction`, `SortKey`, `FixtureMatrixRow` (+71 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 101 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **3 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `react` connect `fixtures/page.tsx` to `suggestions.ts`, `db.ts`, `package.json`, `app/page.tsx`?**
  _High betweenness centrality (0.170) - this node is a cross-community bridge._
- **Why does `pg` connect `package.json` to `db.ts`?**
  _High betweenness centrality (0.075) - this node is a cross-community bridge._
- **Why does `devDependencies` connect `devDependencies` to `package.json`?**
  _High betweenness centrality (0.063) - this node is a cross-community bridge._
- **What connects `TransferRecord`, `FixtureDifficultyRow`, `GwPrediction` to the rest of the system?**
  _76 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `suggestions.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.09247311827956989 - nodes in this community are weakly interconnected._
- **Should `db.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.12666666666666668 - nodes in this community are weakly interconnected._
- **Should `package.json` be split into smaller, more focused modules?**
  _Cohesion score 0.09523809523809523 - nodes in this community are weakly interconnected._
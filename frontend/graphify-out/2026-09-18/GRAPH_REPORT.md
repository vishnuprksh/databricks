# Graph Report - frontend  (2026-09-18)

## Corpus Check
- cluster-only mode — file stats not available

## Summary
- 149 nodes · 194 edges · 16 communities (10 shown, 3 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `f505b74d`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- suggestions.ts
- compilerOptions
- dream15/page.tsx
- package.json
- fpl.ts
- db.ts
- devDependencies
- FPL Team Manager — Vercel Frontend
- layout.tsx
- dependencies
- javascript-lp-solver.d.ts
- next.config.js
- next-env.d.ts

## God Nodes (most connected - your core abstractions)
1. `compilerOptions` - 16 edges
2. `fetchFplJson()` - 7 edges
3. `optimizeStartingEleven()` - 6 edges
4. `FPL Team Manager — Vercel Frontend` - 6 edges
5. `PredictionRow` - 5 edges
6. `findBestTransferPlan()` - 5 edges
7. `optimizeDream15()` - 5 edges
8. `PlayerRow` - 4 edges
9. `Home()` - 4 edges
10. `findReplacements()` - 4 edges

## Surprising Connections (you probably didn't know these)
- `Dream15Page()` --calls--> `optimizeDream15()`  [EXTRACTED]
  app/dream15/page.tsx → lib/suggestions.ts
- `GET()` --calls--> `fetchFplJson()`  [EXTRACTED]
  app/api/manager/route.ts → lib/fpl.ts
- `GET()` --calls--> `fetchFplJson()`  [EXTRACTED]
  app/api/picks/route.ts → lib/fpl.ts
- `Home()` --calls--> `findBestTransferPlan()`  [EXTRACTED]
  app/page.tsx → lib/suggestions.ts
- `Home()` --calls--> `listTransferOptions()`  [EXTRACTED]
  app/page.tsx → lib/suggestions.ts

## Import Cycles
- None detected.

## Communities (16 total, 3 thin omitted)

### Community 0 - "suggestions.ts"
Cohesion: 0.09
Nodes (23): Dream15Page(), Bootstrap, Home(), isLegalFplSubstitution(), Manager, Pitch(), POS_COLORS, ROW_BG (+15 more)

### Community 1 - "compilerOptions"
Cohesion: 0.11
Nodes (18): compilerOptions, allowJs, esModuleInterop, incremental, isolatedModules, jsx, lib, module (+10 more)

### Community 2 - "dream15/page.tsx"
Cohesion: 0.12
Nodes (10): POS_COLORS, ROW_BG, ROW_ORDER, POS_COLORS, SortKey, PlayerRow, PredictionRow, Dream15Result (+2 more)

### Community 3 - "package.json"
Cohesion: 0.12
Nodes (16): name, private, scripts, build, dev, start, version, autoprefixer (+8 more)

### Community 4 - "fpl.ts"
Cohesion: 0.26
Nodes (8): GET(), GET(), GET(), BASE_URL, chooseGameweek(), fetchFplJson(), HEADERS, TeamRow

### Community 5 - "db.ts"
Cohesion: 0.29
Nodes (8): GET(), fs, { Pool }, fetchPlayers(), fetchPredictions(), getPool(), GwPrediction, pg

### Community 6 - "devDependencies"
Cohesion: 0.25
Nodes (8): devDependencies, autoprefixer, postcss, tailwindcss, @types/node, @types/pg, @types/react, typescript

### Community 7 - "FPL Team Manager — Vercel Frontend"
Cohesion: 0.29
Nodes (6): API routes, Deploy to Vercel, Env vars, FPL Team Manager — Vercel Frontend, Pages, Setup (local dev)

### Community 8 - "layout.tsx"
Cohesion: 0.40
Nodes (3): metadata, SiteHeader(), next

### Community 9 - "dependencies"
Cohesion: 0.33
Nodes (6): dependencies, javascript-lp-solver, next, pg, react, react-dom

## Knowledge Gaps
- **69 isolated node(s):** `Bootstrap`, `Manager`, `TransferRecord`, `LpModel`, `SortKey` (+64 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 93 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **3 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `react` connect `dream15/page.tsx` to `suggestions.ts`, `package.json`?**
  _High betweenness centrality (0.139) - this node is a cross-community bridge._
- **Why does `javascript-lp-solver` connect `package.json` to `suggestions.ts`?**
  _High betweenness centrality (0.075) - this node is a cross-community bridge._
- **Why does `devDependencies` connect `devDependencies` to `package.json`?**
  _High betweenness centrality (0.069) - this node is a cross-community bridge._
- **What connects `Bootstrap`, `Manager`, `TransferRecord` to the rest of the system?**
  _69 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `suggestions.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.0946969696969697 - nodes in this community are weakly interconnected._
- **Should `compilerOptions` be split into smaller, more focused modules?**
  _Cohesion score 0.10526315789473684 - nodes in this community are weakly interconnected._
- **Should `dream15/page.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.12418300653594772 - nodes in this community are weakly interconnected._
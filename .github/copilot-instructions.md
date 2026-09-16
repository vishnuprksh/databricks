# Copilot Instructions — databricks (FPL Team Manager)

## What This Project Is
A Fantasy Premier League (FPL) team manager: a Next.js 14 frontend (`frontend/`) backed by a Postgres database with player data and ML predictions.

## Conventions
- Validate UI changes in the integrated browser (http://127.0.0.1:3000/) after editing frontend code.
- `graphify-out/` is generated output (knowledge-graph artifacts) — treat as build output; do not hand-edit. Regenerate via the `graphify` skill after significant code changes.

## Workflow Expectations
1. When a request is unclear, use the graphify skill / `graphify-out/GRAPH_REPORT.md` to understand codebase context first.
2. If a request is impractical or needs manual user action (credentials, external services), pause and tell the user explicitly.
3. Verify UI changes in the integrated browser before declaring done.

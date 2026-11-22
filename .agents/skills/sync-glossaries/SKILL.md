---
name: sync-glossaries
description: Audit and reconcile domain glossary drift, contradictions, and _Avoid_ violations across vescape, vescape-server, and vescape-web while keeping each repo's GLOSSARY.md local. Use when the user invokes /sync-glossaries or asks to check/sync glossaries across the Vescape repos.
---

# Sync Glossaries

Audit `GLOSSARY.md` across all three Vescape repositories without merging them into a single file. Each repo keeps its own local `GLOSSARY.md` so `/domain-modeling` and `/grill-with-docs` stay local and frictionless.

## Source of truth

Read all existing glossaries from the workspace siblings:

1. `../vescape/GLOSSARY.md` — **canonical source of truth for shared domain terms**
2. `../vescape-server/GLOSSARY.md` — backend/sync/relay/admin terms + shared term alignment
3. `../vescape-web/GLOSSARY.md` — web/map/marketing terms (may not exist yet; skip cleanly if absent)

Also skim `../vescape/docs/adr/` and `../vescape-server/docs/adr/` titles when a definition conflict looks like an architectural shift.

## What to check

1. **Contradictory definitions**: a term defined in more than one glossary with incompatible meaning, lifecycle, or invariants.
2. **Naming drift**: the same concept called different names across repos (especially where `../vescape/GLOSSARY.md` already has an established term).
3. **`_Avoid_` violations**: a glossary using a term that `../vescape/GLOSSARY.md` (or another glossary) explicitly lists under `_Avoid_`.
4. **Stale cross-references**: links or references to renamed terms, removed concepts, or outdated paths (e.g. `CONTEXT.md` instead of `GLOSSARY.md`).
5. **Missing shared terms (lightweight)**: terms heavily used in `vescape-server` or `vescape-web` that belong in `../vescape/GLOSSARY.md` (or vice versa) because they cross the wire contract.

Do **not** flag repo-local terms (e.g., native iOS/Android internals in `vescape`, Postgres/Admin Panel internals in `vescape-server`) as drift just because they only appear in one repo.

## Workflow

1. Read the available `GLOSSARY.md` files in parallel.
2. Produce a concise report grouped by:
   - **Contradictions** (must resolve)
   - **`_Avoid_` violations**
   - **Naming drift / stale references**
   - **Suggested additions** (optional, cross-repo terms only)
3. For each finding, cite the exact files and line numbers, quote the conflicting definitions briefly, and propose the concrete edit.
4. Wait for the user's approval before editing any sibling repo's `GLOSSARY.md`. If a finding conflicts with an existing ADR, surface the ADR instead of silently overriding it.
5. After applying approved edits, summarize which repo `GLOSSARY.md` files changed (do not commit or push unless asked).

# Vescape Home

Home repository for cross-repo Vescape work and the single source of truth for shared agent skills across all three Vescape repositories.

## Companion repositories

All three Vescape repos live as siblings under the same workspace directory:

| Repo | Path | Role | Domain glossary |
| --- | --- | --- | --- |
| **vescape** | `../vescape` | Mobile app (React Native / Expo, native iOS & Android `vescape-core`, Wear OS / watchOS) | `../vescape/GLOSSARY.md` (source of truth for shared domain terms) |
| **vescape-server** | `../vescape-server` | Backend API, Postgres sync, Group Ride WebSocket relay, Admin Panel | `../vescape-server/GLOSSARY.md` |
| **vescape-web** | `../vescape-web` | Marketing site, public Group Ride map, `/updates` release notes (TanStack Start) | `../vescape-web/GLOSSARY.md` (if present) |

When work touches shared behavior, wire contracts, feature design, or domain language:

- Treat `../vescape/GLOSSARY.md` as the source of truth for shared domain terms and check `../vescape/docs/adr/` and `../vescape-server/docs/adr/`.
- Keep each repo's `GLOSSARY.md` local (no shared-file split) and use `/sync-glossaries` to detect and reconcile drift, contradictions, and `_Avoid_` violations across repos.

## Shared skills (`skills/`)

`skills/` is the single source of truth for workflow skills shared across `vescape`, `vescape-server`, and `vescape-web`.

- **Always use Bun**: `bun run sync`, `bun run sync:check`.
- **Edit shared skills here**, never directly in a target repo's `.agents/skills/` copy.
- **Sync to sibling repos**:
  - `bun run sync` — copies every skill in `skills/` into `../vescape/.agents/skills/`, `../vescape-server/.agents/skills/`, and `../vescape-web/.agents/skills/`.
  - `bun run sync -- --target vescape-server,vescape-web` — sync specific repos only.
  - `bun run sync:check` — dry-run drift check (exits non-zero if any managed skill differs).
- **Repo-specific skills are never touched** by `sync` (`admin-ui`, `code-review`, `e2e`, `expo-module`, `wear`, `tdd`, `codebase-design`, `handoff`, etc. stay owned by their respective repos).
- **Shared skills must stay repo-agnostic**: keep repo-specific conventions (area labels, starting directories, architecture rules, verification commands) in each repo's `AGENTS.md` and `docs/agents/issue-tracker.md`.
- **Unified terminology**: all three repos use **spec** (`[Spec][<Area>]`) and **ticket** (`[<Area>] <n> - ...`).

## Git conventions

- Clean kebab-case branch names (no `codex/`, `claude/`, `agent/` prefixes).
- No `Co-Authored-By` or generated-with footers in commits.

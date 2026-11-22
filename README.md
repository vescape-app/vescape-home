# vescape-home

Cross-repo home repository and single source of truth for shared agent skills across the Vescape ecosystem:

- `../vescape` — mobile app & native core
- `../vescape-server` — backend API, sync & admin panel
- `../vescape-web` — web app & public map

## Usage

```bash
# Sync all shared skills from skills/ into sibling repos
bun run sync

# Sync only specific repos
bun run sync -- --target vescape-server,vescape-web

# Check for drift without writing
bun run sync:check
```

`sync` only manages directories that exist in `skills/` — repo-specific skills in each target repo's `.agents/skills/` are left untouched.

## Glossaries

Each repository keeps its own `GLOSSARY.md` locally. Run `/sync-glossaries` from this repo to audit and reconcile drift, contradictions, and `_Avoid_` violations across all three repos.

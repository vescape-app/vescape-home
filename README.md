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

The [`vescape` CLI](packages/vescape/README.md) bundles the shared skills from its release. Run `bunx vescape sync --check` from the workspace to check the sibling repos without a `vescape-home` checkout.

To publish a new CLI version, bump `packages/vescape/package.json` and commit the release. From `packages/vescape`, run `bun pm pack --dry-run` to review the contents and `bun publish` to release. Packing takes the bundled skills from the current Git commit.

## Glossaries

Each repository keeps its own `GLOSSARY.md` locally. Run `/sync-glossaries` from this repo to audit and reconcile drift, contradictions, and `_Avoid_` violations across all three repos.

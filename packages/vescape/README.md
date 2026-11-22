# vescape

Sync the shared Vescape agent skills into the `vescape`, `vescape-server`, and `vescape-web` Git checkouts. The CLI uses the copy of the skills bundled with its release and requires Bun.

Run from the directory containing the sibling checkouts or anywhere inside one of them.

```sh
bunx vescape sync --check
bunx vescape sync
bunx vescape sync --target vescape-server,vescape-web
bunx vescape sync --workspace /path/to/workspace
```

`--check` exits with status 1 when a managed skill differs and leaves files untouched. `sync` replaces managed skill directories. Skills with other names are left alone. Missing checkouts are skipped unless named with `--target`.

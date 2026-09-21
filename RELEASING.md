# Releasing pizx

pizx is published to npm as [`@topce/pizx`](https://www.npmjs.com/package/@topce/pizx).
Releases are cut manually from `main`. CI (`.github/workflows/ci.yml`) runs
typecheck, lint, tests, build, and `npm pack --dry-run` on every push and PR.

## Pre-release checklist

Run the exact CI sequence locally from a clean tree:

```bash
npm ci
npm run typecheck
npm run lint
npm test
npm run build
npm pack --dry-run   # inspect what actually ships
```

Verify the tarball contains only `dist/`, `README.md`, `AGENTS.md`, `llms.txt`,
and `package.json` (see the `files` field in `package.json`), and that no test
fixtures, secrets, or stray build artifacts are included.

Then:

1. Move the `[Unreleased]` changelog section to a dated `## [x.y.z]` section.
2. Bump `version` in `package.json`.
3. Commit and merge to `main`: `Release vX.Y.Z — <summary>`.
4. `npm publish` (the `prepublishOnly` hook runs `npm run build`).
5. `git tag vX.Y.Z && git push --follow-tags`.

## Rollback plan

pizx is a library, so "rollback" means getting consumers off a bad version
rather than redeploying a service.

### Triggers

- A regression in a published version (broken α invocation, leaked child
  processes, wrong session lifetime, wrong `Timeout`/cancellation behavior).
- A security issue in pizx or a bundled dependency.

### Steps

1. **Stop the bleeding** — deprecate the bad version so new installs warn and
   tooling can pick another:
   ```bash
   npm deprecate @topce/pizx@X.Y.Z "<reason and the fixed version>"
   ```
2. **Fix forward** — land the fix on `main`, bump a patch version, publish.
3. **If the fix is a revert** — `git revert <release-commit>`, bump a patch
   version, publish.
4. **Communicate** — record the bad version and the fix in `CHANGELOG.md` and
   in the GitHub release notes.

Consumers can always pin a known-good version: `npm i @topce/pizx@1.6.0`.

### Time to roll back

- `npm deprecate`: under a minute.
- Publish a revert/patch: minutes after CI is green.

## Runtime kill switches (no redeploy)

- `PIZX_ACP_POOL=0` — disable α ACP connection pooling (spawn per call). Also
  available as `createPizx({ acp: { pool: false } })`.
- `--no-cache` / `cache: false` — disable the local result cache.
- `--no-color` (or `NO_COLOR`) — disable ANSI output.

## Observability

pizx is a CLI/library, not a hosted service: there is no error budget, no
canary-percentage rollout, and no server health endpoint. The production
observability surface is the run trace — `pizx --trace --export-log run.jsonl`
— which records every letter span, LLM call, tool call, cache hit/miss, and
error with structured codes. Branch on `PizxError.code` (see the exit-code
table in `AGENTS.md`), not on error message text.

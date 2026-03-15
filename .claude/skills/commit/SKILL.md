---
name: commit
description: Commit changes following Conventional Commits for semantic-release. Use when committing code, creating commits, or when the user asks to commit. Ensures commit messages trigger correct version bumps (major/minor/patch) in the CI/CD pipeline.
---

# Conventional Commits for Semantic Release

This project uses **semantic-release** (JS, via `cycjimmy/semantic-release-action@v4`) with **Conventional Commits** (`@commitlint/config-conventional`). Commit messages directly control versioning and changelog generation.

## Version Bump Rules

| Commit prefix | Version bump | When to use |
|---|---|---|
| `fix:` / `fix(scope):` | **PATCH** (1.0.X) | Bug fixes, correcting behavior |
| `feat:` / `feat(scope):` | **MINOR** (1.X.0) | New features, new inputs, new action capabilities |
| `BREAKING CHANGE:` in footer or `!` after type | **MAJOR** (X.0.0) | Breaking changes to action inputs/outputs |
| `chore:`, `docs:`, `style:`, `refactor:`, `perf:`, `test:`, `ci:`, `build:` | **No release** | Non-functional changes |

## Commit Message Format

```
<type>(<optional scope>): <description>

[optional body]

[optional footer(s)]
```

### Type (required)

- `feat` — New feature or capability (triggers MINOR bump)
- `fix` — Bug fix (triggers PATCH bump)
- `chore` — Maintenance, dependencies, config (NO release)
- `ci` — CI/CD pipeline changes (NO release)
- `docs` — Documentation only (NO release)
- `refactor` — Code restructuring without behavior change (NO release)
- `test` — Adding or fixing tests (NO release)
- `perf` — Performance improvement (NO release)
- `style` — Code formatting, whitespace (NO release)
- `build` — Build system, packaging (NO release)

### Scope (optional)

Use action or module name: `deploy`, `preview-branch`, `exec`, `ci`, etc.

### Description (required)

- Lowercase first letter
- No period at end
- Imperative mood ("add feature" not "added feature")
- Max ~72 characters

### Breaking Changes

Two ways to signal a MAJOR bump:

```
feat!: rename project_ref input to supabase_project_ref

# or

feat: redesign preview-branch outputs

BREAKING CHANGE: db_url output is no longer provided, use db_host and db_port separately
```

## Examples

### PATCH release (bug fix)

```
fix(preview-branch): use correct API endpoint for branch detail
```

```
fix(deploy): forward inputs as env vars in composite action
```

### MINOR release (new feature)

```
feat(deploy): add include_seed input for running seeds after migrations
```

```
feat(preview-branch): recreate branch on synchronize for clean state
```

### MAJOR release (breaking change)

```
feat(preview-branch)!: remove db_url output in favor of individual connection fields
```

### No release (maintenance)

```
chore: bump dependencies
```

```
ci: upgrade actions/checkout from v4 to v6
```

```
refactor: move deploy modules into src/deploy/
```

```
docs: write complete README with both actions documented
```

## Rules

1. **One logical change per commit** — don't mix a feature with a refactor
2. **Use `fix:` only for actual bugs** — not for "fixing" a typo in code you just wrote in the same PR
3. **Use `feat:` only when adding user-facing capability** — new inputs, outputs, or behavior changes
4. **Use `chore:` for dependency updates, config changes, tooling**
5. **Use `ci:` specifically for CI/CD workflow files** (.github/workflows/)
6. **Never use `feat:` or `fix:` for changes that should NOT trigger a release** — if the change is CI-only, docs-only, or test-only, use the appropriate type
7. **Scope is encouraged** — use `deploy` or `preview-branch` to indicate which action is affected
8. **Breaking changes are rare** — confirm with the user before using `!` or `BREAKING CHANGE:`

## Multi-line Commits

For commits with body or footer, use HEREDOC:

```bash
git commit -m "$(cat <<'EOF'
feat(preview-branch): add include_seed support

Branches created via the Management API don't run seeds automatically.
When include_seed is true, run supabase db push --include-seed --db-url
against the branch after it becomes ACTIVE_HEALTHY.
EOF
)"
```

## Pipeline Flow

```
commit → push to main → semantic-release analyzes commits
  → feat: found? → MINOR bump → build dist/ → tag → GitHub release
  → fix: found? → PATCH bump → build dist/ → tag → GitHub release
  → only chore/ci/docs/test? → NO release
```

Release commits `dist/`, `package.json`, and `package-lock.json` back to main with `[skip ci]`.

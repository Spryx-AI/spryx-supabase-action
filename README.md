# spryx-supabase-action

GitHub Actions for deploying Supabase migrations and managing ephemeral preview branches per PR.

This repo contains two independent actions:

| Action             | Path                                               | Purpose                                                       |
| ------------------ | -------------------------------------------------- | ------------------------------------------------------------- |
| **Deploy**         | `Spryx-AI/spryx-supabase-action/deploy@v1`         | Apply migrations to staging/production via `supabase db push` |
| **Preview Branch** | `Spryx-AI/spryx-supabase-action/preview-branch@v1` | Create/delete ephemeral Supabase branches for PR environments |

---

## Deploy action

Authenticates the Supabase CLI, links the project, and runs `supabase db push`.

### Usage

```yaml
- uses: Spryx-AI/spryx-supabase-action/deploy@v1
  with:
    project_ref: ${{ vars.SUPABASE_PROJECT_REF }}
    supabase_access_token: ${{ secrets.SUPABASE_ACCESS_TOKEN }}
```

### Inputs

| Name                    | Required | Default | Description                                                    |
| ----------------------- | -------- | ------- | -------------------------------------------------------------- |
| `project_ref`           | yes      | —       | Supabase project reference ID (e.g. `abcdefghijklmnop`)        |
| `supabase_access_token` | yes      | —       | Access token for CLI authentication. Always store in a secret. |
| `working_directory`     | no       | `.`     | Directory containing the `supabase/` folder                    |
| `write_summary`         | no       | `true`  | Write a job summary to `GITHUB_STEP_SUMMARY`                   |
| `include_seed`          | no       | `false` | Run seed files after migrations (`--include-seed`)             |

### Outputs

| Name               | Description                                                       |
| ------------------ | ----------------------------------------------------------------- |
| `status`           | `success` or `failure`                                            |
| `executed_db_push` | `true` if migrations were applied, `false` if a prior step failed |
| `summary_markdown` | Markdown string written to the job summary                        |

### Full example

```yaml
name: Deploy

on:
  push:
    branches:
      - main

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: Spryx-AI/spryx-supabase-action/deploy@v1
        with:
          project_ref: ${{ vars.SUPABASE_PROJECT_REF }}
          supabase_access_token: ${{ secrets.SUPABASE_ACCESS_TOKEN }}
```

---

## Preview Branch action

Creates or deletes an ephemeral Supabase branch tied to a PR. On creation the action polls until the branch reaches `ACTIVE_HEALTHY` status and exposes connection details as outputs for use by integration tests. Deletion is idempotent — if the branch does not exist the step succeeds silently.

### Usage

```yaml
# Create on PR open / push
- id: branch
  uses: Spryx-AI/spryx-supabase-action/preview-branch@v1
  with:
    action: create
    project_ref: ${{ vars.SUPABASE_PROJECT_REF }}
    branch_name: pr-${{ github.event.pull_request.number }}
    supabase_access_token: ${{ secrets.SUPABASE_ACCESS_TOKEN }}

# Delete on PR close
- uses: Spryx-AI/spryx-supabase-action/preview-branch@v1
  with:
    action: delete
    project_ref: ${{ vars.SUPABASE_PROJECT_REF }}
    branch_name: pr-${{ github.event.pull_request.number }}
    supabase_access_token: ${{ secrets.SUPABASE_ACCESS_TOKEN }}
```

### Inputs

| Name                    | Required | Default | Description                                                    |
| ----------------------- | -------- | ------- | -------------------------------------------------------------- |
| `action`                | yes      | —       | `create` or `delete`                                           |
| `project_ref`           | yes      | —       | Supabase project reference ID                                  |
| `branch_name`           | yes      | —       | Branch name, e.g. `pr-123`. Must be unique per project.        |
| `supabase_access_token` | yes      | —       | Management API bearer token. Always store in a secret.         |
| `wait_timeout`          | no       | `120`   | Seconds to wait for the branch to become ready (`create` only) |
| `write_summary`         | no       | `true`  | Write a job summary to `GITHUB_STEP_SUMMARY`                   |

### Outputs

| Name               | Description                                   |
| ------------------ | --------------------------------------------- |
| `status`           | `success` or `failure`                        |
| `branch_id`        | Supabase branch ID                            |
| `branch_name`      | Resolved branch name used                     |
| `db_url`           | PostgreSQL connection string (masked in logs) |
| `supabase_url`     | Supabase API URL for the branch               |
| `anon_key`         | Supabase anonymous key                        |
| `service_role_key` | Supabase service role key (masked in logs)    |
| `summary_markdown` | Markdown string written to the job summary    |

### Full example

```yaml
name: Preview

on:
  pull_request:
    types: [opened, synchronize, reopened, closed]

jobs:
  create-branch:
    if: github.event.action != 'closed'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - id: branch
        uses: Spryx-AI/spryx-supabase-action/preview-branch@v1
        with:
          action: create
          project_ref: ${{ vars.SUPABASE_PROJECT_REF }}
          branch_name: pr-${{ github.event.pull_request.number }}
          supabase_access_token: ${{ secrets.SUPABASE_ACCESS_TOKEN }}

      # Use outputs in subsequent steps
      - name: Run integration tests
        env:
          DATABASE_URL: ${{ steps.branch.outputs.db_url }}
          SUPABASE_URL: ${{ steps.branch.outputs.supabase_url }}
          SUPABASE_ANON_KEY: ${{ steps.branch.outputs.anon_key }}
        run: npm test

  delete-branch:
    if: github.event.action == 'closed'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: Spryx-AI/spryx-supabase-action/preview-branch@v1
        with:
          action: delete
          project_ref: ${{ vars.SUPABASE_PROJECT_REF }}
          branch_name: pr-${{ github.event.pull_request.number }}
          supabase_access_token: ${{ secrets.SUPABASE_ACCESS_TOKEN }}
```

---

## Secrets and variables

| Name                    | Type     | Used by      |
| ----------------------- | -------- | ------------ |
| `SUPABASE_ACCESS_TOKEN` | Secret   | Both actions |
| `SUPABASE_PROJECT_REF`  | Variable | Both actions |

The access token is masked immediately after reading — it never appears in logs or process listings. The `db_url` and `service_role_key` outputs from the preview branch action are also masked.

---

## Requirements

- The deploy action installs the Supabase CLI automatically via [`supabase/setup-cli`](https://github.com/supabase/setup-cli). No manual setup step is needed.
- The preview-branch action uses the Supabase Management API directly and requires no CLI.
- Node.js 24 runtime (handled automatically by GitHub Actions).
- Supabase project must have branching enabled for the preview-branch action.

import * as core from '@actions/core'
import { parseInputs, type BranchInputs } from './inputs'
import {
  findBranchByName,
  createBranch,
  deleteBranch,
  pollUntilReady,
  buildDbUrl,
  type BranchSummary,
  type BranchDetail,
} from './api'
import { runAuth, runLink, runDbPush, type ExecResult } from '../exec'
import { writeSummary } from './summary'

async function main(): Promise<void> {
  const inputs = parseInputs()
  core.info(`Action: ${inputs.action} | Project: ${inputs.projectRef} | Branch: ${inputs.branchName}`)

  if (inputs.action === 'create') {
    await handleCreate(inputs)
  } else {
    await handleDelete(inputs)
  }
}

/**
 * Creates a fresh preview branch, waits until ready, then sets all outputs.
 * If a branch with the same name already exists, it is deleted first to ensure
 * a clean state (all migrations re-applied from scratch + seeds).
 */
async function handleCreate(inputs: BranchInputs): Promise<void> {
  const { projectRef, supabaseAccessToken, waitTimeoutMs } = inputs

  const existing = await findBranchByName(projectRef, inputs.branchName, supabaseAccessToken)

  if (existing) {
    core.info(`Branch "${inputs.branchName}" already exists (id: ${existing.id}), recreating for a clean state...`)
    await deleteBranch(existing.id, supabaseAccessToken)
    core.info(`Branch "${inputs.branchName}" deleted.`)
  }

  const summary = await createBranch(projectRef, inputs.branchName, supabaseAccessToken)
  core.info(`Branch created (id: ${summary.id}), waiting for ready state...`)

  const detail = await pollUntilReady(summary.id, supabaseAccessToken, waitTimeoutMs)

  maskBranchSecrets(detail)
  setCreateOutputs(summary, detail)

  if (inputs.includeSeed) {
    core.info('Running seed files on the preview branch...')
    const authResult = await runAuth(supabaseAccessToken)
    if (authResult.exitCode !== 0) {
      core.setFailed(`Auth failed before seeding: ${authResult.stderr}`)
      return
    }
    const linkResult = await runLink(detail.ref, inputs.workingDirectory)
    if (linkResult.exitCode !== 0) {
      core.setFailed(`Link to branch project failed: ${linkResult.stderr}`)
      return
    }
    const pushResult = await retryDbPush(inputs.workingDirectory)
    if (pushResult.exitCode !== 0) {
      core.setFailed(`Seed failed: ${pushResult.stderr}`)
      return
    }
    core.info('Seed completed successfully.')
  }

  const summaryMarkdown = await writeSummary(inputs, 'create', summary, detail, 'success')
  core.setOutput('summary_markdown', summaryMarkdown)
  core.info(`Branch "${inputs.branchName}" is ready.`)
}

/**
 * Deletes a preview branch by name, if it exists.
 */
async function handleDelete(inputs: BranchInputs): Promise<void> {
  const { projectRef, supabaseAccessToken } = inputs

  const existing = await findBranchByName(projectRef, inputs.branchName, supabaseAccessToken)

  if (!existing) {
    core.warning(`Branch "${inputs.branchName}" not found in project ${projectRef}. Skipping delete.`)
  } else {
    core.info(`Deleting branch "${inputs.branchName}" (id: ${existing.id})...`)
    await deleteBranch(existing.id, supabaseAccessToken)
    core.info(`Branch "${inputs.branchName}" deleted.`)
  }

  core.setOutput('status', 'success')
  core.setOutput('branch_id', existing?.id ?? '')
  core.setOutput('branch_name', inputs.branchName)

  const summaryMarkdown = await writeSummary(inputs, 'delete', existing ?? null, null, 'success')
  core.setOutput('summary_markdown', summaryMarkdown)
}

/**
 * Masks sensitive branch credentials so they never appear in logs.
 */
function maskBranchSecrets(detail: BranchDetail): void {
  if (detail.db_pass) core.setSecret(detail.db_pass)
  if (detail.service_role_key) core.setSecret(detail.service_role_key)
  const dbUrl = buildDbUrl(detail)
  core.setSecret(dbUrl)
}

/**
 * Sets all GitHub Action outputs for a successfully created/ready branch.
 */
function setCreateOutputs(summary: BranchSummary, detail: BranchDetail): void {
  core.setOutput('status', 'success')
  core.setOutput('branch_id', summary.id)
  core.setOutput('branch_name', summary.name)
  core.setOutput('db_url', buildDbUrl(detail))
  core.setOutput('supabase_url', detail.supabase_url ?? '')
  core.setOutput('anon_key', detail.anon_key ?? '')
  core.setOutput('service_role_key', detail.service_role_key ?? '')
}

const SEED_MAX_RETRIES = 5
const SEED_RETRY_DELAY_MS = 10_000

/**
 * Retries `supabase db push --include-seed` to handle cases where the
 * database is still starting up after branch creation.
 */
async function retryDbPush(workingDirectory: string): Promise<ExecResult> {
  for (let attempt = 1; attempt <= SEED_MAX_RETRIES; attempt++) {
    const result = await runDbPush({ dryRun: false, includeSeed: true, workingDirectory })
    if (result.exitCode === 0) return result

    const isTransient =
      result.stderr.includes('database system is starting up') ||
      result.stderr.includes('Connection terminated unexpectedly') ||
      result.stderr.includes('connection refused') ||
      result.stderr.includes('network is unreachable')
    if (!isTransient || attempt === SEED_MAX_RETRIES) return result

    core.warning(
      `[seed attempt ${attempt}/${SEED_MAX_RETRIES}] Database not ready, retrying in ${SEED_RETRY_DELAY_MS / 1000}s...`
    )
    await new Promise((resolve) => setTimeout(resolve, SEED_RETRY_DELAY_MS))
  }

  throw new Error('Unreachable')
}

main().catch((err: unknown) => {
  const message = err instanceof Error ? err.message : String(err)
  core.setFailed(`Unexpected error: ${message}`)
})

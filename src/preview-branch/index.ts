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
 * Creates or reuses a preview branch, waits until ready, then sets all outputs.
 */
async function handleCreate(inputs: BranchInputs): Promise<void> {
  const { projectRef, supabaseAccessToken, waitTimeoutMs } = inputs

  const existing = await findBranchByName(projectRef, inputs.branchName, supabaseAccessToken)
  const summary = existing ?? (await createBranch(projectRef, inputs.branchName, supabaseAccessToken))

  if (existing) {
    core.info(`Branch "${inputs.branchName}" already exists (id: ${summary.id}), waiting for ready state...`)
  } else {
    core.info(`Branch created (id: ${summary.id}), waiting for ready state...`)
  }

  const detail = await pollUntilReady(summary.id, supabaseAccessToken, waitTimeoutMs)

  maskBranchSecrets(detail)
  setCreateOutputs(summary, detail)

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

main().catch((err: unknown) => {
  const message = err instanceof Error ? err.message : String(err)
  core.setFailed(`Unexpected error: ${message}`)
})

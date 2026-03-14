import * as core from '@actions/core'
import { parseInputs, type BranchInputs } from './inputs'
import { findBranchByName, createBranch, deleteBranch, pollUntilReady, buildDbUrl, type Branch } from './api'
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
  const { projectRef, branchName, supabaseAccessToken, waitTimeoutMs } = inputs

  const existing = await findBranchByName(projectRef, branchName, supabaseAccessToken)

  const branchToWait = existing ?? (await createBranch(projectRef, branchName, supabaseAccessToken))

  if (existing) {
    core.info(`Branch "${branchName}" already exists (id: ${existing.id}), waiting for ready state...`)
  } else {
    core.info(`Branch created (id: ${branchToWait.id}), waiting for ready state...`)
  }

  const branch = await pollUntilReady(branchToWait.id, supabaseAccessToken, waitTimeoutMs)

  maskBranchSecrets(branch)
  setCreateOutputs(branch)

  const summaryMarkdown = await writeSummary(inputs, 'create', branch, 'success')
  core.setOutput('summary_markdown', summaryMarkdown)
  core.info(`Branch "${branch.name}" is ready.`)
}

/**
 * Deletes a preview branch by name, if it exists.
 */
async function handleDelete(inputs: BranchInputs): Promise<void> {
  const { projectRef, branchName, supabaseAccessToken } = inputs

  const existing = await findBranchByName(projectRef, branchName, supabaseAccessToken)

  if (!existing) {
    core.warning(`Branch "${branchName}" not found in project ${projectRef}. Skipping delete.`)
  } else {
    core.info(`Deleting branch "${branchName}" (id: ${existing.id})...`)
    await deleteBranch(existing.id, supabaseAccessToken)
    core.info(`Branch "${branchName}" deleted.`)
  }

  core.setOutput('status', 'success')
  core.setOutput('branch_id', existing?.id ?? '')
  core.setOutput('branch_name', branchName)

  const summaryMarkdown = await writeSummary(inputs, 'delete', existing ?? null, 'success')
  core.setOutput('summary_markdown', summaryMarkdown)
}

/**
 * Masks sensitive branch credentials so they never appear in logs.
 */
function maskBranchSecrets(branch: Branch): void {
  if (branch.db_pass) core.setSecret(branch.db_pass)
  if (branch.service_role_key) core.setSecret(branch.service_role_key)
  const dbUrl = buildDbUrl(branch)
  core.setSecret(dbUrl)
}

/**
 * Sets all GitHub Action outputs for a successfully created/ready branch.
 */
function setCreateOutputs(branch: Branch): void {
  core.setOutput('status', 'success')
  core.setOutput('branch_id', branch.id)
  core.setOutput('branch_name', branch.name)
  core.setOutput('db_url', buildDbUrl(branch))
  core.setOutput('supabase_url', branch.supabase_url ?? '')
  core.setOutput('anon_key', branch.anon_key ?? '')
  core.setOutput('service_role_key', branch.service_role_key ?? '')
}

main().catch((err: unknown) => {
  const message = err instanceof Error ? err.message : String(err)
  core.setFailed(`Unexpected error: ${message}`)
})

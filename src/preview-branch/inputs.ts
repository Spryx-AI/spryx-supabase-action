import * as core from '@actions/core'

export type BranchAction = 'create' | 'delete'

/** Parsed and validated inputs for the preview-branch action. */
export interface BranchInputs {
  action: BranchAction
  projectRef: string
  branchName: string
  supabaseAccessToken: string
  waitTimeoutMs: number
  writeSummary: boolean
}

const VALID_ACTIONS: BranchAction[] = ['create', 'delete']

/**
 * Reads, validates, and returns all inputs for the preview-branch action.
 * Masks the access token immediately after reading.
 * @throws if any required input is missing or invalid.
 */
export function parseInputs(): BranchInputs {
  const action = core.getInput('action', { required: true })
  const projectRef = core.getInput('project_ref', { required: true })
  const branchName = core.getInput('branch_name', { required: true })
  const supabaseAccessToken = core.getInput('supabase_access_token', { required: true })
  const waitTimeoutRaw = core.getInput('wait_timeout') || '120'
  const writeSummary = core.getInput('write_summary') !== 'false'

  core.setSecret(supabaseAccessToken)

  assertValidAction(action)
  assertNonEmpty(projectRef, 'project_ref')
  assertNonEmpty(branchName, 'branch_name')

  const waitTimeoutMs = parseWaitTimeout(waitTimeoutRaw)

  return {
    action,
    projectRef,
    branchName,
    supabaseAccessToken,
    waitTimeoutMs,
    writeSummary,
  }
}

function assertValidAction(value: string): asserts value is BranchAction {
  if (VALID_ACTIONS.includes(value as BranchAction)) return
  const message = `Invalid action "${value}". Must be one of: ${VALID_ACTIONS.join(', ')}`
  core.setFailed(message)
  throw new Error(message)
}

function assertNonEmpty(value: string, inputName: string): void {
  if (value) return
  const message = `Input ${inputName} is required and cannot be empty`
  core.setFailed(message)
  throw new Error(message)
}

function parseWaitTimeout(raw: string): number {
  const value = parseInt(raw, 10)
  if (!isNaN(value) && value > 0) return value * 1000
  const message = `Invalid wait_timeout "${raw}". Must be a positive integer.`
  core.setFailed(message)
  throw new Error(message)
}

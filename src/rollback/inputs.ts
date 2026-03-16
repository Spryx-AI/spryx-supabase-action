import * as core from '@actions/core'

/** Parsed and validated inputs for the rollback action. */
export interface RollbackInputs {
  projectRef: string
  supabaseAccessToken: string
  restorePoint: number
  waitTimeoutMs: number
  writeSummary: boolean
}

/**
 * Reads, validates, and returns all inputs for the rollback action.
 * Masks the access token immediately after reading.
 */
export function parseInputs(): RollbackInputs {
  const projectRef = core.getInput('project_ref', { required: true })
  const supabaseAccessToken = core.getInput('supabase_access_token', { required: true })
  const restorePointRaw = core.getInput('restore_point', { required: true })
  const waitTimeoutRaw = core.getInput('wait_timeout') || '300'
  const writeSummary = core.getInput('write_summary') !== 'false'

  core.setSecret(supabaseAccessToken)

  const restorePoint = parseInt(restorePointRaw, 10)
  if (isNaN(restorePoint) || restorePoint <= 0) {
    const message = `Invalid restore_point "${restorePointRaw}". Must be a positive Unix timestamp (seconds).`
    core.setFailed(message)
    throw new Error(message)
  }

  const waitTimeout = parseInt(waitTimeoutRaw, 10)
  if (isNaN(waitTimeout) || waitTimeout <= 0) {
    const message = `Invalid wait_timeout "${waitTimeoutRaw}". Must be a positive integer.`
    core.setFailed(message)
    throw new Error(message)
  }

  return {
    projectRef,
    supabaseAccessToken,
    restorePoint,
    waitTimeoutMs: waitTimeout * 1000,
    writeSummary,
  }
}

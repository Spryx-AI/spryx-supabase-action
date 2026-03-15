import * as core from '@actions/core'

/** Parsed and validated inputs for the deploy action. */
export interface Inputs {
  projectRef: string
  supabaseAccessToken: string
  workingDirectory: string
  writeSummary: boolean
  includeSeed: boolean
}

/**
 * Reads and parses all GitHub Action inputs for the deploy action.
 * Masks the access token immediately after reading.
 */
export function parseInputs(): Inputs {
  const projectRef = core.getInput('project_ref', { required: true })
  const supabaseAccessToken = core.getInput('supabase_access_token', { required: true })
  const workingDirectory = core.getInput('working_directory') || '.'
  const writeSummary = core.getInput('write_summary') !== 'false'
  const includeSeed = core.getInput('include_seed') === 'true'

  core.setSecret(supabaseAccessToken)

  return { projectRef, supabaseAccessToken, workingDirectory, writeSummary, includeSeed }
}

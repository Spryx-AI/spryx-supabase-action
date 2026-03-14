import * as core from '@actions/core'
import type { Inputs } from './inputs'

/**
 * Validates deploy action inputs.
 * Calls `core.setFailed` and throws on any invalid value.
 */
export function validate(inputs: Inputs): void {
  assertNonEmpty(inputs.projectRef, 'project_ref')
  assertNonEmpty(inputs.supabaseAccessToken, 'supabase_access_token')
}

/**
 * Asserts that a string value is non-empty.
 * @throws if the value is empty
 */
function assertNonEmpty(value: string, inputName: string): void {
  if (value) return
  const message = `Input ${inputName} is required and cannot be empty`
  core.setFailed(message)
  throw new Error(message)
}

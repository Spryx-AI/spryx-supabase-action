import * as core from '@actions/core'
import type { Branch } from './api'
import type { BranchInputs } from './inputs'

/**
 * Builds and optionally writes the job summary for the preview-branch action.
 * @returns The generated markdown string.
 */
export async function writeSummary(
  inputs: BranchInputs,
  action: 'create' | 'delete',
  branch: Branch | null,
  status: 'success' | 'failure'
): Promise<string> {
  const markdown =
    action === 'create' ? buildCreateSummary(branch, status) : buildDeleteSummary(inputs.branchName, branch, status)

  if (inputs.writeSummary) {
    await core.summary.addRaw(markdown).write()
  }

  return markdown
}

/**
 * Builds the markdown summary for a branch create operation.
 */
function buildCreateSummary(branch: Branch | null, status: 'success' | 'failure'): string {
  const emoji = status === 'success' ? '✅' : '❌'

  if (!branch) {
    return [`## ${emoji} Supabase Preview Branch`, '', `Status: \`${status}\``].join('\n')
  }

  const rows = [
    `| **Branch name** | \`${branch.name}\` |`,
    `| **Branch ID** | \`${branch.id}\` |`,
    `| **Status** | \`${branch.status}\` |`,
    `| **DB host** | \`${branch.db_host}\` |`,
    branch.supabase_url ? `| **Supabase URL** | \`${branch.supabase_url}\` |` : null,
    `| **Anon key** | \`${branch.anon_key ? 'available' : 'unavailable'}\` |`,
    `| **Service role key** | \`${branch.service_role_key ? 'available' : 'unavailable'}\` |`,
  ].filter(Boolean)

  return [
    `## ${emoji} Supabase Preview Branch`,
    '',
    '| Field | Value |',
    '|---|---|',
    ...rows,
    '',
    '> Connection string and service role key are available as step outputs (masked in logs).',
  ].join('\n')
}

/**
 * Builds the markdown summary for a branch delete operation.
 */
function buildDeleteSummary(branchName: string, branch: Branch | null, status: 'success' | 'failure'): string {
  const emoji = status === 'success' ? '✅' : '❌'
  const detail = branch
    ? `Branch \`${branch.name}\` (ID: \`${branch.id}\`) was deleted successfully.`
    : `Branch \`${branchName}\` not found — nothing to delete.`

  return [`## ${emoji} Supabase Preview Branch — Cleanup`, '', detail].join('\n')
}

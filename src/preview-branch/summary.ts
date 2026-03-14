import * as core from '@actions/core'
import type { BranchSummary, BranchDetail } from './api'
import type { BranchInputs } from './inputs'

/**
 * Builds and optionally writes the job summary for the preview-branch action.
 * @returns The generated markdown string.
 */
export async function writeSummary(
  inputs: BranchInputs,
  action: 'create' | 'delete',
  summary: BranchSummary | null,
  detail: BranchDetail | null,
  status: 'success' | 'failure'
): Promise<string> {
  const markdown =
    action === 'create'
      ? buildCreateSummary(summary, detail, status)
      : buildDeleteSummary(inputs.branchName, summary, status)

  if (inputs.writeSummary) {
    await core.summary.addRaw(markdown).write()
  }

  return markdown
}

/**
 * Builds the markdown summary for a branch create operation.
 */
function buildCreateSummary(
  summary: BranchSummary | null,
  detail: BranchDetail | null,
  status: 'success' | 'failure'
): string {
  const emoji = status === 'success' ? '✅' : '❌'

  if (!summary) {
    return [`## ${emoji} Supabase Preview Branch`, '', `Status: \`${status}\``].join('\n')
  }

  const rows = [
    `| **Branch name** | \`${summary.name}\` |`,
    `| **Branch ID** | \`${summary.id}\` |`,
    `| **Status** | \`${summary.status}\` |`,
    detail?.db_host ? `| **DB host** | \`${detail.db_host}\` |` : null,
    detail?.supabase_url ? `| **Supabase URL** | \`${detail.supabase_url}\` |` : null,
    detail ? `| **Anon key** | \`${detail.anon_key ? 'available' : 'unavailable'}\` |` : null,
    detail ? `| **Service role key** | \`${detail.service_role_key ? 'available' : 'unavailable'}\` |` : null,
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
function buildDeleteSummary(targetName: string, summary: BranchSummary | null, status: 'success' | 'failure'): string {
  const emoji = status === 'success' ? '✅' : '❌'
  const detail = summary
    ? `Branch \`${summary.name}\` (ID: \`${summary.id}\`) was deleted successfully.`
    : `Branch \`${targetName}\` not found — nothing to delete.`

  return [`## ${emoji} Supabase Preview Branch — Cleanup`, '', detail].join('\n')
}

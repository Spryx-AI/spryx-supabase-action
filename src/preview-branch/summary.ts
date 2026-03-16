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
      ? buildCreateSummary(inputs, summary, detail, status)
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
  inputs: BranchInputs,
  summary: BranchSummary | null,
  detail: BranchDetail | null,
  status: 'success' | 'failure'
): string {
  const icon = status === 'success' ? '✅' : '❌'
  const statusLabel = status === 'success' ? 'Ready' : 'Failed'

  if (!summary) {
    return [`## ${icon} Preview Branch — ${statusLabel}`, '', `Status: \`${status}\``].join('\n')
  }

  const lines: string[] = [
    `## ${icon} Preview Branch — ${statusLabel}`,
    '',
    `| | |`,
    `|---|---|`,
    `| **Branch** | \`${summary.name}\` |`,
    `| **ID** | \`${summary.id}\` |`,
    `| **Project** | \`${inputs.projectRef}\` |`,
  ]

  if (detail?.db_host) {
    lines.push(`| **DB host** | \`${detail.db_host}\` |`)
  }
  if (detail?.supabase_url) {
    lines.push(`| **API URL** | \`${detail.supabase_url}\` |`)
  }

  lines.push('')

  if (inputs.includeSeed) {
    lines.push('> Database was reset with migrations + seeds applied.')
  } else {
    lines.push('> Connection details available as step outputs (masked in logs).')
  }

  return lines.join('\n')
}

/**
 * Builds the markdown summary for a branch delete operation.
 */
function buildDeleteSummary(targetName: string, summary: BranchSummary | null, status: 'success' | 'failure'): string {
  const icon = status === 'success' ? '✅' : '❌'
  const detail = summary
    ? `Branch \`${summary.name}\` (ID: \`${summary.id}\`) deleted.`
    : `Branch \`${targetName}\` not found — nothing to delete.`

  return [`## ${icon} Preview Branch — Cleanup`, '', detail].join('\n')
}

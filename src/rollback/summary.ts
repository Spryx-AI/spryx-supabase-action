import * as core from '@actions/core'
import type { RollbackInputs } from './inputs'

/**
 * Builds and optionally writes the job summary for the rollback action.
 * @returns The generated markdown string.
 */
export async function writeSummary(
  inputs: RollbackInputs,
  status: 'success' | 'failure',
  projectStatus?: string
): Promise<string> {
  const icon = status === 'success' ? '✅' : '❌'
  const statusLabel = status === 'success' ? 'Restored' : 'Failed'

  const restoreDate = new Date(inputs.restorePoint * 1000).toISOString()

  const lines: string[] = [
    `## ${icon} Supabase Rollback — ${statusLabel}`,
    '',
    `| | |`,
    `|---|---|`,
    `| **Project** | \`${inputs.projectRef}\` |`,
    `| **Restore point** | \`${restoreDate}\` |`,
    `| **Timestamp** | \`${inputs.restorePoint}\` |`,
  ]

  if (projectStatus) {
    lines.push(`| **Project status** | \`${projectStatus}\` |`)
  }

  const markdown = lines.join('\n')

  if (inputs.writeSummary) {
    await core.summary.addRaw(markdown).write()
  }

  return markdown
}

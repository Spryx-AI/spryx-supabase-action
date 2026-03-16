import * as core from '@actions/core'
import type { Inputs } from './inputs'
import type { ExecResult } from '../exec'

/** Map of step name to its execution result. */
export interface StepResults {
  auth?: ExecResult
  link?: ExecResult
  db_push?: ExecResult
}

/**
 * Builds and optionally writes the job summary for the deploy action.
 * @returns The generated markdown string.
 */
export async function writeSummary(
  inputs: Inputs,
  results: StepResults,
  status: 'success' | 'failure'
): Promise<string> {
  const markdown = buildMarkdown(inputs.projectRef, results, status)

  if (inputs.writeSummary) {
    await core.summary.addRaw(markdown).write()
  }

  return markdown
}

const STEP_LABELS: Record<keyof StepResults, string> = {
  auth: 'Authenticate',
  link: 'Link project',
  db_push: 'Push migrations',
}

/**
 * Builds the markdown string for the deploy job summary.
 */
function buildMarkdown(projectRef: string, results: StepResults, status: 'success' | 'failure'): string {
  const icon = status === 'success' ? '✅' : '❌'
  const statusLabel = status === 'success' ? 'Deployed successfully' : 'Deploy failed'

  const lines: string[] = [`## ${icon} Supabase Deploy — ${statusLabel}`, '', `**Project:** \`${projectRef}\``, '']

  // Pipeline steps
  lines.push('### Pipeline', '')
  for (const [step, label] of Object.entries(STEP_LABELS) as [keyof StepResults, string][]) {
    const result = results[step]
    if (!result) {
      lines.push(`- ⏭️ ${label} — skipped`)
      continue
    }
    const stepIcon = result.exitCode === 0 ? '✅' : '❌'
    lines.push(`- ${stepIcon} ${label}`)
  }
  lines.push('')

  // Show error details only on failure
  const failed = Object.entries(results).find(([, r]) => r && r.exitCode !== 0) as
    | [keyof StepResults, ExecResult]
    | undefined
  if (failed) {
    const [step, result] = failed
    const errorOutput = result.stderr.trim() || result.stdout.trim()
    if (errorOutput) {
      lines.push(`### Error in \`${STEP_LABELS[step]}\``, '', '```', errorOutput, '```', '')
    }
  }

  return lines.join('\n')
}

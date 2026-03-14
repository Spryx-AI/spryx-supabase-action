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

/**
 * Builds the markdown string for the deploy job summary.
 */
function buildMarkdown(
  projectRef: string,
  results: StepResults,
  status: 'success' | 'failure'
): string {
  const emoji = status === 'success' ? '✅' : '❌'
  const applied = results.db_push?.exitCode === 0

  const lines: string[] = [
    `## ${emoji} Supabase DB Deploy`,
    '',
    '| Field | Value |',
    '|---|---|',
    `| **Project** | \`${projectRef}\` |`,
    `| **Migrations applied** | \`${applied}\` |`,
    `| **Status** | \`${status}\` |`,
    '',
    ...buildStepLines(results),
  ]

  return lines.join('\n')
}

/**
 * Builds per-step output lines for each executed step.
 */
function buildStepLines(results: StepResults): string[] {
  const lines: string[] = []

  for (const [step, result] of Object.entries(results) as [keyof StepResults, ExecResult | undefined][]) {
    if (!result) continue

    const emoji = result.exitCode === 0 ? '✅' : '❌'
    lines.push(`### ${emoji} \`${step}\``)

    if (result.stdout.trim()) {
      lines.push('```', result.stdout.trim(), '```')
    }

    if (result.stderr.trim() && result.exitCode !== 0) {
      lines.push('**stderr:**', '```', result.stderr.trim(), '```')
    }

    lines.push('')
  }

  return lines
}

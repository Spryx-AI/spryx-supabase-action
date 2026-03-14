import * as core from '@actions/core'
import { parseInputs, type Inputs } from '../inputs'
import { validate } from '../validate'
import { runAuth, runLink, runDbPush, type ExecResult } from '../exec'
import { writeSummary, type StepResults } from '../summary'

type Step = [keyof StepResults, () => Promise<ExecResult>]

async function main(): Promise<void> {
  const inputs = parseInputs()
  validate(inputs)

  core.info(`Deploy: supabase db push | project: ${inputs.projectRef}`)

  const results = await runPipeline(inputs)
  const status = getStatus(results)
  const applied = results.db_push?.exitCode === 0

  const summaryMarkdown = await writeSummary(inputs, false, results, status)

  core.setOutput('status', status)
  core.setOutput('executed_db_push', String(applied))
  core.setOutput('summary_markdown', summaryMarkdown)

  if (status === 'failure') {
    core.setFailed('Deploy failed. See logs above for details.')
  }
}

/**
 * Runs all deploy steps sequentially, stopping on first failure.
 * @returns Collected results for each step that was executed.
 */
async function runPipeline(inputs: Inputs): Promise<StepResults> {
  const steps: Step[] = [
    ['auth',    () => runAuth(inputs.supabaseAccessToken)],
    ['link',    () => runLink(inputs.projectRef, inputs.workingDirectory)],
    ['db_push', () => runDbPush({ dryRun: false, workingDirectory: inputs.workingDirectory })],
  ]

  const results: StepResults = {}

  for (const [key, run] of steps) {
    const result = await run()
    results[key] = result

    if (result.exitCode !== 0) {
      core.error(`Step "${key}" failed with exit code ${result.exitCode}`)
      break
    }
  }

  return results
}

/**
 * Derives overall status from step results.
 * Returns 'failure' if any executed step has a non-zero exit code.
 */
function getStatus(results: StepResults): 'success' | 'failure' {
  const failed = Object.values(results).some((r) => r && r.exitCode !== 0)
  return failed ? 'failure' : 'success'
}

main().catch((err: unknown) => {
  const message = err instanceof Error ? err.message : String(err)
  core.setFailed(`Unexpected error: ${message}`)
})

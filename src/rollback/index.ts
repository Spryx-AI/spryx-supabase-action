import * as core from '@actions/core'
import { parseInputs } from './inputs'
import { getBackupInfo, restorePitr, pollProjectReady } from './api'
import { writeSummary } from './summary'

async function main(): Promise<void> {
  const inputs = parseInputs()
  const { projectRef, supabaseAccessToken, restorePoint, waitTimeoutMs } = inputs

  core.info(`Rollback: project ${projectRef} → restore point ${restorePoint}`)

  // Verify PITR is enabled and restore point is within window
  const backup = await getBackupInfo(projectRef, supabaseAccessToken)

  if (!backup.pitrEnabled) {
    await writeSummary(inputs, 'failure')
    core.setFailed('PITR is not enabled on this project. Enable it in your Supabase dashboard.')
    return
  }

  if (restorePoint < backup.earliest || restorePoint > backup.latest) {
    const earliest = new Date(backup.earliest * 1000).toISOString()
    const latest = new Date(backup.latest * 1000).toISOString()
    await writeSummary(inputs, 'failure')
    core.setFailed(`Restore point ${restorePoint} is outside the recovery window [${earliest} — ${latest}].`)
    return
  }

  // Trigger PITR restore
  const restoreDate = new Date(restorePoint * 1000).toISOString()
  core.info(`Triggering PITR restore to ${restoreDate}...`)
  await restorePitr(projectRef, restorePoint, supabaseAccessToken)
  core.info('Restore triggered. Polling project status...')

  // Poll until project is back online
  const projectStatus = await pollProjectReady(projectRef, supabaseAccessToken, waitTimeoutMs)

  if (projectStatus !== 'ACTIVE_HEALTHY') {
    const summaryMarkdown = await writeSummary(inputs, 'failure', projectStatus)
    core.setOutput('status', 'failure')
    core.setOutput('summary_markdown', summaryMarkdown)
    core.setFailed(`Restore failed. Project status: ${projectStatus}`)
    return
  }

  const summaryMarkdown = await writeSummary(inputs, 'success', projectStatus)
  core.setOutput('status', 'success')
  core.setOutput('summary_markdown', summaryMarkdown)
  core.info(`Rollback complete. Project is ${projectStatus}.`)
}

main().catch((err: unknown) => {
  const message = err instanceof Error ? err.message : String(err)
  core.setFailed(`Unexpected error: ${message}`)
})

import * as exec from '@actions/exec'
import * as core from '@actions/core'

/** Result of a CLI command execution. */
export interface ExecResult {
  exitCode: number
  stdout: string
  stderr: string
}

/**
 * Authenticates the Supabase CLI with the given access token.
 * Runs: `supabase login --token <token>`
 */
export async function runAuth(token: string): Promise<ExecResult> {
  core.info('Authenticating Supabase CLI...')
  return runCommand('supabase', ['login', '--token', token])
}

/**
 * Links the CLI to a remote Supabase project.
 * Runs: `supabase link --project-ref <projectRef>`
 */
export async function runLink(projectRef: string, workingDirectory: string): Promise<ExecResult> {
  core.info(`Linking project ${projectRef}...`)
  return runCommand('supabase', ['link', '--project-ref', projectRef], { cwd: workingDirectory })
}

/**
 * Runs `supabase db push` in the given working directory.
 * Passes `--dry-run` when `opts.dryRun` is true.
 */
export async function runDbPush(opts: {
  dryRun: boolean
  workingDirectory: string
}): Promise<ExecResult> {
  const args = opts.dryRun ? ['db', 'push', '--dry-run'] : ['db', 'push']
  core.info(`Running: supabase ${args.join(' ')}`)
  return runCommand('supabase', args, { cwd: opts.workingDirectory })
}

/**
 * Executes a shell command and captures stdout/stderr.
 * Never throws on non-zero exit — callers check `exitCode`.
 */
async function runCommand(
  command: string,
  args: string[],
  options?: { cwd?: string }
): Promise<ExecResult> {
  let stdout = ''
  let stderr = ''

  const exitCode = await exec.exec(command, args, {
    cwd: options?.cwd,
    ignoreReturnCode: true,
    listeners: {
      stdout: (data: Buffer) => { stdout += data.toString() },
      stderr: (data: Buffer) => { stderr += data.toString() },
    },
  })

  return { exitCode, stdout, stderr }
}

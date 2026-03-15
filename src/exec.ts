import * as exec from '@actions/exec'
import * as core from '@actions/core'

/** Result of a CLI command execution. */
export interface ExecResult {
  exitCode: number
  stdout: string
  stderr: string
}

/**
 * Authenticates the Supabase CLI via the SUPABASE_ACCESS_TOKEN env var.
 * Uses env var instead of --token flag to avoid token exposure in process listings.
 */
export async function runAuth(token: string): Promise<ExecResult> {
  core.info('Authenticating Supabase CLI...')
  return runCommand('supabase', ['login'], {
    env: { SUPABASE_ACCESS_TOKEN: token },
  })
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
  includeSeed: boolean
  workingDirectory: string
}): Promise<ExecResult> {
  const args = ['db', 'push']
  if (opts.dryRun) args.push('--dry-run')
  if (opts.includeSeed) args.push('--include-seed')
  core.info(`Running: supabase ${args.join(' ')}`)
  return runCommand('supabase', args, { cwd: opts.workingDirectory })
}

/**
 * Runs `supabase db reset --linked` in the given working directory.
 * Drops the schema, re-applies all migrations, and runs seeds.
 */
export async function runDbReset(workingDirectory: string): Promise<ExecResult> {
  core.info('Running: supabase db reset --linked')
  return runCommand('supabase', ['db', 'reset', '--linked', '--yes'], { cwd: workingDirectory })
}

/**
 * Executes a shell command and captures stdout/stderr.
 * Never throws on non-zero exit — callers check `exitCode`.
 */
async function runCommand(
  command: string,
  args: string[],
  options?: { cwd?: string; env?: Record<string, string> }
): Promise<ExecResult> {
  let stdout = ''
  let stderr = ''

  const exitCode = await exec.exec(command, args, {
    cwd: options?.cwd,
    env: { ...filterEnv(process.env), ...options?.env },
    ignoreReturnCode: true,
    listeners: {
      stdout: (data: Buffer) => {
        stdout += data.toString()
      },
      stderr: (data: Buffer) => {
        stderr += data.toString()
      },
    },
  })

  return { exitCode, stdout, stderr }
}

function filterEnv(env: NodeJS.ProcessEnv): Record<string, string> {
  return Object.fromEntries(Object.entries(env).filter((entry): entry is [string, string] => entry[1] !== undefined))
}

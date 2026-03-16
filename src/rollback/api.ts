import * as core from '@actions/core'

const API_BASE = 'https://api.supabase.com/v1'
const POLL_INTERVAL_MS = 10_000

/** Backup info from the Management API. */
export interface BackupInfo {
  pitrEnabled: boolean
  earliest: number
  latest: number
}

/**
 * Fetches backup configuration and PITR recovery window for a project.
 */
export async function getBackupInfo(projectRef: string, token: string): Promise<BackupInfo> {
  const data = await request<{
    pitr_enabled: boolean
    physical_backup_data?: {
      earliest_physical_backup_date_unix?: number
      latest_physical_backup_date_unix?: number
    }
  }>('GET', `/projects/${projectRef}/database/backups`, token)

  return {
    pitrEnabled: data.pitr_enabled,
    earliest: data.physical_backup_data?.earliest_physical_backup_date_unix ?? 0,
    latest: data.physical_backup_data?.latest_physical_backup_date_unix ?? 0,
  }
}

/**
 * Triggers a Point-in-Time Recovery restore to the given Unix timestamp.
 */
export async function restorePitr(projectRef: string, timestamp: number, token: string): Promise<void> {
  await request<unknown>('POST', `/projects/${projectRef}/database/backups/restore-pitr`, token, {
    recovery_time_target_unix: timestamp,
  })
}

/**
 * Polls the project status until it reaches ACTIVE_HEALTHY or a failure state.
 * @returns The final project status string.
 * @throws if the timeout expires.
 */
export async function pollProjectReady(projectRef: string, token: string, timeoutMs: number): Promise<string> {
  const deadline = Date.now() + timeoutMs

  for (let attempt = 1; Date.now() < deadline; attempt++) {
    const project = await request<{ status: string }>('GET', `/projects/${projectRef}`, token)
    core.info(`[poll #${attempt}] Project status: ${project.status}`)

    if (project.status === 'ACTIVE_HEALTHY') return project.status
    if (project.status === 'RESTORE_FAILED') return project.status

    if (Date.now() + POLL_INTERVAL_MS >= deadline) break
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS))
  }

  throw new Error(`Project did not become ready within ${timeoutMs / 1000}s`)
}

/**
 * Sends an authenticated request to the Supabase Management API.
 * @throws on non-2xx responses.
 */
async function request<T>(method: string, path: string, token: string, body?: unknown): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Supabase API ${method} ${path} → ${res.status} ${res.statusText}: ${text}`)
  }

  if (res.status === 204 || res.status === 201) return undefined as T

  return res.json() as Promise<T>
}

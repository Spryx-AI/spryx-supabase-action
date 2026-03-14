import * as core from '@actions/core'

const API_BASE = 'https://api.supabase.com/v1'
const POLL_INTERVAL_MS = 5_000
const READY_STATUS = 'ACTIVE_HEALTHY'
const TERMINAL_STATUSES = ['CREATE_FAILED', 'UNKNOWN']

/** Represents a Supabase preview branch and its connection details. */
export interface Branch {
  id: string
  name?: string // present in list endpoint (/projects/{ref}/branches)
  git_branch?: string // present in individual endpoint (/branches/{id})
  status: string
  db_host: string
  db_user: string
  db_pass: string
  db_port: number
  db_name: string
  supabase_url?: string
  anon_key?: string
  service_role_key?: string
}

/** Returns the branch name regardless of which endpoint populated the object. */
export function branchName(branch: Branch): string {
  return branch.name ?? branch.git_branch ?? ''
}

/**
 * Lists all branches for the given Supabase project.
 */
async function listBranches(projectRef: string, token: string): Promise<Branch[]> {
  return request<Branch[]>('GET', `/projects/${projectRef}/branches`, token)
}

/**
 * Creates a new branch with the given name under the project.
 */
export async function createBranch(projectRef: string, branchName: string, token: string): Promise<Branch> {
  return request<Branch>('POST', `/projects/${projectRef}/branches`, token, {
    branch_name: branchName,
  })
}

/**
 * Fetches the current state of a branch by ID.
 */
export async function getBranch(branchId: string, token: string): Promise<Branch> {
  return request<Branch>('GET', `/branches/${branchId}`, token)
}

/**
 * Deletes a branch by ID.
 */
export async function deleteBranch(branchId: string, token: string): Promise<void> {
  return request<void>('DELETE', `/branches/${branchId}`, token)
}

/**
 * Finds a branch by name within the project's branch list, or returns undefined.
 */
export async function findBranchByName(
  projectRef: string,
  targetName: string,
  token: string
): Promise<Branch | undefined> {
  const branches = await listBranches(projectRef, token)
  return branches.find((b) => branchName(b) === targetName)
}

/**
 * Polls a branch every 5 seconds until it reaches `ACTIVE_HEALTHY` status.
 * @throws if the branch reaches a terminal error state or the timeout expires.
 */
export async function pollUntilReady(branchId: string, token: string, timeoutMs: number): Promise<Branch> {
  const deadline = Date.now() + timeoutMs

  for (let attempt = 1; Date.now() < deadline; attempt++) {
    const branch = await getBranch(branchId, token)
    core.info(`[poll #${attempt}] Branch "${branchName(branch)}" status: ${branch.status}`)

    if (branch.status === READY_STATUS) return branch

    if (TERMINAL_STATUSES.includes(branch.status)) {
      throw new Error(`Branch reached terminal error state: ${branch.status}`)
    }

    if (Date.now() + POLL_INTERVAL_MS >= deadline) break
    await sleep(POLL_INTERVAL_MS)
  }

  throw new Error(`Branch did not become ready within ${timeoutMs / 1000}s`)
}

/**
 * Builds a PostgreSQL connection URL from branch connection details.
 */
export function buildDbUrl(branch: Branch): string {
  const { db_user, db_pass, db_host, db_port, db_name } = branch
  return `postgresql://${encodeURIComponent(db_user)}:${encodeURIComponent(db_pass)}@${db_host}:${db_port}/${encodeURIComponent(db_name)}`
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

  if (res.status === 204) return undefined as T

  return res.json() as Promise<T>
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

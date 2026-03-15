import * as core from '@actions/core'

const API_BASE = 'https://api.supabase.com/v1'
const POLL_INTERVAL_MS = 5_000
const READY_STATUS = 'ACTIVE_HEALTHY'
const TERMINAL_STATUSES = ['CREATE_FAILED', 'UNKNOWN']

/**
 * Branch summary returned by the list and create endpoints.
 * GET /projects/{ref}/branches  →  BranchResponse[]
 * POST /projects/{ref}/branches →  BranchResponse
 */
export interface BranchSummary {
  id: string
  name: string
  status: string
}

/**
 * Branch connection details returned by the individual branch endpoint.
 * GET /branches/{id} → BranchDetailResponse
 * Name is NOT present in this response; use BranchSummary for that.
 */
export interface BranchDetail {
  ref: string
  status: string
  db_host: string
  db_port: number
  db_user?: string
  db_pass?: string
  db_name?: string
  supabase_url?: string
  anon_key?: string
  service_role_key?: string
}

/**
 * Lists all branches for the given Supabase project.
 */
async function listBranches(projectRef: string, token: string): Promise<BranchSummary[]> {
  return request<BranchSummary[]>('GET', `/projects/${projectRef}/branches`, token)
}

/**
 * Creates a new branch with the given name under the project.
 */
export async function createBranch(projectRef: string, name: string, token: string): Promise<BranchSummary> {
  return request<BranchSummary>('POST', `/projects/${projectRef}/branches`, token, {
    branch_name: name,
  })
}

/**
 * Fetches connection details for a branch by ID.
 * Note: this endpoint does not return the branch name.
 */
export async function getBranch(branchId: string, token: string): Promise<BranchDetail> {
  return request<BranchDetail>('GET', `/branches/${branchId}`, token)
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
  name: string,
  token: string
): Promise<BranchSummary | undefined> {
  const branches = await listBranches(projectRef, token)
  return branches.find((b) => b.name === name)
}

/**
 * Polls a branch every 5 seconds until it reaches `ACTIVE_HEALTHY` status.
 * @throws if the branch reaches a terminal error state or the timeout expires.
 */
export async function pollUntilReady(branchId: string, token: string, timeoutMs: number): Promise<BranchDetail> {
  const deadline = Date.now() + timeoutMs

  for (let attempt = 1; Date.now() < deadline; attempt++) {
    const detail = await getBranch(branchId, token)
    core.info(`[poll #${attempt}] status: ${detail.status}`)

    if (detail.status === READY_STATUS) return detail

    if (TERMINAL_STATUSES.includes(detail.status)) {
      throw new Error(`Branch reached terminal error state: ${detail.status}`)
    }

    if (Date.now() + POLL_INTERVAL_MS >= deadline) break
    await sleep(POLL_INTERVAL_MS)
  }

  throw new Error(`Branch did not become ready within ${timeoutMs / 1000}s`)
}

/**
 * Builds a PostgreSQL connection URL from branch connection details.
 */
export function buildDbUrl(detail: BranchDetail): string {
  const { db_user = '', db_pass = '', db_host, db_port, db_name = 'postgres' } = detail
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

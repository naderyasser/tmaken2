// API helper functions for making direct requests to the Frappe backend.
// In dev mode, Next.js rewrites /api/method/* and /api/resource/* to the Frappe server.
// In production the frontend and backend share the same domain, so no proxy is needed.

import { csrfFetch } from './csrf'
import { parseFrappeError } from './frappe-error'

interface FetchOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE'
  body?: any
}

/**
 * Fetch data from Frappe.
 * @param path - The Frappe API path (e.g., /api/resource/HR Settings/HR Settings)
 * @param options - Fetch options (method, body)
 *
 * Writes go through `csrfFetch`, which attaches the X-Frappe-CSRF-Token header
 * and self-heals on a CSRF error — Frappe raises CSRFTokenError as HTTP 400, and
 * this module previously sent no token at all, breaking the whole HR/admin area
 * (branches, HR-manager roles, etc.).
 */
export async function frappeRequest(path: string, options: FetchOptions = {}) {
  const { method = 'GET', body } = options

  const init: RequestInit = {
    method,
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
  }
  if (body && method !== 'GET') {
    init.body = JSON.stringify(body)
  }

  const response = await csrfFetch(path, init)

  if (!response.ok) {
    // Frappe reports thrown validation messages in _server_messages/exception —
    // never in `.error`. Reading `.error` swallowed every backend message in the
    // admin area ("branch already exists", "N employees still assigned", ...).
    const errorData = await response.json().catch(() => null)
    throw new Error(parseFrappeError(errorData, `API request failed: ${response.status}`))
  }

  return response.json()
}

/**
 * GET request to Frappe API
 */
export async function frappeGet(path: string) {
  return frappeRequest(path, { method: 'GET' })
}

/**
 * POST request to Frappe API
 */
export async function frappePost(path: string, body: any) {
  return frappeRequest(path, { method: 'POST', body })
}

/**
 * PUT request to Frappe API
 */
export async function frappePut(path: string, body: any) {
  return frappeRequest(path, { method: 'PUT', body })
}

/**
 * Update a document in Frappe
 */
export async function updateDoc(doctype: string, name: string, data: any) {
  const path = `/api/resource/${doctype}/${name}`
  return frappePut(path, data)
}

/**
 * Call a whitelisted Frappe method
 */
export async function callMethod(method: string, args: any = {}) {
  const path = `/api/method/${method}`
  return frappePost(path, args)
}

/**
 * Login to Frappe
 */
export async function login(usr: string, pwd: string) {
  const response = await fetch('/api/method/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ usr, pwd })
  })

  if (!response.ok) {
    const data = await response.json().catch(() => null)
    throw new Error(data?.message || 'Login failed')
  }

  return response.json()
}

/**
 * Logout from Frappe
 */
export async function logout() {
  const response = await csrfFetch('/api/method/logout', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  })

  return response.json()
}

/**
 * Get current user session
 */
export async function getCurrentUser() {
  try {
    // Skip the probe only for EXPLICIT guests. `user_id` is a session-scoped display
    // cookie that browsers drop on restart, while the real credential (`sid`, HttpOnly)
    // is persistent — so an ABSENT user_id must still probe the server, otherwise every
    // browser restart looked logged-out client-side ("Login Required" on the cashier)
    // despite a valid session. The old "absent → skip" optimisation existed for public
    // storefront pages, which no longer mount AuthProvider at all (app/(erp) split).
    if (typeof document !== 'undefined') {
      const m = document.cookie.match(/(?:^|; )user_id=([^;]+)/)
      const uid = m ? decodeURIComponent(m[1]) : ''
      if (uid === 'Guest') return null
    }
    const response = await fetch('/api/method/frappe.auth.get_logged_user', {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include'
    })

    if (!response.ok) {
      return null
    }

    const data = await response.json()
    return data.message
  } catch (error) {
    // Network-level failure ≠ "logged out". Callers must be able to tell the
    // difference (offline boot restores a cached identity; a Guest verdict logs out).
    throw error instanceof Error ? error : new Error("network failure")
  }
}

/**
 * Get user details (full_name, user_image) from Frappe
 */
export async function getUserInfo(uid: string): Promise<{ full_name: string; user_image: string | null }> {
  try {
    const path = `/api/resource/User/${encodeURIComponent(uid)}?fields=["full_name","user_image"]`
    const response = await fetch(path, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include'
    })

    if (!response.ok) {
      return { full_name: uid, user_image: null }
    }

    const data = await response.json()
    return {
      full_name: data.data?.full_name || uid,
      user_image: data.data?.user_image || null,
    }
  } catch (error) {
    return { full_name: uid, user_image: null }
  }
}

/**
 * Get roles for a user from Frappe.
 * Retries once on a network failure — a single blip must not strip the user's
 * roles (which would make an admin look unauthorized and hide gated screens).
 */
export async function getUserRoles(uid: string): Promise<string[]> {
  const path = `/api/method/frappe.core.doctype.user.user.get_roles?uid=${encodeURIComponent(uid)}`
  const attempt = async (): Promise<Response> => fetch(path, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include'
  })

  for (let i = 0; i < 2; i++) {
    try {
      const response = await attempt()
      if (!response.ok) return []
      const data = await response.json()
      return data.message || []
    } catch (error) {
      if (i === 0) {
        await new Promise((r) => setTimeout(r, 600))
        continue
      }
      console.error('Failed to fetch user roles:', error)
    }
  }
  return []
}

// ===== HR Manager Administration =====

/** Get all system users with their HR Manager status */
export async function getSystemUsers() {
  const data = await frappeGet('/api/method/hrms.api.hr_manager_admin.get_system_users')
  return data.message
}

/** Assign HR Manager role to a user */
export async function assignHRManagerRole(userId: string) {
  const data = await frappePost('/api/method/hrms.api.hr_manager_admin.assign_hr_manager_role', { user_id: userId })
  return data.message
}

/** Remove HR Manager role from a user */
export async function removeHRManagerRole(userId: string) {
  const data = await frappePost('/api/method/hrms.api.hr_manager_admin.remove_hr_manager_role', { user_id: userId })
  return data.message
}

// ===== Branch Administration =====

const BRANCH_API = '/api/method/hrms.api.branch_admin'

/** Get all branches for a company with geolocation data */
export async function getCompanyBranches(company: string) {
  const data = await frappePost(`${BRANCH_API}.get_company_branches`, { company })
  return data.message
}

/** Create a new branch for a company */
export async function addBranch(
  company: string,
  branchName: string,
  latitude?: number,
  longitude?: number,
  checkinRadius?: number,
  branchNumber?: string,
) {
  const data = await frappePost(`${BRANCH_API}.add_branch`, {
    company, branch_name: branchName, latitude, longitude,
    checkin_radius: checkinRadius ?? 100,
    branch_number: branchNumber,
  })
  return data.message
}

/**
 * Update a branch's geolocation, check-in radius and/or branch number.
 *
 * Every field is omit-to-keep. Passing undefined coordinates leaves the branch's
 * location alone — the edit dialog also edits the branch number, so opening it
 * to type a number must not blank a location the admin never touched.
 * branchNumber is the one exception you can clear: pass '' to erase it.
 */
export async function updateBranchLocation(
  branch: string,
  latitude?: number,
  longitude?: number,
  checkinRadius?: number,
  branchNumber?: string,
) {
  const data = await frappePost(`${BRANCH_API}.update_branch_location`, {
    branch, latitude, longitude,
    checkin_radius: checkinRadius,
    branch_number: branchNumber,
  })
  return data.message
}

/** Delete a branch (fails if active employees are still assigned) */
export async function deleteBranch(branch: string) {
  const data = await frappePost(`${BRANCH_API}.delete_branch`, { branch })
  return data.message
}

/** Get branches assigned to the currently logged-in HR Manager */
export async function getMyBranches() {
  const data = await frappeGet(`${BRANCH_API}.get_my_branches`)
  return data.message
}

// ===== Radius Alert Administration =====

const RADIUS_API = '/api/method/hrms.api.radius_alert_admin'

/** Get all employees with their radius alert settings */
export async function getEmployeesRadiusSettings() {
  const data = await frappeGet(`${RADIUS_API}.get_employees_radius_settings`)
  return data.message
}

/** Update radius alert settings for an employee */
export async function updateRadiusSettings(params: {
  employee: string
  enable_radius_alert: number
  alert_radius?: number
  center_latitude?: number
  center_longitude?: number
  notify_hr_manager?: number
  notification_message?: string
}) {
  const data = await frappePost(`${RADIUS_API}.update_radius_settings`, params)
  return data.message
}

/** Get radius alert logs with pagination */
export async function getAlertLogs(params: {
  employee?: string
  from_date?: string
  to_date?: string
  page?: number
  page_size?: number
}) {
  // Build query string for GET-like params sent via POST
  const data = await frappePost(`${RADIUS_API}.get_alert_logs`, params)
  return data.message
}

/** Get radius alert dashboard statistics */
export async function getRadiusDashboardStats() {
  const data = await frappeGet(`${RADIUS_API}.get_dashboard_stats`)
  return data.message
}

/** Quick disable radius alert for an employee */
export async function disableRadiusAlert(employee: string) {
  const data = await frappePost(`${RADIUS_API}.disable_radius_alert`, { employee })
  return data.message
}

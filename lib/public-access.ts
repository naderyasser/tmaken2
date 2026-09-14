/**
 * Public walkthrough mode for the frontend shell.
 *
 * This removes the frontend login wall only. Frappe remains the authority for
 * protected records and can still return 401/403 when a visitor has no session.
 */
export const PUBLIC_APP_NO_AUTH = true

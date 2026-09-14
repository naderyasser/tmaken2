/**
 * Public HR demo.
 *
 * The bare `/hr` dashboard ships as a public "proposed version" mock (no session,
 * dummy data). These prefixes extend the same public demo to the whole HR shell so
 * that every sidebar link opens without a login wall — required for client
 * walkthroughs of the proposed UI.
 *
 * NOTE: this only removes the client / middleware login wall. The Frappe backend
 * remains the authority: without a valid `sid` cookie every data call is rejected,
 * so protected records are still not exposed.
 */
export const HR_DEMO_ENABLED = true

export const HR_DEMO_PREFIXES: string[] = [
  '/hr', '/hr-managers', '/requests', '/org-chart', '/me', '/profile',
  '/employees', '/employee', '/employee-details', '/employee-report',
  '/attendance', '/auto-attendance', '/biometric', '/punch-sheet', '/branches', '/payroll',
  '/shift-management', '/location-tracking', '/radius-alerts', '/team', '/shifts',
]

/** True when `pathname` is part of the public HR demo (login-free). */
export function isHrDemoPath(pathname: string): boolean {
  if (!HR_DEMO_ENABLED) return false
  return HR_DEMO_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + '/'))
}

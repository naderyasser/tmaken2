/**
 * Centralized status badge configuration.
 * Single source of truth for all status → Tailwind colour class mappings.
 * Any time a new status is added to the system, add it here.
 */

export const STATUS_CLASS_MAP: Record<string, string> = {
  // ── Generic record lifecycle ──────────────────────────────────
  Active:              'bg-green-100 text-green-700',
  Inactive:            'bg-gray-100 text-gray-600',
  Suspended:           'bg-yellow-100 text-yellow-700',
  Left:                'bg-red-100 text-red-600',
  Draft:               'bg-gray-100 text-gray-600',
  Submitted:           'bg-blue-100 text-blue-700',
  Open:                'bg-blue-100 text-blue-700',
  Closed:              'bg-gray-100 text-gray-600',
  Pending:             'bg-amber-100 text-amber-700',
  Approved:            'bg-green-100 text-green-700',
  Rejected:            'bg-red-100 text-red-700',
  Cancelled:           'bg-red-100 text-red-600',
  Completed:           'bg-gray-100 text-gray-600',
  // ── Violation register states (F3) ────────────────────────────
  'Planned Action':     'bg-amber-100 text-amber-700',
  'Applied Action':     'bg-blue-100 text-blue-700',
  'Grievance Accepted': 'bg-emerald-100 text-emerald-700',
  Invalidated:          'bg-gray-100 text-gray-600',
  Exempted:             'bg-teal-100 text-teal-700',
  Accepted:              'bg-emerald-100 text-emerald-700',
  'Partially Accepted':  'bg-blue-100 text-blue-700',
  'Credit Note Issued':  'bg-purple-100 text-purple-700',

  // ── Payroll component types ───────────────────────────────────
  Earning:   'bg-green-100 text-green-800',
  Deduction: 'bg-red-100 text-red-800',

  // ── Salary structure ──────────────────────────────────────────
  is_active_true:  'bg-green-100 text-green-800',
  is_active_false: 'bg-gray-100 text-gray-600',

  // ── Warehouse types ───────────────────────────────────────────
  Main:              'bg-blue-100 text-blue-700',
  Van:               'bg-emerald-100 text-emerald-700',
  'Customer Location':'bg-violet-100 text-violet-700',
  Temporary:         'bg-amber-100 text-amber-700',
  Damaged:           'bg-red-100 text-red-700',
  Returns:           'bg-orange-100 text-orange-700',

  // ── Stock movement types ──────────────────────────────────────
  In:       'bg-emerald-100 text-emerald-700',
  Out:      'bg-red-100 text-red-700',
  Transfer: 'bg-blue-100 text-blue-700',
}

export const DEFAULT_STATUS_CLASS = 'bg-gray-100 text-gray-600'

/**
 * Returns the Tailwind class string for a given status key.
 * Falls back to a neutral gray if the status is not in the map.
 */
export function getStatusClass(status: string | undefined | null): string {
  if (!status) return DEFAULT_STATUS_CLASS
  return STATUS_CLASS_MAP[status] ?? DEFAULT_STATUS_CLASS
}

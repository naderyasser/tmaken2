/**
 * JS mirror of the `--apex-chart-*` custom properties defined in
 * `app/globals.css` under `.theme-hr` (added 2026-09-19, hex→token cleanup).
 *
 * Recharts renders some props (e.g. `fill`, `stroke` on `<Cell>`/`<CartesianGrid>`)
 * through its own layer rather than plain CSS, so passing a `var(--apex-…)`
 * string is not always reliable there. This map keeps the exact same hex
 * values as globals.css, just resolved at import time instead of via
 * `getComputedStyle`, so chart props stay in sync with the CSS tokens without
 * a runtime lookup.
 *
 * IMPORTANT: if a hex value here ever needs to change, change it in
 * `app/globals.css` first and copy the same value here — these must always
 * match exactly, or the chart colors will drift from the rest of the theme.
 */
export const APEX = {
  chartPresent: '#497cff',
  chartAbsent: '#dc3545',
  chartLeave: '#34c75a',
  chartTick: '#64748b',
  chartNeutralIcon: '#808080',
  chartAbsentIcon: '#ff0000',
  chartPanelBg: '#f1f2f4',
  chartGrid: '#e2e8f0',
  chartAxisLine: '#cbd5e1',
  chartBadgeBg: '#dbeafe',
  chartBadgeText: '#2456a6',
  chartSeriesBlue: '#3b82f6',
  chartSeriesGray: '#94a3b8',
  chartSeriesAmber: '#f59e0b',
} as const

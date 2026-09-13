/**
 * Shared Jisr-style HR component kit. Import from '@/components/shared'.
 * These are label-agnostic presentational primitives (callers pass all text as
 * props) — token-only, logical-RTL, WCAG-AA.
 */

export { PageHeader, type PageHeaderProps } from './page-header'
export { KpiTile, type KpiTileProps } from './kpi-tile'
export { SegmentedControl, type SegmentedControlProps, type SegmentOption } from './segmented-control'
export { FilterBar, type FilterBarProps } from './filter-bar'
export { EmptyState, type EmptyStateProps } from './empty-state'
export { DetailDrawer, type DetailDrawerProps } from './detail-drawer'
export { Stepper, type StepperProps, type StepperStep } from './stepper'
export {
  DataTable, emptyDash,
  type DataTableColumn, type DataTableFilter, type DataTableRowAction,
  type DataTableBulkAction, type DataTableDateFilter,
} from './data-table'

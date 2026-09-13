'use client'

import { type ReactNode } from 'react'

export interface Column<T> {
  key: string
  label: string
  render?: (row: T) => ReactNode
}

export interface StatusOption {
  value: string // '' = all
  label: string
}

/** Reusable in-dashboard request inbox list (contracts, leads, …). RTL/espresso, no desk redirect. */
export default function RequestTable<T extends { name: string }>({
  title, icon: Icon, columns, rows, loading, statusOptions, activeStatus, onStatusChange, onRowClick, emptyLabel,
}: {
  title: string
  icon: any
  columns: Column<T>[]
  rows: T[]
  loading: boolean
  statusOptions: StatusOption[]
  activeStatus: string
  onStatusChange: (v: string) => void
  onRowClick: (name: string) => void
  emptyLabel: string
}) {
  return (
    <div className="space-y-5">
      <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900"><Icon className="h-6 w-6 text-emerald-700" />{title}</h1>

      <div className="flex flex-wrap gap-2">
        {statusOptions.map((s) => (
          <button
            key={s.value || 'all'}
            onClick={() => onStatusChange(s.value)}
            className={`rounded-xl px-4 py-2 text-sm font-medium transition-colors ${activeStatus === s.value ? 'bg-emerald-700 text-white' : 'bg-white text-gray-600 border border-gray-200 hover:border-emerald-200'}`}
          >
            {s.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-2">{[...Array(5)].map((_, i) => <div key={i} className="h-12 animate-pulse rounded-xl bg-gray-100" />)}</div>
      ) : rows.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-gray-200 p-12 text-center text-gray-400">{emptyLabel}</div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border-2 border-gray-100 bg-white">
          <table className="w-full text-start text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-xs text-gray-500">
                {columns.map((c) => <th key={c.key} className="whitespace-nowrap px-4 py-3 text-start font-medium">{c.label}</th>)}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr
                  key={row.name}
                  onClick={() => onRowClick(row.name)}
                  className="cursor-pointer border-b border-gray-50 last:border-0 hover:bg-emerald-50/40"
                >
                  {columns.map((c) => (
                    <td key={c.key} className="whitespace-nowrap px-4 py-3 text-gray-800">
                      {c.render ? c.render(row) : ((row as any)[c.key] ?? '—')}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

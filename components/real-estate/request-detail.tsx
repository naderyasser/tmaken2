'use client'

import { useState, type ReactNode } from 'react'
import { ArrowRight, Loader2, Check, Paperclip } from 'lucide-react'

export interface DetailField {
  label: string
  value: ReactNode
}
export interface StatusStep {
  value: string
  label: string
}

/** Reusable in-dashboard request detail (read-only fields + admin status control + team notes). */
export default function RequestDetail({
  title, refId, statusLabel, statusTone, onBack, fields, detailsText, attachment, attachmentLabel,
  steps, currentStatus, onSetStatus, teamNotes, onSaveNotes, canWrite, isRTL,
  detailsHeading, statusHeading, teamNotesHeading, teamNotesPlaceholder, saveLabel, attachmentDownload,
}: {
  title: string
  refId: string
  statusLabel: string
  statusTone: string
  onBack: () => void
  fields: DetailField[]
  detailsText?: string
  attachment?: string
  attachmentLabel: string
  attachmentDownload: string
  steps: StatusStep[]
  currentStatus: string
  onSetStatus: (status: string, teamNotes: string) => Promise<void>
  teamNotes?: string
  onSaveNotes: (notes: string) => Promise<void>
  canWrite: boolean
  isRTL: boolean
  detailsHeading: string
  statusHeading: string
  teamNotesHeading: string
  teamNotesPlaceholder: string
  saveLabel: string
}) {
  const [notes, setNotes] = useState(teamNotes || '')
  const [busy, setBusy] = useState('')

  const setStatus = async (s: string) => {
    setBusy(s)
    try { await onSetStatus(s, notes) } finally { setBusy('') }
  }
  const saveNotes = async () => {
    setBusy('notes')
    try { await onSaveNotes(notes) } finally { setBusy('') }
  }

  // The applicant's type-specific details arrive as newline "label: value" lines.
  const detailLines = (detailsText || '').split('\n').map((l) => l.trim()).filter(Boolean)

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="rounded-xl border border-gray-200 p-2 text-gray-500 hover:bg-gray-50"><ArrowRight className={`h-5 w-5 ${isRTL ? '' : 'rotate-180'}`} /></button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
            <p className="text-sm text-gray-400 tabular-nums">{refId}</p>
          </div>
        </div>
        <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium ${statusTone}`}>{statusLabel}</span>
      </div>

      {/* Shared essentials */}
      <div className="grid grid-cols-1 gap-x-6 gap-y-4 rounded-2xl border-2 border-gray-100 bg-white p-5 sm:grid-cols-2">
        {fields.map((f, i) => (
          <div key={i}>
            <p className="text-xs text-gray-400">{f.label}</p>
            <p className="mt-0.5 text-sm font-medium text-gray-900">{f.value || '—'}</p>
          </div>
        ))}
      </div>

      {/* Type-specific details (Arabic label: value lines) */}
      {detailLines.length > 0 && (
        <div className="rounded-2xl border-2 border-gray-100 bg-white p-5">
          <h2 className="mb-3 text-sm font-semibold text-gray-900">{detailsHeading}</h2>
          <dl className="grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-2">
            {detailLines.map((line, i) => {
              const idx = line.indexOf(':')
              const label = idx >= 0 ? line.slice(0, idx).trim() : line
              const value = idx >= 0 ? line.slice(idx + 1).trim() : ''
              return (
                <div key={i} className="flex justify-between gap-3 border-b border-gray-50 py-1.5 last:border-0">
                  <dt className="text-xs text-gray-500">{label}</dt>
                  <dd className="text-sm font-medium text-gray-800">{value}</dd>
                </div>
              )
            })}
          </dl>
        </div>
      )}

      {/* Attachment */}
      {attachment && (
        <a href={attachment} target="_blank" rel="noopener noreferrer" download className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm text-emerald-700 hover:border-emerald-200">
          <Paperclip className="h-4 w-4" />{attachmentDownload}
        </a>
      )}

      {/* Status control + team notes (admin only) */}
      {canWrite && (
        <div className="rounded-2xl border-2 border-gray-100 bg-white p-5">
          <h2 className="mb-3 text-sm font-semibold text-gray-900">{statusHeading}</h2>
          <div className="flex flex-wrap gap-2">
            {steps.map((s) => (
              <button
                key={s.value}
                onClick={() => setStatus(s.value)}
                disabled={!!busy || currentStatus === s.value}
                className={`inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-medium disabled:cursor-default ${currentStatus === s.value ? 'bg-emerald-700 text-white' : 'border border-gray-200 text-gray-700 hover:border-emerald-200 disabled:opacity-50'}`}
              >
                {busy === s.value ? <Loader2 className="h-4 w-4 animate-spin" /> : currentStatus === s.value ? <Check className="h-4 w-4" /> : null}
                {s.label}
              </button>
            ))}
          </div>

          <h2 className="mb-2 mt-5 text-sm font-semibold text-gray-900">{teamNotesHeading}</h2>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            placeholder={teamNotesPlaceholder}
            className="w-full rounded-xl border border-gray-200 p-3 text-sm outline-none focus:border-emerald-400"
          />
          <button onClick={saveNotes} disabled={busy === 'notes'} className="mt-2 inline-flex items-center gap-1.5 rounded-xl bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-60">
            {busy === 'notes' ? <Loader2 className="h-4 w-4 animate-spin" /> : null}{saveLabel}
          </button>
        </div>
      )}
    </div>
  )
}

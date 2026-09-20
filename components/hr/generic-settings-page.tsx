'use client'

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { Loader2, Check, X, AlertCircle } from 'lucide-react'
import { frappeClient } from '@/lib/api-client'
import { useToast } from '@/hooks/use-toast'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { FieldInput, toFormValue, toPayload } from '@/components/hr/field-input'
import { useBreadcrumbs } from '@/lib/breadcrumbs'
import { cn } from '@/lib/utils'
import type { SettingsModuleConfig } from '@/lib/hr-modules'

/**
 * Apex settings/form screen — matches the reference (company information):
 * action bar on top (breadcrumb right · حفظ/اغلاق left) then a card of grouped
 * fields in two columns.
 */
export function GenericSettingsPage({
  config,
  recordName,
  breadcrumbOverride,
  extra,
  fullWidthFields,
}: {
  config: SettingsModuleConfig
  recordName?: string
  /** Apex-exact crumb labels for this page (e.g. ["الاعدادات", "بيانات الشركة"]) — overrides the generic URL-derived trail (S9). */
  breadcrumbOverride?: string[]
  /** Extra content rendered between the action bar and the form card — e.g. the company logo placeholder (5.25). */
  extra?: ReactNode
  /** Field names that should span both grid columns (5.25: email + both addresses are full-width rows). */
  fullWidthFields?: string[]
}) {
  const { toast } = useToast()
  const autoCrumbs = useBreadcrumbs()
  const crumbs = breadcrumbOverride ? breadcrumbOverride.map((label) => ({ label })) : autoCrumbs
  const [form, setForm] = useState<Record<string, any>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [loadError, setLoadError] = useState(false)
  // The record actually being edited. `recordName` may be unknown (e.g. the
  // active company for an account with no Employee link), so fall back to the
  // first record of the doctype instead of hitting the list endpoint, which only
  // returns names and would render — and then save — an empty form.
  const [docName, setDocName] = useState<string | undefined>(recordName)

  const load = useCallback(async () => {
    setLoading(true)
    setLoadError(false)
    try {
      let name = recordName
      if (!name) {
        const list = await frappeClient.get<{ name: string }[]>(config.doctype, undefined, { fields: ['name'], limit_page_length: 1 })
        name = (list as any)?.data?.[0]?.name
      }
      setDocName(name)
      const res = name
        ? await frappeClient.get<Record<string, any>>(config.doctype, name)
        : await frappeClient.get<any>(config.doctype)
      let data: any = (res as any)?.data
      if (Array.isArray(data)) data = data[0] ?? {}
      const initial: Record<string, any> = {}
      for (const f of config.fields) initial[f.field] = toFormValue(f, data?.[f.field])
      setForm(initial)
    } catch (e) {
      console.error(`Failed to load ${config.doctype}:`, e)
      setLoadError(true)
      const initial: Record<string, any> = {}
      for (const f of config.fields) initial[f.field] = f.type === 'checkbox' ? false : ''
      setForm(initial)
    } finally { setLoading(false) }
  }, [config.doctype, config.fields, recordName])

  useEffect(() => { load() }, [load])

  const save = async () => {
    setSaving(true)
    try {
      await frappeClient.put(config.doctype, docName || config.doctype, toPayload(config.fields, form))
      toast({ title: 'تم الحفظ' })
    } catch (e) {
      toast({ title: 'فشل الحفظ', description: e instanceof Error ? e.message : 'تعذّر الاتصال بالخادم', variant: 'destructive' })
    } finally { setSaving(false) }
  }

  // Split the fields into two titled sections, like the reference form.
  const [top, bottom] = useMemo(() => {
    const cut = Math.max(1, Math.ceil(config.fields.length * 0.55))
    return [config.fields.slice(0, cut), config.fields.slice(cut)]
  }, [config.fields])

  const renderFields = (fields: typeof config.fields) => (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-5">
      {fields.map((f) => (
        <div key={f.field} className={cn('space-y-1.5', fullWidthFields?.includes(f.field) && 'md:col-span-2')}>
          {f.type !== 'checkbox' && (
            <Label className="text-[13px] text-slate-600">
              {f.label}{f.required && <span className="text-red-500"> *</span>}
            </Label>
          )}
          <FieldInput field={f} value={form[f.field]} onChange={(v) => setForm((prev) => ({ ...prev, [f.field]: v }))} />
        </div>
      ))}
    </div>
  )

  return (
    <div dir="rtl" className="p-4 space-y-3 font-[family-name:var(--font-arabic)]">

      {/* ── Action bar: breadcrumb (right) · actions (left) ── */}
      <div className="flex items-center justify-between gap-4 bg-white rounded shadow-sm border border-slate-200/60 px-4 py-2.5">
        <nav className="flex items-center gap-1.5 text-[14px] min-w-0" dir="rtl">
          {crumbs.map((c, i) => (
            <span key={i} className="flex items-center gap-1.5 min-w-0">
              {i > 0 && <span className="text-slate-400">/</span>}
              <span className={i === crumbs.length - 1 ? 'font-bold text-slate-800 truncate' : 'truncate text-[var(--apex-link)]'}>{c.label}</span>
            </span>
          ))}
        </nav>

        <div className="flex items-center gap-2 shrink-0">
          <Button onClick={save} disabled={saving || loading}
            className="bg-[var(--apex-green)] hover:bg-[var(--apex-green-dark)] text-white rounded px-5 h-9 font-bold text-[13px]">
            {saving ? <Loader2 className="h-4 w-4 ml-1.5 animate-spin" /> : <Check className="h-4 w-4 ml-1.5" strokeWidth={3} />}
            حفظ
          </Button>
          <Button onClick={load} disabled={saving || loading}
            className="bg-[var(--apex-red)] hover:bg-[var(--apex-red-dark)] text-white rounded px-5 h-9 font-bold text-[13px]">
            <X className="h-4 w-4 ml-1.5" strokeWidth={3} />
            اغلاق
          </Button>
        </div>
      </div>

      {extra}

      {loadError && !loading && (
        <div className="flex items-center gap-2 rounded bg-amber-50 border border-amber-200 px-3 py-2 text-[12.5px] text-amber-800">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>تعذّر تحميل البيانات من الخادم. يمكنك تعديل القيم ومحاولة الحفظ بعد استعادة الاتصال.</span>
        </div>
      )}

      {/* ── Form ── */}
      <div className="bg-white rounded shadow-sm border border-slate-200/60 p-6">
        {loading ? (
          <div className="py-16 text-center"><Loader2 className="h-8 w-8 animate-spin text-[var(--apex-blue-light)] mx-auto" /></div>
        ) : (
          <div className="space-y-8">
            <section className="space-y-5">
              <h3 className="text-[18px] font-bold text-slate-800">البيانات الاساسية</h3>
              {renderFields(top)}
            </section>
            {bottom.length > 0 && (
              <section className="space-y-5">
                <h3 className="text-[18px] font-bold text-slate-800">بيانات الاتصال</h3>
                {renderFields(bottom)}
              </section>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

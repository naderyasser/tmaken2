'use client'

import { useCallback, useEffect, useState } from 'react'
import { Save, Loader2, RefreshCw, AlertCircle } from 'lucide-react'
import { frappeClient } from '@/lib/api-client'
import { useToast } from '@/hooks/use-toast'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { FieldInput, toFormValue, toPayload } from '@/components/hr/field-input'
import type { SettingsModuleConfig } from '@/lib/hr-modules'

/**
 * Generic settings screen: loads one document (singleton doctype, or a named
 * record such as the active Company) and saves it with PUT.
 */
export function GenericSettingsPage({
  config, recordName,
}: { config: SettingsModuleConfig; recordName?: string }) {
  const { toast } = useToast()
  const [form, setForm] = useState<Record<string, any>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [loadError, setLoadError] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setLoadError(false)
    try {
      const res = recordName
        ? await frappeClient.get<Record<string, any>>(config.doctype, recordName)
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
    } finally {
      setLoading(false)
    }
  }, [config.doctype, config.fields, recordName])

  useEffect(() => { load() }, [load])

  const save = async () => {
    setSaving(true)
    try {
      await frappeClient.put(config.doctype, recordName || config.doctype, toPayload(config.fields, form))
      toast({ title: 'تم الحفظ' })
    } catch (e) {
      toast({
        title: 'فشل الحفظ',
        description: e instanceof Error ? e.message : 'تعذّر الاتصال بالخادم',
        variant: 'destructive',
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div dir="rtl" className="space-y-4 p-6 font-[family-name:var(--font-arabic)]">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-800">{config.title}</h1>
          {config.subtitle && <p className="text-[13px] text-slate-500 mt-0.5">{config.subtitle}</p>}
        </div>
        <Button
          variant="ghost" size="icon" onClick={load} title="تحديث"
          className="text-[#195a9e] hover:bg-blue-50"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      {loadError && !loading && (
        <div className="flex items-center gap-2 rounded-sm bg-amber-50 border border-amber-200 px-3 py-2 text-[12.5px] text-amber-800">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>تعذّر تحميل الإعدادات من الخادم. يمكنك تعديل القيم ومحاولة الحفظ بعد استعادة الاتصال.</span>
        </div>
      )}

      <div className="bg-white rounded-md shadow-sm border border-slate-200/60">
        <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
          {loading ? (
            <div className="col-span-full py-12 text-center">
              <Loader2 className="h-8 w-8 animate-spin text-[#195a9e] mx-auto" />
            </div>
          ) : (
            config.fields.map((f) => (
              <div key={f.field} className="space-y-1.5">
                {f.type !== 'checkbox' && (
                  <Label className="text-[13px] text-slate-600">{f.label}</Label>
                )}
                <FieldInput
                  field={f}
                  value={form[f.field]}
                  onChange={(v) => setForm((prev) => ({ ...prev, [f.field]: v }))}
                />
              </div>
            ))
          )}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-slate-100 p-4">
          <Button variant="outline" onClick={load} disabled={saving || loading}>استعادة</Button>
          <Button
            onClick={save}
            disabled={saving || loading}
            className="bg-[#195a9e] hover:bg-[#154d8a] text-white font-bold"
          >
            {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
            حفظ
          </Button>
        </div>
      </div>
    </div>
  )
}

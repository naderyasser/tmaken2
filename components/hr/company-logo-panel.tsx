'use client'

import { useCallback, useEffect, useState } from 'react'
import { Image as ImageIcon, Loader2, Trash2 } from 'lucide-react'
import { frappeClient } from '@/lib/api-client'
import { useToast } from '@/hooks/use-toast'
import { frappeImageUrl } from '@/lib/utils'

/** Apex `checkImageSize` — 1 MB. Same limit and message as the employee photo. */
const MAX_IMAGE_BYTES = 1 * 1024 * 1024

function getCsrfTokenFromCookie(): string | null {
  if (typeof document === 'undefined') return null
  const cookie = document.cookie.split('; ').find((c) => c.startsWith('csrf_token=') || c.startsWith('csrftoken='))
  return cookie ? decodeURIComponent(cookie.split('=')[1]) : null
}

/** Same upload path `apex-employee-form.tsx` uses for the employee photo,
 *  attached to `Company`. (Test round 4 fix: Frappe's whitelisted upload
 *  method lives at `/api/method/upload_file`, not `/api/upload_file`.) */
async function uploadCompanyLogo(file: File, docname: string): Promise<string> {
  const formData = new FormData()
  formData.append('file', file)
  formData.append('doctype', 'Company')
  formData.append('docname', docname)
  formData.append('fieldname', 'company_logo')
  formData.append('is_private', '0')
  const headers: Record<string, string> = {}
  const csrf = getCsrfTokenFromCookie() || (await frappeClient.fetchCsrfToken())
  if (csrf) headers['X-Frappe-CSRF-Token'] = csrf
  const res = await fetch('/api/method/upload_file', { method: 'POST', credentials: 'include', headers, body: formData })
  if (!res.ok) throw new Error('تعذّر رفع الشعار')
  const data = await res.json().catch(() => null)
  const url = data?.message?.file_url || data?.file_url
  if (!url) throw new Error('تعذّر رفع الشعار')
  return url as string
}

/**
 * «بيانات الشركة» — logo panel: preview of `Company.company_logo`, «رفع الشعار»
 * (≤ 1 MB, same message as the employee photo), «إزالة». Sits above the generic
 * text-field settings card for the company-data module.
 */
export function CompanyLogoPanel({ company }: { company?: string }) {
  const { toast } = useToast()
  const [logo, setLogo] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    if (!company) { setLoading(false); return }
    setLoading(true)
    try {
      const res: any = await frappeClient.get<{ company_logo?: string }>('Company', company)
      setLogo(res?.data?.company_logo || '')
    } catch {
      setLogo('')
    } finally {
      setLoading(false)
    }
  }, [company])
  useEffect(() => { load() }, [load])

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file || !company) return
    if (file.size > MAX_IMAGE_BYTES) {
      toast({ title: 'حجم الصورة يجب ألا يتجاوز 1 ميجابايت', variant: 'destructive' })
      return
    }
    setBusy(true)
    try {
      const fileUrl = await uploadCompanyLogo(file, company)
      await frappeClient.put('Company', company, { company_logo: fileUrl })
      setLogo(fileUrl)
      toast({ title: 'تم الحفظ' })
    } catch (e: any) {
      toast({ title: 'فشل رفع الشعار', description: e?.message, variant: 'destructive' })
    } finally {
      setBusy(false)
    }
  }

  const handleRemove = async () => {
    if (!company) return
    const prev = logo
    setLogo('')
    setBusy(true)
    try {
      await frappeClient.put('Company', company, { company_logo: '' })
      toast({ title: 'تم الحفظ' })
    } catch (e: any) {
      setLogo(prev)
      toast({ title: 'فشلت إزالة الشعار', description: e?.message, variant: 'destructive' })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div dir="rtl" className="p-4 pb-0">
      <div className="bg-white rounded shadow-sm border border-slate-200/60 px-6 py-6 flex flex-col items-center gap-2">
        {/* 5.25: centered logo placeholder, click anywhere on it to upload (≤1MB) */}
        <label
          className="h-[100px] w-[100px] shrink-0 rounded bg-slate-100 flex items-center justify-center overflow-hidden cursor-pointer hover:bg-slate-200/70 transition-colors"
          title="اضغط لرفع الشعار"
        >
          {loading || busy ? (
            <Loader2 className="h-7 w-7 animate-spin text-slate-500" />
          ) : logo ? (
            <img src={frappeImageUrl(logo)} alt="" className="h-full w-full object-contain" />
          ) : (
            <ImageIcon className="h-10 w-10 text-slate-400" />
          )}
          <input type="file" accept="image/*" className="hidden" onChange={handleUpload} disabled={busy || !company} />
        </label>
        {logo && (
          <button type="button" onClick={handleRemove} disabled={busy} className="text-[12.5px] text-[var(--apex-red)] hover:underline disabled:opacity-60 flex items-center gap-1">
            <Trash2 className="h-3 w-3" />
            إزالة
          </button>
        )}
      </div>
    </div>
  )
}

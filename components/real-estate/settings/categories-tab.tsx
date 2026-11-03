'use client'

import { useEffect, useMemo, useState } from 'react'
import { DragDropContext, Droppable, Draggable, type DropResult } from '@hello-pangea/dnd'
import { useI18n } from '@/lib/i18n'
import { useToast } from '@/hooks/use-toast'
import { realEstateApi, type AqarCategory } from '@/lib/real-estate-api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription,
  AlertDialogFooter, AlertDialogCancel, AlertDialogAction,
} from '@/components/ui/alert-dialog'
import {
  Building2, Home, Trees, Store, Warehouse, Tent, LandPlot, Hotel, Layers, MapPin,
  GripVertical, Plus, Pencil, Trash2, Loader2, FolderTree,
} from 'lucide-react'

const ICONS: Record<string, any> = {
  Building2, Home, Trees, Store, Warehouse, Tent, LandPlot, Hotel, Layers, MapPin,
}
const ICON_NAMES = Object.keys(ICONS)
function CatIcon({ name, className }: { name?: string; className?: string }) {
  const I = (name && ICONS[name]) || FolderTree
  return <I className={className} />
}

type Form = Partial<AqarCategory> & { _new?: boolean }

export function CategoriesTab({ canEdit }: { canEdit: boolean }) {
  const { isRTL } = useI18n()
  const { toast } = useToast()
  const [cats, setCats] = useState<AqarCategory[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [form, setForm] = useState<Form | null>(null)
  const [del, setDel] = useState<AqarCategory | null>(null)
  const [reassignTo, setReassignTo] = useState('')

  const load = async () => {
    setLoading(true)
    try { setCats(await realEstateApi.admin.listCategories()) }
    catch (e: any) { toast({ title: isRTL ? 'خطأ' : 'Error', description: e?.message, variant: 'destructive' }) }
    finally { setLoading(false) }
  }
  useEffect(() => { load() /* eslint-disable-next-line */ }, [])

  const leaves = useMemo(() => cats.filter((c) => !c.is_group), [cats])

  const onDragEnd = async (r: DropResult) => {
    if (!r.destination || r.destination.index === r.source.index) return
    const next = Array.from(cats)
    const [moved] = next.splice(r.source.index, 1)
    next.splice(r.destination.index, 0, moved)
    setCats(next)
    try { await realEstateApi.admin.reorderCategories(next.map((c) => c.name)) }
    catch (e: any) { toast({ title: isRTL ? 'خطأ' : 'Error', description: e?.message, variant: 'destructive' }); load() }
  }

  const save = async () => {
    if (!form) return
    if (!form.category_name_ar || !form.category_name_en) {
      toast({ title: isRTL ? 'أكمل الاسم بالعربي والإنجليزي' : 'Both names are required', variant: 'destructive' }); return
    }
    setBusy(true)
    try {
      const payload = {
        category_name_ar: form.category_name_ar, category_name_en: form.category_name_en,
        parent_aqar_category: form.parent_aqar_category || undefined, icon: form.icon || undefined,
        allow_sale: form.allow_sale ? 1 : 0, allow_rent: form.allow_rent ? 1 : 0,
        allow_daily_rent: form.allow_daily_rent ? 1 : 0,
      }
      if (form._new) await realEstateApi.admin.createCategory(payload)
      else await realEstateApi.admin.updateCategory({ name: form.name, ...payload })
      toast({ title: isRTL ? 'تم الحفظ' : 'Saved' })
      setForm(null); load()
    } catch (e: any) { toast({ title: isRTL ? 'خطأ' : 'Error', description: e?.message, variant: 'destructive' }) }
    finally { setBusy(false) }
  }

  const toggle = async (c: AqarCategory) => {
    try { await realEstateApi.admin.toggleCategory(c.name, c.enabled ? 0 : 1); load() }
    catch (e: any) { toast({ title: isRTL ? 'خطأ' : 'Error', description: e?.message, variant: 'destructive' }) }
  }

  const doDelete = async () => {
    if (!del) return
    setBusy(true)
    try {
      if (reassignTo) await realEstateApi.admin.reassignCategory(del.name, reassignTo)
      await realEstateApi.admin.deleteCategory(del.name)
      toast({ title: isRTL ? 'تم الحذف' : 'Deleted' })
      setDel(null); setReassignTo(''); load()
    } catch (e: any) { toast({ title: isRTL ? 'تعذّر الحذف' : 'Cannot delete', description: e?.message, variant: 'destructive' }) }
    finally { setBusy(false) }
  }

  if (loading) return <div className="space-y-2">{[...Array(6)].map((_, i) => <Skeleton key={i} className="h-14 rounded-xl" />)}</div>

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">{isRTL ? `${cats.length} قسم` : `${cats.length} categories`}</p>
        {canEdit && (
          <Button size="sm" className="bg-emerald-700 hover:bg-emerald-800" onClick={() => setForm({ _new: true, enabled: 1, allow_sale: 1, allow_rent: 1, allow_daily_rent: 0 })}>
            <Plus className={isRTL ? 'ml-1.5 h-4 w-4' : 'mr-1.5 h-4 w-4'} />{isRTL ? 'قسم جديد' : 'New Category'}
          </Button>
        )}
      </div>

      <DragDropContext onDragEnd={onDragEnd}>
        <Droppable droppableId="cats" isDropDisabled={!canEdit}>
          {(prov) => (
            <div ref={prov.innerRef} {...prov.droppableProps} className="space-y-2">
              {cats.map((c, i) => (
                <Draggable key={c.name} draggableId={c.name} index={i} isDragDisabled={!canEdit}>
                  {(p) => (
                    <div ref={p.innerRef} {...p.draggableProps}
                      className={`flex items-center gap-3 rounded-xl border-2 border-gray-100 bg-white p-3 ${c.enabled ? '' : 'opacity-55'}`}>
                      {canEdit && <span {...p.dragHandleProps} className="cursor-grab text-gray-300 hover:text-gray-500"><GripVertical className="h-4 w-4" /></span>}
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700">
                        <CatIcon name={c.icon} className="h-4.5 w-4.5" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-gray-900">{isRTL ? c.category_name_ar : c.category_name_en}</p>
                        <p className="truncate text-[11px] text-gray-400">{isRTL ? c.category_name_en : c.category_name_ar}{c.parent_aqar_category ? ` · ${c.parent_aqar_category}` : ''}</p>
                      </div>
                      <div className="hidden items-center gap-1 sm:flex">
                        {c.allow_sale ? <Badge variant="outline" className="text-[10px]">{isRTL ? 'بيع' : 'Sale'}</Badge> : null}
                        {c.allow_rent ? <Badge variant="outline" className="text-[10px]">{isRTL ? 'إيجار' : 'Rent'}</Badge> : null}
                        {c.allow_daily_rent ? <Badge variant="outline" className="text-[10px]">{isRTL ? 'يومي' : 'Daily'}</Badge> : null}
                      </div>
                      <span className="text-[11px] tabular-nums text-gray-400">{c.listing_count ?? 0}</span>
                      {canEdit && (
                        <div className="flex items-center gap-1">
                          <button onClick={() => toggle(c)} title={c.enabled ? (isRTL ? 'تعطيل' : 'Disable') : (isRTL ? 'تفعيل' : 'Enable')}
                            className={`rounded-md px-2 py-1 text-[11px] font-medium ${c.enabled ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-500'}`}>
                            {c.enabled ? (isRTL ? 'مُفعّل' : 'On') : (isRTL ? 'معطّل' : 'Off')}
                          </button>
                          <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-gray-400 hover:text-emerald-700" onClick={() => setForm({ ...c })}><Pencil className="h-3.5 w-3.5" /></Button>
                          <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-gray-400 hover:text-red-500" onClick={() => { setDel(c); setReassignTo('') }}><Trash2 className="h-3.5 w-3.5" /></Button>
                        </div>
                      )}
                    </div>
                  )}
                </Draggable>
              ))}
              {prov.placeholder}
            </div>
          )}
        </Droppable>
      </DragDropContext>

      {/* Create / edit dialog */}
      <Dialog open={!!form} onOpenChange={(o) => !o && setForm(null)}>
        <DialogContent dir={isRTL ? 'rtl' : 'ltr'} className="max-w-md">
          <DialogHeader><DialogTitle>{form?._new ? (isRTL ? 'قسم جديد' : 'New Category') : (isRTL ? 'تعديل القسم' : 'Edit Category')}</DialogTitle></DialogHeader>
          {form && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div><label className="text-xs text-gray-500">{isRTL ? 'الاسم (عربي)' : 'Name (AR)'}</label>
                  <Input value={form.category_name_ar || ''} onChange={(e) => setForm({ ...form, category_name_ar: e.target.value })} /></div>
                <div><label className="text-xs text-gray-500">{isRTL ? 'الاسم (إنجليزي)' : 'Name (EN)'}</label>
                  <Input value={form.category_name_en || ''} onChange={(e) => setForm({ ...form, category_name_en: e.target.value })} dir="ltr" /></div>
              </div>
              <div>
                <label className="text-xs text-gray-500">{isRTL ? 'القسم الأب (اختياري)' : 'Parent (optional)'}</label>
                <select className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm" value={form.parent_aqar_category || ''} onChange={(e) => setForm({ ...form, parent_aqar_category: e.target.value })}>
                  <option value="">{isRTL ? '— بدون —' : '— none —'}</option>
                  {cats.filter((x) => x.name !== form.name).map((x) => <option key={x.name} value={x.name}>{isRTL ? x.category_name_ar : x.category_name_en}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-500">{isRTL ? 'الأيقونة' : 'Icon'}</label>
                <div className="mt-1 flex flex-wrap gap-2">
                  {ICON_NAMES.map((n) => {
                    const I = ICONS[n]; const sel = form.icon === n
                    return <button key={n} onClick={() => setForm({ ...form, icon: n })} className={`flex h-9 w-9 items-center justify-center rounded-lg border-2 ${sel ? 'border-emerald-600 bg-emerald-50 text-emerald-700' : 'border-gray-200 text-gray-500'}`}><I className="h-4 w-4" /></button>
                  })}
                </div>
              </div>
              <div className="flex flex-wrap gap-4 pt-1">
                {([['allow_sale', isRTL ? 'بيع' : 'Sale'], ['allow_rent', isRTL ? 'إيجار' : 'Rent'], ['allow_daily_rent', isRTL ? 'إيجار يومي' : 'Daily Rent']] as const).map(([k, lbl]) => (
                  <label key={k} className="flex items-center gap-2 text-sm text-gray-700">
                    <input type="checkbox" checked={!!(form as any)[k]} onChange={(e) => setForm({ ...form, [k]: e.target.checked ? 1 : 0 })} />{lbl}
                  </label>
                ))}
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setForm(null)} disabled={busy}>{isRTL ? 'إلغاء' : 'Cancel'}</Button>
            <Button className="bg-emerald-700 hover:bg-emerald-800" onClick={save} disabled={busy}>{busy && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}{isRTL ? 'حفظ' : 'Save'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete + reassign */}
      <AlertDialog open={!!del} onOpenChange={(o) => !o && setDel(null)}>
        <AlertDialogContent dir={isRTL ? 'rtl' : 'ltr'}>
          <AlertDialogHeader>
            <AlertDialogTitle>{isRTL ? 'حذف القسم' : 'Delete Category'}</AlertDialogTitle>
            <AlertDialogDescription>
              {del && (del.listing_count ?? 0) > 0
                ? (isRTL ? `يحتوي على ${del.listing_count} إعلان. انقلها إلى قسم آخر قبل الحذف:` : `Has ${del.listing_count} listing(s). Move them to another category first:`)
                : (isRTL ? 'لا يمكن التراجع عن هذا الإجراء.' : 'This action cannot be undone.')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {del && (del.listing_count ?? 0) > 0 && (
            <select className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm" value={reassignTo} onChange={(e) => setReassignTo(e.target.value)}>
              <option value="">{isRTL ? '— اختر القسم البديل —' : '— choose target —'}</option>
              {leaves.filter((x) => x.name !== del.name).map((x) => <option key={x.name} value={x.name}>{isRTL ? x.category_name_ar : x.category_name_en}</option>)}
            </select>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>{isRTL ? 'إلغاء' : 'Cancel'}</AlertDialogCancel>
            <AlertDialogAction className="bg-red-600 hover:bg-red-700" disabled={busy || (!!del && (del.listing_count ?? 0) > 0 && !reassignTo)} onClick={(e) => { e.preventDefault(); doDelete() }}>
              {busy && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}{isRTL ? 'حذف' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

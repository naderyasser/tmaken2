'use client'

import { useState, useEffect, useCallback } from 'react'
import { frappeClient, DockConfig, DockModule, DockMenuItem } from '@/lib/api-client'
import { useI18n } from '@/lib/i18n'
import { useToast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'
import {
  LayoutGrid,
  Plus,
  Save,
  RotateCcw,
  ChevronDown,
  ChevronUp,
  Pencil,
  Trash2,
  Copy,
  GripVertical,
  Monitor,
  Smartphone,
  Eye,
  EyeOff,
  Download,
  Upload,
  Loader2,
  AlertCircle,
  CheckCircle2,
  X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'

// Available module IDs
const MODULE_OPTIONS = [
  'hr', 'sales', 'purchasing', 'inventory', 'accounting',
  'manufacturing', 'projects', 'support', 'website',
  'quality', 'assets', 'pos', 'settings'
]

// Icon options matching the backend
const ICON_OPTIONS = [
  'dashboard', 'users', 'calendar', 'cart', 'file', 'package', 'truck',
  'box', 'credit-card', 'dollar-sign', 'clipboard', 'check', 'book',
  'clock', 'shield', 'alert-circle', 'tool', 'globe', 'phone', 'mail',
  'map-pin', 'bar-chart', 'pie-chart', 'trending-up', 'layers',
  'briefcase', 'settings', 'user-plus', 'receipt', 'factory',
  'headphones', 'monitor', 'building', 'boxes', 'folder',
]

const COLOR_OPTIONS = [
  'blue', 'sky', 'green', 'amber', 'purple', 'emerald', 'orange',
  'indigo', 'cyan', 'pink', 'rose', 'violet', 'teal', 'red', 'slate'
]

const MODULE_COLORS: Record<string, string> = {
  hr: '#2563eb', sales: '#16a34a', purchasing: '#d97706', inventory: '#ea580c',
  accounting: '#9333ea', manufacturing: '#dc2626', projects: '#0d9488',
  support: '#db2777', website: '#0891b2', quality: '#4f46e5',
  assets: '#475569', pos: '#e11d48', settings: '#6366f1',
}

export function AdminDockConfig() {
  const { isRTL } = useI18n()
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [modules, setModules] = useState<DockModule[]>([])
  const [expandedModules, setExpandedModules] = useState<Set<number>>(new Set())
  const [hasChanges, setHasChanges] = useState(false)

  // Dialog state
  const [showModuleDialog, setShowModuleDialog] = useState(false)
  const [editingModuleIdx, setEditingModuleIdx] = useState<number | null>(null)
  const [moduleForm, setModuleForm] = useState({
    module_id: 'hr',
    label: '',
    icon_color: '#6366f1',
    is_enabled: true,
    show_in_mobile: true,
    show_in_desktop: true,
  })

  const [showItemDialog, setShowItemDialog] = useState(false)
  const [editingItemModuleIdx, setEditingItemModuleIdx] = useState<number>(0)
  const [editingItemIdx, setEditingItemIdx] = useState<number | null>(null)
  const [itemForm, setItemForm] = useState({
    label: '',
    route: '',
    icon_name: 'dashboard',
    icon_color: 'blue',
    is_enabled: true,
    show_in_mobile: true,
    show_in_desktop: true,
  })
  const [pendingAction, setPendingAction] = useState<{ title: string; description: string; onConfirm: () => void } | null>(null)

  // Load config
  const loadConfig = useCallback(async () => {
    setLoading(true)
    try {
      const config = await frappeClient.getDockConfig()
      setModules(config.modules || [])
      setHasChanges(false)
    } catch (error) {
      toast({ title: isRTL ? 'خطأ' : 'Error', description: isRTL ? 'فشل في تحميل الإعدادات' : 'Failed to load config', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }, [toast, isRTL])

  useEffect(() => { loadConfig() }, [loadConfig])

  // Save config
  const saveConfig = async () => {
    setSaving(true)
    try {
      const result = await frappeClient.saveDockConfig({ modules })
      if (result.success) {
        toast({ title: isRTL ? 'تم الحفظ' : 'Saved', description: isRTL ? 'تم حفظ الإعدادات بنجاح' : 'Configuration saved successfully' })
        setHasChanges(false)
      } else {
        throw new Error(result.message)
      }
    } catch (error) {
      toast({ title: isRTL ? 'خطأ' : 'Error', description: isRTL ? 'فشل في حفظ الإعدادات' : 'Failed to save config', variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  // Reset to default
  const resetConfig = () => {
    setPendingAction({
      title: isRTL ? 'هل أنت متأكد؟' : 'Reset to default?',
      description: isRTL ? 'سيتم حذف كل التعديلات.' : 'All customizations will be lost.',
      onConfirm: async () => {
        setLoading(true)
        try {
          const result = await frappeClient.resetDockConfig()
          if (result.success) {
            toast({ title: isRTL ? 'تم' : 'Done', description: isRTL ? 'تم إعادة الإعدادات الافتراضية' : 'Reset to default successfully' })
            await loadConfig()
          }
        } catch (error) {
          toast({ title: isRTL ? 'خطأ' : 'Error', description: isRTL ? 'فشل في إعادة الإعدادات' : 'Failed to reset', variant: 'destructive' })
        } finally {
          setLoading(false)
        }
      },
    })
  }

  // Module CRUD
  const openAddModule = () => {
    setEditingModuleIdx(null)
    setModuleForm({ module_id: 'hr', label: '', icon_color: '#6366f1', is_enabled: true, show_in_mobile: true, show_in_desktop: true })
    setShowModuleDialog(true)
  }

  const openEditModule = (idx: number) => {
    const m = modules[idx]
    setEditingModuleIdx(idx)
    setModuleForm({
      module_id: m.module_id,
      label: m.label,
      icon_color: m.icon_color,
      is_enabled: !!m.is_enabled,
      show_in_mobile: !!m.show_in_mobile,
      show_in_desktop: !!m.show_in_desktop,
    })
    setShowModuleDialog(true)
  }

  const saveModule = () => {
    if (!moduleForm.label.trim()) {
      toast({ title: isRTL ? 'خطأ' : 'Error', description: isRTL ? 'الاسم مطلوب' : 'Label is required', variant: 'destructive' })
      return
    }
    const newModules = [...modules]
    if (editingModuleIdx !== null) {
      newModules[editingModuleIdx] = { ...newModules[editingModuleIdx], ...moduleForm, is_enabled: moduleForm.is_enabled ? 1 : 0, show_in_mobile: moduleForm.show_in_mobile ? 1 : 0, show_in_desktop: moduleForm.show_in_desktop ? 1 : 0 }
    } else {
      newModules.push({
        ...moduleForm,
        is_enabled: moduleForm.is_enabled ? 1 : 0,
        show_in_mobile: moduleForm.show_in_mobile ? 1 : 0,
        show_in_desktop: moduleForm.show_in_desktop ? 1 : 0,
        display_order: newModules.length + 1,
        menu_items: [],
      })
    }
    setModules(newModules)
    setHasChanges(true)
    setShowModuleDialog(false)
  }

  const deleteModule = (idx: number) => {
    setPendingAction({
      title: isRTL ? 'حذف الموديول؟' : 'Delete module?',
      description: isRTL ? 'هل أنت متأكد من حذف هذا الموديول؟' : 'Are you sure you want to delete this module?',
      onConfirm: () => {
        setModules(modules.filter((_, i) => i !== idx))
        setHasChanges(true)
      },
    })
  }

  const duplicateModule = (idx: number) => {
    const copy = JSON.parse(JSON.stringify(modules[idx]))
    copy.label = copy.label + ' (Copy)'
    copy.display_order = modules.length + 1
    setModules([...modules, copy])
    setHasChanges(true)
  }

  const toggleModuleExpand = (idx: number) => {
    const newExpanded = new Set(expandedModules)
    newExpanded.has(idx) ? newExpanded.delete(idx) : newExpanded.add(idx)
    setExpandedModules(newExpanded)
  }

  // Menu Item CRUD
  const openAddItem = (moduleIdx: number) => {
    setEditingItemModuleIdx(moduleIdx)
    setEditingItemIdx(null)
    setItemForm({ label: '', route: '', icon_name: 'dashboard', icon_color: 'blue', is_enabled: true, show_in_mobile: true, show_in_desktop: true })
    setShowItemDialog(true)
  }

  const openEditItem = (moduleIdx: number, itemIdx: number) => {
    const item = modules[moduleIdx].menu_items[itemIdx]
    setEditingItemModuleIdx(moduleIdx)
    setEditingItemIdx(itemIdx)
    setItemForm({
      label: item.label,
      route: item.route,
      icon_name: item.icon_name || 'dashboard',
      icon_color: item.icon_color || 'blue',
      is_enabled: !!item.is_enabled,
      show_in_mobile: !!item.show_in_mobile,
      show_in_desktop: !!item.show_in_desktop,
    })
    setShowItemDialog(true)
  }

  const saveItem = () => {
    if (!itemForm.label.trim() || !itemForm.route.trim()) {
      toast({ title: isRTL ? 'خطأ' : 'Error', description: isRTL ? 'الاسم والمسار مطلوبين' : 'Label and route are required', variant: 'destructive' })
      return
    }
    const newModules = [...modules]
    const items = [...(newModules[editingItemModuleIdx].menu_items || [])]
    const itemData: DockMenuItem = {
      ...itemForm,
      is_enabled: itemForm.is_enabled ? 1 : 0,
      show_in_mobile: itemForm.show_in_mobile ? 1 : 0,
      show_in_desktop: itemForm.show_in_desktop ? 1 : 0,
      display_order: editingItemIdx !== null ? items[editingItemIdx].display_order : items.length + 1,
    }
    if (editingItemIdx !== null) {
      items[editingItemIdx] = itemData
    } else {
      items.push(itemData)
    }
    newModules[editingItemModuleIdx] = { ...newModules[editingItemModuleIdx], menu_items: items }
    setModules(newModules)
    setHasChanges(true)
    setShowItemDialog(false)
  }

  const deleteItem = (moduleIdx: number, itemIdx: number) => {
    setPendingAction({
      title: isRTL ? 'حذف العنصر؟' : 'Delete menu item?',
      description: isRTL ? 'هل أنت متأكد من حذف هذا العنصر؟' : 'Delete this menu item?',
      onConfirm: () => {
        const newModules = [...modules]
        newModules[moduleIdx] = {
          ...newModules[moduleIdx],
          menu_items: newModules[moduleIdx].menu_items.filter((_, i) => i !== itemIdx),
        }
        setModules(newModules)
        setHasChanges(true)
      },
    })
  }

  // Export/Import
  const exportConfig = () => {
    const data = JSON.stringify({ modules, exported_at: new Date().toISOString() }, null, 2)
    const blob = new Blob([data], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = 'meena-dock-config.json'; a.click()
    URL.revokeObjectURL(url)
    toast({ title: isRTL ? 'تم التصدير' : 'Exported', description: isRTL ? 'تم تصدير الإعدادات' : 'Configuration exported' })
  }

  const importConfig = () => {
    const input = document.createElement('input')
    input.type = 'file'; input.accept = '.json'
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (!file) return
      const reader = new FileReader()
      reader.onload = (ev) => {
        try {
          const config = JSON.parse(ev.target?.result as string)
          if (config.modules) {
            setModules(config.modules)
            setHasChanges(true)
            toast({ title: isRTL ? 'تم الاستيراد' : 'Imported', description: isRTL ? 'تم استيراد الإعدادات - لا تنسى الحفظ' : 'Imported - don\'t forget to save' })
          }
        } catch {
          toast({ title: isRTL ? 'خطأ' : 'Error', description: isRTL ? 'ملف غير صالح' : 'Invalid file', variant: 'destructive' })
        }
      }
      reader.readAsText(file)
    }
    input.click()
  }

  // Loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-indigo-600 mx-auto mb-3" />
          <p className="text-sm text-gray-400">{isRTL ? 'جاري تحميل الإعدادات...' : 'Loading configuration...'}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900">{isRTL ? 'إعدادات الـ Dock' : 'Dock Configuration'}</h2>
          <p className="text-sm text-gray-500 mt-1">
            {isRTL ? `${modules.length} موديول - إدارة القوائم للموبايل والديسكتوب` : `${modules.length} modules - Manage menus for mobile & desktop`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={exportConfig} className="gap-1.5">
            <Download className="h-3.5 w-3.5" />
            {isRTL ? 'تصدير' : 'Export'}
          </Button>
          <Button variant="outline" size="sm" onClick={importConfig} className="gap-1.5">
            <Upload className="h-3.5 w-3.5" />
            {isRTL ? 'استيراد' : 'Import'}
          </Button>
          <Button variant="outline" size="sm" onClick={resetConfig} className="gap-1.5 text-red-600 hover:text-red-700 hover:bg-red-50">
            <RotateCcw className="h-3.5 w-3.5" />
            {isRTL ? 'إعادة تعيين' : 'Reset'}
          </Button>
        </div>
      </div>

      {/* Unsaved changes banner */}
      {hasChanges && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2 text-amber-700">
            <AlertCircle className="h-4 w-4" />
            <span className="text-sm font-medium">{isRTL ? 'يوجد تغييرات غير محفوظة' : 'You have unsaved changes'}</span>
          </div>
          <Button size="sm" onClick={saveConfig} disabled={saving} className="gap-1.5 bg-amber-600 hover:bg-amber-700">
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
            {isRTL ? 'حفظ الكل' : 'Save All'}
          </Button>
        </div>
      )}

      {/* Add Module + Expand/Collapse */}
      <div className="flex items-center justify-between">
        <Button onClick={openAddModule} className="gap-1.5 bg-indigo-600 hover:bg-indigo-700">
          <Plus className="h-4 w-4" />
          {isRTL ? 'موديول جديد' : 'New Module'}
        </Button>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={() => setExpandedModules(new Set(modules.map((_, i) => i)))}>
            {isRTL ? 'فتح الكل' : 'Expand All'}
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setExpandedModules(new Set())}>
            {isRTL ? 'إغلاق الكل' : 'Collapse All'}
          </Button>
        </div>
      </div>

      {/* Modules List */}
      {modules.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl border border-gray-200">
          <LayoutGrid className="h-12 w-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 font-medium">{isRTL ? 'لا يوجد موديولات' : 'No modules configured'}</p>
          <Button onClick={openAddModule} variant="outline" className="mt-4 gap-1.5">
            <Plus className="h-4 w-4" />
            {isRTL ? 'إضافة أول موديول' : 'Add First Module'}
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {modules.map((module, idx) => (
            <div
              key={idx}
              className={cn(
                'bg-white rounded-xl border transition-all',
                !module.is_enabled ? 'border-gray-200 opacity-60' : 'border-gray-200 hover:border-gray-300'
              )}
            >
              {/* Module Header */}
              <div className="flex items-center gap-3 px-4 py-3">
                <GripVertical className="h-4 w-4 text-gray-300 cursor-grab" />
                <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: module.icon_color || MODULE_COLORS[module.module_id] || '#6366f1' }} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-semibold text-gray-900 truncate">{module.label}</h3>
                    <span className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded font-mono">{module.module_id}</span>
                    {!module.is_enabled && (
                      <span className="text-[10px] bg-red-100 text-red-600 px-1.5 py-0.5 rounded font-medium">{isRTL ? 'معطل' : 'Disabled'}</span>
                    )}
                  </div>
                  <p className="text-xs text-gray-400">{module.menu_items?.length || 0} {isRTL ? 'عنصر' : 'items'}</p>
                </div>

                {/* Visibility badges */}
                <div className="flex items-center gap-1.5">
                  <span className={cn('flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded', module.show_in_mobile ? 'bg-green-50 text-green-600' : 'bg-gray-100 text-gray-400')}>
                    <Smartphone className="h-3 w-3" />
                  </span>
                  <span className={cn('flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded', module.show_in_desktop ? 'bg-green-50 text-green-600' : 'bg-gray-100 text-gray-400')}>
                    <Monitor className="h-3 w-3" />
                  </span>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1">
                  <button onClick={() => toggleModuleExpand(idx)} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
                    {expandedModules.has(idx) ? <ChevronUp className="h-4 w-4 text-gray-400" /> : <ChevronDown className="h-4 w-4 text-gray-400" />}
                  </button>
                  <button onClick={() => openEditModule(idx)} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
                    <Pencil className="h-3.5 w-3.5 text-gray-400" />
                  </button>
                  <button onClick={() => duplicateModule(idx)} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
                    <Copy className="h-3.5 w-3.5 text-gray-400" />
                  </button>
                  <button onClick={() => deleteModule(idx)} className="p-1.5 rounded-lg hover:bg-red-50 transition-colors">
                    <Trash2 className="h-3.5 w-3.5 text-red-400" />
                  </button>
                </div>
              </div>

              {/* Expanded: Menu Items */}
              {expandedModules.has(idx) && (
                <div className="border-t border-gray-100 px-4 py-3 bg-gray-50/50">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      {isRTL ? 'عناصر القائمة' : 'Menu Items'} ({module.menu_items?.length || 0})
                    </h4>
                    <Button size="sm" variant="outline" onClick={() => openAddItem(idx)} className="gap-1 h-7 text-xs">
                      <Plus className="h-3 w-3" />
                      {isRTL ? 'إضافة عنصر' : 'Add Item'}
                    </Button>
                  </div>

                  {(!module.menu_items || module.menu_items.length === 0) ? (
                    <p className="text-xs text-gray-400 text-center py-4">{isRTL ? 'لا يوجد عناصر' : 'No menu items'}</p>
                  ) : (
                    <div className="space-y-1.5">
                      {module.menu_items.map((item, itemIdx) => (
                        <div key={itemIdx} className="flex items-center gap-3 bg-white rounded-lg px-3 py-2 border border-gray-100">
                          <GripVertical className="h-3.5 w-3.5 text-gray-300 cursor-grab" />
                          <div className="flex-1 min-w-0">
                            <span className="text-sm font-medium text-gray-800">{item.label}</span>
                            <span className="text-xs text-gray-400 block truncate font-mono">{item.route}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <span className={cn('text-[10px] px-1 py-0.5 rounded', item.show_in_mobile ? 'text-green-600' : 'text-gray-300')}>
                              <Smartphone className="h-3 w-3" />
                            </span>
                            <span className={cn('text-[10px] px-1 py-0.5 rounded', item.show_in_desktop ? 'text-green-600' : 'text-gray-300')}>
                              <Monitor className="h-3 w-3" />
                            </span>
                            {!item.is_enabled && <span className="text-[10px] text-red-400 font-medium">{isRTL ? 'معطل' : 'Off'}</span>}
                          </div>
                          <div className="flex items-center gap-0.5">
                            <button onClick={() => openEditItem(idx, itemIdx)} className="p-1 rounded hover:bg-gray-100">
                              <Pencil className="h-3 w-3 text-gray-400" />
                            </button>
                            <button onClick={() => deleteItem(idx, itemIdx)} className="p-1 rounded hover:bg-red-50">
                              <Trash2 className="h-3 w-3 text-red-400" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Save Button (bottom) */}
      {hasChanges && (
        <div className="sticky bottom-4">
          <Button onClick={saveConfig} disabled={saving} className="w-full gap-2 bg-indigo-600 hover:bg-indigo-700 h-11">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {isRTL ? 'حفظ جميع التغييرات' : 'Save All Changes'}
          </Button>
        </div>
      )}

      {/* Module Dialog */}
      <Dialog open={showModuleDialog} onOpenChange={setShowModuleDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingModuleIdx !== null
                ? (isRTL ? `تعديل: ${modules[editingModuleIdx]?.label}` : `Edit: ${modules[editingModuleIdx]?.label}`)
                : (isRTL ? 'موديول جديد' : 'New Module')
              }
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">{isRTL ? 'معرف الموديول' : 'Module ID'}</label>
              <select
                value={moduleForm.module_id}
                onChange={(e) => {
                  const id = e.target.value
                  setModuleForm({ ...moduleForm, module_id: id, icon_color: MODULE_COLORS[id] || '#6366f1' })
                }}
                disabled={editingModuleIdx !== null}
                className="w-full border rounded-lg px-3 py-2 text-sm bg-white disabled:bg-gray-100"
              >
                {MODULE_OPTIONS.map(opt => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">{isRTL ? 'الاسم' : 'Display Name'}</label>
              <input
                type="text"
                value={moduleForm.label}
                onChange={(e) => setModuleForm({ ...moduleForm, label: e.target.value })}
                className="w-full border rounded-lg px-3 py-2 text-sm"
                placeholder={isRTL ? 'مثال: الموارد البشرية' : 'e.g. Human Resources'}
              />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">{isRTL ? 'اللون' : 'Color'}</label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={moduleForm.icon_color}
                  onChange={(e) => setModuleForm({ ...moduleForm, icon_color: e.target.value })}
                  className="w-10 h-10 rounded-lg border cursor-pointer"
                />
                <span className="text-xs text-gray-400 font-mono">{moduleForm.icon_color}</span>
              </div>
            </div>
            <div className="flex items-center gap-6">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={moduleForm.is_enabled} onChange={(e) => setModuleForm({ ...moduleForm, is_enabled: e.target.checked })} className="rounded" />
                <span className="text-sm">{isRTL ? 'مفعّل' : 'Enabled'}</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={moduleForm.show_in_mobile} onChange={(e) => setModuleForm({ ...moduleForm, show_in_mobile: e.target.checked })} className="rounded" />
                <span className="text-sm flex items-center gap-1"><Smartphone className="h-3.5 w-3.5" /> {isRTL ? 'موبايل' : 'Mobile'}</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={moduleForm.show_in_desktop} onChange={(e) => setModuleForm({ ...moduleForm, show_in_desktop: e.target.checked })} className="rounded" />
                <span className="text-sm flex items-center gap-1"><Monitor className="h-3.5 w-3.5" /> {isRTL ? 'ديسكتوب' : 'Desktop'}</span>
              </label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowModuleDialog(false)}>{isRTL ? 'إلغاء' : 'Cancel'}</Button>
            <Button onClick={saveModule} className="bg-indigo-600 hover:bg-indigo-700">
              {editingModuleIdx !== null ? (isRTL ? 'تحديث' : 'Update') : (isRTL ? 'إضافة' : 'Add')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Menu Item Dialog */}
      <Dialog open={showItemDialog} onOpenChange={setShowItemDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingItemIdx !== null
                ? (isRTL ? 'تعديل عنصر القائمة' : 'Edit Menu Item')
                : (isRTL ? 'إضافة عنصر قائمة' : 'Add Menu Item')
              }
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">{isRTL ? 'الاسم' : 'Label'}</label>
              <input
                type="text"
                value={itemForm.label}
                onChange={(e) => setItemForm({ ...itemForm, label: e.target.value })}
                className="w-full border rounded-lg px-3 py-2 text-sm"
                placeholder={isRTL ? 'مثال: لوحة التحكم' : 'e.g. Dashboard'}
              />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">{isRTL ? 'المسار (Route)' : 'Route'}</label>
              <input
                type="text"
                value={itemForm.route}
                onChange={(e) => setItemForm({ ...itemForm, route: e.target.value })}
                className="w-full border rounded-lg px-3 py-2 text-sm font-mono"
                placeholder="e.g. List/Employee/view/cards"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">{isRTL ? 'الأيقونة' : 'Icon'}</label>
                <select
                  value={itemForm.icon_name}
                  onChange={(e) => setItemForm({ ...itemForm, icon_name: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2 text-sm bg-white"
                >
                  {ICON_OPTIONS.map(icon => (
                    <option key={icon} value={icon}>{icon}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">{isRTL ? 'لون الأيقونة' : 'Icon Color'}</label>
                <select
                  value={itemForm.icon_color}
                  onChange={(e) => setItemForm({ ...itemForm, icon_color: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2 text-sm bg-white"
                >
                  {COLOR_OPTIONS.map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex items-center gap-6">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={itemForm.is_enabled} onChange={(e) => setItemForm({ ...itemForm, is_enabled: e.target.checked })} className="rounded" />
                <span className="text-sm">{isRTL ? 'مفعّل' : 'Enabled'}</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={itemForm.show_in_mobile} onChange={(e) => setItemForm({ ...itemForm, show_in_mobile: e.target.checked })} className="rounded" />
                <span className="text-sm flex items-center gap-1"><Smartphone className="h-3.5 w-3.5" /> {isRTL ? 'موبايل' : 'Mobile'}</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={itemForm.show_in_desktop} onChange={(e) => setItemForm({ ...itemForm, show_in_desktop: e.target.checked })} className="rounded" />
                <span className="text-sm flex items-center gap-1"><Monitor className="h-3.5 w-3.5" /> {isRTL ? 'ديسكتوب' : 'Desktop'}</span>
              </label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowItemDialog(false)}>{isRTL ? 'إلغاء' : 'Cancel'}</Button>
            <Button onClick={saveItem} className="bg-indigo-600 hover:bg-indigo-700">
              {editingItemIdx !== null ? (isRTL ? 'تحديث' : 'Update') : (isRTL ? 'إضافة' : 'Add')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!pendingAction}
        onOpenChange={(open) => !open && setPendingAction(null)}
        title={pendingAction?.title ?? ''}
        description={pendingAction?.description}
        onConfirm={() => { pendingAction?.onConfirm(); setPendingAction(null) }}
      />
    </div>
  )
}

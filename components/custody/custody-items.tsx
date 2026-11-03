'use client'

import React, { useState, useEffect, useCallback } from 'react'
import {
  Smartphone, CreditCard, Monitor, Tablet, ShoppingBag, Key,
  Truck, Wrench, Package, Loader2,
  Image, FileText, Grid3X3, PlayCircle, Volume2, Video, Paperclip,
  ChevronDown, ChevronUp,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { frappeClient } from '@/lib/api-client'
import { frappeImageUrl } from '@/lib/utils'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CustodyAttachment {
  name: string
  file: string
  file_name: string
  file_type: string
  description: string
}

interface CustodyItem {
  name: string
  employee: string
  employee_name: string
  branch: string
  item_category: string
  item_name: string
  serial_no: string
  description: string
  item_image: string
  status: string
  assigned_date: string
  return_date: string
  assigned_by: string
  notes: string
  attachments: CustodyAttachment[]
}

interface CustodyItemsProps {
  employeeId: string
  isRTL?: boolean
}

// ---------------------------------------------------------------------------
// Lookup maps
// ---------------------------------------------------------------------------

const CATEGORY_META: Record<string, { icon: React.ElementType; color: string }> = {
  'Phone':    { icon: Smartphone,  color: 'bg-blue-100 text-blue-700' },
  'SIM Card': { icon: CreditCard,  color: 'bg-purple-100 text-purple-700' },
  'Laptop':   { icon: Monitor,     color: 'bg-indigo-100 text-indigo-700' },
  'Tablet':   { icon: Tablet,      color: 'bg-cyan-100 text-cyan-700' },
  'Uniform':  { icon: ShoppingBag, color: 'bg-amber-100 text-amber-700' },
  'Keys':     { icon: Key,         color: 'bg-yellow-100 text-yellow-700' },
  'Vehicle':  { icon: Truck,       color: 'bg-emerald-100 text-emerald-700' },
  'Tools':    { icon: Wrench,      color: 'bg-orange-100 text-orange-700' },
}

const STATUS_STYLES: Record<string, string> = {
  'Pending Acknowledgement': 'bg-amber-100 text-amber-800',
  'Active':                  'bg-green-100 text-green-800',
  'Returned':                'bg-slate-100 text-slate-600',
  'Damaged':                 'bg-red-100 text-red-800',
  'Lost':                    'bg-red-200 text-red-900',
}

const STATUS_AR: Record<string, string> = {
  'Pending Acknowledgement': 'بانتظار الاستلام',
  'Active':                  'فعّال',
  'Returned':                'مُسترجع',
  'Damaged':                 'تالف',
  'Lost':                    'مفقود',
}

const CATEGORY_AR: Record<string, string> = {
  'Phone': 'هاتف', 'SIM Card': 'شريحة', 'Laptop': 'لابتوب',
  'Tablet': 'تابلت', 'Uniform': 'زي رسمي', 'Keys': 'مفاتيح',
  'Vehicle': 'مركبة', 'Tools': 'أدوات', 'Other': 'أخرى',
}

const FILE_TYPE_ICONS: Record<string, React.ElementType> = {
  'Image':      Image,
  'PDF':        FileText,
  'Word':       FileText,
  'Excel':      Grid3X3,
  'PowerPoint': PlayCircle,
  'Audio':      Volume2,
  'Video':      Video,
}

function getCategoryMeta(cat: string) {
  return CATEGORY_META[cat] ?? { icon: Package, color: 'bg-gray-100 text-gray-700' }
}

function getFileIcon(fileType: string): React.ElementType {
  return FILE_TYPE_ICONS[fileType] ?? Paperclip
}

function getFileViewUrl(fileUrl: string): string {
  if (!fileUrl) return ''
  if (fileUrl.startsWith('http')) return fileUrl
  return frappeImageUrl(fileUrl) || fileUrl
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function CustodyItems({ employeeId, isRTL = false }: CustodyItemsProps) {
  const [items, setItems] = useState<CustodyItem[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedItem, setExpandedItem] = useState<string | null>(null)

  const loadItems = useCallback(async () => {
    if (!employeeId) return
    setLoading(true)
    try {
      const res = await frappeClient.call<CustodyItem[]>(
        'base_meena.employee_custody_api.get_custody_items',
        { employee: employeeId }
      )
      // `|| []` only catches null/undefined. Anything else truthy and non-array
      // (an error payload, a dict) reaches .length/.map below and takes the whole
      // employee profile page down to a blank screen.
      setItems(Array.isArray(res?.message) ? res.message : [])
    } catch (err) {
      console.error('Failed to load custody items:', err)
    } finally {
      setLoading(false)
    }
  }, [employeeId])

  useEffect(() => { loadItems() }, [loadItems])

  const toggle = (name: string) =>
    setExpandedItem(prev => (prev === name ? null : name))

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8" dir={isRTL ? 'rtl' : 'ltr'}>
        <Loader2 className="w-5 h-5 animate-spin text-blue-600" />
        <span className="ms-2 text-sm text-gray-500">
          {isRTL ? 'جاري التحميل...' : 'Loading custody items...'}
        </span>
      </div>
    )
  }

  return (
    <div className="space-y-3" dir={isRTL ? 'rtl' : 'ltr'}>
      {/* Header */}
      <div className="flex items-center gap-2">
        <Package className="w-5 h-5 text-blue-600" />
        <h3 className="font-semibold text-base">
          {isRTL ? 'العهد' : 'Custody Items'}
        </h3>
        {items.length > 0 && (
          <Badge variant="secondary" className="text-xs">{items.length}</Badge>
        )}
      </div>

      {/* Empty state */}
      {items.length === 0 ? (
        <div className="text-center py-8 bg-gray-50 rounded-xl">
          <Package className="w-10 h-10 mx-auto text-gray-300 mb-2" />
          <p className="text-sm text-gray-500">
            {isRTL ? 'لا توجد عهد مسجلة' : 'No custody items assigned'}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {items.map(item => {
            const meta = getCategoryMeta(item.item_category)
            const Icon = meta.icon
            const isExpanded = expandedItem === item.name
            const imageUrl = item.item_image ? getFileViewUrl(item.item_image) : null

            return (
              <div
                key={item.name}
                className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden"
              >
                {/* Main row */}
                <button
                  onClick={() => toggle(item.name)}
                  className="w-full flex items-center gap-3 p-3 text-start"
                >
                  {/* Image or category icon */}
                  {imageUrl ? (
                    <div className="w-12 h-12 rounded-lg overflow-hidden bg-slate-100 shrink-0">
                      <img
                        src={imageUrl}
                        alt={item.item_name}
                        className="w-full h-full object-cover"
                        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
                      />
                    </div>
                  ) : (
                    <div className={`w-12 h-12 rounded-lg flex items-center justify-center shrink-0 ${meta.color}`}>
                      <Icon className="w-5 h-5" />
                    </div>
                  )}

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-gray-900 truncate">
                      {item.item_name}
                    </div>
                    <div className="text-xs text-gray-500">
                      {isRTL ? CATEGORY_AR[item.item_category] || item.item_category : item.item_category}
                      {item.serial_no && ` · ${item.serial_no}`}
                    </div>
                    {item.branch && (
                      <div className="text-xs text-gray-400">{item.branch}</div>
                    )}
                  </div>

                  {/* Status + expand icon */}
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${STATUS_STYLES[item.status] ?? 'bg-gray-100 text-gray-700'}`}>
                      {isRTL ? STATUS_AR[item.status] || item.status : item.status}
                    </span>
                    <div className="flex items-center gap-1 text-slate-400">
                      {item.attachments?.length > 0 && (
                        <span className="text-[10px]">
                          {item.attachments.length} {isRTL ? 'ملف' : 'files'}
                        </span>
                      )}
                      {isExpanded
                        ? <ChevronUp className="w-3.5 h-3.5" />
                        : <ChevronDown className="w-3.5 h-3.5" />
                      }
                    </div>
                  </div>
                </button>

                {/* Expanded: attachment list */}
                {isExpanded && (
                  <div className="border-t border-slate-100 px-3 pb-3 pt-2">
                    {(!item.attachments || item.attachments.length === 0) ? (
                      <p className="text-xs text-gray-400 text-center py-2">
                        {isRTL ? 'لا توجد مرفقات' : 'No attachments'}
                      </p>
                    ) : (
                      item.attachments.map(att => {
                        const FileIcon = getFileIcon(att.file_type)
                        const viewUrl = getFileViewUrl(att.file)
                        return (
                          <div
                            key={att.name}
                            className="flex items-center gap-2 py-1.5 border-b border-slate-50 last:border-b-0"
                          >
                            <FileIcon className="w-4 h-4 text-slate-400 shrink-0" />
                            <span className="text-xs text-slate-600 flex-1 truncate">
                              {att.file_name || att.file}
                            </span>
                            <a
                              href={viewUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-blue-600 shrink-0 font-medium"
                            >
                              {isRTL ? 'عرض' : 'View'}
                            </a>
                          </div>
                        )
                      })
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

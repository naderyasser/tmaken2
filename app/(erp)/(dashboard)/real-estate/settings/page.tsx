'use client'

export const dynamic = 'force-dynamic'

import { useState } from 'react'
import { useAuth } from '@/lib/auth-context'
import { useI18n } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { Lock, Eye, FolderTree, Users, Building2, Boxes, Flag } from 'lucide-react'
import { CategoriesTab } from '@/components/real-estate/settings/categories-tab'
import { AdvertisersTab } from '@/components/real-estate/settings/advertisers-tab'
import { ListingsTab } from '@/components/real-estate/settings/listings-tab'
import { MastersTab } from '@/components/real-estate/settings/masters-tab'
import { FlagsTab } from '@/components/real-estate/settings/flags-tab'

const MANAGER_ROLES = ['Real Estate Manager', 'Administrator', 'System Manager']

export default function RealEstateSettings() {
  const { user } = useAuth()
  const { isRTL } = useI18n()
  const roles = user?.roles || []
  const canEdit = roles.some((r) => MANAGER_ROLES.includes(r))
  const isModerator = roles.includes('Real Estate Moderator')
  const hasAccess = canEdit || isModerator

  const TABS = [
    { id: 'categories', labelAr: 'الأقسام', labelEn: 'Categories', icon: FolderTree },
    { id: 'advertisers', labelAr: 'المعلنون والمستخدمون', labelEn: 'Advertisers & Users', icon: Users },
    { id: 'listings', labelAr: 'صلاحيات الإعلانات', labelEn: 'Listing Overrides', icon: Building2 },
    { id: 'masters', labelAr: 'البيانات الأساسية', labelEn: 'Masters', icon: Boxes },
    { id: 'flags', labelAr: 'إعدادات الوحدة', labelEn: 'Module Flags', icon: Flag },
  ]
  const [tab, setTab] = useState('categories')

  if (!hasAccess) {
    return (
      <div className="mx-auto mt-16 max-w-md rounded-2xl border-2 border-gray-100 p-8 text-center">
        <Lock className="mx-auto mb-3 h-8 w-8 text-gray-400" />
        <p className="text-gray-600">
          {isRTL ? 'هذه الصفحة مخصّصة لمدير المتجر' : 'This page is for marketplace managers only'}
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-5 py-1">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">{isRTL ? 'مركز التحكم' : 'Command Center'}</h1>
          <p className="text-sm text-gray-500">
            {isRTL ? 'إدارة المتجر بالكامل من مكان واحد' : 'Run the whole marketplace from one place'}
          </p>
        </div>
        {!canEdit && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1 text-xs font-medium text-amber-700">
            <Eye className="h-3.5 w-3.5" />
            {isRTL ? 'عرض فقط (مشرف)' : 'Read-only (Moderator)'}
          </span>
        )}
      </div>

      {/* Tab strip */}
      <div className="flex gap-1 overflow-x-auto border-b border-gray-100">
        {TABS.map((tb) => {
          const Icon = tb.icon
          const active = tab === tb.id
          return (
            <button
              key={tb.id}
              onClick={() => setTab(tb.id)}
              className={cn(
                'flex items-center gap-2 whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-medium transition-colors',
                active
                  ? 'border-emerald-700 text-emerald-800'
                  : 'border-transparent text-gray-500 hover:text-gray-800',
              )}
            >
              <Icon className="h-4 w-4" />
              {isRTL ? tb.labelAr : tb.labelEn}
            </button>
          )
        })}
      </div>

      <div>
        {tab === 'categories' && <CategoriesTab canEdit={canEdit} />}
        {tab === 'advertisers' && <AdvertisersTab canEdit={canEdit} />}
        {tab === 'listings' && <ListingsTab canEdit={canEdit} />}
        {tab === 'masters' && <MastersTab canEdit={canEdit} />}
        {tab === 'flags' && <FlagsTab canEdit={canEdit} />}
      </div>
    </div>
  )
}

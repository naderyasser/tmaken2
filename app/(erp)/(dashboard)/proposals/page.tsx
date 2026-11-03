'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Header } from '@/components/header'
import { Sidebar } from '@/components/sidebar'
import { I18nProvider, useI18n } from '@/lib/i18n'
import { useAuth } from '@/lib/auth-context'
import { LoginPage } from '@/components/login-page'
import type { ModuleType } from '@/components/sidebar'
import { ProposalList } from '@/components/proposal/proposal-list'
import { ShieldAlert } from 'lucide-react'

function ProposalsPageInner() {
  const [activeModule] = useState<ModuleType>('proposals')
  const [sidebarExpanded, setSidebarExpanded] = useState(true)
  const router = useRouter()
  const { isAuthenticated, isLoading, isHRUser } = useAuth()
  const { isRTL } = useI18n()

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="w-8 h-8 border-[3px] border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!isAuthenticated) return <LoginPage />

  if (!isHRUser) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center p-8">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <ShieldAlert className="h-8 w-8 text-red-500" />
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">{isRTL ? 'غير مصرح' : 'Unauthorized'}</h2>
          <p className="text-gray-500 mb-4">{isRTL ? 'ليس لديك صلاحية الوصول' : 'Access required'}</p>
          <button onClick={() => router.push('/')} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700">
            {isRTL ? 'العودة للرئيسية' : 'Back to Home'}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-screen">
      <Header onToggleSidebar={() => setSidebarExpanded(!sidebarExpanded)} sidebarExpanded={sidebarExpanded} />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar
          activeModule={activeModule}
          onModuleChange={(module) => router.push(`/hr?module=${module}`)}
          isExpanded={sidebarExpanded}
          onToggle={() => setSidebarExpanded(!sidebarExpanded)}
        />
        <main className="flex-1 overflow-y-auto p-8 bg-gray-50">
          <div className="max-w-7xl mx-auto">
            <ProposalList />
          </div>
        </main>
      </div>
    </div>
  )
}

export default function ProposalsPage() {
  return (
    <I18nProvider>
      <ProposalsPageInner />
    </I18nProvider>
  )
}

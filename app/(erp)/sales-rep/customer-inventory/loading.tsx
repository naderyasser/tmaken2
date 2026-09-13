"use client"

import { useI18n } from "@/lib/i18n"

export default function Loading() {
  const { t, dir } = useI18n()
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center" dir={dir}>
      <div className="text-center">
        <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
        <p className="text-gray-600">{t('sr.common.loading')}</p>
      </div>
    </div>
  )
}

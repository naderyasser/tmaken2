"use client"

import { useI18n } from "@/lib/i18n"

export default function Loading() {
  const { t, dir } = useI18n()
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50" dir={dir}>
      <div className="flex flex-col items-center gap-4">
        <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-gray-600 text-lg">{t('sr.common.loading')}</p>
      </div>
    </div>
  )
}

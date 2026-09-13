'use client'

// Shared pager bar for the accounting list pages (server-side pagination).
// Text prev/next buttons instead of arrow icons — RTL flips arrow meaning.

import { Button } from '@/components/ui/button'
import { useI18n } from '@/lib/i18n'

export function ListPager({ page, pageSize, total, loading, onPage }: {
    page: number
    pageSize: number
    total: number
    loading?: boolean
    onPage: (page: number) => void
}) {
    const { lang } = useI18n()
    const ar = lang === 'ar'
    const pageCount = Math.max(1, Math.ceil(total / pageSize))
    const from = total === 0 ? 0 : (page - 1) * pageSize + 1
    const to = Math.min(page * pageSize, total)

    return (
        <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 border-t border-gray-100 bg-gray-50">
            <span className="text-xs text-gray-500">
                {ar ? `عرض ${from}–${to} من إجمالي ${total.toLocaleString('en-US')}` : `Showing ${from}–${to} of ${total.toLocaleString('en-US')}`}
            </span>
            {pageCount > 1 && (
                <div className="flex items-center gap-2">
                    <Button
                        variant="outline" size="sm" className="h-7 px-3 text-xs"
                        disabled={loading || page <= 1}
                        onClick={() => onPage(page - 1)}
                    >
                        {ar ? 'السابق' : 'Previous'}
                    </Button>
                    <span className="text-xs text-gray-600 tabular-nums">
                        {ar ? `صفحة ${page} من ${pageCount}` : `Page ${page} of ${pageCount}`}
                    </span>
                    <Button
                        variant="outline" size="sm" className="h-7 px-3 text-xs"
                        disabled={loading || page >= pageCount}
                        onClick={() => onPage(page + 1)}
                    >
                        {ar ? 'التالي' : 'Next'}
                    </Button>
                </div>
            )}
        </div>
    )
}

"use client"

import { useEffect, useState, useRef } from "react"
import {
    FileText, Loader2, Printer, ShoppingBag, Receipt,
    ArrowDownCircle, ArrowUpCircle, Wallet, RotateCcw,
} from "lucide-react"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { getRollWidth, printHtml } from "@/lib/cashier/print"
import { getBrandSync } from "@/hooks/use-brand"
import { letterheadCss, letterheadHtml } from "@/lib/print-letterhead"
import { cashierApi, type CashMovement, type DailySummary, type CashierSession } from "@/lib/cashier-api"
import { useCashier } from "@/contexts/CashierContext"
import { fmtCurrency } from "@/lib/cashier-utils"
import { useI18n } from "@/lib/i18n"

interface XReportDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
}

export function XReportDialog({ open, onOpenChange }: XReportDialogProps) {
    const { session } = useCashier()
    const { lang } = useI18n()
    const printRef = useRef<HTMLDivElement>(null)

    const [loading, setLoading] = useState(true)
    const [summary, setSummary] = useState<DailySummary | null>(null)
    const [movements, setMovements] = useState<CashMovement[]>([])
    const [totalCashIn, setTotalCashIn] = useState(0)
    const [totalCashOut, setTotalCashOut] = useState(0)

    useEffect(() => {
        if (!open || !session?.name) return
        setLoading(true)
        cashierApi.getXReport(session.name)
            .then(res => {
                setSummary(res.summary)
                setMovements(res.cash_movements || [])
                setTotalCashIn(res.total_cash_in ?? 0)
                setTotalCashOut(res.total_cash_out ?? 0)
            })
            .catch(() => {
                // Fallback: load summary + movements separately
                Promise.all([
                    cashierApi.getSummary({ session: session.name }),
                    cashierApi.getSessionCashMovements(session.name).catch(() => ({ movements: [] })),
                ]).then(([sum, mov]) => {
                    setSummary(sum)
                    setMovements(mov.movements || [])
                    setTotalCashIn(mov.movements?.filter(m => m.type === "in").reduce((s, m) => s + m.amount, 0) ?? 0)
                    setTotalCashOut(mov.movements?.filter(m => m.type === "out").reduce((s, m) => s + m.amount, 0) ?? 0)
                })
            })
            .finally(() => setLoading(false))
    }, [open, session?.name])

    // Same iframe pipeline as receipts (popup windows get blocked + ignored roll
    // sizing); @page enforces the thermal width / portrait.
    const handlePrint = () => {
        if (!printRef.current) return
        const content = printRef.current.innerHTML
        const mm = getRollWidth() === "58" ? 58 : 80
        void printHtml(`
      <!doctype html><html dir="rtl" lang="ar">
      <head><meta charset="utf-8"><title>X-Report</title>
      <style>
        @page { size: ${mm}mm auto; margin: 2mm; }
        body { width: ${mm - 4}mm; margin: 0; font-family: Tahoma, 'Segoe UI', Arial, sans-serif; font-size: ${mm === 58 ? "9.5px" : "11px"}; }
        table { width: 100%; border-collapse: collapse; margin: 6px 0; }
        td, th { padding: 2px 3px; border-bottom: 1px dashed #000; text-align: right; }
        .header { text-align: center; margin-bottom: 8px; }
        .total { font-weight: bold; font-size: 1.2em; }
        button { display: none; }
        ${letterheadCss({ layout: "receipt" })}
      </style></head>
      <body>${letterheadHtml(getBrandSync())}${content}</body></html>
    `)
    }

    const openingCash = Number(session?.opening_cash ?? 0)
    const netMovements = totalCashIn - totalCashOut

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto [font-family:var(--font-arabic)]" dir="rtl">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-lg">
                        <FileText className="h-5 w-5 text-sky-600" />
                        {lang === "ar" ? "تقرير X (منتصف الوردية)" : "X-Report (Mid-Shift)"}
                    </DialogTitle>
                </DialogHeader>

                {loading ? (
                    <div className="flex items-center justify-center py-12">
                        <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
                    </div>
                ) : (
                    <>
                        <div ref={printRef} className="space-y-4">
                            <div className="header text-center">
                                <p className="text-xs text-slate-500">{lang === "ar" ? "جلسة" : "Session"}: {session?.name}</p>
                                <p className="text-xs text-slate-400">{new Date().toLocaleString(lang === "ar" ? "ar-SA" : "en-US")}</p>
                            </div>

                            {/* KPI grid */}
                            <div className="grid grid-cols-2 gap-3">
                                <MiniKPI
                                    icon={<Wallet className="h-4 w-4 text-emerald-600" />}
                                    label={lang === "ar" ? "رصيد الافتتاح" : "Opening Cash"}
                                    value={fmtCurrency(openingCash)}
                                />
                                <MiniKPI
                                    icon={<ShoppingBag className="h-4 w-4 text-sky-600" />}
                                    label={lang === "ar" ? "إجمالي المبيعات" : "Total Sales"}
                                    value={fmtCurrency(summary?.total_sales ?? 0)}
                                />
                                <MiniKPI
                                    icon={<RotateCcw className="h-4 w-4 text-amber-600" />}
                                    label={lang === "ar" ? "المرتجعات" : "Returns"}
                                    value={fmtCurrency(summary?.total_returns ?? 0)}
                                />
                                <MiniKPI
                                    icon={<Receipt className="h-4 w-4 text-violet-600" />}
                                    label={lang === "ar" ? "صافي المبيعات" : "Net Sales"}
                                    value={fmtCurrency(summary?.net_sales ?? 0)}
                                />
                            </div>

                            {/* Invoice count */}
                            <div className="bg-slate-50 rounded-xl px-4 py-3 flex items-center justify-between">
                                <span className="text-sm text-slate-600">{lang === "ar" ? "عدد الفواتير" : "Invoices"}</span>
                                <span className="text-lg font-black text-slate-800">{summary?.invoice_count ?? 0}</span>
                            </div>

                            {/* Cash movements summary */}
                            {movements.length > 0 && (
                                <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                                    <div className="px-4 py-2 bg-slate-50 border-b border-slate-200">
                                        <span className="text-xs font-bold text-slate-500">{lang === "ar" ? "حركات نقدية" : "Cash Movements"}</span>
                                    </div>
                                    <div className="px-4 py-2 flex items-center justify-between text-sm">
                                        <span className="text-emerald-600 flex items-center gap-1">
                                            <ArrowDownCircle className="h-3.5 w-3.5" />
                                            {lang === "ar" ? "إدخال" : "In"}: {fmtCurrency(totalCashIn)}
                                        </span>
                                        <span className="text-rose-600 flex items-center gap-1">
                                            <ArrowUpCircle className="h-3.5 w-3.5" />
                                            {lang === "ar" ? "سحب" : "Out"}: {fmtCurrency(totalCashOut)}
                                        </span>
                                    </div>
                                    <div className="px-4 py-2 border-t border-slate-100 flex items-center justify-between">
                                        <span className="text-xs text-slate-500">{lang === "ar" ? "صافي الحركات" : "Net"}</span>
                                        <span className={`text-sm font-bold ${netMovements >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
                                            {netMovements >= 0 ? "+" : ""}{fmtCurrency(Math.abs(netMovements))}
                                        </span>
                                    </div>
                                </div>
                            )}

                            {/* Payment breakdown */}
                            {summary?.payment_breakdown && summary.payment_breakdown.length > 0 && (
                                <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                                    <div className="px-4 py-2 bg-slate-50 border-b border-slate-200">
                                        <span className="text-xs font-bold text-slate-500">{lang === "ar" ? "تفصيل الدفع" : "Payment Breakdown"}</span>
                                    </div>
                                    {summary.payment_breakdown.map(p => (
                                        <div key={p.mode_of_payment} className="px-4 py-2 flex items-center justify-between border-b border-slate-50 last:border-0">
                                            <span className="text-sm text-slate-600">{p.mode_of_payment}</span>
                                            <span className="text-sm font-bold text-slate-800">{fmtCurrency(p.amount)}</span>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* Top items */}
                            {summary?.top_items && summary.top_items.length > 0 && (
                                <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                                    <div className="px-4 py-2 bg-slate-50 border-b border-slate-200">
                                        <span className="text-xs font-bold text-slate-500">{lang === "ar" ? "الأصناف الأكثر مبيعاً" : "Top Items"}</span>
                                    </div>
                                    {summary.top_items.slice(0, 5).map(item => (
                                        <div key={item.item_code} className="px-4 py-2 flex items-center justify-between border-b border-slate-50 last:border-0">
                                            <div className="min-w-0">
                                                <p className="text-sm text-slate-700 truncate">{item.item_name}</p>
                                                <p className="text-[11px] text-slate-400">×{item.qty}</p>
                                            </div>
                                            <span className="text-sm font-bold text-slate-800 shrink-0">{fmtCurrency(item.amount)}</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Print button */}
                        <Button
                            className="w-full h-11 gap-2 bg-sky-600 hover:bg-sky-700 rounded-xl font-bold"
                            onClick={handlePrint}
                        >
                            <Printer className="h-4 w-4" />
                            {lang === "ar" ? "طباعة التقرير" : "Print Report"}
                        </Button>
                    </>
                )}
            </DialogContent>
        </Dialog>
    )
}

function MiniKPI({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
    return (
        <div className="bg-slate-50 rounded-xl p-3">
            <div className="flex items-center gap-1.5 mb-1">
                {icon}
                <span className="text-[11px] text-slate-500">{label}</span>
            </div>
            <p className="text-base font-black text-slate-800">{value}</p>
        </div>
    )
}

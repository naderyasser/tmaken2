"use client"

import { useEffect, useState } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ArrowRight, TrendingUp, TrendingDown, Package, Loader2, RefreshCw, FileText } from "lucide-react"
import Link from "next/link"
import { useSalesRep } from "@/contexts/SalesRepContext"
import { stockApi, type StockLedgerEntry } from "@/lib/stock-api"
import { useI18n } from "@/lib/i18n"
import { displayLocale } from '@/lib/sales-format'

export default function InventoryRecordsPage() {
  const { warehouse } = useSalesRep()
  const { t, lang, dir } = useI18n()
  const dl = displayLocale(lang)
  const [records, setRecords] = useState<StockLedgerEntry[]>([])
  const [loading, setLoading] = useState(true)

  const fetchRecords = async () => {
    if (!warehouse) {
      setLoading(false)
      return
    }

    setLoading(true)
    try {
      const data = await stockApi.getStockLedgerEntries(warehouse, 200)
      setRecords(data)
    } catch (err) {
      console.error("Failed to fetch stock ledger entries:", err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchRecords()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [warehouse])

  const getVoucherLabel = (type: string) => {
    switch (type) {
      case "Stock Entry": return t('sr.invrec.voucher.stock_entry')
      case "Delivery Note": return t('sr.invrec.voucher.delivery_note')
      case "Sales Invoice": return t('sr.invrec.voucher.sales_invoice')
      case "Purchase Receipt": return t('sr.invrec.voucher.purchase_receipt')
      case "Stock Reconciliation": return t('sr.invrec.voucher.stock_reconciliation')
      default: return type
    }
  }

  const getVoucherColor = (type: string) => {
    switch (type) {
      case "Stock Entry": return "bg-blue-100 text-blue-700"
      case "Delivery Note": return "bg-orange-100 text-orange-700"
      case "Sales Invoice": return "bg-green-100 text-green-700"
      case "Purchase Receipt": return "bg-purple-100 text-purple-700"
      default: return "bg-gray-100 text-gray-700"
    }
  }

  const totalIn = records.filter(r => r.actual_qty > 0).reduce((s, r) => s + r.actual_qty, 0)
  const totalOut = records.filter(r => r.actual_qty < 0).reduce((s, r) => s + Math.abs(r.actual_qty), 0)

  return (
    <div className="min-h-screen bg-background pb-24" dir={dir}>
      <div className="bg-primary text-primary-foreground sticky top-0 z-10 shadow-lg">
        <div className="px-4 md:px-6 py-5">
          <div className="flex items-center justify-between">
            <Link href="/sales-rep">
              <Button variant="ghost" size="sm" className="text-primary-foreground hover:bg-primary-foreground/20">
                <ArrowRight className="w-5 h-5" />
              </Button>
            </Link>
            <h1 className="text-xl font-bold">{t('sr.invrec.title')}</h1>
            <Button
              variant="ghost"
              size="sm"
              className="text-primary-foreground hover:bg-primary-foreground/20"
              onClick={fetchRecords}
              disabled={loading}
            >
              <RefreshCw className={`w-5 h-5 ${loading ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </div>
      </div>

      <div className="px-4 md:px-6 py-6">
        {/* Summary Cards */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          <Card className="p-4 text-center">
            <div className="text-2xl font-bold text-primary">{records.length}</div>
            <div className="text-xs text-muted-foreground">{t('sr.invrec.total_movements')}</div>
          </Card>
          <Card className="p-4 text-center">
            <div className="text-2xl font-bold text-green-600">+{totalIn}</div>
            <div className="text-xs text-muted-foreground">{t('sr.invrec.in')}</div>
          </Card>
          <Card className="p-4 text-center">
            <div className="text-2xl font-bold text-red-600">-{totalOut}</div>
            <div className="text-xs text-muted-foreground">{t('sr.invrec.out')}</div>
          </Card>
        </div>

        {warehouse && (
          <div className="mb-4 flex items-center gap-2 text-sm text-muted-foreground">
            <Package className="w-4 h-4" />
            <span>{t('sr.common.warehouse')}: <span className="font-medium text-foreground">{warehouse}</span></span>
          </div>
        )}

        {loading ? (
          <div className="text-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto mb-3" />
            <p className="text-muted-foreground">{t('sr.invrec.loading')}</p>
          </div>
        ) : !warehouse ? (
          <div className="text-center py-12">
            <Package className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">{t('sr.invrec.no_warehouse')}</p>
          </div>
        ) : records.length === 0 ? (
          <div className="text-center py-12">
            <Package className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">{t('sr.invrec.empty')}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {records.map((record) => {
              const isIncoming = record.actual_qty > 0

              return (
                <Card key={record.name} className="p-4">
                  <div className="flex items-start gap-3">
                    <div
                      className={`p-2 rounded-xl flex-shrink-0 ${isIncoming ? "bg-green-100" : "bg-red-100"
                        }`}
                    >
                      {isIncoming ? (
                        <TrendingUp className="w-5 h-5 text-green-600" />
                      ) : (
                        <TrendingDown className="w-5 h-5 text-red-600" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1.5 gap-2">
                        <h4 className="font-bold text-base truncate">{record.item_code}</h4>
                        <span className={`text-lg font-bold ${isIncoming ? "text-green-600" : "text-red-600"}`}>
                          {isIncoming ? "+" : ""}{record.actual_qty}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 flex-wrap mb-1.5">
                        <Badge className={getVoucherColor(record.voucher_type)} variant="secondary">
                          {getVoucherLabel(record.voucher_type)}
                        </Badge>
                        {record.stock_uom && (
                          <span className="text-xs text-muted-foreground">{record.stock_uom}</span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <span>
                          {record.posting_date
                            ? new Date(record.posting_date).toLocaleDateString(dl)
                            : ""}
                        </span>
                        <span className="flex items-center gap-1">
                          <FileText className="w-3 h-3" />
                          {record.voucher_no}
                        </span>
                        <span className="text-muted-foreground/70">
                          {t('sr.invrec.balance').replace('{n}', String(record.qty_after_transaction))}
                        </span>
                      </div>
                    </div>
                  </div>
                </Card>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

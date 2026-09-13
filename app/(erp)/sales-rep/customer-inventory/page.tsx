"use client"

import { useEffect, useState } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ArrowRight, Package, History, Loader2 } from "lucide-react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { salesApi, type Customer, type CustomerInventoryRecord } from "@/lib/sales-api"
import { Suspense } from "react"
import { useI18n } from "@/lib/i18n"
import { displayLocale } from '@/lib/sales-format'

function CustomerInventoryContent() {
  const searchParams = useSearchParams()
  const customerId = searchParams.get("customerId")
  const { t, lang, dir } = useI18n()
  const dl = displayLocale(lang)

  const [customer, setCustomer] = useState<Customer | null>(null)
  const [records, setRecords] = useState<CustomerInventoryRecord[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!customerId) {
      setLoading(false)
      return
    }

    let cancelled = false

    async function loadData() {
      try {
        const [customerData, inventoryRecords] = await Promise.all([
          salesApi.getCustomer(customerId!),
          salesApi.getCustomerInventory({
            filters: [["Customer Inventory Record", "customer", "=", customerId!]],
            limit_page_length: 5, // Fetch only the 5 most recent records
          } as any),
        ])

        if (cancelled) return
        setCustomer(customerData)

        // Fetch full details for each record in parallel (Promise.all replaces sequential for-loop)
        if (inventoryRecords.length > 0) {
          const fullRecords = await Promise.all(
            inventoryRecords.slice(0, 5).map(async (rec: any) => {
              try {
                const full = await salesApi.getCustomerInventoryById(rec.name)
                return full || rec
              } catch {
                return rec
              }
            })
          )
          if (!cancelled) setRecords(fullRecords)
        }
      } catch (err) {
        console.error("Failed to load customer inventory:", err)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    loadData()
    return () => { cancelled = true }
  }, [customerId])

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-10 h-10 animate-spin text-primary mx-auto mb-3" />
          <p className="text-muted-foreground">{t('sr.custinv.loading_inventory')}</p>
        </div>
      </div>
    )
  }

  if (!customer) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Package className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground">{t('sr.custinv.no_customer')}</p>
          <Link href="/sales-rep" className="mt-4 inline-block">
            <Button variant="outline" className="bg-transparent">
              <ArrowRight className="w-4 h-4 ml-2" />
              {t('sr.custinv.back')}
            </Button>
          </Link>
        </div>
      </div>
    )
  }

  // Get items from the latest inventory record
  const latestRecord = records[0]
  const latestItems = latestRecord?.items || []

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
            <h1 className="text-xl font-bold truncate mx-2">{t('sr.custinv.title')}</h1>
            <div className="w-10" />
          </div>
        </div>
      </div>

      <div className="px-4 md:px-6 py-6">
        {/* Customer Info */}
        <Card className="p-5 mb-6 bg-primary/5 border-primary/30">
          <h2 className="text-xl font-bold mb-2">{customer.customer_name}</h2>
          <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
            <div className="flex items-center gap-1">
              <Package className="w-4 h-4" />
              <span>{t('sr.custinv.products_in_stock').replace('{n}', String(latestItems.length))}</span>
            </div>
            <div className="flex items-center gap-1">
              <History className="w-4 h-4" />
              <span>{t('sr.custinv.records_count').replace('{n}', String(records.length))}</span>
            </div>
            {customer.territory && (
              <Badge variant="secondary">{customer.territory}</Badge>
            )}
          </div>
        </Card>

        {/* Current Inventory */}
        {latestItems.length > 0 ? (
          <>
            <h3 className="font-bold text-lg mb-4">{t('sr.custinv.current_inventory')}</h3>
            <div className="space-y-3">
              {latestItems.map((item) => (
                <Card key={item.item_code} className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="min-w-0 flex-1">
                      <h4 className="font-bold text-base mb-1 truncate">{item.item_name || item.item_code}</h4>
                      <p className="text-sm text-muted-foreground">{item.item_code}</p>
                    </div>
                    <div className="text-right flex-shrink-0 mr-3">
                      <div className="text-2xl font-bold text-primary">{item.current_stock ?? 0}</div>
                      <div className="text-xs text-muted-foreground">{t('sr.custinv.unit')}</div>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </>
        ) : (
          <Card className="p-8 text-center">
            <Package className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground">{t('sr.custinv.empty')}</p>
          </Card>
        )}

        {/* Inventory History */}
        {records.length > 1 && (
          <>
            <h3 className="font-bold text-lg mb-4 mt-8">{t('sr.custinv.history_title')}</h3>
            <div className="space-y-3">
              {records.slice(1).map((record) => (
                <Card key={record.name} className="p-4 bg-muted/50">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-bold text-sm">{record.name}</h4>
                    <Badge variant="outline" className="text-xs">
                      {record.visit_date
                        ? new Date(record.visit_date).toLocaleDateString(dl)
                        : t('sr.custinv.no_date')}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">
                      {t('sr.custinv.rep_label').replace('{name}', record.sales_person || t('sr.common.not_set'))}
                    </span>
                    <span className="font-bold text-primary">
                      {t('sr.custinv.products_count').replace('{n}', String(record.total_items || record.items?.length || 0))}
                    </span>
                  </div>
                </Card>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

export default function CustomerInventoryPage() {
  const { t } = useI18n()
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-background flex items-center justify-center">
          <div className="text-center">
            <Loader2 className="w-10 h-10 animate-spin text-primary mx-auto mb-3" />
            <p className="text-muted-foreground">{t('sr.common.loading')}</p>
          </div>
        </div>
      }
    >
      <CustomerInventoryContent />
    </Suspense>
  )
}

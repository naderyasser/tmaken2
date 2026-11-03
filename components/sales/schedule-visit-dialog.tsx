"use client"

import { useState } from "react"
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import {
    CalendarPlus, Loader2, CheckCircle2, AlertCircle, MapPin, Search, Clock,
} from "lucide-react"
import { salesApi, type Customer, type SalesPersonVisit, localDateISO } from "@/lib/sales-api"
import { useI18n } from "@/lib/i18n"
import { displayLocale } from '@/lib/sales-format'

const VISIT_TYPES = [
    { value: "Follow-up", labelKey: "sr.admin.dialogs.sv_vt_followup" },
    { value: "Sales Order", labelKey: "sr.admin.dialogs.sv_vt_sales_order" },
    { value: "Stock Check", labelKey: "sr.admin.dialogs.sv_vt_stock_check" },
    { value: "Product Return", labelKey: "sr.admin.dialogs.sv_vt_product_return" },
    { value: "No Order - Visit Only", labelKey: "sr.admin.dialogs.sv_vt_visit_only" },
] as const

interface ScheduleVisitDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    salesPersonName: string
    customers: Customer[]
    /** Pre-select a specific customer */
    preselectedCustomer?: string
    /** Callback after successful creation */
    onVisitCreated?: (visit: SalesPersonVisit) => void
}

export function ScheduleVisitDialog({
    open, onOpenChange, salesPersonName, customers,
    preselectedCustomer, onVisitCreated,
}: ScheduleVisitDialogProps) {
    const { t, lang } = useI18n()
    const dl = displayLocale(lang)
    const [selectedCustomer, setSelectedCustomer] = useState(preselectedCustomer || "")
    const [visitDate, setVisitDate] = useState(() => {
        // Default to tomorrow
        const d = new Date()
        d.setDate(d.getDate() + 1)
        return localDateISO(d)
    })
    const [visitTime, setVisitTime] = useState("09:00")
    const [visitType, setVisitType] = useState<string>("Follow-up")
    const [notes, setNotes] = useState("")
    const [customerSearch, setCustomerSearch] = useState("")
    const [saving, setSaving] = useState(false)
    const [result, setResult] = useState<{ success: boolean; message: string } | null>(null)

    // Filter customers
    const filteredCustomers = customers.filter((c) => {
        if (!customerSearch) return true
        const q = customerSearch.toLowerCase()
        return (
            c.customer_name?.toLowerCase().includes(q) ||
            c.name?.toLowerCase().includes(q) ||
            c.territory?.toLowerCase().includes(q)
        )
    })

    const selectedCustomerData = customers.find((c) => c.name === selectedCustomer)

    function resetForm() {
        if (!preselectedCustomer) setSelectedCustomer("")
        const d = new Date()
        d.setDate(d.getDate() + 1)
        setVisitDate(localDateISO(d))
        setVisitTime("09:00")
        setVisitType("Follow-up")
        setNotes("")
        setCustomerSearch("")
        setResult(null)
    }

    async function handleSubmit() {
        if (!selectedCustomer) {
            setResult({ success: false, message: t("sr.admin.dialogs.sv_err_select_customer") })
            return
        }
        if (!visitDate) {
            setResult({ success: false, message: t("sr.admin.dialogs.sv_err_select_date") })
            return
        }

        setSaving(true)
        setResult(null)

        try {
            const visitDatetime = `${visitDate} ${visitTime}:00`    
            const visit = await salesApi.createVisit({
                sales_person: salesPersonName,
                customer: selectedCustomer,
                visit_date: visitDatetime,
                visit_status: "Scheduled",
                visit_type: visitType as SalesPersonVisit["visit_type"],
                notes: notes || undefined,
            })

            if (visit) {
                setResult({ success: true, message: t("sr.admin.dialogs.sv_success") })
                onVisitCreated?.(visit)
                // Auto close after success
                setTimeout(() => {
                    onOpenChange(false)
                    resetForm()
                }, 1200)
            } else {
                throw new Error(t("sr.admin.dialogs.sv_err_not_created"))
            }
        } catch (err: any) {
            console.error("Failed to schedule visit:", err)
            const msg = err?.message?.includes("duplicate")
                ? t("sr.admin.dialogs.sv_err_duplicate")
                : err?.message || t("sr.admin.dialogs.sv_err_failed")
            setResult({ success: false, message: msg })
        } finally {
            setSaving(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) resetForm() }}>
            <DialogContent className="max-w-md mx-auto rounded-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="text-xl flex items-center gap-2">
                        <CalendarPlus className="w-5 h-5 text-blue-600" />
                        {t("sr.admin.dialogs.sv_title")}
                    </DialogTitle>
                    <DialogDescription>
                        {t("sr.admin.dialogs.sv_desc")}
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-5 mt-2">
                    {/* Customer Selection */}
                    <div className="space-y-2">
                        <Label className="text-sm font-bold">{t("sr.admin.dialogs.sv_label_customer")} *</Label>
                        {preselectedCustomer && selectedCustomerData ? (
                            <div className="flex items-center gap-2 p-3 bg-blue-50 rounded-xl border border-blue-200">
                                <MapPin className="w-4 h-4 text-blue-600 flex-shrink-0" />
                                <div className="flex-1 min-w-0">
                                    <p className="font-bold text-sm truncate">{selectedCustomerData.customer_name}</p>
                                    {selectedCustomerData.territory && (
                                        <p className="text-xs text-slate-500">{selectedCustomerData.territory}</p>
                                    )}
                                </div>
                            </div>
                        ) : (
                            <>
                                <div className="relative">
                                    <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                    <Input
                                        placeholder={t("sr.admin.dialogs.sv_search_placeholder")}
                                        value={customerSearch}
                                        onChange={(e) => setCustomerSearch(e.target.value)}
                                        className="pr-10 h-11 rounded-xl"
                                    />
                                </div>
                                <div className="max-h-40 overflow-y-auto border border-slate-200 rounded-xl divide-y divide-slate-100">
                                    {filteredCustomers.length === 0 ? (
                                        <p className="p-3 text-center text-sm text-slate-400">{t("sr.admin.dialogs.sv_no_results")}</p>
                                    ) : (
                                        filteredCustomers.slice(0, 20).map((c) => (
                                            <button
                                                key={c.name}
                                                type="button"
                                                className={`w-full text-right p-3 hover:bg-blue-50 transition-colors flex items-center gap-2 ${selectedCustomer === c.name ? "bg-blue-50 border-r-2 border-blue-600" : ""
                                                    }`}
                                                onClick={() => { setSelectedCustomer(c.name); setCustomerSearch("") }}
                                            >
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-sm font-medium truncate">{c.customer_name}</p>
                                                    <p className="text-xs text-slate-400 truncate">{c.territory || c.name}</p>
                                                </div>
                                                {selectedCustomer === c.name && (
                                                    <CheckCircle2 className="w-4 h-4 text-blue-600 flex-shrink-0" />
                                                )}
                                            </button>
                                        ))
                                    )}
                                </div>
                                {selectedCustomerData && (
                                    <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100">
                                        {selectedCustomerData.customer_name}
                                    </Badge>
                                )}
                            </>
                        )}
                    </div>

                    {/* Date & Time */}
                    <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-2">
                            <Label className="text-sm font-bold">{t("sr.admin.dialogs.sv_label_date")} *</Label>
                            <Input
                                type="date"
                                value={visitDate}
                                onChange={(e) => setVisitDate(e.target.value)}
                                min={localDateISO()}
                                className="h-11 rounded-xl"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label className="text-sm font-bold">{t("sr.admin.dialogs.sv_label_time")}</Label>
                            <Input
                                type="time"
                                value={visitTime}
                                onChange={(e) => setVisitTime(e.target.value)}
                                className="h-11 rounded-xl"
                            />
                        </div>
                    </div>

                    {/* Visit Type */}
                    <div className="space-y-2">
                        <Label className="text-sm font-bold">{t("sr.admin.dialogs.sv_label_visit_type")}</Label>
                        <Select value={visitType} onValueChange={setVisitType}>
                            <SelectTrigger className="h-11 rounded-xl">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {VISIT_TYPES.map((vt) => (
                                    <SelectItem key={vt.value} value={vt.value}>
                                        {t(vt.labelKey)}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Customer last visit info */}
                    {selectedCustomerData?.last_visit_date && (
                        <div className="flex items-center gap-2 text-xs text-slate-500 bg-slate-50 p-3 rounded-xl">
                            <Clock className="w-3.5 h-3.5" />
                            <span>
                                {t("sr.admin.dialogs.sv_last_visit").replace("{date}", new Date(selectedCustomerData.last_visit_date).toLocaleDateString(dl))}
                            </span>
                        </div>
                    )}

                    {/* Notes */}
                    <div className="space-y-2">
                        <Label className="text-sm font-bold">{t("sr.admin.dialogs.sv_label_notes")}</Label>
                        <Textarea
                            placeholder={t("sr.admin.dialogs.sv_notes_placeholder")}
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            className="rounded-xl resize-none"
                            rows={3}
                        />
                    </div>

                    {/* Result message */}
                    {result && (
                        <div className={`flex items-center gap-2 p-3 rounded-xl text-sm ${result.success
                            ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                            : "bg-red-50 text-red-700 border border-red-200"
                            }`}>
                            {result.success ? (
                                <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                            ) : (
                                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                            )}
                            {result.message}
                        </div>
                    )}

                    {/* Actions */}
                    <div className="flex gap-3 pt-2">
                        <Button
                            variant="outline"
                            className="flex-1 rounded-xl h-12 bg-transparent"
                            onClick={() => { onOpenChange(false); resetForm() }}
                            disabled={saving}
                        >
                            {t("sr.admin.dialogs.sv_cancel")}
                        </Button>
                        <Button
                            className="flex-1 rounded-xl h-12 bg-blue-600 hover:bg-blue-700"
                            onClick={handleSubmit}
                            disabled={saving || !selectedCustomer || !visitDate}
                        >
                            {saving ? (
                                <>
                                    <Loader2 className="w-4 h-4 ml-2 animate-spin" />
                                    {t("sr.admin.dialogs.sv_saving")}
                                </>
                            ) : (
                                <>
                                    <CalendarPlus className="w-4 h-4 ml-2" />
                                    {t("sr.admin.dialogs.sv_submit")}
                                </>
                            )}
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    )
}

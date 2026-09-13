"use client"

import { useState } from "react"
import { format } from "date-fns"
import { ar } from "date-fns/locale"
import { CalendarIcon, Loader2, X } from "lucide-react"

import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { Calendar } from "@/components/ui/calendar"
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover"
import { cn } from "@/lib/utils"
import { salesApi } from "@/lib/sales-api"
import { useI18n } from "@/lib/i18n"

// Visit outcome options.
// NOTE: `value` is persisted verbatim into the visit notes (backend), so it must
// stay the exact Arabic string. Only `labelKey` (the displayed option) is translated.
const VISIT_OUTCOMES = [
    { value: "تم الإنزال", labelKey: "sr.admin.dialogs.vs_outcome_delivered" },
    { value: "رفض الاستلام", labelKey: "sr.admin.dialogs.vs_outcome_refused" },
    { value: "مغلق - غير متاح", labelKey: "sr.admin.dialogs.vs_outcome_closed" },
    { value: "تأجيل", labelKey: "sr.admin.dialogs.vs_outcome_postponed" },
    { value: "زيارة تعريفية", labelKey: "sr.admin.dialogs.vs_outcome_intro" },
    { value: "تحصيل فقط", labelKey: "sr.admin.dialogs.vs_outcome_collection" },
] as const

export interface VisitSummaryDialogProps {
    open: boolean
    onComplete: () => void
    customerName: string
    customerId: string
    salesPersonName: string
    visitName: string
    /** Whether the visit had a sales order */
    hadOrder: boolean
}

export function VisitSummaryDialog({
    open,
    onComplete,
    customerName,
    customerId,
    salesPersonName,
    visitName,
    hadOrder,
}: VisitSummaryDialogProps) {
    const { t, dir } = useI18n()
    const [outcome, setOutcome] = useState<string>("")
    const [comment, setComment] = useState("")
    const [scheduleNext, setScheduleNext] = useState(false)
    const [nextDate, setNextDate] = useState<Date | undefined>(undefined)
    const [nextNotes, setNextNotes] = useState("")
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const handleSubmit = async () => {
        if (!outcome) {
            setError(t("sr.admin.dialogs.vs_err_outcome"))
            return
        }
        if (scheduleNext && !nextDate) {
            setError(t("sr.admin.dialogs.vs_err_next_date"))
            return
        }

        setSaving(true)
        setError(null)

        try {
            // 1. Update current visit notes with outcome + comment
            const notesParts: string[] = [t("sr.admin.dialogs.vs_note_outcome").replace("{outcome}", outcome)]
            if (comment.trim()) {
                notesParts.push(t("sr.admin.dialogs.vs_note_comment").replace("{comment}", comment.trim()))
            }

            try {
                // Append to existing notes if any
                const currentVisit = await salesApi.getVisit(visitName)
                const existingNotes = currentVisit?.notes || ""
                const separator = existingNotes ? "\n---\n" : ""
                await salesApi.updateVisit(visitName, {
                    notes: existingNotes + separator + notesParts.join("\n"),
                })
            } catch (err) {
                console.warn("[VisitSummary] Failed to update visit notes:", err)
                // Non-blocking — continue even if notes update fails
            }

            // 2. Create scheduled visit if requested
            if (scheduleNext && nextDate) {
                const visitDate = format(nextDate, "yyyy-MM-dd")
                const newVisitData: Record<string, any> = {
                    sales_person: salesPersonName,
                    customer: customerId,
                    visit_date: visitDate,
                    visit_status: "Scheduled",
                    visit_type: "Follow-up",
                }
                if (nextNotes.trim()) {
                    newVisitData.notes = nextNotes.trim()
                }
                await salesApi.createVisit(newVisitData as any)
            }

            onComplete()
        } catch (err) {
            console.error("[VisitSummary] Error:", err)
            setError(t("sr.admin.dialogs.vs_err_save"))
        } finally {
            setSaving(false)
        }
    }

    // Minimum date for next visit is tomorrow
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    tomorrow.setHours(0, 0, 0, 0)

    return (
        <Dialog open={open} onOpenChange={() => { /* prevent closing with backdrop */ }}>
            <DialogContent
                className="sm:max-w-[480px] max-h-[90vh] overflow-y-auto"
                dir={dir}
                onPointerDownOutside={(e) => { if (!error) e.preventDefault() }}
                onEscapeKeyDown={(e) => { if (!error) e.preventDefault() }}
            >
                <DialogHeader className="flex flex-row items-start justify-between">
                    <div className="flex-1">
                        <DialogTitle className="text-right text-lg">
                            {t("sr.admin.dialogs.vs_title")}
                        </DialogTitle>
                        <DialogDescription className="text-right text-muted-foreground">
                            {customerName}
                        </DialogDescription>
                    </div>
                    {/* Always-visible dismiss button — calls onComplete to skip the summary */}
                    <button
                        type="button"
                        onClick={onComplete}
                        disabled={saving}
                        className="rounded-sm opacity-70 ring-offset-background hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none"
                        aria-label={t("sr.admin.dialogs.vs_dismiss_aria")}
                    >
                        <X className="h-4 w-4" />
                    </button>
                </DialogHeader>

                <div className="space-y-4 py-2">
                    {/* Visit Outcome */}
                    <div className="space-y-2">
                        <Label className="text-right block">
                            {t("sr.admin.dialogs.vs_label_outcome")} <span className="text-destructive">*</span>
                        </Label>
                        <Select value={outcome} onValueChange={(v) => { setOutcome(v); setError(null) }}>
                            <SelectTrigger className="w-full text-right">
                                <SelectValue placeholder={t("sr.admin.dialogs.vs_outcome_placeholder")} />
                            </SelectTrigger>
                            <SelectContent>
                                {VISIT_OUTCOMES.map((o) => (
                                    <SelectItem key={o.value} value={o.value}>
                                        {t(o.labelKey)}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Comment */}
                    <div className="space-y-2">
                        <Label className="text-right block">{t("sr.admin.dialogs.vs_label_notes")}</Label>
                        <Textarea
                            value={comment}
                            onChange={(e) => setComment(e.target.value)}
                            placeholder={t("sr.admin.dialogs.vs_notes_placeholder")}
                            className="text-right min-h-[80px] resize-none"
                            dir={dir}
                        />
                    </div>

                    {/* Schedule Next Visit Toggle */}
                    <div className="border rounded-lg p-3 space-y-3">
                        <div className="flex items-center justify-between">
                            <Button
                                type="button"
                                variant={scheduleNext ? "default" : "outline"}
                                size="sm"
                                onClick={() => {
                                    setScheduleNext(!scheduleNext)
                                    if (scheduleNext) {
                                        setNextDate(undefined)
                                        setNextNotes("")
                                    }
                                    setError(null)
                                }}
                            >
                                {scheduleNext ? t("sr.admin.dialogs.vs_cancel_schedule") : t("sr.admin.dialogs.vs_schedule_next")}
                            </Button>
                            <Label className="text-sm font-medium">{t("sr.admin.dialogs.vs_label_next_visit")}</Label>
                        </div>

                        {scheduleNext && (
                            <div className="space-y-3 pt-2 border-t">
                                {/* Date Picker */}
                                <div className="space-y-2">
                                    <Label className="text-right block text-sm">
                                        {t("sr.admin.dialogs.vs_label_next_date")} <span className="text-destructive">*</span>
                                    </Label>
                                    <Popover>
                                        <PopoverTrigger asChild>
                                            <Button
                                                variant="outline"
                                                className={cn(
                                                    "w-full justify-start text-right font-normal",
                                                    !nextDate && "text-muted-foreground"
                                                )}
                                            >
                                                <CalendarIcon className="ml-2 h-4 w-4" />
                                                {nextDate
                                                    ? format(nextDate, "yyyy/MM/dd", { locale: ar })
                                                    : t("sr.admin.dialogs.vs_pick_date")}
                                            </Button>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-auto p-0" align="start">
                                            <Calendar
                                                mode="single"
                                                selected={nextDate}
                                                onSelect={(d) => { setNextDate(d); setError(null) }}
                                                disabled={(date) => date < tomorrow}
                                                initialFocus
                                            />
                                        </PopoverContent>
                                    </Popover>
                                </div>

                                {/* Notes for next visit */}
                                <div className="space-y-2">
                                    <Label className="text-right block text-sm">
                                        {t("sr.admin.dialogs.vs_label_next_notes")}
                                    </Label>
                                    <Textarea
                                        value={nextNotes}
                                        onChange={(e) => setNextNotes(e.target.value)}
                                        placeholder={t("sr.admin.dialogs.vs_next_notes_placeholder")}
                                        className="text-right min-h-[60px] resize-none"
                                        dir={dir}
                                    />
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Error */}
                    {error && (
                        <p className="text-sm text-destructive text-right">{error}</p>
                    )}
                </div>

                <DialogFooter className="flex-row-reverse gap-2 sm:flex-row-reverse">
                    <Button onClick={handleSubmit} disabled={saving} className="flex-1">
                        {saving ? (
                            <>
                                <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                                {t("sr.admin.dialogs.vs_saving")}
                            </>
                        ) : (
                            t("sr.admin.dialogs.vs_confirm")
                        )}
                    </Button>
                    <Button
                        variant="ghost"
                        onClick={() => {
                            // Skip without scheduling — just complete
                            onComplete()
                        }}
                        disabled={saving}
                        className="flex-1"
                    >
                        {t("sr.admin.dialogs.vs_skip")}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}

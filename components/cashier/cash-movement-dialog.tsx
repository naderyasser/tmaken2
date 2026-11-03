"use client"

import { useState } from "react"
import {
    ArrowDownCircle, ArrowUpCircle, Loader2, Banknote,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { cashierApi } from "@/lib/cashier-api"
import { useCashier } from "@/contexts/CashierContext"
import { useI18n } from "@/lib/i18n"
import { toast } from "sonner"

const REASONS_AR: Record<string, string> = {
    expense: "مصروفات",
    bank_deposit: "إيداع بنك",
    petty_cash: "سلفة",
    change_fund: "فكة",
    salary_advance: "سلفة راتب",
    other: "أخرى",
}

const REASONS_EN: Record<string, string> = {
    expense: "Expense",
    bank_deposit: "Bank Deposit",
    petty_cash: "Petty Cash",
    change_fund: "Change Fund",
    salary_advance: "Salary Advance",
    other: "Other",
}

interface CashMovementDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
}

export function CashMovementDialog({ open, onOpenChange }: CashMovementDialogProps) {
    const { session } = useCashier()
    const { lang } = useI18n()
    const reasons = lang === "ar" ? REASONS_AR : REASONS_EN

    const [type, setType] = useState<"in" | "out">("out")
    const [amount, setAmount] = useState("")
    const [reason, setReason] = useState("")
    const [note, setNote] = useState("")
    const [submitting, setSubmitting] = useState(false)

    const reset = () => {
        setType("out")
        setAmount("")
        setReason("")
        setNote("")
    }

    const handleSubmit = async () => {
        if (!session?.name) return
        const parsedAmount = parseFloat(amount)
        if (!parsedAmount || parsedAmount <= 0) {
            toast.error(lang === "ar" ? "أدخل مبلغ صحيح" : "Enter a valid amount")
            return
        }
        if (!reason) {
            toast.error(lang === "ar" ? "اختر السبب" : "Select a reason")
            return
        }

        setSubmitting(true)
        try {
            await cashierApi.cashMovement({
                session_id: session.name,
                type,
                amount: parsedAmount,
                reason: reasons[reason] || reason,
                note: note.trim() || undefined,
            })
            toast.success(
                type === "in"
                    ? lang === "ar" ? "تم إضافة النقد بنجاح" : "Cash added successfully"
                    : lang === "ar" ? "تم سحب النقد بنجاح" : "Cash withdrawn successfully"
            )
            reset()
            onOpenChange(false)
        } catch (e: unknown) {
            toast.error(e instanceof Error ? e.message : "Failed")
        } finally {
            setSubmitting(false)
        }
    }

    // Numpad for amount
    const numpadKeys = ["7", "8", "9", "4", "5", "6", "1", "2", "3", ".", "0", "⌫"]
    const handleNumpad = (key: string) => {
        if (key === "⌫") {
            setAmount(prev => prev.slice(0, -1))
        } else if (key === ".") {
            if (!amount.includes(".")) setAmount(prev => prev + ".")
        } else {
            setAmount(prev => (prev === "0" ? key : prev + key))
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md [font-family:var(--font-arabic)]" dir="rtl">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-lg">
                        <Banknote className="h-5 w-5 text-emerald-600" />
                        {lang === "ar" ? "حركة نقدية" : "Cash Movement"}
                    </DialogTitle>
                </DialogHeader>

                <div className="space-y-4 pt-2">
                    {/* Type toggle */}
                    <div className="grid grid-cols-2 gap-2">
                        <button
                            type="button"
                            onClick={() => setType("in")}
                            className={`flex items-center justify-center gap-2 h-12 rounded-xl font-bold text-sm border-2 transition-all ${type === "in"
                                    ? "border-emerald-500 bg-emerald-50 text-emerald-700"
                                    : "border-slate-200 bg-white text-slate-500 hover:border-slate-300"
                                }`}
                        >
                            <ArrowDownCircle className="h-4 w-4" />
                            {lang === "ar" ? "إدخال نقد" : "Cash In"}
                        </button>
                        <button
                            type="button"
                            onClick={() => setType("out")}
                            className={`flex items-center justify-center gap-2 h-12 rounded-xl font-bold text-sm border-2 transition-all ${type === "out"
                                    ? "border-rose-500 bg-rose-50 text-rose-700"
                                    : "border-slate-200 bg-white text-slate-500 hover:border-slate-300"
                                }`}
                        >
                            <ArrowUpCircle className="h-4 w-4" />
                            {lang === "ar" ? "سحب نقد" : "Cash Out"}
                        </button>
                    </div>

                    {/* Amount display */}
                    <div className="space-y-1.5">
                        <Label>{lang === "ar" ? "المبلغ" : "Amount"}</Label>
                        <Input
                            type="text"
                            inputMode="decimal"
                            value={amount}
                            onChange={e => {
                                const v = e.target.value
                                if (/^\d*\.?\d{0,2}$/.test(v)) setAmount(v)
                            }}
                            placeholder="0.00"
                            className="h-14 text-center text-2xl font-black border-2 border-slate-200 focus-visible:ring-emerald-500"
                            dir="ltr"
                        />
                    </div>

                    {/* Numpad */}
                    <div className="grid grid-cols-3 gap-1.5">
                        {numpadKeys.map(key => (
                            <button
                                key={key}
                                type="button"
                                onClick={() => handleNumpad(key)}
                                className="h-11 rounded-lg bg-slate-100 hover:bg-slate-200 active:bg-slate-300 text-lg font-bold text-slate-700 transition-colors"
                            >
                                {key}
                            </button>
                        ))}
                    </div>

                    {/* Reason */}
                    <div className="space-y-1.5">
                        <Label>{lang === "ar" ? "السبب" : "Reason"}</Label>
                        <Select value={reason} onValueChange={setReason}>
                            <SelectTrigger className="h-11">
                                <SelectValue placeholder={lang === "ar" ? "اختر السبب..." : "Select reason..."} />
                            </SelectTrigger>
                            <SelectContent>
                                {Object.entries(reasons).map(([key, label]) => (
                                    <SelectItem key={key} value={key}>
                                        {label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Note */}
                    <div className="space-y-1.5">
                        <Label>{lang === "ar" ? "ملاحظة (اختياري)" : "Note (optional)"}</Label>
                        <Textarea
                            value={note}
                            onChange={e => setNote(e.target.value)}
                            placeholder={lang === "ar" ? "أضف ملاحظة..." : "Add a note..."}
                            className="resize-none h-16"
                        />
                    </div>

                    {/* Submit */}
                    <Button
                        className={`w-full h-12 text-base font-bold rounded-xl gap-2 ${type === "in"
                                ? "bg-emerald-600 hover:bg-emerald-700"
                                : "bg-rose-600 hover:bg-rose-700"
                            }`}
                        onClick={handleSubmit}
                        disabled={submitting || !amount || !reason}
                    >
                        {submitting ? (
                            <Loader2 className="h-5 w-5 animate-spin" />
                        ) : type === "in" ? (
                            <>
                                <ArrowDownCircle className="h-5 w-5" />
                                {lang === "ar" ? "تأكيد الإدخال" : "Confirm Cash In"}
                            </>
                        ) : (
                            <>
                                <ArrowUpCircle className="h-5 w-5" />
                                {lang === "ar" ? "تأكيد السحب" : "Confirm Cash Out"}
                            </>
                        )}
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    )
}

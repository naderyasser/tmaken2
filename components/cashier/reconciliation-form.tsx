"use client"

import { useState } from "react"
import { AlertTriangle, CheckCircle2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import {
  Alert,
  AlertDescription,
} from "@/components/ui/alert"
import { fmtCurrency } from "@/lib/cashier-utils"

interface PaymentSummaryRow {
  mode_of_payment: string
  expected: number
  opening_amount: number
}

interface ClosingAmounts {
  [modeOfPayment: string]: number
}

interface ReconciliationFormProps {
  paymentSummary: PaymentSummaryRow[]
  onClose: (closingAmounts: ClosingAmounts) => void
  isSubmitting?: boolean
}

function fmt(n: number) {
  return fmtCurrency(n)
}

export function ReconciliationForm({
  paymentSummary,
  onClose,
  isSubmitting,
}: ReconciliationFormProps) {
  const [actuals, setActuals] = useState<Record<string, string>>(() =>
    Object.fromEntries(paymentSummary.map(r => [r.mode_of_payment, ""]))
  )

  const setActual = (mode: string, val: string) =>
    setActuals(prev => ({ ...prev, [mode]: val }))

  const rows = paymentSummary.map(r => {
    const actual = parseFloat(actuals[r.mode_of_payment] || "0") || 0
    const variance = actual - r.expected
    return { ...r, actual, variance }
  })

  const totalExpected = rows.reduce((s, r) => s + r.expected, 0)
  const totalActual = rows.reduce((s, r) => s + r.actual, 0)
  const totalVariance = totalActual - totalExpected
  const hasLargeVariance = rows.some(r => Math.abs(r.variance) > 1)

  const handleSubmit = () => {
    const amounts: ClosingAmounts = {}
    rows.forEach(r => { amounts[r.mode_of_payment] = r.actual })
    onClose(amounts)
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg border overflow-hidden">
        {/* Table header */}
        <div className="grid grid-cols-4 bg-gray-50 px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide">
          <span>Payment Method</span>
          <span className="text-right">Expected</span>
          <span className="text-right">Counted</span>
          <span className="text-right">Variance</span>
        </div>
        <Separator />

        {rows.map(r => (
          <div key={r.mode_of_payment} className="grid grid-cols-4 items-center px-3 py-2 gap-2 border-b last:border-0">
            <span className="text-sm font-medium">{r.mode_of_payment}</span>
            <span className="text-right text-sm">{fmt(r.expected)}</span>
            <div>
              <Input
                type="number"
                min="0"
                step="0.01"
                className="h-8 text-sm text-right"
                value={actuals[r.mode_of_payment]}
                onChange={e => setActual(r.mode_of_payment, e.target.value)}
                placeholder={r.expected.toFixed(2)}
              />
            </div>
            <span
              className={`text-right text-sm font-semibold ${
                r.variance === 0
                  ? "text-green-600"
                  : r.variance > 0
                  ? "text-blue-600"
                  : "text-red-600"
              }`}
            >
              {r.variance > 0 ? "+" : ""}{fmt(r.variance)}
            </span>
          </div>
        ))}

        {/* Totals row */}
        <div className="grid grid-cols-4 items-center px-3 py-2 bg-gray-50 font-semibold text-sm">
          <span>TOTAL</span>
          <span className="text-right">{fmt(totalExpected)}</span>
          <span className="text-right">{fmt(totalActual)}</span>
          <span
            className={`text-right ${
              totalVariance === 0 ? "text-green-600" : totalVariance > 0 ? "text-blue-600" : "text-red-600"
            }`}
          >
            {totalVariance > 0 ? "+" : ""}{fmt(totalVariance)}
          </span>
        </div>
      </div>

      {hasLargeVariance && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            There are variances in your count. Please verify before closing.
          </AlertDescription>
        </Alert>
      )}

      <Button
        size="lg"
        className="w-full"
        onClick={handleSubmit}
        disabled={isSubmitting}
      >
        {isSubmitting ? (
          <span className="flex items-center gap-2">
            <span className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            Closing Session...
          </span>
        ) : (
          <span className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5" />
            Close Session
          </span>
        )}
      </Button>
    </div>
  )
}

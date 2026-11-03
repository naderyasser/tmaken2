"use client"

/**
 * Receipt Preview — Redesigned (Phase 2)
 *
 * Features:
 *  • Bilingual Arabic/English thermal receipt (80mm)
 *  • ZATCA TLV QR code (qrcode.react QRCodeSVG) — shown only when vatNumber exists
 *  • "فاتورة ضريبية / TAX INVOICE" when VAT registered; plain "فاتورة" otherwise
 *  • Return receipt variant (isReturn) — negative amounts in rose, "إشعار إرجاع"
 *  • Enhanced print CSS: @page 80mm, no browser header/footer
 *  • Auto-print on mount (autoPrint prop)
 *  • Void button (G7)
 */

import { useEffect, useRef, useState } from "react"
import { Printer, XCircle, X, Download } from "lucide-react"
import { QRCodeSVG } from "qrcode.react"
import { Button } from "@/components/ui/button"
import type { PaymentEntry } from "@/lib/cashier-api"
import { fmtCurrency, generateEInvoiceQR } from "@/lib/cashier-utils"
import { paymentMethodLabel } from "@/lib/cashier/payment-labels"
import { useI18n } from "@/lib/i18n"
import { buildReceiptHtml, printHtml, getRollWidth, type PrintReceipt } from "@/lib/cashier/print"
import { useBrand, printableLogo } from "@/hooks/use-brand"

// ── Types ────────────────────────────────────────────────────────────────────

export interface ReceiptItem {
  item_code: string
  item_name?: string
  qty: number
  rate: number
  amount: number
  discount_percentage?: number
}

export interface ReceiptData {
  invoiceNumber: string
  date: string
  time: string
  cashierName: string
  company: string
  companyAddress?: string
  vatNumber?: string
  customer: string
  items: ReceiptItem[]
  subtotal: number
  discount: number
  taxAmount: number
  grandTotal: number
  payments: PaymentEntry[]
  changeAmount: number
  /** Legacy: pre-generated QR base64 image (overrides TLV generation if provided) */
  qrCode?: string | null
  zatcaStatus?: string | null
  currency?: string
  /** Return receipt variant */
  isReturn?: boolean
  returnReason?: string
  /** Reference to the original invoice (for returns) */
  originalInvoice?: string
  /** Auto-print immediately on mount */
  autoPrint?: boolean
}

interface ReceiptPreviewProps {
  data: ReceiptData
  onClose?: () => void
  invoiceName?: string
  showVoid?: boolean
  onVoid?: () => Promise<void>
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Two-digit pad */
const pad2 = (n: number) => String(n).padStart(2, "0")

/** Build ISO 8601 timestamp from date + time strings */
function buildTimestamp(date: string, time: string): string {
  if (!date) return new Date().toISOString()
  const base = time ? `${date}T${time}` : `${date}T00:00:00`
  const d = new Date(base)
  return isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString()
}

/** Derive VAT rate percentage label */
function vatLabel(taxAmount: number, subtotal: number, discount: number): string {
  const base = subtotal - discount
  if (base <= 0 || taxAmount <= 0) return "ضريبة القيمة المضافة / VAT"
  const pct = Math.round((taxAmount / base) * 100)
  return `ضريبة القيمة المضافة ${pct}% / VAT ${pct}%`
}

// ── Component ─────────────────────────────────────────────────────────────────

export function ReceiptPreview({
  data,
  onClose,
  showVoid,
  onVoid,
}: ReceiptPreviewProps) {
  const { lang } = useI18n()
  const brand = useBrand()
  const [voiding, setVoiding] = useState(false)
  const [voidError, setVoidError] = useState("")
  const printedRef = useRef(false)

  // Print via a dedicated hidden IFRAME (lib/cashier/print.ts). The old
  // window.print()+CSS approach printed a BLANK page: the receipt sits inside a Radix
  // Sheet portal, and the "hide everything except the receipt" rule hid the portal too.
  const handlePrint = async () => {
    const receipt: PrintReceipt = {
      logoUrl: printableLogo(brand),
      title: data.isReturn ? "إشعار إرجاع / RETURN NOTE" : undefined,
      company: data.company,
      companyAddress: data.companyAddress,
      vatNumber: data.vatNumber,
      invoiceNumber: data.invoiceNumber,
      date: data.date,
      time: data.time,
      cashierName: data.cashierName,
      customer: data.customer,
      items: data.items.map(it => ({
        name: it.item_name || it.item_code,
        qty: it.qty,
        rate: it.rate,
        amount: it.amount,
      })),
      subtotal: data.subtotal,
      discount: data.discount,
      taxAmount: data.taxAmount,
      grandTotal: data.grandTotal,
      payments: (data.payments ?? []).map(p => ({ ...p, mode_of_payment: paymentMethodLabel(p.mode_of_payment, lang) })),
      changeAmount: data.changeAmount,
    }
    // ZATCA QR → data URL for the printout (only when a VAT number exists)
    if (qrValue) {
      try {
        const QR = (await import("qrcode")).default
        receipt.qrDataUrl = await QR.toDataURL(qrValue, { margin: 0, width: 256 })
      } catch { /* print without QR rather than fail */ }
    }
    void printHtml(buildReceiptHtml(receipt, { width: getRollWidth() }))
  }

  // Auto-print on mount (configurable, fires once)
  useEffect(() => {
    if (data.autoPrint && !printedRef.current) {
      printedRef.current = true
      const t = setTimeout(() => { void handlePrint() }, 300)
      return () => clearTimeout(t)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.autoPrint])

  const handleVoid = async () => {
    if (!onVoid) return
    setVoidError("")
    setVoiding(true)
    try {
      await onVoid()
    } catch (e) {
      setVoidError(e instanceof Error ? e.message : "فشل في الإلغاء / Void failed")
    } finally {
      setVoiding(false)
    }
  }

  // ── QR data ──────────────────────────────────────────────────────────────
  const isTaxInvoice = !!(data.vatNumber)
  const timestamp = buildTimestamp(data.date, data.time)

  // Prefer pre-generated QR; fall back to TLV generation if vatNumber available
  let qrValue: string | null = null
  if (data.qrCode) {
    // Legacy: was a base64 PNG — only show as img, not as QRCodeSVG
    qrValue = null // handled via legacyQR branch
  } else if (isTaxInvoice) {
    qrValue = generateEInvoiceQR({
      sellerName: data.company,
      vatNumber: data.vatNumber!,
      timestamp,
      totalWithVat: Math.abs(data.grandTotal),
      vatAmount: Math.abs(data.taxAmount),
    })
  }

  const isReturn = !!data.isReturn

  // ── Sign modifier for return receipts ──────────────────────────────────────
  const sign = (n: number) => (isReturn ? -Math.abs(n) : Math.abs(n))
  const fmtSigned = (n: number) => fmtCurrency(sign(n))

  return (
    <>
      {/* on-screen preview only — printing renders its own document in an iframe
          (lib/cashier/print.ts), so no global @media print rules are needed */}
      {/* ── Action bar (hidden on print) ──────────────────────────────────── */}
      <div className="print:hidden flex gap-2 mb-4 flex-wrap">
        <Button
          size="sm"
          className="gap-1.5 bg-emerald-600 hover:bg-emerald-700"
          onClick={handlePrint}
        >
          <Printer className="h-4 w-4" />
          طباعة / Print
        </Button>

        {/* PDF = print dialog → "Save as PDF" */}
        <Button
          size="sm"
          variant="outline"
          className="gap-1.5"
          onClick={handlePrint}
        >
          <Download className="h-4 w-4" />
          PDF
        </Button>

        {showVoid && onVoid && (
          <Button
            size="sm"
            variant="destructive"
            onClick={handleVoid}
            disabled={voiding}
            className="gap-1.5"
          >
            {voiding ? (
              <span className="h-3.5 w-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <XCircle className="h-4 w-4" />
            )}
            إلغاء / Void
          </Button>
        )}

        {voidError && (
          <p className="text-xs text-rose-600 self-center">{voidError}</p>
        )}

        {onClose && (
          <Button size="sm" variant="ghost" onClick={onClose} className="gap-1">
            <X className="h-4 w-4" />
            إغلاق
          </Button>
        )}
      </div>

      {/* ── Receipt body ──────────────────────────────────────────────────── */}
      <div
        id="receipt-print-root"
        dir="rtl"
        className="mx-auto bg-white text-slate-900 select-none"
        style={{
          width: "302px",          // 80mm
          fontFamily: "'Courier New', Courier, monospace",
          fontSize: "11px",
          lineHeight: "1.5",
        }}
      >
        {/* ──────────── RETURN BANNER ──────────── */}
        {isReturn && (
          <div
            style={{
              textAlign: "center",
              border: "2px solid #e11d48",
              borderRadius: "4px",
              padding: "4px 0",
              marginBottom: "8px",
              color: "#e11d48",
              fontWeight: "bold",
              fontSize: "12px",
            }}
          >
            ⚠ إشعار إرجاع / RETURN NOTE ⚠
          </div>
        )}

        {/* ──────────── HEADER ──────────── */}
        <div style={{ textAlign: "center", marginBottom: "8px" }}>
          <div style={{ fontWeight: "bold", fontSize: "14px", letterSpacing: "0.5px" }}>
            {data.company}
          </div>
          {data.companyAddress && (
            <div style={{ fontSize: "10px", color: "#475569", marginTop: "2px" }}>
              {data.companyAddress}
            </div>
          )}
          {isTaxInvoice && (
            <div style={{ fontSize: "10px", marginTop: "2px" }}>
              الرقم الضريبي / VAT No: <strong>{data.vatNumber}</strong>
            </div>
          )}
        </div>

        <Divider />

        {/* ──────────── DOCUMENT TYPE ──────────── */}
        <div
          style={{
            textAlign: "center",
            fontWeight: "bold",
            fontSize: "12px",
            padding: "4px 0",
            background: isReturn ? "#fff1f2" : isTaxInvoice ? "#f0fdf4" : "#f8fafc",
            borderRadius: "3px",
            marginBottom: "6px",
            color: isReturn ? "#e11d48" : isTaxInvoice ? "#065f46" : "#1e293b",
          }}
        >
          {isReturn
            ? "إشعار إرجاع / RETURN NOTE"
            : isTaxInvoice
            ? "فاتورة ضريبية / TAX INVOICE"
            : "فاتورة / INVOICE"}
        </div>

        {/* ──────────── META ──────────── */}
        <MetaRow label="رقم الفاتورة / Invoice" value={data.invoiceNumber} bold />
        {isReturn && data.originalInvoice && (
          <MetaRow label="الفاتورة الأصلية / Ref" value={data.originalInvoice} />
        )}
        <MetaRow label="التاريخ / Date" value={data.date} />
        {data.time && <MetaRow label="الوقت / Time" value={data.time.slice(0, 8)} />}
        <MetaRow label="الصندوق / Cashier" value={data.cashierName} />
        {data.customer && data.customer !== "Walk-In Customer" && (
          <MetaRow label="العميل / Customer" value={data.customer} />
        )}

        <Divider />

        {/* ──────────── ITEMS ──────────── */}
        {/* Column headers */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            fontWeight: "bold",
            fontSize: "10px",
            color: "#64748b",
            marginBottom: "3px",
          }}
        >
          <span style={{ flex: 1 }}>الصنف / Item</span>
          <span style={{ width: "60px", textAlign: "left" }}>الكمية</span>
          <span style={{ width: "74px", textAlign: "left" }}>الإجمالي</span>
        </div>

        <div style={{ borderTop: "1px dashed #cbd5e1", marginBottom: "4px" }} />

        {data.items.map((item, i) => (
          <div key={`${item.item_code}-${i}`} style={{ marginBottom: "5px" }}>
            <div style={{ fontWeight: "600" }}>
              {item.item_name || item.item_code}
            </div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                color: isReturn ? "#e11d48" : "#475569",
                fontSize: "10px",
              }}
            >
              <span>
                {isReturn ? "-" : ""}{item.qty} × {fmtCurrency(item.rate)}
                {item.discount_percentage
                  ? ` (خصم ${item.discount_percentage}%)`
                  : ""}
              </span>
              <span style={{ fontWeight: "bold" }}>
                {isReturn
                  ? `-${fmtCurrency(Math.abs(item.amount))}`
                  : fmtCurrency(item.amount)}
              </span>
            </div>
          </div>
        ))}

        <Divider />

        {/* ──────────── TOTALS ──────────── */}
        <TotalRow label="المجموع الفرعي / Subtotal" value={fmtSigned(data.subtotal)} />
        {data.discount > 0 && (
          <TotalRow
            label="الخصم / Discount"
            value={`-${fmtCurrency(data.discount)}`}
            red
          />
        )}
        {data.taxAmount > 0 && (
          <TotalRow
            label={vatLabel(data.taxAmount, data.subtotal, data.discount)}
            value={fmtSigned(data.taxAmount)}
            red={isReturn}
          />
        )}

        {/* Grand total */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            fontWeight: "bold",
            fontSize: "13px",
            marginTop: "6px",
            padding: "4px 0",
            borderTop: "2px solid #1e293b",
            borderBottom: "2px solid #1e293b",
            color: isReturn ? "#e11d48" : "#065f46",
          }}
        >
          <span>الإجمالي / TOTAL</span>
          <span>{fmtSigned(data.grandTotal)}</span>
        </div>

        {/* Return reason */}
        {isReturn && data.returnReason && (
          <div
            style={{
              marginTop: "6px",
              padding: "3px 4px",
              background: "#fff1f2",
              borderRadius: "3px",
              color: "#9f1239",
              fontSize: "10px",
            }}
          >
            سبب الإرجاع: {data.returnReason}
          </div>
        )}

        <Divider />

        {/* ──────────── PAYMENTS ──────────── */}
        <div style={{ fontSize: "10px", color: "#475569", marginBottom: "2px", fontWeight: "bold" }}>
          طريقة الدفع / Payment Method
        </div>
        {data.payments.map((p, i) => (
          <div key={`${p.mode_of_payment}-${i}`}>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span>{paymentMethodLabel(p.mode_of_payment, lang)}</span>
              <span>{fmtCurrency(p.amount)}</span>
            </div>
            {/* Card terminal approval — the reference a dispute is settled with. */}
            {p.reference && (
              <div dir="ltr" style={{ fontSize: "9px", color: "#64748b", textAlign: "start" }}>
                {[
                  p.reference.rrn && `RRN ${p.reference.rrn}`,
                  p.reference.authCode && `AUTH ${p.reference.authCode}`,
                  p.reference.maskedPan &&
                    `${p.reference.scheme ?? ""} ${p.reference.maskedPan}`.trim(),
                ].filter(Boolean).join("  ")}
              </div>
            )}
          </div>
        ))}
        {data.changeAmount > 0 && (
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              fontWeight: "bold",
              color: "#0369a1",
            }}
          >
            <span>الباقي / Change</span>
            <span>{fmtCurrency(data.changeAmount)}</span>
          </div>
        )}

        {/* ──────────── ZATCA QR ──────────── */}
        {(qrValue || data.qrCode) && (
          <>
            <Divider />
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: "10px", color: "#475569", marginBottom: "4px" }}>
                امسح للتحقق من الفاتورة / Scan to verify
              </div>
              {qrValue ? (
                <div style={{ display: "inline-block" }}>
                  <QRCodeSVG
                    value={qrValue}
                    size={100}
                    level="M"
                    marginSize={1}
                  />
                </div>
              ) : data.qrCode ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={`data:image/png;base64,${data.qrCode}`}
                  alt="QR"
                  width={100}
                  height={100}
                  style={{ display: "inline-block" }}
                />
              ) : null}
              {data.zatcaStatus && (
                <div style={{ fontSize: "9px", color: "#94a3b8", marginTop: "2px" }}>
                  {data.zatcaStatus}
                </div>
              )}
            </div>
          </>
        )}

        <Divider />

        {/* ──────────── FOOTER ──────────── */}
        <div style={{ textAlign: "center", fontSize: "10px", color: "#64748b" }}>
          <div style={{ fontWeight: "bold", marginBottom: "2px" }}>
            شكراً لتسوقكم معنا
          </div>
          <div>Thank you for your business!</div>
          <div style={{ marginTop: "4px", fontSize: "9px", color: "#94a3b8" }}>
            {data.invoiceNumber} · {data.date}
          </div>
        </div>

        {/* bottom padding for thermal cutter */}
        <div style={{ height: "16px" }} />
      </div>
    </>
  )
}

// ── Sub-components ────────────────────────────────────────────────────────────

function Divider() {
  return (
    <div
      style={{
        borderTop: "1px dashed #cbd5e1",
        margin: "6px 0",
      }}
    />
  )
}

function MetaRow({
  label,
  value,
  bold,
}: {
  label: string
  value: string
  bold?: boolean
}) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        marginBottom: "2px",
        fontSize: "10px",
      }}
    >
      <span style={{ color: "#64748b" }}>{label}</span>
      <span style={{ fontWeight: bold ? "bold" : "normal", maxWidth: "160px", textAlign: "left" }}>
        {value}
      </span>
    </div>
  )
}

function TotalRow({
  label,
  value,
  red,
}: {
  label: string
  value: string
  red?: boolean
}) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        marginBottom: "2px",
        color: red ? "#e11d48" : "inherit",
      }}
    >
      <span>{label}</span>
      <span>{value}</span>
    </div>
  )
}

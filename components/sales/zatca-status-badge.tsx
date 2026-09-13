/**
 * ZATCA Status Badge & QR Code Display Components
 * Reusable across invoice lists, invoice detail views, and sales rep flows
 */

'use client'

import { useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'
import { CheckCircle2, XCircle, AlertTriangle, Clock, QrCode, Shield, RotateCcw, Loader2 } from 'lucide-react'
import { zatcaApi } from '@/lib/zatca-api'
import { useToast } from '@/hooks/use-toast'
import { useI18n } from '@/lib/i18n'

const STATUS_STYLES: Record<string, { bg: string; icon: typeof CheckCircle2 }> = {
  'CLEARED': { bg: 'bg-green-100 text-green-700', icon: CheckCircle2 },
  'Cleared': { bg: 'bg-green-100 text-green-700', icon: CheckCircle2 },
  'REPORTED': { bg: 'bg-blue-100 text-blue-700', icon: CheckCircle2 },
  'Reported': { bg: 'bg-blue-100 text-blue-700', icon: CheckCircle2 },
  'Not Submitted': { bg: 'bg-gray-100 text-gray-600', icon: Clock },
  'REJECTED': { bg: 'bg-red-100 text-red-700', icon: XCircle },
  'Rejected': { bg: 'bg-red-100 text-red-700', icon: XCircle },
  'ERROR': { bg: 'bg-red-100 text-red-700', icon: XCircle },
  '503': { bg: 'bg-amber-100 text-amber-700', icon: AlertTriangle },
}

function getStatusStyle(status: string | undefined) {
  if (!status) return { bg: 'bg-gray-100 text-gray-500', icon: Clock }
  for (const [key, val] of Object.entries(STATUS_STYLES)) {
    if (status.toUpperCase().includes(key.toUpperCase())) return val
  }
  return { bg: 'bg-gray-100 text-gray-500', icon: Clock }
}

/** Localized display label for a raw ZATCA status; unknown raw statuses (e.g. '503') fall back to the raw value. */
function zatcaStatusLabel(t: (key: string) => string, status: string | undefined): string {
  if (!status) return t('sr.admin.zatca.not_submitted')
  const u = status.toUpperCase()
  if (u.includes('CLEARED')) return t('sr.admin.zatca.status_cleared')
  if (u.includes('REPORTED')) return t('sr.admin.zatca.status_reported')
  if (u.includes('NOT SUBMITTED')) return t('sr.admin.zatca.not_submitted')
  if (u.includes('REJECTED')) return t('sr.admin.zatca.status_rejected')
  if (u.includes('ERROR')) return t('sr.admin.zatca.status_error')
  return status
}

interface ZatcaStatusBadgeProps {
  status?: string
  className?: string
  showIcon?: boolean
  size?: 'sm' | 'md'
}

/**
 * Displays a colored badge with icon for ZATCA invoice status
 */
export function ZatcaStatusBadge({ status, className, showIcon = true, size = 'sm' }: ZatcaStatusBadgeProps) {
  const { t } = useI18n()
  const { bg, icon: Icon } = getStatusStyle(status)
  const displayStatus = zatcaStatusLabel(t, status)

  return (
    <Badge className={cn(
      bg,
      'gap-1 font-medium border-0',
      size === 'sm' ? 'text-[10px] px-1.5 py-0.5' : 'text-xs px-2 py-1',
      className,
    )}>
      {showIcon && <Icon className={size === 'sm' ? 'h-3 w-3' : 'h-3.5 w-3.5'} />}
      {displayStatus}
    </Badge>
  )
}

interface ZatcaQRPopoverProps {
  qrCode?: string
  invoiceName: string
  zatcaStatus?: string
  className?: string
}

/**
 * Small QR icon button that shows QR code in a popover
 */
export function ZatcaQRPopover({ qrCode, invoiceName, zatcaStatus, className }: ZatcaQRPopoverProps) {
  const { t } = useI18n()
  if (!qrCode) return null

  const qrSrc = qrCode.startsWith('data:') ? qrCode : `data:image/png;base64,${qrCode}`

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" className={cn('h-7 w-7 p-0', className)}>
          <QrCode className="h-3.5 w-3.5 text-green-600" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-56 p-3" align="center">
        <div className="text-center space-y-2">
          <p className="text-xs font-medium text-gray-700 flex items-center justify-center gap-1">
            <Shield className="h-3 w-3 text-green-600" />
            {t('sr.admin.zatca.qr_popover_label').replace('{invoiceName}', invoiceName)}
          </p>
          <img src={qrSrc} alt="ZATCA QR" className="mx-auto max-w-[160px] rounded" />
          {zatcaStatus && <ZatcaStatusBadge status={zatcaStatus} size="md" />}
        </div>
      </PopoverContent>
    </Popover>
  )
}

interface ZatcaQRDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  qrCode?: string
  invoiceName: string
  zatcaStatus?: string
  uuid?: string
}

/**
 * Full dialog showing ZATCA QR code with details - used after invoice submission
 */
export function ZatcaQRDialog({ open, onOpenChange, qrCode, invoiceName, zatcaStatus, uuid }: ZatcaQRDialogProps) {
  const { t } = useI18n()
  const qrSrc = qrCode
    ? (qrCode.startsWith('data:') ? qrCode : `data:image/png;base64,${qrCode}`)
    : null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-center gap-2 text-center">
            <Shield className="h-5 w-5 text-green-600" />
            {t('sr.admin.zatca.einvoice_title')}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 text-center">
          <div className="flex justify-center">
            <ZatcaStatusBadge status={zatcaStatus} size="md" />
          </div>

          {qrSrc ? (
            <div className="p-4 bg-white border rounded-xl inline-block mx-auto">
              <img src={qrSrc} alt="ZATCA E-Invoice QR" className="max-w-[200px] mx-auto" />
            </div>
          ) : (
            <div className="p-8 bg-gray-50 rounded-xl">
              <QrCode className="h-12 w-12 text-gray-300 mx-auto mb-2" />
              <p className="text-sm text-gray-500">
                {zatcaStatus?.toUpperCase().includes('CLEAR') || zatcaStatus?.toUpperCase().includes('REPORT')
                  ? t('sr.admin.zatca.qr_not_available')
                  : t('sr.admin.zatca.qr_pending_ar')}
              </p>
            </div>
          )}

          <div className="text-xs text-gray-500 space-y-1">
            <p>{t('sr.admin.zatca.invoice_colon_ar')} <span className="font-mono">{invoiceName}</span></p>
            {uuid && <p>UUID: <span className="font-mono text-[10px]">{uuid}</span></p>}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

interface ZatcaResubmitButtonProps {
  invoiceName: string
  zatcaStatus?: string
  onSuccess?: () => void
  className?: string
}

/**
 * Button to resubmit a failed/pending invoice to ZATCA
 */
export function ZatcaResubmitButton({ invoiceName, zatcaStatus, onSuccess, className }: ZatcaResubmitButtonProps) {
  const [loading, setLoading] = useState(false)
  const { toast } = useToast()
  const { t } = useI18n()

  // Only show for non-success statuses
  const status = (zatcaStatus || '').toUpperCase()
  const canResubmit = !status.includes('CLEARED') && !status.includes('REPORTED')
  if (!canResubmit) return null

  const handleResubmit = async () => {
    setLoading(true)
    try {
      const result = await zatcaApi.resubmitInvoice(invoiceName)
      if (result.success) {
        toast({ title: t('sr.admin.zatca.toast_title'), description: result.message || `${invoiceName} → ${result.zatca_status}` })
        onSuccess?.()
      } else {
        toast({ title: t('sr.admin.zatca.error_title'), description: result.error || t('sr.admin.zatca.unknown_error'), variant: 'destructive' })
      }
    } catch (e: any) {
      toast({ title: t('sr.admin.common.error_title'), description: e.message || t('sr.admin.zatca.resubmit_failed'), variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      className={cn('h-7 w-7 p-0', className)}
      onClick={handleResubmit}
      disabled={loading}
      title={t('sr.admin.zatca.resubmit_tooltip')}
    >
      {loading
        ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
        : <RotateCcw className="h-3.5 w-3.5 text-blue-600" />}
    </Button>
  )
}

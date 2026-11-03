'use client'

// Shareable deep-link button for the rentals-native vertical. Mirrors the UX of
// components/store/share-button.tsx (copy link + WhatsApp + the «تم نسخ الرابط ✅»
// success toast) but takes an EXPLICIT url instead of window.location.href, so a
// caller can encode a specific module/record target (section / type / key). Uses
// the egarsys-scoped Button + the shadcn DropdownMenu (theme/RTL aware) and sonner
// for the toast, matching the rest of the rentals sections.

import * as React from 'react'
import { Share2, Link2, MessageCircle } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from './button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from './dropdown-menu'

/**
 * Build a rentals-native deep link from the current origin.
 * - `section` alone → opens that module (e.g. `/rentals-native?section=contracts`).
 * - `section` + `type` + `key` → also opens that record's detail dialog via the
 *   section's pendingFocus consumer (the `key` MUST match what the consumer looks
 *   up: contract=internalId, property=propertyId, invoice=digits-only number,
 *   tenant=tenant id). URLSearchParams handles all encoding.
 */
export function buildRentalsLink(section: string, type?: string, key?: string): string {
  const origin = typeof window !== 'undefined' ? window.location.origin : ''
  const params = new URLSearchParams({ section })
  if (type && key) {
    params.set('type', type)
    params.set('key', key)
  }
  return `${origin}/rentals-native?${params.toString()}`
}

interface ShareLinkButtonProps {
  /** The exact URL to copy / share. Build it with buildRentalsLink(...). */
  url: string
  /** Visible trigger label (empty → icon-only). */
  label?: string
  /** WhatsApp message prefix / accessible title. */
  title?: string
  size?: 'default' | 'sm' | 'lg' | 'icon'
  variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link'
  className?: string
}

export function ShareLinkButton({
  url,
  label = 'مشاركة',
  title = 'مشاركة رابط مباشر لهذه الصفحة',
  size = 'sm',
  variant = 'outline',
  className,
}: ShareLinkButtonProps) {
  const waHref = `https://wa.me/?text=${encodeURIComponent(`${title}\n${url}`)}`

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url)
      toast.success('تم نسخ الرابط ✅')
    } catch {
      toast.error('تعذّر النسخ')
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button type="button" variant={variant} size={size} className={className} title={title}>
          <Share2 className="h-4 w-4" />
          {label ? <span>{label}</span> : null}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuItem onClick={copy} className="gap-2">
          <Link2 className="h-4 w-4 text-emerald-600" />
          نسخ الرابط
        </DropdownMenuItem>
        <DropdownMenuItem asChild className="gap-2">
          <a href={waHref} target="_blank" rel="noopener noreferrer">
            <MessageCircle className="h-4 w-4 text-[#1FA855]" />
            مشاركة عبر واتساب
          </a>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export default ShareLinkButton

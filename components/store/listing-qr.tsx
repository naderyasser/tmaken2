'use client'

import { QRCodeSVG } from 'qrcode.react'

/** REGA verification QR — encodes the ad's verification URL (rega_qr_payload). */
export default function ListingQR({ value, size = 110 }: { value: string; size?: number }) {
  if (!value) return null
  return (
    <div className="rounded-xl bg-white p-2" style={{ display: 'inline-block' }}>
      <QRCodeSVG value={value} size={size} level="M" bgColor="#ffffff" fgColor="#3A2A21" />
    </div>
  )
}

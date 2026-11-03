"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import { Camera, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

interface BarcodeScannerProps {
  onScan: (barcode: string) => void
}

export function BarcodeScanner({ onScan }: BarcodeScannerProps) {
  const [open, setOpen] = useState(false)
  const [error, setError] = useState("")
  const scannerRef = useRef<HTMLDivElement>(null)
  const html5QrRef = useRef<import("html5-qrcode").Html5Qrcode | null>(null)
  const scannedRef = useRef(false)

  const stopScanner = useCallback(async () => {
    try {
      if (html5QrRef.current?.isScanning) {
        await html5QrRef.current.stop()
      }
      html5QrRef.current?.clear()
    } catch {
      // ignore cleanup errors
    }
    html5QrRef.current = null
  }, [])

  useEffect(() => {
    if (!open) return
    scannedRef.current = false
    setError("")

    let cancelled = false

    const startScanner = async () => {
      // Dynamic import to avoid SSR issues
      const { Html5Qrcode } = await import("html5-qrcode")
      if (cancelled) return

      const scanner = new Html5Qrcode("barcode-reader")
      html5QrRef.current = scanner

      try {
        await scanner.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: { width: 250, height: 150 } },
          (decodedText) => {
            if (scannedRef.current) return
            scannedRef.current = true
            onScan(decodedText)
            setOpen(false)
          },
          () => {
            // Ignore scan failures (no barcode in frame)
          }
        )
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : "Camera access denied. Please allow camera permissions."
          )
        }
      }
    }

    startScanner()

    return () => {
      cancelled = true
      stopScanner()
    }
  }, [open, onScan, stopScanner])

  const handleClose = async () => {
    await stopScanner()
    setOpen(false)
  }

  return (
    <>
      <Button
        variant="outline"
        size="icon"
        className="h-10 w-10 shrink-0"
        onClick={() => setOpen(true)}
        title="Scan Barcode"
      >
        <Camera className="h-4 w-4" />
      </Button>

      <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose() }}>
        <DialogContent className="sm:max-w-md p-0 overflow-hidden">
          <DialogHeader className="px-4 pt-4 pb-2">
            <DialogTitle className="flex items-center gap-2">
              <Camera className="h-5 w-5" />
              Scan Barcode
            </DialogTitle>
          </DialogHeader>
          <div className="px-4 pb-4">
            {error ? (
              <div className="bg-red-50 text-red-600 text-sm p-3 rounded-lg text-center">
                {error}
              </div>
            ) : (
              <div
                id="barcode-reader"
                ref={scannerRef}
                className="w-full rounded-lg overflow-hidden"
              />
            )}
            <Button
              variant="outline"
              className="w-full mt-3"
              onClick={handleClose}
            >
              <X className="h-4 w-4 mr-2" /> Cancel
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}

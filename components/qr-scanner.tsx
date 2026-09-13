"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { Camera, CameraOff, Keyboard, ScanLine } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useI18n } from "@/lib/i18n"

interface QrScannerProps {
    onScan: (value: string) => void
    placeholder?: string
    autoFocus?: boolean
    disabled?: boolean
}

let _audioCtx: AudioContext | null = null
function getAudioCtx(): AudioContext | null {
    try {
        if (!_audioCtx || _audioCtx.state === "closed") {
            _audioCtx = new AudioContext()
        }
        return _audioCtx
    } catch {
        return null
    }
}

function beep() {
    try {
        const ctx = getAudioCtx()
        if (!ctx) return
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.type = "sine"
        osc.frequency.value = 1200
        gain.gain.value = 0.3
        osc.connect(gain)
        gain.connect(ctx.destination)
        osc.start()
        osc.stop(ctx.currentTime + 0.1)
    } catch {
        /* no audio support */
    }
}

export function QrScanner({
    onScan,
    placeholder,
    autoFocus = true,
    disabled = false,
}: QrScannerProps) {
    const { isRTL } = useI18n()
    const [mode, setMode] = useState<"input" | "camera">("input")
    const [inputValue, setInputValue] = useState("")
    const [cameraError, setCameraError] = useState<string | null>(null)
    const inputRef = useRef<HTMLInputElement>(null)
    const html5QrCodeRef = useRef<any>(null)

    const defaultPlaceholder = isRTL
        ? "امسح الباركود أو اكتب الكود..."
        : "Scan barcode or type code..."

    // Auto-focus input on mount and when switching back to input mode
    useEffect(() => {
        if (autoFocus && mode === "input") {
            setTimeout(() => inputRef.current?.focus(), 100)
        }
    }, [autoFocus, mode])

    // Handle keyboard input — external scanners type fast then press Enter
    const handleKeyDown = useCallback(
        (e: React.KeyboardEvent<HTMLInputElement>) => {
            if (e.key === "Enter" && inputValue.trim()) {
                e.preventDefault()
                onScan(inputValue.trim())
                setInputValue("")
            }
        },
        [inputValue, onScan]
    )

    // Start camera scanning
    const startCamera = useCallback(async () => {
        setCameraError(null)
        setMode("camera")

        try {
            const { Html5Qrcode } = await import("html5-qrcode")

            // Small delay to let the DOM render the container
            await new Promise((r) => setTimeout(r, 200))

            const scannerId = "qr-scanner-region"
            const el = document.getElementById(scannerId)
            if (!el) return

            const scanner = new Html5Qrcode(scannerId)
            html5QrCodeRef.current = scanner

            await scanner.start(
                { facingMode: "environment" },
                {
                    fps: 10,
                    qrbox: { width: 250, height: 250 },
                    aspectRatio: 1,
                },
                (decodedText: string) => {
                    onScan(decodedText.trim())
                    beep()
                },
                () => {
                    /* ignore continuous scan failures */
                }
            )
        } catch (err: any) {
            console.error("Camera error:", err)
            setCameraError(
                err?.message ||
                (isRTL ? "لا يمكن فتح الكاميرا" : "Cannot open camera")
            )
            setMode("input")
        }
    }, [onScan, isRTL])

    // Stop camera
    const stopCamera = useCallback(async () => {
        try {
            if (html5QrCodeRef.current) {
                await html5QrCodeRef.current.stop()
                html5QrCodeRef.current.clear()
                html5QrCodeRef.current = null
            }
        } catch {
            /* ignore */
        }
        setMode("input")
    }, [])

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (html5QrCodeRef.current) {
                html5QrCodeRef.current.stop().catch(() => { })
                html5QrCodeRef.current.clear()
                html5QrCodeRef.current = null
            }
        }
    }, [])

    return (
        <div className="space-y-3">
            {mode === "input" ? (
                <div className="flex gap-2">
                    <div className="relative flex-1">
                        <ScanLine className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                        <Input
                            ref={inputRef}
                            value={inputValue}
                            onChange={(e) => setInputValue(e.target.value)}
                            onKeyDown={handleKeyDown}
                            placeholder={placeholder ?? defaultPlaceholder}
                            disabled={disabled}
                            className="pr-10 h-12 text-lg font-mono"
                            dir="ltr"
                        />
                    </div>
                    <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="h-12 w-12 shrink-0"
                        onClick={startCamera}
                        disabled={disabled}
                        title={isRTL ? "مسح بالكاميرا" : "Scan with camera"}
                    >
                        <Camera className="h-5 w-5" />
                    </Button>
                </div>
            ) : (
                <div className="space-y-2">
                    <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-gray-700 flex items-center gap-2">
                            <Camera className="h-4 w-4 text-blue-600" />
                            {isRTL
                                ? "الكاميرا مفتوحة — وجه الكاميرا نحو الباركود"
                                : "Camera open — point at barcode"}
                        </span>
                        <div className="flex gap-2">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={stopCamera}
                                className="gap-1.5"
                            >
                                <Keyboard className="h-3.5 w-3.5" />
                                {isRTL ? "إدخال يدوي" : "Manual input"}
                            </Button>
                            <Button
                                variant="destructive"
                                size="sm"
                                onClick={stopCamera}
                                className="gap-1.5"
                            >
                                <CameraOff className="h-3.5 w-3.5" />
                                {isRTL ? "إغلاق" : "Close"}
                            </Button>
                        </div>
                    </div>
                    <div className="rounded-xl overflow-hidden border-2 border-blue-200 bg-black">
                        <div id="qr-scanner-region" style={{ width: "100%" }} />
                    </div>
                    {cameraError && (
                        <p className="text-sm text-red-500">{cameraError}</p>
                    )}
                </div>
            )}
        </div>
    )
}

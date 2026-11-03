'use client'

import { useState, useRef, useEffect } from 'react'
import { Camera, RotateCcw, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'

interface CameraCaptureProps {
    onCapture: (photoData: string) => void
    onClose?: () => void
}

export function CameraCapture({ onCapture, onClose }: CameraCaptureProps) {
    const [isCameraActive, setIsCameraActive] = useState(false)
    const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null)
    const [error, setError] = useState<string | null>(null)
    const videoRef = useRef<HTMLVideoElement>(null)
    const streamRef = useRef<MediaStream | null>(null)

    useEffect(() => {
        startCamera()
        return () => {
            stopCamera()
        }
    }, [])

    const startCamera = async () => {
        try {
            setError(null)
            const stream = await navigator.mediaDevices.getUserMedia({
                video: {
                    facingMode: 'user', // Front camera for selfie
                    width: { ideal: 1280 },
                    height: { ideal: 720 }
                }
            })

            if (videoRef.current) {
                videoRef.current.srcObject = stream
                streamRef.current = stream
                setIsCameraActive(true)
            }
        } catch (err) {
            console.error('Camera error:', err)
            let errorMessage = 'Unable to access camera'
            
            if (err instanceof Error) {
                if (err.name === 'NotAllowedError') {
                    errorMessage = 'Camera permission denied. Please allow camera access in browser settings.'
                } else if (err.name === 'NotFoundError') {
                    errorMessage = 'No camera found on this device.'
                } else if (err.name === 'NotReadableError') {
                    errorMessage = 'Camera is already in use by another application.'
                }
            }
            
            setError(errorMessage)
        }
    }

    const stopCamera = () => {
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop())
            streamRef.current = null
        }
        setIsCameraActive(false)
    }

    const capturePhoto = () => {
        if (!videoRef.current) return

        const canvas = document.createElement('canvas')
        canvas.width = videoRef.current.videoWidth
        canvas.height = videoRef.current.videoHeight

        const ctx = canvas.getContext('2d')
        if (!ctx) return

        ctx.drawImage(videoRef.current, 0, 0)

        // Convert to base64 JPEG
        const photoData = canvas.toDataURL('image/jpeg', 0.8)
        setCapturedPhoto(photoData)
        stopCamera()
    }

    const retakePhoto = () => {
        setCapturedPhoto(null)
        startCamera()
    }

    const confirmPhoto = () => {
        if (capturedPhoto) {
            onCapture(capturedPhoto)
        }
    }

    return (
        <Card className="p-6 max-w-2xl mx-auto">
            <div className="space-y-4">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Camera className="h-5 w-5 text-blue-600" />
                        <h3 className="text-lg font-semibold">Take Photo for Check-in</h3>
                    </div>
                    {onClose && (
                        <Button variant="ghost" size="icon" onClick={onClose}>
                            <X className="h-5 w-5" />
                        </Button>
                    )}
                </div>

                {/* Error Message */}
                {error && (
                    <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
                        <p className="text-sm">{error}</p>
                    </div>
                )}

                {/* Camera/Photo Preview */}
                <div className="relative bg-gray-900 rounded-lg overflow-hidden">
                    {!capturedPhoto ? (
                        <video
                            ref={videoRef}
                            autoPlay
                            playsInline
                            muted
                            className="w-full h-auto max-h-96 object-cover"
                        />
                    ) : (
                        <img
                            src={capturedPhoto}
                            alt="Captured"
                            className="w-full h-auto max-h-96 object-cover"
                        />
                    )}

                    {!isCameraActive && !capturedPhoto && !error && (
                        <div className="absolute inset-0 flex items-center justify-center bg-gray-800">
                            <p className="text-white">Starting camera...</p>
                        </div>
                    )}
                </div>

                {/* Action Buttons */}
                <div className="flex gap-2 justify-center">
                    {!capturedPhoto ? (
                        <Button
                            onClick={capturePhoto}
                            disabled={!isCameraActive}
                            size="lg"
                            className="min-w-40"
                        >
                            <Camera className="h-5 w-5 mr-2" />
                            Capture Photo
                        </Button>
                    ) : (
                        <>
                            <Button
                                onClick={retakePhoto}
                                variant="outline"
                                size="lg"
                            >
                                <RotateCcw className="h-5 w-5 mr-2" />
                                Retake
                            </Button>
                            <Button
                                onClick={confirmPhoto}
                                size="lg"
                                className="min-w-40"
                            >
                                ✓ Use This Photo
                            </Button>
                        </>
                    )}
                </div>

                {/* Instructions */}
                <div className="text-center text-sm text-gray-600">
                    <p>📸 Make sure your face is clearly visible</p>
                    <p className="text-xs text-gray-500 mt-1">
                        This photo will be used for attendance verification
                    </p>
                </div>
            </div>
        </Card>
    )
}

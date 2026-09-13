'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useI18n } from '@/lib/i18n'
import {
    Fingerprint,
    Camera,
    MonitorSmartphone,
    ChevronRight,
    RotateCcw,
    Loader2,
    CheckCircle2,
    XCircle,
    AlertCircle,
    Scan,
    Eye,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { frappeClient } from '@/lib/api-client'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface AllowedMethods {
    face_recognition: boolean
    webauthn: boolean
    adms: boolean
}

interface CheckinMethodSettings {
    checkin_method: string
    require_photo: boolean
    require_biometric: boolean
    require_liveness_check: boolean
    source: 'employee' | 'branch' | 'default'
    branch: string | null
    allowed_biometric_methods: AllowedMethods
    geofence: object | null
    adms_device_serials: string[]
    /** Employee is exempt from face biometric (see hrms.api.face_exemption). */
    face_exempt?: boolean
    /** Face was her only biometric option, so require_biometric was forced off. */
    face_exemption_waived_biometric?: boolean
}

interface BiometricPromptProps {
    employee: string
    onVerified: (verified: boolean, type?: 'webauthn' | 'face_recognition' | 'adms') => void
    /** Optional override — skip the settings fetch and use these allowed methods directly */
    allowedMethods?: Partial<AllowedMethods>
}

type ActiveMethod = 'webauthn' | 'face_recognition' | 'adms' | null
type Status = 'loading_settings' | 'choosing' | 'idle' | 'running' | 'success' | 'error'

// ---------------------------------------------------------------------------
// Face-api dynamic loader
// ---------------------------------------------------------------------------

const FACE_API_CDN = 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api/dist/face-api.js'
const FACE_API_MODELS = 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model'

declare global {
    interface Window { faceapi?: any }
}

async function loadFaceApi(): Promise<any> {
    if (window.faceapi) return window.faceapi

    await new Promise<void>((resolve, reject) => {
        const script = document.createElement('script')
        script.src = FACE_API_CDN
        script.onload = () => resolve()
        script.onerror = () => reject(new Error('Failed to load face-api.js'))
        document.head.appendChild(script)
    })

    const api = window.faceapi
    if (!api) throw new Error('face-api.js did not register on window.faceapi')

    await Promise.all([
        api.nets.tinyFaceDetector.loadFromUri(FACE_API_MODELS),
        api.nets.faceLandmark68Net.loadFromUri(FACE_API_MODELS),
        api.nets.faceRecognitionNet.loadFromUri(FACE_API_MODELS),
    ])

    return api
}

async function computeDescriptorFromDataUrl(api: any, dataUrl: string): Promise<Float32Array | null> {
    return new Promise((resolve) => {
        const img = new Image()
        img.onload = async () => {
            try {
                const detection = await api
                    .detectSingleFace(img, new api.TinyFaceDetectorOptions())
                    .withFaceLandmarks()
                    .withFaceDescriptor()
                resolve(detection ? detection.descriptor : null)
            } catch {
                resolve(null)
            }
        }
        img.src = dataUrl
    })
}

// ---------------------------------------------------------------------------
// WebAuthn helpers
// ---------------------------------------------------------------------------

function b64urlToUint8(s: string): Uint8Array {
    const std = s.replace(/-/g, '+').replace(/_/g, '/')
    const pad = std.padEnd(std.length + (4 - (std.length % 4)) % 4, '=')
    return Uint8Array.from(atob(pad), (c) => c.charCodeAt(0))
}

function bufToB64url(buf: ArrayBuffer): string {
    return btoa(String.fromCharCode(...new Uint8Array(buf)))
        .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
}

// ---------------------------------------------------------------------------
// Liveness detection helpers
// ---------------------------------------------------------------------------

const LIVENESS_ACTIONS = ['blink', 'turn_left', 'turn_right', 'smile'] as const
type LivenessAction = typeof LIVENESS_ACTIONS[number]
const LIVENESS_TIMEOUT_MS = 10_000

const LIVENESS_INSTRUCTIONS: Record<LivenessAction, string> = {
    blink: 'Blink your eyes',
    turn_left: 'Turn your head to the left',
    turn_right: 'Turn your head to the right',
    smile: 'Smile widely',
}

function _eyeAspectRatio(eyePoints: { x: number; y: number }[]): number {
    // Eye Aspect Ratio (EAR) — vertical distances / horizontal distance
    const p1 = eyePoints[1], p2 = eyePoints[2], p3 = eyePoints[3], p4 = eyePoints[4], p5 = eyePoints[5]
    const p0 = eyePoints[0]
    const vertA = Math.sqrt((p1.x - p5.x) ** 2 + (p1.y - p5.y) ** 2)
    const vertB = Math.sqrt((p2.x - p4.x) ** 2 + (p2.y - p4.y) ** 2)
    const horiz = Math.sqrt((p0.x - p3.x) ** 2 + (p0.y - p3.y) ** 2)
    return horiz > 0 ? (vertA + vertB) / (2.0 * horiz) : 1
}

function _detectBlink(landmarks: any, blinkFrameCount: { current: number }): boolean {
    const leftEye = landmarks.getLeftEye()
    const rightEye = landmarks.getRightEye()
    const earLeft = _eyeAspectRatio(leftEye)
    const earRight = _eyeAspectRatio(rightEye)
    const ear = (earLeft + earRight) / 2.0
    if (ear < 0.21) {
        blinkFrameCount.current++
        return blinkFrameCount.current >= 2
    }
    blinkFrameCount.current = 0
    return false
}

function _detectHeadTurn(landmarks: any, direction: 'left' | 'right'): boolean {
    const nose = landmarks.getNose()
    const jaw = landmarks.getJawOutline()
    const noseX = nose[0].x
    const jawLeft = jaw[0].x
    const jawRight = jaw[jaw.length - 1].x
    const jawWidth = jawRight - jawLeft
    if (jawWidth <= 0) return false
    const relativePos = (noseX - jawLeft) / jawWidth
    return direction === 'left' ? relativePos > 0.62 : relativePos < 0.38
}

function _detectSmile(landmarks: any): boolean {
    const mouth = landmarks.getMouth()
    const leftCorner = mouth[0]
    const rightCorner = mouth[6]
    const topLip = mouth[14] || mouth[13]
    const bottomLip = mouth[18] || mouth[17]
    const width = Math.sqrt((rightCorner.x - leftCorner.x) ** 2 + (rightCorner.y - leftCorner.y) ** 2)
    const height = Math.sqrt((bottomLip.x - topLip.x) ** 2 + (bottomLip.y - topLip.y) ** 2)
    return height > 0 ? (width / height) > 3.0 : false
}

// ---------------------------------------------------------------------------
// Method selection button
// ---------------------------------------------------------------------------

function MethodButton({
    icon,
    label,
    description,
    onClick,
    disabled,
}: {
    icon: React.ReactNode
    label: string
    description: string
    onClick: () => void
    disabled?: boolean
}) {
    return (
        <button
            onClick={onClick}
            disabled={disabled}
            className={[
                'w-full flex items-center gap-4 p-4 rounded-xl border-2 text-left transition-all',
                disabled
                    ? 'opacity-40 cursor-not-allowed border-gray-200 bg-gray-50'
                    : 'border-gray-200 hover:border-blue-400 hover:bg-blue-50 active:scale-[0.99] cursor-pointer',
            ].join(' ')}
        >
            <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center flex-shrink-0 text-blue-600">
                {icon}
            </div>
            <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm text-gray-900">{label}</p>
                <p className="text-xs text-gray-500 mt-0.5">{description}</p>
            </div>
            <ChevronRight className="h-4 w-4 text-gray-400 flex-shrink-0" />
        </button>
    )
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function BiometricPrompt({ employee, onVerified, allowedMethods }: BiometricPromptProps) {
    const { t } = useI18n()
    const [status, setStatus] = useState<Status>('loading_settings')
    const [settings, setSettings] = useState<CheckinMethodSettings | null>(null)
    const [activeMethod, setActiveMethod] = useState<ActiveMethod>(null)
    const [errorMsg, setErrorMsg] = useState('')
    const [statusMsg, setStatusMsg] = useState('')

    // Face recognition
    const [showCamera, setShowCamera] = useState(false)
    const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null)
    const videoRef = useRef<HTMLVideoElement>(null)
    const streamRef = useRef<MediaStream | null>(null)

    // Liveness detection
    const [livenessActive, setLivenessActive] = useState(false)
    const [livenessPassed, setLivenessPassed] = useState(false)
    const [livenessAction, setLivenessAction] = useState<LivenessAction | null>(null)
    const [livenessCountdown, setLivenessCountdown] = useState(0)
    const livenessTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
    const livenessDetectRef = useRef<ReturnType<typeof setInterval> | null>(null)
    const blinkFrameCountRef = useRef(0)
    const faceApiRef = useRef<any>(null)

    const requireLiveness = settings?.require_liveness_check ?? true

    // ---------------------------------------------------------------------------
    // Load branch settings
    // ---------------------------------------------------------------------------
    useEffect(() => {
        if (!employee) {
            setStatus('idle')
            return
        }
        if (allowedMethods) {
            // Caller provided overrides — skip API call
            setSettings({
                checkin_method: 'Biometric',
                require_photo: false,
                require_biometric: true,
                require_liveness_check: true,
                source: 'default',
                branch: null,
                allowed_biometric_methods: {
                    face_recognition: allowedMethods.face_recognition ?? true,
                    webauthn: allowedMethods.webauthn ?? true,
                    adms: allowedMethods.adms ?? false,
                },
                geofence: null,
                adms_device_serials: [],
            })
            setStatus('choosing')
            return
        }

        let cancelled = false
        frappeClient
            .call<CheckinMethodSettings>(
                'hrms.hr.doctype.employee_location_settings.checkin_method_api.get_checkin_method',
                { employee }
            )
            .then((resp) => {
                if (cancelled) return
                const data = (resp.message || resp.data) as CheckinMethodSettings
                setSettings(data)
                setStatus('choosing')
            })
            .catch(() => {
                if (cancelled) return
                // Fall back to all-software methods enabled
                setSettings({
                    checkin_method: 'Biometric',
                    require_photo: false,
                    require_biometric: true,
                    require_liveness_check: true,
                    source: 'default',
                    branch: null,
                    allowed_biometric_methods: { face_recognition: true, webauthn: true, adms: false },
                    geofence: null,
                    adms_device_serials: [],
                })
                setStatus('choosing')
            })
        return () => { cancelled = true }
    }, [employee, allowedMethods])

    // ---------------------------------------------------------------------------
    // Camera helpers
    // ---------------------------------------------------------------------------
    const startCamera = useCallback(async () => {
        setErrorMsg('')
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
            })
            streamRef.current = stream
            if (videoRef.current) {
                videoRef.current.srcObject = stream
            }
        } catch (err: any) {
            const msg = err.name === 'NotAllowedError'
                ? 'Camera permission denied.'
                : err.name === 'NotFoundError'
                    ? 'No camera found on this device.'
                    : 'Could not access the camera.'
            setErrorMsg(msg)
            setStatus('error')
        }
    }, [])

    const stopCamera = useCallback(() => {
        streamRef.current?.getTracks().forEach((t) => t.stop())
        streamRef.current = null
    }, [])

    // ---------------------------------------------------------------------------
    // Liveness challenge
    // ---------------------------------------------------------------------------
    const stopLivenessChallenge = useCallback(() => {
        if (livenessTimerRef.current) { clearInterval(livenessTimerRef.current); livenessTimerRef.current = null }
        if (livenessDetectRef.current) { clearInterval(livenessDetectRef.current); livenessDetectRef.current = null }
        blinkFrameCountRef.current = 0
    }, [])

    const startLivenessChallenge = useCallback(async () => {
        stopLivenessChallenge()

        // Load face-api if not loaded yet
        if (!faceApiRef.current) {
            setStatusMsg('Loading face models for liveness…')
            faceApiRef.current = await loadFaceApi()
            setStatusMsg('')
        }

        // Pick a random action
        const action = LIVENESS_ACTIONS[Math.floor(Math.random() * LIVENESS_ACTIONS.length)]
        setLivenessAction(action)
        setLivenessActive(true)
        setLivenessPassed(false)
        blinkFrameCountRef.current = 0

        // Countdown timer
        let remaining = LIVENESS_TIMEOUT_MS / 1000
        setLivenessCountdown(remaining)
        livenessTimerRef.current = setInterval(() => {
            remaining--
            setLivenessCountdown(remaining)
            if (remaining <= 0) {
                // Timeout — restart with new random action
                stopLivenessChallenge()
                startLivenessChallenge()
            }
        }, 1000)

        // Detection loop — check every 200ms on live video
        const api = faceApiRef.current
        livenessDetectRef.current = setInterval(async () => {
            const video = videoRef.current
            if (!video || video.readyState < 2) return

            try {
                const detection = await api
                    .detectSingleFace(video, new api.TinyFaceDetectorOptions({ inputSize: 224, scoreThreshold: 0.55 }))
                    .withFaceLandmarks()
                if (!detection) return

                const lm = detection.landmarks
                let passed = false

                if (action === 'blink') passed = _detectBlink(lm, blinkFrameCountRef)
                else if (action === 'turn_left') passed = _detectHeadTurn(lm, 'left')
                else if (action === 'turn_right') passed = _detectHeadTurn(lm, 'right')
                else if (action === 'smile') passed = _detectSmile(lm)

                if (passed) {
                    stopLivenessChallenge()
                    setLivenessActive(false)
                    setLivenessPassed(true)
                }
            } catch {
                // Detection error — skip this frame
            }
        }, 200)
    }, [stopLivenessChallenge])

    // Clean up liveness on unmount
    useEffect(() => () => stopLivenessChallenge(), [stopLivenessChallenge])

    const captureFrame = useCallback((): string | null => {
        const video = videoRef.current
        if (!video) return null
        const canvas = document.createElement('canvas')
        canvas.width = video.videoWidth
        canvas.height = video.videoHeight
        canvas.getContext('2d')?.drawImage(video, 0, 0)
        return canvas.toDataURL('image/jpeg', 0.9)
    }, [])

    // Clean up camera on unmount
    useEffect(() => () => stopCamera(), [stopCamera])

    // ---------------------------------------------------------------------------
    // WebAuthn flow
    // ---------------------------------------------------------------------------
    const runWebAuthn = useCallback(async () => {
        setActiveMethod('webauthn')
        setStatus('running')
        setErrorMsg('')
        setStatusMsg('Requesting challenge from server…')

        try {
            const challengeResp = await frappeClient.call<{
                challenge: string
                credential_id: string | null
                has_credential: boolean
            }>('hrms.api.webauthn_api.get_challenge', { employee })
            const { challenge, credential_id, has_credential } =
                (challengeResp.message || challengeResp.data) as {
                    challenge: string; credential_id: string | null; has_credential: boolean
                }

            if (has_credential && credential_id) {
                // ── Authentication (existing credential) ──────────────────────
                setStatusMsg('Touch your fingerprint sensor or Face ID…')
                const assertion = await navigator.credentials.get({
                    publicKey: {
                        challenge: b64urlToUint8(challenge),
                        allowCredentials: [{ type: 'public-key', id: b64urlToUint8(credential_id) }],
                        userVerification: 'preferred',
                        timeout: 60000,
                    },
                }) as PublicKeyCredential
                const resp = assertion.response as AuthenticatorAssertionResponse

                setStatusMsg('Verifying signature…')
                const verifyResp = await frappeClient.call<{ success: boolean; verified: boolean }>(
                    'hrms.api.webauthn_api.verify_credential',
                    {
                        employee,
                        credential_id: bufToB64url(assertion.rawId),
                        client_data_json: bufToB64url(resp.clientDataJSON),
                        authenticator_data: bufToB64url(resp.authenticatorData),
                        signature: bufToB64url(resp.signature),
                    }
                )
                const result = (verifyResp.message || verifyResp.data) as { success: boolean; verified: boolean; blocked?: boolean; retry_after_minutes?: number }

                if (result.blocked) {
                    setErrorMsg(`Too many failed attempts. Please try again in ${result.retry_after_minutes} minutes.`)
                    setStatus('error')
                    setStatusMsg('')
                    return
                }
                if (!result?.success) throw new Error('Server rejected the verification')

            } else {
                // ── Registration (new device / no credential yet) ─────────────
                setStatusMsg('No credential found — registering this device…')
                const creation = await navigator.credentials.create({
                    publicKey: {
                        challenge: b64urlToUint8(challenge),
                        rp: { name: 'Meena HR', id: window.location.hostname },
                        user: {
                            id: new TextEncoder().encode(employee),
                            name: employee,
                            displayName: employee,
                        },
                        pubKeyCredParams: [{ alg: -7, type: 'public-key' }],
                        authenticatorSelection: {
                            userVerification: 'preferred',
                            requireResidentKey: false,
                        },
                        timeout: 60000,
                    },
                }) as PublicKeyCredential
                const attResp = creation.response as AuthenticatorAttestationResponse

                const publicKeyDer = attResp.getPublicKey()
                if (!publicKeyDer) throw new Error('Could not extract public key from authenticator')

                setStatusMsg('Saving credential…')
                await frappeClient.call(
                    'hrms.api.webauthn_api.save_credential',
                    {
                        employee,
                        credential_id: bufToB64url(creation.rawId),
                        public_key: bufToB64url(publicKeyDer),
                        client_data_json: bufToB64url(attResp.clientDataJSON),
                    }
                )
            }

            setStatus('success')
            setStatusMsg('')
            onVerified(true, 'webauthn')

        } catch (err: any) {
            const msg = err.name === 'NotAllowedError'
                ? 'Biometric prompt was dismissed or timed out.'
                : err.name === 'InvalidStateError'
                    ? 'This authenticator is already registered. Try verifying instead.'
                    : err.message || 'WebAuthn verification failed.'
            setErrorMsg(msg)
            setStatus('error')
            setStatusMsg('')
        }
    }, [employee, onVerified])

    // ---------------------------------------------------------------------------
    // Face recognition flow
    // ---------------------------------------------------------------------------
    const startFaceCapture = useCallback(async () => {
        setActiveMethod('face_recognition')
        setStatus('running')
        setErrorMsg('')
        setShowCamera(true)
        setCapturedPhoto(null)
        setLivenessPassed(false)
        setLivenessActive(false)
        setLivenessAction(null)
        await startCamera()
        // If liveness is required, start challenge immediately once camera is running
        if (requireLiveness) {
            // Small delay to let video stream start
            setTimeout(() => startLivenessChallenge(), 500)
        }
    }, [startCamera, requireLiveness, startLivenessChallenge])

    const handleCapture = useCallback(async () => {
        // Liveness gate — if required but not passed, don't allow capture
        if (requireLiveness && !livenessPassed) {
            return
        }

        const photo = captureFrame()
        if (!photo) {
            setErrorMsg('Could not capture image.')
            setStatus('error')
            return
        }
        stopCamera()
        stopLivenessChallenge()
        setShowCamera(false)
        setCapturedPhoto(photo)
        setStatusMsg('Loading face recognition models…')

        try {
            const api = faceApiRef.current || await loadFaceApi()
            faceApiRef.current = api
            setStatusMsg('Detecting face in captured image…')

            const descriptor = await computeDescriptorFromDataUrl(api, photo)
            if (!descriptor) {
                setErrorMsg('No face detected. Please try again with better lighting.')
                setStatus('error')
                setStatusMsg('')
                return
            }

            // Check if employee has a registered face
            setStatusMsg('Checking face registration…')
            const storedResp = await frappeClient.call<{ has_face_registered: boolean }>(
                'hrms.api.face_recognition_api.get_face_descriptor',
                { employee }
            )
            const stored = (storedResp.message || storedResp.data) as { has_face_registered: boolean }

            if (!stored?.has_face_registered) {
                // Register new face
                setStatusMsg('No face registered — saving this as your face…')
                await frappeClient.call(
                    'hrms.api.face_recognition_api.save_face_descriptor',
                    { employee, face_descriptor: JSON.stringify(Array.from(descriptor)) }
                )
                setStatus('success')
                setStatusMsg('')
                onVerified(true, 'face_recognition')
                return
            }

            // Verify face server-side (descriptor never stored client-side)
            setStatusMsg('Verifying face on server…')
            const verifyResp = await frappeClient.call<{
                match?: boolean
                distance?: number
                blocked?: boolean
                retry_after_minutes?: number
            }>(
                'hrms.api.face_recognition_api.verify_face',
                {
                    employee,
                    face_descriptor: JSON.stringify(Array.from(descriptor)),
                    liveness_passed: livenessPassed ? 1 : 0,
                }
            )
            const result = (verifyResp.message || verifyResp.data) as {
                match?: boolean; distance?: number; blocked?: boolean; retry_after_minutes?: number
            }

            if (result.blocked) {
                setErrorMsg(`Too many failed attempts. Please try again in ${result.retry_after_minutes} minutes.`)
                setStatus('error')
                setStatusMsg('')
                return
            }

            if (result.match) {
                setStatus('success')
                setStatusMsg('')
                onVerified(true, 'face_recognition')
            } else {
                setErrorMsg(`Face did not match (distance ${result.distance?.toFixed(3)}). Please try again.`)
                setStatus('error')
                setStatusMsg('')
            }

        } catch (err: any) {
            setErrorMsg(err.message || 'Face recognition failed.')
            setStatus('error')
            setStatusMsg('')
        }
    }, [captureFrame, stopCamera, stopLivenessChallenge, employee, onVerified, requireLiveness, livenessPassed])

    const retryFace = useCallback(() => {
        setCapturedPhoto(null)
        setStatus('running')
        setErrorMsg('')
        setShowCamera(true)
        setLivenessPassed(false)
        setLivenessActive(false)
        setLivenessAction(null)
        startCamera().then(() => {
            if (requireLiveness) {
                setTimeout(() => startLivenessChallenge(), 500)
            }
        })
    }, [startCamera, requireLiveness, startLivenessChallenge])

    // ---------------------------------------------------------------------------
    // ADMS
    // ---------------------------------------------------------------------------
    const handleAdmsSelect = useCallback(() => {
        setActiveMethod('adms')
    }, [])

    // ---------------------------------------------------------------------------
    // Derived state
    // ---------------------------------------------------------------------------
    const allowed = settings?.allowed_biometric_methods
    const availableMethods = allowed
        ? [
            allowed.face_recognition && 'face_recognition',
            allowed.webauthn && 'webauthn',
            allowed.adms && 'adms',
        ].filter(Boolean) as ('face_recognition' | 'webauthn' | 'adms')[]
        : []

    const multipleAvailable = availableMethods.length > 1

    // Auto-start if only one method and the user has chosen it (or only one exists)
    useEffect(() => {
        if (status !== 'choosing') return
        if (availableMethods.length === 1 && !multipleAvailable) {
            const only = availableMethods[0]
            if (only === 'webauthn') runWebAuthn()
            else if (only === 'face_recognition') startFaceCapture()
            else if (only === 'adms') setActiveMethod('adms')
        }
    }, [status, availableMethods.length, multipleAvailable]) // eslint-disable-line react-hooks/exhaustive-deps

    // ---------------------------------------------------------------------------
    // Render
    // ---------------------------------------------------------------------------

    // Loading settings
    if (status === 'loading_settings') {
        return (
            <Card className="p-6">
                <div className="flex items-center justify-center gap-3 py-4 text-gray-500">
                    <Loader2 className="h-5 w-5 animate-spin" />
                    <span className="text-sm">{t('bio.loading_settings')}</span>
                </div>
            </Card>
        )
    }

    // Success
    if (status === 'success') {
        const labels: Record<string, string> = {
            webauthn: 'WebAuthn (Fingerprint / Face ID)',
            face_recognition: 'Face Recognition',
            adms: 'ADMS Device',
        }
        return (
            <Card className="p-6">
                <div className="text-center py-4 space-y-3">
                    <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center mx-auto">
                        <CheckCircle2 className="h-7 w-7 text-green-600" />
                    </div>
                    <div>
                        <p className="font-semibold text-gray-900">Biometric Verified</p>
                        {activeMethod && (
                            <p className="text-xs text-gray-500 mt-1">via {labels[activeMethod]}</p>
                        )}
                    </div>
                </div>
            </Card>
        )
    }

    return (
        <Card className="p-6">
            <div className="space-y-5">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                        <div className="w-9 h-9 bg-blue-100 rounded-xl flex items-center justify-center">
                            <Fingerprint className="h-5 w-5 text-blue-600" />
                        </div>
                        <div>
                            <h3 className="font-semibold text-gray-900 text-[15px]">Biometric Verification</h3>
                            {settings?.branch && (
                                <p className="text-xs text-gray-500">Branch: {settings.branch}</p>
                            )}
                        </div>
                    </div>
                    {settings?.source && (
                        <Badge variant="outline" className="text-[10px] capitalize">{settings.source}</Badge>
                    )}
                </div>

                {/* ── ADMS only ──────────────────────────────────────────── */}
                {activeMethod === 'adms' && (
                    <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 space-y-3">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-orange-100 rounded-xl flex items-center justify-center flex-shrink-0">
                                <MonitorSmartphone className="h-5 w-5 text-orange-600" />
                            </div>
                            <div>
                                <p className="font-semibold text-sm text-orange-900">Use Your Fingerprint Device</p>
                                <p className="text-xs text-orange-700 mt-0.5">
                                    This branch uses physical ADMS terminals (ZKTeco) for check-in.
                                </p>
                            </div>
                        </div>
                        <ul className="text-xs text-orange-800 space-y-1 pl-1">
                            <li>1. Walk up to the ZKTeco device at your branch entrance.</li>
                            <li>2. Place your registered finger on the scanner.</li>
                            <li>3. Your check-in is logged automatically — no app action needed.</li>
                        </ul>
                        {settings?.adms_device_serials && settings.adms_device_serials.length > 0 && (
                            <p className="text-[11px] text-orange-600">
                                Assigned devices: {settings.adms_device_serials.join(', ')}
                            </p>
                        )}
                        {multipleAvailable && (
                            <Button
                                variant="outline"
                                size="sm"
                                className="w-full mt-2"
                                onClick={() => { setActiveMethod(null) }}
                            >
                                ← Choose a different method
                            </Button>
                        )}
                    </div>
                )}

                {/* ── Camera UI (face recognition) ──────────────────────── */}
                {activeMethod === 'face_recognition' && showCamera && status === 'running' && (
                    <div className="space-y-3">
                        <div className="relative bg-gray-900 rounded-xl overflow-hidden aspect-video">
                            <video
                                ref={videoRef}
                                autoPlay
                                playsInline
                                muted
                                className="w-full h-full object-cover"
                            />
                            {/* Face guide overlay */}
                            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                <div className="w-40 h-52 border-2 border-white/60 rounded-[50%] border-dashed" />
                            </div>
                            {/* Liveness challenge overlay */}
                            {livenessActive && livenessAction && (
                                <div className="absolute bottom-0 left-0 right-0 bg-amber-500/90 px-4 py-3 text-center">
                                    <div className="flex items-center justify-center gap-2 text-white font-semibold text-sm">
                                        <Eye className="h-4 w-4" />
                                        <span>{LIVENESS_INSTRUCTIONS[livenessAction]}</span>
                                    </div>
                                    <p className="text-amber-100 text-xs mt-1">
                                        Time remaining: {livenessCountdown}s
                                    </p>
                                </div>
                            )}
                            {/* Liveness passed banner */}
                            {livenessPassed && !livenessActive && (
                                <div className="absolute bottom-0 left-0 right-0 bg-green-500/90 px-4 py-2 text-center">
                                    <div className="flex items-center justify-center gap-2 text-white font-semibold text-sm">
                                        <CheckCircle2 className="h-4 w-4" />
                                        <span>Liveness verified — click Scan Face</span>
                                    </div>
                                </div>
                            )}
                        </div>
                        <div className="flex gap-2">
                            <Button
                                className="flex-1 bg-blue-600 hover:bg-blue-700"
                                onClick={handleCapture}
                                disabled={requireLiveness && !livenessPassed}
                            >
                                <Scan className="h-4 w-4 mr-2" />
                                {requireLiveness && !livenessPassed
                                    ? (livenessActive ? 'Complete liveness check…' : 'Waiting for liveness…')
                                    : 'Scan Face'}
                            </Button>
                            <Button
                                variant="outline"
                                onClick={() => { stopCamera(); stopLivenessChallenge(); setActiveMethod(null); setStatus('choosing'); setLivenessActive(false); setLivenessPassed(false) }}
                            >
                                Cancel
                            </Button>
                        </div>
                        <p className="text-xs text-center text-gray-500">
                            {requireLiveness && !livenessPassed
                                ? 'Complete the liveness check to enable face scanning'
                                : 'Position your face inside the oval and click Scan'}
                        </p>
                    </div>
                )}

                {/* ── Captured photo preview ────────────────────────────── */}
                {activeMethod === 'face_recognition' && capturedPhoto && status === 'running' && (
                    <div className="space-y-3">
                        <div className="relative bg-gray-900 rounded-xl overflow-hidden aspect-video">
                            <img src={capturedPhoto} alt="Captured" className="w-full h-full object-cover" />
                        </div>
                        <div className="flex items-center justify-center gap-2 text-gray-500">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            <span className="text-sm">{statusMsg || 'Processing…'}</span>
                        </div>
                    </div>
                )}

                {/* ── WebAuthn running ──────────────────────────────────── */}
                {activeMethod === 'webauthn' && status === 'running' && !errorMsg && (
                    <div className="text-center py-4 space-y-4">
                        <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto">
                            <Fingerprint className="h-8 w-8 text-blue-600 animate-pulse" />
                        </div>
                        <div>
                            <p className="font-medium text-gray-900 text-sm">Waiting for authenticator…</p>
                            <p className="text-xs text-gray-500 mt-1">{statusMsg}</p>
                        </div>
                        <p className="text-xs text-gray-400">
                            Your browser will prompt you to use your fingerprint, Face ID, or security key.
                        </p>
                    </div>
                )}

                {/* ── Error state ──────────────────────────────────────── */}
                {status === 'error' && errorMsg && (
                    <div className="bg-red-50 border border-red-200 rounded-xl p-4 space-y-3">
                        <div className="flex items-start gap-3">
                            <XCircle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
                            <p className="text-sm text-red-800">{errorMsg}</p>
                        </div>
                        <div className="flex gap-2">
                            {activeMethod === 'webauthn' && (
                                <Button size="sm" onClick={runWebAuthn} className="bg-blue-600 hover:bg-blue-700">
                                    <RotateCcw className="h-4 w-4 mr-2" /> Try Again
                                </Button>
                            )}
                            {activeMethod === 'face_recognition' && (
                                <Button size="sm" onClick={retryFace} className="bg-blue-600 hover:bg-blue-700">
                                    <RotateCcw className="h-4 w-4 mr-2" /> Retry
                                </Button>
                            )}
                            {multipleAvailable && (
                                <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => { setActiveMethod(null); setStatus('choosing'); setErrorMsg('') }}
                                >
                                    Other Method
                                </Button>
                            )}
                        </div>
                    </div>
                )}

                {/* ── Method chooser ────────────────────────────────────── */}
                {(status === 'choosing' || (multipleAvailable && !activeMethod)) &&
                    activeMethod === null && (
                        <div className="space-y-2">
                            {availableMethods.length === 0 && (
                                <div className="flex items-center gap-2 text-amber-700 bg-amber-50 p-3 rounded-xl text-sm">
                                    <AlertCircle className="h-4 w-4 flex-shrink-0" />
                                    {settings?.face_exempt ? t('bio.bp_face_exempt') : t('bio.bp_no_methods')}
                                </div>
                            )}
                            {allowed?.webauthn && (
                                <MethodButton
                                    icon={<Fingerprint className="h-5 w-5" />}
                                    label={t('bio.bp_webauthn_label')}
                                    description={t('bio.bp_webauthn_desc')}
                                    onClick={runWebAuthn}
                                />
                            )}
                            {allowed?.face_recognition && (
                                <MethodButton
                                    icon={<Camera className="h-5 w-5" />}
                                    label={t('bio.bp_face_label')}
                                    description={t('bio.bp_face_desc')}
                                    onClick={startFaceCapture}
                                />
                            )}
                            {allowed?.adms && (
                                <MethodButton
                                    icon={<MonitorSmartphone className="h-5 w-5" />}
                                    label={t('bio.bp_adms_label')}
                                    description={t('bio.bp_adms_desc')}
                                    onClick={handleAdmsSelect}
                                />
                            )}
                        </div>
                    )}
            </div>
        </Card>
    )
}

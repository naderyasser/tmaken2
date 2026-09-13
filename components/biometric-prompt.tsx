'use client'

import { Fingerprint, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'

interface BiometricPromptProps {
    onVerified: (verified: boolean, type?: string) => void
    disabled?: boolean
}

export function BiometricPrompt({ onVerified, disabled = true }: BiometricPromptProps) {
    return (
        <Card className="p-6">
            <div className="space-y-4">
                <div className="flex items-center gap-2">
                    <Fingerprint className="h-5 w-5 text-blue-600" />
                    <h3 className="text-lg font-semibold">Biometric Verification</h3>
                </div>

                <Alert className="bg-amber-50 border-amber-200">
                    <AlertCircle className="h-4 w-4 text-amber-600" />
                    <AlertDescription className="text-amber-800">
                        <strong>Coming Soon!</strong>
                        <br />
                        Biometric verification will be available soon and will be connected to physical fingerprint devices.
                    </AlertDescription>
                </Alert>

                <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                    <h4 className="font-medium text-sm mb-2">Future Features:</h4>
                    <ul className="text-sm text-gray-600 space-y-1">
                        <li>Fingerprint scanner integration</li>
                        <li>Face recognition with hardware device</li>
                        <li>Advanced biometric verification</li>
                        <li>Multi-factor authentication</li>
                    </ul>
                </div>

                <Button
                    disabled={disabled}
                    size="lg"
                    className={disabled ? 'w-full opacity-50 cursor-not-allowed' : 'w-full'}
                    onClick={disabled ? undefined : () => onVerified(true, 'fingerprint')}
                >
                    <Fingerprint className="h-5 w-5 mr-2" />
                    {disabled ? 'Verify Biometric (Coming Soon)' : 'Verify with Fingerprint'}
                </Button>

                <p className="text-xs text-center text-gray-500">
                    This feature will be enabled once biometric hardware is connected to the system.
                </p>
            </div>
        </Card>
    )
}
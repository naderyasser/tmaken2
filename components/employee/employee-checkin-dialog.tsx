'use client'
import { csrfFetch } from '@/lib/csrf'

import React, { useState, useEffect, useRef } from 'react'
import {
    Camera, MapPin, Fingerprint, Loader2, User, Upload, X, LogIn, LogOut
} from 'lucide-react'
import { frappeClient, frappeApiUrl, type Employee } from '@/lib/api-client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/hooks/use-toast'
import { Checkbox } from '@/components/ui/checkbox'
import { useI18n } from '@/lib/i18n'
import { translateDepartment } from '@/lib/enums'

interface EmployeeCheckinDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    onSuccess?: () => void
}

export function EmployeeCheckinDialog({ open, onOpenChange, onSuccess }: EmployeeCheckinDialogProps) {
    const { toast } = useToast()
    const { t } = useI18n()
    const [loading, setLoading] = useState(false)
    const [employees, setEmployees] = useState<Employee[]>([])
    const [loadingEmployees, setLoadingEmployees] = useState(false)
    
    // Form state
    const [employee, setEmployee] = useState('')
    const [logType, setLogType] = useState<'IN' | 'OUT'>('IN')
    const [deviceId, setDeviceId] = useState('')
    const [photoFile, setPhotoFile] = useState<File | null>(null)
    const [photoPreview, setPhotoPreview] = useState<string | null>(null)
    const [captureLocation, setCaptureLocation] = useState(true)
    const [location, setLocation] = useState<{ latitude: number; longitude: number } | null>(null)
    const [capturingLocation, setCapturingLocation] = useState(false)
    const [biometricVerified, setBiometricVerified] = useState(false)
    const [biometricType, setBiometricType] = useState<'Fingerprint' | 'Face ID' | 'Touch ID'>('Fingerprint')
    
    const fileInputRef = useRef<HTMLInputElement>(null)

    useEffect(() => {
        if (open) {
            loadEmployees()
            // Auto-detect device
            const userAgent = navigator.userAgent
            if (userAgent.includes('Mobile')) {
                setDeviceId('Mobile Device')
            } else {
                setDeviceId('Web Browser')
            }
        }
    }, [open])

    useEffect(() => {
        if (open && captureLocation) {
            getLocation()
        }
    }, [open, captureLocation])

    const loadEmployees = async () => {
        try {
            setLoadingEmployees(true)
            const data = await frappeClient.getEmployees({
                filters: [['Employee', 'status', '=', 'Active']],
                fields: ['name', 'employee_name', 'employee_number', 'department'],
                limit_page_length: 100,
                order_by: 'employee_name asc'
            })
            setEmployees(data)
        } catch (error) {
            console.error('Failed to load employees:', error)
        } finally {
            setLoadingEmployees(false)
        }
    }

    const getLocation = () => {
        if (!navigator.geolocation) {
            toast({
                title: t('common.error'),
                description: t('ckd.geo_unsupported'),
                variant: 'destructive',
            })
            return
        }

        setCapturingLocation(true)
        navigator.geolocation.getCurrentPosition(
            (position) => {
                setLocation({
                    latitude: position.coords.latitude,
                    longitude: position.coords.longitude,
                })
                setCapturingLocation(false)
            },
            (error) => {
                console.error('Error getting location:', error)
                toast({
                    title: t('ckd.location_error'),
                    description: t('ckd.location_failed'),
                    variant: 'destructive',
                })
                setCapturingLocation(false)
            }
        )
    }

    const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (file) {
            if (file.size > 5 * 1024 * 1024) { // 5MB limit
                toast({
                    title: t('ckd.file_too_large'),
                    description: t('ckd.file_too_large_desc'),
                    variant: 'destructive',
                })
                return
            }
            setPhotoFile(file)
            const reader = new FileReader()
            reader.onloadend = () => {
                setPhotoPreview(reader.result as string)
            }
            reader.readAsDataURL(file)
        }
    }

    const removePhoto = () => {
        setPhotoFile(null)
        setPhotoPreview(null)
        if (fileInputRef.current) {
            fileInputRef.current.value = ''
        }
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        
        if (!employee) {
            toast({
                title: t('ckd.validation_error'),
                description: t('ckd.select_employee_error'),
                variant: 'destructive',
            })
            return
        }

        setLoading(true)
        try {
            let photoUrl: string | undefined

            // Upload photo if provided
            if (photoFile) {
                const formData = new FormData()
                formData.append('file', photoFile)
                formData.append('is_private', '0')
                formData.append('folder', 'Home/Attachments')

                const uploadResponse = await csrfFetch(frappeApiUrl('/api/method/upload_file'), {
                    method: 'POST',
                    body: formData,
                    credentials: 'include',
                })

                if (!uploadResponse.ok) {
                    throw new Error('Failed to upload photo')
                }

                const uploadData = await uploadResponse.json()
                photoUrl = uploadData.message.file_url
            }

            // Create check-in record.
            //
            // `time` is deliberately NOT sent. It used to be
            // `new Date().toISOString()`, which is UTC taken from the device clock —
            // so a punch was stored 3 hours behind Riyadh, and a phone with a wrong
            // clock wrote a wrong punch. Omitting it makes the SERVER stamp the time:
            // Employee Checkin.time carries `default: "Now"`, and both the REST
            // handler (`frappe.new_doc(doctype, **data)`) and `Document.insert()`
            // apply field defaults — so the value is `now_datetime()` in the site's
            // own timezone (Asia/Riyadh), never the device's.
            const checkinData: any = {
                employee,
                log_type: logType,
                device_id: deviceId || undefined,
            }

            if (photoUrl) {
                checkinData.photo_image = photoUrl
                checkinData.checkin_method = biometricVerified ? 'Photo + Biometric' : 'Photo'
            }

            if (biometricVerified) {
                checkinData.biometric_verified = 1
                checkinData.biometric_type = biometricType
            }

            if (location) {
                checkinData.latitude = location.latitude
                checkinData.longitude = location.longitude
            }

            await frappeClient.createEmployeeCheckin(checkinData)

            toast({
                title: t('common.success'),
                description: logType === 'IN' ? t('ckd.checkin_recorded') : t('ckd.checkout_recorded'),
            })

            onSuccess?.()
            handleClose()
        } catch (error) {
            console.error('Failed to create check-in:', error)
            toast({
                title: t('common.error'),
                description: t('ckd.create_failed'),
                variant: 'destructive',
            })
        } finally {
            setLoading(false)
        }
    }

    const handleClose = () => {
        // Reset form
        setEmployee('')
        setLogType('IN')
        setDeviceId('')
        setPhotoFile(null)
        setPhotoPreview(null)
        setCaptureLocation(true)
        setLocation(null)
        setBiometricVerified(false)
        setBiometricType('Fingerprint')
        onOpenChange(false)
    }

    return (
        <Dialog open={open} onOpenChange={handleClose}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>{t('ckd.title')}</DialogTitle>
                    <DialogDescription>
                        {t('ckd.description')}
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-6">
                    {/* Employee Selection */}
                    <div className="space-y-2">
                        <Label htmlFor="employee">{t('ckd.employee')} *</Label>
                        <Select value={employee} onValueChange={setEmployee} disabled={loadingEmployees}>
                            <SelectTrigger aria-label={loadingEmployees ? t('ckd.loading_employees') : t('ckd.select_employee')} id="employee">
                                <SelectValue placeholder={loadingEmployees ? t('ckd.loading_employees') : t('ckd.select_employee')} />
                            </SelectTrigger>
                            <SelectContent>
                                {employees.map(emp => (
                                    <SelectItem key={emp.name} value={emp.name}>
                                        <div className="flex items-center gap-2">
                                            <span className="font-medium">{emp.employee_name}</span>
                                            <span className="text-xs text-muted-foreground">({emp.name})</span>
                                            {emp.department && (
                                                <Badge variant="outline" className="text-xs">
                                                    {translateDepartment(emp.department, t('dir') === 'rtl' ? 'ar' : 'en')}
                                                </Badge>
                                            )}
                                        </div>
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Log Type */}
                    <div className="space-y-2">
                        <Label>{t('ckd.checkin_type')} *</Label>
                        <div className="flex gap-3">
                            <Button
                                type="button"
                                variant={logType === 'IN' ? 'default' : 'outline'}
                                className={logType === 'IN' ? 'bg-green-600 hover:bg-green-700' : ''}
                                onClick={() => setLogType('IN')}
                            >
                                <LogIn className="w-4 h-4 mr-2" />
                                {t('ckd.check_in')}
                            </Button>
                            <Button
                                type="button"
                                variant={logType === 'OUT' ? 'default' : 'outline'}
                                className={logType === 'OUT' ? 'bg-primary hover:bg-primary/90' : ''}
                                onClick={() => setLogType('OUT')}
                            >
                                <LogOut className="w-4 h-4 mr-2" />
                                {t('ckd.check_out')}
                            </Button>
                        </div>
                    </div>

                    {/* Device ID */}
                    <div className="space-y-2">
                        <Label htmlFor="device">{t('ckd.device_id')}</Label>
                        <Input
                            id="device"
                            value={deviceId}
                            onChange={(e) => setDeviceId(e.target.value)}
                            placeholder={t('ckd.device_id_ph')}
                        />
                    </div>

                    {/* Photo Upload */}
                    <div className="space-y-2">
                        <Label>{t('ckd.photo_capture')}</Label>
                        {photoPreview ? (
                            <div className="relative">
                                <img
                                    src={photoPreview}
                                    alt={t('ckd.preview')}
                                    className="w-full h-48 object-cover rounded-lg border-2 border-border"
                                />
                                <Button
                                    type="button"
                                    variant="destructive"
                                    size="sm"
                                    className="absolute top-2 right-2"
                                    onClick={removePhoto}
                                >
                                    <X className="w-4 h-4" />
                                </Button>
                            </div>
                        ) : (
                            <div
                                className="border-2 border-dashed border-input rounded-lg p-8 text-center cursor-pointer hover:border-gray-400 transition-colors"
                                onClick={() => fileInputRef.current?.click()}
                            >
                                <Camera className="w-12 h-12 mx-auto text-muted-foreground/70 mb-2" />
                                <p className="text-sm text-muted-foreground mb-1">{t('ckd.upload_photo')}</p>
                                <p className="text-xs text-muted-foreground">{t('ckd.photo_hint')}</p>
                            </div>
                        )}
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/*"
                            onChange={handlePhotoSelect}
                            className="hidden"
                        />
                    </div>

                    {/* Biometric Verification */}
                    <div className="space-y-3">
                        <div className="flex items-center space-x-2">
                            <Checkbox
                                id="biometric"
                                checked={biometricVerified}
                                onCheckedChange={(checked) => setBiometricVerified(checked as boolean)}
                            />
                            <Label htmlFor="biometric" className="cursor-pointer">
                                {t('ckd.biometric_verification')}
                            </Label>
                        </div>
                        {biometricVerified && (
                            <Select value={biometricType} onValueChange={(v: any) => setBiometricType(v)}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="Fingerprint">
                                        <div className="flex items-center gap-2">
                                            <Fingerprint className="w-4 h-4" />
                                            {t('ckd.fingerprint')}
                                        </div>
                                    </SelectItem>
                                    <SelectItem value="Face ID">
                                        <div className="flex items-center gap-2">
                                            <User className="w-4 h-4" />
                                            {t('ckd.face_id')}
                                        </div>
                                    </SelectItem>
                                    <SelectItem value="Touch ID">
                                        <div className="flex items-center gap-2">
                                            <Fingerprint className="w-4 h-4" />
                                            {t('ckd.touch_id')}
                                        </div>
                                    </SelectItem>
                                </SelectContent>
                            </Select>
                        )}
                    </div>

                    {/* Location Capture */}
                    <div className="space-y-3">
                        <div className="flex items-center space-x-2">
                            <Checkbox
                                id="location"
                                checked={captureLocation}
                                onCheckedChange={(checked) => {
                                    setCaptureLocation(checked as boolean)
                                    if (checked) getLocation()
                                }}
                            />
                            <Label htmlFor="location" className="cursor-pointer">
                                {t('ckd.capture_location')}
                            </Label>
                        </div>
                        {captureLocation && (
                            <div className="bg-muted/40 rounded-lg p-3">
                                {capturingLocation ? (
                                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                        {t('ckd.getting_location')}
                                    </div>
                                ) : location ? (
                                    <div className="space-y-2">
                                        <div className="flex items-center gap-2 text-sm">
                                            <MapPin className="w-4 h-4 text-green-600" />
                                            <span className="font-medium text-green-600">{t('ckd.location_captured')}</span>
                                        </div>
                                        <div className="text-xs text-muted-foreground space-y-1">
                                            <p>{t('ckd.latitude')}: {location.latitude.toFixed(6)}</p>
                                            <p>{t('ckd.longitude')}: {location.longitude.toFixed(6)}</p>
                                        </div>
                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="sm"
                                            onClick={() => window.open(
                                                `https://www.google.com/maps?q=${location.latitude},${location.longitude}`,
                                                '_blank'
                                            )}
                                            className="mt-2"
                                        >
                                            <MapPin className="w-3 h-3 mr-1" />
                                            {t('ckd.view_on_map')}
                                        </Button>
                                    </div>
                                ) : (
                                    <div className="space-y-2">
                                        <p className="text-sm text-red-600">{t('ckd.location_get_failed')}</p>
                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="sm"
                                            onClick={getLocation}
                                        >
                                            {t('common.retry')}
                                        </Button>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={handleClose} disabled={loading}>
                            {t('common.cancel')}
                        </Button>
                        <Button 
                            type="submit" 
                            disabled={loading || !employee}
                            className={logType === 'IN' ? 'bg-green-600 hover:bg-green-700' : 'bg-primary hover:bg-primary/90'}
                        >
                            {loading ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    {t('common.creating')}
                                </>
                            ) : (
                                <>
                                    {logType === 'IN' ? <LogIn className="mr-2 h-4 w-4" /> : <LogOut className="mr-2 h-4 w-4" />}
                                    {logType === 'IN' ? t('ckd.record_checkin') : t('ckd.record_checkout')}
                                </>
                            )}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    )
}

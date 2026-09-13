'use client'

import React, { useState, useEffect, useCallback, useRef } from 'react'
import {
  FileText, Upload, Trash2, Download, Eye, Plus, Loader2,
  CreditCard, BookOpen, Car, Shield, FileCheck, Heart,
  Building2, Landmark, File, AlertCircle, CheckCircle,
  X, ChevronDown,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter
} from '@/components/ui/dialog'
import { frappeClient, frappeApiUrl } from '@/lib/api-client'
import { frappeImageUrl } from '@/lib/utils'

// ─── Types ───────────────────────────────────────────

interface EmployeeDoc {
  name: string
  employee: string
  employee_name: string
  document_type: string
  document_name: string
  file_url: string
  description: string
  uploaded_by: string
  upload_date: string
  company: string
}

interface EmployeeDocumentsProps {
  employeeId: string
  employeeName?: string
  /** Whether the current user can delete documents (admin/HR Manager) */
  canDelete?: boolean
  /** Whether to show the upload section. False = read-only view */
  canUpload?: boolean
  /** Compact mode for embedding in profile cards */
  compact?: boolean
  /** RTL direction */
  isRTL?: boolean
}

// ─── Document type metadata ──────────────────────────

const DOC_TYPES = [
  { value: 'National ID', labelEn: 'National ID', labelAr: 'الهوية الوطنية', icon: CreditCard, color: 'bg-accent text-primary' },
  { value: 'Passport', labelEn: 'Passport', labelAr: 'جواز السفر', icon: BookOpen, color: 'bg-indigo-100 text-indigo-700' },
  { value: 'Iqama (Residence Permit)', labelEn: 'Iqama', labelAr: 'الإقامة', icon: Shield, color: 'bg-green-100 text-green-700' },
  { value: 'Driving License', labelEn: 'Driving License', labelAr: 'رخصة القيادة', icon: Car, color: 'bg-orange-100 text-orange-700' },
  { value: 'Visa', labelEn: 'Visa', labelAr: 'تأشيرة', icon: FileCheck, color: 'bg-purple-100 text-purple-700' },
  { value: 'Work Permit', labelEn: 'Work Permit', labelAr: 'تصريح العمل', icon: Shield, color: 'bg-teal-100 text-teal-700' },
  { value: 'Contract', labelEn: 'Contract', labelAr: 'العقد', icon: FileText, color: 'bg-amber-100 text-amber-700' },
  { value: 'Certificate', labelEn: 'Certificate', labelAr: 'شهادة', icon: FileCheck, color: 'bg-cyan-100 text-cyan-700' },
  { value: 'Medical Report', labelEn: 'Medical Report', labelAr: 'تقرير طبي', icon: Heart, color: 'bg-red-100 text-red-700' },
  { value: 'Insurance Card', labelEn: 'Insurance Card', labelAr: 'بطاقة التأمين', icon: Shield, color: 'bg-emerald-100 text-emerald-700' },
  { value: 'Bank Letter', labelEn: 'Bank Letter', labelAr: 'خطاب بنكي', icon: Landmark, color: 'bg-yellow-100 text-yellow-700' },
  { value: 'Other', labelEn: 'Other', labelAr: 'أخرى', icon: File, color: 'bg-muted text-foreground/90' },
]

function getDocMeta(docType: string) {
  return DOC_TYPES.find(d => d.value === docType) || DOC_TYPES[DOC_TYPES.length - 1]
}

function formatDate(dateStr: string) {
  if (!dateStr) return '-'
  try {
    const d = new Date(dateStr)
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
  } catch { return dateStr }
}

function isImageFile(url: string): boolean {
  const ext = url.split('.').pop()?.toLowerCase() || ''
  return ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp'].includes(ext)
}

function isPDF(url: string): boolean {
  return url.toLowerCase().endsWith('.pdf')
}

function getDownloadUrl(fileUrl: string): string {
  if (!fileUrl) return ''
  if (fileUrl.startsWith('http')) return fileUrl
  return frappeApiUrl('/api/method/frappe.core.doctype.file.file.download_file?file_url=' + encodeURIComponent(fileUrl))
}

function getViewUrl(fileUrl: string): string {
  if (!fileUrl) return ''
  if (fileUrl.startsWith('http')) return fileUrl
  return frappeImageUrl(fileUrl) || fileUrl
}

// ─── Component ───────────────────────────────────────

export function EmployeeDocuments({
  employeeId,
  employeeName,
  canDelete = false,
  canUpload = true,
  compact = false,
  isRTL = false,
}: EmployeeDocumentsProps) {
  const [documents, setDocuments] = useState<EmployeeDoc[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // Upload form state
  const [showUploadForm, setShowUploadForm] = useState(false)
  const [uploadDocType, setUploadDocType] = useState('')
  const [uploadDocName, setUploadDocName] = useState('')
  const [uploadDesc, setUploadDesc] = useState('')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Preview dialog
  const [previewDoc, setPreviewDoc] = useState<EmployeeDoc | null>(null)

  // Delete confirm dialog
  const [deleteConfirm, setDeleteConfirm] = useState<EmployeeDoc | null>(null)

  const loadDocuments = useCallback(async () => {
    if (!employeeId) return
    setLoading(true)
    try {
      const res = await frappeClient.call('base_meena.employee_documents_api.get_documents', {
        employee: employeeId,
      })
      setDocuments(res?.message || [])
    } catch (err) {
      console.error('Failed to load documents:', err)
    } finally {
      setLoading(false)
    }
  }, [employeeId])

  useEffect(() => { loadDocuments() }, [loadDocuments])

  const resetUploadForm = () => {
    setUploadDocType('')
    setUploadDocName('')
    setUploadDesc('')
    setSelectedFile(null)
    setShowUploadForm(false)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleUpload = async () => {
    if (!selectedFile || !uploadDocType || !uploadDocName) {
      setMessage({ type: 'error', text: isRTL ? 'يرجى تعبئة جميع الحقول المطلوبة' : 'Please fill all required fields' })
      return
    }

    setUploading(true)
    setMessage(null)

    try {
      // Step 1: Upload the file to Frappe (no doctype/docname — we link it in step 2)
      const formData = new FormData()
      formData.append('file', selectedFile)
      formData.append('is_private', '1')  // Employee documents should be private
      formData.append('folder', 'Home/Employee Documents')

      // Frappe requires the CSRF token on POST for logged-in users; the /api/frappe
      // proxy only forwards whatever X-Frappe-CSRF-Token the client sends.
      const csrfCookie = document.cookie.split(';').map(c => c.trim())
        .find(c => c.startsWith('csrftoken=') || c.startsWith('csrf_token='))
      const csrfToken = csrfCookie ? decodeURIComponent(csrfCookie.split('=')[1]) : ''

      const uploadRes = await fetch(frappeApiUrl('/api/method/upload_file'), {
        method: 'POST',
        credentials: 'include',
        headers: csrfToken ? { 'X-Frappe-CSRF-Token': csrfToken } : {},
        body: formData,
      })

      if (!uploadRes.ok) {
        throw new Error(isRTL ? 'فشل رفع الملف' : 'File upload failed')
      }

      const uploadData = await uploadRes.json()
      const fileUrl = uploadData.message?.file_url
      if (!fileUrl) throw new Error(isRTL ? 'لم يتم الحصول على رابط الملف' : 'No file URL returned')

      // Step 2: Create the Employee Document record
      await frappeClient.call('base_meena.employee_documents_api.upload_document', {
        employee: employeeId,
        document_type: uploadDocType,
        document_name: uploadDocName,
        file_url: fileUrl,
        description: uploadDesc || undefined,
      })

      setMessage({ type: 'success', text: isRTL ? 'تم رفع المستند بنجاح ✅' : 'Document uploaded successfully ✅' })
      resetUploadForm()
      await loadDocuments()
    } catch (err: any) {
      console.error('Upload failed:', err)
      setMessage({ type: 'error', text: err.message || (isRTL ? 'فشل رفع المستند' : 'Document upload failed') })
    } finally {
      setUploading(false)
    }
  }

  const handleDelete = async (doc: EmployeeDoc) => {
    setDeleting(doc.name)
    try {
      await frappeClient.call('base_meena.employee_documents_api.delete_document', {
        document_id: doc.name,
      })
      setDocuments(prev => prev.filter(d => d.name !== doc.name))
      setMessage({ type: 'success', text: isRTL ? 'تم حذف المستند' : 'Document deleted' })
      setDeleteConfirm(null)
    } catch (err: any) {
      console.error('Delete failed:', err)
      setMessage({ type: 'error', text: err.message || (isRTL ? 'فشل حذف المستند' : 'Failed to delete document') })
    } finally {
      setDeleting(null)
    }
  }

  // Auto-clear messages
  useEffect(() => {
    if (message) {
      const t = setTimeout(() => setMessage(null), 5000)
      return () => clearTimeout(t)
    }
  }, [message])

  // ─── Render ────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
        <span className="ml-2 text-sm text-muted-foreground">{isRTL ? 'جاري التحميل...' : 'Loading documents...'}</span>
      </div>
    )
  }

  return (
    <div className="space-y-4" dir={isRTL ? 'rtl' : 'ltr'}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileText className="w-5 h-5 text-primary" />
          <h3 className={`font-semibold ${compact ? 'text-base' : 'text-lg'}`}>
            {isRTL ? 'المستندات' : 'Documents'}
          </h3>
          {documents.length > 0 && (
            <Badge variant="secondary" className="text-xs">{documents.length}</Badge>
          )}
        </div>
        {canUpload && (
          <Button
            size="sm"
            variant={showUploadForm ? 'secondary' : 'default'}
            onClick={() => setShowUploadForm(!showUploadForm)}
            className="gap-1"
          >
            {showUploadForm ? (
              <><X className="w-4 h-4" />{isRTL ? 'إلغاء' : 'Cancel'}</>
            ) : (
              <><Plus className="w-4 h-4" />{isRTL ? 'رفع مستند' : 'Upload Document'}</>
            )}
          </Button>
        )}
      </div>

      {/* Message */}
      {message && (
        <div className={`flex items-center gap-2 p-3 rounded-lg text-sm ${
          message.type === 'success' ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'
        }`}>
          {message.type === 'success' ? <CheckCircle className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
          {message.text}
        </div>
      )}

      {/* Upload Form */}
      {showUploadForm && canUpload && (
        <Card className="border-primary/20 bg-blue-50/30">
          <CardContent className="pt-4 space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {/* Document Type */}
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">
                  {isRTL ? 'نوع المستند *' : 'Document Type *'}
                </label>
                <Select value={uploadDocType} onValueChange={v => setUploadDocType(v)}>
                  <SelectTrigger aria-label={isRTL ? 'اختر النوع' : 'Select type'} className="bg-card text-sm">
                    <SelectValue placeholder={isRTL ? 'اختر النوع' : 'Select type'} />
                  </SelectTrigger>
                  <SelectContent>
                    {DOC_TYPES.map(dt => (
                      <SelectItem key={dt.value} value={dt.value}>
                        <span className="flex items-center gap-2">
                          <dt.icon className="w-3.5 h-3.5" />
                          {isRTL ? dt.labelAr : dt.labelEn}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {/* Document Name */}
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">
                  {isRTL ? 'عنوان المستند *' : 'Document Title *'}
                </label>
                <Input
                  value={uploadDocName}
                  onChange={e => setUploadDocName(e.target.value)}
                  placeholder={isRTL ? 'مثال: هوية وطنية - محمد' : 'e.g. National ID - Ahmed'}
                  className="bg-card text-sm"
                />
              </div>
            </div>

            {/* Description */}
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">
                {isRTL ? 'ملاحظات (اختياري)' : 'Notes (optional)'}
              </label>
              <Input
                value={uploadDesc}
                onChange={e => setUploadDesc(e.target.value)}
                placeholder={isRTL ? 'تاريخ الانتهاء، ملاحظات...' : 'Expiry date, notes...'}
                className="bg-card text-sm"
              />
            </div>

            {/* File Picker */}
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">
                {isRTL ? 'الملف *' : 'File *'}
              </label>
              <div className="flex flex-col gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*,.pdf,.doc,.docx,.xls,.xlsx"
                  onChange={e => setSelectedFile(e.target.files?.[0] || null)}
                  className="text-sm file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-medium file:bg-accent file:text-primary hover:file:bg-accent"
                />
                <Button aria-label="رفع ملف" title="رفع ملف"
                  onClick={handleUpload}
                  disabled={uploading || !selectedFile || !uploadDocType || !uploadDocName}
                  size="sm"
                  className="gap-1 w-full"
                >
                  {uploading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Upload className="w-4 h-4" />
                  )}
                  {isRTL ? 'رفع' : 'Upload'}
                </Button>
              </div>
              {selectedFile && (
                <p className="text-xs text-muted-foreground mt-1">
                  {selectedFile.name} ({(selectedFile.size / 1024).toFixed(0)} KB)
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Documents Grid */}
      {documents.length === 0 ? (
        <div className="text-center py-8 bg-muted/40 rounded-lg">
          <FileText className="w-10 h-10 mx-auto text-muted-foreground/40 mb-2" />
          <p className="text-sm text-muted-foreground">
            {isRTL ? 'لا توجد مستندات مرفقة' : 'No documents attached'}
          </p>
          {canUpload && (
            <p className="text-xs text-muted-foreground/70 mt-1">
              {isRTL ? 'اضغط "رفع مستند" لإضافة هوية أو جواز سفر أو أي مستند' : 'Click "Upload Document" to add ID, passport, or any document'}
            </p>
          )}
        </div>
      ) : (
        <div className={`grid gap-3 ${compact ? 'grid-cols-1' : 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3'}`}>
          {documents.map(doc => {
            const meta = getDocMeta(doc.document_type)
            const Icon = meta.icon
            const viewUrl = getViewUrl(doc.file_url)
            const isImage = isImageFile(doc.file_url)

            return (
              <Card key={doc.name} className="group hover:shadow-md transition-shadow overflow-hidden">
                {/* Preview thumbnail */}
                {isImage && (
                  <div
                    className="h-32 bg-muted cursor-pointer overflow-hidden"
                    onClick={() => setPreviewDoc(doc)}
                  >
                    <img
                      src={viewUrl}
                      alt={doc.document_name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                      onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
                    />
                  </div>
                )}

                <CardContent className={`${isImage ? 'pt-3' : 'pt-4'} pb-3 px-4`}>
                  {/* Type badge */}
                  <div className="flex items-center justify-between mb-2">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${meta.color}`}>
                      <Icon className="w-3 h-3" />
                      {isRTL ? meta.labelAr : meta.labelEn}
                    </span>
                    <span className="text-[10px] text-muted-foreground/70">{formatDate(doc.upload_date)}</span>
                  </div>

                  {/* Document name */}
                  <h4 className="font-medium text-sm text-foreground truncate">{doc.document_name}</h4>
                  {doc.description && (
                    <p className="text-xs text-muted-foreground mt-0.5 truncate">{doc.description}</p>
                  )}

                  {/* Actions */}
                  <div className="flex items-center gap-1.5 mt-3 pt-2 border-t">
                    <Button aria-label="عرض" title="عرض"
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-xs gap-1"
                      onClick={() => setPreviewDoc(doc)}
                    >
                      <Eye className="w-3 h-3" />
                      {isRTL ? 'عرض' : 'View'}
                    </Button>
                    <a href={getDownloadUrl(doc.file_url)} download className="inline-flex">
                      <Button aria-label="تصدير" title="تصدير" variant="ghost" size="sm" className="h-7 px-2 text-xs gap-1">
                        <Download className="w-3 h-3" />
                        {isRTL ? 'تحميل' : 'Download'}
                      </Button>
                    </a>
                    {canDelete && (
                      <Button aria-label="حذف" title="حذف"
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2.5 text-xs gap-1 text-red-600 hover:text-red-700 hover:bg-red-50 ms-auto"
                        onClick={() => setDeleteConfirm(doc)}
                      >
                        <Trash2 className="w-3.5 h-3.5 flex-shrink-0" />
                        {isRTL ? 'حذف' : 'Delete'}
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* Preview Dialog */}
      <Dialog open={!!previewDoc} onOpenChange={open => !open && setPreviewDoc(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {previewDoc && (() => {
                const m = getDocMeta(previewDoc.document_type)
                return <m.icon className="w-5 h-5 text-primary" />
              })()}
              {previewDoc?.document_name}
            </DialogTitle>
            <DialogDescription>
              {previewDoc && (
                <span className="flex items-center gap-2 flex-wrap">
                  <Badge variant="outline">{isRTL ? getDocMeta(previewDoc.document_type).labelAr : previewDoc.document_type}</Badge>
                  <span className="text-xs">• {formatDate(previewDoc.upload_date)}</span>
                  {previewDoc.description && <span className="text-xs">• {previewDoc.description}</span>}
                </span>
              )}
            </DialogDescription>
          </DialogHeader>
          {previewDoc && (
            <div className="overflow-auto max-h-[70vh]">
              {isImageFile(previewDoc.file_url) ? (
                <img
                  src={getViewUrl(previewDoc.file_url)}
                  alt={previewDoc.document_name}
                  className="w-full rounded-lg"
                />
              ) : isPDF(previewDoc.file_url) ? (
                <iframe
                  src={getViewUrl(previewDoc.file_url)}
                  className="w-full h-[60vh] rounded-lg border"
                  title={previewDoc.document_name}
                />
              ) : (
                <div className="text-center py-12">
                  <FileText className="w-16 h-16 mx-auto text-muted-foreground/40 mb-3" />
                  <p className="text-muted-foreground mb-3">
                    {isRTL ? 'لا يمكن عرض هذا الملف مباشرة' : 'Cannot preview this file type'}
                  </p>
                  <a href={getDownloadUrl(previewDoc.file_url)} download>
                    <Button aria-label="تصدير" title="تصدير">
                      <Download className="w-4 h-4" />
                      {isRTL ? 'تحميل الملف' : 'Download File'}
                    </Button>
                  </a>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirm Dialog */}
      <Dialog open={!!deleteConfirm} onOpenChange={open => !open && setDeleteConfirm(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-red-600">
              {isRTL ? 'حذف المستند' : 'Delete Document'}
            </DialogTitle>
            <DialogDescription>
              {isRTL
                ? `هل أنت متأكد من حذف "${deleteConfirm?.document_name}"؟ لا يمكن التراجع عن هذا الإجراء.`
                : `Are you sure you want to delete "${deleteConfirm?.document_name}"? This cannot be undone.`
              }
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDeleteConfirm(null)}>
              {isRTL ? 'إلغاء' : 'Cancel'}
            </Button>
            <Button aria-label="حذف" title="حذف"
              variant="destructive"
              onClick={() => deleteConfirm && handleDelete(deleteConfirm)}
              disabled={!!deleting}
            >
              {deleting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Trash2 className="w-4 h-4" />
              )}
              {isRTL ? 'حذف' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

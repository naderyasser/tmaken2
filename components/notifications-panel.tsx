'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Bell, Check, CheckCheck, X, Trash2, Calendar, DollarSign,
  Users, AlertCircle, Info, AlertTriangle, MapPin, Clock as ClockIcon, FileText, ClipboardList
} from 'lucide-react'
import { frappeClient } from '@/lib/api-client'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Skeleton } from '@/components/ui/skeleton'
import { useToast } from '@/hooks/use-toast'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { getFrappeSocket } from '@/lib/frappe-realtime'

// ==================== Types ====================

interface Notification {
  name: string
  subject?: string
  email_content?: string
  document_type?: string
  document_name?: string
  from_user?: string
  read?: number
  creation?: string
  type?: string
  modified?: string
}

interface NotificationCounts {
  total: number
  unread: number
  read: number
}

// ==================== Helpers ====================

const DOC_TYPE_META: Record<string, { icon: React.ReactNode; label: string; color: string }> = {
  'Leave Application': {
    icon: <Calendar className="h-4 w-4" />,
    label: 'طلب إجازة',
    color: 'text-blue-500 bg-blue-50',
  },
  'Expense Claim': {
    icon: <DollarSign className="h-4 w-4" />,
    label: 'طلب مصروفات',
    color: 'text-emerald-500 bg-emerald-50',
  },
  'Attendance': {
    icon: <ClockIcon className="h-4 w-4" />,
    label: 'حضور وانصراف',
    color: 'text-orange-500 bg-orange-50',
  },
  'Employee': {
    icon: <Users className="h-4 w-4" />,
    label: 'موظف',
    color: 'text-purple-500 bg-purple-50',
  },
  'Salary Slip': {
    icon: <FileText className="h-4 w-4" />,
    label: 'مسير رواتب',
    color: 'text-green-500 bg-green-50',
  },
  'Employee Radius Alert Log': {
    icon: <MapPin className="h-4 w-4" />,
    label: 'تنبيه نطاق',
    color: 'text-red-500 bg-red-50',
  },
  'Absence Warning': {
    icon: <AlertTriangle className="h-4 w-4" />,
    label: 'إنذار غياب',
    color: 'text-yellow-500 bg-yellow-50',
  },
  'Workflow Task': {
    icon: <ClipboardList className="h-4 w-4" />,
    label: 'مهمة تلقائية',
    color: 'text-teal-500 bg-teal-50',
  },
}

function getNotifMeta(type?: string, docType?: string) {
  if (docType && DOC_TYPE_META[docType]) return DOC_TYPE_META[docType]
  if (type === 'Alert') return { icon: <AlertCircle className="h-4 w-4" />, color: 'text-red-500 bg-red-50' }
  if (type === 'Warning') return { icon: <AlertTriangle className="h-4 w-4" />, color: 'text-yellow-500 bg-yellow-50' }
  return { icon: <Info className="h-4 w-4" />, color: 'text-gray-500 bg-gray-100' }
}

function getDocTypeLabel(docType?: string): string | null {
  if (!docType) return null
  return DOC_TYPE_META[docType]?.label || docType
}

function timeAgo(dateString?: string): string {
  if (!dateString) return ''
  const date = new Date(dateString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 1) return 'الآن'
  if (diffMins < 60) return `منذ ${diffMins} د`
  if (diffHours < 24) return `منذ ${diffHours} س`
  if (diffDays === 1) return 'أمس'
  if (diffDays < 7) return `منذ ${diffDays} أيام`
  if (diffDays < 30) return `منذ ${Math.floor(diffDays / 7)} أسابيع`
  return date.toLocaleDateString('ar-EG', { day: 'numeric', month: 'short' })
}


export function NotificationsPanel() {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [counts, setCounts] = useState<NotificationCounts>({ total: 0, unread: 0, read: 0 })
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const [activeTab, setActiveTab] = useState('all')
  const { toast } = useToast()

  // ==================== Load Unread Count (background) ====================

  const loadUnreadCount = useCallback(async () => {
    try {
      const response = await frappeClient.get<Notification[]>('Notification Log', undefined, {
        fields: ['name'],
        filters: [['Notification Log', 'read', '=', 0]],
        limit_page_length: 100,
      })
      const count = (response.data || []).length
      setCounts(prev => ({ ...prev, unread: count }))
    } catch {
      // silent — don't break the header
    }
  }, [])

  // Poll unread count even when panel is closed — 2 min, now that the
  // realtime subscription below is the primary way new notifications show
  // up; this is just the fallback for when the socket is down.
  useEffect(() => {
    loadUnreadCount()
    const interval = setInterval(loadUnreadCount, 120000)
    return () => clearInterval(interval)
  }, [loadUnreadCount])

  // ==================== Load Full Notifications ====================

  const loadNotifications = useCallback(async () => {
    try {
      setLoading(true)
      const response = await frappeClient.get<Notification[]>('Notification Log', undefined, {
        fields: ['name', 'subject', 'email_content', 'document_type', 'document_name', 'from_user', 'read', 'creation', 'type', 'modified'],
        order_by: 'creation desc',
        limit_page_length: 50,
      })
      const data = response.data || []
      setNotifications(data)

      const unreadCount = data.filter(n => n.read === 0).length
      const readCount = data.filter(n => n.read === 1).length
      setCounts({ total: data.length, unread: unreadCount, read: readCount })
    } catch (error) {
      console.error('Failed to load notifications:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  // ==================== Realtime (Frappe socket.io) ====================
  // Apex uses a SignalR NotificationHub for instant delivery; the Frappe
  // equivalent is socket.io — `Notification Log.after_insert` does
  // `frappe.publish_realtime("notification", user=self.for_user)`
  // (apps/frappe/frappe/desk/doctype/notification_log/notification_log.py).
  // Subscribe to that event so a new notification refreshes the bell (and
  // the open list) immediately, without waiting for the poll interval above.
  useEffect(() => {
    let sock: any = null
    let handler: (() => void) | null = null
    let cancelled = false
    getFrappeSocket().then((s) => {
      if (cancelled || !s) return
      sock = s
      handler = () => {
        loadUnreadCount()
        if (open) loadNotifications()
      }
      s.on('notification', handler)
    })
    return () => {
      cancelled = true
      if (sock && handler) sock.off('notification', handler)
    }
  }, [open, loadUnreadCount, loadNotifications])

  // Load full list when panel opens + refresh every 60s while open (fallback
  // — realtime above covers new arrivals; this just catches read/delete
  // drift from other tabs/devices, or a dropped socket).
  useEffect(() => {
    if (open) loadNotifications()
  }, [open, loadNotifications])

  useEffect(() => {
    if (!open) return
    const interval = setInterval(loadNotifications, 60000)
    return () => clearInterval(interval)
  }, [open, loadNotifications])

  // ==================== Actions ====================

  const markAsRead = async (name: string) => {
    try {
      await frappeClient.call('frappe.client.set_value', {
        doctype: 'Notification Log',
        name,
        fieldname: 'read',
        value: 1,
      })
      // Optimistic update
      setNotifications(prev => prev.map(n => n.name === name ? { ...n, read: 1 } : n))
      setCounts(prev => ({
        ...prev,
        unread: Math.max(0, prev.unread - 1),
        read: prev.read + 1,
      }))
    } catch {
      toast({ title: 'خطأ', description: 'فشل تعليم الإشعار كمقروء', variant: 'destructive' })
    }
  }

  const markAllAsRead = async () => {
    const unread = notifications.filter(n => n.read === 0)
    if (unread.length === 0) return
    try {
      await Promise.all(
        unread.map(n =>
          frappeClient.call('frappe.client.set_value', {
            doctype: 'Notification Log',
            name: n.name,
            fieldname: 'read',
            value: 1,
          })
        )
      )
      // Optimistic update
      setNotifications(prev => prev.map(n => ({ ...n, read: 1 })))
      setCounts(prev => ({ ...prev, unread: 0, read: prev.total }))
      toast({ title: 'تم', description: 'تم تعليم جميع الإشعارات كمقروءة' })
    } catch {
      toast({ title: 'خطأ', description: 'فشل تعليم الإشعارات', variant: 'destructive' })
    }
  }

  const deleteNotification = async (name: string) => {
    try {
      const notif = notifications.find(n => n.name === name)
      await frappeClient.call('frappe.client.delete', {
        doctype: 'Notification Log',
        name,
      })
      // Optimistic update
      setNotifications(prev => prev.filter(n => n.name !== name))
      setCounts(prev => ({
        total: prev.total - 1,
        unread: notif?.read === 0 ? prev.unread - 1 : prev.unread,
        read: notif?.read === 1 ? prev.read - 1 : prev.read,
      }))
    } catch {
      toast({ title: 'خطأ', description: 'فشل حذف الإشعار', variant: 'destructive' })
    }
  }

  const clearAll = async () => {
    try {
      await Promise.all(
        notifications.map(n =>
          frappeClient.call('frappe.client.delete', {
            doctype: 'Notification Log',
            name: n.name,
          })
        )
      )
      setNotifications([])
      setCounts({ total: 0, unread: 0, read: 0 })
      toast({ title: 'تم', description: 'تم حذف جميع الإشعارات' })
    } catch {
      toast({ title: 'خطأ', description: 'فشل حذف الإشعارات', variant: 'destructive' })
    }
  }

  // ==================== Filtered List ====================

  const filteredNotifications = notifications.filter(n => {
    if (activeTab === 'unread') return n.read === 0
    if (activeTab === 'read') return n.read === 1
    return true
  })

  // ==================== Render ====================

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {counts.unread > 0 && (
            <span className="absolute -top-1 -right-1 h-5 min-w-5 rounded-full bg-red-500 text-white text-[10px] flex items-center justify-center font-bold px-1 animate-in zoom-in-50">
              {counts.unread > 99 ? '99+' : counts.unread}
            </span>
          )}
        </Button>
      </SheetTrigger>

      <SheetContent className="w-[420px] sm:w-[480px] p-0 flex flex-col">
        {/* Header */}
        <div className="p-5 pb-3 border-b">
          <SheetHeader className="mb-0">
            <div className="flex items-center justify-between">
              <div>
                <SheetTitle className="text-lg">الإشعارات</SheetTitle>
                <SheetDescription className="text-xs mt-0.5">
                  {counts.unread > 0
                    ? `${counts.unread} غير مقروء`
                    : 'لا توجد إشعارات جديدة'}
                </SheetDescription>
              </div>
              <div className="flex gap-1">
                {counts.unread > 0 && (
                  <Button variant="ghost" size="sm" onClick={markAllAsRead} className="text-xs h-8 px-2">
                    <CheckCheck className="h-3.5 w-3.5 ml-1" />
                    قراءة الكل
                  </Button>
                )}
                {counts.total > 0 && (
                  <Button variant="ghost" size="sm" onClick={clearAll} className="text-xs h-8 px-2 text-red-500 hover:text-red-600 hover:bg-red-50">
                    <Trash2 className="h-3.5 w-3.5 ml-1" />
                    حذف الكل
                  </Button>
                )}
              </div>
            </div>
          </SheetHeader>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-3">
            <TabsList className="grid w-full grid-cols-3 h-9">
              <TabsTrigger value="all" className="text-xs">
                الكل {counts.total > 0 && <span className="mr-1 text-gray-400">({counts.total})</span>}
              </TabsTrigger>
              <TabsTrigger value="unread" className="text-xs">
                غير مقروء {counts.unread > 0 && <span className="mr-1 text-red-400">({counts.unread})</span>}
              </TabsTrigger>
              <TabsTrigger value="read" className="text-xs">
                مقروء {counts.read > 0 && <span className="mr-1 text-gray-400">({counts.read})</span>}
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {/* Content */}
        <ScrollArea className="flex-1">
          <div className="p-3">
            {loading ? (
              <div className="space-y-3">
                {[...Array(4)].map((_, i) => (
                  <Skeleton key={i} className="h-[72px] w-full rounded-lg" />
                ))}
              </div>
            ) : filteredNotifications.length === 0 ? (
              <div className="text-center py-16">
                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Bell className="h-7 w-7 text-gray-300" />
                </div>
                <h3 className="text-sm font-medium text-gray-700 mb-1">
                  {activeTab === 'unread' ? 'لا توجد إشعارات جديدة' : 'لا توجد إشعارات'}
                </h3>
                <p className="text-xs text-gray-400">
                  {activeTab === 'unread' ? 'لقد قرأت جميع الإشعارات' : 'ستظهر الإشعارات هنا'}
                </p>
              </div>
            ) : (
              <div className="space-y-1.5">
                {filteredNotifications.map((notif) => {
                  const meta = getNotifMeta(notif.type, notif.document_type)
                  const isUnread = notif.read === 0
                  const docLabel = getDocTypeLabel(notif.document_type)

                  return (
                    <div
                      key={notif.name}
                      className={`group relative rounded-lg p-3 transition-colors ${
                        isUnread
                          ? 'bg-blue-50/60 hover:bg-blue-50'
                          : 'hover:bg-gray-50'
                      }`}
                    >
                      {/* Unread dot */}
                      {isUnread && (
                        <div className="absolute top-3 left-3 w-2 h-2 rounded-full bg-blue-500" />
                      )}

                      <div className="flex items-start gap-3">
                        {/* Icon */}
                        <div className={`mt-0.5 p-1.5 rounded-lg shrink-0 ${meta.color}`}>
                          {meta.icon}
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm leading-snug ${isUnread ? 'font-medium text-gray-900' : 'text-gray-700'}`}>
                            {notif.subject || 'بدون عنوان'}
                          </p>

                          {notif.email_content && (
                            <p className="text-xs text-gray-500 mt-1 line-clamp-2 leading-relaxed" dir="auto">
                              {notif.email_content.replace(/<[^>]*>/g, '').trim()}
                            </p>
                          )}

                          <div className="flex items-center gap-2 mt-1.5">
                            {docLabel && (
                              <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 font-normal">
                                {docLabel}
                              </Badge>
                            )}
                            <span className="text-[11px] text-gray-400">
                              {timeAgo(notif.creation)}
                            </span>
                          </div>
                        </div>

                        {/* Actions (appear on hover) */}
                        <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                          {isUnread && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-blue-500 hover:text-blue-600 hover:bg-blue-100"
                              onClick={() => markAsRead(notif.name)}
                              title="تعليم كمقروء"
                            >
                              <Check className="h-3.5 w-3.5" />
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-gray-400 hover:text-red-500 hover:bg-red-50"
                            onClick={() => deleteNotification(notif.name)}
                            title="حذف"
                          >
                            <X className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  )
}

'use client'

import { useState, useEffect } from 'react'
import { frappeImageUrl } from '@/lib/utils'
import { useRouter } from 'next/navigation'
import { Header } from '@/components/header'
import { useAuth } from '@/lib/auth-context'
import { useI18n } from '@/lib/i18n'
import { translateDepartment, translateEnum } from '@/lib/enums'
import { LoginPage } from '@/components/login-page'
import { getSystemUsers, assignHRManagerRole, removeHRManagerRole } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { useToast } from '@/hooks/use-toast'
import { Toaster } from '@/components/ui/toaster'
import {
  Shield, ShieldCheck, UserPlus, UserMinus,
  Loader2, AlertCircle, Search, Users, ArrowRight, ShieldAlert,
} from 'lucide-react'
import Image from 'next/image'

interface SystemUser {
  user_id: string
  full_name: string
  email: string
  user_image: string | null
  has_hr_manager: boolean
  is_current_user: boolean
  employee_name: string | null
  department: string | null
  designation: string | null
  company: string | null
}

function HRManagersContent({ embedded = false }: { embedded?: boolean }) {
  const { user, isAuthenticated, isLoading: authLoading, isHRManager } = useAuth()
  const { t, isRTL } = useI18n()
  const router = useRouter()
  const { toast } = useToast()

  const [users, setUsers] = useState<SystemUser[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  // Fetch system users
  const fetchUsers = async () => {
    try {
      setLoading(true)
      const data = await getSystemUsers()
      setUsers(data)
    } catch (err: any) {
      toast({
        title: isRTL ? 'خطأ' : 'Error',
        description: err.message || (isRTL ? 'فشل في جلب البيانات' : 'Failed to fetch data'),
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (isAuthenticated) {
      fetchUsers()
    }
  }, [isAuthenticated])

  // Assign HR Manager role
  const handleAssign = async (userId: string, fullName: string) => {
    if (!confirm(isRTL ? `هل تريد تعيين ${fullName} كمدير موارد بشرية؟` : `Assign ${fullName} as HR Manager?`)) return

    try {
      setActionLoading(userId)
      const result = await assignHRManagerRole(userId)
      toast({
        title: isRTL ? 'تم بنجاح ✅' : 'Success ✅',
        description: result.message || (isRTL ? `تم تعيين ${fullName} كمدير موارد بشرية` : `${fullName} assigned as HR Manager`),
      })
      await fetchUsers()
    } catch (err: any) {
      toast({
        title: isRTL ? 'خطأ' : 'Error',
        description: err.message || (isRTL ? 'فشل في تعيين الصلاحية' : 'Failed to assign role'),
        variant: 'destructive',
      })
    } finally {
      setActionLoading(null)
    }
  }

  // Remove HR Manager role
  const handleRemove = async (userId: string, fullName: string) => {
    if (!confirm(isRTL
      ? `هل تريد إزالة صلاحية مدير الموارد البشرية من ${fullName}؟\nلن يتمكن من الدخول لهذا النظام بعد الآن.`
      : `Remove HR Manager role from ${fullName}? They will lose access to this system.`)) return

    try {
      setActionLoading(userId)
      const result = await removeHRManagerRole(userId)
      toast({
        title: isRTL ? 'تم بنجاح ✅' : 'Success ✅',
        description: result.message || (isRTL ? `تم إزالة صلاحية HR Manager من ${fullName}` : `HR Manager role removed from ${fullName}`),
      })
      await fetchUsers()
    } catch (err: any) {
      toast({
        title: isRTL ? 'خطأ' : 'Error',
        description: err.message || (isRTL ? 'فشل في إزالة الصلاحية' : 'Failed to remove role'),
        variant: 'destructive',
      })
    } finally {
      setActionLoading(null)
    }
  }

  // Filter users by search
  const filteredUsers = users.filter(u =>
    u.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    u.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    u.employee_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    u.department?.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const hrManagers = filteredUsers.filter(u => u.has_hr_manager)
  const otherUsers = filteredUsers.filter(u => !u.has_hr_manager)

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/40">
        <div className="text-center">
          <Image src="/logo.jpeg" alt="Tamkeen" width={56} height={56} priority className="rounded-2xl mx-auto mb-4 animate-pulse shadow-lg" />
          <div className="w-8 h-8 border-[3px] border-primary border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
          <p className="text-sm text-muted-foreground/70">{t('app.connecting')}</p>
        </div>
      </div>
    )
  }

  if (!isAuthenticated) return <LoginPage />

  if (!isHRManager) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/40">
        <div className="text-center p-8">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <ShieldAlert className="h-8 w-8 text-red-500" />
          </div>
          <h2 className="text-xl font-bold text-foreground mb-2">{isRTL ? 'غير مصرح' : 'Unauthorized'}</h2>
          <p className="text-muted-foreground mb-4">{isRTL ? 'هذه الصفحة لمديري الموارد البشرية فقط' : 'HR Manager access only'}</p>
          <button onClick={() => router.push('/')} className="px-4 py-2 bg-primary text-white rounded-lg text-sm hover:bg-primary/90">
            {isRTL ? 'العودة للرئيسية' : 'Back to Home'}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className={embedded ? '' : 'flex flex-col h-screen bg-[#f8f9fb]'}>
      {!embedded && <Header />}
      <main className={embedded ? '' : 'flex-1 overflow-auto'}>
        <div className={`max-w-4xl mx-auto p-6 md:p-8${embedded ? ' pb-0' : ''}`}>

          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2.5 text-foreground">
                <div className="w-9 h-9 bg-accent rounded-xl flex items-center justify-center">
                  <Shield className="w-5 h-5 text-primary" />
                </div>
                {isRTL ? 'إدارة صلاحيات الموارد البشرية' : 'HR Manager Permissions'}
              </h1>
              <p className="text-muted-foreground mt-1.5 text-sm">
                {isRTL ? 'تعيين أو إزالة صلاحية مدير الموارد البشرية من الموظفين' : 'Assign or remove HR Manager role from employees'}
              </p>
            </div>
            {!embedded && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => router.push('/')}
              className="gap-1.5"
            >
              {isRTL ? (
                <>
                  <ArrowRight className="w-4 h-4" />
                  رجوع
                </>
              ) : (
                <>
                  Back
                  <ArrowRight className="w-4 h-4 rotate-180" />
                </>
              )}
            </Button>
            )}
          </div>

          {/* Search */}
          <div className="relative mb-6">
            <Search className={`absolute ${isRTL ? 'right-3.5' : 'left-3.5'} top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-muted-foreground/70`} />
            <input
              type="text"
              placeholder={isRTL ? 'ابحث بالاسم أو الإيميل أو القسم...' : 'Search by name, email or department...'}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={`w-full ${isRTL ? 'pr-10 pl-4' : 'pl-10 pr-4'} py-3 border border-border rounded-xl bg-card focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-ring text-sm transition-all`}
              dir={isRTL ? 'rtl' : 'ltr'}
            />
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="text-center">
                <div className="w-8 h-8 border-[3px] border-primary border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
                <p className="text-sm text-muted-foreground/70">{isRTL ? 'جاري التحميل...' : 'Loading...'}</p>
              </div>
            </div>
          ) : (
            <>
              {/* HR Managers Section */}
              <div className="mb-8">
                <h2 className="text-base font-semibold mb-3 flex items-center gap-2 text-green-700">
                  <ShieldCheck className="w-5 h-5" />
                  {isRTL ? `مدراء الموارد البشرية الحاليين (${hrManagers.length})` : `Current HR Managers (${hrManagers.length})`}
                </h2>
                <div className="bg-card rounded-2xl shadow-sm border border-border/60 overflow-hidden">
                  {hrManagers.length === 0 ? (
                    <div className="p-8 text-center text-muted-foreground/70 text-sm">
                      {isRTL ? 'لا يوجد مدراء موارد بشرية مطابقين للبحث' : 'No HR Managers match your search'}
                    </div>
                  ) : (
                    hrManagers.map((u, i) => (
                      <div key={u.user_id} className={`p-4 flex items-center justify-between hover:bg-muted/30 transition-colors ${i > 0 ? 'border-t border-border/60' : ''}`}>
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-green-50 flex items-center justify-center flex-shrink-0 border border-green-100">
                            {u.user_image ? (
                              <img src={frappeImageUrl(u.user_image)} alt="" className="w-10 h-10 rounded-full object-cover" onError={(e) => { e.currentTarget.style.display = 'none' }} />
                            ) : (
                              <ShieldCheck className="w-5 h-5 text-green-600" />
                            )}
                          </div>
                          <div className="min-w-0">
                            <div className="font-medium text-foreground flex items-center gap-2 flex-wrap">
                              <span className="truncate">{u.full_name}</span>
                              <span className="text-[10px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full font-medium flex-shrink-0">
                                HR Manager
                              </span>
                              {u.is_current_user && (
                                <span className="text-[10px] bg-accent text-primary px-1.5 py-0.5 rounded-full font-medium flex-shrink-0">
                                  {isRTL ? 'أنت' : 'You'}
                                </span>
                              )}
                            </div>
                            <div className="text-xs text-muted-foreground mt-0.5 truncate">
                              {u.email}
                              {u.department && ` · ${translateDepartment(u.department, isRTL ? 'ar' : 'en')}`}
                              {u.designation && ` · ${translateEnum('designation', u.designation, isRTL ? 'ar' : 'en')}`}
                            </div>
                          </div>
                        </div>

                        {u.is_current_user ? (
                          <span className="text-[11px] text-muted-foreground/70 flex-shrink-0">
                            {isRTL ? 'لا يمكن إزالة نفسك' : "Can't remove yourself"}
                          </span>
                        ) : (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleRemove(u.user_id, u.full_name)}
                            disabled={actionLoading === u.user_id}
                            className="text-red-600 border-red-200 hover:bg-red-50 hover:border-red-300 flex-shrink-0 h-8 text-xs"
                          >
                            {actionLoading === u.user_id ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <>
                                <UserMinus className="w-3.5 h-3.5 ml-1" />
                                {isRTL ? 'إزالة' : 'Remove'}
                              </>
                            )}
                          </Button>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Other Employees Section */}
              <div>
                <h2 className="text-base font-semibold mb-3 flex items-center gap-2 text-foreground/90">
                  <Users className="w-5 h-5" />
                  {isRTL ? `الموظفون (${otherUsers.length})` : `Employees (${otherUsers.length})`}
                </h2>
                <div className="bg-card rounded-2xl shadow-sm border border-border/60 overflow-hidden">
                  {otherUsers.length === 0 ? (
                    <div className="p-8 text-center text-muted-foreground/70 text-sm">
                      {isRTL ? 'لا يوجد موظفين مطابقين للبحث' : 'No employees match your search'}
                    </div>
                  ) : (
                    otherUsers.map((u, i) => (
                      <div key={u.user_id} className={`p-4 flex items-center justify-between hover:bg-muted/30 transition-colors ${i > 0 ? 'border-t border-border/60' : ''}`}>
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                            {u.user_image ? (
                              <img src={frappeImageUrl(u.user_image)} alt="" className="w-10 h-10 rounded-full object-cover" onError={(e) => { e.currentTarget.style.display = 'none' }} />
                            ) : (
                              <span className="text-sm font-medium text-muted-foreground">
                                {u.full_name?.charAt(0)?.toUpperCase() || '?'}
                              </span>
                            )}
                          </div>
                          <div className="min-w-0">
                            <div className="font-medium text-foreground truncate">{u.full_name}</div>
                            <div className="text-xs text-muted-foreground mt-0.5 truncate">
                              {u.email}
                              {u.department && ` · ${translateDepartment(u.department, isRTL ? 'ar' : 'en')}`}
                              {u.designation && ` · ${translateEnum('designation', u.designation, isRTL ? 'ar' : 'en')}`}
                            </div>
                          </div>
                        </div>

                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleAssign(u.user_id, u.full_name)}
                          disabled={actionLoading === u.user_id}
                          className="text-green-600 border-green-200 hover:bg-green-50 hover:border-green-300 flex-shrink-0 h-8 text-xs"
                        >
                          {actionLoading === u.user_id ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <>
                              <UserPlus className="w-3.5 h-3.5 ml-1" />
                              {isRTL ? 'تعيين HR Manager' : 'Assign HR Manager'}
                            </>
                          )}
                        </Button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </main>
      <Toaster />
    </div>
  )
}

export default function HRManagersPage() {
  // `embedded` skips the component's own <Header> + full-height wrapper — the Jisr
  // shell (HrShell) provides the top bar + rail now. The stricter HR-Manager gate
  // stays inside HRManagersContent (HrGuard only enforces base HR access).
  return <HRManagersContent embedded />
}

export { HRManagersContent as HRManagersPanel }

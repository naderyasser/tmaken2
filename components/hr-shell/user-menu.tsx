'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { UserCircle, Settings as SettingsIcon, Shield, Building2, ChevronDown, LogOut } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useI18n } from '@/lib/i18n'
import { useAuthSafe } from '@/lib/auth-context'
import { useCompanySafe } from '@/hooks/use-company'
import { frappeImageUrl } from '@/lib/utils'
import { useToast } from '@/hooks/use-toast'

/** Account menu for the HR topbar — port of the legacy Header user dropdown. */
export function UserMenu() {
  const { t } = useI18n()
  const { user, logout: authLogout, isAdmin } = useAuthSafe()
  const { company: activeCompany } = useCompanySafe()
  const router = useRouter()
  const { toast } = useToast()

  const handleLogout = async () => {
    try {
      await authLogout()
    } catch (e) {
      console.error('Logout error:', e)
    } finally {
      // Force-clear cookies client-side as a safety net (mirrors legacy Header).
      document.cookie = 'sid=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT'
      document.cookie = 'user_id=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT'
      document.cookie = 'system_user=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT'
      document.cookie = 'user_image=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT'
      document.cookie = 'full_name=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT'
      toast({ title: t('header.logout_success_title'), description: t('header.logout_success_desc') })
      router.push('/login')
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="h-9 px-2.5 rounded-lg flex items-center gap-2 text-foreground hover:bg-accent">
          {user?.user_image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={frappeImageUrl(user.user_image)} alt="" className="w-7 h-7 rounded-lg object-cover" />
          ) : (
            <div className="w-7 h-7 bg-primary rounded-lg flex items-center justify-center text-primary-foreground text-xs font-semibold">
              {user?.full_name?.charAt(0)?.toUpperCase() || 'A'}
            </div>
          )}
          <span className="hidden sm:inline text-sm font-medium">{user?.full_name || t('header.admin')}</span>
          {activeCompany && (
            <span className="hidden md:inline-flex text-[10px] bg-accent text-primary px-1.5 py-0.5 rounded-full font-medium items-center gap-1 max-w-[120px] truncate" title={activeCompany}>
              <Building2 className="h-3 w-3 flex-shrink-0" />{activeCompany}
            </span>
          )}
          {isAdmin && (
            <span className="hidden md:inline-flex text-[10px] bg-success/15 text-success px-1.5 py-0.5 rounded-full font-medium items-center gap-1">
              <Shield className="h-3 w-3" />{t('header.admin')}
            </span>
          )}
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="flex flex-col">
          <span>{user?.full_name || t('header.my_account')}</span>
          <span className="text-xs font-normal text-muted-foreground">{user?.email}</span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/profile" className="flex items-center cursor-pointer"><UserCircle className="me-2 h-4 w-4" /><span>{t('ssp.my_profile')}</span></Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/hr-settings" className="flex items-center cursor-pointer"><SettingsIcon className="me-2 h-4 w-4" /><span>{t('header.hr_settings')}</span></Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/hr-managers" className="flex items-center cursor-pointer"><Shield className="me-2 h-4 w-4" /><span>{t('header.permissions')}</span></Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleLogout} className="text-destructive focus:text-destructive cursor-pointer">
          <LogOut className="me-2 h-4 w-4" /><span>{t('header.logout')}</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

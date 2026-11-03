'use client'

// Ported from egarsys src/components/app-sidebar.tsx — trimmed to the rentals
// sections (dashboard/contracts/invoices/properties/tenants). Reuses the
// platform's own shadcn Sidebar primitives (v3), coloured by the scoped
// egarsys sidebar tokens. Same right-side, offcanvas, emerald-active treatment.

import {
  Building2,
  LayoutDashboard,
  Users,
  FileText,
  Receipt,
  Printer,
  FileSearch,
  ShieldCheck,
  Archive,
  Calculator,
  UsersRound,
  Sun,
  Moon,
} from 'lucide-react'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  SidebarSeparator,
  useSidebar,
} from '@/components/ui/sidebar'
import { useRentalsShell } from '@/components/rentals/egarsys/store'

const navItems = [
  { id: 'dashboard', label: 'لوحة التحكم', icon: LayoutDashboard },
  { id: 'contracts', label: 'العقود', icon: FileText },
  { id: 'ended-contracts', label: 'أرشيف العقود', icon: Archive },
  { id: 'contracts-summary', label: 'مختصر العقارات', icon: Printer },
  { id: 'property-statement', label: 'جرد العقارات', icon: FileSearch },
  { id: 'invoices', label: 'الفواتير', icon: Receipt },
  { id: 'zatca', label: 'الفوترة الإلكترونية', icon: ShieldCheck },
  { id: 'properties', label: 'العقارات', icon: Building2 },
  { id: 'tenants', label: 'المستأجرون', icon: Users },
  { id: 'accounting', label: 'المحاسبة', icon: Calculator },
  { id: 'hr', label: 'الموارد البشرية', icon: UsersRound },
]

export default function AppSidebar() {
  const { currentSection, setCurrentSection, companyName, theme, toggleTheme, mounted } =
    useRentalsShell()
  const { isMobile, setOpenMobile } = useSidebar()

  const handleNavClick = (sectionId: string) => {
    setCurrentSection(sectionId)
    if (isMobile) setOpenMobile(false)
  }

  return (
    <Sidebar side="right" collapsible="offcanvas" className="border-l border-sidebar-border">
      <SidebarHeader className="px-4 pb-4 pt-[max(1rem,env(safe-area-inset-top))]">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" className="hover:bg-sidebar-accent overflow-hidden">
              <div className="flex items-center justify-center shrink-0">
                <img
                  src="/rentals-native/logo.jpg"
                  alt="مينا العقارية"
                  className="h-10 w-auto object-contain rounded"
                />
              </div>
              <div className="flex flex-col gap-0.5 leading-none">
                <span className="font-bold text-lg">{companyName || 'اسم الشركة'}</span>
                <span className="text-[11px] text-muted-foreground font-medium">إدارة العقارات</span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarSeparator />

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => {
                const isActive = currentSection === item.id
                return (
                  <SidebarMenuItem key={item.id}>
                    <SidebarMenuButton
                      isActive={isActive}
                      onClick={() => handleNavClick(item.id)}
                      tooltip={item.label}
                      className={`cursor-pointer ${
                        isActive
                          ? 'border-r-[3px] border-emerald-500 bg-emerald-50/70 dark:bg-emerald-950/40'
                          : ''
                      }`}
                    >
                      <item.icon className={`size-4 ${isActive ? 'text-emerald-600 dark:text-emerald-400' : ''}`} />
                      <span>{item.label}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarSeparator />

      <SidebarFooter className="px-3 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <SidebarMenu>
          {mounted && (
            <SidebarMenuItem>
              <SidebarMenuButton
                onClick={toggleTheme}
                tooltip={theme === 'dark' ? 'الوضع النهاري' : 'الوضع الليلي'}
                className="cursor-pointer"
              >
                {theme === 'dark' ? <Sun className="size-4" /> : <Moon className="size-4" />}
                <span>{theme === 'dark' ? 'الوضع النهاري' : 'الوضع الليلي'}</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          )}
        </SidebarMenu>

        <div className="text-[10px] text-muted-foreground text-center pt-1 group-data-[collapsible=icon]:hidden">
          تم التطوير بواسطة مينا العقارية — الإصدار V1.0
        </div>
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  )
}

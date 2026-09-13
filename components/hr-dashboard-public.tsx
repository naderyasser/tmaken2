'use client'

import {
  LayoutDashboard,
  Database,
  Users,
  Clock,
  CalendarDays,
  Wallet,
  BarChart3,
  Settings,
  Bell,
  UserCircle2,
  CalendarRange,
  Building2,
  CheckCircle2,
  XCircle,
  CalendarOff,
  PlaneTakeoff,
  Banknote,
} from 'lucide-react'
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts'

/**
 * Public (guest-accessible) HR dashboard — rendered by the existing HR page for
 * the bare `/hr` dashboard surface. Fully self-contained: own blue chrome + dummy
 * data, ZERO calls to the Frappe backend. This is a presentation mock-up used by
 * the "Tamkeen proposed version" (tamkeen-v2), so the shared backend is untouched.
 *
 * Kept separate from `components/hr-dashboard.tsx` on purpose: that component is
 * also mounted inside the egarsys native shell and must stay content-only.
 */

const TOTAL_EMPLOYEES = 63

const stats = [
  { key: 'present', label: 'حضور', value: 48, icon: CheckCircle2, color: '#16a34a', bg: '#dcfce7' },
  { key: 'absent', label: 'غياب', value: 6, icon: XCircle, color: '#dc2626', bg: '#fee2e2' },
  { key: 'weekly', label: 'عطلة أسبوعية', value: 5, icon: CalendarOff, color: '#2563eb', bg: '#dbeafe' },
  { key: 'official', label: 'عطلات رسمية', value: 1, icon: Banknote, color: '#7c3aed', bg: '#ede9fe' },
  { key: 'leave', label: 'إجازات', value: 3, icon: PlaneTakeoff, color: '#d97706', bg: '#fef3c7' },
]

const departments = [
  { name: 'الإدارة', value: 8, fill: '#1d4ed8' },
  { name: 'المبيعات', value: 18, fill: '#0e7490' },
  { name: 'العمليات', value: 22, fill: '#0E6E62' },
  { name: 'المالية', value: 7, fill: '#b45309' },
  { name: 'الموارد البشرية', value: 8, fill: '#7c3aed' },
]

const branchesData = [
  { name: 'الرياض', present: 20, absent: 2, leave: 1 },
  { name: 'جدة', present: 12, absent: 2, leave: 1 },
  { name: 'الدمام', present: 8, absent: 1, leave: 1 },
  { name: 'مكة المكرمة', present: 5, absent: 1, leave: 0 },
  { name: 'المدينة المنورة', present: 3, absent: 0, leave: 0 },
]

const movements = [
  { name: 'أحمد العتيبي', id: 'EMP-1001', branch: 'الرياض', checkin: '08:02', checkout: '16:31', status: 'حاضر' },
  { name: 'سارة القحطاني', id: 'EMP-1014', branch: 'جدة', checkin: '08:15', checkout: '16:05', status: 'حاضر' },
  { name: 'محمد الشهري', id: 'EMP-1022', branch: 'الدمام', checkin: '—', checkout: '—', status: 'غائب' },
  { name: 'نورة الحربي', id: 'EMP-1030', branch: 'الرياض', checkin: '09:10', checkout: '16:45', status: 'تأخير' },
  { name: 'خالد الغامدي', id: 'EMP-1045', branch: 'مكة المكرمة', checkin: '—', checkout: '—', status: 'إجازة' },
  { name: 'ريم الدوسري', id: 'EMP-1052', branch: 'الرياض', checkin: '07:55', checkout: '16:20', status: 'حاضر' },
]

const statusStyles: Record<string, string> = {
  'حاضر': 'bg-green-100 text-green-700',
  'غائب': 'bg-red-100 text-red-700',
  'تأخير': 'bg-amber-100 text-amber-700',
  'إجازة': 'bg-blue-100 text-blue-700',
}

const navItems = [
  { label: 'لوحة التحكم', icon: LayoutDashboard, active: true },
  { label: 'البيانات الأساسية', icon: Database, active: false },
  { label: 'الموظفون', icon: Users, active: false },
  { label: 'الحضور والانصراف', icon: Clock, active: false },
  { label: 'الإجازات', icon: CalendarDays, active: false },
  { label: 'الرواتب', icon: Wallet, active: false },
  { label: 'التقارير', icon: BarChart3, active: false },
  { label: 'الإعدادات', icon: Settings, active: false },
]

export function PublicHrDashboard() {
  return (
    <div dir="rtl" className="min-h-screen bg-slate-100 font-[family-name:var(--font-arabic)]">
      <div className="flex min-h-screen">
        {/* ── Sidebar (dark blue) — first child in RTL = right edge ── */}
        <aside className="hidden w-64 shrink-0 flex-col bg-[#0b2545] text-white md:flex">
          <div className="flex items-center gap-3 border-b border-white/10 px-5 py-5">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/10">
              <Building2 className="h-6 w-6" />
            </div>
            <div className="leading-tight">
              <p className="text-sm font-bold">نظام الموارد البشرية</p>
              <p className="text-[11px] text-white/60">تمكين - النسخة المطروحة</p>
            </div>
          </div>
          <nav className="mt-3 flex-1 space-y-1 px-3">
            {navItems.map((item) => {
              const Icon = item.icon
              return (
                <div
                  key={item.label}
                  style={item.active ? { backgroundColor: '#2563eb' } : undefined}
                  className={
                    'flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors ' +
                    (item.active
                      ? 'font-semibold text-white shadow-sm'
                      : 'text-white/75 hover:bg-white/10 hover:text-white')
                  }
                >
                  <Icon className="h-[18px] w-[18px]" />
                  <span>{item.label}</span>
                </div>
              )
            })}
          </nav>
          <div className="border-t border-white/10 px-5 py-4 text-[11px] text-white/50">
            © 2026 جميع الحقوق محفوظة
          </div>
        </aside>

        {/* ── Main column ── */}
        <div className="flex min-w-0 flex-1 flex-col">
          {/* Top bar (blue) */}
          <header
            style={{ backgroundColor: '#1d4ed8' }}
            className="flex items-center justify-between gap-4 px-5 py-3 text-white shadow-sm"
          >
            <div className="flex items-center gap-3">
              <Building2 className="h-6 w-6" />
              <div className="leading-tight">
                <p className="text-sm font-bold">مؤسسة تمكين</p>
                <p className="text-[11px] text-white/70">لوحة تحكم الموارد البشرية</p>
              </div>
            </div>
            <div className="flex items-center gap-2 sm:gap-4">
              <div className="hidden items-center gap-2 rounded-lg bg-white/10 px-3 py-1.5 text-xs sm:flex">
                <CalendarRange className="h-4 w-4" />
                <span>الفترة المالية 2026</span>
              </div>
              <button className="relative rounded-lg bg-white/10 p-2 transition-colors hover:bg-white/20" aria-label="الإشعارات">
                <Bell className="h-5 w-5" />
                <span className="absolute -left-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold">
                  3
                </span>
              </button>
              <div className="flex items-center gap-2 rounded-lg bg-white/10 px-3 py-1.5">
                <UserCircle2 className="h-5 w-5" />
                <span className="text-xs">بيانات مدير النظام</span>
              </div>
            </div>
          </header>

          <main className="flex-1 space-y-6 p-4 sm:p-6">
            {/* ── ملخص حضور اليوم — 5 stat cards ── */}
            <section>
              <h2 className="mb-3 text-base font-bold text-slate-700">ملخص حضور اليوم</h2>
              <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5">
                {stats.map((s) => {
                  const Icon = s.icon
                  return (
                    <div
                      key={s.key}
                      className="flex items-center justify-between rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200/60 transition-shadow hover:shadow-md"
                    >
                      <div>
                        <p className="text-xs text-slate-500">{s.label}</p>
                        <p className="mt-1 text-2xl font-bold text-slate-800">{s.value}</p>
                      </div>
                      <div
                        className="flex h-11 w-11 items-center justify-center rounded-full"
                        style={{ backgroundColor: s.bg }}
                      >
                        <Icon className="h-6 w-6" style={{ color: s.color }} />
                      </div>
                    </div>
                  )
                })}
              </div>
            </section>

            {/* ── Charts row ── */}
            <section className="grid grid-cols-1 gap-6 lg:grid-cols-3">
              {/* Doughnut — total employees 63 */}
              <div className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-slate-200/60">
                <h2 className="mb-2 text-sm font-bold text-slate-700">إجمالي الموظفين</h2>
                <div className="relative h-56">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={departments}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={88}
                        paddingAngle={2}
                        stroke="none"
                        isAnimationActive={false}
                      >
                        {departments.map((d) => (
                          <Cell key={d.name} fill={d.fill} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{ direction: 'rtl', borderRadius: 8, fontSize: 12 }}
                        formatter={(v: number, n: string) => [`${v}`, n]}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-3xl font-extrabold text-slate-800">{TOTAL_EMPLOYEES}</span>
                    <span className="text-[11px] text-slate-500">موظف</span>
                  </div>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5">
                  {departments.map((d) => (
                    <div key={d.name} className="flex items-center gap-2 text-xs text-slate-600">
                      <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: d.fill }} />
                      <span className="truncate">{d.name}</span>
                      <span className="ms-auto font-medium text-slate-500">{d.value}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Stacked bar — attendance by branch */}
              <div className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-slate-200/60 lg:col-span-2">
                <h2 className="mb-4 text-sm font-bold text-slate-700">
                  الحضور والغياب والإجازات حسب الفروع
                </h2>
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={branchesData} barSize={34}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                      <XAxis dataKey="name" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 12 }} axisLine={false} tickLine={false} width={28} />
                      <Tooltip
                        contentStyle={{ direction: 'rtl', borderRadius: 8, fontSize: 12 }}
                        cursor={{ fill: 'rgba(148,163,184,0.1)' }}
                      />
                      <Legend wrapperStyle={{ fontSize: 12, direction: 'rtl' }} iconType="circle" />
                      <Bar dataKey="present" name="حضور" stackId="a" fill="#16a34a" isAnimationActive={false} />
                      <Bar dataKey="absent" name="غياب" stackId="a" fill="#dc2626" isAnimationActive={false} />
                      <Bar dataKey="leave" name="إجازات" stackId="a" fill="#d97706" radius={[6, 6, 0, 0]} isAnimationActive={false} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </section>

            {/* ── Bottom table: Sunday movements ── */}
            <section className="rounded-xl bg-white shadow-sm ring-1 ring-slate-200/60">
              <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
                <h2 className="text-sm font-bold text-slate-700">حركات يوم الأحد</h2>
                <span className="rounded-full bg-slate-100 px-3 py-1 text-[11px] text-slate-500">
                  {movements.length} سجل
                </span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] text-right text-sm">
                  <thead>
                    <tr className="bg-slate-50 text-xs text-slate-500">
                      <th className="px-5 py-3 font-medium">الموظف</th>
                      <th className="px-5 py-3 font-medium">الرقم الوظيفي</th>
                      <th className="px-5 py-3 font-medium">الفرع</th>
                      <th className="px-5 py-3 font-medium">وقت الحضور</th>
                      <th className="px-5 py-3 font-medium">وقت الانصراف</th>
                      <th className="px-5 py-3 font-medium">الحالة</th>
                    </tr>
                  </thead>
                  <tbody>
                    {movements.map((m) => (
                      <tr key={m.id} className="border-t border-slate-100 hover:bg-slate-50/60">
                        <td className="px-5 py-3 font-medium text-slate-700">{m.name}</td>
                        <td className="px-5 py-3 text-slate-500">{m.id}</td>
                        <td className="px-5 py-3 text-slate-500">{m.branch}</td>
                        <td className="px-5 py-3 tabular-nums text-slate-600">{m.checkin}</td>
                        <td className="px-5 py-3 tabular-nums text-slate-600">{m.checkout}</td>
                        <td className="px-5 py-3">
                          <span className={'rounded-full px-2.5 py-1 text-xs font-medium ' + (statusStyles[m.status] || 'bg-slate-100 text-slate-600')}>
                            {m.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </main>
        </div>
      </div>
    </div>
  )
}

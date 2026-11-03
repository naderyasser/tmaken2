'use client'

import React from 'react'
import { Users, UserPlus, Network, MapPin, Building, ClipboardCheck, Clock, FileClock, Fingerprint, CalendarOff, PieChart, Calendar, Receipt, Banknote, CreditCard, Settings, Briefcase, CircleUser as FileUser, MessageSquare, Award, BarChart2, Search, Bell } from 'lucide-react'
import { Button } from '@/components/ui/button'

// Stats data
const statsCards = [
  { title: 'Total Employees', value: '248', trend: '↑ 12%', color: 'bg-blue-600' },
  { title: 'On Leave Today', value: '8', trend: '↓ 2', color: 'bg-orange-600' },
  { title: 'New Joiners (Month)', value: '5', trend: '↑ 25%', color: 'bg-green-600' },
  { title: 'Pending Approvals', value: '12', trend: '⟳ 3 new', color: 'bg-purple-600' },
]

// Card sections with all required content
const cardSections = [
  {
    title: 'Workforce & Lifecycle',
    cards: [
      {
        id: 'all-employees',
        title: 'All Employees',
        description: 'View active employee directory.',
        icon: Users,
        url: '/app/List/Employee/view/cards',
      },
      {
        id: 'onboard-new',
        title: 'Onboard New',
        description: 'Register a new hire.',
        icon: UserPlus,
        url: '/app/employee/new-employee-1',
      },
      {
        id: 'org-chart',
        title: 'Org Chart',
        description: 'Visual hierarchy tree.',
        icon: Network,
        url: '/app/organizational-chart',
      },
      {
        id: 'geo-map',
        title: 'Geo Map',
        description: 'Track field employees.',
        icon: MapPin,
        url: '/app/employee-location-map',
      },
      {
        id: 'departments',
        title: 'Departments',
        description: 'Manage organization units.',
        icon: Building,
        url: '/app/department',
      },
    ],
  },
  {
    title: 'Time, Shifts & Attendance',
    cards: [
      {
        id: 'attendance-logs',
        title: 'Attendance Logs',
        description: 'View attendance records.',
        icon: ClipboardCheck,
        url: '/app/List/Attendance/view/cards',
      },
      {
        id: 'shift-manager',
        title: 'Shift Manager',
        description: 'Manage rosters and shifts.',
        icon: Clock,
        url: '/app/shift-&-attendance',
      },
      {
        id: 'timesheets',
        title: 'Timesheets',
        description: 'Track time entries.',
        icon: FileClock,
        url: '/app/List/Timesheet/view/cards',
      },
      {
        id: 'checkin-tool',
        title: 'Check-in Tool',
        description: 'Employee check-ins.',
        icon: Fingerprint,
        url: '/app/employee-checkin',
      },
    ],
  },
  {
    title: 'Leave Management',
    cards: [
      {
        id: 'leave-requests',
        title: 'Leave Requests',
        description: 'Approve or reject applications.',
        icon: CalendarOff,
        url: '/app/List/Leave%20Application/view/cards',
      },
      {
        id: 'leave-balance',
        title: 'Leave Balance',
        description: 'View employee balances.',
        icon: PieChart,
        url: '/app/query-report/Employee%20Leave%20Balance',
      },
      {
        id: 'holiday-calendar',
        title: 'Holiday Calendar',
        description: 'Manage holidays.',
        icon: Calendar,
        url: '/app/holiday-list',
      },
    ],
  },
  {
    title: 'Payroll & Finance',
    cards: [
      {
        id: 'salary-slips',
        title: 'Salary Slips',
        description: 'View salary documents.',
        icon: Receipt,
        url: '/app/List/Salary%20Slip/view/cards',
      },
      {
        id: 'payroll-entry',
        title: 'Payroll Entry',
        description: 'Process monthly salaries.',
        icon: Banknote,
        url: '/app/payroll-entry',
      },
      {
        id: 'expense-claims',
        title: 'Expense Claims',
        description: 'Manage employee expenses.',
        icon: CreditCard,
        url: '/app/List/Expense%20Claim/view/cards',
      },
      {
        id: 'salary-structure',
        title: 'Salary Structure',
        description: 'Configure pay structure.',
        icon: Settings,
        url: '/app/salary-structure',
      },
    ],
  },
  {
    title: 'Recruitment',
    cards: [
      {
        id: 'job-openings',
        title: 'Job Openings',
        description: 'Create job vacancies.',
        icon: Briefcase,
        url: '/app/job-opening',
      },
      {
        id: 'applicants',
        title: 'Applicants',
        description: 'Track candidates.',
        icon: FileUser,
        url: '/app/List/Job%20Applicant/view/cards',
      },
      {
        id: 'interviews',
        title: 'Interviews',
        description: 'Schedule interviews.',
        icon: MessageSquare,
        url: '/app/interview',
      },
    ],
  },
  {
    title: 'Performance & Reports',
    cards: [
      {
        id: 'appraisals',
        title: 'Appraisals',
        description: 'Performance reviews.',
        icon: Award,
        url: '/app/appraisal',
      },
      {
        id: 'key-reports',
        title: 'Key Reports',
        description: 'Employee analytics.',
        icon: BarChart2,
        url: '/app/query-report/Employee%20Analytics',
      },
    ],
  },
]

function StatCard({ title, value, trend, color }: { title: string; value: string; trend: string; color: string }) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
      <p className="text-sm font-medium text-gray-600 mb-2">{title}</p>
      <div className="flex items-baseline justify-between">
        <p className="text-3xl font-bold text-gray-900">{value}</p>
        <div className={`${color} p-3 rounded-lg text-white`}>
          <div className="w-5 h-5" />
        </div>
      </div>
      <p className="text-xs font-medium text-green-600 mt-3">{trend}</p>
    </div>
  )
}

function ActionCard({
  title,
  description,
  icon: Icon,
  url,
}: {
  title: string
  description: string
  icon: React.ElementType
  url: string
}) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm hover:shadow-md hover:border-blue-300 hover:scale-105 transition-all duration-200 flex flex-col gap-4 group cursor-pointer"
    >
      <div className="flex items-start justify-between">
        <div className="bg-blue-50 p-3 rounded-lg group-hover:bg-blue-100 transition-colors">
          <Icon className="h-6 w-6 text-blue-600" />
        </div>
      </div>
      <div>
        <h3 className="text-sm font-semibold text-gray-900 mb-1">{title}</h3>
        <p className="text-xs text-gray-600">{description}</p>
      </div>
    </a>
  )
}

export function EmployeesDashboard() {
  return (
    <main className="flex-1 overflow-auto bg-gray-50">
      <div className="p-8">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Employee Management Hub</h1>
            <p className="text-sm text-gray-600 mt-1">Central control for workforce, attendance, and payroll.</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative hidden md:block">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search..."
                className="pl-10 pr-4 py-2 rounded-full bg-gray-200 text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 w-48"
              />
            </div>
            <Button variant="ghost" size="icon" className="text-gray-600 hover:bg-white">
              <Bell className="h-5 w-5" />
            </Button>
          </div>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {statsCards.map((stat) => (
            <StatCard key={stat.title} {...stat} />
          ))}
        </div>

        {/* Card Sections */}
        {cardSections.map((section) => (
          <div key={section.title} className="mb-8">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">{section.title}</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {section.cards.map((card) => (
                <ActionCard key={card.id} title={card.title} description={card.description} icon={card.icon} url={card.url} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </main>
  )
}

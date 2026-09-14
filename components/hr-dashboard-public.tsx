'use client'

import {
  CalendarDays,
  Gift,
  AlertTriangle,
  CheckSquare,
  ArrowUpFromLine,
  Info
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
  Legend
} from 'recharts'

const TOTAL_EMPLOYEES = 63

const stats = [
  { key: 'leave', label: 'الاجازات', value: 0, icon: ArrowUpFromLine, color: '#2eaf7d' },
  { key: 'official', label: 'عطلات رسمية', value: 0, icon: Gift, color: '#808080' },
  { key: 'weekly', label: 'عطله إسبوعية', value: 0, icon: CalendarDays, color: '#808080' },
  { key: 'absent', label: 'الغياب', value: 2, icon: AlertTriangle, color: '#ff0000' },
  { key: 'present', label: 'حضور', value: 15, icon: CheckSquare, color: '#2960b6' },
]

const departments = [
  { name: 'حضور', value: 45, fill: '#497cff' },
  { name: 'غياب', value: 15, fill: '#dc3545' },
  { name: 'اجازات', value: 3, fill: '#34c75a' },
]

const branchesData = [
  { name: 'الادارة', present: 7, absent: 2, leave: 1, waiting: 6 },
  { name: 'فرع الشارع التجاري', present: 1, absent: 0, leave: 1, waiting: 5 },
  { name: 'فرع صناعية السليم', present: 3, absent: 0, leave: 0, waiting: 10 },
  { name: 'فرع عنيزة', present: 0, absent: 0, leave: 0, waiting: 3 },
  { name: 'فرع الرداف', present: 0, absent: 0, leave: 0, waiting: 5 },
  { name: 'فرع شارع الأربعين', present: 2, absent: 0, leave: 0, waiting: 12 },
  { name: 'السليم الجديد فرع 12', present: 1, absent: 0, leave: 0, waiting: 4 },
]

const movements = [
  { id: 31, name: 'محمد ميزان الرحمن', time: '22:06:56 09/13/2026', location: 'فرع الشارع التجاري' },
  { id: 4, name: 'سيامكيشنان جوناثا شيام', time: '22:06:44 09/13/2026', location: 'فرع السليم الجديد فرع 12' },
  { id: 52, name: 'سمير خان', time: '22:02:51 09/13/2026', location: 'فرع السليم الجديد فرع 12' },
  { id: 45, name: 'محمد مصطفى عبد الكريم', time: '21:25:56 09/13/2026', location: 'فرع صناعية السليم' },
  { id: 16, name: 'فيروس ثيليبي كوناث', time: '21:20:09 09/13/2026', location: 'فرع شارع الأربعين' },
]

const tenDaysData = [
  { day: '1', val: 10 }, { day: '2', val: 25 }, { day: '3', val: 5 }, { day: '4', val: 15 },
  { day: '5', val: 30 }, { day: '6', val: 10 }, { day: '7', val: 20 }, { day: '8', val: 40 },
  { day: '9', val: 10 }, { day: '10', val: 15 },
]

export function PublicHrDashboard() {
  return (
    <div className="p-4 space-y-4 bg-[#f4f5f7] min-h-full font-[family-name:var(--font-arabic)]" dir="rtl">
      
      {/* Top Row: Cards and Circle Chart */}
      <div className="flex flex-col xl:flex-row-reverse gap-4">
         
         {/* Cards Section */}
         <div className="flex-1 bg-[#f1f2f4] p-5 rounded border border-slate-200/60">
            <h2 className="mb-5 text-[24px] font-bold text-slate-800 text-center">ملخص حضور اليوم</h2>
            <div className="flex gap-3 flex-row-reverse">
              {stats.map((s) => {
                const Icon = s.icon
                return (
                  <div
                    key={s.key}
                    className="flex-1 min-w-0 flex flex-col items-center justify-center bg-white rounded border border-slate-200/70 py-5 px-2 shadow-sm"
                  >
                    <Icon className="h-6 w-6 mb-3" strokeWidth={2} style={{ color: s.color }} />
                    <p className="text-[12px] font-bold text-slate-700 mb-1">{s.label}</p>
                    <p className="text-xl font-bold" style={{ color: s.color }}>{s.value}</p>
                  </div>
                )
              })}
            </div>
         </div>

         {/* Circle Chart */}
         <div className="w-full xl:w-[320px] shrink-0 bg-white p-5 rounded border border-slate-100 flex flex-col items-center justify-center shadow-sm">
           <div className="relative h-44 w-44">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={departments}
                  dataKey="value"
                  cx="50%"
                  cy="50%"
                  innerRadius={61}
                  outerRadius={70}
                  stroke="none"
                  isAnimationActive={false}
                >
                  {departments.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center mt-2">
              <span className="text-[11px] font-bold text-slate-600 mb-0.5">إجمالي الموظفين</span>
              <span className="text-xl font-bold text-blue-500">{TOTAL_EMPLOYEES}</span>
            </div>
           </div>
         </div>
      </div>

      {/* Middle Row: Stacked Bar Chart and Table */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
         
         {/* Stacked bar — attendance by branch */}
         <div className="order-2 bg-white pt-5 pb-3 px-4 rounded border border-slate-100 shadow-sm flex flex-col">
           <h2 className="mb-6 text-[24px] font-bold text-slate-800 text-center">
             ملخص الحضور في الفروع
           </h2>
           <div className="h-[300px] mb-2">
             <ResponsiveContainer width="100%" height="100%">
               <BarChart data={branchesData} barSize={26} margin={{ right: 12, left: -18, bottom: 0 }}>
                 <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                 <XAxis 
                    dataKey="name" 
                    tick={{ fontSize: 9, fill: '#64748b' }} 
                    axisLine={{stroke: '#cbd5e1'}} 
                    tickLine={false} 
                    angle={-45} 
                    textAnchor="end" 
                    interval={0}
                    height={84}
                    dx={-8}
                    dy={6}
                 />
                 <YAxis tick={{ fontSize: 11, fill: '#64748b' }} axisLine={{stroke: '#cbd5e1'}} tickLine={false} tickCount={10} domain={[0, 18]} />
                 <Tooltip cursor={{ fill: 'rgba(148,163,184,0.1)' }} contentStyle={{ direction: 'rtl', borderRadius: 4, fontSize: 12 }} />
                 <Bar dataKey="present" stackId="a" fill="#497cff" isAnimationActive={false} />
                 <Bar dataKey="leave" stackId="a" fill="#34c75a" isAnimationActive={false} />
                 <Bar dataKey="absent" stackId="a" fill="#dc3545" isAnimationActive={false} />
                 <Bar dataKey="waiting" stackId="a" fill="#ffb62e" radius={[2, 2, 0, 0]} isAnimationActive={false} />
               </BarChart>
             </ResponsiveContainer>
           </div>
           
           {/* Custom Legend */}
           <div className="flex flex-wrap items-center justify-center gap-4 text-[11px] font-bold text-slate-600 mt-auto">
              <div className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-[#497cff]" /><span>حضور</span></div>
              <div className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-[#dc3545]" /><span>الغياب</span></div>
              <div className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-[#34c75a]" /><span>الاجازات</span></div>
              <div className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-[#ffb62e]" /><span>في الانتظار</span></div>
              <div className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-[#9d9fa0]" /><span>عطله إسبوعية</span></div>
           </div>
         </div>

         {/* Movements Table */}
         <div className="order-1 bg-white pt-5 pb-3 px-4 rounded border border-slate-100 shadow-sm flex flex-col">
           <div className="flex items-center justify-between mb-4 px-2">
             <div className="flex items-center justify-center gap-2">
               <h2 className="text-[24px] font-bold text-slate-800">حركات يوم الاحد 13-09-2026</h2>
               <Info className="h-4 w-4 text-slate-400" />
             </div>
           </div>
           
           <div className="overflow-x-auto">
             <table className="w-full text-right text-[12px]">
                 <thead>
                   <tr className="border-b border-slate-200 text-slate-600">
                     <th className="pb-3 pt-1 px-2 font-bold w-12 text-center whitespace-nowrap">الصورة</th>
                     <th className="pb-3 pt-1 px-2 font-bold text-center whitespace-nowrap">كود الموظف</th>
                     <th className="pb-3 pt-1 px-2 font-bold text-center whitespace-nowrap">الاسم</th>
                     <th className="pb-3 pt-1 px-2 font-bold text-center whitespace-nowrap">الحركة</th>
                     <th className="pb-3 pt-1 px-2 font-bold text-center whitespace-nowrap">الموقع</th>
                   </tr>
                 </thead>
                 <tbody>
                   {movements.map((m) => (
                     <tr key={m.id} className="border-b border-slate-100">
                       <td className="py-2.5 px-2 text-center whitespace-nowrap">
                         <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-[#dbeafe] text-[11px] font-bold text-[#2456a6]">
                           {m.name.trim().charAt(0)}
                         </span>
                       </td>
                       <td className="py-2.5 px-2 text-center font-bold text-slate-700 whitespace-nowrap">{m.id}</td>
                       <td className="py-2.5 px-2 text-center font-bold text-slate-700 whitespace-nowrap">{m.name}</td>
                       <td className="py-2.5 px-2 text-center text-slate-500 font-medium whitespace-nowrap">{m.time}</td>
                       <td className="py-2.5 px-2 text-center text-slate-500 font-medium whitespace-nowrap">{m.location}</td>
                     </tr>
                   ))}
                 </tbody>
             </table>
           </div>
         </div>
         
      </div>

      {/* Bottom Chart: 10 Days */}
      <div className="bg-white pt-5 pb-3 px-4 rounded border border-slate-100 shadow-sm">
         <h2 className="mb-4 text-[24px] font-bold text-slate-800 text-center">حركات اخر 10 ايام</h2>
         <div className="h-[200px]">
           <ResponsiveContainer width="100%" height="100%">
             <BarChart data={tenDaysData} barSize={16}>
               <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
               <XAxis dataKey="day" hide />
               <YAxis tick={{ fontSize: 11, fill: '#64748b' }} axisLine={{stroke: '#cbd5e1'}} tickLine={false} domain={[0, 50]} />
               <Tooltip cursor={{ fill: 'rgba(148,163,184,0.1)' }} />
               <Bar dataKey="val" fill="#497cff" radius={[2, 2, 0, 0]} isAnimationActive={false}>
                 {tenDaysData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={index % 2 === 0 ? '#3b82f6' : (index % 3 === 0 ? '#94a3b8' : '#f59e0b')} />
                 ))}
               </Bar>
             </BarChart>
           </ResponsiveContainer>
         </div>
      </div>

    </div>
  )
}

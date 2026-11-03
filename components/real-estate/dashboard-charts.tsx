'use client'

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from 'recharts'
import { useI18n } from '@/lib/i18n'
import type { AqarDashboardExtras } from '@/lib/real-estate-api'

// Monochrome espresso→bronze scale (darkest = top category) — one warm-brown accent, no multicolor.
const GREENS = ['#2A1D17', '#3A2A21', '#5A4330', '#7A5C3E', '#9C7A4D', '#B08D57', '#C9A26A', '#DCC197']
const DAILY_GREEN = '#3A2A21'

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border-2 border-gray-100 bg-white p-4">
      <p className="mb-3 text-sm font-medium text-gray-700">{title}</p>
      {children}
    </div>
  )
}

export function DashboardCharts({ extras }: { extras: AqarDashboardExtras }) {
  const { isRTL } = useI18n()
  const trend = (extras.daily || []).map((d) => ({ ...d, label: d.day.slice(5).replace('-', '/') }))
  const cats = extras.by_category || []

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2" dir={isRTL ? 'rtl' : 'ltr'}>
      <Panel title={isRTL ? 'الإعلانات خلال ٣٠ يوماً' : 'Listings over 30 days'}>
        <ResponsiveContainer width="100%" height={220}>
          {/* Time axis stays LTR (oldest→newest) so today is the rightmost bar and never
              clipped; no negative margin; preserveStartEnd keeps today's label. */}
          <BarChart data={trend} margin={{ top: 8, right: 12, left: 4, bottom: 0 }} barCategoryGap={1}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eee" />
            <XAxis dataKey="label" fontSize={10} interval="preserveStartEnd" minTickGap={22} tickLine={false} axisLine={false} />
            <YAxis allowDecimals={false} fontSize={10} tickLine={false} axisLine={false} orientation={isRTL ? 'right' : 'left'} width={30} />
            <Tooltip cursor={{ fill: 'rgba(22,110,79,0.06)' }} />
            <Bar dataKey="count" fill={DAILY_GREEN} radius={[3, 3, 0, 0]} minPointSize={2} />
          </BarChart>
        </ResponsiveContainer>
      </Panel>

      <Panel title={isRTL ? 'حسب القسم' : 'By category'}>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={cats} layout="vertical" margin={{ top: 0, right: 12, left: 8, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#eee" />
            <XAxis type="number" allowDecimals={false} fontSize={10} tickLine={false} axisLine={false} reversed={isRTL} />
            <YAxis type="category" dataKey="label" width={132} fontSize={11} interval={0} tickLine={false} axisLine={false} orientation={isRTL ? 'right' : 'left'} />
            <Tooltip cursor={{ fill: 'rgba(22,110,79,0.06)' }} />
            <Bar dataKey="count" radius={isRTL ? [4, 0, 0, 4] : [0, 4, 4, 0]} barSize={18}>
              {cats.map((_, i) => <Cell key={i} fill={GREENS[Math.min(i, GREENS.length - 1)]} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </Panel>
    </div>
  )
}

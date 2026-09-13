'use client'

import {
    BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
    ResponsiveContainer, Legend,
} from 'recharts'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ProjectionRow {
    period_label?: string
    client_savings?: number
    provider_revenue?: number
    provider_cost?: number
    net_cashflow?: number
    notes?: string
}

interface Props {
    rows: ProjectionRow[]
    isRTL: boolean
    /** 'bar' (default) or 'line' */
    variant?: 'bar' | 'line'
    height?: number
}

// Theme-driven via CSS variables so the chart follows whichever theme it is mounted
// in: deep Saudi green inside the freelancer workspace (.theme-freelancer), the ERP
// theme in the ERP. The --chart-* tokens are defined on :root, .theme-hr and
// .theme-freelancer, so they always resolve from the nearest themed ancestor.
const COLORS = {
    client_savings: 'hsl(var(--chart-1))',
    provider_revenue: 'hsl(var(--chart-2))',
    provider_cost: 'hsl(var(--chart-3))',
}

// ---------------------------------------------------------------------------
// Reusable recharts component plotting projection rows
// ---------------------------------------------------------------------------

export function ProjectionChart({ rows, isRTL, variant = 'bar', height = 280 }: Props) {
    const L = {
        clientSavings: isRTL ? 'وفورات العميل' : 'Client Savings',
        providerRevenue: isRTL ? 'إيراد المزوّد' : 'Provider Revenue',
        providerCost: isRTL ? 'تكلفة المزوّد' : 'Provider Cost',
        noData: isRTL ? 'لا توجد بيانات للعرض' : 'No projection data to display',
    }

    const data = (rows || [])
        .filter(r => r && (r.period_label || r.client_savings != null || r.provider_revenue != null))
        .map((r, i) => ({
            period: r.period_label || `#${i + 1}`,
            client_savings: Number(r.client_savings) || 0,
            provider_revenue: Number(r.provider_revenue) || 0,
            provider_cost: Number(r.provider_cost) || 0,
        }))

    if (data.length === 0) {
        return (
            <div className="flex items-center justify-center h-[200px] text-sm text-gray-400 border border-dashed rounded-lg">
                {L.noData}
            </div>
        )
    }

    return (
        <ResponsiveContainer width="100%" height={height}>
            {variant === 'line' ? (
                <LineChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="period" tick={{ fontSize: 11 }} reversed={isRTL} />
                    <YAxis tick={{ fontSize: 11 }} orientation={isRTL ? 'right' : 'left'} />
                    <Tooltip />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Line type="monotone" dataKey="client_savings" name={L.clientSavings} stroke={COLORS.client_savings} strokeWidth={2} />
                    <Line type="monotone" dataKey="provider_revenue" name={L.providerRevenue} stroke={COLORS.provider_revenue} strokeWidth={2} />
                </LineChart>
            ) : (
                <BarChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="period" tick={{ fontSize: 11 }} reversed={isRTL} />
                    <YAxis tick={{ fontSize: 11 }} orientation={isRTL ? 'right' : 'left'} />
                    <Tooltip />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Bar dataKey="client_savings" name={L.clientSavings} fill={COLORS.client_savings} radius={[4, 4, 0, 0]} />
                    <Bar dataKey="provider_revenue" name={L.providerRevenue} fill={COLORS.provider_revenue} radius={[4, 4, 0, 0]} />
                </BarChart>
            )}
        </ResponsiveContainer>
    )
}

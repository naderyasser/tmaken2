'use client'

/**
 * OrgChartTree — a reusable, presentational top-down org chart.
 *
 * Renders a `reports-to` hierarchy as connected cards (see the co-located CSS
 * module for the connector geometry). Handles pan (drag), zoom (wheel / pinch /
 * buttons), fit-to-screen, and per-node expand/collapse. Purely a view: the
 * caller supplies the tree and an `onSelect` handler.
 *
 * Pan/zoom are applied imperatively to the stage transform (never through React
 * state) so dragging stays smooth with a few hundred cards on screen.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { Minus, Plus, Maximize2, ChevronsDownUp, ChevronsUpDown } from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { frappeImageUrl } from '@/lib/utils'
import { useI18n } from '@/lib/i18n'
import { translateEnum } from '@/lib/enums'
import styles from './org-chart-tree.module.css'

export interface OrgNode {
  employee: string
  employee_name: string
  designation?: string
  image?: string
  children?: OrgNode[]
}

const HUES = [172, 196, 150, 214, 258, 28, 340, 122]
function hueFor(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0
  return HUES[h % HUES.length]
}
function initials(name: string): string {
  const parts = (name || '').trim().split(/\s+/).filter(Boolean)
  if (!parts.length) return '؟'
  if (parts.length === 1) return parts[0].slice(0, 2)
  return (parts[0][0] || '') + (parts[parts.length - 1][0] || '')
}
function badgeOf(employee: string): string | null {
  const groups = (employee || '').match(/\d+/g)
  if (!groups) return null
  const n = parseInt(groups[groups.length - 1], 10)
  return Number.isFinite(n) ? String(n) : null
}
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

/** collect ids of every node deeper than `depth` so we can start them collapsed */
function idsDeeperThan(nodes: OrgNode[], depth: number, keep: number, out: Set<string>): void {
  for (const n of nodes) {
    if (depth >= keep && (n.children?.length || 0) > 0) out.add(n.employee)
    if (n.children?.length) idsDeeperThan(n.children, depth + 1, keep, out)
  }
}
function idsWithChildren(nodes: OrgNode[], out: Set<string>): void {
  for (const n of nodes) {
    if (n.children?.length) { out.add(n.employee); idsWithChildren(n.children, out) }
  }
}

interface NodeProps {
  node: OrgNode
  depth: number
  isRoot: boolean
  collapsed: Set<string>
  lang: 'ar' | 'en'
  onToggle: (id: string) => void
  onSelect: (node: OrgNode) => void
}

function Node({ node, depth, isRoot, collapsed, lang, onToggle, onSelect }: NodeProps) {
  const hasChildren = (node.children?.length || 0) > 0
  const isCollapsed = collapsed.has(node.employee)
  const hue = hueFor(node.employee_name || node.employee)
  const badge = badgeOf(node.employee)
  const title = node.designation ? translateEnum('designation', node.designation, lang) : ''

  return (
    <li>
      <div className="relative pb-1">
        <button
          type="button"
          data-card
          onClick={() => onSelect(node)}
          title={node.employee_name}
          className={
            'group relative flex w-[288px] items-center gap-3.5 rounded-2xl border bg-card p-3.5 text-start shadow-card transition-all ' +
            'hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-card-hover ' +
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ' +
            (isRoot ? 'border-primary/45 ring-1 ring-primary/15' : 'border-border')
          }
        >
          <Avatar className="h-14 w-14 shrink-0 ring-2 ring-card">
            <AvatarImage src={node.image ? frappeImageUrl(node.image) : undefined} alt={node.employee_name} />
            <AvatarFallback
              className="text-base font-bold"
              style={{ backgroundColor: `hsl(${hue} 42% 90%)`, color: `hsl(${hue} 48% 32%)` }}
            >
              {initials(node.employee_name)}
            </AvatarFallback>
          </Avatar>
          <span className="min-w-0 flex-1 pe-5">
            <span className="block truncate text-[15px] font-semibold leading-snug text-foreground">{node.employee_name}</span>
            {title && <span className="mt-0.5 block truncate text-[13px] leading-snug text-muted-foreground">{title}</span>}
          </span>
          {badge && (
            <span className="absolute top-2 end-2.5 rounded-full bg-muted px-1.5 py-0.5 text-[11px] font-bold leading-none text-muted-foreground tabular-nums">
              #{badge}
            </span>
          )}
        </button>

        {hasChildren && (
          <button
            type="button"
            aria-label={isCollapsed ? 'expand' : 'collapse'}
            onClick={(e) => { e.stopPropagation(); onToggle(node.employee) }}
            className="absolute -bottom-3 left-1/2 z-10 flex h-7 min-w-7 -translate-x-1/2 items-center justify-center rounded-full border border-border bg-card px-1 text-xs font-bold tabular-nums text-muted-foreground shadow-card transition-colors hover:border-primary hover:text-primary"
          >
            {isCollapsed ? node.children!.length : <Minus className="h-4 w-4" />}
          </button>
        )}
      </div>

      {hasChildren && !isCollapsed && (
        <ul>
          {node.children!.map((c) => (
            <Node
              key={c.employee}
              node={c}
              depth={depth + 1}
              isRoot={false}
              collapsed={collapsed}
              lang={lang}
              onToggle={onToggle}
              onSelect={onSelect}
            />
          ))}
        </ul>
      )}
    </li>
  )
}

export interface OrgChartTreeProps {
  roots: OrgNode[]
  onSelect: (node: OrgNode) => void
  /** depth (0 = root) up to which nodes start expanded — deeper nodes begin collapsed. Default 1 (root + direct reports). */
  defaultExpandDepth?: number
  className?: string
}

const MIN_SCALE = 0.3   // floor for manual zoom-out
const MAX_SCALE = 2
const FIT_MIN = 0.6     // auto-fit never shrinks below this — readability over cramming a wide org into view

export function OrgChartTree({ roots, onSelect, defaultExpandDepth = 1, className }: OrgChartTreeProps) {
  const { isRTL } = useI18n()
  const lang = isRTL ? 'ar' : 'en'
  const tx = (en: string, ar: string) => (isRTL ? ar : en)

  const canvasRef = useRef<HTMLDivElement>(null)
  const stageRef = useRef<HTMLDivElement>(null)
  const treeRef = useRef<HTMLElement | null>(null)
  const setTreeRef = useCallback((el: HTMLElement | null) => { treeRef.current = el }, [])
  const labelRef = useRef<HTMLSpanElement>(null)
  const view = useRef({ s: 1, x: 0, y: 0 })
  const drag = useRef<{ x: number; y: number; vx: number; vy: number } | null>(null)
  const userMoved = useRef(false) // once the user pans/zooms, stop auto-refitting on resize
  const [grabbing, setGrabbing] = useState(false)

  // Seed the collapse set on the FIRST render (initializer, not an effect) so the tree
  // never flashes fully-expanded — otherwise fit() can measure that huge transient tree
  // and lock in a tiny (~30%) zoom.
  const [collapsed, setCollapsed] = useState<Set<string>>(() => {
    const s = new Set<string>()
    idsDeeperThan(roots, 0, defaultExpandDepth, s)
    return s
  })
  const seededFor = useRef(roots)
  useEffect(() => {
    if (seededFor.current === roots) return // skip the mount pass; only re-seed a real refetch
    seededFor.current = roots
    const s = new Set<string>()
    idsDeeperThan(roots, 0, defaultExpandDepth, s)
    setCollapsed(s)
  }, [roots, defaultExpandDepth])

  const apply = useCallback(() => {
    const v = view.current
    if (stageRef.current) stageRef.current.style.transform = `translate(${v.x}px, ${v.y}px) scale(${v.s})`
    if (labelRef.current) labelRef.current.textContent = Math.round(v.s * 100) + '%'
  }, [])

  const fit = useCallback(() => {
    const c = canvasRef.current, t = treeRef.current
    if (!c || !t) return
    const w = t.offsetWidth, h = t.offsetHeight
    const cw = c.clientWidth, ch = c.clientHeight
    if (!w || !h || !cw || !ch) return
    const padX = 64, padTop = 40
    // Fit the whole tree — but never auto-shrink past a readable floor. A very wide org
    // should render big and let the user pan, not cram to 30%. Top-align → no gap above.
    const raw = Math.min((cw - padX) / w, (ch - padTop - 32) / h, 1)
    const s = clamp(Math.max(raw, FIT_MIN), MIN_SCALE, MAX_SCALE)
    view.current = { s, x: (cw - w * s) / 2, y: padTop }
    apply()
  }, [apply])

  const fitReset = useCallback(() => { userMoved.current = false; fit() }, [fit])

  // Fit on first paint, again once web fonts settle (Arabic glyph widths shift the
  // layout), and whenever the viewport resizes — unless the user has taken control.
  useEffect(() => {
    const id = requestAnimationFrame(fit)
    const timer = setTimeout(fit, 140)
    const fonts = (document as unknown as { fonts?: { ready?: Promise<unknown> } }).fonts
    fonts?.ready?.then(() => { if (!userMoved.current) fit() }).catch(() => {})
    const c = canvasRef.current
    let ro: ResizeObserver | undefined
    if (c && typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(() => { if (!userMoved.current) fit() })
      ro.observe(c)
    }
    return () => { cancelAnimationFrame(id); clearTimeout(timer); ro?.disconnect() }
  }, [roots, fit])

  // zoom around a viewport point (px,py relative to canvas)
  const zoomTo = useCallback((next: number, px: number, py: number) => {
    userMoved.current = true
    const v = view.current
    const ns = clamp(next, MIN_SCALE, MAX_SCALE)
    const k = ns / v.s
    view.current = { s: ns, x: px - (px - v.x) * k, y: py - (py - v.y) * k }
    apply()
  }, [apply])

  const zoomButton = useCallback((factor: number) => {
    const c = canvasRef.current
    if (!c) return
    zoomTo(view.current.s * factor, c.clientWidth / 2, c.clientHeight / 2)
  }, [zoomTo])

  // native, non-passive wheel listener so we can preventDefault the page scroll
  useEffect(() => {
    const c = canvasRef.current
    if (!c) return
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      const r = c.getBoundingClientRect()
      const factor = e.deltaY < 0 ? 1.1 : 1 / 1.1
      zoomTo(view.current.s * factor, e.clientX - r.left, e.clientY - r.top)
    }
    c.addEventListener('wheel', onWheel, { passive: false })
    return () => c.removeEventListener('wheel', onWheel)
  }, [zoomTo])

  const onPointerDown = (e: React.PointerEvent) => {
    const el = e.target as HTMLElement
    if (el.closest('[data-card]') || el.closest('button')) return // let cards/toggles handle their own clicks
    userMoved.current = true
    drag.current = { x: e.clientX, y: e.clientY, vx: view.current.x, vy: view.current.y }
    canvasRef.current?.setPointerCapture(e.pointerId)
    setGrabbing(true)
  }
  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current
    if (!d) return
    view.current.x = d.vx + (e.clientX - d.x)
    view.current.y = d.vy + (e.clientY - d.y)
    apply()
  }
  const endPan = () => { drag.current = null; setGrabbing(false) }

  const toggle = useCallback((id: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }, [])

  const expandAll = () => setCollapsed(new Set())
  const collapseAll = () => { const s = new Set<string>(); idsWithChildren(roots, s); setCollapsed(s) }

  const isMulti = roots.length > 1

  return (
    <div className={'relative overflow-hidden bg-background ' + (className || '')}>
      {/* pan/zoom canvas */}
      <div
        ref={canvasRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endPan}
        onPointerCancel={endPan}
        className={'absolute inset-0 touch-none ' + (grabbing ? 'cursor-grabbing select-none' : 'cursor-grab')}
        style={{
          backgroundImage: 'radial-gradient(hsl(var(--border)) 1px, transparent 1px)',
          backgroundSize: '22px 22px',
          backgroundPosition: '11px 11px',
        }}
      >
        <div ref={stageRef} className="absolute left-0 top-0 origin-top-left will-change-transform">
          {/* one root → a single tree; multiple roots (forest) → lay them side by side */}
          {isMulti ? (
            <div ref={setTreeRef} className="flex items-start gap-10 p-4">
              {roots.map((r) => (
                <ul key={r.employee} className={`${styles.tree} ${styles.rootUl}`}>
                  <Node node={r} depth={0} isRoot collapsed={collapsed} lang={lang} onToggle={toggle} onSelect={onSelect} />
                </ul>
              ))}
            </div>
          ) : (
            <ul ref={setTreeRef} className={`${styles.tree} ${styles.rootUl} p-4`}>
              {roots.map((r) => (
                <Node key={r.employee} node={r} depth={0} isRoot collapsed={collapsed} lang={lang} onToggle={toggle} onSelect={onSelect} />
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* floating controls */}
      <div className="pointer-events-none absolute inset-x-0 bottom-4 flex justify-center px-4">
        <div className="pointer-events-auto flex items-center gap-0.5 rounded-xl border border-border bg-card/90 p-1 shadow-card-hover backdrop-blur">
          <ToolButton label={tx('Collapse all', 'طيّ الكل')} onClick={collapseAll}><ChevronsDownUp className="h-4 w-4" /></ToolButton>
          <ToolButton label={tx('Expand all', 'توسيع الكل')} onClick={expandAll}><ChevronsUpDown className="h-4 w-4" /></ToolButton>
          <span className="mx-1 h-5 w-px bg-border" />
          <ToolButton label={tx('Zoom out', 'تصغير')} onClick={() => zoomButton(1 / 1.15)}><Minus className="h-4 w-4" /></ToolButton>
          <button
            type="button"
            onClick={fitReset}
            title={tx('Fit to screen', 'ملاءمة الشاشة')}
            className="min-w-[3rem] rounded-lg px-2 py-1 text-center text-xs font-semibold tabular-nums text-foreground transition-colors hover:bg-accent"
          >
            <span ref={labelRef}>100%</span>
          </button>
          <ToolButton label={tx('Zoom in', 'تكبير')} onClick={() => zoomButton(1.15)}><Plus className="h-4 w-4" /></ToolButton>
          <span className="mx-1 h-5 w-px bg-border" />
          <ToolButton label={tx('Fit to screen', 'ملاءمة الشاشة')} onClick={fitReset}><Maximize2 className="h-4 w-4" /></ToolButton>
        </div>
      </div>
    </div>
  )
}

function ToolButton({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      {children}
    </button>
  )
}

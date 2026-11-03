/**
 * Zone Editor Dialog — assign a geographic work zone to a sales rep.
 * Click the map to add polygon vertices (≥3), pick a color, name it, save.
 * Stores a GeoJSON Polygon on Sales Person via the guarded set_rep_zone API.
 */

'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { salesApi, type RepZone } from '@/lib/sales-api'
import { useI18n } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { useToast } from '@/hooks/use-toast'
import { Loader2, Undo2, Eraser, Trash2 } from 'lucide-react'
import 'leaflet/dist/leaflet.css'
import type * as Leaflet from 'leaflet'

const ZONE_COLORS = ['#7c3aed', '#0891b2', '#059669', '#d97706', '#dc2626', '#2563eb']
const DEFAULT_CENTER: [number, number] = [24.7136, 46.6753] // Riyadh

interface ZoneEditorDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  rep: { name: string; sales_person_name?: string } | null
  /** Existing zone row (if any) so the editor opens pre-filled */
  existing?: RepZone | null
  /** Optional map center fallback, e.g. the rep's last location */
  center?: [number, number] | null
  onSaved?: () => void
}

export function ZoneEditorDialog({ open, onOpenChange, rep, existing, center, onSaved }: ZoneEditorDialogProps) {
  const { t, isRTL } = useI18n()
  const { toast } = useToast()
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<Leaflet.Map | null>(null)
  const drawLayerRef = useRef<Leaflet.LayerGroup | null>(null)
  const LRef = useRef<typeof Leaflet | null>(null)

  const [points, setPoints] = useState<[number, number][]>([]) // [lat, lng]
  const [color, setColor] = useState(ZONE_COLORS[0])
  const [zoneName, setZoneName] = useState('')
  const [saving, setSaving] = useState(false)
  const [removing, setRemoving] = useState(false)

  // Reset form state from the existing zone whenever the dialog opens
  useEffect(() => {
    if (!open) return
    let initial: [number, number][] = []
    if (existing?.zone_polygon) {
      try {
        const ring = JSON.parse(existing.zone_polygon)?.coordinates?.[0] as number[][]
        if (Array.isArray(ring)) {
          initial = ring.map(p => [Number(p[1]), Number(p[0])] as [number, number])
          // drop the GeoJSON closing point (same as the first)
          if (initial.length > 1) {
            const [f, l] = [initial[0], initial[initial.length - 1]]
            if (f[0] === l[0] && f[1] === l[1]) initial = initial.slice(0, -1)
          }
        }
      } catch { /* ignore malformed stored polygon */ }
    }
    setPoints(initial)
    setColor(existing?.zone_color || ZONE_COLORS[0])
    setZoneName(existing?.zone_name || '')
  }, [open, existing])

  // Init map when the dialog content mounts (leaflet loaded client-side only)
  useEffect(() => {
    if (!open) return
    let disposed = false
    const timer = setTimeout(async () => {
      if (disposed || !containerRef.current || mapRef.current) return
      const L = (await import('leaflet')).default
      if (disposed || !containerRef.current) return
      LRef.current = L
      const map = L.map(containerRef.current, {
        center: center || DEFAULT_CENTER,
        zoom: 11,
        zoomControl: true,
        attributionControl: false,
      })
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map)
      drawLayerRef.current = L.layerGroup().addTo(map)
      map.on('click', (e: Leaflet.LeafletMouseEvent) => {
        setPoints(prev => [...prev, [e.latlng.lat, e.latlng.lng]])
      })
      mapRef.current = map
      setTimeout(() => map.invalidateSize(), 150)
    }, 200) // wait for the dialog open animation so the container has size

    return () => {
      disposed = true
      clearTimeout(timer)
      if (mapRef.current) {
        mapRef.current.remove()
        mapRef.current = null
        drawLayerRef.current = null
      }
    }
  }, [open, center])

  // Redraw the polygon preview whenever points/color change
  useEffect(() => {
    const L = LRef.current
    const layer = drawLayerRef.current
    const map = mapRef.current
    if (!L || !layer || !map) return
    layer.clearLayers()
    points.forEach((p, i) => {
      L.circleMarker(p, {
        radius: 5,
        color: '#fff',
        weight: 2,
        fillColor: color,
        fillOpacity: 1,
      }).bindTooltip(String(i + 1), { permanent: false }).addTo(layer)
    })
    if (points.length >= 3) {
      L.polygon(points, { color, weight: 2, fillColor: color, fillOpacity: 0.15 }).addTo(layer)
    } else if (points.length === 2) {
      L.polyline(points, { color, weight: 2, dashArray: '6 4' }).addTo(layer)
    }
    // fit once when loading an existing zone
    if (points.length >= 3 && existing?.zone_polygon) {
      try { map.fitBounds(points as any, { padding: [30, 30], maxZoom: 14 }) } catch { /* noop */ }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [points, color, open])

  const handleSave = useCallback(async () => {
    if (!rep) return
    if (points.length < 3) {
      toast({ title: t('sr.admin.common.warning_title'), description: t('sr.admin.zone.err_min_points'), variant: 'destructive' })
      return
    }
    setSaving(true)
    try {
      // GeoJSON ring is [lng,lat] and must be closed
      const ring = points.map(p => [p[1], p[0]])
      ring.push(ring[0])
      await salesApi.setRepZone(rep.name, {
        polygon: JSON.stringify({ type: 'Polygon', coordinates: [ring] }),
        color,
        name: zoneName.trim() || undefined,
      })
      toast({
        title: t('sr.admin.common.updated_title'),
        description: t('sr.admin.zone.toast_saved').replace('{name}', rep.sales_person_name || rep.name),
      })
      onOpenChange(false)
      onSaved?.()
    } catch (e: any) {
      toast({ title: t('sr.admin.common.error_title'), description: e?.message || String(e), variant: 'destructive' })
    } finally { setSaving(false) }
  }, [rep, points, color, zoneName, t, toast, onOpenChange, onSaved])

  const handleRemove = useCallback(async () => {
    if (!rep) return
    setRemoving(true)
    try {
      await salesApi.setRepZone(rep.name, { polygon: null })
      toast({ title: t('sr.admin.common.updated_title'), description: t('sr.admin.zone.toast_removed') })
      onOpenChange(false)
      onSaved?.()
    } catch (e: any) {
      toast({ title: t('sr.admin.common.error_title'), description: e?.message || String(e), variant: 'destructive' })
    } finally { setRemoving(false) }
  }, [rep, t, toast, onOpenChange, onSaved])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>
            {t('sr.admin.zone.dialog_title').replace('{name}', rep?.sales_person_name || rep?.name || '')}
          </DialogTitle>
        </DialogHeader>

        <p className="text-xs text-gray-500 -mt-1">{t('sr.admin.zone.dialog_hint')}</p>

        <div className="grid grid-cols-1 md:grid-cols-[1fr_220px] gap-4">
          <div className="rounded-lg overflow-hidden border">
            <div ref={containerRef} style={{ height: '380px' }} />
          </div>

          <div className="space-y-4">
            <div>
              <Label className="text-xs">{t('sr.admin.zone.name_label')}</Label>
              <Input
                value={zoneName}
                onChange={e => setZoneName(e.target.value)}
                placeholder={t('sr.admin.zone.name_placeholder')}
                className="mt-1 h-9 text-sm"
              />
            </div>

            <div>
              <Label className="text-xs">{t('sr.admin.zone.color_label')}</Label>
              <div className="flex items-center gap-2 mt-1.5">
                {ZONE_COLORS.map(c => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setColor(c)}
                    className={cn(
                      'w-7 h-7 rounded-full border-2 transition-transform',
                      color === c ? 'border-gray-900 scale-110' : 'border-white shadow'
                    )}
                    style={{ background: c }}
                    aria-label={c}
                  />
                ))}
              </div>
            </div>

            <div className="text-xs text-gray-500">
              {t('sr.admin.zone.points_count').replace('{n}', String(points.length))}
            </div>

            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" className="h-8 text-xs" disabled={points.length === 0}
                onClick={() => setPoints(p => p.slice(0, -1))}>
                <Undo2 className="h-3.5 w-3.5 mr-1" /> {t('sr.admin.zone.undo')}
              </Button>
              <Button variant="outline" size="sm" className="h-8 text-xs" disabled={points.length === 0}
                onClick={() => setPoints([])}>
                <Eraser className="h-3.5 w-3.5 mr-1" /> {t('sr.admin.zone.clear')}
              </Button>
            </div>

            {existing?.zone_polygon && (
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-xs w-full text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700"
                onClick={handleRemove}
                disabled={removing || saving}
              >
                {removing ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Trash2 className="h-3.5 w-3.5 mr-1" />}
                {t('sr.admin.zone.remove')}
              </Button>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>{t('sr.admin.common.cancel')}</Button>
          <Button onClick={handleSave} disabled={saving || removing || points.length < 3} className="bg-violet-600 hover:bg-violet-700">
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {t('sr.admin.zone.save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

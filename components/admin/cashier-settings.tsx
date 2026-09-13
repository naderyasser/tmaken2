"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { Save, Loader2, Plus, Trash2, Settings2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { cashierApi } from "@/lib/cashier-api"
import type { CashierSettings, CashierPaymentMethod, CashierTax, CashierUserOverride } from "@/lib/cashier-api"
import { createPortal } from "react-dom"
import { TerminalSettings } from "@/components/cashier/terminal-settings"

// ---------------------------------------------------------------------------
// Reusable link-search input backed by Frappe's search_link API
// Uses a React Portal so the dropdown is rendered at <body> level and
// never clipped by overflow:hidden on parent Card components.
// ---------------------------------------------------------------------------
function LinkInput({
  doctype,
  value,
  onChange,
  placeholder,
  className,
}: {
  doctype: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  className?: string
}) {
  const [query, setQuery] = useState(value)
  const [options, setOptions] = useState<{ value: string; description?: string }[]>([])
  const [open, setOpen] = useState(false)
  const [searching, setSearching] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const [rect, setRect] = useState<DOMRect | null>(null)

  useEffect(() => { setQuery(value) }, [value])

  const updateRect = () => {
    if (wrapperRef.current) setRect(wrapperRef.current.getBoundingClientRect())
  }

  const runSearch = useCallback(async (txt: string) => {
    setSearching(true)
    try {
      const params = new URLSearchParams({
        txt: txt || "",
        doctype,
        ignore_user_permissions: "0",
        reference_doctype: "",
        page_length: "10",
      })
      const resp = await fetch(`/api/method/frappe.desk.search.search_link?${params}`)
      const data = await resp.json()
      const results = (data.results ?? data.message ?? []) as { value: string; description?: string }[]
      setOptions(results)
      if (results.length > 0) {
        updateRect()
        setOpen(true)
      } else {
        setOpen(false)
      }
    } catch {
      setOptions([])
      setOpen(false)
    } finally {
      setSearching(false)
    }
  }, [doctype])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value
    setQuery(v)
    onChange(v)
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => runSearch(v), 280)
  }

  const handleFocus = () => {
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => runSearch(query), 100)
  }

  const select = (opt: string) => {
    setQuery(opt)
    onChange(opt)
    setOpen(false)
    setOptions([])
  }

  const dropdown = open && rect && options.length > 0
    ? createPortal(
        <div
          style={{
            position: "fixed",
            top: rect.bottom + 4,
            left: rect.left,
            width: rect.width,
            zIndex: 9999,
          }}
        >
          <ul className="bg-white border border-gray-200 rounded-md shadow-lg max-h-52 overflow-y-auto py-1">
            {options.map(opt => (
              <li key={opt.value}>
                <button
                  type="button"
                  className="w-full text-left px-3 py-2 text-sm hover:bg-blue-50 truncate flex items-center justify-between gap-2"
                  onMouseDown={e => { e.preventDefault(); select(opt.value) }}
                >
                  <span className="truncate">{opt.value}</span>
                  {opt.description && (
                    <span className="text-xs text-gray-400 shrink-0">{opt.description}</span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        </div>,
        document.body
      )
    : null

  return (
    <div ref={wrapperRef} className={`relative ${className ?? ""}`}>
      <Input
        value={query}
        onChange={handleChange}
        onFocus={handleFocus}
        onBlur={() => setTimeout(() => setOpen(false), 200)}
        placeholder={placeholder}
      />
      {searching && (
        <Loader2 className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 animate-spin text-gray-400" />
      )}
      {dropdown}
    </div>
  )
}

export function AdminCashierSettings() {
  const [settings, setSettings] = useState<CashierSettings | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState("")

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await cashierApi.getSettings()
      setSettings(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load settings")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const handleSave = async () => {
    if (!settings) return
    setSaving(true)
    setError("")
    try {
      await cashierApi.saveSettings(settings)
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save")
    } finally {
      setSaving(false)
    }
  }

  const update = (field: keyof CashierSettings, value: unknown) => {
    setSettings(prev => prev ? { ...prev, [field]: value } : prev)
  }

  const addPaymentMethod = () => {
    setSettings(prev => prev ? {
      ...prev,
      payment_methods: [...(prev.payment_methods || []), { mode_of_payment: "", is_default: false }]
    } : prev)
  }

  const updatePaymentMethod = (idx: number, field: keyof CashierPaymentMethod, value: unknown) => {
    setSettings(prev => {
      if (!prev) return prev
      const pm = [...(prev.payment_methods || [])]
      pm[idx] = { ...pm[idx], [field]: value }
      // Ensure only one default
      if (field === "is_default" && value === true) {
        pm.forEach((m, i) => { if (i !== idx) m.is_default = false })
      }
      return { ...prev, payment_methods: pm }
    })
  }

  const removePaymentMethod = (idx: number) => {
    setSettings(prev => prev ? {
      ...prev,
      payment_methods: (prev.payment_methods || []).filter((_, i) => i !== idx)
    } : prev)
  }

  const addTax = () => {
    setSettings(prev => prev ? {
      ...prev,
      taxes: [...(prev.taxes || []), { tax_name: "", rate: 0 }]
    } : prev)
  }

  const updateTax = (idx: number, field: keyof CashierTax, value: unknown) => {
    setSettings(prev => {
      if (!prev) return prev
      const taxes = [...(prev.taxes || [])]
      taxes[idx] = { ...taxes[idx], [field]: value }
      return { ...prev, taxes }
    })
  }

  const removeTax = (idx: number) => {
    setSettings(prev => prev ? {
      ...prev,
      taxes: (prev.taxes || []).filter((_, i) => i !== idx)
    } : prev)
  }

  const addUserOverride = () => {
    setSettings(prev => prev ? {
      ...prev,
      user_overrides: [...(prev.user_overrides || []), { user: "" }]
    } : prev)
  }

  const updateUserOverride = (idx: number, field: keyof CashierUserOverride, value: string) => {
    setSettings(prev => {
      if (!prev) return prev
      const overrides = [...(prev.user_overrides || [])]
      overrides[idx] = { ...overrides[idx], [field]: value }
      return { ...prev, user_overrides: overrides }
    })
  }

  const removeUserOverride = (idx: number) => {
    setSettings(prev => prev ? {
      ...prev,
      user_overrides: (prev.user_overrides || []).filter((_, i) => i !== idx)
    } : prev)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    )
  }

  if (!settings) {
    return (
      <div className="p-6">
        <p className="text-red-600">{error || "Failed to load cashier settings."}</p>
        <Button variant="outline" size="sm" className="mt-3" onClick={load}>Retry</Button>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-2xl space-y-6">
      <div className="flex items-center gap-3">
        <Settings2 className="h-6 w-6 text-indigo-600" />
        <div>
          <h1 className="text-xl font-bold">Sales Settings</h1>
          <p className="text-sm text-gray-500">Configure POS behavior for all cashiers</p>
        </div>
        <div className="flex-1" />
        <Button onClick={handleSave} disabled={saving} className="min-w-[90px]">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : saved ? "Saved ✓" : (
            <><Save className="h-4 w-4 mr-1.5" />Save</>
          )}
        </Button>
      </div>

      {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">{error}</p>}

      {/* General */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">General</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label>Company</Label>
            <LinkInput
              doctype="Company"
              value={settings.company || ""}
              onChange={v => update("company", v)}
              placeholder="Search company…"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Currency</Label>
            <LinkInput
              doctype="Currency"
              value={settings.currency || ""}
              onChange={v => update("currency", v)}
              placeholder="Search currency…"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Default Warehouse</Label>
            <LinkInput
              doctype="Warehouse"
              value={settings.default_warehouse || ""}
              onChange={v => update("default_warehouse", v)}
              placeholder="Search warehouse…"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Price List</Label>
            <LinkInput
              doctype="Price List"
              value={settings.selling_price_list || ""}
              onChange={v => update("selling_price_list", v)}
              placeholder="Search price list…"
            />
          </div>
          <div className="space-y-1.5 col-span-2">
            <Label>Taxes</Label>
            <div className="space-y-2">
              {(settings.taxes || []).map((tx, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <Input
                    className="flex-1"
                    placeholder="Tax name (e.g. VAT)"
                    value={tx.tax_name}
                    onChange={e => updateTax(idx, "tax_name", e.target.value)}
                  />
                  <div className="flex items-center gap-1 w-28 shrink-0">
                    <Input
                      type="number"
                      min={0}
                      max={100}
                      step={0.01}
                      placeholder="Rate"
                      value={tx.rate}
                      onChange={e => updateTax(idx, "rate", parseFloat(e.target.value) || 0)}
                    />
                    <span className="text-sm text-gray-500">%</span>
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => removeTax(idx)}>
                    <Trash2 className="h-4 w-4 text-red-400" />
                  </Button>
                </div>
              ))}
              <Button variant="outline" size="sm" onClick={addTax}>
                <Plus className="h-3.5 w-3.5 mr-1" />
                Add Tax
              </Button>
            </div>
          </div>
          <div className="col-span-2 flex items-center gap-3">
            <Switch
              checked={settings.track_stock}
              onCheckedChange={v => update("track_stock", v)}
              id="track-stock"
            />
            <Label htmlFor="track-stock" className="cursor-pointer">
              Track Stock (update inventory on each sale)
            </Label>
          </div>
        </CardContent>
      </Card>

      {/* Payment Methods */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Payment Methods</CardTitle>
          <CardDescription>Define which payment methods are available at checkout</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {(settings.payment_methods || []).map((pm, idx) => (
            <div key={idx} className="flex items-center gap-3">
              <LinkInput
                doctype="Mode of Payment"
                className="flex-1"
                placeholder="Search payment mode…"
                value={pm.mode_of_payment}
                onChange={v => updatePaymentMethod(idx, "mode_of_payment", v)}
              />
              <label className="flex items-center gap-1.5 text-sm cursor-pointer shrink-0">
                <input
                  type="checkbox"
                  checked={pm.is_default}
                  onChange={e => updatePaymentMethod(idx, "is_default", e.target.checked)}
                  className="rounded"
                />
                Default
              </label>
              <Button variant="ghost" size="icon" onClick={() => removePaymentMethod(idx)}>
                <Trash2 className="h-4 w-4 text-red-400" />
              </Button>
            </div>
          ))}
          <Button variant="outline" size="sm" onClick={addPaymentMethod}>
            <Plus className="h-3.5 w-3.5 mr-1" />
            Add Method
          </Button>
        </CardContent>
      </Card>

      {/* Returns */}
      {/* Card-terminal link. Stored per till (localStorage), NOT in Cashier Settings —
          the component's own banner explains why. */}
      <TerminalSettings paymentMethods={settings.payment_methods || []} />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Returns</CardTitle>
          <CardDescription>Controls when supervisor authorization is required to process a return</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3">
            <Label htmlFor="return-threshold" className="shrink-0">
              Supervisor auth threshold
            </Label>
            <Input
              id="return-threshold"
              type="number"
              min={0}
              step={1}
              className="w-36"
              value={settings.return_auth_threshold ?? 200}
              onChange={e => update("return_auth_threshold", parseFloat(e.target.value) || 0)}
            />
            <span className="text-sm text-gray-500">{settings.currency || "SAR"}</span>
            <p className="text-xs text-gray-400 ml-2">
              Returns above this amount require a supervisor to enter their credentials. Set to 0 to never require authorization.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Per-User Overrides */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Per-User Overrides</CardTitle>
          <CardDescription>Override warehouse or price list for specific cashier users</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {(settings.user_overrides || []).map((uo, idx) => (
            <div key={idx} className="grid grid-cols-3 gap-2 items-center">
              <LinkInput doctype="User" placeholder="Search user…" value={uo.user} onChange={v => updateUserOverride(idx, "user", v)} />
              <LinkInput doctype="Warehouse" placeholder="Warehouse (optional)" value={uo.warehouse || ""} onChange={v => updateUserOverride(idx, "warehouse", v)} />
              <div className="flex gap-2">
                <LinkInput doctype="Price List" placeholder="Price list (optional)" value={uo.price_list || ""} onChange={v => updateUserOverride(idx, "price_list", v)} />
                <Button variant="ghost" size="icon" onClick={() => removeUserOverride(idx)}>
                  <Trash2 className="h-4 w-4 text-red-400" />
                </Button>
              </div>
            </div>
          ))}
          <Button variant="outline" size="sm" onClick={addUserOverride}>
            <Plus className="h-3.5 w-3.5 mr-1" />
            Add Override
          </Button>
        </CardContent>
      </Card>

      <Separator />
      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving} size="lg">
          {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
          {saved ? "Saved!" : "Save Settings"}
        </Button>
      </div>
    </div>
  )
}

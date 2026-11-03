"use client"

/**
 * Payment-terminal setup — PER TILL, not per tenant.
 *
 * The surrounding Sales Settings screen writes to the Cashier Settings DocType and
 * applies to every cashier in the company. This card does not: the terminal is cabled
 * to one register, so its driver and bridge address live in that browser's storage.
 * The banner says so, because a manager who assumes otherwise will configure one till
 * and wonder why the other never lights up.
 */

import { useEffect, useMemo, useState } from "react"
import { CheckCircle2, CreditCard, Loader2, MonitorSmartphone, XCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { useI18n } from "@/lib/i18n"
import {
  DEFAULT_TERMINAL_CONFIG,
  loadTerminalConfig,
  routesToTerminal,
  saveTerminalConfig,
  type TerminalConfig,
  type TerminalDriverId,
} from "@/lib/cashier/terminal/config"
import { createTerminalDriver } from "@/lib/cashier/terminal"
import { getMockScenario, setMockScenario, type MockScenario } from "@/lib/cashier/terminal/mock"
import { listOpenTxns, type TerminalRecord } from "@/lib/cashier/terminal/store"
import type { CashierPaymentMethod } from "@/lib/cashier-api"

const MOCK_SCENARIOS: MockScenario[] = ["approved", "declined", "timeout", "unknown", "error", "random"]

interface TerminalSettingsProps {
  /** The tenant's Modes of Payment, so routing is a toggle per method, not free text. */
  paymentMethods?: CashierPaymentMethod[]
}

export function TerminalSettings({ paymentMethods = [] }: TerminalSettingsProps) {
  const { t } = useI18n()
  const [cfg, setCfg] = useState<TerminalConfig>(DEFAULT_TERMINAL_CONFIG)
  const [scenario, setScenario] = useState<MockScenario>("approved")
  const [probe, setProbe] = useState<{ state: "idle" | "busy" | "ok" | "fail"; detail?: string }>({ state: "idle" })
  const [open, setOpen] = useState<TerminalRecord[]>([])

  // localStorage is unavailable during SSR — read after mount.
  useEffect(() => {
    setCfg(loadTerminalConfig())
    setScenario(getMockScenario())
    void listOpenTxns().then(setOpen)
  }, [])

  /** Write-through: there is no Save button here, so nothing can be half-applied. */
  const update = (patch: Partial<TerminalConfig>) => {
    const next = { ...cfg, ...patch }
    setCfg(next)
    saveTerminalConfig(next)
    setProbe({ state: "idle" })
  }

  const toggleRouting = (mode: string, shouldRoute: boolean) => {
    // Store the OVERRIDE, not the resulting state, so a method whose name later changes
    // still follows the heuristic rather than a stale explicit entry.
    const without = {
      extraCardModes: cfg.extraCardModes.filter(m => m !== mode),
      excludedModes: cfg.excludedModes.filter(m => m !== mode),
    }
    const heuristic = routesToTerminal(mode, { ...cfg, ...without, enabled: true, extraCardModes: [], excludedModes: [] })
    if (shouldRoute === heuristic) update(without)
    else if (shouldRoute) update({ ...without, extraCardModes: [...without.extraCardModes, mode] })
    else update({ ...without, excludedModes: [...without.excludedModes, mode] })
  }

  const runProbe = async () => {
    setProbe({ state: "busy" })
    try {
      const result = await createTerminalDriver(cfg).probe()
      setProbe({
        state: result.reachable ? "ok" : "fail",
        detail: [result.detail, result.terminalId && `TID ${result.terminalId}`].filter(Boolean).join(" · "),
      })
    } catch (e) {
      setProbe({ state: "fail", detail: e instanceof Error ? e.message : String(e) })
    }
  }

  const routed = useMemo(
    () => paymentMethods.filter(pm => routesToTerminal(pm.mode_of_payment, { ...cfg, enabled: true })),
    [paymentMethods, cfg],
  )

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <CreditCard className="h-4 w-4 text-emerald-600" />
          {t("cashier.terminal.settings.title")}
        </CardTitle>
        <CardDescription>{t("cashier.terminal.settings.subtitle")}</CardDescription>
      </CardHeader>

      <CardContent className="space-y-5">
        <p className="flex items-start gap-2 rounded-lg bg-amber-50 p-2.5 text-xs text-amber-800">
          <MonitorSmartphone className="mt-0.5 h-4 w-4 shrink-0" />
          {t("cashier.terminal.settings.this_till_only")}
        </p>

        <Row
          label={t("cashier.terminal.settings.enable")}
          help={t("cashier.terminal.settings.enable_help")}
          control={<Switch checked={cfg.enabled} onCheckedChange={v => update({ enabled: v })} />}
        />

        {cfg.enabled && (
          <>
            <Separator />

            <div className="space-y-1.5">
              <Label className="text-sm">{t("cashier.terminal.settings.driver")}</Label>
              <div className="grid grid-cols-2 gap-2">
                {(["bridge", "mock"] as TerminalDriverId[]).map(id => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => update({ driver: id })}
                    className={`rounded-lg border-2 p-2.5 text-start text-sm transition-colors ${
                      cfg.driver === id
                        ? "border-emerald-500 bg-emerald-50 font-semibold text-emerald-800"
                        : "border-slate-200 hover:border-slate-300"
                    }`}
                  >
                    {t(`cashier.terminal.settings.driver_${id}`)}
                  </button>
                ))}
              </div>
            </div>

            {cfg.driver === "bridge" && (
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label className="text-sm">{t("cashier.terminal.settings.bridge_url")}</Label>
                  <Input
                    dir="ltr"
                    className="font-mono text-sm"
                    value={cfg.bridgeUrl}
                    placeholder={DEFAULT_TERMINAL_CONFIG.bridgeUrl}
                    onChange={e => update({ bridgeUrl: e.target.value })}
                  />
                  <p className="text-xs text-slate-500">{t("cashier.terminal.settings.bridge_url_help")}</p>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-sm">{t("cashier.terminal.settings.bridge_token")}</Label>
                  <Input
                    dir="ltr"
                    type="password"
                    className="font-mono text-sm"
                    value={cfg.bridgeToken ?? ""}
                    onChange={e => update({ bridgeToken: e.target.value })}
                  />
                </div>
              </div>
            )}

            {cfg.driver === "mock" && (
              <div className="space-y-1.5">
                <Label className="text-sm">{t("cashier.terminal.settings.mock_scenario")}</Label>
                <div className="flex flex-wrap gap-1.5">
                  {MOCK_SCENARIOS.map(sc => (
                    <button
                      key={sc}
                      type="button"
                      onClick={() => { setMockScenario(sc); setScenario(sc) }}
                      className={`rounded-full border px-2.5 py-1 text-xs ${
                        scenario === sc
                          ? "border-emerald-500 bg-emerald-50 font-semibold text-emerald-700"
                          : "border-slate-200 text-slate-600 hover:border-slate-300"
                      }`}
                    >
                      {t(`cashier.terminal.settings.scenario_${sc}`)}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Button variant="outline" size="sm" onClick={runProbe} disabled={probe.state === "busy"}>
                {probe.state === "busy"
                  ? <Loader2 className="me-1.5 h-3.5 w-3.5 animate-spin" />
                  : <CheckCircle2 className="me-1.5 h-3.5 w-3.5" />}
                {t("cashier.terminal.settings.test")}
              </Button>
              {probe.state === "ok" && (
                <p className="flex items-center gap-1.5 text-xs text-emerald-700">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  {t("cashier.terminal.settings.test_ok")} {probe.detail}
                </p>
              )}
              {probe.state === "fail" && (
                <p className="flex items-center gap-1.5 text-xs text-red-600">
                  <XCircle className="h-3.5 w-3.5" />
                  {t("cashier.terminal.settings.test_fail")} {probe.detail}
                </p>
              )}
            </div>

            <Separator />

            <Row
              label={t("cashier.terminal.settings.auto_send")}
              help={t("cashier.terminal.settings.auto_send_help")}
              control={<Switch checked={cfg.autoSend} onCheckedChange={v => update({ autoSend: v })} />}
            />
            <Row
              label={t("cashier.terminal.settings.manual_fallback")}
              help={t("cashier.terminal.settings.manual_fallback_help")}
              control={
                <Switch
                  checked={cfg.allowManualFallback}
                  onCheckedChange={v => update({ allowManualFallback: v })}
                />
              }
            />

            {paymentMethods.length > 0 && (
              <>
                <Separator />
                <div className="space-y-2">
                  <Label className="text-sm">{t("cashier.terminal.settings.routing")}</Label>
                  <p className="text-xs text-slate-500">{t("cashier.terminal.settings.routing_help")}</p>
                  <div className="space-y-1.5 pt-1">
                    {paymentMethods.map(pm => {
                      const on = routesToTerminal(pm.mode_of_payment, { ...cfg, enabled: true })
                      return (
                        <div
                          key={pm.mode_of_payment}
                          className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2"
                        >
                          <span className="text-sm">{pm.mode_of_payment}</span>
                          <Switch
                            checked={on}
                            onCheckedChange={v => toggleRouting(pm.mode_of_payment, v)}
                          />
                        </div>
                      )
                    })}
                  </div>
                  {routed.length === 0 && (
                    <p className="text-xs text-amber-700">{t("cashier.terminal.settings.no_routed")}</p>
                  )}
                </div>
              </>
            )}

            {open.length > 0 && (
              <p className="rounded-lg bg-red-50 p-2.5 text-xs font-semibold text-red-700">
                {t("cashier.terminal.settings.open_charges").replace("{n}", String(open.length))}
              </p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}

function Row({ label, help, control }: { label: string; help: string; control: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="space-y-0.5">
        <Label className="text-sm">{label}</Label>
        <p className="text-xs text-slate-500">{help}</p>
      </div>
      <div className="pt-0.5">{control}</div>
    </div>
  )
}

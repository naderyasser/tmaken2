/**
 * Simulated payment terminal.
 *
 * Purpose: the acquirer is not chosen yet, and even once it is, nobody should have to
 * stand at a real mada terminal to test a decline, a timeout, or a mid-transaction
 * crash. This driver walks the exact same phase sequence and returns the exact same
 * verdict shapes as a real one, so the whole flow above it is finished and validated
 * before hardware exists.
 *
 * It is also the only safe driver for the demo tenant.
 */

import type {
  TerminalContext,
  TerminalDriver,
  TerminalProbe,
  TerminalRequest,
  TerminalResult,
} from "./types"

/** Forced outcome, for testing and demos. `random` is weighted heavily to approved. */
export type MockScenario =
  | "approved"
  | "declined"
  | "timeout"
  | "unknown"
  | "error"
  | "random"

export interface MockOptions {
  scenario?: MockScenario
  /** Multiplier on the simulated phase delays. 0 = instant (unit tests). */
  speed?: number
  /** Pretend the terminal is unplugged. */
  offline?: boolean
}

const SCENARIO_KEY = "cashier_terminal_mock_scenario"

export function getMockScenario(): MockScenario {
  try {
    const v = localStorage.getItem(SCENARIO_KEY) as MockScenario | null
    return v ?? "approved"
  } catch {
    return "approved"
  }
}

export function setMockScenario(s: MockScenario): void {
  try {
    localStorage.setItem(SCENARIO_KEY, s)
  } catch {
    /* non-persistent is fine — defaults to approved */
  }
}

/** Abortable sleep. Rejects nothing; resolves `false` when the wait was cut short. */
function wait(ms: number, signal: AbortSignal): Promise<boolean> {
  if (ms <= 0) return Promise.resolve(!signal.aborted)
  return new Promise(resolve => {
    const done = () => {
      clearTimeout(timer)
      signal.removeEventListener("abort", onAbort)
    }
    const onAbort = () => {
      done()
      resolve(false)
    }
    const timer = setTimeout(() => {
      done()
      resolve(true)
    }, ms)
    if (signal.aborted) onAbort()
    else signal.addEventListener("abort", onAbort)
  })
}

const digits = (n: number) =>
  Array.from({ length: n }, () => Math.floor(Math.random() * 10)).join("")

const SCHEMES = [
  { scheme: "mada", cardType: "debit", bin: "588845" },
  { scheme: "VISA", cardType: "credit", bin: "440000" },
  { scheme: "mastercard", cardType: "credit", bin: "530000" },
]

function pickScenario(forced: MockScenario): Exclude<MockScenario, "random"> {
  if (forced !== "random") return forced
  const roll = Math.random()
  if (roll < 0.85) return "approved"
  if (roll < 0.94) return "declined"
  if (roll < 0.97) return "timeout"
  if (roll < 0.99) return "error"
  return "unknown"
}

export class MockTerminalDriver implements TerminalDriver {
  readonly id = "mock"
  readonly label = "جهاز محاكاة (بدون بطاقة حقيقية)"

  private opts: MockOptions

  constructor(opts: MockOptions = {}) {
    this.opts = opts
  }

  private get speed(): number {
    return this.opts.speed ?? 1
  }

  private scenario(): Exclude<MockScenario, "random"> {
    return pickScenario(this.opts.scenario ?? getMockScenario())
  }

  async probe(): Promise<TerminalProbe> {
    if (this.opts.offline) {
      return { reachable: false, detail: "المحاكي مضبوط على وضع غير متصل" }
    }
    return { reachable: true, detail: "محاكي — لا يوجد جهاز حقيقي", terminalId: "MOCK0001" }
  }

  async transact(req: TerminalRequest, ctx: TerminalContext): Promise<TerminalResult> {
    const at = () => new Date().toISOString()
    const base = { clientRef: req.clientRef, at: at() }

    if (this.opts.offline) {
      return { ...base, outcome: "error", message: "تعذّر الوصول إلى الجهاز", at: at() }
    }

    const scenario = this.scenario()
    const s = this.speed

    ctx.onProgress?.({ phase: "connecting" })
    if (!(await wait(250 * s, ctx.signal))) return { ...base, outcome: "cancelled", at: at() }

    ctx.onProgress?.({ phase: "sent", message: `${req.amount.toFixed(2)} ${req.currency}` })
    if (!(await wait(300 * s, ctx.signal))) return { ...base, outcome: "cancelled", at: at() }

    ctx.onProgress?.({ phase: "waiting_card", message: "قدّم البطاقة" })
    // The long leg — this is where the cashier presses Cancel in real life.
    if (!(await wait(1600 * s, ctx.signal))) return { ...base, outcome: "cancelled", at: at() }

    if (scenario === "timeout") {
      ctx.onProgress?.({ phase: "waiting_card", message: "لم تُقدَّم البطاقة" })
      await wait(600 * s, ctx.signal)
      return { ...base, outcome: "timeout", message: "انتهت مهلة انتظار البطاقة", at: at() }
    }

    ctx.onProgress?.({ phase: "processing", message: "جارٍ التحقق" })
    if (!(await wait(900 * s, ctx.signal))) {
      // Cancelling DURING authorisation is exactly the ambiguous case: the request may
      // already be with the acquirer. A real driver cannot know either — report unknown.
      return {
        ...base,
        outcome: "unknown",
        message: "أُلغيت أثناء التحقق — الحالة غير مؤكدة",
        at: at(),
      }
    }

    const card = SCHEMES[Math.floor(Math.random() * SCHEMES.length)]
    const common = {
      ...base,
      terminalId: "MOCK0001",
      merchantId: "800000000000001",
      maskedPan: `${card.bin}******${digits(4)}`,
      scheme: card.scheme,
      cardType: card.cardType,
      stan: digits(6),
      batchNo: "000123",
      at: at(),
    }

    ctx.onProgress?.({ phase: "done" })

    switch (scenario) {
      case "approved":
        return {
          ...common,
          outcome: "approved",
          approvedAmount: req.amount,
          rrn: digits(12),
          authCode: digits(6),
          responseCode: "00",
          message: "تمت الموافقة",
          receiptText: [
            "*** نسخة العميل ***",
            `المبلغ: ${req.amount.toFixed(2)} ${req.currency}`,
            `البطاقة: ${common.maskedPan} (${card.scheme})`,
            "APPROVED / تمت الموافقة",
          ].join("\n"),
        }
      case "declined":
        return {
          ...common,
          outcome: "declined",
          responseCode: "51",
          message: "رصيد غير كافٍ",
        }
      case "error":
        return {
          ...common,
          outcome: "error",
          responseCode: "96",
          message: "خطأ في الجهاز",
        }
      case "unknown":
      default:
        return {
          ...common,
          outcome: "unknown",
          message: "انقطع الاتصال بالجهاز قبل قراءة النتيجة",
        }
    }
  }

  /**
   * A real driver queries the terminal. The mock has no memory across reloads, so it
   * honestly reports "cannot tell" rather than inventing an answer — which is what the
   * reconciliation UI must handle anyway for acquirers that lack the command.
   */
  async lastTransaction(): Promise<TerminalResult | null> {
    return null
  }

  async settle(): Promise<TerminalResult> {
    await wait(800 * this.speed, new AbortController().signal)
    return {
      outcome: "approved",
      message: "تم إقفال الدفعة (محاكاة)",
      batchNo: "000123",
      at: new Date().toISOString(),
    }
  }
}

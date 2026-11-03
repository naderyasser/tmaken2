/**
 * Local-bridge driver — the production path for a Windows till.
 *
 * SHAPE: the till (browser) speaks WebSocket to a small agent installed on the same PC;
 * the agent speaks the acquirer's ECR dialect (TCP/serial/USB) to the terminal. The
 * browser cannot do the second half itself, which is the whole reason the agent exists.
 *
 *     browser ── ws://127.0.0.1:PORT ── agent ── TCP/serial ── mada terminal
 *
 * The envelope below is OURS, not any acquirer's: the agent is the only component that
 * changes when the bank is chosen. Everything above this file stays untouched.
 *
 *   → { id, type: "probe" | "transact" | "last" | "settle" | "cancel", payload? }
 *   ← { id, type: "progress", phase, message? }
 *   ← { id, type: "result",   result: TerminalResult }
 *   ← { id, type: "error",    message }
 *
 * DEPLOYMENT NOTE — verify before rollout: this page is served over HTTPS, and a
 * ws:// connection from an HTTPS page is mixed content. Browsers exempt loopback
 * (127.0.0.1 / localhost) as a "potentially trustworthy" origin, but coverage differs
 * per browser and per version, so it must be confirmed on the actual till browser. If
 * loopback ws:// is refused there, the agent has to terminate TLS itself (wss:// with a
 * cert trusted by that machine) — `TerminalBridgeConfig.url` already allows either.
 */

import type {
  TerminalContext,
  TerminalDriver,
  TerminalPhase,
  TerminalProbe,
  TerminalRequest,
  TerminalResult,
} from "./types"

export interface TerminalBridgeConfig {
  /** e.g. "ws://127.0.0.1:8899/ecr" — or wss:// when the agent terminates TLS. */
  url: string
  /** Shared secret sent as the first frame, when the agent requires one. */
  token?: string
  /** How long to wait for a verdict before giving up on the SOCKET. Default 180s. */
  transactionTimeoutMs?: number
  /** Connect timeout. Default 4s — a missing agent must fail fast, not hang the till. */
  connectTimeoutMs?: number
}

interface Envelope {
  id?: string
  type?: string
  phase?: string
  message?: string
  result?: Partial<TerminalResult>
  [k: string]: unknown
}

const DEFAULT_TXN_TIMEOUT = 180_000
const DEFAULT_CONNECT_TIMEOUT = 4_000

function iso() {
  return new Date().toISOString()
}

/** Open a socket, or resolve null on any failure within the connect budget. */
function connect(cfg: TerminalBridgeConfig): Promise<WebSocket | null> {
  return new Promise(resolve => {
    let settled = false
    const finish = (ws: WebSocket | null) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      resolve(ws)
    }
    const timer = setTimeout(() => {
      try { sock?.close() } catch { /* */ }
      finish(null)
    }, cfg.connectTimeoutMs ?? DEFAULT_CONNECT_TIMEOUT)

    let sock: WebSocket | null = null
    try {
      sock = new WebSocket(cfg.url)
    } catch {
      finish(null)
      return
    }
    sock.onopen = () => {
      if (cfg.token) {
        try { sock?.send(JSON.stringify({ type: "auth", token: cfg.token })) } catch { /* */ }
      }
      finish(sock)
    }
    sock.onerror = () => finish(null)
    sock.onclose = () => finish(null)
  })
}

export class BridgeTerminalDriver implements TerminalDriver {
  readonly id = "bridge"
  readonly label = "وكيل محلي (جهاز الشبكة)"

  private cfg: TerminalBridgeConfig

  constructor(cfg: TerminalBridgeConfig) {
    this.cfg = cfg
  }

  async probe(): Promise<TerminalProbe> {
    const ws = await connect(this.cfg)
    if (!ws) {
      return { reachable: false, detail: `تعذّر الاتصال بالوكيل على ${this.cfg.url}` }
    }
    try {
      const res = await this.exchange(ws, { id: `probe-${Date.now()}`, type: "probe" }, 5_000)
      const payload = (res?.result ?? {}) as Partial<TerminalResult> & { detail?: string }
      return {
        reachable: res?.type !== "error",
        detail: res?.message ?? payload.message,
        terminalId: payload.terminalId,
      }
    } finally {
      try { ws.close() } catch { /* */ }
    }
  }

  /**
   * One transaction, one socket. A dedicated connection means a dropped socket is an
   * unambiguous signal about THIS transaction and nothing else.
   */
  async transact(req: TerminalRequest, ctx: TerminalContext): Promise<TerminalResult> {
    ctx.onProgress?.({ phase: "connecting" })

    const ws = await connect(this.cfg)
    if (!ws) {
      // Never reached the agent → the terminal was never asked → nothing was charged.
      // This is the one failure we can call clean, so it is "error", not "unknown".
      return {
        outcome: "error",
        clientRef: req.clientRef,
        message: `تعذّر الاتصال بوكيل الدفع على ${this.cfg.url}`,
        at: iso(),
      }
    }

    const timeoutMs = this.cfg.transactionTimeoutMs ?? DEFAULT_TXN_TIMEOUT

    return new Promise<TerminalResult>(resolve => {
      let settled = false
      /** True once the request is on the wire — from here on, silence means "unknown". */
      let sent = false

      const done = (result: TerminalResult) => {
        if (settled) return
        settled = true
        clearTimeout(timer)
        ctx.signal.removeEventListener("abort", onAbort)
        try { ws.close() } catch { /* */ }
        resolve(result)
      }

      /** The socket died or went quiet after we asked for money. Fate genuinely unknown. */
      const indeterminate = (message: string) =>
        done({ outcome: "unknown", clientRef: req.clientRef, message, at: iso() })

      const timer = setTimeout(
        () => indeterminate("انتهت المهلة دون رد من الجهاز"),
        timeoutMs,
      )

      const onAbort = () => {
        // Ask the agent to cancel on the TERMINAL, then wait for its verdict — the
        // terminal decides whether the cancel landed in time. We do not assume.
        try {
          ws.send(JSON.stringify({ id: req.clientRef, type: "cancel" }))
        } catch {
          indeterminate("أُلغيت العملية وتعذّر إبلاغ الجهاز")
          return
        }
        // If the agent never answers the cancel, the transaction timeout still fires.
      }
      ctx.signal.addEventListener("abort", onAbort)

      ws.onmessage = ev => {
        let msg: Envelope
        try {
          msg = JSON.parse(String(ev.data)) as Envelope
        } catch {
          return // ignore frames we cannot parse; the timeout remains the backstop
        }
        if (msg.id && msg.id !== req.clientRef && msg.type !== "progress") return

        if (msg.type === "progress") {
          ctx.onProgress?.({
            phase: (msg.phase as TerminalPhase) ?? "processing",
            message: msg.message,
          })
          return
        }
        if (msg.type === "result" && msg.result) {
          done(normaliseResult(msg.result, req))
          return
        }
        if (msg.type === "error") {
          // An agent-level error BEFORE the request went out is clean; after it, the
          // terminal may still have processed the charge.
          done({
            outcome: sent ? "unknown" : "error",
            clientRef: req.clientRef,
            message: msg.message ?? "خطأ من وكيل الدفع",
            at: iso(),
          })
        }
      }

      ws.onerror = () => {
        if (sent) indeterminate("انقطع الاتصال بالوكيل بعد إرسال الطلب")
        else done({ outcome: "error", clientRef: req.clientRef, message: "خطأ في الاتصال بالوكيل", at: iso() })
      }

      ws.onclose = () => {
        if (settled) return
        if (sent) indeterminate("أُغلق الاتصال بالوكيل قبل ورود النتيجة")
        else done({ outcome: "error", clientRef: req.clientRef, message: "أُغلق الاتصال بالوكيل", at: iso() })
      }

      try {
        ws.send(
          JSON.stringify({
            id: req.clientRef,
            type: "transact",
            payload: {
              kind: req.kind,
              amount: req.amount,
              currency: req.currency,
              clientRef: req.clientRef,
              originalRrn: req.originalRrn,
              invoiceHint: req.invoiceHint,
            },
          }),
        )
        sent = true
        ctx.onProgress?.({ phase: "sent" })
        if (ctx.signal.aborted) onAbort()
      } catch {
        done({ outcome: "error", clientRef: req.clientRef, message: "تعذّر إرسال الطلب للوكيل", at: iso() })
      }
    })
  }

  /** Ask the agent what the terminal last did — the crash-recovery query. */
  async lastTransaction(clientRef?: string): Promise<TerminalResult | null> {
    const ws = await connect(this.cfg)
    if (!ws) return null
    try {
      const res = await this.exchange(
        ws,
        { id: `last-${Date.now()}`, type: "last", payload: { clientRef } },
        15_000,
      )
      if (!res || res.type !== "result" || !res.result) return null
      const norm = normaliseResult(res.result, { clientRef: clientRef ?? "" } as TerminalRequest)
      // A driver that answers about a DIFFERENT transaction proves nothing about ours.
      if (clientRef && norm.clientRef && norm.clientRef !== clientRef) return null
      return norm
    } finally {
      try { ws.close() } catch { /* */ }
    }
  }

  async settle(): Promise<TerminalResult> {
    const ws = await connect(this.cfg)
    if (!ws) {
      return { outcome: "error", message: "تعذّر الاتصال بوكيل الدفع", at: iso() }
    }
    try {
      const res = await this.exchange(ws, { id: `settle-${Date.now()}`, type: "settle" }, 60_000)
      if (res?.type === "result" && res.result) {
        return normaliseResult(res.result, { clientRef: "" } as TerminalRequest)
      }
      return { outcome: "unknown", message: res?.message ?? "لم يرد الجهاز على طلب الإقفال", at: iso() }
    } finally {
      try { ws.close() } catch { /* */ }
    }
  }

  /** Single request → single response, with a hard timeout. Used by the non-money commands. */
  private exchange(ws: WebSocket, frame: Envelope, timeoutMs: number): Promise<Envelope | null> {
    return new Promise(resolve => {
      let settled = false
      const finish = (v: Envelope | null) => {
        if (settled) return
        settled = true
        clearTimeout(timer)
        resolve(v)
      }
      const timer = setTimeout(() => finish(null), timeoutMs)
      ws.onmessage = ev => {
        try {
          finish(JSON.parse(String(ev.data)) as Envelope)
        } catch {
          finish(null)
        }
      }
      ws.onerror = () => finish(null)
      ws.onclose = () => finish(null)
      try {
        ws.send(JSON.stringify(frame))
      } catch {
        finish(null)
      }
    })
  }
}

/**
 * Coerce whatever the agent sent into a TerminalResult we can trust the shape of.
 * An unrecognised outcome is downgraded to "unknown" — never silently to success.
 */
function normaliseResult(raw: Partial<TerminalResult>, req: TerminalRequest): TerminalResult {
  const allowed = ["approved", "declined", "cancelled", "timeout", "error", "unknown"]
  const outcome = allowed.indexOf(String(raw.outcome)) !== -1
    ? (raw.outcome as TerminalResult["outcome"])
    : "unknown"
  const num = (v: unknown) => (typeof v === "number" && isFinite(v) ? v : undefined)
  const str = (v: unknown) => (typeof v === "string" && v ? v : undefined)
  return {
    outcome,
    approvedAmount: num(raw.approvedAmount),
    rrn: str(raw.rrn),
    authCode: str(raw.authCode),
    maskedPan: str(raw.maskedPan),
    scheme: str(raw.scheme),
    cardType: str(raw.cardType),
    terminalId: str(raw.terminalId),
    merchantId: str(raw.merchantId),
    batchNo: str(raw.batchNo),
    stan: str(raw.stan),
    responseCode: str(raw.responseCode),
    message: str(raw.message),
    receiptText: str(raw.receiptText),
    clientRef: str(raw.clientRef) ?? req.clientRef,
    at: str(raw.at) ?? iso(),
    raw,
  }
}

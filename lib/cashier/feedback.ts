/**
 * Till feedback cues — tiny WebAudio beeps so the cashier doesn't have to look at the
 * screen after every scan. No audio assets, no autoplay issues (only fired from user
 * gestures / scan handlers), fail-soft everywhere.
 */

let ctx: AudioContext | null = null

function tone(freq: number, ms: number, delay = 0, volume = 0.06) {
  try {
    ctx = ctx || new (window.AudioContext || (window as any).webkitAudioContext)()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = "sine"
    osc.frequency.value = freq
    gain.gain.value = volume
    osc.connect(gain).connect(ctx.destination)
    const t = ctx.currentTime + delay / 1000
    osc.start(t)
    osc.stop(t + ms / 1000)
  } catch { /* audio unavailable — visual cues still fire */ }
}

/** Short high beep — item scanned & added. */
export function beepSuccess() {
  tone(880, 90)
}

/** Low double-buzz — barcode/search found nothing. */
export function beepError() {
  tone(220, 120)
  tone(180, 140, 150)
}

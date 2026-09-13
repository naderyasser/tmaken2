// Lazy GSAP loader + reduced-motion gate. GSAP (and Flip) are imported on demand so they
// only land in the chunks of the page that uses them (the search/map page).
let _gsap: any = null

export function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined'
    && typeof window.matchMedia === 'function'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

export async function getGsap(): Promise<any> {
  if (_gsap) return _gsap
  const core = await import('gsap')
  _gsap = (core as any).gsap || (core as any).default || core
  try {
    const flip = await import('gsap/Flip')
    _gsap.registerPlugin((flip as any).Flip || (flip as any).default)
  } catch { /* Flip optional */ }
  return _gsap
}

/** Tween a number into an element's textContent (Western tabular numerals). No-op (instant)
 *  under reduced motion. */
export async function tweenNumber(el: HTMLElement | null, from: number, to: number, ms = 500) {
  if (!el) return
  if (prefersReducedMotion()) { el.textContent = String(to); return }
  const g = await getGsap()
  const obj = { v: from }
  g.to(obj, { v: to, duration: ms / 1000, ease: 'power2.out', onUpdate: () => { el.textContent = String(Math.round(obj.v)) } })
}

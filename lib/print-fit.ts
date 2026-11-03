/**
 * Fit a printable area onto exactly one page, whatever its row count.
 *
 * A report listing 8 employees and one listing 300 both have to come out as a
 * single sheet. Rather than guess a font size, measure the content against the
 * real printable box and scale it down by exactly the factor needed — never up,
 * so short reports keep their normal size.
 *
 * Two passes, because width and height are not independent: shrinking to fit
 * the height leaves the table in a narrow strip unless the layout width is
 * widened by the same factor first — and widening changes how text wraps, which
 * changes the height. One correction pass is enough to converge in practice.
 *
 * Why a probe element: the CSS px-per-mm ratio is not a constant we can
 * hardcode (it moves with zoom and device pixel ratio). Rendering a throwaway
 * div sized in mm and reading back its pixel size gives the true ratio at the
 * moment of printing.
 */

export type PageOrientation = 'portrait' | 'landscape'

export interface PrintFitOptions {
	/** Page margin in millimetres. Must match the @page margin. */
	marginMm?: number
	orientation?: PageOrientation
	/** Don't shrink past this — below it the text stops being readable. */
	minScale?: number
}

const A4_WIDTH_MM = 210
const A4_HEIGHT_MM = 297
const NOMINAL_PX_PER_MM = 96 / 25.4

/** Measure how many CSS pixels one millimetre currently occupies. */
function pxPerMm(): number {
	const probe = document.createElement('div')
	probe.style.cssText =
		'position:absolute;left:-9999px;top:-9999px;width:100mm;height:100mm;visibility:hidden;'
	document.body.appendChild(probe)
	const ratio = probe.getBoundingClientRect().height / 100
	probe.remove()
	return ratio > 0 ? ratio : NOMINAL_PX_PER_MM
}

function naturalHeight(el: HTMLElement): number {
	return Math.max(el.scrollHeight, el.getBoundingClientRect().height)
}

/**
 * Compute the scale that fits `el` on one page and publish it, along with the
 * layout width and reserved height, as custom properties on that element.
 * Returns the scale used.
 */
export function fitToOnePage(el: HTMLElement, opts: PrintFitOptions = {}): number {
	const { marginMm = 12, orientation = 'portrait', minScale = 0.2 } = opts
	const wrapper = el.parentElement
	if (!wrapper) return 1

	const ratio = pxPerMm()
	const pageWmm = orientation === 'landscape' ? A4_HEIGHT_MM : A4_WIDTH_MM
	const pageHmm = orientation === 'landscape' ? A4_WIDTH_MM : A4_HEIGHT_MM
	const availW = (pageWmm - marginMm * 2) * ratio
	const availH = (pageHmm - marginMm * 2) * ratio
	if (availW <= 0 || availH <= 0) return 1

	// Measure unscaled, at the true page width. Widening by 1/scale each round
	// keeps the scaled result spanning the full page width; that changes how
	// text wraps, which changes the height, hence the loop.
	el.style.setProperty('--print-scale', '1')
	let scale = 1
	for (let round = 0; round < 4; round++) {
		el.style.setProperty('--print-width', `${availW / scale}px`)
		const contentH = naturalHeight(el)
		if (contentH <= 0) return 1
		const next = Math.max(minScale, Math.min(1, availH / contentH))
		if (Math.abs(next - scale) < 0.005) { scale = next; break }
		scale = next
	}

	el.style.setProperty('--print-width', `${availW / scale}px`)
	el.style.setProperty('--print-scale', String(scale))

	// The scaled height goes on the WRAPPER, never on the transformed element:
	// a height set there lives in that element's own unscaled coordinate space,
	// so clipping to an already-scaled value cuts the content twice and silently
	// drops rows. The wrapper clips the child's visual, post-transform box.
	wrapper.style.setProperty('--print-page-height', `${Math.min(naturalHeight(el) * scale, availH)}px`)
	return scale
}

function clearFit(el: HTMLElement): void {
	el.style.removeProperty('--print-scale')
	el.style.removeProperty('--print-width')
	el.parentElement?.style.removeProperty('--print-page-height')
}

/**
 * Fit, print, then restore. Use instead of a bare window.print().
 */
export function printOnePage(el: HTMLElement | null, opts?: PrintFitOptions): void {
	if (!el) {
		window.print()
		return
	}

	fitToOnePage(el, opts)

	const cleanup = () => {
		clearFit(el)
		window.removeEventListener('afterprint', cleanup)
	}
	window.addEventListener('afterprint', cleanup)

	// Let the layout settle with the new scale before opening the dialog.
	requestAnimationFrame(() => {
		window.print()
		// Safari never fires afterprint reliably; restore defensively.
		setTimeout(cleanup, 1000)
	})
}

/**
 * The CSS half of the mechanism. Inject alongside the report's own print rules.
 * `selector` must match the element passed to printOnePage.
 */
export function onePagePrintCss(
	wrapperSelector: string,
	innerSelector: string,
	orientation: PageOrientation = 'portrait',
	marginMm = 12,
	rtl = true,
): string {
	return `
    @media print {
      @page { size: A4 ${orientation}; margin: ${marginMm}mm; }
      ${wrapperSelector} {
        height: var(--print-page-height, auto);
        overflow: hidden !important;
        page-break-inside: avoid !important;
        break-inside: avoid !important;
      }
      ${innerSelector} {
        transform: scale(var(--print-scale, 1));
        transform-origin: top ${rtl ? 'right' : 'left'};
        width: var(--print-width, 100%) !important;
        max-width: none !important;
      }
      /* Row-level breaking would split the table back across pages. */
      ${innerSelector} table, ${innerSelector} thead,
      ${innerSelector} tbody, ${innerSelector} tr {
        page-break-inside: avoid !important;
        break-inside: avoid !important;
      }
      ${innerSelector} thead { display: table-header-group; }
      html, body { height: auto !important; }
    }
  `
}

import { buildPartsInvoiceHtml, type PartsInvoiceLine, type PartsInvoiceSpec } from '@/lib/print-parts-invoice'

/** Pull the rendered table back out as a matrix so assertions read like the sheet. */
function tableOf(html: string): { head: string[]; body: string[][] } {
    const rows = [...html.matchAll(/<tr>((?:<t[dh]>.*?<\/t[dh]>)+)<\/tr>/g)].map((m) =>
        [...m[1].matchAll(/<t[dh]>(.*?)<\/t[dh]>/g)].map((c) => c[1].replace(/<[^>]+>/g, ''))
    )
    return { head: rows[0] || [], body: rows.slice(1) }
}

const COL = {
    date: 0, soldTo: 1, shipTo: 2, salesOrder: 3, invoiceNo: 4, custOrder: 5,
    totalNet: 6, totalGross: 7, partNo: 8, partName: 9, qty: 10, caseNo: 11,
    unitPrice: 12, disc: 13, net: 14, vat: 15, gross: 16,
}

const line = (over: Partial<PartsInvoiceLine> = {}): PartsInvoiceLine => ({
    partNumber: '9031150064', partName: 'صوفة/صوفة', qty: '1',
    caseNumber: 'R03290600690018', unitPrice: '100', discountPct: '0', ...over,
})

const spec = (over: Partial<PartsInvoiceSpec> = {}): PartsInvoiceSpec => ({
    date: '2026-08-18', soldToParty: '2000000329', shipToParty: '2000000329',
    salesOrderNumber: '3500632612', invoiceNumber: '9027581732',
    customerOrderNumber: '0003906644', vatPercent: '15', lines: [line()], ...over,
})

const cell = (s: PartsInvoiceSpec, row: number, col: number) => tableOf(buildPartsInvoiceHtml(s)).body[row][col]

describe('parts invoice — sheet structure', () => {
    it('emits the supplier\'s 17 columns in the source order', () => {
        expect(tableOf(buildPartsInvoiceHtml(spec())).head).toEqual([
            'Date', 'Sold to Party', 'Ship to Party', 'Sales Order Number', 'Invoice Number',
            'Customer Order Number', 'Total Net Price without VAT', 'Total Net Price with VAT',
            'Part Number', 'Part Name', 'Issued Quantity', 'Case Number', 'Unit Price',
            'Discount %', 'Net Price without VAT', 'VAT %', 'Net Price with VAT',
        ])
    })

    it('carries both Arabic and English titles', () => {
        const html = buildPartsInvoiceHtml(spec())
        expect(html).toContain('فاتورة قطع غيار')
        expect(html).toContain('Parts Invoice')
    })

    it('renders landscape LTR, since the sheet reads left-to-right', () => {
        const html = buildPartsInvoiceHtml(spec())
        expect(html).toContain('size: A4 landscape')
        expect(html).toContain('<html dir="ltr"')
    })

    it('repeats the document fields on every line', () => {
        const t = tableOf(buildPartsInvoiceHtml(spec({ lines: [line(), line(), line()] })))
        expect(t.body).toHaveLength(3)
        for (const row of t.body) {
            expect(row[COL.date]).toBe('2026-08-18')
            expect(row[COL.invoiceNo]).toBe('9027581732')
            expect(row[COL.custOrder]).toBe('0003906644')
        }
    })

    it('marks Arabic part names RTL but leaves English ones alone', () => {
        const html = buildPartsInvoiceHtml(spec({
            lines: [line({ partName: 'صوفة/صوفة' }), line({ partName: 'SEAL, TYPE T OIL' })],
        }))
        expect(html).toContain('<span dir="rtl">صوفة/صوفة</span>')
        expect(html).toContain('<span>SEAL, TYPE T OIL</span>')
    })

    it('escapes HTML so a part name cannot inject markup', () => {
        const html = buildPartsInvoiceHtml(spec({ lines: [line({ partName: '<script>x</script>' })] }))
        expect(html).not.toContain('<script>x</script>')
        expect(html).toContain('&lt;script&gt;')
    })
})

describe('parts invoice — number formatting', () => {
    it('prints quantity with 3 decimals and money with 2', () => {
        const row = tableOf(buildPartsInvoiceHtml(spec({ lines: [line({ qty: '70', unitPrice: '64', discountPct: '59.02' })] }))).body[0]
        expect(row[COL.qty]).toBe('70.000')
        expect(row[COL.unitPrice]).toBe('64.00')
        expect(row[COL.disc]).toBe('59.02')
        expect(row[COL.vat]).toBe('15.00')
    })

    it('never uses thousands separators — the source sheet has none', () => {
        const html = buildPartsInvoiceHtml(spec({ lines: [line({ qty: '1000', unitPrice: '1000' })] }))
        expect(tableOf(html).body[0][COL.net]).toBe('1000000.00')
        expect(html).not.toMatch(/\d,\d{3}/)
    })

    it('treats blank / non-numeric inputs as zero instead of NaN', () => {
        const row = tableOf(buildPartsInvoiceHtml(spec({
            lines: [line({ qty: '', unitPrice: 'abc', discountPct: undefined as never })],
        }))).body[0]
        expect(row[COL.qty]).toBe('0.000')
        expect(row[COL.unitPrice]).toBe('0.00')
        expect(row[COL.net]).toBe('0.00')
    })

    it('accepts numbers as well as strings', () => {
        expect(cell(spec({ lines: [line({ qty: 12, unitPrice: 71, discountPct: 63.72 })] }), 0, COL.net))
            .toBe(cell(spec({ lines: [line({ qty: '12', unitPrice: '71', discountPct: '63.72' })] }), 0, COL.net))
    })

    it('clamps a discount outside 0–100', () => {
        expect(cell(spec({ lines: [line({ qty: '2', unitPrice: '50', discountPct: '-5' })] }), 0, COL.net)).toBe('100.00')
        expect(cell(spec({ lines: [line({ qty: '2', unitPrice: '50', discountPct: '150' })] }), 0, COL.net)).toBe('0.00')
    })
})

// ── rounding ────────────────────────────────────────────────────────────────
// The supplier computes in decimal. Six of the 89 lines in their reference
// invoice land on an exact .xx5 tie, and the two sides of the sheet break those
// ties differently: the line net rounds DOWN, the VAT (taken off the ALREADY
// rounded net) rounds UP. Getting either wrong silently desyncs the document
// totals, so these cases are pinned to the supplier's own figures.

describe('parts invoice — tie rounding matches the supplier', () => {
    const net = (qty: string, price: string, disc: string) =>
        cell(spec({ vatPercent: '15', lines: [line({ qty, unitPrice: price, discountPct: disc })] }), 0, COL.net)

    it.each([
        // qty     price    disc      raw value      supplier prints
        ['50',    '189',   '61.59',  '3629.745',    '3629.74'],
        ['50',    '23',    '61.47',  '443.095',     '443.09'],
        ['50',    '37.5',  '64.42',  '667.125',     '667.12'],
        ['30',    '22.5',  '66.42',  '226.665',     '226.66'],
        ['25',    '570',   '62.51',  '5342.325',    '5342.32'],
        ['50',    '47.5',  '67.38',  '774.725',     '774.72'],
    ])('net of %s x %s less %s%% (raw %s) rounds down to %s', (qty, price, disc, _raw, want) => {
        expect(net(qty, price, disc)).toBe(want)
    })

    it('rounds a net tie down where naive float rounding would go up', () => {
        // Math.round(3629.745 * 100) / 100 === 3629.75 — the trap this guards.
        expect(Math.round(3629.745 * 100) / 100).toBe(3629.75)
        expect(net('50', '189', '61.59')).toBe('3629.74')
    })

    it('rounds a VAT tie up', () => {
        // 1835.90 x 1.15 = 2111.285 exactly; the supplier prints 2111.29.
        const row = tableOf(buildPartsInvoiceHtml(spec({
            vatPercent: '15', lines: [line({ qty: '70', unitPrice: '64', discountPct: '59.02' })],
        }))).body[0]
        expect(row[COL.net]).toBe('1835.90')
        expect(row[COL.gross]).toBe('2111.29')
    })

    it('computes VAT from the rounded net, not the raw one', () => {
        // raw 3629.745 -> net 3629.74; 3629.74 x 1.15 = 4174.201 -> 4174.20.
        // From the raw value it would have been 4174.21.
        const row = tableOf(buildPartsInvoiceHtml(spec({
            vatPercent: '15', lines: [line({ qty: '50', unitPrice: '189', discountPct: '61.59' })],
        }))).body[0]
        expect(row[COL.gross]).toBe('4174.20')
    })

    it('rounds normally away from ties', () => {
        expect(net('12', '71', '63.72')).toBe('309.11')
        expect(net('200', '16.38', '61.86')).toBe('1249.47')
    })
})

describe('parts invoice — document totals', () => {
    it('totals the rounded line values, so the column adds up on paper', () => {
        const lines = [
            line({ qty: '70', unitPrice: '64', discountPct: '59.02' }),    // 1835.90
            line({ qty: '200', unitPrice: '16.38', discountPct: '61.86' }), // 1249.47
            line({ qty: '12', unitPrice: '71', discountPct: '63.72' }),     //  309.11
        ]
        const t = tableOf(buildPartsInvoiceHtml(spec({ lines })))
        const sum = t.body.reduce((acc, r) => acc + Number(r[COL.net]), 0)
        expect(t.body[0][COL.totalNet]).toBe(sum.toFixed(2))
        expect(t.body[0][COL.totalNet]).toBe('3394.48')
    })

    it('shows the same totals on every row', () => {
        const t = tableOf(buildPartsInvoiceHtml(spec({ lines: [line(), line({ qty: '5' })] })))
        expect(t.body[0][COL.totalNet]).toBe(t.body[1][COL.totalNet])
        expect(t.body[0][COL.totalGross]).toBe(t.body[1][COL.totalGross])
    })

    it('handles a zero-VAT tenant', () => {
        const t = tableOf(buildPartsInvoiceHtml(spec({ vatPercent: '0', lines: [line({ qty: '2', unitPrice: '50' })] })))
        expect(t.body[0][COL.net]).toBe('100.00')
        expect(t.body[0][COL.gross]).toBe('100.00')
        expect(t.body[0][COL.totalGross]).toBe('100.00')
    })

    it('renders an empty invoice without throwing', () => {
        const t = tableOf(buildPartsInvoiceHtml(spec({ lines: [] })))
        expect(t.body).toHaveLength(0)
        expect(t.head).toHaveLength(17)
    })
})

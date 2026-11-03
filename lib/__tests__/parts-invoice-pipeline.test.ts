/**
 * End-to-end check of the path a real receipt takes: supplier file in →
 * parsed → reconciled against the Item master → printed sheet out, with the
 * printed cells compared to the figures the supplier's own system produced.
 *
 * The rows below are lifted verbatim from the client's reference invoice
 * (INV_2000000329_9027581732_2026) and include all six lines whose net lands
 * on an exact .xx5 rounding tie. The file itself is deliberately NOT committed
 * — it is live commercial data (party numbers, cost prices, dealer discounts).
 */

import { parseInvoiceDocument, dashifyToyotaCode } from '@/lib/invoice-file'
import { buildPartsInvoiceHtml } from '@/lib/print-parts-invoice'

// code, part name, qty, unit price, discount %, case no, supplier's net, supplier's gross
const SUPPLIER_ROWS: Array<[string, string, string, string, string, string, string, string]> = [
    ['9031150064', 'صوفة/صوفة', '70.000', '64.00', '59.02', 'R03290600690018', '1835.90', '2111.29'],
    ['9030127015', 'جلدة/جلدة', '200.000', '16.38', '61.86', 'R03290600690018', '1249.47', '1436.89'],
    ['9031144007', 'صوفة/صوفة', '12.000', '71.00', '63.72', 'R03290600690018', '309.11', '355.48'],
    ['9031189010', 'صوفة/صوفة', '50.000', '189.00', '61.59', 'R03290600690018', '3629.74', '4174.20'],
    ['8851507030', 'بلف/بلف', '3.000', '393.00', '69.07', 'R03290600690018', '364.66', '419.36'],
    ['9031016001', 'صوفة/صوفة', '50.000', '23.00', '61.47', 'R03290600690018', '443.09', '509.55'],
    ['9031125032', 'صوفة/صوفة', '50.000', '37.50', '64.42', 'R03290600690018', '667.12', '767.19'],
    ['8934833100A1', 'غطاء/غطاء', '5.000', '43.00', '64.45', 'R03290600690001', '76.43', '87.89'],
    ['9038518013', 'جلدة/جلدة', '30.000', '22.50', '66.42', 'R03290600690018', '226.66', '260.66'],
    ['8961520090', 'حساس/حساس', '25.000', '570.00', '62.51', 'R03290600690018', '5342.32', '6143.67'],
    ['9091905060', 'حساس/حساس', '5.000', '365.00', '62.08', 'R03290600690001', '692.04', '795.85'],
    ['9031140048', 'صوفة/صوفة', '50.000', '47.50', '67.38', 'R03290600690018', '774.72', '890.93'],
    ['9048030025', 'حلقة/حلقة', '30.000', '26.50', '67.66', 'R03290600690018', '257.10', '295.67'],
]

const DOC = {
    date: '2026-08-18', soldTo: '2000000329', shipTo: '2000000329',
    salesOrder: '3500632612', invoice: '9027581732', custOrder: '0003906644', vat: '15.00',
}

const HEADERS = [
    'Date', 'Sold to Party', 'Ship to Party', 'Sales Order Number', 'Invoice Number',
    'Customer Order Number', 'Total Net Price without VAT', 'Total Net Price with VAT',
    'Part Number', 'Part Name', 'Issued Quantity', 'Case Number', 'Unit Price',
    'Discount %', 'Net Price without VAT', 'VAT %', 'Net Price with VAT',
]

const COL = { partNo: 8, partName: 9, qty: 10, caseNo: 11, unitPrice: 12, disc: 13, net: 14, vat: 15, gross: 16, totalNet: 6, totalGross: 7 }

/** Rebuild the supplier's sheet as a CSV file the parser can consume. */
function supplierFile(): File {
    const sum = (i: number) => SUPPLIER_ROWS.reduce((t, r) => t + Number(r[i]), 0).toFixed(2)
    const [totalNet, totalGross] = [sum(6), sum(7)]
    const body = SUPPLIER_ROWS.map(([code, name, qty, price, disc, caseNo, net, gross]) => [
        DOC.date, DOC.soldTo, DOC.shipTo, DOC.salesOrder, DOC.invoice, DOC.custOrder,
        totalNet, totalGross, code, name, qty, caseNo, price, disc, net, DOC.vat, gross,
    ])
    return new File([[HEADERS, ...body].map((r) => r.join(',')).join('\n')], 'INV_2000000329_9027581732_2026_1.csv', { type: 'text/csv' })
}

function tableOf(html: string): string[][] {
    const rows = [...html.matchAll(/<tr>((?:<t[dh]>.*?<\/t[dh]>)+)<\/tr>/g)].map((m) =>
        [...m[1].matchAll(/<t[dh]>(.*?)<\/t[dh]>/g)].map((c) => c[1].replace(/<[^>]+>/g, ''))
    )
    return rows.slice(1)
}

/** What the receipt screen does between import and print. */
function importThenPrint(doc: Awaited<ReturnType<typeof parseInvoiceDocument>>, itemMaster: Set<string>) {
    const reconciled = doc.lines.map((l) => {
        const dashed = dashifyToyotaCode(l.item_code)
        return {
            ...l,
            source_code: l.item_code,
            item_code: itemMaster.has(l.item_code) ? l.item_code : (itemMaster.has(dashed) ? dashed : l.item_code),
        }
    })
    const usable = reconciled.filter((l) => itemMaster.has(l.item_code))
    return {
        usable,
        html: buildPartsInvoiceHtml({
            date: doc.date!, soldToParty: DOC.soldTo, shipToParty: DOC.shipTo,
            salesOrderNumber: doc.salesOrderNumber!, invoiceNumber: doc.invoiceNumber!,
            customerOrderNumber: doc.customerOrderNumber!, vatPercent: doc.vatPercent!,
            lines: usable.map((l) => ({
                partNumber: (l.source_code || l.item_code).trim(),
                partName: l.part_name || '',
                qty: l.qty, caseNumber: l.case_number || '',
                unitPrice: l.rate, discountPct: l.disc,
            })),
        }),
    }
}

// The Item master really does hold the dashed Toyota form.
const ITEM_MASTER = new Set(SUPPLIER_ROWS.map(([code]) => dashifyToyotaCode(code)))

describe('supplier file → printed parts invoice', () => {
    it('reproduces every net and VAT figure the supplier printed', async () => {
        const doc = await parseInvoiceDocument(supplierFile())
        const { html } = importThenPrint(doc, ITEM_MASTER)
        const body = tableOf(html)

        expect(body).toHaveLength(SUPPLIER_ROWS.length)
        SUPPLIER_ROWS.forEach(([code, name, qty, price, disc, caseNo, net, gross], i) => {
            expect(body[i][COL.partNo]).toBe(code)      // raw, not the dashed master form
            expect(body[i][COL.partName]).toBe(name)
            expect(body[i][COL.qty]).toBe(qty)
            expect(body[i][COL.unitPrice]).toBe(price)
            expect(body[i][COL.disc]).toBe(disc)
            expect(body[i][COL.caseNo]).toBe(caseNo)
            expect(body[i][COL.net]).toBe(net)
            expect(body[i][COL.gross]).toBe(gross)
        })
    })

    it('totals match the sum of the supplier\'s own line values', async () => {
        const doc = await parseInvoiceDocument(supplierFile())
        const body = tableOf(importThenPrint(doc, ITEM_MASTER).html)
        const expectNet = SUPPLIER_ROWS.reduce((t, r) => t + Number(r[6]), 0).toFixed(2)
        const expectGross = SUPPLIER_ROWS.reduce((t, r) => t + Number(r[7]), 0).toFixed(2)
        expect(body[0][COL.totalNet]).toBe(expectNet)
        expect(body[0][COL.totalGross]).toBe(expectGross)
    })

    it('prints the supplier\'s raw code even though stock posts against the dashed one', async () => {
        const doc = await parseInvoiceDocument(supplierFile())
        const { usable, html } = importThenPrint(doc, ITEM_MASTER)
        expect(usable[0].item_code).toBe('90311-50064')   // what ERPNext receives
        expect(tableOf(html)[0][COL.partNo]).toBe('9031150064') // what the sheet shows
    })

    it('carries the per-line case number, not one value for the whole sheet', async () => {
        const doc = await parseInvoiceDocument(supplierFile())
        const body = tableOf(importThenPrint(doc, ITEM_MASTER).html)
        expect(new Set(body.map((r) => r[COL.caseNo])).size).toBe(2)
    })

    it('drops lines whose code is unknown to the Item master', async () => {
        const doc = await parseInvoiceDocument(supplierFile())
        const partial = new Set([...ITEM_MASTER].slice(0, 3))
        const { usable } = importThenPrint(doc, partial)
        expect(usable).toHaveLength(3)
    })

    it('reads the document header off the file rather than asking for it', async () => {
        const doc = await parseInvoiceDocument(supplierFile())
        expect(doc.invoiceNumber).toBe(DOC.invoice)
        expect(doc.salesOrderNumber).toBe(DOC.salesOrder)
        expect(doc.customerOrderNumber).toBe(DOC.custOrder)
        expect(doc.date).toBe(DOC.date)
        expect(doc.vatPercent).toBe(DOC.vat)
    })
})

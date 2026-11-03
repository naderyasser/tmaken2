import {
    mapRowsToLines, splitHeaderRow, dashifyToyotaCode, guessMapping, applyMapping,
    parseInvoiceDocument, parseDbf, writeDbf, writeXlsx, buildZip,
    type RawTable,
} from '@/lib/invoice-file'

/** The supplier's sheet: three blank rows, two title rows, then the header. */
const SUPPLIER_HEADERS = [
    'Date', 'Sold to Party', 'Ship to Party', 'Sales Order Number', 'Invoice Number',
    'Customer Order Number', 'Total Net Price without VAT', 'Total Net Price with VAT',
    'Part Number', 'Part Name', 'Issued Quantity', 'Case Number', 'Unit Price',
    'Discount %', 'Net Price without VAT', 'VAT %', 'Net Price with VAT',
]
const supplierRow = (code: string, name: string, qty: string, price: string, disc: string, caseNo = 'R03290600690018') =>
    ['2026-08-18', '2000000329', '2000000329', '3500632612', '9027581732', '0003906644',
     '68457.96', '78726.70', code, name, qty, caseNo, price, disc, '1835.90', '15.00', '2111.29']

/** parseInvoiceDocument takes a File; in jsdom a Blob-backed stand-in is enough. */
function csvFile(name: string, rows: string[][]): File {
    const csv = rows.map((r) => r.join(',')).join('\n')
    return new File([csv], name, { type: 'text/csv' })
}

describe('dashifyToyotaCode', () => {
    it('splits a bare 10-digit code 5-5', () => {
        expect(dashifyToyotaCode('9031150064')).toBe('90311-50064')
    })

    it('puts the remainder in a third group', () => {
        expect(dashifyToyotaCode('8794533030A0')).toBe('87945-33030-A0')
    })

    it('leaves already-dashed, short, or non-alphanumeric codes alone', () => {
        expect(dashifyToyotaCode('90311-50064')).toBe('90311-50064')
        expect(dashifyToyotaCode('SM-105')).toBe('SM-105')
        expect(dashifyToyotaCode('12345')).toBe('12345')
        expect(dashifyToyotaCode('ABC 12345678')).toBe('ABC 12345678')
    })

    it('trims surrounding whitespace', () => {
        expect(dashifyToyotaCode('  9031150064  ')).toBe('90311-50064')
    })
})

describe('splitHeaderRow', () => {
    it('finds the header buried under the sheet\'s title rows', () => {
        const matrix = [[''], [''], [''], ['فاتورة قطع غيار'], ['Parts Invoice'], [''],
            SUPPLIER_HEADERS, supplierRow('9031150064', 'صوفة/صوفة', '70.000', '64.00', '59.02')]
        const t = splitHeaderRow(matrix)
        expect(t.headers).toEqual(SUPPLIER_HEADERS)
        expect(t.rows).toHaveLength(1)
        expect(t.rows[0][8]).toBe('9031150064')
    })

    it('falls back to the first non-empty row when nothing looks like a header', () => {
        const t = splitHeaderRow([[''], ['a', 'b'], ['1', '2']])
        expect(t.headers).toEqual(['a', 'b'])
        expect(t.rows).toEqual([['1', '2']])
    })

    it('returns empty for an empty matrix', () => {
        expect(splitHeaderRow([])).toEqual({ headers: [], rows: [] })
    })
})

describe('mapRowsToLines', () => {
    it('maps the supplier\'s English headers onto the target fields', () => {
        const lines = mapRowsToLines(SUPPLIER_HEADERS, [supplierRow('9031150064', 'صوفة/صوفة', '70.000', '64.00', '59.02')])
        expect(lines).toHaveLength(1)
        expect(lines[0]).toMatchObject({
            item_code: '9031150064', qty: '70', rate: '64', disc: '59.02',
            part_name: 'صوفة/صوفة', case_number: 'R03290600690018',
        })
    })

    it('reads the target format\'s own FITEMNO/FQTY headers too', () => {
        const lines = mapRowsToLines(['FITEMNO', 'FQTY', 'FPRICE', 'FDISC'], [['90311-50064', '70.00', '64.00', '59.02']])
        expect(lines[0]).toMatchObject({ item_code: '90311-50064', qty: '70', rate: '64', disc: '59.02' })
    })

    it('falls back to column order when the header row is unrecognisable', () => {
        const lines = mapRowsToLines(['9031150064', '70', '64', '59.02'], [['9030127015', '200', '16.38', '61.86']])
        // The "header" is data too, so both rows come through.
        expect(lines.map((l) => l.item_code)).toEqual(['9031150064', '9030127015'])
    })

    it('drops rows with no code or a non-positive quantity', () => {
        const lines = mapRowsToLines(SUPPLIER_HEADERS, [
            supplierRow('9031150064', 'صوفة', '70', '64', '59.02'),
            supplierRow('', 'بلا كود', '5', '10', '0'),
            supplierRow('9030127015', 'كمية صفر', '0', '10', '0'),
        ])
        expect(lines.map((l) => l.item_code)).toEqual(['9031150064'])
    })

    it('omits part_name / case_number when the file has no such columns', () => {
        const lines = mapRowsToLines(['FITEMNO', 'FQTY'], [['90311-50064', '3']])
        expect(lines[0].part_name).toBeUndefined()
        expect(lines[0].case_number).toBeUndefined()
    })

    it('strips thousands separators from numbers', () => {
        const lines = mapRowsToLines(['FITEMNO', 'FQTY', 'FPRICE'], [['A123456789', '1,200', '1,500.50']])
        expect(lines[0]).toMatchObject({ qty: '1200', rate: '1500.5' })
    })
})

describe('parseInvoiceDocument', () => {
    it('returns the document fields that repeat on every row', async () => {
        const doc = await parseInvoiceDocument(csvFile('INV.csv', [
            SUPPLIER_HEADERS,
            supplierRow('9031150064', 'صوفة/صوفة', '70.000', '64.00', '59.02'),
        ]))
        expect(doc).toMatchObject({
            date: '2026-08-18', soldToParty: '2000000329', shipToParty: '2000000329',
            salesOrderNumber: '3500632612', invoiceNumber: '9027581732',
            customerOrderNumber: '0003906644', vatPercent: '15.00',
        })
        expect(doc.lines).toHaveLength(1)
    })

    it('keeps a per-line case number rather than one for the whole file', async () => {
        const doc = await parseInvoiceDocument(csvFile('INV.csv', [
            SUPPLIER_HEADERS,
            supplierRow('9031150064', 'صوفة', '70', '64', '59.02', 'R03290600690018'),
            supplierRow('9030127015', 'جلدة', '200', '16.38', '61.86', 'R03290600690001'),
        ]))
        expect(doc.lines.map((l) => l.case_number)).toEqual(['R03290600690018', 'R03290600690001'])
    })

    it('leaves document fields undefined for a plain target-format file', async () => {
        const doc = await parseInvoiceDocument(csvFile('out.csv', [
            ['FITEMNO', 'FQTY', 'FPRICE', 'FDISC'], ['90311-50064', '70', '64', '59.02'],
        ]))
        expect(doc.invoiceNumber).toBeUndefined()
        expect(doc.soldToParty).toBeUndefined()
        expect(doc.lines).toHaveLength(1)
    })

    it('ignores blank spacer rows when picking the document row', async () => {
        const doc = await parseInvoiceDocument(csvFile('INV.csv', [
            SUPPLIER_HEADERS,
            new Array(17).fill(''),
            supplierRow('9031150064', 'صوفة', '70', '64', '59.02'),
        ]))
        expect(doc.invoiceNumber).toBe('9027581732')
    })
})

describe('guessMapping / applyMapping', () => {
    const raw: RawTable = {
        headers: SUPPLIER_HEADERS,
        rows: [supplierRow('9031150064', 'صوفة/صوفة', '70.000', '64.00', '59.02')],
    }

    it('auto-detects the four target columns by header name', () => {
        expect(guessMapping(raw)).toMatchObject({ code: 8, qty: 10, price: 12, disc: 13 })
    })

    it('honours a hand-corrected mapping', () => {
        const lines = applyMapping(raw, { code: 8, qty: 10, price: 12, disc: 15 })
        expect(lines[0].disc).toBe('15')
    })
})

describe('DBF round-trip', () => {
    it('writes records that read back with the same values', () => {
        const lines = [
            { item_code: '90311-50064', qty: '70', rate: '64', disc: '59.02' },
            { item_code: '87945-33030-A0', qty: '1', rate: '273', disc: '65.41' },
        ]
        const back = parseDbf(writeDbf(lines).buffer as ArrayBuffer)
        expect(back.map((l) => l.item_code)).toEqual(['90311-50064', '87945-33030-A0'])
        expect(back.map((l) => l.qty)).toEqual(['70', '1'])
        expect(back.map((l) => l.rate)).toEqual(['64', '273'])
        expect(back.map((l) => l.disc)).toEqual(['59.02', '65.41'])
    })

    it('starts with the dBase III signature', () => {
        expect(writeDbf([{ item_code: 'A', qty: '1', rate: '1', disc: '0' }])[0]).toBe(0x03)
    })
})

describe('output writers', () => {
    const lines = [{ item_code: '90311-50064', qty: '70', rate: '64', disc: '59.02' }]

    it('writes a zip-framed xlsx', () => {
        const b = writeXlsx(lines)
        expect([b[0], b[1]]).toEqual([0x50, 0x4b]) // "PK"
    })

    it('packs multiple entries into one archive', () => {
        const zip = buildZip([
            { path: 'a.xlsx', data: writeXlsx(lines) },
            { path: 'a.dbf', data: writeDbf(lines) },
        ])
        const text = new TextDecoder('latin1').decode(zip)
        expect(text).toContain('a.xlsx')
        expect(text).toContain('a.dbf')
    })
})

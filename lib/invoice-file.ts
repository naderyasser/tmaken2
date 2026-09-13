/**
 * Client-side parsers for supplier invoice files dropped into the Material
 * Receipt dialog. Supports the client's parts-invoice exports:
 *   - .dbf  (dBase III — FITEMNO C, FQTY N, FPRICE N, FDISC N)
 *   - .xlsx (single sheet, same four columns)
 *   - .csv / .txt (comma/semicolon/tab separated)
 * No external dependencies: DBF is fixed-width binary, XLSX is unzipped with
 * the browser's DecompressionStream and parsed with DOMParser.
 */

export interface InvoiceLine {
    item_code: string
    qty: string
    rate: string
    disc: string
    /** Supplier sheets carry the part description and a per-line case number;
     *  both are optional because DBF/CSV target files don't have them. */
    part_name?: string
    case_number?: string
    /** The code exactly as the source file wrote it, kept when `item_code` is
     *  rewritten to match the Item master (raw 9031150064 → dashed 90311-50064)
     *  so printed documents can still show the supplier's own form. */
    source_code?: string
}

/** Document-level fields of a supplier parts invoice. Every one of them repeats
 *  on every data row of the source sheet, so they're read off the first line. */
export interface InvoiceDocument {
    lines: InvoiceLine[]
    date?: string
    soldToParty?: string
    shipToParty?: string
    salesOrderNumber?: string
    invoiceNumber?: string
    customerOrderNumber?: string
    vatPercent?: string
}

// ── column mapping ──────────────────────────────────────────────────────────

const CODE_HEADERS = ['fitemno', 'itemno', 'item_no', 'item', 'item_code', 'code', 'part number', 'part no', 'كود', 'كود الصنف', 'الصنف', 'رقم القطعة']
const QTY_HEADERS = ['fqty', 'qty', 'quantity', 'issued quantity', 'كمية', 'الكمية']
const PRICE_HEADERS = ['fprice', 'price', 'rate', 'unit price', 'سعر', 'السعر']
const DISC_HEADERS = ['fdisc', 'disc', 'discount', 'discount %', 'خصم', 'الخصم']
const NAME_HEADERS = ['part name', 'item name', 'item_name', 'description', 'اسم الصنف', 'البيان', 'الوصف']
const CASE_HEADERS = ['case number', 'case no', 'case_no', 'رقم الحالة']
const DOC_HEADERS: Record<keyof Omit<InvoiceDocument, 'lines'>, string[]> = {
    date: ['date', 'invoice date', 'التاريخ', 'تاريخ'],
    soldToParty: ['sold to party', 'sold to', 'المشتري'],
    shipToParty: ['ship to party', 'ship to', 'المستلم'],
    salesOrderNumber: ['sales order number', 'sales order', 'رقم أمر البيع'],
    invoiceNumber: ['invoice number', 'invoice no', 'رقم الفاتورة'],
    customerOrderNumber: ['customer order number', 'customer order', 'رقم طلب العميل'],
    vatPercent: ['vat %', 'vat', 'tax %', 'الضريبة'],
}

function headerIndex(headers: string[], candidates: string[]): number {
    const norm = headers.map((h) => h.trim().toLowerCase())
    for (const c of candidates) {
        const i = norm.indexOf(c)
        if (i !== -1) return i
    }
    return -1
}

/** Turn a header row + data rows into invoice lines. Falls back to positional
 *  columns (code, qty, price, disc) when the headers aren't recognizable. */
export function mapRowsToLines(headers: string[], rows: string[][]): InvoiceLine[] {
    let ci = headerIndex(headers, CODE_HEADERS)
    let qi = headerIndex(headers, QTY_HEADERS)
    let pi = headerIndex(headers, PRICE_HEADERS)
    let di = headerIndex(headers, DISC_HEADERS)
    // Optional extras — absent from the plain 4-column target files.
    const ni = headerIndex(headers, NAME_HEADERS)
    const ki = headerIndex(headers, CASE_HEADERS)
    let data = rows
    if (ci === -1) {
        // No recognizable header row — treat the "headers" as a data row too.
        ci = 0; qi = 1; pi = 2; di = 3
        data = [headers, ...rows]
    }
    const lines: InvoiceLine[] = []
    for (const r of data) {
        const code = (r[ci] || '').trim()
        if (!code) continue
        const num = (v: string | undefined) => {
            const n = parseFloat((v || '').replace(/,/g, ''))
            return Number.isFinite(n) ? n : 0
        }
        const qty = num(qi >= 0 ? r[qi] : undefined)
        if (qty <= 0) continue
        const rate = num(pi >= 0 ? r[pi] : undefined)
        const disc = num(di >= 0 ? r[di] : undefined)
        const partName = ni >= 0 ? (r[ni] || '').trim() : ''
        const caseNo = ki >= 0 ? (r[ki] || '').trim() : ''
        lines.push({
            item_code: code,
            qty: String(qty),
            rate: rate > 0 ? String(rate) : '',
            disc: disc > 0 ? String(disc) : '',
            ...(partName ? { part_name: partName } : {}),
            ...(caseNo ? { case_number: caseNo } : {}),
        })
    }
    return lines
}

// ── DBF ─────────────────────────────────────────────────────────────────────

export function parseDbf(buf: ArrayBuffer): InvoiceLine[] {
    const view = new DataView(buf)
    const bytes = new Uint8Array(buf)
    const numRecords = view.getUint32(4, true)
    const headerSize = view.getUint16(8, true)
    const recordSize = view.getUint16(10, true)

    // Field descriptors: 32 bytes each, from offset 32 until the 0x0D terminator.
    const fields: Array<{ name: string; length: number }> = []
    let off = 32
    while (off < headerSize - 1 && bytes[off] !== 0x0d) {
        let name = ''
        for (let i = 0; i < 11 && bytes[off + i] !== 0; i++) name += String.fromCharCode(bytes[off + i])
        fields.push({ name: name.trim(), length: bytes[off + 16] })
        off += 32
    }
    if (!fields.length) throw new Error('Not a valid DBF file')

    const headers = fields.map((f) => f.name)
    const rows: string[][] = []
    const decoder = new TextDecoder('windows-1252')
    for (let r = 0; r < numRecords; r++) {
        const start = headerSize + r * recordSize
        if (start + recordSize > bytes.length) break
        if (bytes[start] === 0x2a) continue // deleted record
        let pos = start + 1
        const row: string[] = []
        for (const f of fields) {
            row.push(decoder.decode(bytes.subarray(pos, pos + f.length)).trim())
            pos += f.length
        }
        rows.push(row)
    }
    return mapRowsToLines(headers, rows)
}

// ── XLSX (minimal: central directory + deflate-raw + DOMParser) ─────────────

async function unzipEntry(bytes: Uint8Array, wanted: string): Promise<Uint8Array | null> {
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
    // End-of-central-directory record (0x06054b50), scanned from the tail.
    let eocd = -1
    for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 22 - 65536); i--) {
        if (view.getUint32(i, true) === 0x06054b50) { eocd = i; break }
    }
    if (eocd === -1) throw new Error('Not a valid XLSX (zip) file')
    const count = view.getUint16(eocd + 10, true)
    let cd = view.getUint32(eocd + 16, true)
    for (let n = 0; n < count; n++) {
        if (view.getUint32(cd, true) !== 0x02014b50) break
        const method = view.getUint16(cd + 10, true)
        const compSize = view.getUint32(cd + 20, true)
        const nameLen = view.getUint16(cd + 28, true)
        const extraLen = view.getUint16(cd + 30, true)
        const commentLen = view.getUint16(cd + 32, true)
        const localOff = view.getUint32(cd + 42, true)
        const name = new TextDecoder().decode(bytes.subarray(cd + 46, cd + 46 + nameLen))
        cd += 46 + nameLen + extraLen + commentLen
        if (name !== wanted) continue
        // Local header: sizes may be zero there (data descriptor), so trust the
        // central directory and only read the local name/extra lengths.
        const lNameLen = view.getUint16(localOff + 26, true)
        const lExtraLen = view.getUint16(localOff + 28, true)
        const dataStart = localOff + 30 + lNameLen + lExtraLen
        const comp = bytes.subarray(dataStart, dataStart + compSize)
        if (method === 0) return comp
        const ds = new DecompressionStream('deflate-raw')
        const stream = new Blob([comp]).stream().pipeThrough(ds)
        return new Uint8Array(await new Response(stream).arrayBuffer())
    }
    return null
}

function colLetterToIndex(ref: string): number {
    let n = 0
    for (const ch of ref) {
        if (ch >= 'A' && ch <= 'Z') n = n * 26 + (ch.charCodeAt(0) - 64)
        else break
    }
    return n - 1
}

export async function parseXlsx(buf: ArrayBuffer): Promise<InvoiceLine[]> {
    const bytes = new Uint8Array(buf)
    const sheetXml = await unzipEntry(bytes, 'xl/worksheets/sheet1.xml')
    if (!sheetXml) throw new Error('sheet1.xml not found in workbook')
    const sharedXml = await unzipEntry(bytes, 'xl/sharedStrings.xml')

    const dom = new DOMParser()
    const shared: string[] = []
    if (sharedXml) {
        const sdoc = dom.parseFromString(new TextDecoder().decode(sharedXml), 'application/xml')
        sdoc.querySelectorAll('si').forEach((si) => {
            let text = ''
            si.querySelectorAll('t').forEach((t) => { text += t.textContent || '' })
            shared.push(text)
        })
    }
    const doc = dom.parseFromString(new TextDecoder().decode(sheetXml), 'application/xml')
    const rows: string[][] = []
    doc.querySelectorAll('row').forEach((rowEl) => {
        const row: string[] = []
        rowEl.querySelectorAll('c').forEach((c) => {
            const ref = c.getAttribute('r') || ''
            const t = c.getAttribute('t')
            const v = c.querySelector('v')
            let val = v?.textContent || ''
            if (t === 's' && val !== '') val = shared[parseInt(val, 10)] ?? ''
            else if (t === 'inlineStr') val = c.querySelector('is')?.textContent || ''
            const idx = ref ? colLetterToIndex(ref) : row.length
            row[idx >= 0 ? idx : row.length] = val
        })
        rows.push(Array.from(row, (x) => x ?? ''))
    })
    if (!rows.length) return []
    const [headers, ...data] = rows
    return mapRowsToLines(headers, data)
}

// ── CSV ─────────────────────────────────────────────────────────────────────

export function parseCsv(text: string): InvoiceLine[] {
    const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
    if (!lines.length) return []
    const sep = lines[0].includes('\t') ? '\t' : lines[0].includes(';') ? ';' : ','
    const rows = lines.map((l) => l.split(sep).map((c) => c.trim().replace(/^"|"$/g, '')))
    const [headers, ...data] = rows
    return mapRowsToLines(headers, data)
}

// ── entry point ─────────────────────────────────────────────────────────────

export async function parseInvoiceFile(file: File): Promise<InvoiceLine[]> {
    const raw = await parseTabularFile(file)
    return mapRowsToLines(raw.headers, raw.rows)
}

/** Read a supplier sheet as a full document: the item lines plus the
 *  document-level fields (invoice/order numbers, parties, VAT) that repeat on
 *  every row. Fields the file doesn't carry come back undefined. */
export async function parseInvoiceDocument(file: File): Promise<InvoiceDocument> {
    const raw = await parseTabularFile(file)
    const lines = mapRowsToLines(raw.headers, raw.rows)
    const doc: InvoiceDocument = { lines }
    // Read the document fields off the first row that actually has an item code,
    // so blank spacer rows above the data can't win.
    const ci = headerIndex(raw.headers, CODE_HEADERS)
    const first = ci >= 0 ? raw.rows.find((r) => (r[ci] || '').trim()) : raw.rows[0]
    if (!first) return doc
    for (const key of Object.keys(DOC_HEADERS) as Array<keyof typeof DOC_HEADERS>) {
        const i = headerIndex(raw.headers, DOC_HEADERS[key])
        const v = i >= 0 ? (first[i] || '').trim() : ''
        if (v) doc[key] = v
    }
    return doc
}

// ════════════════════════════════════════════════════════════════════════════
// Raw tabular access + target-format writers (converter feature)
// ════════════════════════════════════════════════════════════════════════════

export interface RawTable {
    headers: string[]
    rows: string[][]
}

/** Column mapping: index into headers/rows for each target field (-1 = unset). */
export interface ColumnMapping {
    code: number
    qty: number
    price: number
    disc: number
}

/** Read any supported file as a raw header row + data rows (no mapping applied). */
export async function parseTabularFile(file: File): Promise<RawTable> {
    const name = file.name.toLowerCase()
    if (name.endsWith('.dbf')) return dbfToRaw(await file.arrayBuffer())
    if (name.endsWith('.xls')) return parseXls(await file.arrayBuffer())
    if (name.endsWith('.xlsx') || name.endsWith('.xlsm')) return xlsxToRaw(await file.arrayBuffer())
    if (name.endsWith('.csv') || name.endsWith('.txt')) return csvToRaw(await file.text())
    const buf = await file.arrayBuffer()
    const b = new Uint8Array(buf)
    if (b.length > 4 && b[0] === 0x50 && b[1] === 0x4b) return xlsxToRaw(buf)
    if (b.length > 4 && b[0] === 0xd0 && b[1] === 0xcf && b[2] === 0x11 && b[3] === 0xe0) return parseXls(buf)
    try { return dbfToRaw(buf) } catch { /* fall through */ }
    return csvToRaw(new TextDecoder().decode(buf))
}

function dbfToRaw(buf: ArrayBuffer): RawTable {
    const view = new DataView(buf)
    const bytes = new Uint8Array(buf)
    const numRecords = view.getUint32(4, true)
    const headerSize = view.getUint16(8, true)
    const recordSize = view.getUint16(10, true)
    const fields: Array<{ name: string; length: number }> = []
    let off = 32
    while (off < headerSize - 1 && bytes[off] !== 0x0d) {
        let name = ''
        for (let i = 0; i < 11 && bytes[off + i] !== 0; i++) name += String.fromCharCode(bytes[off + i])
        fields.push({ name: name.trim(), length: bytes[off + 16] })
        off += 32
    }
    if (!fields.length) throw new Error('Not a valid DBF file')
    const decoder = new TextDecoder('windows-1252')
    const rows: string[][] = []
    for (let r = 0; r < numRecords; r++) {
        const start = headerSize + r * recordSize
        if (start + recordSize > bytes.length) break
        if (bytes[start] === 0x2a) continue
        let pos = start + 1
        const row: string[] = []
        for (const f of fields) {
            row.push(decoder.decode(bytes.subarray(pos, pos + f.length)).trim())
            pos += f.length
        }
        rows.push(row)
    }
    return { headers: fields.map((f) => f.name), rows }
}

async function xlsxToRaw(buf: ArrayBuffer): Promise<RawTable> {
    const bytes = new Uint8Array(buf)
    const sheetXml = await unzipEntry(bytes, 'xl/worksheets/sheet1.xml')
    if (!sheetXml) throw new Error('sheet1.xml not found in workbook')
    const sharedXml = await unzipEntry(bytes, 'xl/sharedStrings.xml')
    const dom = new DOMParser()
    const shared: string[] = []
    if (sharedXml) {
        const sdoc = dom.parseFromString(new TextDecoder().decode(sharedXml), 'application/xml')
        sdoc.querySelectorAll('si').forEach((si) => {
            let text = ''
            si.querySelectorAll('t').forEach((t) => { text += t.textContent || '' })
            shared.push(text)
        })
    }
    const doc = dom.parseFromString(new TextDecoder().decode(sheetXml), 'application/xml')
    const rows: string[][] = []
    doc.querySelectorAll('row').forEach((rowEl) => {
        const row: string[] = []
        rowEl.querySelectorAll('c').forEach((c) => {
            const ref = c.getAttribute('r') || ''
            const t = c.getAttribute('t')
            const v = c.querySelector('v')
            let val = v?.textContent || ''
            if (t === 's' && val !== '') val = shared[parseInt(val, 10)] ?? ''
            else if (t === 'inlineStr') val = c.querySelector('is')?.textContent || ''
            const idx = ref ? colLetterToIndex(ref) : row.length
            row[idx >= 0 ? idx : row.length] = val
        })
        rows.push(Array.from(row, (x) => x ?? ''))
    })
    return splitHeaderRow(rows)
}

function csvToRaw(text: string): RawTable {
    const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
    if (!lines.length) return { headers: [], rows: [] }
    const sep = lines[0].includes('\t') ? '\t' : lines[0].includes(';') ? ';' : ','
    const rows = lines.map((l) => l.split(sep).map((c) => c.trim().replace(/^"|"$/g, '')))
    return splitHeaderRow(rows)
}

const num = (v: string | undefined) => {
    const n = parseFloat((v || '').replace(/,/g, ''))
    return Number.isFinite(n) ? n : 0
}

/** Guess which source column feeds each target field: header-name match first,
 *  then content sniffing (the code column is the least-numeric one). */
export function guessMapping(t: RawTable): ColumnMapping {
    const m: ColumnMapping = {
        code: headerIndex(t.headers, CODE_HEADERS),
        qty: headerIndex(t.headers, QTY_HEADERS),
        price: headerIndex(t.headers, PRICE_HEADERS),
        disc: headerIndex(t.headers, DISC_HEADERS),
    }
    if (m.code !== -1) return m
    // Content sniffing over the first rows: pick the most textual column as the
    // code, then assign the following numeric columns positionally.
    const sample = t.rows.slice(0, 20)
    const numericRatio = t.headers.map((_, ci) => {
        const vals = sample.map((r) => (r[ci] || '').trim()).filter(Boolean)
        if (!vals.length) return 1
        return vals.filter((v) => /^-?[\d.,]+$/.test(v)).length / vals.length
    })
    let best = -1; let bestRatio = 1.01
    numericRatio.forEach((r, i) => { if (r < bestRatio) { bestRatio = r; best = i } })
    m.code = best
    const numericCols = numericRatio.map((r, i) => ({ r, i })).filter((x) => x.i !== best && x.r > 0.5).map((x) => x.i)
    m.qty = m.qty !== -1 ? m.qty : (numericCols[0] ?? -1)
    m.price = m.price !== -1 ? m.price : (numericCols[1] ?? -1)
    m.disc = m.disc !== -1 ? m.disc : (numericCols[2] ?? -1)
    return m
}

/** Apply a mapping to raw rows → clean invoice lines (blank/zero-qty rows dropped). */
export function applyMapping(t: RawTable, m: ColumnMapping): InvoiceLine[] {
    const lines: InvoiceLine[] = []
    for (const r of t.rows) {
        const code = m.code >= 0 ? (r[m.code] || '').trim() : ''
        if (!code) continue
        const qty = m.qty >= 0 ? num(r[m.qty]) : 0
        if (qty <= 0) continue
        const price = m.price >= 0 ? num(r[m.price]) : 0
        const disc = m.disc >= 0 ? num(r[m.disc]) : 0
        lines.push({ item_code: code, qty: String(qty), rate: price > 0 ? String(price) : '', disc: disc > 0 ? String(disc) : '' })
    }
    return lines
}

// ── DBF writer — byte-exact dBase III layout of the client's target sample:
//    FITEMNO C(14) · FQTY N(7,2) · FPRICE N(7,2) · FDISC N(5,2) ─────────────

function numField(v: number, width: number, dec: number): string {
    let s = v.toFixed(dec)
    if (s.length > width) s = '*'.repeat(width) // dBase overflow convention
    return s.padStart(width, ' ')
}

export function writeDbf(lines: InvoiceLine[]): Uint8Array {
    const FIELDS = [
        { name: 'FITEMNO', type: 'C', len: 14, dec: 0 },
        { name: 'FQTY', type: 'N', len: 7, dec: 2 },
        { name: 'FPRICE', type: 'N', len: 7, dec: 2 },
        { name: 'FDISC', type: 'N', len: 5, dec: 2 },
    ]
    const recordSize = 1 + FIELDS.reduce((t, f) => t + f.len, 0)
    const headerSize = 32 + FIELDS.length * 32 + 1
    const out = new Uint8Array(headerSize + lines.length * recordSize + 1)
    const view = new DataView(out.buffer)
    const now = new Date()
    out[0] = 0x03
    out[1] = now.getFullYear() - 1900
    out[2] = now.getMonth() + 1
    out[3] = now.getDate()
    view.setUint32(4, lines.length, true)
    view.setUint16(8, headerSize, true)
    view.setUint16(10, recordSize, true)
    out[29] = 0x7e // language driver id — mirrors the client's generator
    let off = 32
    let fieldOffset = 1 // past the deletion flag; legacy "data address" byte
    for (const f of FIELDS) {
        for (let i = 0; i < f.name.length; i++) out[off + i] = f.name.charCodeAt(i)
        out[off + 11] = f.type.charCodeAt(0)
        out[off + 12] = fieldOffset
        out[off + 16] = f.len
        out[off + 17] = f.dec
        fieldOffset += f.len
        off += 32
    }
    out[off] = 0x0d
    let pos = headerSize
    for (const l of lines) {
        out[pos] = 0x20 // active record
        let p = pos + 1
        const cells = [
            l.item_code.slice(0, 14).padEnd(14, ' '),
            numField(num(l.qty), 7, 2),
            numField(num(l.rate), 7, 2),
            numField(num(l.disc), 5, 2),
        ]
        for (const cell of cells) {
            for (let i = 0; i < cell.length; i++) out[p + i] = cell.charCodeAt(i) & 0xff
            p += cell.length
        }
        pos += recordSize
    }
    out[out.length - 1] = 0x1a // EOF marker
    return out
}

// ── XLSX writer — minimal zip (STORED entries, no compression needed) ───────

const CRC_TABLE = (() => {
    const t = new Uint32Array(256)
    for (let n = 0; n < 256; n++) {
        let c = n
        for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
        t[n] = c >>> 0
    }
    return t
})()

function crc32(data: Uint8Array): number {
    let c = 0xffffffff
    for (let i = 0; i < data.length; i++) c = CRC_TABLE[(c ^ data[i]) & 0xff] ^ (c >>> 8)
    return (c ^ 0xffffffff) >>> 0
}

/** Build a ZIP from {path: content} using STORED (uncompressed) entries. */
export function buildZip(entries: Array<{ path: string; data: Uint8Array }>): Uint8Array {
    const enc = new TextEncoder()
    const localParts: Uint8Array[] = []
    const centralParts: Uint8Array[] = []
    let offset = 0
    for (const e of entries) {
        const nameB = enc.encode(e.path)
        const crc = crc32(e.data)
        const local = new Uint8Array(30 + nameB.length + e.data.length)
        const lv = new DataView(local.buffer)
        lv.setUint32(0, 0x04034b50, true)
        lv.setUint16(4, 20, true)
        lv.setUint32(14, crc, true)
        lv.setUint32(18, e.data.length, true)
        lv.setUint32(22, e.data.length, true)
        lv.setUint16(26, nameB.length, true)
        local.set(nameB, 30)
        local.set(e.data, 30 + nameB.length)
        localParts.push(local)
        const cen = new Uint8Array(46 + nameB.length)
        const cv = new DataView(cen.buffer)
        cv.setUint32(0, 0x02014b50, true)
        cv.setUint16(4, 20, true)
        cv.setUint16(6, 20, true)
        cv.setUint32(16, crc, true)
        cv.setUint32(20, e.data.length, true)
        cv.setUint32(24, e.data.length, true)
        cv.setUint16(28, nameB.length, true)
        cv.setUint32(42, offset, true)
        cen.set(nameB, 46)
        centralParts.push(cen)
        offset += local.length
    }
    const cdSize = centralParts.reduce((t, p) => t + p.length, 0)
    const total = offset + cdSize + 22
    const out = new Uint8Array(total)
    let pos = 0
    for (const p of localParts) { out.set(p, pos); pos += p.length }
    const cdStart = pos
    for (const p of centralParts) { out.set(p, pos); pos += p.length }
    const ev = new DataView(out.buffer, pos)
    ev.setUint32(0, 0x06054b50, true)
    ev.setUint16(8, entries.length, true)
    ev.setUint16(10, entries.length, true)
    ev.setUint32(12, cdSize, true)
    ev.setUint32(16, cdStart, true)
    return out
}

function xmlEsc(s: string): string {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

/** Target-format workbook: one sheet, header row FITEMNO/FQTY/FPRICE/FDISC. */
export function writeXlsx(lines: InvoiceLine[]): Uint8Array {
    const enc = new TextEncoder()
    const headerRow = '<row r="1"><c r="A1" t="inlineStr"><is><t>FITEMNO</t></is></c><c r="B1" t="inlineStr"><is><t>FQTY</t></is></c><c r="C1" t="inlineStr"><is><t>FPRICE</t></is></c><c r="D1" t="inlineStr"><is><t>FDISC</t></is></c></row>'
    const dataRows = lines.map((l, i) => {
        const r = i + 2
        return `<row r="${r}"><c r="A${r}" t="inlineStr"><is><t>${xmlEsc(l.item_code)}</t></is></c>` +
            `<c r="B${r}"><v>${num(l.qty)}</v></c>` +
            `<c r="C${r}"><v>${num(l.rate)}</v></c>` +
            `<c r="D${r}"><v>${num(l.disc)}</v></c></row>`
    }).join('')
    const sheet = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${headerRow}${dataRows}</sheetData></worksheet>`
    const workbook = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Invoice" sheetId="1" r:id="rId1"/></sheets></workbook>`
    const wbRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>`
    const rootRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`
    const contentTypes = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>`
    return buildZip([
        { path: '[Content_Types].xml', data: enc.encode(contentTypes) },
        { path: '_rels/.rels', data: enc.encode(rootRels) },
        { path: 'xl/workbook.xml', data: enc.encode(workbook) },
        { path: 'xl/_rels/workbook.xml.rels', data: enc.encode(wbRels) },
        { path: 'xl/worksheets/sheet1.xml', data: enc.encode(sheet) },
    ])
}

/** Trigger a browser download for generated bytes. */
export function downloadBytes(filename: string, data: Uint8Array, mime = 'application/octet-stream'): void {
    const blob = new Blob([data as unknown as BlobPart], { type: mime })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 5000)
}

// ════════════════════════════════════════════════════════════════════════════
// Legacy .xls (BIFF8 inside an OLE2 compound file) — the supplier's export
// format. Minimal reader: enough for plain worksheets of text/number cells
// (LABELSST/SST with CONTINUE, NUMBER, RK, MULRK, LABEL).
// ════════════════════════════════════════════════════════════════════════════

function ole2Stream(bytes: Uint8Array, wanted: string[]): Uint8Array | null {
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
    if (view.getUint32(0, true) !== 0xe011cfd0) throw new Error('Not an OLE2 (.xls) file')
    const sectorSize = 1 << view.getUint16(30, true)
    const miniSize = 1 << view.getUint16(32, true)
    const numFatSectors = view.getUint32(44, true)
    const dirStart = view.getUint32(48, true)
    const miniCutoff = view.getUint32(56, true)
    const miniFatStart = view.getUint32(60, true)
    const numMiniFat = view.getUint32(64, true)
    const difatStart = view.getUint32(68, true)

    const sec = (id: number) => 512 + id * sectorSize

    // DIFAT: 109 entries in the header, then a chain of DIFAT sectors.
    const fatSectors: number[] = []
    for (let i = 0; i < 109 && fatSectors.length < numFatSectors; i++) {
        const v = view.getUint32(76 + i * 4, true)
        if (v !== 0xffffffff) fatSectors.push(v)
    }
    let difat = difatStart
    while (difat !== 0xfffffffe && difat !== 0xffffffff && fatSectors.length < numFatSectors) {
        const base = sec(difat)
        for (let i = 0; i < sectorSize / 4 - 1 && fatSectors.length < numFatSectors; i++) {
            const v = view.getUint32(base + i * 4, true)
            if (v !== 0xffffffff) fatSectors.push(v)
        }
        difat = view.getUint32(base + sectorSize - 4, true)
    }
    const fat = new Uint32Array((fatSectors.length * sectorSize) / 4)
    fatSectors.forEach((s, i) => {
        for (let j = 0; j < sectorSize / 4; j++) fat[(i * sectorSize) / 4 + j] = view.getUint32(sec(s) + j * 4, true)
    })

    const readChain = (start: number, size: number): Uint8Array => {
        const out = new Uint8Array(size)
        let s = start; let pos = 0
        while (s !== 0xfffffffe && s !== 0xffffffff && pos < size) {
            const n = Math.min(sectorSize, size - pos)
            out.set(bytes.subarray(sec(s), sec(s) + n), pos)
            pos += n
            s = fat[s]
        }
        return out
    }

    // Directory entries (128 bytes each).
    const dir = readChain(dirStart, 1 << 20) // upper bound; chain ends earlier
    interface DirEntry { name: string; start: number; size: number }
    const entries: DirEntry[] = []
    for (let off = 0; off + 128 <= dir.length; off += 128) {
        const nameLen = dir[off + 64] | (dir[off + 65] << 8)
        if (!nameLen) continue
        let name = ''
        for (let i = 0; i < nameLen - 2; i += 2) name += String.fromCharCode(dir[off + i] | (dir[off + i + 1] << 8))
        const dv = new DataView(dir.buffer, dir.byteOffset + off)
        entries.push({ name, start: dv.getUint32(116, true), size: dv.getUint32(120, true) })
    }
    const root = entries[0]
    const target = entries.find((e) => wanted.includes(e.name))
    if (!target) return null
    if (target.size >= miniCutoff) return readChain(target.start, target.size)

    // Mini-stream: the root entry's chain holds mini sectors; mini-FAT maps them.
    const miniFatBytes = readChain(miniFatStart, numMiniFat * sectorSize)
    const miniFat = new Uint32Array(miniFatBytes.buffer, miniFatBytes.byteOffset, miniFatBytes.length / 4)
    const miniStream = readChain(root.start, root.size)
    const out = new Uint8Array(target.size)
    let ms = target.start; let pos = 0
    while (ms !== 0xfffffffe && ms !== 0xffffffff && pos < target.size) {
        const n = Math.min(miniSize, target.size - pos)
        out.set(miniStream.subarray(ms * miniSize, ms * miniSize + n), pos)
        pos += n
        ms = miniFat[ms]
    }
    return out
}

/** Decode the SST (shared strings) record, following CONTINUE records. */
function biffReadSst(chunks: Uint8Array[]): string[] {
    // Concatenate logically but track chunk boundaries: a string interrupted by
    // a CONTINUE restarts with a fresh option byte.
    const strings: string[] = []
    let ci = 0
    let off = 8 // skip totals in the first chunk
    const total = new DataView(chunks[0].buffer, chunks[0].byteOffset).getUint32(4, true)

    const u8 = () => { const v = chunks[ci][off]; off += 1; return v }
    const u16 = () => { const v = chunks[ci][off] | (chunks[ci][off + 1] << 8); off += 2; return v }
    const ensure = (n: number) => { // hop to next CONTINUE chunk when exhausted
        while (off >= chunks[ci].length && ci + 1 < chunks.length) { ci++; off = 0 }
        return chunks[ci].length - off >= n
    }

    for (let s = 0; s < total; s++) {
        if (!ensure(3)) break
        const len = u16()
        let opts = u8()
        let richCount = 0; let extLen = 0
        if (opts & 0x08) { ensure(2); richCount = u16() }
        if (opts & 0x04) { ensure(4); extLen = u16() | (u16() << 16) }
        let str = ''
        let remaining = len
        while (remaining > 0) {
            if (off >= chunks[ci].length) {
                ci++; off = 0
                opts = u8() // continued strings restate the option byte
            }
            const wide = opts & 0x01
            const avail = chunks[ci].length - off
            const take = Math.min(remaining, wide ? Math.floor(avail / 2) : avail)
            if (wide) {
                for (let i = 0; i < take; i++) str += String.fromCharCode(chunks[ci][off + i * 2] | (chunks[ci][off + i * 2 + 1] << 8))
                off += take * 2
            } else {
                for (let i = 0; i < take; i++) str += String.fromCharCode(chunks[ci][off + i])
                off += take
            }
            remaining -= take
        }
        // skip rich-text runs and extended data
        let skip = richCount * 4 + extLen
        while (skip > 0) {
            if (off >= chunks[ci].length) { ci++; off = 0 }
            const take = Math.min(skip, chunks[ci].length - off)
            off += take; skip -= take
        }
        strings.push(str)
    }
    return strings
}

function rkToNumber(rk: number): number {
    const div100 = rk & 1
    const isInt = rk & 2
    let v: number
    if (isInt) {
        v = rk >> 2
    } else {
        // upper 30 bits are the high bits of an IEEE double
        const buf = new ArrayBuffer(8)
        const dv = new DataView(buf)
        dv.setUint32(4, (rk & 0xfffffffc) >>> 0, true)
        v = dv.getFloat64(0, true)
    }
    return div100 ? v / 100 : v
}

function fmtNum(v: number): string {
    return Number.isInteger(v) ? String(v) : String(Math.round(v * 1e10) / 1e10)
}

export function parseXls(buf: ArrayBuffer): RawTable {
    const bytes = new Uint8Array(buf)
    const stream = ole2Stream(bytes, ['Workbook', 'Book'])
    if (!stream) throw new Error('Workbook stream not found in .xls')
    const dv = new DataView(stream.buffer, stream.byteOffset, stream.byteLength)

    // First pass: records. Collect SST (+ its CONTINUEs) and cell records.
    let sst: string[] = []
    const cells = new Map<number, Map<number, string>>() // row → col → value
    const put = (r: number, c: number, v: string) => {
        let row = cells.get(r)
        if (!row) { row = new Map(); cells.set(r, row) }
        row.set(c, v)
    }
    let pos = 0
    let sstChunks: Uint8Array[] | null = null
    while (pos + 4 <= stream.length) {
        const id = dv.getUint16(pos, true)
        const len = dv.getUint16(pos + 2, true)
        const body = stream.subarray(pos + 4, pos + 4 + len)
        if (id === 0x00fc) { // SST
            sstChunks = [body]
        } else if (id === 0x003c && sstChunks) { // CONTINUE (only tracked right after SST)
            sstChunks.push(body)
        } else {
            if (sstChunks) { sst = biffReadSst(sstChunks); sstChunks = null }
            const bdv = new DataView(body.buffer, body.byteOffset, body.byteLength)
            switch (id) {
                case 0x00fd: { // LABELSST
                    const r = bdv.getUint16(0, true), c = bdv.getUint16(2, true)
                    put(r, c, sst[bdv.getUint32(6, true)] ?? '')
                    break
                }
                case 0x0203: { // NUMBER
                    put(bdv.getUint16(0, true), bdv.getUint16(2, true), fmtNum(bdv.getFloat64(6, true)))
                    break
                }
                case 0x027e: { // RK
                    put(bdv.getUint16(0, true), bdv.getUint16(2, true), fmtNum(rkToNumber(bdv.getUint32(6, true))))
                    break
                }
                case 0x00bd: { // MULRK
                    const r = bdv.getUint16(0, true), c0 = bdv.getUint16(2, true)
                    const n = (len - 6) / 6
                    for (let i = 0; i < n; i++) put(r, c0 + i, fmtNum(rkToNumber(bdv.getUint32(4 + i * 6 + 2, true))))
                    break
                }
                case 0x0204: { // LABEL (legacy inline string)
                    const r = bdv.getUint16(0, true), c = bdv.getUint16(2, true)
                    const slen = bdv.getUint16(6, true)
                    const opts = body[8]
                    let s2 = ''
                    if (opts & 1) { for (let i = 0; i < slen; i++) s2 += String.fromCharCode(body[9 + i * 2] | (body[10 + i * 2] << 8)) }
                    else { for (let i = 0; i < slen; i++) s2 += String.fromCharCode(body[9 + i]) }
                    put(r, c, s2)
                    break
                }
            }
        }
        pos += 4 + len
    }
    if (sstChunks) sst = biffReadSst(sstChunks)

    if (!cells.size) return { headers: [], rows: [] }
    const maxRow = Math.max(...cells.keys())
    let maxCol = 0
    cells.forEach((row) => row.forEach((_, c) => { if (c > maxCol) maxCol = c }))
    const matrix: string[][] = []
    for (let r = 0; r <= maxRow; r++) {
        const row: string[] = []
        for (let c = 0; c <= maxCol; c++) row.push(cells.get(r)?.get(c) ?? '')
        matrix.push(row)
    }
    return splitHeaderRow(matrix)
}

// ── header-row detection shared by all raw parsers ──────────────────────────

const HEADER_TOKENS = [...CODE_HEADERS, 'part number', 'part no', 'رقم القطعة', 'رقم الصنف']

/** Company exports bury the header under title rows — find the row that looks
 *  like a header (a known code-column token), else the first non-empty row. */
export function splitHeaderRow(matrix: string[][]): RawTable {
    const limit = Math.min(matrix.length, 25)
    for (let r = 0; r < limit; r++) {
        const norm = matrix[r].map((h) => (h || '').trim().toLowerCase())
        if (norm.some((h) => HEADER_TOKENS.includes(h))) {
            return { headers: matrix[r].map((h) => (h || '').trim()), rows: matrix.slice(r + 1) }
        }
    }
    const first = matrix.findIndex((row) => row.some((c) => (c || '').trim()))
    if (first === -1) return { headers: [], rows: [] }
    return { headers: matrix[first].map((h) => (h || '').trim()), rows: matrix.slice(first + 1) }
}

/** Toyota part codes arrive dash-less from the supplier (9031150064); the
 *  client's systems expect 5-5[-rest] (90311-50064, 87945-33030-A0). */
export function dashifyToyotaCode(code: string): string {
    const c = code.trim()
    if (c.includes('-') || c.length < 10 || !/^[A-Za-z0-9]+$/.test(c)) return c
    let out = c.slice(0, 5) + '-' + c.slice(5, 10)
    if (c.length > 10) out += '-' + c.slice(10)
    return out
}

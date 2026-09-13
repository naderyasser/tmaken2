import { injectLetterhead, letterheadHtml } from '@/lib/print-letterhead'
import { printableLogo, type TenantBrand } from '@/hooks/use-brand'

const brand = (over: Partial<TenantBrand> = {}): TenantBrand => ({
    appName: 'التحكم التقني',
    tagline: 'Technical Control',
    logo: '/branding/tc.png',
    primaryColor: '#111111',
    invoice: null,
    ...over,
})

describe('printableLogo', () => {
    it('accepts an operator-uploaded logo', () => {
        expect(printableLogo(brand())).toBe('/branding/tc.png')
    })
    it("refuses the platform's own default logo — never brand a client's paperwork as the vendor's", () => {
        expect(printableLogo(brand({ logo: '/logo.png' }))).toBeNull()
        expect(printableLogo(brand({ logo: '/logo.jpeg' }))).toBeNull()
    })
    it('handles no brand at all', () => {
        expect(printableLogo(null)).toBeNull()
    })
})

describe('letterheadHtml', () => {
    it('renders logo, name and tagline', () => {
        const html = letterheadHtml(brand())
        expect(html).toContain('src="/branding/tc.png"')
        expect(html).toContain('التحكم التقني')
        expect(html).toContain('Technical Control')
    })
    it('is empty for an unbranded tenant so their print output is unchanged', () => {
        expect(letterheadHtml(null)).toBe('')
        expect(letterheadHtml(brand({ appName: null, logo: '/logo.png' }))).toBe('')
    })
    it('still renders the name when the only logo is the default one', () => {
        const html = letterheadHtml(brand({ logo: '/logo.png' }))
        expect(html).not.toContain('<img')
        expect(html).toContain('التحكم التقني')
    })
    it('escapes the name — a tenant called <script> must not execute on paper', () => {
        expect(letterheadHtml(brand({ appName: '<script>x</script>' }))).not.toContain('<script>')
    })
})

describe('injectLetterhead', () => {
    const doc = '<!doctype html><html><head><title>t</title></head><body class="x"><h1>Hi</h1></body></html>'

    it('puts CSS before </head> and markup right after <body>', () => {
        const out = injectLetterhead(doc, brand())
        expect(out.indexOf('<style>')).toBeLessThan(out.indexOf('</head>'))
        expect(out).toMatch(/<body class="x"><div class="bm-letterhead">/)
        // the original content is intact and comes after the letterhead
        expect(out.indexOf('bm-letterhead')).toBeLessThan(out.indexOf('<h1>Hi</h1>'))
    })
    it('copes with a document that has no <head>', () => {
        const out = injectLetterhead('<body><p>x</p></body>', brand())
        expect(out).toMatch(/<body><style>[\s\S]*<\/style><div class="bm-letterhead">/)
    })
    it('prepends to a bare fragment with neither head nor body', () => {
        const out = injectLetterhead('<p>x</p>', brand())
        expect(out.startsWith('<style>')).toBe(true)
        expect(out.endsWith('<p>x</p>')).toBe(true)
    })
    it('returns the document untouched for an unbranded tenant', () => {
        expect(injectLetterhead(doc, null)).toBe(doc)
    })
    it('does not double-stamp a document that already carries a letterhead', () => {
        const once = injectLetterhead(doc, brand())
        expect(injectLetterhead(once, brand())).toBe(once)
        expect(once.match(/bm-letterhead/g)?.length).toBe(1 + 4) // 1 div + 4 css selectors
    })
})

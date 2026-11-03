// Arabic normalization — mirror of base_meena.real_estate.arabic.normalize_ar.
// Used to locate/highlight the matched span in search suggestions.
// Tashkeel U+0610–061A, U+064B–065F, superscript-alef U+0670, tatweel U+0640.
const DIACRITICS = /[ؐ-ًؚ-ٰٟـ]/g

export function normalizeAr(text: string, stripAl = false): string {
  if (!text) return ''
  let t = String(text)
    .replace(DIACRITICS, '')
    .replace(/[أإآ]/g, 'ا') // أ إ آ -> ا
    .replace(/ى/g, 'ي')               // ى -> ي
    .replace(/ة/g, 'ه')               // ة -> ه
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
  if (stripAl && t.startsWith('ال') && t.length > 4) t = t.slice(2)
  return t
}

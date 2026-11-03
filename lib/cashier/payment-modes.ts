/**
 * Payment-mode classification — one definition, used everywhere.
 *
 * Mode of Payment records are free text typed by whoever set the tenant up, in Arabic
 * or English ("Cash", "نقدي", "شبكة", "مدى", "صراف آلي", "Credit Card"…). Several
 * screens used to each carry their own `includes("cash")` guess, and they disagreed:
 * the payment panel only recognised card/credit/debit/visa/master/بطاق, so a tenant
 * whose card method is literally named «شبكة» or «مدى» — the normal Saudi naming, and
 * exactly what the cashier picks — was classified as neither cash nor card. It got the
 * bank icon and no card fields.
 *
 * Classification drives real behaviour (which methods route to the payment terminal,
 * which count toward drawer cash at close), so it lives here and is unit-tested.
 */

export type PaymentModeKind = "cash" | "card" | "other"

/**
 * Fold the orthographic variation Arabic payment names actually show up with, so
 * "مدى" / "مدي" and "آلي" / "الي" match the same token.
 */
function normalizeArabic(s: string): string {
  return s
    .replace(/[أإآٱ]/g, "ا") // أ إ آ ٱ → ا
    .replace(/ى/g, "ي")                     // ى → ي
    .replace(/ة/g, "ه")                     // ة → ه
    .replace(/[ً-ْـ]/g, "")            // harakat + tatweel
}

function normalize(mode: string): string {
  return normalizeArabic(String(mode ?? "").toLowerCase().trim())
}

const CASH_STEMS = ["cash", "نقد", "كاش"]

/**
 * Everything a bank card is presented to. `شبكة` (the network), `مدى` (the Saudi
 * scheme), `صراف` (ATM / "صراف آلي") and `نقاط بيع` all mean "put it on the terminal"
 * to a Saudi cashier, and must be treated as card.
 *
 * Stems match anywhere (so "بطاق" catches بطاقة/بطاقات and "credit" catches
 * "Credit Card"). Short or collision-prone tokens are matched as whole words instead:
 * a bare "pos" would otherwise fire on "Deposit", and "mada" on "Ramadan".
 */
const CARD_STEMS = [
  "card", "credit", "debit", "visa", "master", "network",
  "بطاق", "ائتمان", "شبكه", "صراف", "فيزا", "ماستر", "نقاط بيع",
]
const CARD_WORDS = ["pos", "mada", "amex", "مدي"]

const NORM_CASH_STEMS = CASH_STEMS.map(normalize)
const NORM_CARD_STEMS = CARD_STEMS.map(normalize)
const NORM_CARD_WORDS = CARD_WORDS.map(normalize)

/** Letter = something that can be part of the SAME word (Latin alnum or Arabic block). */
function isWordChar(ch: string | undefined): boolean {
  if (!ch) return false
  return /[a-z0-9\u0600-\u06FF]/.test(ch)
}

/** Whole-word containment that works for Arabic too (JS \b is ASCII-only). */
function containsWord(haystack: string, word: string): boolean {
  let from = 0
  for (;;) {
    const i = haystack.indexOf(word, from)
    if (i === -1) return false
    if (!isWordChar(haystack[i - 1]) && !isWordChar(haystack[i + word.length])) return true
    from = i + 1
  }
}

export function isCashMode(mode: string): boolean {
  const n = normalize(mode)
  return !!n && NORM_CASH_STEMS.some(t => n.indexOf(t) !== -1)
}

/**
 * Cash wins ties: a mode named "Cash on card machine" is drawer cash, and mis-routing
 * a cash sale to the terminal is worse than the reverse.
 */
export function isCardMode(mode: string): boolean {
  const n = normalize(mode)
  if (!n || isCashMode(mode)) return false
  return NORM_CARD_STEMS.some(t => n.indexOf(t) !== -1)
    || NORM_CARD_WORDS.some(w => containsWord(n, w))
}

export function paymentModeKind(mode: string): PaymentModeKind {
  if (isCashMode(mode)) return "cash"
  if (isCardMode(mode)) return "card"
  return "other"
}

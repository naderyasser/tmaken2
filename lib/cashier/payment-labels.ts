/**
 * Payment-method DISPLAY names — UI-layer localization only.
 *
 * Mode-of-Payment records keep their stored name everywhere (sales, GL, reports data);
 * this maps the common ones to a language-appropriate LABEL for the screen + printout.
 * Unknown/custom methods fall back to their stored name unchanged — no data is renamed
 * and nothing is lost.
 */

type Lang = "ar" | "en"

// canonical → { en, ar }. Keys on the left are matched against a normalized record name
// (lowercased, trimmed) in either language.
const LABELS: Record<string, { en: string; ar: string }> = {
  cash: { en: "Cash", ar: "نقدي" },
  "credit card": { en: "Credit card", ar: "بطاقة ائتمان" },
  card: { en: "Card", ar: "بطاقة" },
  "debit card": { en: "Debit card", ar: "بطاقة مدين" },
  mada: { en: "Mada", ar: "مدى" },
  "bank transfer": { en: "Bank transfer", ar: "تحويل بنكي" },
  cheque: { en: "Cheque", ar: "شيك" },
  check: { en: "Cheque", ar: "شيك" },
  "apple pay": { en: "Apple Pay", ar: "Apple Pay" },
  stc: { en: "STC Pay", ar: "STC Pay" },
  "stc pay": { en: "STC Pay", ar: "STC Pay" },
}

// Arabic record names → canonical key (so an Arabic-stored method localizes to EN too).
const AR_ALIASES: Record<string, string> = {
  "نقد": "cash",
  "نقدي": "cash",
  "بطاقة ائتمان": "credit card",
  "بطاقة": "card",
  "بطاقة مدين": "debit card",
  "مدى": "mada",
  "تحويل بنكي": "bank transfer",
  "شيك": "cheque",
}

export function paymentMethodLabel(name: string | undefined | null, lang: Lang): string {
  const raw = (name ?? "").trim()
  if (!raw) return raw
  const norm = raw.toLowerCase()
  const key = LABELS[norm] ? norm : AR_ALIASES[raw]
  const entry = key ? LABELS[key] : undefined
  return entry ? entry[lang] : raw // fall back to the stored name
}

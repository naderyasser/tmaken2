'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useI18n } from '@/lib/i18n'
import { useAuth } from '@/lib/auth-context'
import { frappeClient } from '@/lib/api-client'
import {
  realEstateApi, type AqarListing, type AqarAuditEntry, type AqarListingImage, type AqarAdvertiser,
  type AqarComment, type ListingSearchResult,
} from '@/lib/real-estate-api'
import { formatPrice, dualDate, timeAgo, formatNumber } from '@/lib/aqar-format'
import nextDynamic from 'next/dynamic'
import {
  ShieldCheck, BadgeCheck, Heart, Share2, Flag, MessageCircle, CheckCircle2,
  XCircle, ChevronLeft, ChevronRight, History, Send, UserPlus, UserCheck, Loader2,
  Star, MapPin,
} from 'lucide-react'

const ListingMap = nextDynamic(() => import('@/components/real-estate/listing-map'), { ssr: false })

const STATUS_TONES: Record<string, string> = {
  Active: 'bg-emerald-100 text-emerald-800', Draft: 'bg-gray-100 text-gray-700',
  'Pending License': 'bg-amber-100 text-amber-800', Expired: 'bg-orange-100 text-orange-800',
  Rejected: 'bg-red-100 text-red-700', Sold: 'bg-blue-100 text-blue-700',
}
const STATUS_LABEL: Record<string, string> = {
  Active: 're.statusActive', Draft: 're.statusDraft', 'Pending License': 're.statusPending',
  Expired: 're.statusExpired', Rejected: 're.statusRejected', Sold: 're.statusSold',
}
const TYPE_LABEL: Record<string, string> = { Sale: 're.typeSale', Rent: 're.typeRent', 'Daily Rent': 're.typeDailyRent' }
const REPORT_REASONS: Array<[string, string]> = [
  ['Fraud', 're.reasonFraud'], ['Wrong Info', 're.reasonWrongInfo'], ['Duplicate', 're.reasonDuplicate'],
  ['Inappropriate', 're.reasonInappropriate'], ['Already Sold or Rented', 're.reasonSold'],
  ['Spam', 're.reasonSpam'], ['Other', 're.reasonOther'],
]

export default function ListingDetailPage() {
  const { t, lang, isRTL } = useI18n()
  const { moduleAccess } = useAuth()
  const router = useRouter()
  const params = useParams()
  const id = String(params.id)
  const L = lang as 'ar' | 'en'
  const Chevron = isRTL ? ChevronRight : ChevronLeft

  const [doc, setDoc] = useState<AqarListing | null>(null)
  const [images, setImages] = useState<AqarListingImage[]>([])
  const [audit, setAudit] = useState<AqarAuditEntry[]>([])
  const [advertiser, setAdvertiser] = useState<AqarAdvertiser | null>(null)
  const [names, setNames] = useState<{ category?: string; city?: string; district?: string }>({})
  const [comments, setComments] = useState<AqarComment[]>([])
  const [similar, setSimilar] = useState<ListingSearchResult[]>([])
  const [favorited, setFavorited] = useState(false)
  const [following, setFollowing] = useState(false)
  const [newComment, setNewComment] = useState('')
  const [showReport, setShowReport] = useState(false)
  const [reportReason, setReportReason] = useState('Wrong Info')
  const [reportDetails, setReportDetails] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [promos, setPromos] = useState<any[]>([])
  const [showPromote, setShowPromote] = useState(false)

  const load = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const d = await realEstateApi.getListing(id)
      setDoc(d)
      const [imgs, log, cmts, sim, fav] = await Promise.all([
        realEstateApi.getListingImages(id).catch(() => []),
        realEstateApi.getListingAudit(id).catch(() => []),
        realEstateApi.getComments(id).catch(() => []),
        realEstateApi.getSimilarListings(id).catch(() => []),
        realEstateApi.isFavorited(id).catch(() => ({ favorited: false })),
      ])
      setImages(imgs); setAudit(log); setComments(cmts); setSimilar(sim); setFavorited(fav.favorited)
      const resolve = async (dt: string, name?: string, arF?: string, enF?: string) => {
        if (!name) return undefined
        try { const r = await frappeClient.get<any>(dt, name); const rec = r.data || {}; return L === 'ar' ? rec[arF!] : rec[enF!] }
        catch { return name }
      }
      const [category, city, district] = await Promise.all([
        resolve('Aqar Category', d.category, 'category_name_ar', 'category_name_en'),
        resolve('Aqar City', d.city, 'city_name_ar', 'city_name_en'),
        resolve('Aqar District', d.district, 'district_name_ar', 'district_name_en'),
      ])
      setNames({ category, city, district })
      if (d.advertiser) {
        const [adv, fol] = await Promise.all([
          realEstateApi.getAdvertiser(d.advertiser).catch(() => null),
          realEstateApi.isFollowing(d.advertiser).catch(() => ({ following: false })),
        ])
        setAdvertiser(adv); setFollowing(fol.following)
      }
    } catch (e: any) { setError(e?.message || t('re.error')) } finally { setLoading(false) }
  }, [id, L, t])

  useEffect(() => { load() }, [load])

  const act = async (fn: () => Promise<any>, okMsg: string) => {
    setBusy(true); setMsg(null)
    try { await fn(); setMsg(okMsg); await load() }
    catch (e: any) { setMsg(e?.message || t('re.error')) } finally { setBusy(false) }
  }
  const toggleFav = async () => { const r = await realEstateApi.toggleFavorite(id).catch(() => null); if (r) setFavorited(r.favorited) }
  const toggleFollow = async () => { if (!doc?.advertiser) return; const r = await realEstateApi.toggleFollow(doc.advertiser).catch(() => null); if (r) setFollowing(r.following) }
  const submitComment = async () => {
    if (!newComment.trim()) return
    setBusy(true)
    try { await realEstateApi.addComment(id, newComment); setNewComment(''); setComments(await realEstateApi.getComments(id)) }
    catch (e: any) { setMsg(e?.message || t('re.error')) } finally { setBusy(false) }
  }
  const submitReport = async () => {
    setBusy(true)
    try { await realEstateApi.createReport(id, reportReason, reportDetails); setShowReport(false); setReportDetails(''); setMsg(isRTL ? 'تم إرسال البلاغ' : 'Report submitted') }
    catch (e: any) { setMsg(e?.message || t('re.error')) } finally { setBusy(false) }
  }
  const share = async () => {
    const url = typeof window !== 'undefined' ? window.location.href : ''
    try { if (navigator.share) await navigator.share({ title: doc?.title, url }); else { await navigator.clipboard.writeText(url); setMsg(isRTL ? 'تم نسخ الرابط' : 'Link copied') } } catch { /* dismissed */ }
  }
  const startChat = async () => {
    try { const r = await realEstateApi.startThread(id); router.push(`/real-estate/messages?thread=${r.thread}`) }
    catch (e: any) { setMsg(e?.message || t('re.error')) }
  }
  const openPromote = async () => {
    setShowPromote(true)
    if (!promos.length) setPromos(await realEstateApi.listPromotions().catch(() => []))
  }
  const promote = async (promotion: string) => {
    setBusy(true); setMsg(null)
    try {
      const co = await realEstateApi.createCheckout(id, promotion)
      await realEstateApi.confirmPayment(co.payment) // stub gateway → immediate confirm
      setShowPromote(false); setMsg(t('re.paymentSuccess')); await load()
    } catch (e: any) { setMsg(e?.message || t('re.error')) } finally { setBusy(false) }
  }

  if (loading) return <div className="h-96 animate-pulse rounded-2xl bg-gray-100" />
  if (error || !doc) return (
    <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center text-red-700">
      {error || t('re.error')} · <button onClick={load} className="font-semibold underline">{t('re.retry')}</button>
    </div>
  )

  const chip = (label?: string, filter?: string) => label ? (
    <button onClick={() => filter && router.push(`/real-estate/listings`)} className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-800 hover:bg-emerald-100">{label}</button>
  ) : null
  const cover = images.find((i) => i.is_primary) || images[0]
  const services = (doc.property_services || []).map((s) => s.service)
  const licenseRows: Array<[string, any]> = [
    ['re.licenseNumber', doc.rega_ad_license_number], ['re.licenseExpiry', doc.rega_license_expiry ? dualDate(doc.rega_license_expiry, L) : null],
    ['re.licenseeName', doc.licensee_name], ['re.planNumber', doc.plan_number], ['re.plotNumber', doc.plot_number],
    ['re.deedNumber', doc.deed_number], ['re.propertyServices', services.length ? services.join('، ') : null],
    ['re.propertyUsages', doc.property_usages], ['re.guarantees', doc.guarantees_and_duration],
    ['re.otherObligations', doc.other_obligations], ['re.disputes', doc.disputes],
    ['re.locationPerDeed', doc.location_description_per_deed], ['re.falLicense', doc.fal_license_number],
  ]

  return (
    <div className="space-y-5">
      <button onClick={() => router.push('/real-estate/listings')} className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800">
        <Chevron className="h-4 w-4" />{t('re.listings')}
      </button>

      <div className="flex flex-wrap items-center gap-2">
        {chip(names.category, doc.category)}{chip(names.city, doc.city)}{chip(names.district, doc.district)}
        <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-700">{t(TYPE_LABEL[doc.listing_type || 'Sale'])}</span>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          <div className="overflow-hidden rounded-2xl border-2 border-gray-100 bg-white">
            {cover ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={cover.webp_thumb || cover.image} alt={doc.title} className="h-72 w-full object-cover" />
            ) : <div className="flex h-48 items-center justify-center bg-gray-50 text-gray-300">—</div>}
            <div className="p-5">
              <div className="flex items-start justify-between gap-3">
                <h1 className="text-2xl font-bold text-gray-900">{doc.title}</h1>
                <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium ${STATUS_TONES[doc.status || 'Draft']}`}>{t(STATUS_LABEL[doc.status || 'Draft'])}</span>
              </div>
              <p className="mt-2 text-2xl font-bold text-emerald-700">{formatPrice(doc.price, L, doc.listing_type)}</p>
              {doc.payment_terms && <p className="mt-1 text-sm text-gray-500">{doc.payment_terms}</p>}
              <div className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
                <Spec label={t('re.area')} value={doc.area_sqm != null ? `${formatNumber(doc.area_sqm, L)} م²` : null} />
                <Spec label={t('re.bedrooms')} value={doc.bedrooms} />
                <Spec label={t('re.bathrooms')} value={doc.bathrooms} />
                <Spec label={t('re.facade')} value={doc.facade} />
                <Spec label={t('re.streetWidth')} value={doc.street_width} />
                <Spec label={t('re.age')} value={doc.age_years} />
                <Spec label={t('re.views')} value={formatNumber(doc.views_count || 0, L)} />
              </div>
              {doc.description && <div className="mt-4 whitespace-pre-line text-sm leading-7 text-gray-700">{doc.description.replace(/<[^>]+>/g, '')}</div>}

              {/* Action bar */}
              <div className="mt-5 flex flex-wrap gap-2 border-t border-gray-100 pt-4">
                <ActionBtn icon={MessageCircle} label={t('re.message')} onClick={startChat} />
                <ActionBtn icon={Heart} label={t('re.favorite')} onClick={toggleFav} active={favorited} />
                <ActionBtn icon={Share2} label={t('re.share')} onClick={share} />
                <ActionBtn icon={Flag} label={t('re.report')} onClick={() => setShowReport((s) => !s)} />
              </div>
              {showReport && (
                <div className="mt-3 rounded-xl border border-gray-200 p-3">
                  <p className="mb-2 text-sm font-medium text-gray-600">{t('re.reportReason')}</p>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {REPORT_REASONS.map(([val, key]) => (
                      <button key={val} onClick={() => setReportReason(val)} className={`rounded-lg px-2 py-1 text-xs ${reportReason === val ? 'bg-emerald-700 text-white' : 'bg-gray-100 text-gray-600'}`}>{t(key)}</button>
                    ))}
                  </div>
                  <textarea value={reportDetails} onChange={(e) => setReportDetails(e.target.value)} className="mt-2 w-full rounded-lg border border-gray-200 p-2 text-sm" rows={2} />
                  <button onClick={submitReport} disabled={busy} className="mt-2 rounded-xl bg-red-600 px-4 py-1.5 text-sm font-semibold text-white disabled:opacity-50">{t('re.reportSubmit')}</button>
                </div>
              )}
            </div>
          </div>

          {/* معلومات العقار حسب الرخصة */}
          <section className="rounded-2xl border-2 border-emerald-100 bg-white">
            <div className="flex items-center gap-2 border-b border-emerald-100 bg-emerald-50/60 px-5 py-3">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg" style={{ backgroundImage: 'repeating-linear-gradient(135deg,#047857 0,#047857 3px,transparent 3px,transparent 6px)' }}>
                <ShieldCheck className="h-4 w-4 text-white" />
              </div>
              <h2 className="font-bold text-emerald-900">{t('re.licensedInfo')}</h2>
            </div>
            <div className="grid grid-cols-1 gap-x-6 gap-y-3 p-5 sm:grid-cols-2">
              {licenseRows.filter(([, v]) => v != null && v !== '').map(([k, v]) => (
                <div key={k} className="flex flex-col"><span className="text-xs text-gray-400">{t(k)}</span><span className="text-sm font-medium text-gray-800">{String(v)}</span></div>
              ))}
            </div>
          </section>

          {/* Location map (Leaflet) */}
          {(doc.latitude || doc.longitude) ? (
            <section className="rounded-2xl border-2 border-gray-100 bg-white p-5">
              <h2 className="mb-3 flex items-center gap-2 font-bold text-gray-900"><MapPin className="h-5 w-5 text-emerald-700" />{t('re.location')}</h2>
              <ListingMap lat={doc.latitude} lng={doc.longitude} obscured={!!doc.hide_exact_location} />
            </section>
          ) : null}

          {/* Comments (أسئلة وتعليقات) */}
          <section className="rounded-2xl border-2 border-gray-100 bg-white p-5">
            <h2 className="mb-3 flex items-center gap-2 font-bold text-gray-900"><MessageCircle className="h-5 w-5 text-emerald-700" />{t('re.comments')}</h2>
            <div className="mb-4 flex gap-2">
              <input value={newComment} onChange={(e) => setNewComment(e.target.value)} placeholder={t('re.addComment')} className="flex-1 rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-emerald-400" onKeyDown={(e) => e.key === 'Enter' && submitComment()} />
              <button onClick={submitComment} disabled={busy || !newComment.trim()} className="flex items-center gap-1 rounded-xl bg-emerald-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}{t('re.send')}
              </button>
            </div>
            {comments.length === 0 ? <p className="text-sm text-gray-400">{t('re.noComments')}</p> : (
              <ul className="space-y-3">
                {comments.map((c) => (
                  <li key={c.name} className={c.parent_comment ? 'ms-6' : ''}>
                    <div className="rounded-xl bg-gray-50 p-3">
                      <p className="text-sm text-gray-800">{c.body}</p>
                      <p className="mt-1 text-xs text-gray-400">{c.author_name} · {timeAgo(c.creation, L)}</p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Similar listings (عروض مشابهة) */}
          {similar.length > 0 && (
            <section className="rounded-2xl border-2 border-gray-100 bg-white p-5">
              <h2 className="mb-3 font-bold text-gray-900">{t('re.similarListings')}</h2>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {similar.map((s) => (
                  <button key={s.name} onClick={() => router.push(`/real-estate/listings/${s.name}`)} className="flex items-center gap-3 rounded-xl border border-gray-100 p-2 text-start hover:border-emerald-200">
                    {s.primary_image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={s.primary_image} alt="" className="h-14 w-14 rounded-lg object-cover" />
                    ) : <div className="h-14 w-14 rounded-lg bg-gray-100" />}
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-gray-800">{s.title}</p>
                      <p className="text-sm font-bold text-emerald-700">{formatPrice(s.price, L, s.listing_type)}</p>
                    </div>
                  </button>
                ))}
              </div>
            </section>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-5">
          {advertiser && (
            <div className="rounded-2xl border-2 border-gray-100 bg-white p-5">
              <p className="mb-2 text-sm font-semibold text-gray-500">{t('re.advertiserInfo')}</p>
              <p className="font-bold text-gray-900">{advertiser.advertiser_name}</p>
              {advertiser.phone && <p className="mt-1 text-sm text-gray-500" dir="ltr">{advertiser.phone}</p>}
              <div className="mt-3 flex flex-wrap gap-2">
                {advertiser.is_phone_verified ? <VBadge label={t('re.phoneVerified')} /> : null}
                {advertiser.nafath_verified ? <VBadge label={t('re.nafathVerified')} /> : null}
                {advertiser.fal_license_number ? <VBadge label={t('re.falLicense')} /> : null}
              </div>
              <button onClick={toggleFollow} className={`mt-3 flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold ${following ? 'border border-emerald-200 text-emerald-700' : 'bg-emerald-700 text-white'}`}>
                {following ? <><UserCheck className="h-4 w-4" />{t('re.following')}</> : <><UserPlus className="h-4 w-4" />{t('re.follow')}</>}
              </button>
            </div>
          )}

          {moduleAccess.realEstate && (
            <div className="rounded-2xl border-2 border-gray-100 bg-white p-5">
              {msg && <p className="mb-3 rounded-lg bg-gray-50 p-2 text-xs text-gray-700">{msg}</p>}
              <div className="space-y-2">
                {!doc.rega_verified_at && (
                  <button disabled={busy} onClick={() => act(() => realEstateApi.verifyLicense(id), t('re.verified'))} className="flex w-full items-center justify-center gap-2 rounded-xl bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700 disabled:opacity-50"><CheckCircle2 className="h-4 w-4" />{t('re.verify')}</button>
                )}
                {doc.status !== 'Active' && (
                  <button disabled={busy} onClick={() => act(() => realEstateApi.publishListing(id), t('re.statusActive'))} className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-50"><ShieldCheck className="h-4 w-4" />{t('re.publish')}</button>
                )}
                {doc.status !== 'Rejected' && (
                  <button disabled={busy} onClick={() => act(() => realEstateApi.rejectListing(id), t('re.statusRejected'))} className="flex w-full items-center justify-center gap-2 rounded-xl border border-red-200 px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50"><XCircle className="h-4 w-4" />{t('re.reject')}</button>
                )}
                {doc.status === 'Active' && (
                  <button onClick={openPromote} className="flex w-full items-center justify-center gap-2 rounded-xl bg-amber-500 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-600">
                    <Star className="h-4 w-4" />{t('re.promote')}{doc.is_featured ? ' ✓' : ''}
                  </button>
                )}
                {doc.is_featured && doc.featured_until && (
                  <p className="text-center text-xs text-amber-600">{t('re.featuredUntil')} {dualDate(doc.featured_until, L)}</p>
                )}
              </div>
              {showPromote && (
                <div className="mt-3 space-y-2 border-t border-gray-100 pt-3">
                  {promos.length === 0 ? <p className="text-xs text-gray-400">…</p> : promos.map((p) => (
                    <button key={p.name} onClick={() => promote(p.name)} disabled={busy} className="flex w-full items-center justify-between rounded-xl border border-amber-200 p-2 text-sm hover:bg-amber-50 disabled:opacity-50">
                      <span className="text-gray-700">{L === 'ar' ? (p.package_name_ar || p.package_name) : p.package_name} · {p.duration_days} {t('re.days')}</span>
                      <span className="font-bold text-amber-600">{formatPrice(p.price, L)}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="rounded-2xl border-2 border-gray-100 bg-white p-5">
            <p className="mb-3 flex items-center gap-2 text-sm font-semibold text-gray-500"><History className="h-4 w-4" />{t('re.auditTrail')}</p>
            <ol className="relative space-y-4 border-s-2 border-gray-100 ps-4">
              {audit.length === 0 && <li className="text-xs text-gray-400">—</li>}
              {audit.map((a) => (
                <li key={a.name} className="relative">
                  <span className="absolute -start-[21px] top-1 h-2.5 w-2.5 rounded-full bg-emerald-500" />
                  <p className="text-sm font-medium text-gray-800">{a.action}</p>
                  <p className="text-xs text-gray-400">{a.user} · {timeAgo(a.creation, L)}</p>
                  {a.note && <p className="text-xs text-gray-500">{a.note}</p>}
                </li>
              ))}
            </ol>
          </div>
        </div>
      </div>
    </div>
  )
}

function Spec({ label, value }: { label: string; value: any }) {
  if (value == null || value === '') return null
  return <div className="rounded-xl bg-gray-50 p-2.5"><p className="text-xs text-gray-400">{label}</p><p className="font-semibold text-gray-800">{String(value)}</p></div>
}
function VBadge({ label }: { label: string }) {
  return <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700"><BadgeCheck className="h-3.5 w-3.5" />{label}</span>
}
function ActionBtn({ icon: Icon, label, onClick, disabled, title, active }: { icon: any; label: string; onClick?: () => void; disabled?: boolean; title?: string; active?: boolean }) {
  return (
    <button onClick={onClick} disabled={disabled} title={title} className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-sm disabled:opacity-40 ${active ? 'border-red-200 bg-red-50 text-red-600' : 'border-gray-200 text-gray-700 hover:bg-gray-50'}`}>
      <Icon className={`h-4 w-4 ${active ? 'fill-red-500 text-red-500' : ''}`} />{label}
    </button>
  )
}

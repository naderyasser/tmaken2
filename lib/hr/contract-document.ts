/**
 * Employment Contract — bilingual printable DOCUMENT generator.
 *
 * WHY: HR needs a complete, professional, A4 employment-contract document (Arabic
 * primary / English secondary) generated from the contract data — not just a form.
 * It mirrors the clause structure of the Qiwa Unified Contract so the internal record
 * stays consistent with the official one.
 *
 * ⚖️ NOT LEGAL ADVICE. This is an INTERNAL record / offer document. The legally-binding
 * contract in Saudi Arabia is the authenticated Unified Contract registered & approved
 * on the Qiwa portal (MHRSD decision 72958). The disclaimer + "Arabic prevails" +
 * lawyer-review notes are rendered ON the document and must stay visible.
 *
 * HOW: builds a fully self-contained, inline-styled HTML document and prints it via a
 * hidden iframe — the exact pattern proven in lib/cashier/print.ts (nothing from the
 * app leaks in; A4 portrait enforced by @page; RTL set on the document itself).
 *
 * Money via lib/format.ts formatSAR; dates Hijri-first via dualDate. Display-only —
 * storage stays Gregorian, nothing here mutates data.
 */

import { formatSAR, dualDate } from "@/lib/format"

export interface ContractDocData {
  // — Employer (from Company) —
  companyName?: string
  companyCR?: string          // registration_details / tax_id — placeholder if empty
  companyAddress?: string
  // — Employee (from Employee) —
  employeeName?: string
  nationality?: string
  idType?: string             // "National ID" | "Iqama" | localized
  idNumber?: string
  idIssue?: string            // custom_id_issue_date (Gregorian) — shown via dualDate
  idExpiry?: string           // custom_id_expiry_date (Gregorian) — shown via dualDate
  employeeAddress?: string
  gender?: string             // drives the women's-provisions clause
  // — Type & term —
  contractType?: string       // raw: Permanent | Fixed Term | Probation | Part-time
  startDate?: string
  endDate?: string
  autoRenew?: boolean
  renewalTermMonths?: string | number
  // — Job & skill —
  designation?: string
  skillLevel?: string         // High-skilled | Skilled | Basic-labor
  // — Probation —
  probationMonths?: string | number
  // — Place, hours & days —
  workLocation?: string
  workDays?: string
  weeklyRestDay?: string      // Friday | Saturday | Sunday | Friday-Saturday
  workingHours?: string | number
  // — Wage —
  basicSalary?: number
  housing?: number
  transport?: number
  other?: number
  gosi?: number
  salaryPaymentDay?: string | number
  // — Leave & notice —
  annualLeaveDays?: string | number
  noticeDays?: string | number
  // — Optional clauses —
  confidentiality?: boolean
  nonCompete?: boolean
  nonCompeteDuration?: string | number
  nonCompeteScope?: string
  ip?: boolean
  mobility?: boolean
  remoteWork?: boolean
  training?: boolean
  trainingDetails?: string
  // — Meta —
  contractId?: string         // EMP-CONTRACT-#### (when saved)
  signedOn?: string
}

// — small helpers ----------------------------------------------------------
const PLACEHOLDER = "غير محدد"

function esc(v: unknown): string {
  const s = v === null || v === undefined ? "" : String(v)
  return s.replace(/[&<>"']/g, (c) => (
    { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string
  ))
}

/** Dynamic value or a calm placeholder (never a blank gap — D4). */
function val(v: unknown, placeholder = PLACEHOLDER): string {
  const s = v === null || v === undefined ? "" : String(v).trim()
  return s ? esc(s) : `<span class="ph">${placeholder}</span>`
}

const num = (v: unknown): number => {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

function money(v: unknown): string {
  return v === null || v === undefined || v === "" ? `<span class="ph">${PLACEHOLDER}</span>` : esc(formatSAR(num(v)))
}

function date(v: unknown): string {
  if (!v) return `<span class="ph">${PLACEHOLDER}</span>`
  const d = dualDate(v as string)
  return d ? esc(d) : `<span class="ph">${PLACEHOLDER}</span>`
}

const isFemale = (g?: string) => !!g && /female|أنثى|انثى/i.test(g)

const ID_TYPE_AR: Record<string, string> = {
  "National ID": "هوية وطنية", "Iqama": "إقامة",
}
const ID_TYPE_EN: Record<string, string> = {
  "National ID": "National ID", "Iqama": "Iqama",
}
const CONTRACT_TYPE_AR: Record<string, string> = {
  "Permanent": "غير محدد المدة", "Fixed Term": "محدد المدة",
  "Probation": "تحت التجربة", "Part-time": "دوام جزئي",
}
const CONTRACT_TYPE_EN: Record<string, string> = {
  "Permanent": "Indefinite term", "Fixed Term": "Fixed term",
  "Probation": "Probation", "Part-time": "Part-time",
}
const SKILL_AR: Record<string, string> = {
  "High-skilled": "عالي المهارة", "Skilled": "ماهر", "Basic-labor": "أساسي (عمالة)",
}
const SKILL_EN: Record<string, string> = {
  "High-skilled": "High-skilled", "Skilled": "Skilled", "Basic-labor": "Basic / Labor",
}
const REST_AR: Record<string, string> = {
  "Friday": "الجمعة", "Saturday": "السبت", "Sunday": "الأحد", "Friday-Saturday": "الجمعة والسبت",
}
const REST_EN: Record<string, string> = {
  "Friday": "Friday", "Saturday": "Saturday", "Sunday": "Sunday", "Friday-Saturday": "Friday & Saturday",
}

/** A numbered bilingual clause block (Arabic primary, English secondary). */
function clause(n: number, titleAr: string, titleEn: string, bodyAr: string, bodyEn: string): string {
  return `
    <section class="clause">
      <h3><span class="cn">${n}</span> ${titleAr} <span class="en-h">/ ${titleEn}</span></h3>
      <div class="ar">${bodyAr}</div>
      <div class="en">${bodyEn}</div>
    </section>`
}

// — optional clauses: single source of truth -------------------------------
// The ACTUAL text inserted into the generated contract for each optional clause.
// Reused by both the document (below) AND the form's clause-preview UI, so the
// preview always matches what will be printed.
export interface OptionalClauseValues {
  nonCompeteDuration?: string | number
  nonCompeteScope?: string
  trainingDetails?: string
}
export interface OptionalClauseMeta { key: string; labelAr: string; labelEn: string }

export const OPTIONAL_CLAUSES: OptionalClauseMeta[] = [
  { key: "confidentiality", labelAr: "السرية", labelEn: "Confidentiality" },
  { key: "non_compete", labelAr: "عدم المنافسة", labelEn: "Non-Compete" },
  { key: "ip", labelAr: "الملكية الفكرية", labelEn: "Intellectual Property" },
  { key: "mobility", labelAr: "التنقل والسفر", labelEn: "Mobility / Travel" },
  { key: "remote_work", labelAr: "العمل عن بُعد", labelEn: "Remote Work" },
  { key: "training", labelAr: "الالتزام بالتدريب", labelEn: "Training Commitment" },
]

/** The clause text (Arabic primary + English) that will be inserted into the contract. */
export function optionalClauseText(key: string, v: OptionalClauseValues = {}): { ar: string; en: string } {
  const dur = (v.nonCompeteDuration ?? "").toString().trim() || "—"
  const scope = (v.nonCompeteScope ?? "").toString().trim() || "—"
  const training = (v.trainingDetails ?? "").toString().trim()
  switch (key) {
    case "confidentiality":
      return {
        ar: "يلتزم الموظف بالحفاظ على سرية معلومات وأسرار صاحب العمل التجارية والمهنية أثناء سريان العقد وبعد انتهائه.",
        en: "The Employee shall keep the Employer's commercial and professional secrets confidential during and after the contract.",
      }
    case "non_compete":
      return {
        ar: `يلتزم الموظف بعدم منافسة صاحب العمل لمدة ${dur} شهراً (بحد أقصى سنتان) ضمن النطاق ونوع النشاط التالي: ${scope}، وذلك وفق المادة (83) من نظام العمل.`,
        en: `Non-Compete: for ${dur} month(s) (max 2 years), within the place and type of business: ${scope} — per Article 83.`,
      }
    case "ip":
      return {
        ar: "تؤول إلى صاحب العمل كافة الحقوق المتعلقة بالأعمال والابتكارات التي ينجزها الموظف بمناسبة عمله.",
        en: "Rights to works and inventions made in the course of employment vest in the Employer.",
      }
    case "mobility":
      return {
        ar: "يوافق الموظف على التنقل والسفر وفق متطلبات العمل، مع مراعاة المادة (58) عند تغيّر محل الإقامة.",
        en: "The Employee agrees to travel as required by work, subject to Article 58 where residence changes.",
      }
    case "remote_work":
      return {
        ar: "يجوز أداء العمل عن بُعد كلياً أو جزئياً وفق ما يتفق عليه الطرفان وسياسات صاحب العمل.",
        en: "Work may be performed remotely in whole or part as agreed and per Employer policy.",
      }
    case "training":
      return {
        ar: training || "يلتزم الموظف بحضور البرامج التدريبية التي يحددها صاحب العمل.",
        en: training || "The Employee shall attend training programs designated by the Employer.",
      }
    default:
      return { ar: "", en: "" }
  }
}

// — the document -----------------------------------------------------------
export function buildContractHtml(d: ContractDocData): string {
  const isFixed = d.contractType === "Fixed Term" || d.contractType === "Probation" || d.contractType === "Part-time"
  const ctAr = d.contractType ? (CONTRACT_TYPE_AR[d.contractType] || d.contractType) : ""
  const ctEn = d.contractType ? (CONTRACT_TYPE_EN[d.contractType] || d.contractType) : ""
  // ID type mapped to its proper label (هوية وطنية / إقامة) — not the raw stored value.
  const idTypeAr = d.idType ? (ID_TYPE_AR[d.idType] || d.idType) : ""
  const idTypeEn = d.idType ? (ID_TYPE_EN[d.idType] || d.idType) : ""
  const skillAr = d.skillLevel ? (SKILL_AR[d.skillLevel] || d.skillLevel) : ""
  const skillEn = d.skillLevel ? (SKILL_EN[d.skillLevel] || d.skillLevel) : ""
  const restAr = d.weeklyRestDay ? (REST_AR[d.weeklyRestDay] || d.weeklyRestDay) : ""
  const restEn = d.weeklyRestDay ? (REST_EN[d.weeklyRestDay] || d.weeklyRestDay) : ""

  const basic = num(d.basicSalary), hou = num(d.housing), tra = num(d.transport), oth = num(d.other)
  const gosi = num(d.gosi)
  const gross = basic + hou + tra + oth
  const net = gross - gosi

  // Optional clauses — only the enabled ones, from the single source of truth above.
  const clauseVals: OptionalClauseValues = {
    nonCompeteDuration: d.nonCompeteDuration,
    nonCompeteScope: d.nonCompeteScope,
    trainingDetails: d.trainingDetails,
  }
  const enabledClause: Record<string, boolean | undefined> = {
    confidentiality: d.confidentiality, non_compete: d.nonCompete, ip: d.ip,
    mobility: d.mobility, remote_work: d.remoteWork, training: d.training,
  }
  const optItems: string[] = OPTIONAL_CLAUSES
    .filter((c) => enabledClause[c.key])
    .map((c) => {
      const txt = optionalClauseText(c.key, clauseVals)
      return `<li><b>${esc(c.labelAr)}:</b> ${esc(txt.ar)} <span class="en-i">${esc(c.labelEn)}: ${esc(txt.en)}</span></li>`
    })

  let n = 0
  const clauses: string[] = []

  // 1 — Parties
  clauses.push(clause(++n, "أطراف العقد", "Parties",
    `أُبرم هذا العقد بين:
      <div class="party"><b>الطرف الأول (صاحب العمل):</b> ${val(d.companyName)} — السجل التجاري: ${val(d.companyCR)} — العنوان: ${val(d.companyAddress)}.</div>
      <div class="party"><b>الطرف الثاني (الموظف):</b> ${val(d.employeeName)} — الجنسية: ${val(d.nationality)} — العنوان: ${val(d.employeeAddress)}.
        <div class="idline">نوع الهوية: ${val(idTypeAr)} — رقم الهوية: ${val(d.idNumber)} — تاريخ إصدار الهوية: ${date(d.idIssue)} — تاريخ نهاية الهوية: ${date(d.idExpiry)}.</div>
      </div>`,
    `<div class="party"><b>First Party (Employer):</b> ${esc(d.companyName || "—")} — CR: ${esc(d.companyCR || "—")} — Address: ${esc(d.companyAddress || "—")}.</div>
      <div class="party"><b>Second Party (Employee):</b> ${esc(d.employeeName || "—")} — Nationality: ${esc(d.nationality || "—")} — Address: ${esc(d.employeeAddress || "—")}.
        <div class="idline">ID Type: ${esc(idTypeEn || "—")} — ID Number: ${esc(d.idNumber || "—")} — ID Issue Date: ${esc(dualDate(d.idIssue) || "—")} — ID Expiration Date: ${esc(dualDate(d.idExpiry) || "—")}.</div>
      </div>`))

  // 2 — Type & term
  clauses.push(clause(++n, "نوع العقد ومدته", "Contract Type & Term",
    `هذا العقد <b>${val(ctAr)}</b>، يبدأ من تاريخ <b>${date(d.startDate)}</b>${isFixed ? ` وينتهي في <b>${date(d.endDate)}</b>` : ""}.
      ${d.autoRenew ? `يُجدَّد العقد تلقائياً لمدة ${val(d.renewalTermMonths)} شهراً ما لم يُشعر أحد الطرفين الآخر بخلاف ذلك.` : ""}
      <div class="note-sm">العقد محدد المدة الذي يُجدَّد ثلاث مرات متتالية أو تبلغ مدته أربع سنوات — أيهما أسبق — يتحول إلى عقد غير محدد المدة (للسعوديين)؛ ويكون عقد غير السعودي محدد المدة ومرتبطاً برخصة العمل.</div>`,
    `This is ${esc(ctEn || "—")} contract, commencing <b>${esc(dualDate(d.startDate || "") || "—")}</b>${isFixed ? ` and ending <b>${esc(dualDate(d.endDate || "") || "—")}</b>` : ""}.
      ${d.autoRenew ? `Auto-renews for ${esc(String(d.renewalTermMonths ?? "—"))} month(s) unless either party notifies otherwise.` : ""}
      <div class="note-sm">A fixed-term contract renewed three consecutive times, or reaching four years (whichever first), converts to indefinite (for Saudis); a non-Saudi's contract is fixed-term and tied to the work permit.</div>`))

  // 3 — Job & skill
  clauses.push(clause(++n, "المسمى الوظيفي وتصنيف المهارة", "Job Title & Skill Level",
    `يعمل الموظف بوظيفة <b>${val(d.designation)}</b>، بتصنيف مهارة <b>${val(skillAr)}</b>. ويؤدي ما يُسند إليه من أعمال تتفق مع مؤهلاته. <div class="note-sm">يؤثر تصنيف المهارة على متطلبات قِوى والتأشيرة والسعودة.</div>`,
    `The Employee serves as <b>${esc(d.designation || "—")}</b>, skill level <b>${esc(skillEn || "—")}</b>, performing assigned duties consistent with their qualifications. <div class="note-sm">Skill level affects Qiwa / visa / Saudization requirements.</div>`))

  // 4 — Probation
  clauses.push(clause(++n, "فترة التجربة", "Probation Period",
    `يخضع الموظف لفترة تجربة مدتها <b>${val(d.probationMonths)}</b> شهراً، لا تتجاوز (180) يوماً. وأي تمديد لها يكون باتفاق كتابي مستقل. ولأي من الطرفين إنهاء العقد خلالها وفق النظام.`,
    `The Employee is under a probation period of <b>${esc(String(d.probationMonths ?? "—"))}</b> month(s), not exceeding 180 days; any extension requires a separate written agreement. Either party may terminate during probation per the Law.`))

  // 5 — Place, hours & days
  clauses.push(clause(++n, "مكان وساعات وأيام العمل", "Place, Hours & Days of Work",
    `مكان العمل: <b>${val(d.workLocation)}</b>. أيام العمل: <b>${val(d.workDays)}</b>، ويوم الراحة الأسبوعية: <b>${val(restAr)}</b>. ساعات العمل: <b>${val(d.workingHours)}</b> ساعات يومياً. <div class="note-sm">بحد أقصى (8) ساعات يومياً أو (48) أسبوعياً، وتُخفَّض إلى (6/36) في رمضان للمسلمين. ويتطلب النقل إلى مكان يغيّر محل إقامة الموظف موافقته الكتابية (المادة 58).</div>`,
    `Place: <b>${esc(d.workLocation || "—")}</b>. Days: <b>${esc(d.workDays || "—")}</b>, weekly rest: <b>${esc(restEn || "—")}</b>. Hours: <b>${esc(String(d.workingHours ?? "—"))}</b>/day. <div class="note-sm">Max 8/day or 48/week, reduced to 6/36 in Ramadan for Muslims; relocation changing the Employee's residence needs written consent (Art. 58).</div>`))

  // 6 — Wage & allowances (table)
  clauses.push(clause(++n, "الأجر والبدلات", "Wage & Allowances",
    `<table class="wage"><tbody>
        <tr><td>الراتب الأساسي (أساس اشتراك التأمينات)</td><td class="amt">${money(d.basicSalary)}</td></tr>
        <tr><td>بدل السكن</td><td class="amt">${money(d.housing)}</td></tr>
        <tr><td>بدل النقل</td><td class="amt">${money(d.transport)}</td></tr>
        <tr><td>بدلات أخرى</td><td class="amt">${money(d.other)}</td></tr>
        <tr class="sub"><td>إجمالي الحزمة الشهرية</td><td class="amt">${esc(formatSAR(gross))}</td></tr>
        <tr><td>خصم التأمينات الاجتماعية (GOSI)</td><td class="amt">− ${esc(formatSAR(gosi))}</td></tr>
        <tr class="total"><td>صافي الراتب الشهري (تقديري)</td><td class="amt">${esc(formatSAR(net))}</td></tr>
      </tbody></table>
      يُصرف الأجر بالريال السعودي في اليوم <b>${val(d.salaryPaymentDay)}</b> من كل شهر ميلادي عبر نظام حماية الأجور.`,
    `Basic salary (GOSI basis), housing, transport and other allowances totalling <b>${esc(formatSAR(gross))}</b> gross; less GOSI <b>${esc(formatSAR(gosi))}</b>; net (estimated) <b>${esc(formatSAR(net))}</b>. Paid in SAR on day <b>${esc(String(d.salaryPaymentDay ?? "—"))}</b> of each month via the Wage Protection System.`))

  // 7 — Leaves
  clauses.push(clause(++n, "الإجازات", "Leaves",
    `يستحق الموظف إجازة سنوية مدفوعة الأجر قدرها <b>${val(d.annualLeaveDays)}</b> يوماً في السنة (لا تقل عن 21 يوماً، وترتفع إلى 30 يوماً بعد خمس سنوات خدمة)، إضافةً إلى الإجازات النظامية (الأعياد، المرضية، إجازة الوضع، وغيرها) وفق نظام العمل.`,
    `Paid annual leave of <b>${esc(String(d.annualLeaveDays ?? "—"))}</b> days/year (min 21, rising to 30 after five years), plus statutory leaves (holidays, sick, maternity, etc.) per the Labor Law.`))

  // 8 — Employee obligations
  clauses.push(clause(++n, "التزامات الموظف", "Employee Obligations",
    `يلتزم الموظف بأداء العمل بنفسه وبعناية، واتباع التعليمات المشروعة ولوائح العمل، والمحافظة على أدوات وأسرار صاحب العمل، والالتزام بحسن السلوك والأخلاق وقواعد السلامة والصحة المهنية، وعدم استغلال العمل لمصلحة شخصية.`,
    `Perform the work personally and diligently; follow lawful instructions and work rules; safeguard the Employer's tools and trade secrets; observe good conduct and occupational health & safety; and not exploit the job for personal gain.`))

  // 9 — Employer obligations
  clauses.push(clause(++n, "التزامات صاحب العمل", "Employer Obligations",
    `يلتزم صاحب العمل بدفع الأجر في موعده، وتوفير بيئة عمل آمنة ومناسبة، ومعاملة الموظف باحترام، واحترام حقوقه النظامية كافة بما فيها التأمينات الاجتماعية والرعاية الصحية وفق النظام.`,
    `Pay wages on time; provide a safe and suitable work environment; treat the Employee with respect; and uphold all statutory rights including GOSI and health cover per the Law.`))

  // 10 — Notice & termination
  clauses.push(clause(++n, "الإشعار وإنهاء العقد", "Notice & Termination",
    `مدة الإشعار <b>${val(d.noticeDays)}</b> يوماً (لا تقل عن 60 يوماً للعقد غير محدد المدة ذي الأجر الشهري، و30 يوماً لغيره)، ومن يخلّ بمهلة الإشعار يلتزم بتعويض الطرف الآخر بأجر مدة الإشعار. ويجوز لصاحب العمل الفسخ دون مكافأة في حالات المادة (80) مع إثبات المخالفة وتمكين الموظف من الدفاع، كما يجوز للموظف ترك العمل دون إشعار مع احتفاظه بحقوقه في حالات المادة (81).`,
    `Notice period <b>${esc(String(d.noticeDays ?? "—"))}</b> days (min 60 for an indefinite monthly-paid contract, 30 otherwise); a party breaching notice compensates the other with the notice-period wage. The Employer may dismiss without award in the Article 80 cases (with proof and the Employee's right to respond); the Employee may leave without notice while retaining rights in the Article 81 cases.`))

  // 11 — End of service
  clauses.push(clause(++n, "مكافأة نهاية الخدمة", "End-of-Service Award",
    `يستحق الموظف مكافأة نهاية الخدمة بواقع أجر نصف شهر عن كل سنة من السنوات الخمس الأولى، وأجر شهر كامل عن كل سنة بعد ذلك، محسوبةً على أساس الأجر الأخير، وبما يشمل أجزاء السنة بالتناسب، وفق المادة (84) من نظام العمل.`,
    `Half a month's wage per year for the first five years and a full month's wage per year thereafter, on the final wage, pro-rated for partial years, per Article 84.`))

  // 12 — Optional clauses (only if any enabled)
  if (optItems.length) {
    clauses.push(clause(++n, "بنود إضافية مُتفق عليها", "Additional Agreed Clauses",
      `<ul class="opt">${optItems.join("")}</ul>`,
      `<div class="note-sm">As detailed in the Arabic list above.</div>`))
  }

  // 13 — Women's provisions (only if female)
  if (isFemale(d.gender)) {
    clauses.push(clause(++n, "أحكام خاصة بالمرأة العاملة", "Provisions for Female Employees",
      `تُطبَّق بحكم النظام كافة الأحكام الخاصة بالمرأة العاملة، ومنها إجازة الوضع وحقوق الأمومة، وحظر تشغيلها في الأعمال الخطرة أو الضارة، وتوفير بيئة عمل ملائمة وآمنة، والمساواة في الأجر عن العمل ذي القيمة المتساوية.`,
      `All statutory provisions for female employees apply by law: maternity leave and rights, prohibition of hazardous work, a suitable and safe environment, and equal pay for work of equal value.`))
  }

  // 14 — Governing law & jurisdiction
  clauses.push(clause(++n, "القانون الواجب التطبيق والاختصاص القضائي", "Governing Law & Jurisdiction",
    `يخضع هذا العقد لأحكام نظام العمل السعودي (المرسوم الملكي رقم م/51) ولوائحه التنفيذية وقرارات وزارة الموارد البشرية والتنمية الاجتماعية. وتختص المحاكم العمالية السعودية بالفصل في أي نزاع، بعد السعي للتسوية الودية أولاً.`,
    `Governed by the Saudi Labor Law (Royal Decree M/51), its regulations and MHRSD decisions. The Saudi labour courts have jurisdiction over any dispute, after first seeking amicable settlement.`))

  // 15 — General provisions
  clauses.push(clause(++n, "أحكام عامة", "General Provisions",
    `حُرِّر هذا العقد من نسختين، بيد كل طرف نسخة للعمل بموجبها. وما لم يرد به نص خاص يُرجع فيه إلى أحكام نظام العمل ولوائحه. <b>وعند الاختلاف في التفسير بين النصين العربي والإنجليزي، يُعتمد النص العربي.</b>`,
    `Executed in two counterparts, one for each party. Matters not expressly covered revert to the Labor Law and its regulations. <b>In case of discrepancy between the Arabic and English texts, the Arabic text prevails.</b>`))

  const today = dualDate(new Date().toISOString().slice(0, 10))

  return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
<meta charset="utf-8" />
<title>عقد عمل — ${esc(d.employeeName || "")}</title>
<style>
  @page { size: A4; margin: 16mm 14mm; }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; }
  body {
    font-family: "Tajawal", "Segoe UI", "Noto Sans Arabic", Arial, sans-serif;
    color: #1F2421; background: #fff; direction: rtl;
    font-size: 11.5px; line-height: 1.7;
  }
  .doc { max-width: 800px; margin: 0 auto; padding: 8px 4px 32px; }
  .header { text-align: center; border-bottom: 2px solid #0E6E62; padding-bottom: 10px; margin-bottom: 14px; }
  .header .co { font-size: 18px; font-weight: 800; color: #0E6E62; }
  .header .cr { font-size: 10.5px; color: #5b6360; margin-top: 2px; }
  .header .title { font-size: 15px; font-weight: 800; margin-top: 8px; }
  .header .title .en-h { font-weight: 600; color: #5b6360; font-size: 12px; }
  .header .cid { font-size: 10px; color: #8a918d; margin-top: 2px; }

  .disclaimer {
    background: #FAF7F2; border: 1px solid #E7E1D8; border-inline-start: 4px solid #0E6E62;
    border-radius: 8px; padding: 9px 12px; margin: 12px 0; font-size: 10.5px; color: #3a423e;
  }
  .disclaimer b { color: #0E6E62; }
  .disclaimer .en-i { display:block; color:#6b726e; font-style: italic; margin-top: 3px; font-size: 9.5px; direction: ltr; text-align: left; }

  .clause { margin: 12px 0; page-break-inside: avoid; }
  .clause h3 { font-size: 12.5px; font-weight: 800; color: #0E6E62; margin: 0 0 4px; padding-bottom: 3px; border-bottom: 1px solid #ece7df; }
  .clause h3 .cn { display:inline-block; min-width: 18px; height: 18px; line-height: 18px; text-align:center; background:#0E6E62; color:#fff; border-radius: 5px; font-size: 10px; margin-inline-end: 4px; }
  .clause h3 .en-h { font-weight: 600; color: #8a918d; font-size: 10.5px; }
  .clause .ar { }
  .clause .en { direction: ltr; text-align: left; color: #6b726e; font-size: 10px; margin-top: 5px; padding-top: 4px; border-top: 1px dashed #ece7df; }
  .clause .en b { color: #4a514d; }
  .en-i { display:block; direction: ltr; text-align: left; color:#8a918d; font-style: italic; font-size: 9.5px; margin-top: 2px; }
  .party { margin: 3px 0; }
  .idline { margin-top: 3px; padding-inline-start: 10px; color: #3a423e; font-size: 11px; border-inline-start: 2px solid #ece7df; }
  .note-sm { color: #8a7a4a; background: #fbf8ef; border-radius: 6px; padding: 4px 8px; margin-top: 5px; font-size: 9.8px; }

  ul.opt { margin: 4px 0; padding-inline-start: 18px; }
  ul.opt li { margin: 5px 0; }

  table.wage { width: 100%; border-collapse: collapse; margin: 4px 0 8px; }
  table.wage td { padding: 4px 8px; border-bottom: 1px solid #ece7df; }
  table.wage td.amt { text-align: left; direction: ltr; white-space: nowrap; font-variant-numeric: tabular-nums; width: 38%; }
  table.wage tr.sub td { font-weight: 700; background: #FAF7F2; }
  table.wage tr.total td { font-weight: 800; color: #0E6E62; border-top: 2px solid #0E6E62; border-bottom: none; font-size: 12.5px; }

  .ph { color: #b04a3a; font-style: italic; }

  .sign { margin-top: 26px; display: flex; justify-content: space-between; gap: 40px; page-break-inside: avoid; }
  .sign .box { flex: 1; text-align: center; }
  .sign .line { margin-top: 38px; border-top: 1px solid #1F2421; padding-top: 4px; font-weight: 700; }
  .sign .sub { color: #8a918d; font-size: 9.5px; }
  .footer { margin-top: 18px; padding-top: 8px; border-top: 1px solid #E7E1D8; color: #8a918d; font-size: 9px; text-align: center; }
  .footer .en-i { direction: ltr; }
  @media print { .noprint { display: none !important; } }
</style>
</head>
<body>
  <div class="doc">
    <div class="header">
      <div class="co">${val(d.companyName, "اسم الشركة")}</div>
      <div class="cr">السجل التجاري: ${val(d.companyCR)}${d.companyAddress ? " — " + esc(d.companyAddress) : ""}</div>
      <div class="title">عقد عمل <span class="en-h">/ Employment Contract</span></div>
      ${d.contractId ? `<div class="cid">${esc(d.contractId)}</div>` : ""}
    </div>

    <div class="disclaimer">
      <b>تنويه:</b> هذا سجل داخلي للعقد. العقد الرسمي المُلزم يُوثَّق ويُعتمد عبر منصة قِوى (قرار وزارة الموارد البشرية والتنمية الاجتماعية رقم 72958).
      <span class="en-i">Notice: this is an internal contract record. The official binding contract is authenticated and approved via the Qiwa platform (MHRSD decision 72958).</span>
    </div>

    ${clauses.join("\n")}

    <div class="sign">
      <div class="box">
        <div class="sub">الطرف الأول — صاحب العمل / First Party — Employer</div>
        <div class="line">التوقيع والختم / Signature & Stamp</div>
      </div>
      <div class="box">
        <div class="sub">الطرف الثاني — الموظف / Second Party — Employee</div>
        <div class="line">${val(d.employeeName, "التوقيع / Signature")}</div>
      </div>
    </div>

    <div class="footer">
      هذه الوثيقة سجل داخلي استرشادي ولا تُغني عن المراجعة القانونية المتخصصة ولا عن العقد الموثّق في منصة قِوى. تاريخ الإصدار: ${esc(today)}.
      <span class="en-i">This document is an internal, advisory record — it does not replace specialist legal review nor the contract authenticated on Qiwa.</span>
    </div>
  </div>
</body>
</html>`
}

/** Print a self-contained contract document via a hidden iframe (mirrors the proven
 *  lib/cashier/print.ts pipeline — nothing from the app can leak in or hide it). */
export function printContractHtml(html: string): Promise<boolean> {
  return new Promise((resolve) => {
    try {
      const frame = document.createElement("iframe")
      frame.setAttribute("data-contract-print", "1")
      frame.style.cssText = "position:fixed;inset-inline-end:0;bottom:0;width:1px;height:1px;opacity:0.01;border:0;pointer-events:none;"
      document.body.appendChild(frame)
      const doc = frame.contentDocument
      if (!doc) { frame.remove(); resolve(false); return }
      doc.open(); doc.write(html); doc.close()
      const fire = () => {
        try {
          frame.contentWindow?.focus()
          frame.contentWindow?.print()
          resolve(true)
        } catch { resolve(false) }
        setTimeout(() => frame.remove(), 4000)
      }
      if (doc.readyState === "complete") setTimeout(fire, 150)
      else frame.onload = () => setTimeout(fire, 150)
    } catch {
      resolve(false)
    }
  })
}

/** Convenience: build + print in one call. */
export function printContract(d: ContractDocData): Promise<boolean> {
  return printContractHtml(buildContractHtml(d))
}

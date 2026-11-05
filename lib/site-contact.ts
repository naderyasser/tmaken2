/** Masar Time sales/support contacts shown on the public pages. Two companies
 *  run customer service (owner, 2026-10-20); Meena's line is the primary one,
 *  used wherever a single WhatsApp/phone link fits. */
export interface SupportContact {
  company: string
  phoneDisplay: string
  phoneHref: string
  whatsappHref: string
}

export const CONTACTS: SupportContact[] = [
  {
    company: 'مؤسسة مينا لتقنية المعلومات',
    phoneDisplay: '+966 53 532 2228',
    phoneHref: 'tel:+966535322228',
    whatsappHref: 'https://wa.me/966535322228',
  },
  {
    company: 'مؤسسة التحكم التقني لتقنية المعلومات',
    phoneDisplay: '+966 54 395 6061',
    phoneHref: 'tel:+966543956061',
    whatsappHref: 'https://wa.me/966543956061',
  },
]

export const CONTACT = {
  ...CONTACTS[0],
  email: 'mhmd5100@gmail.com',
}

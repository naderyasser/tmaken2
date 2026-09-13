'use client'

/**
 * EmployeeAvatar — one place that decides how an employee's picture renders.
 *
 *  - real photo present  → show it (resolved via frappeImageUrl)
 *  - no photo            → a gender-based silhouette placeholder (male / female /
 *                          neutral when gender is unknown), NOT initials, so an
 *                          employee without a photo still reads as a person.
 *
 * The photo is always attempted first; Radix's <AvatarImage> only reveals the
 * fallback if the image is missing or fails to load, so a broken/permission-denied
 * file also lands on the silhouette instead of a blank circle.
 */

import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar'
import { frappeImageUrl } from '@/lib/utils'
import { cn } from '@/lib/utils'

type Gender = string | null | undefined

function normGender(g: Gender): 'male' | 'female' | 'unknown' {
    const v = (g || '').trim().toLowerCase()
    if (v === 'male' || v === 'm' || v === 'ذكر') return 'male'
    if (v === 'female' || v === 'f' || v === 'أنثى' || v === 'انثى') return 'female'
    return 'unknown'
}

const TINT: Record<'male' | 'female' | 'unknown', string> = {
    male: 'bg-sky-50 text-sky-500',
    female: 'bg-rose-50 text-rose-400',
    unknown: 'bg-muted text-muted-foreground',
}

/** Gender silhouette. Female variant adds shoulder-length hair; male is short. */
function Silhouette({ gender, className }: { gender: 'male' | 'female' | 'unknown'; className?: string }) {
    return (
        <svg viewBox="0 0 40 40" className={className} fill="currentColor" aria-hidden="true">
            {gender === 'female' && (
                // hair framing the face + falling to the shoulders
                <path
                    opacity="0.85"
                    d="M20 6c-6 0-9.5 4.2-9.5 9.8 0 3 .8 5.2 1.6 7.2l1.9-1.1c-.5-1.6-1-3.4-1-5.4 0-1.6.4-2.7.9-3.4 1.3 1.7 4.6 3.4 9.6 3.4 1.4 0 2.6-.1 3.7-.3.2.7.3 1.4.3 2.3 0 2-.5 3.8-1 5.4l1.9 1.1c.8-2 1.6-4.2 1.6-7.2C29.5 10.2 26 6 20 6z"
                />
            )}
            {/* head */}
            <circle cx="20" cy="15.5" r="6.2" />
            {/* shoulders / torso */}
            <path d="M20 23.5c-6.4 0-11.5 4.2-11.5 9.4 0 .9.6 1.6 1.5 1.6h20c.9 0 1.5-.7 1.5-1.6 0-5.2-5.1-9.4-11.5-9.4z" />
        </svg>
    )
}

export function EmployeeAvatar({
    image,
    gender,
    name,
    className,
    imgClassName,
}: {
    image?: string | null
    gender?: Gender
    name?: string | null
    className?: string
    imgClassName?: string
}) {
    const g = normGender(gender)
    const src = frappeImageUrl(image)

    return (
        <Avatar className={className}>
            {src ? <AvatarImage src={src} alt={name || ''} className={imgClassName} /> : null}
            <AvatarFallback className={cn('rounded-full', TINT[g])}>
                <Silhouette gender={g} className="h-[70%] w-[70%]" />
            </AvatarFallback>
        </Avatar>
    )
}

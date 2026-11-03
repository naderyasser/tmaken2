// Native rentals vertical — faithful egarsys UI port (app shell + dashboard).
// The design system is scoped by the sibling layout.tsx (.egarsys-scope); the
// shell + section rendering is a 1:1 port of egarsys's src/app/page.tsx.
//
// <Suspense> wraps the shell because it reads the URL (useSearchParams) to open
// deep links straight to a module/record — `/rentals-native?section=…&type=…&key=…`.
import { Suspense } from 'react'
import RentalsAppShell from '@/components/rentals/egarsys/app-shell'

export default function RentalsNativePage() {
  return (
    <Suspense fallback={null}>
      <RentalsAppShell />
    </Suspense>
  )
}

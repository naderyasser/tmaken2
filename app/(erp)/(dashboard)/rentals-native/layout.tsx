// Nested layout for the native rentals vertical. Carries egarsys's design
// system, SCOPED to `.egarsys-scope` (see egarsys-theme.css) so the ported
// screens render 1:1 without leaking tokens onto the rest of the platform.
import './egarsys-theme.css'

export default function RentalsNativeLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="egarsys-scope" dir="rtl">
      {children}
    </div>
  )
}

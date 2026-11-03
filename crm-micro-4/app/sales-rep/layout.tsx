import type { ReactNode } from "react"

export default function SalesRepLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-100 via-slate-50 to-blue-50 flex items-start justify-center py-0 lg:py-8">
      {/* Mobile Container Wrapper */}
      <div className="mx-auto w-full max-w-[430px] min-h-screen lg:min-h-[calc(100vh-4rem)] bg-slate-50 shadow-2xl relative rounded-none lg:rounded-[2.5rem] overflow-hidden border-0 lg:border lg:border-slate-200">
        {/* Phone Frame Effect for Desktop */}
        <div className="hidden lg:block absolute -inset-3 bg-slate-800 rounded-[3rem] -z-10" />
        <div className="hidden lg:block absolute -inset-1 bg-slate-700 rounded-[2.75rem] -z-10" />
        {/* Notch */}
        <div className="hidden lg:block absolute top-2 left-1/2 -translate-x-1/2 w-28 h-7 bg-slate-900 rounded-full z-50" />
        
        {/* Content */}
        <div className="relative min-h-full">
          {children}
        </div>
      </div>
    </div>
  )
}

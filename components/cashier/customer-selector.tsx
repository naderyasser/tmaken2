"use client"

import { useState, useEffect, useRef } from "react"
import { Search, User } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { cashierApi } from "@/lib/cashier-api"
import { cacheCustomers, searchCustomersCache } from "@/lib/cashier/offline-catalog"

interface CustomerOption {
  name: string
  customer_name: string
}

interface CustomerSelectorProps {
  value: string
  displayName: string
  onChange: (customer: string, customerName: string) => void
}

const WALK_IN = { name: "Walk-In Customer", customer_name: "Walk-In Customer" }

export function CustomerSelector({ value, displayName, onChange }: CustomerSelectorProps) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState("")
  const [results, setResults] = useState<CustomerOption[]>([])
  const [loading, setLoading] = useState(false)
  const timer = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    if (!open) return
    searchCustomers("")
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const searchCustomers = async (term: string) => {
    setLoading(true)
    try {
      const rows = await cashierApi.searchCustomers(term)
      setResults(rows)
      void cacheCustomers(rows) // write-through for offline pick
    } catch {
      // network down → recently-seen customers from the local cache (Walk-In always works)
      const cached = await searchCustomersCache(term).catch(() => [])
      setResults(cached as CustomerOption[])
    } finally {
      setLoading(false)
    }
  }

  const handleSearch = (v: string) => {
    setSearch(v)
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => searchCustomers(v), 300)
  }

  const select = (c: CustomerOption) => {
    onChange(c.name, c.customer_name)
    setOpen(false)
    setSearch("")
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" className="flex items-center gap-2 min-w-[180px] justify-start">
          <User className="h-4 w-4 text-gray-400 shrink-0" />
          <span className="truncate text-sm">{displayName || "Select Customer"}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-2" align="start">
        <div className="relative mb-2">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            className="pl-8 h-8 text-sm"
            placeholder="Search customers..."
            value={search}
            onChange={e => handleSearch(e.target.value)}
            autoFocus
          />
        </div>
        <div className="max-h-52 overflow-y-auto divide-y">
          {/* Walk-in option always first */}
          <button
            className={`w-full text-left px-2 py-2 text-sm hover:bg-blue-50 rounded ${
              value === WALK_IN.name ? "bg-blue-50 font-semibold text-blue-700" : ""
            }`}
            onClick={() => select(WALK_IN)}
          >
            <span>Walk-In Customer</span>
          </button>
          {loading ? (
            <p className="text-xs text-gray-400 py-3 text-center">Searching...</p>
          ) : results.length === 0 ? (
            <p className="text-xs text-gray-400 py-3 text-center">No customers found</p>
          ) : (
            results.map(c => (
              <button
                key={c.name}
                className={`w-full text-left px-2 py-2 text-sm hover:bg-blue-50 rounded ${
                  value === c.name ? "bg-blue-50 font-semibold text-blue-700" : ""
                }`}
                onClick={() => select(c)}
              >
                <p className="font-medium">{c.customer_name}</p>
              </button>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}

"use client"

import { useState } from "react"
import { Delete } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { fmtCurrency } from "@/lib/cashier-utils"

interface NumpadProps {
  value: string
  onChange: (value: string) => void
  allowDecimal?: boolean
  className?: string
}

const KEYS = ["7", "8", "9", "4", "5", "6", "1", "2", "3", ".", "0", "⌫"] as const

export function Numpad({ value, onChange, allowDecimal = true, className }: NumpadProps) {
  const handleKey = (key: string) => {
    if (key === "⌫") {
      onChange(value.slice(0, -1) || "0")
      return
    }
    if (key === "." && !allowDecimal) return
    if (key === "." && value.includes(".")) return
    if (value === "0" && key !== ".") {
      onChange(key)
      return
    }
    // Limit to 10 chars
    if (value.length >= 10) return
    onChange(value + key)
  }

  return (
    <div className={cn("grid grid-cols-3 gap-2", className)}>
      {KEYS.map(key => (
        <Button
          key={key}
          variant={key === "⌫" ? "destructive" : "outline"}
          className="h-14 text-xl font-semibold rounded-xl active:scale-95 transition-transform"
          onClick={() => handleKey(key)}
        >
          {key === "⌫" ? <Delete className="h-5 w-5" /> : key}
        </Button>
      ))}
    </div>
  )
}

/** Controlled numpad with a display header */
export function NumpadInput({
  label,
  value,
  onChange,
}: {
  label: string
  value: string
  onChange: (v: string) => void
}) {
  return (
    <div className="flex flex-col gap-3">
      <div className="text-center">
        <p className="text-xs text-gray-500 uppercase tracking-wide">{label}</p>
        <p className="text-3xl font-bold text-gray-900 mt-1">
          {fmtCurrency(parseFloat(value) || 0)}
        </p>
      </div>
      <Numpad value={value} onChange={onChange} />
    </div>
  )
}

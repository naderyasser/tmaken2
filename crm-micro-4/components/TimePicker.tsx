"use client"

import type React from "react"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

interface TimePickerProps {
  onChange: (hours: number, minutes: number) => void
  hours: number
  minutes: number
  className?: string
}

export function TimePickerDemo({ onChange, hours, minutes, className }: TimePickerProps) {
  const handleHoursChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = Number.parseInt(e.target.value)
    if (!isNaN(value) && value >= 0 && value <= 23) {
      onChange(value, minutes)
    }
  }

  const handleMinutesChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = Number.parseInt(e.target.value)
    if (!isNaN(value) && value >= 0 && value <= 59) {
      onChange(hours, value)
    }
  }

  return (
    <div className={cn("flex items-center space-x-2", className)}>
      <Input type="number" min={0} max={23} value={hours} onChange={handleHoursChange} className="w-16 text-center" />
      <span className="text-lg font-medium">:</span>
      <Input
        type="number"
        min={0}
        max={59}
        value={minutes}
        onChange={handleMinutesChange}
        className="w-16 text-center"
      />
    </div>
  )
}

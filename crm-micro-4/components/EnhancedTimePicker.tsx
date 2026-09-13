"use client"

import type React from "react"
import { useState, useRef, useEffect } from "react"
import { ChevronUp, ChevronDown } from "lucide-react"
import { cn } from "@/lib/utils"

interface EnhancedTimePickerProps {
  hours: number
  minutes: number
  onChange: (hours: number, minutes: number) => void
  className?: string
}

export function EnhancedTimePicker({ hours, minutes, onChange, className }: EnhancedTimePickerProps) {
  const [localHours, setLocalHours] = useState(hours)
  const [localMinutes, setLocalMinutes] = useState(minutes)
  const hoursRef = useRef<HTMLDivElement>(null)
  const minutesRef = useRef<HTMLDivElement>(null)

  // Update local state when props change
  useEffect(() => {
    setLocalHours(hours)
    setLocalMinutes(minutes)
  }, [hours, minutes])

  // Handle hours change
  const handleHoursChange = (newHours: number) => {
    // Ensure hours are between 0-23
    newHours = Math.max(0, Math.min(23, newHours))
    setLocalHours(newHours)
    onChange(newHours, localMinutes)
  }

  // Handle minutes change
  const handleMinutesChange = (newMinutes: number) => {
    // Ensure minutes are between 0-59
    newMinutes = Math.max(0, Math.min(59, newMinutes))
    setLocalMinutes(newMinutes)
    onChange(localHours, newMinutes)
  }

  // Handle wheel events for scrolling
  const handleWheel = (
    e: React.WheelEvent<HTMLDivElement>,
    value: number,
    setValue: (value: number) => void,
    max: number,
  ) => {
    e.preventDefault()
    const delta = e.deltaY > 0 ? -1 : 1
    let newValue = value + delta

    // Wrap around
    if (newValue < 0) newValue = max
    if (newValue > max) newValue = 0

    setValue(newValue)
  }

  // Handle touch events for mobile scrolling
  const setupTouchEvents = (
    ref: React.RefObject<HTMLDivElement>,
    value: number,
    setValue: (value: number) => void,
    max: number,
  ) => {
    if (!ref.current) return

    let startY = 0
    let currentValue = value

    const handleTouchStart = (e: TouchEvent) => {
      startY = e.touches[0].clientY
      currentValue = value
    }

    const handleTouchMove = (e: TouchEvent) => {
      e.preventDefault()
      const deltaY = startY - e.touches[0].clientY
      const sensitivity = 10 // pixels per increment
      const change = Math.floor(deltaY / sensitivity)

      if (change !== 0) {
        let newValue = currentValue + change

        // Wrap around
        while (newValue < 0) newValue += max + 1
        newValue = newValue % (max + 1)

        setValue(newValue)
        startY = e.touches[0].clientY
        currentValue = newValue
      }
    }

    ref.current.addEventListener("touchstart", handleTouchStart)
    ref.current.addEventListener("touchmove", handleTouchMove)

    return () => {
      ref.current?.removeEventListener("touchstart", handleTouchStart)
      ref.current?.removeEventListener("touchmove", handleTouchMove)
    }
  }

  // Set up touch events
  useEffect(() => {
    const cleanupHours = setupTouchEvents(hoursRef, localHours, handleHoursChange, 23)
    const cleanupMinutes = setupTouchEvents(minutesRef, localMinutes, handleMinutesChange, 59)

    return () => {
      cleanupHours?.()
      cleanupMinutes?.()
    }
  }, [localHours, localMinutes])

  return (
    <div className={cn("flex items-center space-x-2 select-none", className)}>
      {/* Hours */}
      <div className="flex flex-col items-center">
        <button
          type="button"
          className="p-1 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
          onClick={() => handleHoursChange((localHours + 1) % 24)}
          aria-label="زيادة الساعات"
        >
          <ChevronUp className="h-4 w-4" />
        </button>

        <div
          ref={hoursRef}
          className="w-12 h-10 flex items-center justify-center text-xl font-bold bg-gray-100 dark:bg-gray-800 rounded-md cursor-pointer"
          onWheel={(e) => handleWheel(e, localHours, handleHoursChange, 23)}
          tabIndex={0}
        >
          {localHours.toString().padStart(2, "0")}
        </div>

        <button
          type="button"
          className="p-1 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
          onClick={() => handleHoursChange((localHours - 1 + 24) % 24)}
          aria-label="إنقاص الساعات"
        >
          <ChevronDown className="h-4 w-4" />
        </button>
      </div>

      <span className="text-xl font-bold">:</span>

      {/* Minutes */}
      <div className="flex flex-col items-center">
        <button
          type="button"
          className="p-1 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
          onClick={() => handleMinutesChange((localMinutes + 1) % 60)}
          aria-label="زيادة الدقائق"
        >
          <ChevronUp className="h-4 w-4" />
        </button>

        <div
          ref={minutesRef}
          className="w-12 h-10 flex items-center justify-center text-xl font-bold bg-gray-100 dark:bg-gray-800 rounded-md cursor-pointer"
          onWheel={(e) => handleWheel(e, localMinutes, handleMinutesChange, 59)}
          tabIndex={0}
        >
          {localMinutes.toString().padStart(2, "0")}
        </div>

        <button
          type="button"
          className="p-1 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
          onClick={() => handleMinutesChange((localMinutes - 1 + 60) % 60)}
          aria-label="إنقاص الدقائق"
        >
          <ChevronDown className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}

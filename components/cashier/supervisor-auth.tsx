"use client"

/**
 * G3 — Supervisor Authorization Dialog
 * Requires supervisor credentials before allowing sensitive operations
 * (returns, discounts above threshold, voids, etc.)
 */

import { useState, useCallback } from "react"
import { ShieldCheck, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { cashierApi } from "@/lib/cashier-api"
import {} from "@/lib/cashier-utils"

interface SupervisorAuthProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title?: string
  description?: string
  onAuthorized: () => void
}

export function SupervisorAuth({
  open,
  onOpenChange,
  title = "Supervisor Authorization Required",
  description = "This action requires supervisor approval. Please enter supervisor credentials.",
  onAuthorized,
}: SupervisorAuthProps) {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  const handleSubmit = useCallback(async () => {
    if (!email.trim() || !password) {
      setError("Please enter both email and password.")
      return
    }
    setLoading(true)
    setError("")
    try {
      const result = await cashierApi.validateSupervisor(email.trim(), password)
      if (result.valid) {
        setEmail("")
        setPassword("")
        onOpenChange(false)
        onAuthorized()
      } else {
        setError("Invalid credentials or insufficient permissions.")
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Authorization failed.")
    } finally {
      setLoading(false)
    }
  }, [email, password, onOpenChange, onAuthorized])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-amber-600" />
            {title}
          </DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3 pt-1">
          <div className="space-y-1">
            <Label htmlFor="sv-email">Supervisor Email</Label>
            <Input
              id="sv-email"
              type="email"
              placeholder="supervisor@company.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              autoFocus
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="sv-password">Password</Label>
            <Input
              id="sv-password"
              type="password"
              placeholder="Enter password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleSubmit()}
            />
          </div>
          {error && (
            <p className="text-sm text-red-600 bg-red-50 rounded px-2 py-1.5">{error}</p>
          )}
          <Button className="w-full" onClick={handleSubmit} disabled={loading}>
            {loading ? (
              <span className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" /> Verifying...
              </span>
            ) : (
              "Authorize"
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

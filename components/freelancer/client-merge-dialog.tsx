'use client'

/**
 * ClientMergeDialog — guided, group-by-group merge of duplicate clients.
 * Uses Frappe's native merge (`frappe.client.rename_doc` with merge=true), which
 * repoints all links from the duplicates onto the chosen survivor and deletes the
 * duplicates. IRREVERSIBLE — gated behind an explicit destructive confirm.
 */

import { useEffect, useState } from 'react'
import { Loader2, GitMerge, AlertTriangle } from 'lucide-react'
import { frappeClient } from '@/lib/api-client'
import { useI18n } from '@/lib/i18n'
import { useToast } from '@/hooks/use-toast'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import type { ClientRow } from '@/components/freelancer/client-detail-sheet'

interface ClientMergeDialogProps {
  /** Each group is 2+ likely-duplicate rows of the SAME kind. */
  groups: ClientRow[][]
  open: boolean
  onOpenChange: (open: boolean) => void
  onMerged: () => void
}

export function ClientMergeDialog({ groups, open, onOpenChange, onMerged }: ClientMergeDialogProps) {
  const { isRTL } = useI18n()
  const { toast } = useToast()
  const msg = (en: string, ar: string) => (isRTL ? ar : en)

  const [index, setIndex] = useState(0)
  const [survivor, setSurvivor] = useState('')
  const [merging, setMerging] = useState(false)

  useEffect(() => { if (open) setIndex(0) }, [open])

  const group = groups[index]
  useEffect(() => {
    if (group && group.length) setSurvivor(group[0].docname)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, open, groups.length])

  if (!open || !group) return null

  const doctype = group[0].kind === 'customer' ? 'Customer' : 'Lead'
  const losers = group.filter((r) => r.docname !== survivor)

  const handleMerge = async () => {
    setMerging(true)
    let ok = 0
    let fail = 0
    for (const loser of losers) {
      try {
        await frappeClient.call('frappe.client.rename_doc', {
          doctype, old_name: loser.docname, new_name: survivor, merge: true,
        })
        ok++
      } catch {
        fail++
      }
    }
    setMerging(false)
    toast({
      title: fail ? msg('Merged with errors', 'دُمج مع أخطاء') : msg('Merged', 'تم الدمج'),
      description: msg(`${ok} merged${fail ? `, ${fail} failed` : ''}.`, `${ok} مدمج${fail ? `، ${fail} فشل` : ''}.`),
      variant: fail ? 'destructive' : undefined,
    })
    onMerged()
    if (index + 1 < groups.length) setIndex(index + 1)
    else onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !merging && onOpenChange(o)}>
      <DialogContent className="max-w-lg" dir={isRTL ? 'rtl' : 'ltr'}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <GitMerge className="h-5 w-5 text-primary" />
            {msg('Merge duplicates', 'دمج المكرر')}
          </DialogTitle>
          <DialogDescription>
            {msg(
              `Group ${index + 1} of ${groups.length}. Choose the record to keep — the others merge into it.`,
              `المجموعة ${index + 1} من ${groups.length}. اختر السجل الذي تريد الاحتفاظ به — تُدمج البقية فيه.`,
            )}
          </DialogDescription>
        </DialogHeader>

        <Alert variant="destructive" className="border-amber-300 bg-amber-50 text-amber-800">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            {msg(
              'Merging is permanent and cannot be undone. All links repoint to the kept record.',
              'الدمج نهائي ولا يمكن التراجع عنه. تُعاد جميع الروابط إلى السجل المحتفظ به.',
            )}
          </AlertDescription>
        </Alert>

        <RadioGroup value={survivor} onValueChange={setSurvivor} className="space-y-2">
          {group.map((r) => (
            <label
              key={r.docname}
              className="flex cursor-pointer items-center gap-3 rounded-lg border p-3 hover:bg-muted/40"
            >
              <RadioGroupItem value={r.docname} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{r.name}</p>
                <p className="truncate text-xs text-muted-foreground" dir="ltr">
                  {(r.phone || '—') + ' · ' + r.docname}
                </p>
              </div>
              {r.docname === survivor && <Badge className="bg-primary/10 text-primary">{msg('Keep', 'احتفاظ')}</Badge>}
            </label>
          ))}
        </RadioGroup>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={merging}>
            {msg('Cancel', 'إلغاء')}
          </Button>
          <Button variant="destructive" onClick={handleMerge} disabled={merging || losers.length === 0}>
            {merging && <Loader2 className={isRTL ? 'ml-2 h-4 w-4 animate-spin' : 'mr-2 h-4 w-4 animate-spin'} />}
            {msg(`Merge ${losers.length} → 1`, `دمج ${losers.length} ← 1`)}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

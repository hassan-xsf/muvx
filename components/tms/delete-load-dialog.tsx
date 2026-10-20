"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { Trash2, AlertTriangle, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"

interface DeleteLoadDialogProps {
  loadId: string
  loadNumber: string
  redirectOnDelete?: boolean
  trigger?: React.ReactNode
  open?: boolean
  onOpenChange?: (open: boolean) => void
  onDeleted?: () => void
}

export function DeleteLoadDialog({
  loadId,
  loadNumber,
  redirectOnDelete = false,
  trigger,
  open: controlledOpen,
  onOpenChange: setControlledOpen,
  onDeleted,
}: DeleteLoadDialogProps) {
  const router = useRouter()
  const [internalOpen, setInternalOpen] = React.useState(false)
  const [isDeleting, setIsDeleting] = React.useState(false)

  const isControlled = controlledOpen !== undefined
  const open = isControlled ? controlledOpen : internalOpen
  const setOpen = isControlled ? setControlledOpen! : setInternalOpen

  const handleDelete = async () => {
    setIsDeleting(true)
    try {
      const res = await fetch(`/api/loads/${loadId}`, {
        method: "DELETE",
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || "Failed to delete load")
      }

      toast.success(`Load #${loadNumber} deleted successfully`)
      setOpen(false)

      if (onDeleted) {
        onDeleted()
      }

      if (redirectOnDelete) {
        router.push("/loads")
      } else {
        router.refresh()
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to delete load")
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {trigger ? (
        <DialogTrigger render={trigger as any} />
      ) : (
        <DialogTrigger
          render={
            <Button
              variant="outline"
              size="sm"
              className="h-9 gap-1.5 rounded-full border-red-200 text-xs font-medium text-red-600 hover:bg-red-50 hover:text-red-700 dark:border-red-900/40 dark:text-red-400 dark:hover:bg-red-950/30"
            >
              <Trash2 className="size-3.5" />
              Delete
            </Button>
          }
        />
      )}

      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2.5 text-red-600 mb-1">
            <div className="flex size-8 items-center justify-center rounded-full bg-red-100 dark:bg-red-950/60">
              <AlertTriangle className="size-4" />
            </div>
            <DialogTitle className="text-base font-semibold text-brand-ink dark:text-white">
              Delete Load #{loadNumber}
            </DialogTitle>
          </div>
          <DialogDescription className="text-xs text-brand-muted-soft pt-1">
            This action is permanent and cannot be undone. Associated trip references and records will be detached and this load will be removed from your active ledger.
          </DialogDescription>
        </DialogHeader>

        <DialogFooter className="gap-2 sm:gap-0 pt-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setOpen(false)}
            disabled={isDeleting}
            className="text-xs"
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={handleDelete}
            disabled={isDeleting}
            className="gap-1.5 text-xs bg-red-600 hover:bg-red-700 text-white"
          >
            {isDeleting ? (
              <>
                <Loader2 className="size-3.5 animate-spin" />
                Deleting...
              </>
            ) : (
              <>
                <Trash2 className="size-3.5" />
                Confirm Delete
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

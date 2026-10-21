"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { Pencil, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { AddressAutocompleteInput } from "./address-autocomplete-input"
import { normalizeSubdivisionCode } from "@/lib/geography"

interface EditLoadDialogProps {
  load: {
    id: string
    loadNumber: string
    customerName?: string | null
    originCity?: string | null
    originState?: string | null
    originAddress?: string | null
    destCity?: string | null
    destState?: string | null
    destAddress?: string | null
    rate?: string | null
    commodity?: string | null
    weight?: string | null
    loadType?: string | null
    status: string
    specialInstructions?: string | null
  }
  trigger?: React.ReactNode
}

export function EditLoadDialog({ load, trigger }: EditLoadDialogProps) {
  const router = useRouter()
  const [open, setOpen] = React.useState(false)
  const [isSaving, setIsSaving] = React.useState(false)

  const [customerName, setCustomerName] = React.useState(load.customerName || "")
  const [rate, setRate] = React.useState(load.rate || "")
  const [status, setStatus] = React.useState(load.status || "available")
  const [equipmentType, setEquipmentType] = React.useState(load.loadType || "Dry Van")
  const [commodity, setCommodity] = React.useState(load.commodity || "")
  const [weight, setWeight] = React.useState(load.weight || "")

  const [originAddress, setOriginAddress] = React.useState(load.originAddress || "")
  const [originCity, setOriginCity] = React.useState(load.originCity || "")
  const [originState, setOriginState] = React.useState(load.originState || "")

  const [destAddress, setDestAddress] = React.useState(load.destAddress || "")
  const [destCity, setDestCity] = React.useState(load.destCity || "")
  const [destState, setDestState] = React.useState(load.destState || "")

  const [specialInstructions, setSpecialInstructions] = React.useState(
    load.specialInstructions || ""
  )

  React.useEffect(() => {
    if (open) {
      setCustomerName(load.customerName || "")
      setRate(load.rate || "")
      setStatus(load.status || "available")
      setEquipmentType(load.loadType || "Dry Van")
      setCommodity(load.commodity || "")
      setWeight(load.weight || "")
      setOriginAddress(load.originAddress || "")
      setOriginCity(load.originCity || "")
      setOriginState(load.originState || "")
      setDestAddress(load.destAddress || "")
      setDestCity(load.destCity || "")
      setDestState(load.destState || "")
      setSpecialInstructions(load.specialInstructions || "")
    }
  }, [open, load])

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSaving(true)

    try {
      const res = await fetch(`/api/loads/${load.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerName: customerName.trim(),
          rate: rate ? parseFloat(rate) : undefined,
          status,
          loadType: equipmentType,
          commodity: commodity.trim() || null,
          weight: weight ? parseFloat(weight) : null,
          originAddress: originAddress.trim() || null,
          originCity: originCity.trim(),
          originState: originState.trim().toUpperCase(),
          destAddress: destAddress.trim() || null,
          destCity: destCity.trim(),
          destState: destState.trim().toUpperCase(),
          specialInstructions: specialInstructions.trim() || null,
        }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || "Failed to update load")
      }

      toast.success(`Load #${load.loadNumber} updated successfully`)
      setOpen(false)
      router.refresh()
    } catch (err: any) {
      toast.error(err.message || "Failed to update load")
    } finally {
      setIsSaving(false)
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
              className="h-9 gap-1.5 rounded-full border-brand-rule text-xs font-medium text-brand-ink hover:bg-brand-cream-soft dark:border-zinc-700"
            >
              <Pencil className="size-3.5" />
              Edit Load
            </Button>
          }
        />
      )}

      <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-lg font-serif">
            Edit Load <span className="font-mono text-[#d9622b]">#{load.loadNumber}</span>
          </DialogTitle>
          <DialogDescription className="text-xs text-brand-muted-soft">
            Update load specs, customer tender, route addresses, or current status.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSave} className="space-y-4 py-2 text-xs">
          {/* Customer & Rate */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Customer / Shipper</Label>
              <Input
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="e.g. Walmart Logistics"
                className="h-9 text-xs"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Agreed Linehaul Rate ($)</Label>
              <Input
                type="number"
                step="0.01"
                value={rate}
                onChange={(e) => setRate(e.target.value)}
                placeholder="2500.00"
                className="h-9 text-xs font-mono"
                required
              />
            </div>
          </div>

          {/* Status & Equipment */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Status</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="available">Available</SelectItem>
                  <SelectItem value="booked">Booked</SelectItem>
                  <SelectItem value="dispatched">Dispatched</SelectItem>
                  <SelectItem value="in_transit">In Transit</SelectItem>
                  <SelectItem value="delivered">Delivered</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Equipment Type</Label>
              <Select value={equipmentType} onValueChange={setEquipmentType}>
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Dry Van">Dry Van</SelectItem>
                  <SelectItem value="Reefer">Reefer</SelectItem>
                  <SelectItem value="Flatbed">Flatbed</SelectItem>
                  <SelectItem value="Step Deck">Step Deck</SelectItem>
                  <SelectItem value="Power Only">Power Only</SelectItem>
                  <SelectItem value="Box Truck">Box Truck</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Commodity & Weight */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Commodity</Label>
              <Input
                value={commodity}
                onChange={(e) => setCommodity(e.target.value)}
                placeholder="e.g. General Freight"
                className="h-9 text-xs"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Weight (lbs)</Label>
              <Input
                type="number"
                value={weight}
                onChange={(e) => setWeight(e.target.value)}
                placeholder="42000"
                className="h-9 text-xs font-mono"
              />
            </div>
          </div>

          {/* Origin Address */}
          <div className="space-y-2 rounded-lg border border-brand-rule p-3 bg-brand-cream/20 dark:bg-zinc-900/50">
            <Label className="text-xs font-semibold text-brand-ink">Origin (Pickup)</Label>
            <div className="space-y-1.5">
              <AddressAutocompleteInput
                value={originAddress}
                onChange={setOriginAddress}
                onSelectAddress={(data) => {
                  setOriginAddress(data.address)
                  if (data.city) setOriginCity(data.city)
                  if (data.state) {
                    setOriginState(normalizeSubdivisionCode(data.country || "US", data.state))
                  }
                }}
                placeholder="Street address (Google Places / Autocomplete)"
                className="h-9 text-xs"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Input
                value={originCity}
                onChange={(e) => setOriginCity(e.target.value)}
                placeholder="City"
                className="h-9 text-xs"
                required
              />
              <Input
                value={originState}
                onChange={(e) => setOriginState(e.target.value)}
                placeholder="State (e.g. GA)"
                maxLength={2}
                className="h-9 text-xs uppercase"
                required
              />
            </div>
          </div>

          {/* Destination Address */}
          <div className="space-y-2 rounded-lg border border-brand-rule p-3 bg-brand-cream/20 dark:bg-zinc-900/50">
            <Label className="text-xs font-semibold text-brand-ink">Destination (Delivery)</Label>
            <div className="space-y-1.5">
              <AddressAutocompleteInput
                value={destAddress}
                onChange={setDestAddress}
                onSelectAddress={(data) => {
                  setDestAddress(data.address)
                  if (data.city) setDestCity(data.city)
                  if (data.state) {
                    setDestState(normalizeSubdivisionCode(data.country || "US", data.state))
                  }
                }}
                placeholder="Street address (Google Places / Autocomplete)"
                className="h-9 text-xs"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Input
                value={destCity}
                onChange={(e) => setDestCity(e.target.value)}
                placeholder="City"
                className="h-9 text-xs"
                required
              />
              <Input
                value={destState}
                onChange={(e) => setDestState(e.target.value)}
                placeholder="State (e.g. TX)"
                maxLength={2}
                className="h-9 text-xs uppercase"
                required
              />
            </div>
          </div>

          {/* Special Instructions */}
          <div className="space-y-1.5">
            <Label className="text-xs">Special Instructions / Handling Notes</Label>
            <Textarea
              value={specialInstructions}
              onChange={(e) => setSpecialInstructions(e.target.value)}
              placeholder="e.g. Must check-in at guard gate with seal # intact"
              rows={2}
              className="text-xs resize-none"
            />
          </div>

          <DialogFooter className="gap-2 sm:gap-0 pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setOpen(false)}
              disabled={isSaving}
              className="text-xs"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={isSaving}
              className="gap-1.5 text-xs bg-brand-ink text-brand-cream hover:bg-brand-ink/90"
            >
              {isSaving ? (
                <>
                  <Loader2 className="size-3.5 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save Changes"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

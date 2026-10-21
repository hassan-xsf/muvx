"use client"

import * as React from "react"
import { Button } from "@/components/ui/button"
import { IntegrationPlatform } from "../data/types"
import { toast } from "sonner"
import { sounds } from "@/lib/sound-effects"

interface FieldMappingProps {
  platform: IntegrationPlatform
}

export function FieldMapping({ platform }: FieldMappingProps) {
  const [entities, setEntities] = React.useState(
    platform.syncEntities || [
      { id: "e1", label: "Master Assets & Vehicles", description: "Bi-directional sync of tractor VINs, license plates, and trailer numbers", defaultEnabled: true },
      { id: "e2", label: "Driver Duty & Hours of Service", description: "Imports driver available driving hours and rest break clocks into dispatch scheduler", defaultEnabled: true },
      { id: "e3", label: "Milestone Geofences & Facility Pings", description: "Triggers automatic arrival and departure timestamps when vehicle enters yard radius", defaultEnabled: true },
      { id: "e4", label: "Electronic Invoices & Rate Line Items", description: "Pushes approved fuel surcharges, accessorials, and base freight to general ledger", defaultEnabled: false },
    ]
  )

  const handleToggle = (id: string) => {
    setEntities((prev) =>
      prev.map((item) => (item.id === id ? { ...item, defaultEnabled: !item.defaultEnabled } : item))
    )
    sounds.pop()
    toast.success("Entity synchronization rules updated")
  }

  return (
    <div className="flex flex-col gap-6 rounded-3xl border border-[#dcd5c9] bg-[#fffefb] p-6 sm:p-8 shadow-[0_4px_16px_rgba(58,46,30,0.03)]">
      <div className="flex items-center justify-between border-b border-[#dcd5c9]/60 pb-4">
        <div>
          <h2 className="font-serif text-xl sm:text-2xl font-medium text-[#16181d]">
            Entity Sync Rules & Field Mapping
          </h2>
          <p className="font-geist text-xs text-[#8a8b8f] mt-0.5">
            Select which freight objects and telemetry streams automatically flow between {platform.name} and Muvx.
          </p>
        </div>
      </div>

      <div className="space-y-3">
        {entities.map((item) => (
          <div
            key={item.id}
            className="flex items-center justify-between p-4 rounded-2xl border border-[#dcd5c9]/70 bg-white hover:border-[#16181d]/30 transition-all"
          >
            <div className="min-w-0 pr-4">
              <p className="font-geist text-xs sm:text-[13px] font-semibold text-[#16181d]">
                {item.label}
              </p>
              <p className="font-geist text-xs text-[#8a8b8f] mt-0.5 leading-normal">
                {item.description}
              </p>
            </div>

            <button
              type="button"
              onClick={() => handleToggle(item.id)}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                item.defaultEnabled ? "bg-[#16181d]" : "bg-[#ede8df]"
              }`}
            >
              <span
                className={`pointer-events-none inline-block size-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                  item.defaultEnabled ? "translate-x-5" : "translate-x-0"
                }`}
              />
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}

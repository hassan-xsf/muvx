"use client"

import * as React from "react"
import { ArrowRight, CheckCircle2, ChevronRight, Cpu, Layers, Sparkles } from "lucide-react"
import { IntegrationCategory, IntegrationPlatform } from "../data/types"

interface SupplyChainMeshProps {
  platforms: IntegrationPlatform[]
  selectedCategory: IntegrationCategory
  onSelectCategory: (category: IntegrationCategory) => void
}

interface MeshStage {
  step: string
  label: string
  category: IntegrationCategory
  color: string
  protocol: string
  title: string
  description: string
  platforms: string[]
}

const STAGES: MeshStage[] = [
  {
    step: "STAGE 01",
    label: "CAB TELEMATICS",
    category: "ELD & Telematics",
    color: "#d9622b",
    protocol: "REST API v2 · Webhooks",
    title: "Live GPS & HOS Ingest",
    description: "GPS breadcrumbs, driver Hours of Service (HOS) duty clocks, and engine DTC codes stream into Muvx every 60s.",
    platforms: ["Samsara", "Motive", "Geotab"],
  },
  {
    step: "STAGE 02",
    label: "SPOT CAPACITY",
    category: "Load Boards & Capacity",
    color: "#2f4b7c",
    protocol: "Connexion v3 · RateView",
    title: "Auto-Post & Rate Benchmark",
    description: "Empty trailers auto-post to spot boards on delivery. 7-day DAT RateView benchmarks price every freight quote.",
    platforms: ["DAT One", "Truckstop", "123Loadboard"],
  },
  {
    step: "STAGE 03",
    label: "AUTONOMOUS BRAIN",
    category: "Routing, Mileage & Tolls",
    color: "#5e8c6a",
    protocol: "Trimble Cloud · Practical Miles",
    title: "Hazmat & Bridge Routing",
    description: "Commercial truck clearance audits, low-bridge avoidance, and state-by-state IFTA mileage splits computed instantly.",
    platforms: ["PC*Miler", "Google Maps", "SMC3"],
  },
  {
    step: "STAGE 04",
    label: "SETTLEMENT & AUDIT",
    category: "Accounting & ERP",
    color: "#8c6239",
    protocol: "Intuit OAuth 2.0 · EDI 820",
    title: "Instant Invoice & Factoring",
    description: "POD matched to BOL in 4 seconds. Ledger invoice generated, fuel card advance deducted, carrier wired Friday.",
    platforms: ["QuickBooks", "TriumphPay", "WEX / EFS"],
  },
]

export function SupplyChainMesh({
  platforms,
  selectedCategory,
  onSelectCategory,
}: SupplyChainMeshProps) {
  // Count connected platforms per category
  const connectedByCat = React.useMemo(() => {
    const map: Record<string, number> = {}
    platforms.forEach((p) => {
      if (p.status === "connected") {
        map[p.category] = (map[p.category] || 0) + 1
      }
    })
    return map
  }, [platforms])

  return (
    <div className="flex flex-col gap-5 sm:gap-6 rounded-[28px] border border-[#dcd5c9] bg-[#ede8df] px-5 py-6 sm:px-8 sm:py-8 shadow-[0_4px_24px_rgba(58,46,30,0.04)]">
      {/* ── Top Eyebrow & Hint ─────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-[#dcd5c9]/80 pb-4">
        <div className="flex items-center gap-2.5">
          <span className="size-[7px] shrink-0 rounded-full bg-[#d9622b]" />
          <span className="font-geist-mono text-[11px] font-medium uppercase tracking-[0.04em] text-[#16181d]">
            HOW DATA FLOWS · ZERO MANUAL DISPATCH
          </span>
          <span className="font-geist-mono text-[11px] tracking-[0.04em] text-[#8a8b8f] hidden md:inline">
            · 4-STAGE AUTONOMOUS MESH
          </span>
        </div>
        <div className="font-geist-mono text-[10px] tracking-[0.04em] text-[#6f6b63] flex items-center gap-1.5">
          <span className="inline-block size-1.5 rounded-full bg-[#16181d]/40" />
          <span>CLICK ANY STAGE TO FILTER CONNECTORS</span>
        </div>
      </div>

      {/* ── Editorial Narrative Headline ───────────────────────── */}
      <div className="max-w-3xl">
        <h2 className="font-serif text-[clamp(22px,2.6vw,34px)] leading-[1.12] tracking-[-0.02em] text-[#16181d]">
          From cab telematics to <span className="text-[#2f4b7c] underline decoration-from-font underline-offset-2">spot tender</span>,{" "}
          <span className="text-[#5e8c6a] underline decoration-from-font underline-offset-2">bridge clearance</span>, and{" "}
          <span className="text-[#8c6239] italic underline decoration-from-font underline-offset-2">carrier payout</span>.
        </h2>
        <p className="mt-2 font-geist text-xs sm:text-sm text-[#4a4e57] leading-relaxed">
          Muvx continuously listens to live webhooks and streams load status changes into every connected ledger. When a truck empties out, the entire supply chain updates itself.
        </p>
      </div>

      {/* ── 4 Pipeline Stage Cards ────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 pt-1">
        {STAGES.map((s, idx) => {
          const isSelected = selectedCategory === s.category
          const activeFeeds = connectedByCat[s.category] || 0

          return (
            <button
              key={s.step}
              type="button"
              onClick={() => onSelectCategory(isSelected ? "All" : s.category)}
              className={`group text-left relative flex flex-col justify-between rounded-2xl border p-4 sm:p-5 transition-all duration-200 cursor-pointer ${
                isSelected
                  ? "bg-[#fffefb] border-[#16181d] shadow-[0_8px_24px_rgba(22,24,29,0.08)] ring-2 ring-[#16181d]"
                  : "bg-[#fffefb] border-[#dcd5c9] shadow-[0_2px_10px_rgba(58,46,30,0.03)] hover:border-[#16181d]/40 hover:shadow-[0_6px_18px_rgba(58,46,30,0.06)]"
              }`}
            >
              <div>
                {/* Header: Step & Feed indicator */}
                <div className="flex items-center justify-between gap-2 mb-3">
                  <div className="flex items-center gap-1.5">
                    <span
                      className="size-2 rounded-full"
                      style={{ backgroundColor: s.color }}
                    />
                    <span
                      className="font-geist-mono text-[10px] font-semibold tracking-[0.04em]"
                      style={{ color: s.color }}
                    >
                      {s.step}
                    </span>
                  </div>

                  {activeFeeds > 0 ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-[#5e8c6a]/15 px-2 py-0.5 text-[#5e8c6a] font-geist-mono text-[9px] font-semibold tracking-tight">
                      <span className="size-1.5 rounded-full bg-[#5e8c6a] animate-pulse" />
                      {activeFeeds} LIVE
                    </span>
                  ) : (
                    <span className="font-geist-mono text-[9px] text-[#8a8b8f] tracking-tight">
                      STANDBY
                    </span>
                  )}
                </div>

                {/* Subtitle / Category Label */}
                <p className="font-geist-mono text-[9px] font-medium tracking-[0.05em] uppercase text-[#6f6b63]">
                  {s.label}
                </p>

                {/* Title */}
                <h3 className="mt-1 font-geist text-[14px] sm:text-[15px] font-semibold text-[#16181d] leading-snug group-hover:text-[#d9622b] transition-colors">
                  {s.title}
                </h3>

                {/* Description */}
                <p className="mt-2 font-geist text-xs text-[#5a5e66] leading-[18px]">
                  {s.description}
                </p>
              </div>

              {/* Footer: Protocol & Leading platforms */}
              <div className="mt-4 pt-3 border-t border-[#dcd5c9]/60 flex flex-col gap-1.5">
                <div className="font-geist-mono text-[9px] text-[#8a8b8f] truncate">
                  {s.protocol}
                </div>
                <div className="flex items-center justify-between text-xs font-geist text-[#16181d]">
                  <span className="font-medium truncate text-[11px] text-[#6f6b63]">
                    {s.platforms.join(" · ")}
                  </span>
                  <ChevronRight
                    className={`size-3.5 transition-transform ${
                      isSelected
                        ? "translate-x-0.5 text-[#16181d]"
                        : "text-[#8a8b8f] group-hover:translate-x-0.5 group-hover:text-[#16181d]"
                    }`}
                  />
                </div>
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}

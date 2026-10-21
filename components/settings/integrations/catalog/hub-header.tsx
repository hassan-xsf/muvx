"use client"

import * as React from "react"
import Link from "next/link"
import { Plug, Activity, CheckCircle2, ShieldCheck, Plus, Sparkles, ExternalLink } from "lucide-react"
import { Button } from "@/components/ui/button"

interface HubHeaderProps {
  connectedCount: number
  totalCount: number
  onRequestIntegration?: () => void
}

export function HubHeader({ connectedCount, totalCount, onRequestIntegration }: HubHeaderProps) {
  return (
    <div className="flex flex-col gap-6">
      {/* ── Top Eyebrow & Title ───────────────────────────────── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="size-2 rounded-full bg-[#5e8c6a] animate-pulse" />
            <span className="font-geist-mono text-[11px] font-medium tracking-[0.04em] uppercase text-[#8a8b8f]">
              ECOSYSTEM · 140+ FREIGHT PROTOCOLS
            </span>
          </div>
          <h1 className="font-serif text-[clamp(32px,3.8vw,46px)] leading-[1.05] tracking-tight text-[#16181d]">
            Connected Logistics Network
          </h1>
          <p className="mt-2 max-w-[620px] font-geist text-sm sm:text-[15px] leading-relaxed text-[#4a4e57]">
            Connect your ELD telematics, load boards, accounting software, and visibility platforms.
            Muvx automates two-way data sync across your entire supply chain with zero manual typing.
          </p>
        </div>

        {/* Action button */}
        <div className="flex shrink-0 items-center gap-2.5">
          <Button
            variant="outline"
            onClick={onRequestIntegration}
            className="rounded-full border-[#dcd5c9] bg-[#fffefb] hover:bg-[#ede8df] text-[#16181d] font-geist text-xs sm:text-[13px] font-medium shadow-sm h-10 px-4"
          >
            <Sparkles className="size-3.5 mr-1.5 text-[#d9622b]" />
            Request Integration
          </Button>
          <Link href="/docs/api" target="_blank">
            <Button
              className="rounded-full bg-[#16181d] hover:bg-[#2a2d35] text-[#f5f2ec] font-geist text-xs sm:text-[13px] font-medium shadow-sm h-10 px-4 inline-flex items-center gap-1.5"
            >
              <span>Custom Webhook API</span>
              <ExternalLink className="size-3 text-[#8a8b8f]" />
            </Button>
          </Link>
        </div>
      </div>

      {/* ── Metric Health Banner (Editorial "The Line" Inspired) ─ */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 rounded-2xl border border-[#dcd5c9] bg-[#fffefb] p-3.5 sm:p-5 shadow-[0_4px_16px_rgba(58,46,30,0.03)]">
        <div className="flex flex-col gap-1 border-r border-[#dcd5c9]/60 pr-4">
          <span className="font-geist-mono text-[10px] tracking-[0.04em] text-[#8a8b8f]">
            ACTIVE CONNECTIONS
          </span>
          <div className="flex items-baseline gap-2">
            <span className="font-serif text-2xl sm:text-[28px] font-medium text-[#16181d]">
              {connectedCount}
            </span>
            <span className="font-geist text-xs text-[#5e8c6a] font-medium">live feeds</span>
          </div>
        </div>

        <div className="flex flex-col gap-1 border-r border-[#dcd5c9]/60 px-3 sm:px-4">
          <span className="font-geist-mono text-[10px] tracking-[0.04em] text-[#8a8b8f]">
            CATALOG AVAILABILITY
          </span>
          <div className="flex items-baseline gap-2">
            <span className="font-serif text-2xl sm:text-[28px] font-medium text-[#16181d]">
              {totalCount}+
            </span>
            <span className="font-geist text-xs text-[#8a8b8f]">platforms</span>
          </div>
        </div>

        <div className="flex flex-col gap-1 border-r border-[#dcd5c9]/60 px-3 sm:px-4">
          <span className="font-geist-mono text-[10px] tracking-[0.04em] text-[#8a8b8f]">
            SYNC UPTIME (30D)
          </span>
          <div className="flex items-baseline gap-2">
            <span className="font-serif text-2xl sm:text-[28px] font-medium text-[#16181d]">
              99.98%
            </span>
            <span className="size-2 rounded-full bg-[#5e8c6a] inline-block mb-1" />
          </div>
        </div>

        <div className="flex flex-col gap-1 pl-3 sm:pl-4">
          <span className="font-geist-mono text-[10px] tracking-[0.04em] text-[#8a8b8f]">
            DATA PIPELINE
          </span>
          <div className="flex items-baseline gap-2">
            <span className="font-serif text-2xl sm:text-[28px] font-medium text-[#16181d]">
              1.2M
            </span>
            <span className="font-geist text-xs text-[#8a8b8f]">events / day</span>
          </div>
        </div>
      </div>
    </div>
  )
}

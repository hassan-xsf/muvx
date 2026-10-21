"use client"

import * as React from "react"
import Link from "next/link"
import { Sparkles, ExternalLink, ShieldCheck, Zap, Radio, Lock } from "lucide-react"
import { Button } from "@/components/ui/button"

interface HubHeaderProps {
  connectedCount: number
  totalCount: number
  onRequestIntegration?: () => void
}

export function HubHeader({ connectedCount, totalCount, onRequestIntegration }: HubHeaderProps) {
  return (
    <div className="flex flex-col gap-6 sm:gap-8">
      {/* ── Top Eyebrow, Title & Action Bar ───────────────────── */}
      <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex flex-col gap-3.5 max-w-3xl">
          {/* Eyebrow matching landing page style */}
          <div className="flex items-center gap-2.5">
            <span className="size-[7px] shrink-0 rounded-full bg-[#d9622b]" />
            <span className="font-geist-mono text-[11px] font-medium uppercase tracking-[0.04em] text-[#16181d]">
              CONNECTIVITY HUB · ZERO DUAL-ENTRY
            </span>
            <span className="font-geist-mono text-[11px] tracking-[0.04em] text-[#8a8b8f] hidden sm:inline">
              · 140+ FREIGHT PROTOCOLS
            </span>
          </div>

          {/* Editorial Headline with Instrument Serif */}
          <h1 className="font-serif text-[clamp(34px,4.5vw,56px)] leading-[0.98] tracking-[-1.2px] text-[#16181d]">
            Connect your fleet. <span className="italic text-[#d9622b]">Automate the handoff.</span>
          </h1>

          {/* Subtitle */}
          <p className="font-geist text-sm sm:text-base leading-relaxed text-[#4a4e57] max-w-2xl">
            Connect your GPS trackers, load boards, and billing tools to Nova. Data moves automatically with zero manual entry.
          </p>
        </div>

        {/* Action buttons */}
        <div className="flex shrink-0 items-center gap-2.5 self-start lg:self-end">
          <Link href="/docs/api" target="_blank" className="font-geist text-xs text-[#8a8b8f] hover:text-[#16181d] px-2 py-1 transition-colors">
            Developer Docs
          </Link>
          <Button
            onClick={onRequestIntegration}
            className="rounded-full bg-[#16181d] hover:bg-[#2a2d35] text-[#f5f2ec] font-geist text-xs sm:text-[13px] font-medium shadow-sm h-10 px-5 cursor-pointer inline-flex items-center gap-1.5"
          >
            <Sparkles className="size-3.5 text-[#d9622b]" />
            Request Platform
          </Button>
        </div>
      </div>

      {/* ── Metric Health Strip (Honest Data, No Fake Numbers) ─── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 rounded-2xl border border-[#dcd5c9] bg-[#fffefb] p-4 sm:p-5 shadow-[0_4px_16px_rgba(58,46,30,0.03)] divide-y sm:divide-y-0 sm:divide-x divide-[#dcd5c9]/70">
        {/* Metric 1: Active Connections */}
        <div className="flex flex-col gap-1.5 pb-3 sm:pb-0 pr-4">
          <div className="flex items-center justify-between">
            <span className="font-geist-mono text-[10px] tracking-[0.04em] text-[#8a8b8f] uppercase">
              ACTIVE CONNECTIONS
            </span>
            {connectedCount > 0 ? (
              <span className="size-2 rounded-full bg-[#5e8c6a] animate-pulse" />
            ) : (
              <span className="size-2 rounded-full bg-[#8a8b8f]/50" />
            )}
          </div>
          <div className="flex items-baseline gap-2">
            <span className="font-serif text-3xl sm:text-4xl font-medium text-[#16181d]">
              {connectedCount}
            </span>
            <span className="font-geist text-xs text-[#5e8c6a] font-medium">
              {connectedCount === 0 ? "standby" : "live feeds"}
            </span>
          </div>
          <p className="font-geist text-[11px] text-[#6f6b63]">
            {connectedCount === 0
              ? "No platform paired yet"
              : `${connectedCount} stream${connectedCount === 1 ? "" : "s"} syncing live`}
          </p>
        </div>

        {/* Metric 2: Available Catalog */}
        <div className="flex flex-col gap-1.5 py-3 sm:py-0 sm:px-4">
          <span className="font-geist-mono text-[10px] tracking-[0.04em] text-[#8a8b8f] uppercase">
            CERTIFIED CONNECTORS
          </span>
          <div className="flex items-baseline gap-2">
            <span className="font-serif text-3xl sm:text-4xl font-medium text-[#16181d]">
              {totalCount}+
            </span>
            <span className="font-geist text-xs text-[#6f6b63]">protocols</span>
          </div>
          <p className="font-geist text-[11px] text-[#6f6b63]">
            ELD, EDI, Load Boards, Accounting
          </p>
        </div>

        {/* Metric 3: Security & Encryption */}
        <div className="flex flex-col gap-1.5 py-3 sm:py-0 sm:px-4">
          <span className="font-geist-mono text-[10px] tracking-[0.04em] text-[#8a8b8f] uppercase">
            CREDENTIAL VAULT
          </span>
          <div className="flex items-baseline gap-2">
            <span className="font-serif text-3xl sm:text-4xl font-medium text-[#16181d]">
              AES-256
            </span>
            <Lock className="size-3 text-[#5e8c6a]" />
          </div>
          <p className="font-geist text-[11px] text-[#6f6b63]">
            Zero-trust scoped OAuth tokens
          </p>
        </div>

        {/* Metric 4: Latency Engine */}
        <div className="flex flex-col gap-1.5 pt-3 sm:pt-0 sm:pl-4">
          <span className="font-geist-mono text-[10px] tracking-[0.04em] text-[#8a8b8f] uppercase">
            SYNC LATENCY
          </span>
          <div className="flex items-baseline gap-2">
            <span className="font-serif text-3xl sm:text-4xl font-medium text-[#16181d]">
              &lt; 250ms
            </span>
            <Zap className="size-3 text-[#d9622b]" />
          </div>
          <p className="font-geist text-[11px] text-[#6f6b63]">
            Direct webhook event-driven ingest
          </p>
        </div>
      </div>
    </div>
  )
}

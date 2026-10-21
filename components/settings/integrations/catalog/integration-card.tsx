"use client"

import * as React from "react"
import Link from "next/link"
import { Check, ChevronRight, Sliders, ArrowUpRight, ShieldCheck, Zap } from "lucide-react"
import { IntegrationPlatform } from "../data/types"
import { PlatformLogo } from "../data/logos"

interface IntegrationCardProps {
  platform: IntegrationPlatform
  onQuickConfigure?: (platform: IntegrationPlatform) => void
}

export function IntegrationCard({ platform, onQuickConfigure }: IntegrationCardProps) {
  const isConnected = platform.status === "connected"

  return (
    <div
      className={`group relative flex flex-col justify-between rounded-2xl border bg-[#fffefb] p-5 sm:p-6 transition-all duration-200 ${
        isConnected
          ? "border-[#5e8c6a]/50 shadow-[0_4px_20px_rgba(94,140,106,0.08)] hover:border-[#5e8c6a] hover:shadow-[0_8px_28px_rgba(94,140,106,0.14)]"
          : "border-[#dcd5c9] shadow-[0_4px_16px_rgba(58,46,30,0.03)] hover:border-[#16181d]/35 hover:shadow-[0_8px_24px_rgba(58,46,30,0.06)]"
      }`}
    >
      <div>
        {/* ── Header: Logo + Status Badge ───────────────────── */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <PlatformLogo
              id={platform.id}
              name={platform.name}
              category={platform.category}
              className="size-11 rounded-2xl shadow-sm border border-black/5"
            />
            <div>
              <h3 className="font-geist text-[15px] font-semibold text-[#16181d] leading-snug group-hover:text-[#d9622b] transition-colors">
                {platform.name}
              </h3>
              <p className="font-geist text-xs text-[#8a8b8f] truncate max-w-[190px]">
                {platform.provider}
              </p>
            </div>
          </div>

          {/* Connection Status Pill */}
          {isConnected ? (
            <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-[#5e8c6a]/15 px-2.5 py-1 text-[#5e8c6a] font-geist-mono text-[9px] font-semibold tracking-[0.04em]">
              <span className="size-1.5 rounded-full bg-[#5e8c6a] animate-pulse" />
              LIVE FEED
            </span>
          ) : (
            <span className="inline-flex shrink-0 items-center rounded-full border border-[#dcd5c9] px-2 py-0.5 text-[#8a8b8f] font-geist-mono text-[9px] tracking-[0.04em]">
              READY
            </span>
          )}
        </div>

        {/* ── Category & Protocol Tag ───────────────────────── */}
        <div className="mt-3.5 flex flex-wrap items-center gap-1.5">
          <span className="rounded-md bg-[#ede8df] px-2 py-0.5 font-geist-mono text-[9px] font-medium text-[#4a4e57]">
            {platform.category}
          </span>
          <span className="font-geist-mono text-[9px] text-[#8a8b8f] truncate max-w-[210px]">
            · {platform.dataProtocol}
          </span>
        </div>

        {/* ── Description ───────────────────────────────────── */}
        <p className="mt-2.5 font-geist text-xs sm:text-[13px] leading-[18px] sm:leading-[19px] text-[#4a4e57] line-clamp-2">
          {platform.tagline || platform.description}
        </p>

        {/* ── Connected Account Footnote (If active) ────────── */}
        {isConnected && platform.connectedAccount && (
          <div className="mt-3.5 flex items-center justify-between rounded-xl bg-[#f5f2ec]/80 px-3 py-1.5 border border-[#dcd5c9]/60">
            <span className="font-geist-mono text-[10px] font-medium text-[#16181d] truncate max-w-[180px]">
              {platform.connectedAccount}
            </span>
            <span className="font-geist-mono text-[9px] text-[#5e8c6a] font-medium">
              {platform.lastSync || "Active"}
            </span>
          </div>
        )}
      </div>

      {/* ── Footer Actions ──────────────────────────────────── */}
      <div className="mt-5 pt-3.5 border-t border-[#dcd5c9]/60 flex items-center justify-between gap-2">
        <Link
          href={`/settings/integrations/${platform.id}`}
          className="font-geist text-xs font-medium text-[#8a8b8f] hover:text-[#16181d] inline-flex items-center gap-1 transition-colors"
        >
          <span>View Spec</span>
          <ArrowUpRight className="size-3 text-[#8a8b8f]" />
        </Link>

        {isConnected ? (
          <button
            type="button"
            onClick={() => onQuickConfigure?.(platform)}
            className="inline-flex items-center gap-1.5 rounded-full bg-[#16181d] px-3.5 py-1.5 font-geist text-xs font-medium text-[#f5f2ec] hover:bg-[#2a2d35] transition-colors shadow-sm cursor-pointer"
          >
            <Sliders className="size-3 text-[#5e8c6a]" />
            <span>Configure</span>
          </button>
        ) : (
          <button
            type="button"
            onClick={() => onQuickConfigure?.(platform)}
            className="inline-flex items-center gap-1 rounded-full border border-[#dcd5c9] bg-[#fffefb] hover:bg-[#16181d] hover:text-[#f5f2ec] hover:border-[#16181d] px-3.5 py-1.5 font-geist text-xs font-medium text-[#16181d] transition-all shadow-sm cursor-pointer"
          >
            <span>Connect</span>
            <ChevronRight className="size-3.5" />
          </button>
        )}
      </div>
    </div>
  )
}

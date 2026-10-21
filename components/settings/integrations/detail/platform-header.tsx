"use client"

import * as React from "react"
import Link from "next/link"
import { ArrowLeft, ExternalLink, ShieldCheck, CheckCircle2, Clock, Activity, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { IntegrationPlatform } from "../data/types"
import { PlatformLogo } from "../data/logos"

interface PlatformHeaderProps {
  platform: IntegrationPlatform
  onToggleStatus: () => void
  onManualSync?: () => void
  isSyncing?: boolean
}

export function PlatformHeader({
  platform,
  onToggleStatus,
  onManualSync,
  isSyncing,
}: PlatformHeaderProps) {
  const isConnected = platform.status === "connected"

  return (
    <div className="flex flex-col gap-6">
      {/* ── Breadcrumb Bar ────────────────────────────────────── */}
      <div className="flex items-center gap-2 font-geist-mono text-xs text-[#8a8b8f]">
        <Link href="/settings/integrations" className="hover:text-[#16181d] transition-colors inline-flex items-center gap-1.5">
          <ArrowLeft className="size-3.5" />
          <span>All Integrations</span>
        </Link>
        <span>/</span>
        <span className="text-[#8a8b8f]">{platform.category}</span>
        <span>/</span>
        <span className="text-[#16181d] font-medium">{platform.name}</span>
      </div>

      {/* ── Main Platform Banner ──────────────────────────────── */}
      <div className="flex flex-col gap-6 rounded-3xl border border-[#dcd5c9] bg-[#fffefb] p-6 sm:p-8 shadow-[0_10px_30px_rgba(58,46,30,0.05)]">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-4 sm:gap-5">
            <PlatformLogo
              id={platform.id}
              name={platform.name}
              category={platform.category}
              className="size-16 sm:size-20 rounded-3xl shadow-sm border border-black/5"
            />
            <div>
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="font-serif text-3xl sm:text-4xl font-medium tracking-tight text-[#16181d]">
                  {platform.name}
                </h1>
                {isConnected ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-[#5e8c6a]/15 px-3 py-1 text-[#5e8c6a] font-geist-mono text-[10px] font-semibold tracking-[0.04em]">
                    <span className="size-2 rounded-full bg-[#5e8c6a] animate-pulse" />
                    LIVE PIPELINE
                  </span>
                ) : (
                  <span className="rounded-full border border-[#dcd5c9] px-2.5 py-1 text-[#8a8b8f] font-geist-mono text-[10px]">
                    AVAILABLE
                  </span>
                )}
              </div>
              <p className="mt-1 font-geist text-xs sm:text-sm text-[#8a8b8f]">
                Developed by {platform.provider} · Protocol: {platform.dataProtocol}
              </p>
              <p className="mt-3 max-w-2xl font-geist text-sm sm:text-[15px] leading-relaxed text-[#4a4e57]">
                {platform.description}
              </p>
            </div>
          </div>

          {/* Action CTAs */}
          <div className="flex shrink-0 flex-wrap items-center gap-2.5 self-start sm:self-auto">
            {isConnected && (
              <Button
                variant="outline"
                disabled={isSyncing}
                onClick={onManualSync}
                className="rounded-full border-[#dcd5c9] bg-[#fffefb] hover:bg-[#ede8df] text-[#16181d] font-geist text-xs font-medium h-10 px-4 shadow-sm"
              >
                <RefreshCw className={`size-3.5 mr-1.5 ${isSyncing ? "animate-spin" : ""}`} />
                <span>{isSyncing ? "Syncing..." : "Sync Now"}</span>
              </Button>
            )}
            <Button
              onClick={onToggleStatus}
              className={`rounded-full font-geist text-xs font-medium h-10 px-5 shadow-sm transition-all ${
                isConnected
                  ? "border border-[#dcd5c9] bg-[#fffefb] text-[#c41230] hover:bg-[#fee2e2] hover:border-[#fca5a5]"
                  : "bg-[#16181d] hover:bg-[#2a2d35] text-[#f5f2ec]"
              }`}
            >
              {isConnected ? "Disconnect Integration" : "Connect Integration"}
            </Button>
          </div>
        </div>

        {/* ── Secondary Stats Bar (If connected) ──────────────── */}
        {isConnected && (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 rounded-2xl bg-[#f5f2ec]/70 p-4 border border-[#dcd5c9]/60">
            <div>
              <p className="font-geist-mono text-[9px] tracking-[0.04em] text-[#8a8b8f]">
                CONNECTED ACCOUNT
              </p>
              <p className="font-geist text-xs sm:text-sm font-semibold text-[#16181d] mt-0.5 truncate">
                {platform.connectedAccount || "Authorized User"}
              </p>
            </div>
            <div>
              <p className="font-geist-mono text-[9px] tracking-[0.04em] text-[#8a8b8f]">
                LAST RECONCILIATION
              </p>
              <p className="font-geist text-xs sm:text-sm font-semibold text-[#16181d] mt-0.5">
                {platform.lastSync || "Just now"}
              </p>
            </div>
            <div>
              <p className="font-geist-mono text-[9px] tracking-[0.04em] text-[#8a8b8f]">
                SYNC HEALTH (UPTIME)
              </p>
              <p className="font-geist text-xs sm:text-sm font-semibold text-[#5e8c6a] mt-0.5 flex items-center gap-1.5">
                <span>{platform.uptime || "99.98%"}</span>
                <span className="size-1.5 rounded-full bg-[#5e8c6a]" />
              </p>
            </div>
            <div>
              <p className="font-geist-mono text-[9px] tracking-[0.04em] text-[#8a8b8f]">
                RECORDS SYNCED
              </p>
              <p className="font-geist text-xs sm:text-sm font-semibold text-[#16181d] mt-0.5">
                {platform.stats?.recordsSynced.toLocaleString() || "142,809"}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

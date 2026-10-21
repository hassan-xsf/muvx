"use client"

import * as React from "react"
import Link from "next/link"
import { notFound, useRouter } from "next/navigation"
import { PLATFORMS_CATALOG } from "../data/platforms-catalog"
import { PlatformHeader } from "./platform-header"
import { AuthSection } from "./auth-section"
import { WebhookEndpoint } from "./webhook-endpoint"
import { SyncLedger } from "./sync-ledger"
import { FieldMapping } from "./field-mapping"
import { ArrowLeft, ExternalLink, ShieldCheck, BookOpen, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import { sounds } from "@/lib/sound-effects"

interface IntegrationDetailClientProps {
  platformId: string
}

export function IntegrationDetailClient({ platformId }: IntegrationDetailClientProps) {
  const router = useRouter()
  const initialPlatform = PLATFORMS_CATALOG.find((p) => p.id === platformId)
  const [platform, setPlatform] = React.useState(initialPlatform)
  const [isSyncing, setIsSyncing] = React.useState(false)

  if (!platform) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center px-4">
        <h1 className="font-serif text-3xl text-[#16181d]">Platform Not Found</h1>
        <p className="mt-2 font-geist text-sm text-[#8a8b8f] max-w-md">
          The requested integration platform "{platformId}" is not part of the active Muvx catalog.
        </p>
        <Link href="/settings/integrations" className="mt-6">
          <Button className="rounded-full bg-[#16181d] text-[#f5f2ec] font-geist text-xs">
            <ArrowLeft className="size-3.5 mr-2" />
            Back to Integrations Catalog
          </Button>
        </Link>
      </div>
    )
  }

  const handleToggleStatus = () => {
    const nextStatus = platform.status === "connected" ? "available" : "connected"
    setPlatform((prev) => (prev ? { ...prev, status: nextStatus } : prev))
    sounds.success()
    toast.success(
      nextStatus === "connected"
        ? `${platform.name} connection established!`
        : `${platform.name} disconnected successfully.`
    )
  }

  const handleManualSync = () => {
    setIsSyncing(true)
    sounds.typing()
    setTimeout(() => {
      setIsSyncing(false)
      sounds.success()
      toast.success(`${platform.name} data re-synchronized across fleet`)
    }, 1200)
  }

  return (
    <div className="flex flex-col gap-8 pb-16">
      {/* ── Page Header ───────────────────────────────────────── */}
      <PlatformHeader
        platform={platform}
        onToggleStatus={handleToggleStatus}
        onManualSync={handleManualSync}
        isSyncing={isSyncing}
      />

      {/* ── 2-Column Responsive Body ──────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column (8 cols): Auth, Mapping, Webhooks */}
        <div className="lg:col-span-7 flex flex-col gap-6">
          <AuthSection platform={platform} />
          <FieldMapping platform={platform} />
          <WebhookEndpoint platform={platform} />
        </div>

        {/* Right Column (5 cols): Sync Ledger & Documentation */}
        <div className="lg:col-span-5 flex flex-col gap-6 sticky top-6">
          <SyncLedger platform={platform} />

          {/* Quick Developer Specs Card */}
          <div className="rounded-3xl border border-[#dcd5c9] bg-[#fffefb] p-6 shadow-[0_4px_16px_rgba(58,46,30,0.03)] space-y-4">
            <div className="flex items-center gap-2">
              <BookOpen className="size-4 text-[#d9622b]" />
              <h3 className="font-serif text-lg font-medium text-[#16181d]">
                Developer Documentation
              </h3>
            </div>
            <p className="font-geist text-xs text-[#4a4e57] leading-relaxed">
              Read the official Muvx integration guide for {platform.name}. Learn how to configure custom webhook events, handle error retries, and set up sandbox credentials.
            </p>
            <div className="pt-1">
              <a
                href={platform.docsUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 font-geist text-xs font-semibold text-[#16181d] hover:text-[#d9622b] transition-colors"
              >
                <span>Browse {platform.name} API Reference</span>
                <ExternalLink className="size-3" />
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

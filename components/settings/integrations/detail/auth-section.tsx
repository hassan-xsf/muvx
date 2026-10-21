"use client"

import * as React from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { ShieldCheck, Key, Eye, EyeOff, Sparkles, CheckCircle2 } from "lucide-react"
import { IntegrationPlatform, SyncCadence } from "../data/types"
import { toast } from "sonner"
import { sounds } from "@/lib/sound-effects"

interface AuthSectionProps {
  platform: IntegrationPlatform
  onSave?: () => void
}

export function AuthSection({ platform, onSave }: AuthSectionProps) {
  const isConnected = platform.status === "connected"
  const [showSecret, setShowSecret] = React.useState(false)
  const [apiKey, setApiKey] = React.useState(isConnected ? "sk_live_98240819402948102" : "")
  const [environment, setEnvironment] = React.useState("production")
  const [cadence, setCadence] = React.useState<SyncCadence>(platform.syncCadence || "realtime")
  const [isSaving, setIsSaving] = React.useState(false)

  const handleSave = () => {
    setIsSaving(true)
    sounds.typing()
    setTimeout(() => {
      setIsSaving(false)
      sounds.success()
      toast.success(`${platform.name} credentials updated and encrypted`)
      onSave?.()
    }, 600)
  }

  return (
    <div className="flex flex-col gap-6 rounded-3xl border border-[#dcd5c9] bg-[#fffefb] p-6 sm:p-8 shadow-[0_4px_16px_rgba(58,46,30,0.03)]">
      <div className="flex items-center justify-between border-b border-[#dcd5c9]/60 pb-4">
        <div>
          <h2 className="font-serif text-xl sm:text-2xl font-medium text-[#16181d]">
            Authentication & Security
          </h2>
          <p className="font-geist text-xs text-[#8a8b8f] mt-0.5">
            Configure authorization protocol and automated polling interval.
          </p>
        </div>
        <div className="flex items-center gap-1.5 rounded-full bg-[#5e8c6a]/10 px-2.5 py-1 text-[#5e8c6a] font-geist-mono text-[9px] font-medium">
          <ShieldCheck className="size-3.5" />
          <span>AES-256 ENCRYPTED</span>
        </div>
      </div>

      {platform.authType === "oauth2" ? (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 rounded-2xl bg-[#f5f2ec]/60 p-5 border border-[#dcd5c9]/60">
          <div>
            <p className="font-geist text-sm font-semibold text-[#16181d]">
              OAuth 2.0 Web Authorization
            </p>
            <p className="font-geist text-xs text-[#4a4e57] mt-1 max-w-md leading-relaxed">
              Authenticate directly with {platform.name}'s secure cloud. Your access and refresh tokens are securely rotated automatically.
            </p>
          </div>
          <Button
            onClick={handleSave}
            className="rounded-full bg-[#16181d] hover:bg-[#2a2d35] text-[#f5f2ec] font-geist text-xs font-medium px-5 h-10 shadow-sm shrink-0"
          >
            <Sparkles className="size-3.5 mr-2 text-[#d9622b]" />
            <span>{isConnected ? "Re-Authorize OAuth Account" : "Authorize with OAuth"}</span>
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label className="font-geist text-xs font-medium text-[#16181d]">
                {platform.authFields?.[0]?.label || "API Key / Private Access Token"}
              </Label>
              <div className="relative mt-1.5">
                <Input
                  type={showSecret ? "text" : "password"}
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder={platform.authFields?.[0]?.placeholder || "Paste secret key here..."}
                  className="h-10 pr-10 rounded-xl border-[#dcd5c9] bg-white font-geist-mono text-xs"
                />
                <button
                  type="button"
                  onClick={() => setShowSecret((p) => !p)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#8a8b8f] hover:text-[#16181d]"
                >
                  {showSecret ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            </div>

            <div>
              <Label className="font-geist text-xs font-medium text-[#16181d]">
                Deployment Environment
              </Label>
              <Select value={environment} onValueChange={setEnvironment}>
                <SelectTrigger className="mt-1.5 h-10 rounded-xl border-[#dcd5c9] bg-white font-geist text-xs">
                  <SelectValue placeholder="Select environment" />
                </SelectTrigger>
                <SelectContent className="rounded-xl border-[#dcd5c9] bg-[#fffefb]">
                  <SelectItem value="production">Live Production (Live Traffic)</SelectItem>
                  <SelectItem value="sandbox">Sandbox / Staging (Test Data)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      )}

      {/* Sync Cadence Selector */}
      <div className="pt-2">
        <Label className="font-geist text-xs font-medium text-[#16181d]">
          Sync Schedule & Webhook Frequency
        </Label>
        <div className="mt-2 grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[
            { id: "realtime", title: "Real-time Streaming", desc: "Instant Webhooks & push events" },
            { id: "every_15_mins", title: "15-Minute Polling", desc: "Optimized for high-volume loads" },
            { id: "hourly", title: "Hourly Reconciliation", desc: "Batch invoices & settlements" },
          ].map((item) => (
            <div
              key={item.id}
              onClick={() => setCadence(item.id as SyncCadence)}
              className={`cursor-pointer rounded-2xl border p-3.5 transition-all ${
                cadence === item.id
                  ? "border-[#16181d] bg-[#f5f2ec] shadow-sm"
                  : "border-[#dcd5c9]/70 bg-white hover:border-[#16181d]/30"
              }`}
            >
              <div className="flex items-center justify-between">
                <p className="font-geist text-xs font-semibold text-[#16181d]">{item.title}</p>
                {cadence === item.id && <span className="size-2 rounded-full bg-[#d9622b]" />}
              </div>
              <p className="font-geist text-[11px] text-[#8a8b8f] mt-1">{item.desc}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="flex justify-end pt-2 border-t border-[#dcd5c9]/60">
        <Button
          onClick={handleSave}
          disabled={isSaving}
          className="rounded-full bg-[#16181d] hover:bg-[#2a2d35] text-[#f5f2ec] font-geist text-xs font-medium h-10 px-6 shadow-sm"
        >
          {isSaving ? "Encrypting & Storing..." : "Save Credentials"}
        </Button>
      </div>
    </div>
  )
}

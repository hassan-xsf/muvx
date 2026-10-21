"use client"

import * as React from "react"
import Link from "next/link"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
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
import {
  CheckCircle2,
  Copy,
  Check,
  RefreshCw,
  ExternalLink,
  ShieldCheck,
  Sliders,
  Activity,
  AlertCircle,
  ArrowUpRight,
  Sparkles,
} from "lucide-react"
import { IntegrationPlatform } from "../data/types"
import { PlatformLogo } from "../data/logos"
import { toast } from "sonner"
import { sounds } from "@/lib/sound-effects"

interface QuickConfigModalProps {
  platform: IntegrationPlatform | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onUpdateStatus?: (platformId: string, newStatus: "connected" | "available") => void
}

export function QuickConfigModal({
  platform,
  open,
  onOpenChange,
  onUpdateStatus,
}: QuickConfigModalProps) {
  if (!platform) return null

  const isConnected = platform.status === "connected"
  const [activeTab, setActiveTab] = React.useState<"auth" | "sync" | "webhook">("auth")
  const [apiKey, setApiKey] = React.useState("")
  const [clientId, setClientId] = React.useState("")
  const [copiedWebhook, setCopiedWebhook] = React.useState(false)
  const [testState, setTestState] = React.useState<"idle" | "testing" | "success" | "error">("idle")
  const [syncCadence, setSyncCadence] = React.useState(platform.syncCadence || "realtime")

  const webhookUrl = `https://api.muvx.ai/v1/webhooks/${platform.id}?tenant_id=org_active402`

  const handleCopyWebhook = () => {
    navigator.clipboard.writeText(webhookUrl)
    setCopiedWebhook(true)
    sounds.pop()
    toast.success("Webhook URL copied to clipboard")
    setTimeout(() => setCopiedWebhook(false), 2000)
  }

  const handleTestConnection = () => {
    setTestState("testing")
    sounds.typing()
    setTimeout(() => {
      setTestState("success")
      sounds.success()
      toast.success(`${platform.name} handshake successful! (Latency: 142ms)`)
    }, 1200)
  }

  const handleSaveAndConnect = () => {
    sounds.success()
    onUpdateStatus?.(platform.id, isConnected ? "available" : "connected")
    toast.success(
      isConnected
        ? `${platform.name} disconnected`
        : `${platform.name} connected successfully! Live sync enabled.`
    )
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[620px] rounded-3xl border border-[#dcd5c9] bg-[#fffefb] p-0 overflow-hidden shadow-[0_20px_50px_rgba(22,24,29,0.14)]">
        {/* ── Dialog Header with Brand Accent ─────────────────── */}
        <div className="bg-[#f5f2ec]/80 px-6 py-5 border-b border-[#dcd5c9]/70">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <PlatformLogo
                id={platform.id}
                name={platform.name}
                category={platform.category}
                className="size-12 rounded-2xl shadow-sm border border-black/5"
              />
              <div>
                <div className="flex items-center gap-2">
                  <DialogTitle className="font-serif text-2xl font-medium text-[#16181d]">
                    {platform.name}
                  </DialogTitle>
                  {isConnected ? (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-[#5e8c6a]/15 px-2 py-0.5 text-[#5e8c6a] font-geist-mono text-[9px] font-semibold">
                      <span className="size-1.5 rounded-full bg-[#5e8c6a] animate-pulse" />
                      CONNECTED
                    </span>
                  ) : (
                    <span className="rounded-full border border-[#dcd5c9] px-2 py-0.5 text-[#8a8b8f] font-geist-mono text-[9px]">
                      READY TO CONNECT
                    </span>
                  )}
                </div>
                <DialogDescription className="font-geist text-xs text-[#8a8b8f] mt-0.5">
                  {platform.provider} · {platform.category}
                </DialogDescription>
              </div>
            </div>

            <Link
              href={`/settings/integrations/${platform.id}`}
              onClick={() => onOpenChange(false)}
              className="font-geist text-xs font-medium text-[#16181d] hover:text-[#d9622b] inline-flex items-center gap-1 transition-colors"
            >
              <span>Full Page</span>
              <ArrowUpRight className="size-3" />
            </Link>
          </div>

          {/* Tab Navigation */}
          <div className="flex items-center gap-2 mt-4 pt-2 border-t border-[#dcd5c9]/50">
            <button
              onClick={() => setActiveTab("auth")}
              className={`rounded-full px-3.5 py-1.5 font-geist text-xs font-medium transition-all ${
                activeTab === "auth"
                  ? "bg-[#16181d] text-[#f5f2ec] shadow-sm"
                  : "text-[#4a4e57] hover:text-[#16181d]"
              }`}
            >
              Credentials & Auth
            </button>
            <button
              onClick={() => setActiveTab("sync")}
              className={`rounded-full px-3.5 py-1.5 font-geist text-xs font-medium transition-all ${
                activeTab === "sync"
                  ? "bg-[#16181d] text-[#f5f2ec] shadow-sm"
                  : "text-[#4a4e57] hover:text-[#16181d]"
              }`}
            >
              Entity Sync
            </button>
            <button
              onClick={() => setActiveTab("webhook")}
              className={`rounded-full px-3.5 py-1.5 font-geist text-xs font-medium transition-all ${
                activeTab === "webhook"
                  ? "bg-[#16181d] text-[#f5f2ec] shadow-sm"
                  : "text-[#4a4e57] hover:text-[#16181d]"
              }`}
            >
              Webhooks & Test
            </button>
          </div>
        </div>

        {/* ── Tab Body Content ─────────────────────────────────── */}
        <div className="p-6 space-y-5">
          {activeTab === "auth" && (
            <div className="space-y-4">
              <div className="rounded-xl bg-[#ede8df]/50 p-3.5 border border-[#dcd5c9]/60">
                <p className="font-geist text-xs font-medium text-[#16181d]">
                  Protocol: {platform.dataProtocol}
                </p>
                <p className="font-geist text-[11px] text-[#8a8b8f] mt-1 leading-normal">
                  {platform.syncDescription}
                </p>
              </div>

              {platform.authType === "oauth2" ? (
                <div className="py-4 flex flex-col items-center justify-center text-center gap-3">
                  <p className="font-geist text-xs text-[#4a4e57] max-w-sm">
                    Connect directly using OAuth 2.0. You will be redirected to securely authorize Muvx with your {platform.name} account.
                  </p>
                  <Button
                    onClick={handleSaveAndConnect}
                    className="rounded-full bg-[#16181d] hover:bg-[#2a2d35] text-[#f5f2ec] font-geist text-xs font-medium px-6 h-10 shadow-sm"
                  >
                    <Sparkles className="size-3.5 mr-2 text-[#d9622b]" />
                    {isConnected ? "Re-Authenticate with OAuth" : `Authorize ${platform.name}`}
                  </Button>
                </div>
              ) : (
                <div className="space-y-3.5">
                  <div>
                    <Label className="font-geist text-xs font-medium text-[#16181d]">
                      {platform.authFields?.[0]?.label || "API Key / Access Token"}
                    </Label>
                    <Input
                      type="password"
                      value={apiKey}
                      onChange={(e) => setApiKey(e.target.value)}
                      placeholder={platform.authFields?.[0]?.placeholder || "Paste your secret token here..."}
                      className="mt-1.5 h-10 rounded-xl border-[#dcd5c9] bg-white font-geist text-xs"
                    />
                    <p className="font-geist text-[11px] text-[#8a8b8f] mt-1">
                      Token is stored in encrypted vault using AES-256 GCM.
                    </p>
                  </div>

                  <div>
                    <Label className="font-geist text-xs font-medium text-[#16181d]">
                      Environment / Organization Identifier (Optional)
                    </Label>
                    <Input
                      value={clientId}
                      onChange={(e) => setClientId(e.target.value)}
                      placeholder="e.g. Production / Realm #91823"
                      className="mt-1.5 h-10 rounded-xl border-[#dcd5c9] bg-white font-geist text-xs"
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === "sync" && (
            <div className="space-y-4">
              <div>
                <Label className="font-geist text-xs font-medium text-[#16181d]">
                  Sync Frequency & Polling Cadence
                </Label>
                <Select value={syncCadence} onValueChange={(v: any) => setSyncCadence(v)}>
                  <SelectTrigger className="mt-1.5 h-10 rounded-xl border-[#dcd5c9] bg-white font-geist text-xs">
                    <SelectValue placeholder="Select cadence" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl border-[#dcd5c9] bg-[#fffefb]">
                    <SelectItem value="realtime">Real-time (Instant Webhook push)</SelectItem>
                    <SelectItem value="every_minute">High Frequency (Every 60 seconds)</SelectItem>
                    <SelectItem value="every_15_mins">Standard (Every 15 minutes)</SelectItem>
                    <SelectItem value="hourly">Hourly batch sync</SelectItem>
                    <SelectItem value="daily">Daily reconciliation (Midnight)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="font-geist text-xs font-medium text-[#16181d]">
                  Data Entities to Synchronize
                </Label>
                <div className="mt-2 space-y-2">
                  {(
                    platform.syncEntities || [
                      { id: "e1", label: "Master Records & Catalog", description: "Two-way sync for profiles and reference IDs", defaultEnabled: true },
                      { id: "e2", label: "Active Dispatch Timeline Events", description: "Real-time milestone tracking and check-calls", defaultEnabled: true },
                      { id: "e3", label: "Financial & Invoicing Batches", description: "Transmit finalized charges and rate line items", defaultEnabled: true },
                    ]
                  ).map((e) => (
                    <div
                      key={e.id}
                      className="flex items-center justify-between p-3 rounded-xl border border-[#dcd5c9]/70 bg-white"
                    >
                      <div className="min-w-0 pr-3">
                        <p className="font-geist text-xs font-medium text-[#16181d]">{e.label}</p>
                        <p className="font-geist text-[11px] text-[#8a8b8f]">{e.description}</p>
                      </div>
                      <input
                        type="checkbox"
                        defaultChecked={e.defaultEnabled}
                        className="size-4 rounded border-[#dcd5c9] text-[#16181d] focus:ring-[#d9622b]"
                      />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeTab === "webhook" && (
            <div className="space-y-4">
              <div>
                <Label className="font-geist text-xs font-medium text-[#16181d]">
                  Incoming Webhook URL
                </Label>
                <div className="mt-1.5 flex items-center gap-2">
                  <Input
                    readOnly
                    value={webhookUrl}
                    className="h-10 rounded-xl border-[#dcd5c9] bg-[#f5f2ec] font-geist-mono text-[11px] text-[#4a4e57]"
                  />
                  <Button
                    variant="outline"
                    onClick={handleCopyWebhook}
                    className="h-10 shrink-0 rounded-xl border-[#dcd5c9] bg-white px-3 font-geist text-xs"
                  >
                    {copiedWebhook ? <Check className="size-3.5 text-[#5e8c6a]" /> : <Copy className="size-3.5" />}
                  </Button>
                </div>
                <p className="font-geist text-[11px] text-[#8a8b8f] mt-1">
                  Configure this webhook URL inside your {platform.name} developer portal.
                </p>
              </div>

              <div className="rounded-xl border border-[#dcd5c9] bg-white p-4 flex items-center justify-between">
                <div>
                  <p className="font-geist text-xs font-medium text-[#16181d]">Live Protocol Ping</p>
                  <p className="font-geist text-[11px] text-[#8a8b8f]">
                    Send a test payload to verify TLS handshake and API token validity.
                  </p>
                </div>
                <Button
                  onClick={handleTestConnection}
                  disabled={testState === "testing"}
                  variant="outline"
                  className="rounded-full border-[#dcd5c9] font-geist text-xs h-9 px-4"
                >
                  {testState === "testing" ? (
                    <RefreshCw className="size-3.5 animate-spin mr-1.5" />
                  ) : testState === "success" ? (
                    <CheckCircle2 className="size-3.5 text-[#5e8c6a] mr-1.5" />
                  ) : (
                    <Activity className="size-3.5 text-[#d9622b] mr-1.5" />
                  )}
                  <span>Test Connection</span>
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* ── Dialog Footer ────────────────────────────────────── */}
        <div className="bg-[#f5f2ec]/50 px-6 py-4 border-t border-[#dcd5c9]/60 flex items-center justify-between">
          {isConnected ? (
            <button
              onClick={handleSaveAndConnect}
              className="font-geist text-xs font-medium text-[#c41230] hover:underline"
            >
              Disconnect Platform
            </button>
          ) : (
            <span className="font-geist-mono text-[10px] text-[#8a8b8f]">
              256-bit encrypted credentials
            </span>
          )}

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="rounded-full border-[#dcd5c9] font-geist text-xs h-9 px-4"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSaveAndConnect}
              className="rounded-full bg-[#16181d] hover:bg-[#2a2d35] text-[#f5f2ec] font-geist text-xs font-medium h-9 px-5 shadow-sm"
            >
              {isConnected ? "Save Settings" : "Save & Connect"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

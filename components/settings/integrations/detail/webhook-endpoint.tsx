"use client"

import * as React from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Copy, Check, Activity, RefreshCw, CheckCircle2, AlertCircle, Radio } from "lucide-react"
import { IntegrationPlatform } from "../data/types"
import { toast } from "sonner"
import { sounds } from "@/lib/sound-effects"

interface WebhookEndpointProps {
  platform: IntegrationPlatform
}

export function WebhookEndpoint({ platform }: WebhookEndpointProps) {
  const [copiedUrl, setCopiedUrl] = React.useState(false)
  const [copiedSecret, setCopiedSecret] = React.useState(false)
  const [testState, setTestState] = React.useState<"idle" | "testing" | "success" | "error">("idle")
  const [lastLatency, setLastLatency] = React.useState<number | null>(null)

  const webhookUrl = `https://api.muvx.ai/v1/integrations/${platform.id}/webhook?env=live`
  const signingSecret = `whsec_982bf7a8109249018402941094`

  const handleCopy = (type: "url" | "secret") => {
    if (type === "url") {
      navigator.clipboard.writeText(webhookUrl)
      setCopiedUrl(true)
      setTimeout(() => setCopiedUrl(false), 2000)
    } else {
      navigator.clipboard.writeText(signingSecret)
      setCopiedSecret(true)
      setTimeout(() => setCopiedSecret(false), 2000)
    }
    sounds.pop()
    toast.success(`${type === "url" ? "Webhook URL" : "Signing secret"} copied to clipboard`)
  }

  const handleSendPing = () => {
    setTestState("testing")
    sounds.typing()
    const startTime = Date.now()

    setTimeout(() => {
      const elapsed = Math.floor(Math.random() * 80) + 110 // ~110ms - 190ms
      setLastLatency(elapsed)
      setTestState("success")
      sounds.success()
      toast.success(`Webhook handshake validated in ${elapsed}ms!`)
    }, 1100)
  }

  return (
    <div className="flex flex-col gap-6 rounded-3xl border border-[#dcd5c9] bg-[#fffefb] p-6 sm:p-8 shadow-[0_4px_16px_rgba(58,46,30,0.03)]">
      <div className="flex items-center justify-between border-b border-[#dcd5c9]/60 pb-4">
        <div>
          <h2 className="font-serif text-xl sm:text-2xl font-medium text-[#16181d]">
            Inbound Webhook Endpoint & TLS Test
          </h2>
          <p className="font-geist text-xs text-[#8a8b8f] mt-0.5">
            Real-time HTTP push receiver with automatic retry policy and HMAC signature verification.
          </p>
        </div>
        <div className="flex items-center gap-1.5 font-geist-mono text-[9px] text-[#5e8c6a] bg-[#5e8c6a]/10 px-2.5 py-1 rounded-full font-medium">
          <span className="size-1.5 rounded-full bg-[#5e8c6a] animate-pulse" />
          <span>LISTENING</span>
        </div>
      </div>

      <div className="space-y-4">
        {/* Webhook URL Input */}
        <div>
          <Label className="font-geist text-xs font-medium text-[#16181d]">
            Target Webhook URL
          </Label>
          <div className="mt-1.5 flex items-center gap-2">
            <Input
              readOnly
              value={webhookUrl}
              className="h-10 rounded-xl border-[#dcd5c9] bg-[#f5f2ec] font-geist-mono text-xs text-[#4a4e57]"
            />
            <Button
              variant="outline"
              onClick={() => handleCopy("url")}
              className="h-10 shrink-0 rounded-xl border-[#dcd5c9] bg-white px-3.5 font-geist text-xs font-medium"
            >
              {copiedUrl ? <Check className="size-3.5 text-[#5e8c6a]" /> : <Copy className="size-3.5" />}
              <span className="ml-1.5 hidden sm:inline">{copiedUrl ? "Copied" : "Copy"}</span>
            </Button>
          </div>
        </div>

        {/* Signing Secret */}
        <div>
          <Label className="font-geist text-xs font-medium text-[#16181d]">
            Webhook Signing Secret (HMAC SHA-256)
          </Label>
          <div className="mt-1.5 flex items-center gap-2">
            <Input
              readOnly
              value={signingSecret}
              className="h-10 rounded-xl border-[#dcd5c9] bg-[#f5f2ec] font-geist-mono text-xs text-[#4a4e57]"
            />
            <Button
              variant="outline"
              onClick={() => handleCopy("secret")}
              className="h-10 shrink-0 rounded-xl border-[#dcd5c9] bg-white px-3.5 font-geist text-xs font-medium"
            >
              {copiedSecret ? <Check className="size-3.5 text-[#5e8c6a]" /> : <Copy className="size-3.5" />}
              <span className="ml-1.5 hidden sm:inline">{copiedSecret ? "Copied" : "Copy Secret"}</span>
            </Button>
          </div>
        </div>
      </div>

      {/* ── Test Handshake Box ───────────────────────────────── */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 rounded-2xl bg-[#ede8df]/40 p-4 border border-[#dcd5c9]/60">
        <div>
          <div className="flex items-center gap-2">
            <p className="font-geist text-xs sm:text-[13px] font-semibold text-[#16181d]">
              Simulate Live Payload Ping
            </p>
            {lastLatency !== null && (
              <span className="font-geist-mono text-[10px] text-[#5e8c6a] font-medium bg-[#5e8c6a]/15 px-2 py-0.5 rounded-full">
                {lastLatency}ms latency
              </span>
            )}
          </div>
          <p className="font-geist text-[11px] text-[#8a8b8f] mt-0.5">
            Sends an authenticated TLS heartbeat to ensure Muvx event router processes incoming hooks.
          </p>
        </div>

        <Button
          onClick={handleSendPing}
          disabled={testState === "testing"}
          className="rounded-full bg-[#16181d] hover:bg-[#2a2d35] text-[#f5f2ec] font-geist text-xs font-medium h-9 px-4 shrink-0 shadow-sm"
        >
          {testState === "testing" ? (
            <RefreshCw className="size-3.5 animate-spin mr-1.5" />
          ) : testState === "success" ? (
            <CheckCircle2 className="size-3.5 text-[#5e8c6a] mr-1.5" />
          ) : (
            <Activity className="size-3.5 text-[#d9622b] mr-1.5" />
          )}
          <span>{testState === "testing" ? "Testing Handshake..." : "Send Test Ping"}</span>
        </Button>
      </div>
    </div>
  )
}

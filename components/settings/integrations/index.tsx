"use client"

import * as React from "react"
import Link from "next/link"
import { PLATFORMS_CATALOG } from "./data/platforms-catalog"
import { IntegrationCategory, IntegrationPlatform } from "./data/types"
import { HubHeader } from "./catalog/hub-header"
import { SupplyChainMesh } from "./catalog/supply-chain-mesh"
import { CategoryTabs } from "./catalog/category-tabs"
import { IntegrationCard } from "./catalog/integration-card"
import { QuickConfigModal } from "./catalog/quick-config-modal"
import { SearchX, RotateCcw, ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"

const STORAGE_KEY = "muvx_connected_platforms_v2"

export function IntegrationsHubClient() {
  const [platforms, setPlatforms] = React.useState<IntegrationPlatform[]>(PLATFORMS_CATALOG)
  const [selectedCategory, setSelectedCategory] = React.useState<IntegrationCategory>("All")
  const [statusFilter, setStatusFilter] = React.useState<"all" | "connected" | "available">("all")
  const [searchQuery, setSearchQuery] = React.useState("")
  const [selectedPlatform, setSelectedPlatform] = React.useState<IntegrationPlatform | null>(null)
  const [modalOpen, setModalOpen] = React.useState(false)
  const [hasHydrated, setHasHydrated] = React.useState(false)

  // ── Sync with localStorage on client mount ─────────────────────
  React.useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) {
        const connectedIds: string[] = JSON.parse(stored)
        if (Array.isArray(connectedIds) && connectedIds.length > 0) {
          const idSet = new Set(connectedIds)
          setPlatforms((prev) =>
            prev.map((p) =>
              idSet.has(p.id)
                ? {
                    ...p,
                    status: "connected",
                    connectedAt: "Active tenant connection",
                    lastSync: "Streaming live",
                  }
                : p
            )
          )
        }
      }
    } catch (e) {
      console.warn("Could not read connected platforms from localStorage:", e)
    } finally {
      setHasHydrated(true)
    }
  }, [])

  // ── Compute honest counts ─────────────────────────────────────
  const connectedCount = platforms.filter((p) => p.status === "connected").length
  const availableCount = platforms.filter((p) => p.status !== "connected").length

  // Category platform counts
  const categoryCounts = React.useMemo(() => {
    const counts: Record<string, number> = {}
    platforms.forEach((p) => {
      counts[p.category] = (counts[p.category] || 0) + 1
    })
    return counts
  }, [platforms])

  // Filtered platforms
  const filteredPlatforms = React.useMemo(() => {
    return platforms.filter((p) => {
      // Category match
      if (selectedCategory !== "All" && p.category !== selectedCategory) {
        return false
      }
      // Status match
      if (statusFilter === "connected" && p.status !== "connected") {
        return false
      }
      if (statusFilter === "available" && p.status === "connected") {
        return false
      }
      // Search match
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase()
        const matchesName = p.name.toLowerCase().includes(q)
        const matchesProvider = p.provider.toLowerCase().includes(q)
        const matchesProtocol = p.dataProtocol.toLowerCase().includes(q)
        const matchesDesc = (p.description + " " + p.tagline).toLowerCase().includes(q)
        if (!matchesName && !matchesProvider && !matchesProtocol && !matchesDesc) {
          return false
        }
      }
      return true
    })
  }, [platforms, selectedCategory, statusFilter, searchQuery])

  const handleOpenConfig = (p: IntegrationPlatform) => {
    setSelectedPlatform(p)
    setModalOpen(true)
  }

  const handleUpdateStatus = (platformId: string, newStatus: "connected" | "available") => {
    setPlatforms((prev) => {
      const updated = prev.map((p) => {
        if (p.id === platformId) {
          return {
            ...p,
            status: newStatus,
            connectedAt: newStatus === "connected" ? "Today, just now" : undefined,
            lastSync: newStatus === "connected" ? "Streaming live" : undefined,
          }
        }
        return p
      })

      // Persist connected IDs to localStorage
      try {
        const connectedIds = updated.filter((p) => p.status === "connected").map((p) => p.id)
        localStorage.setItem(STORAGE_KEY, JSON.stringify(connectedIds))
      } catch (e) {
        console.warn("Failed to write to localStorage:", e)
      }

      return updated
    })
  }

  const handleResetAllConnections = () => {
    try {
      localStorage.removeItem(STORAGE_KEY)
    } catch {}
    setPlatforms(PLATFORMS_CATALOG)
    toast.info("All demo connections reset to standby.")
  }

  return (
    <div className="px-4 sm:px-6 lg:px-10 py-6 max-w-7xl mx-auto w-full flex flex-col gap-8 sm:gap-10 pb-24">
      {/* ── Breadcrumb Back Link ─────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <Link
          href="/settings"
          className="inline-flex items-center gap-1.5 font-geist text-xs text-[#8a8b8f] hover:text-[#16181d] transition-colors"
        >
          <ArrowLeft className="size-3.5" />
          <span>Back to Settings</span>
        </Link>

        <div className="hidden sm:flex items-center gap-2 font-geist-mono text-[11px] text-[#8a8b8f]">
          <span className="size-1.5 rounded-full bg-[#5e8c6a]" />
          <span>TENANT VAULT ENCRYPTED · TLS 1.3</span>
        </div>
      </div>

      {/* ── 1. Editorial Metrics Banner ──────────────────────────── */}
      <HubHeader
        connectedCount={connectedCount}
        totalCount={platforms.length}
        onRequestIntegration={() => {
          toast.info("Platform request submitted to integrations@muvx.ai. Our team will review within 24h.")
        }}
      />

      {/* ── 2. Autonomous Supply Chain Mesh Visualizer ───────────── */}
      <SupplyChainMesh
        platforms={platforms}
        selectedCategory={selectedCategory}
        onSelectCategory={(cat) => {
          setSelectedCategory(cat)
          // Smooth scroll towards the catalog grid
          const el = document.getElementById("platforms-grid-anchor")
          if (el) {
            el.scrollIntoView({ behavior: "smooth" })
          }
        }}
      />

      {/* ── 3. Search & Filter Controls ──────────────────────────── */}
      <div id="platforms-grid-anchor" className="scroll-mt-8">
        <CategoryTabs
          selectedCategory={selectedCategory}
          onSelectCategory={setSelectedCategory}
          statusFilter={statusFilter}
          onSelectStatus={setStatusFilter}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          categoryCounts={categoryCounts}
          connectedCount={connectedCount}
          availableCount={availableCount}
        />
      </div>

      {/* ── 4. Integrations Grid ─────────────────────────────────── */}
      {filteredPlatforms.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {filteredPlatforms.map((platform) => (
            <IntegrationCard
              key={platform.id}
              platform={platform}
              onQuickConfigure={handleOpenConfig}
            />
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-20 text-center rounded-3xl border border-dashed border-[#dcd5c9] bg-[#fffefb] p-8">
          <SearchX className="size-10 text-[#8a8b8f] mb-3" />
          <h3 className="font-serif text-2xl text-[#16181d]">No Integrations Found</h3>
          <p className="mt-1 font-geist text-xs sm:text-sm text-[#8a8b8f] max-w-md">
            No platforms match your active filter criteria for "{searchQuery || selectedCategory}".
          </p>
          <div className="mt-5 flex gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setSearchQuery("")
                setSelectedCategory("All")
                setStatusFilter("all")
              }}
              className="rounded-full border-[#dcd5c9] text-xs h-9 px-4 cursor-pointer"
            >
              Reset Filters
            </Button>
            <Button
              onClick={() => {
                toast.info("Our team adds new freight connectors every week. Submit a request to integrations@muvx.ai")
              }}
              className="rounded-full bg-[#16181d] text-[#f5f2ec] text-xs h-9 px-4 cursor-pointer"
            >
              Request Connector
            </Button>
          </div>
        </div>
      )}

      {/* ── Optional Reset Connection helper for testing ──────── */}
      {connectedCount > 0 && (
        <div className="flex items-center justify-end pt-2">
          <button
            type="button"
            onClick={handleResetAllConnections}
            className="inline-flex items-center gap-1.5 font-geist-mono text-[11px] text-[#8a8b8f] hover:text-[#d9622b] transition-colors cursor-pointer"
          >
            <RotateCcw className="size-3" />
            <span>Reset all connections to standby</span>
          </button>
        </div>
      )}

      {/* ── Quick Configuration Slide-Over Modal ──────────────── */}
      <QuickConfigModal
        platform={selectedPlatform}
        open={modalOpen}
        onOpenChange={setModalOpen}
        onUpdateStatus={handleUpdateStatus}
      />
    </div>
  )
}

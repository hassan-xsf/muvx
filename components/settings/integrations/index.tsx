"use client"

import * as React from "react"
import { PLATFORMS_CATALOG } from "./data/platforms-catalog"
import { IntegrationCategory, IntegrationPlatform } from "./data/types"
import { HubHeader } from "./catalog/hub-header"
import { CategoryTabs } from "./catalog/category-tabs"
import { IntegrationCard } from "./catalog/integration-card"
import { QuickConfigModal } from "./catalog/quick-config-modal"
import { Sparkles, SearchX, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"

export function IntegrationsHubClient() {
  const [platforms, setPlatforms] = React.useState<IntegrationPlatform[]>(PLATFORMS_CATALOG)
  const [selectedCategory, setSelectedCategory] = React.useState<IntegrationCategory>("All")
  const [statusFilter, setStatusFilter] = React.useState<"all" | "connected" | "available">("all")
  const [searchQuery, setSearchQuery] = React.useState("")
  const [selectedPlatform, setSelectedPlatform] = React.useState<IntegrationPlatform | null>(null)
  const [modalOpen, setModalOpen] = React.useState(false)

  // Compute stats
  const connectedCount = platforms.filter((p) => p.status === "connected").length
  const availableCount = platforms.filter((p) => p.status !== "connected").length

  // Category counts
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
    setPlatforms((prev) =>
      prev.map((p) => (p.id === platformId ? { ...p, status: newStatus } : p))
    )
  }

  return (
    <div className="flex flex-col gap-8 pb-16">
      {/* ── Editorial Metrics Banner ──────────────────────────── */}
      <HubHeader
        connectedCount={connectedCount}
        totalCount={platforms.length}
        onRequestIntegration={() => {
          toast.info("Request integration modal opened. Submit platform specs to support@muvx.ai")
        }}
      />

      {/* ── Search & Filter Controls ──────────────────────────── */}
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

      {/* ── Integrations Grid ─────────────────────────────────── */}
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
          <div className="mt-4 flex gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setSearchQuery("")
                setSelectedCategory("All")
                setStatusFilter("all")
              }}
              className="rounded-full border-[#dcd5c9] text-xs h-9 px-4"
            >
              Reset Filters
            </Button>
            <Button
              onClick={() => {
                toast.info("Our team adds new freight connectors every week. Submit a request to integrations@muvx.ai")
              }}
              className="rounded-full bg-[#16181d] text-[#f5f2ec] text-xs h-9 px-4"
            >
              Request "{searchQuery}" Connector
            </Button>
          </div>
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

"use client"

import * as React from "react"
import { Search, X, CheckCircle2, Layers, Filter } from "lucide-react"
import { IntegrationCategory } from "../data/types"

const CATEGORIES: IntegrationCategory[] = [
  "All",
  "ELD & Telematics",
  "Load Boards & Capacity",
  "Accounting & ERP",
  "Factoring & Payments",
  "Visibility & Tracking",
  "Fuel Cards & Tolls",
  "Routing, Mileage & Tolls",
  "Safety & Compliance",
  "EDI & Automation",
  "Customs & Documents",
]

interface CategoryTabsProps {
  selectedCategory: IntegrationCategory
  onSelectCategory: (cat: IntegrationCategory) => void
  statusFilter: "all" | "connected" | "available"
  onSelectStatus: (status: "all" | "connected" | "available") => void
  searchQuery: string
  onSearchChange: (q: string) => void
  categoryCounts: Record<string, number>
  connectedCount: number
  availableCount: number
}

export function CategoryTabs({
  selectedCategory,
  onSelectCategory,
  statusFilter,
  onSelectStatus,
  searchQuery,
  onSearchChange,
  categoryCounts,
  connectedCount,
  availableCount,
}: CategoryTabsProps) {
  const totalPlatforms = connectedCount + availableCount

  return (
    <div className="flex flex-col gap-4">
      {/* ── Search Bar & Status Segmented Pills ───────────────── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {/* Search Input with warm cream/white styling */}
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-[#8a8b8f]" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search by platform name, protocol, or provider (e.g. Samsara, DAT, QBO)..."
            className="w-full h-10 pl-10 pr-9 rounded-full border border-[#dcd5c9] bg-[#fffefb] font-geist text-xs sm:text-[13px] text-[#16181d] placeholder:text-[#8a8b8f] focus:outline-none focus:ring-2 focus:ring-[#d9622b]/25 focus:border-[#d9622b] transition-all shadow-sm"
          />
          {searchQuery && (
            <button
              onClick={() => onSearchChange("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[#8a8b8f] hover:text-[#16181d] p-0.5 rounded-full cursor-pointer"
            >
              <X className="size-3.5" />
            </button>
          )}
        </div>

        {/* Status segmented pill filter */}
        <div className="flex shrink-0 items-center gap-1 rounded-full bg-[#ede8df] p-1 border border-[#dcd5c9]/60 self-start sm:self-center">
          <button
            onClick={() => onSelectStatus("all")}
            className={`rounded-full px-3.5 py-1.5 font-geist text-xs font-medium transition-all cursor-pointer ${
              statusFilter === "all"
                ? "bg-[#16181d] text-[#f5f2ec] shadow-sm"
                : "text-[#4a4e57] hover:text-[#16181d]"
            }`}
          >
            All ({totalPlatforms})
          </button>
          <button
            onClick={() => onSelectStatus("connected")}
            className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 font-geist text-xs font-medium transition-all cursor-pointer ${
              statusFilter === "connected"
                ? "bg-[#16181d] text-[#f5f2ec] shadow-sm"
                : "text-[#4a4e57] hover:text-[#16181d]"
            }`}
          >
            <span
              className={`size-1.5 rounded-full ${
                connectedCount > 0 ? "bg-[#5e8c6a] animate-pulse" : "bg-[#8a8b8f]"
              }`}
            />
            <span>Connected</span>
            <span className="font-geist-mono text-[10px] opacity-75">({connectedCount})</span>
          </button>
          <button
            onClick={() => onSelectStatus("available")}
            className={`rounded-full px-3.5 py-1.5 font-geist text-xs font-medium transition-all cursor-pointer ${
              statusFilter === "available"
                ? "bg-[#16181d] text-[#f5f2ec] shadow-sm"
                : "text-[#4a4e57] hover:text-[#16181d]"
            }`}
          >
            <span>Available</span>
            <span className="font-geist-mono text-[10px] opacity-75">({availableCount})</span>
          </button>
        </div>
      </div>

      {/* ── Category Horizontal Tabs (matching EmailToLoad / Landing tabs) ── */}
      <div className="flex gap-2 overflow-x-auto pb-1.5 pt-0.5 scrollbar-none">
        {CATEGORIES.map((cat) => {
          const isSelected = selectedCategory === cat
          const count =
            cat === "All"
              ? Object.values(categoryCounts).reduce((a, b) => a + b, 0)
              : categoryCounts[cat] || 0

          return (
            <button
              key={cat}
              onClick={() => onSelectCategory(cat)}
              className={`shrink-0 inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 font-geist text-xs sm:text-[13px] font-medium whitespace-nowrap transition-all cursor-pointer ${
                isSelected
                  ? "bg-[#16181d] text-[#f5f2ec] shadow-sm"
                  : "border border-[#dcd5c9] bg-[#fffefb] text-[#4a4e57] hover:bg-[#ede8df] hover:text-[#16181d]"
              }`}
            >
              <span>{cat}</span>
              <span
                className={`rounded-full px-1.5 py-0.5 font-geist-mono text-[10px] font-medium tracking-tight ${
                  isSelected ? "bg-white/20 text-[#f5f2ec]" : "bg-[#ede8df] text-[#6f6b63]"
                }`}
              >
                {count}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

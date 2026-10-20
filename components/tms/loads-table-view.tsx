"use client"

import * as React from "react"
import Link from "next/link"
import {
  Search,
  Truck,
  ArrowUpRight,
  Star,
  MapPin,
  Clock,
  CheckCircle2,
  DollarSign,
} from "lucide-react"
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Input } from "@/components/ui/input"
import { Card } from "@/components/ui/card"
import { StatusBadge } from "@/components/status-badge"

export interface LoadRecord {
  id: string
  loadNumber: string
  customerName?: string | null
  originCity?: string | null
  originState?: string | null
  destCity?: string | null
  destState?: string | null
  status: string
  rate?: string | null
  finalRate?: string | null
  isStarred?: boolean | null
  commodity?: string | null
  createdAt?: Date | string | null
}

interface LoadsTableViewProps {
  loads: LoadRecord[]
}

export function LoadsTableView({ loads }: LoadsTableViewProps) {
  const [activeTab, setActiveTab] = React.useState<"all" | "active" | "available" | "delivered">("all")
  const [searchQuery, setSearchQuery] = React.useState("")

  const activeCount = React.useMemo(() => {
    return loads.filter((l) => l.status === "dispatched" || l.status === "in_transit").length
  }, [loads])

  const availableCount = React.useMemo(() => {
    return loads.filter((l) => l.status === "available" || l.status === "booked").length
  }, [loads])

  const deliveredCount = React.useMemo(() => {
    return loads.filter((l) => l.status === "delivered" || l.status === "completed").length
  }, [loads])

  const filteredLoads = React.useMemo(() => {
    return loads.filter((l) => {
      // Tab filter
      if (activeTab === "active" && l.status !== "dispatched" && l.status !== "in_transit") {
        return false
      }
      if (activeTab === "available" && l.status !== "available" && l.status !== "booked") {
        return false
      }
      if (activeTab === "delivered" && l.status !== "delivered" && l.status !== "completed") {
        return false
      }

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim()
        const matchNumber = l.loadNumber.toLowerCase().includes(q)
        const matchCustomer = (l.customerName || "").toLowerCase().includes(q)
        const matchOrigin = `${l.originCity || ""} ${l.originState || ""}`.toLowerCase().includes(q)
        const matchDest = `${l.destCity || ""} ${l.destState || ""}`.toLowerCase().includes(q)
        const matchCommodity = (l.commodity || "").toLowerCase().includes(q)

        return matchNumber || matchCustomer || matchOrigin || matchDest || matchCommodity
      }

      return true
    })
  }, [loads, activeTab, searchQuery])

  return (
    <div className="space-y-4">
      {/* ─── Tabs & Search Filter ─── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <Tabs
          value={activeTab}
          onValueChange={(v) => setActiveTab(v as "all" | "active" | "available" | "delivered")}
          className="w-full sm:w-auto"
        >
          <TabsList className="bg-[#f2eee6] dark:bg-zinc-900 border border-[#e4ddd3] dark:border-zinc-800 p-0.5 h-8.5 rounded-lg">
            <TabsTrigger
              value="all"
              className="text-xs px-3 data-[state=active]:bg-[#fdfbf7] dark:data-[state=active]:bg-zinc-950 data-[state=active]:text-[#16181d] dark:data-[state=active]:text-zinc-100 rounded-md gap-1.5 transition-all"
            >
              All Loads
              <span className="font-mono text-[10px] text-[#8a8b8f] px-1 bg-black/5 dark:bg-white/10 rounded-full">
                {loads.length}
              </span>
            </TabsTrigger>
            <TabsTrigger
              value="active"
              className="text-xs px-3 data-[state=active]:bg-[#fdfbf7] dark:data-[state=active]:bg-zinc-950 data-[state=active]:text-[#16181d] dark:data-[state=active]:text-zinc-100 rounded-md gap-1.5 transition-all"
            >
              Rolling / In Transit
              <span className="font-mono text-[10px] text-blue-600 font-semibold px-1 bg-blue-50 dark:bg-blue-950/40 rounded-full">
                {activeCount}
              </span>
            </TabsTrigger>
            <TabsTrigger
              value="available"
              className="text-xs px-3 data-[state=active]:bg-[#fdfbf7] dark:data-[state=active]:bg-zinc-950 data-[state=active]:text-[#16181d] dark:data-[state=active]:text-zinc-100 rounded-md gap-1.5 transition-all"
            >
              Ready to Book
              <span className="font-mono text-[10px] text-[#d9622b] font-semibold px-1 bg-[#fff0e6] dark:bg-orange-950/40 rounded-full">
                {availableCount}
              </span>
            </TabsTrigger>
            <TabsTrigger
              value="delivered"
              className="text-xs px-3 data-[state=active]:bg-[#fdfbf7] dark:data-[state=active]:bg-zinc-950 data-[state=active]:text-[#16181d] dark:data-[state=active]:text-zinc-100 rounded-md gap-1.5 transition-all"
            >
              Delivered
              <span className="font-mono text-[10px] text-emerald-600 font-semibold px-1 bg-emerald-50 dark:bg-emerald-950/40 rounded-full">
                {deliveredCount}
              </span>
            </TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-[#8a8b8f]" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search load #, customer, lane..."
            className="h-8.5 pl-8.5 text-xs bg-[#fdfbf7] dark:bg-zinc-950 border-[#e4ddd3] dark:border-zinc-800 rounded-lg placeholder:text-[#8a8b8f]"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] font-mono text-[#8a8b8f] hover:text-[#16181d] dark:hover:text-zinc-100"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* ─── Shadcn Table ─── */}
      <Card className="border-[#e4ddd3] dark:border-zinc-800 bg-[#fdfbf7] dark:bg-zinc-950 overflow-hidden shadow-xs rounded-xl">
        <Table>
          <TableHeader className="bg-[#f7f3ec]/80 dark:bg-zinc-900/60 border-b border-[#e4ddd3] dark:border-zinc-800">
            <TableRow className="hover:bg-transparent border-[#e4ddd3] dark:border-zinc-800">
              <TableHead className="font-mono text-[10px] font-semibold uppercase tracking-wider text-[#8a8b8f] h-9 px-4">
                Load #
              </TableHead>
              <TableHead className="font-mono text-[10px] font-semibold uppercase tracking-wider text-[#8a8b8f] h-9 px-4">
                Customer / Shipper
              </TableHead>
              <TableHead className="font-mono text-[10px] font-semibold uppercase tracking-wider text-[#8a8b8f] h-9 px-4">
                Origin → Destination
              </TableHead>
              <TableHead className="font-mono text-[10px] font-semibold uppercase tracking-wider text-[#8a8b8f] h-9 px-4">
                Status
              </TableHead>
              <TableHead className="font-mono text-[10px] font-semibold uppercase tracking-wider text-[#8a8b8f] h-9 px-4 text-right">
                Freight Rate
              </TableHead>
              <TableHead className="w-10 px-3" />
            </TableRow>
          </TableHeader>
          <TableBody className="divide-y divide-[#e4ddd3] dark:divide-zinc-800/80">
            {filteredLoads.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="h-32 text-center text-xs text-[#8a8b8f]">
                  <div className="flex flex-col items-center justify-center gap-1.5">
                    <Truck className="size-5 text-[#8a8b8f]/60" />
                    <p className="font-medium text-[#16181d] dark:text-zinc-200">
                      No matching loads found
                    </p>
                    <p className="text-[11px] text-[#8a8b8f]">
                      {searchQuery
                        ? "Try clearing your search filters"
                        : "No freight runs currently in this status tab"}
                    </p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              filteredLoads.map((l) => (
                <TableRow
                  key={l.id}
                  className="hover:bg-[#f7f3ec]/60 dark:hover:bg-zinc-900/50 transition-colors border-[#e4ddd3] dark:border-zinc-800/80"
                >
                  {/* Load # */}
                  <TableCell className="px-4 py-3 font-mono text-xs font-semibold text-[#16181d] dark:text-zinc-100">
                    <div className="flex items-center gap-1.5">
                      {l.isStarred && (
                        <Star className="size-3 text-[#d9622b] fill-[#d9622b] shrink-0" />
                      )}
                      <Link
                        href={`/loads/${l.id}`}
                        className="text-[#d9622b] hover:underline inline-flex items-center gap-1"
                      >
                        {l.loadNumber}
                      </Link>
                    </div>
                  </TableCell>

                  {/* Customer / Shipper */}
                  <TableCell className="px-4 py-3 text-xs text-[#16181d] dark:text-zinc-100">
                    <div className="font-medium">{l.customerName || "—"}</div>
                    {l.commodity && (
                      <div className="text-[10px] text-[#8a8b8f]">{l.commodity}</div>
                    )}
                  </TableCell>

                  {/* Origin → Destination */}
                  <TableCell className="px-4 py-3 text-xs text-[#16181d] dark:text-zinc-200">
                    {l.originCity && l.destCity ? (
                      <span className="truncate max-w-[280px] inline-block">
                        {l.originCity}, {l.originState} <span className="text-[#8a8b8f]">→</span>{" "}
                        {l.destCity}, {l.destState}
                      </span>
                    ) : (
                      <span className="text-[#8a8b8f]">—</span>
                    )}
                  </TableCell>

                  {/* Status */}
                  <TableCell className="px-4 py-3">
                    <StatusBadge status={l.status} />
                  </TableCell>

                  {/* Freight Rate */}
                  <TableCell className="px-4 py-3 text-right font-mono text-xs font-semibold text-[#16181d] dark:text-zinc-100">
                    {l.finalRate || l.rate ? (
                      `$${Number(l.finalRate || l.rate).toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}`
                    ) : (
                      <span className="text-[#8a8b8f] font-normal">—</span>
                    )}
                  </TableCell>

                  {/* Actions: RC, BOL, Open details */}
                  <TableCell className="px-3 py-3 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <Link
                        href={`/loads/${l.id}/rate-con`}
                        title="Rate Confirmation"
                        className="px-2 py-0.5 rounded border border-[#d1ccc5] text-[10px] font-mono text-[#16181d] hover:bg-[#f7f3ec] dark:border-zinc-700 dark:text-zinc-300 transition-colors"
                      >
                        RC
                      </Link>
                      <Link
                        href={`/loads/${l.id}/bol`}
                        title="Bill of Lading"
                        className="px-2 py-0.5 rounded border border-[#d1ccc5] text-[10px] font-mono text-[#16181d] hover:bg-[#f7f3ec] dark:border-zinc-700 dark:text-zinc-300 transition-colors"
                      >
                        BOL
                      </Link>
                      <Link
                        href={`/loads/${l.id}`}
                        className="p-1 text-[#8a8b8f] hover:text-[#16181d] dark:hover:text-zinc-100 transition-colors inline-flex items-center"
                        title="View Load"
                      >
                        <ArrowUpRight className="size-3.5" />
                      </Link>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  )
}

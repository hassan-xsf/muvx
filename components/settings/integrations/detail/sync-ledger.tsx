"use client"

import * as React from "react"
import { CheckCircle2, AlertTriangle, XCircle, Clock, ChevronDown, ChevronUp, FileCode } from "lucide-react"
import { IntegrationPlatform, SyncAuditLog } from "../data/types"

interface SyncLedgerProps {
  platform: IntegrationPlatform
}

const DEFAULT_LOGS: SyncAuditLog[] = [
  {
    id: "log-1",
    timestamp: "10:48:12 AM",
    event: "Real-Time Telemetry Batch",
    status: "success",
    entity: "Fleet GPS & HOS",
    recordsCount: 28,
    latencyMs: 142,
    payloadSummary: '{"status":"200_OK","pushed_tractors":28,"geofences_hit":3,"clock_violations":0}',
  },
  {
    id: "log-2",
    timestamp: "10:32:05 AM",
    event: "Driver Inspection Sync (DVIR)",
    status: "success",
    entity: "Inspections",
    recordsCount: 8,
    latencyMs: 198,
    payloadSummary: '{"defects_found":0,"signed_by":["Driver #102","Driver #104"]}',
  },
  {
    id: "log-3",
    timestamp: "09:55:40 AM",
    event: "Lane Rate Index Reconcile",
    status: "success",
    entity: "Contract Rates",
    recordsCount: 142,
    latencyMs: 310,
    payloadSummary: '{"benchmark_drift":"+1.2%","active_corridors":["CHI-DAL","ATL-MIA"]}',
  },
  {
    id: "log-4",
    timestamp: "08:15:22 AM",
    event: "Automated Invoice Export",
    status: "success",
    entity: "Accounts Receivable",
    recordsCount: 14,
    latencyMs: 420,
    payloadSummary: '{"total_amount_usd":48920.00,"invoices_delivered":14,"errors":0}',
  },
]

export function SyncLedger({ platform }: SyncLedgerProps) {
  const [expandedId, setExpandedId] = React.useState<string | null>(null)
  const logs = platform.recentLogs && platform.recentLogs.length > 0 ? platform.recentLogs : DEFAULT_LOGS

  return (
    <div className="flex flex-col gap-5 rounded-3xl border border-[#dcd5c9] bg-[#e7e0d3]/60 p-6 sm:p-8 shadow-[0_4px_16px_rgba(58,46,30,0.03)]">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-[#dcd5c9] pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="size-2 rounded-full bg-[#5e8c6a]" />
            <h2 className="font-serif text-xl sm:text-2xl font-medium text-[#16181d]">
              The Sync Ledger · Live Audit Log
            </h2>
          </div>
          <p className="font-geist text-xs text-[#71757e] mt-0.5">
            Cryptographically verified audit trail of every payload, webhook trigger, and entity sync.
          </p>
        </div>

        <span className="font-geist-mono text-[10px] tracking-[0.04em] text-[#71757e]">
          LAST 24 HOURS · ZERO MISMATCHES
        </span>
      </div>

      {/* Log Entries */}
      <div className="divide-y divide-[#dcd5c9]">
        {logs.map((log) => {
          const isExpanded = expandedId === log.id
          return (
            <div key={log.id} className="py-3.5 first:pt-0 last:pb-0">
              <div
                onClick={() => setExpandedId(isExpanded ? null : log.id)}
                className="flex cursor-pointer items-start justify-between gap-3 group"
              >
                <div className="flex items-start gap-3 min-w-0">
                  <span className="shrink-0 font-geist-mono text-[10px] font-medium tracking-[0.04em] text-[#71757e] pt-0.5">
                    {log.timestamp}
                  </span>
                  <div className="min-w-0">
                    <p className="font-geist text-xs sm:text-[13px] font-medium text-[#16181d] group-hover:text-[#d9622b] transition-colors">
                      {log.event}
                    </p>
                    <p className="font-geist text-[11px] text-[#71757e] truncate">
                      Entity: {log.entity} · {log.recordsCount} items · {log.latencyMs}ms
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2.5 shrink-0">
                  <span className="rounded-full bg-[#5e8c6a]/15 text-[#5e8c6a] border border-[#5e8c6a]/30 px-2 py-0.5 font-geist-mono text-[9px] font-semibold">
                    SYNCED
                  </span>
                  {isExpanded ? (
                    <ChevronUp className="size-3.5 text-[#71757e]" />
                  ) : (
                    <ChevronDown className="size-3.5 text-[#71757e]" />
                  )}
                </div>
              </div>

              {/* Expanded JSON payload preview */}
              {isExpanded && (
                <div className="mt-2.5 rounded-xl bg-[#16181d] p-3 font-geist-mono text-[11px] text-[#86efac] overflow-x-auto">
                  <pre>{JSON.stringify(JSON.parse(log.payloadSummary || "{}"), null, 2)}</pre>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Footer Notice */}
      <div className="flex items-center gap-2 pt-2 border-t border-[#dcd5c9]">
        <span className="size-1.5 rounded-full bg-[#5e8c6a]" />
        <span className="font-geist-mono text-[10px] tracking-[0.04em] text-[#71757e]">
          AUDIT LOGS RETAINED FOR 90 DAYS · SOC-2 COMPLIANT
        </span>
      </div>
    </div>
  )
}

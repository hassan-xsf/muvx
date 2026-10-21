export type IntegrationCategory =
  | "All"
  | "ELD & Telematics"
  | "Load Boards & Capacity"
  | "Accounting & ERP"
  | "Factoring & Payments"
  | "Visibility & Tracking"
  | "Fuel Cards & Tolls"
  | "Routing, Mileage & Tolls"
  | "Safety & Compliance"
  | "EDI & Automation"
  | "Customs & Documents"

export type CategoryFilter = IntegrationCategory

export type AuthType = "oauth2" | "api_key" | "credential_pair" | "webhook_only" | "manual"

export type SyncStatus = "connected" | "available" | "syncing" | "error" | "paused"

export type SyncCadence = "realtime" | "every_minute" | "every_15_mins" | "hourly" | "daily"

export interface AuthFieldDef {
  key: string
  label: string
  placeholder: string
  type?: "text" | "password" | "select"
  description?: string
  options?: { label: string; value: string }[]
  defaultValue?: string
  required?: boolean
}

export interface SyncEntityOption {
  id: string
  label: string
  description: string
  defaultEnabled: boolean
}

export interface SyncAuditLog {
  id: string
  timestamp: string
  event: string
  status: "success" | "warning" | "error"
  entity: string
  recordsCount: number
  latencyMs: number
  payloadSummary: string
}

export interface IntegrationPlatform {
  id: string
  name: string
  tagline: string
  provider: string
  category: Exclude<IntegrationCategory, "All">
  description: string
  status: SyncStatus
  authType: AuthType
  dataProtocol: string
  syncDescription: string
  features: string[]
  docsUrl: string
  syncCadence: SyncCadence
  authFields?: AuthFieldDef[]
  syncEntities?: SyncEntityOption[]
  
  // Connection details (for connected platforms)
  connectedAccount?: string
  connectedAt?: string
  lastSync?: string
  uptime?: string
  stats?: {
    recordsSynced: number
    errorCount: number
    avgLatency: string
  }
  recentLogs?: SyncAuditLog[]
}

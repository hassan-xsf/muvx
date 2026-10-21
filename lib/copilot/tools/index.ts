import type { TmsToolDef } from "../types"

// Loads domain
import {
  bookLoadTool,
  queryLoadsTool,
  updateLoadTool,
  updateLoadDocsTool,
  deleteLoadTool,
} from "./loads"

// Trips & Dispatch domain
import {
  dispatchTripTool,
  updateTripTool,
  updateTripStatusTool,
} from "./trips"

// Fleet, Drivers & Assets domain
import {
  getFleetStatusTool,
  createDriverTool,
  updateDriverTool,
  createTruckTool,
  updateTruckTool,
  createTrailerTool,
  updateTrailerTool,
} from "./fleet"

// Customers & Shippers domain
import {
  queryCustomersTool,
  createCustomerTool,
  updateCustomerTool,
} from "./customers"

// Partner Carriers domain
import {
  queryCarriersTool,
  createCarrierTool,
  updateCarrierTool,
} from "./carriers"

// Invoices & Billing domain
import {
  queryInvoicesTool,
  createInvoiceTool,
  sendInvoiceEmailTool,
  markInvoicePaidTool,
  getMissingPodsTool,
} from "./invoices"

// Expenses & Settlements domain
import {
  reviewPendingExpensesTool,
  approveExpenseTool,
  logTripExpenseTool,
} from "./expenses"

// Team, Members & Invitations domain
import {
  listWorkspaceMembersTool,
  inviteWorkspaceMemberTool,
  resendInvitationTool,
  cancelInvitationTool,
  updateMemberRoleTool,
  removeMemberTool,
} from "./members"

// System, Audit, Knowledge & Subagents domain
import {
  queryAuditLogsTool,
  checkIntegrationsTool,
  searchFreightKnowledgeTool,
  createExecutionPlanTool,
  delegateSubtaskTool,
  askDispatcherTool,
} from "./system"

// Coworker Scheduler, Driver Tasks & Memory domain
import {
  assignDriverTaskTool,
  askDriverQuestionTool,
  scheduleCoworkerTaskTool,
  listScheduledTasksTool,
  saveCopilotMemoryTool,
  recallCopilotMemoryTool,
} from "./coworker"

// Re-export all tools individually
export * from "./loads"
export * from "./trips"
export * from "./fleet"
export * from "./customers"
export * from "./carriers"
export * from "./invoices"
export * from "./expenses"
export * from "./members"
export * from "./system"
export * from "./coworker"
export * from "../types"

/**
 * Master Enterprise TMS Tool Registry.
 * Shared between Muvx AI Copilot, Next.js API Routes, and Model Context Protocol (MCP) server.
 */
export const ALL_TMS_TOOLS: TmsToolDef<any, any>[] = [
  // 1. Loads
  bookLoadTool,
  queryLoadsTool,
  updateLoadTool,
  updateLoadDocsTool,
  deleteLoadTool,

  // 2. Trips & Dispatch
  dispatchTripTool,
  updateTripTool,
  updateTripStatusTool,

  // 3. Fleet & Compliance
  getFleetStatusTool,
  createDriverTool,
  updateDriverTool,
  createTruckTool,
  updateTruckTool,
  createTrailerTool,
  updateTrailerTool,

  // 4. Customers & Shippers
  queryCustomersTool,
  createCustomerTool,
  updateCustomerTool,

  // 5. Partner Carriers
  queryCarriersTool,
  createCarrierTool,
  updateCarrierTool,

  // 6. Invoices & Billing
  queryInvoicesTool,
  createInvoiceTool,
  sendInvoiceEmailTool,
  markInvoicePaidTool,
  getMissingPodsTool,

  // 7. Expenses & Settlements
  reviewPendingExpensesTool,
  approveExpenseTool,
  logTripExpenseTool,

  // 8. Team Members & Invitations
  listWorkspaceMembersTool,
  inviteWorkspaceMemberTool,
  resendInvitationTool,
  cancelInvitationTool,
  updateMemberRoleTool,
  removeMemberTool,

  // 9. System, Security & Subagents
  queryAuditLogsTool,
  checkIntegrationsTool,
  searchFreightKnowledgeTool,
  createExecutionPlanTool,
  delegateSubtaskTool,
  askDispatcherTool,

  // 10. Autonomous Coworker, Driver Tasks & Memory
  assignDriverTaskTool,
  askDriverQuestionTool,
  scheduleCoworkerTaskTool,
  listScheduledTasksTool,
  saveCopilotMemoryTool,
  recallCopilotMemoryTool,
]


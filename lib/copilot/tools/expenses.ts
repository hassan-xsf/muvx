import { z } from "zod"
import { randomUUID } from "node:crypto"
import { eq, and } from "drizzle-orm"
import { db } from "@/lib/db"
import { apExpense } from "@/lib/schema"
import { recordAuditEvent } from "@/lib/audit"
import { defineTmsTool, hasPermission, permissionDeniedResult } from "../types"

export const reviewPendingExpensesTool = defineTmsTool({
  name: "reviewPendingExpenses",
  description: "Query unapproved accounts payable (AP) trip expenses and driver fuel receipts awaiting manager approval.",
  requiredPermissions: ["settlements.ap.view", "settlements.module"],
  inputSchema: z.object({}),
  execute: async (_params, ctx) => {
    if (!hasPermission(ctx, ["settlements.ap.view", "settlements.view_all", "expenses.view_all", "settlements.module"])) {
      return permissionDeniedResult(["settlements.ap.view"])
    }

    const rows = await db
      .select({
        id: apExpense.id,
        tripId: apExpense.tripId,
        type: apExpense.type,
        vendor: apExpense.vendor,
        amount: apExpense.amount,
        date: apExpense.date,
        receipt: apExpense.receipt,
      })
      .from(apExpense)
      .where(and(eq(apExpense.tenantId, ctx.tenantId), eq(apExpense.status, "pending")))
      .limit(10)

    return {
      count: rows.length,
      expenses: rows.map((e) => ({
        id: e.id,
        category: e.type,
        vendor: e.vendor || "Direct Expense",
        amount: `$${parseFloat(e.amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
        date: new Date(e.date).toLocaleDateString(),
        hasReceipt: !!e.receipt,
      })),
    }
  },
})

export const approveExpenseTool = defineTmsTool({
  name: "approveExpense",
  description: "Approve an accounts payable (AP) trip expense or driver reimbursement.",
  requiredPermissions: ["settlements.approve"],
  inputSchema: z.object({
    expenseId: z.string().describe("ID of the expense to approve"),
  }),
  execute: async ({ expenseId }, ctx) => {
    if (!hasPermission(ctx, ["settlements.approve", "expenses.approve", "settlements.module"])) {
      return permissionDeniedResult(["settlements.approve"])
    }

    const [exp] = await db
      .select()
      .from(apExpense)
      .where(and(eq(apExpense.id, expenseId), eq(apExpense.tenantId, ctx.tenantId)))
      .limit(1)

    if (!exp) {
      return { success: false, error: "Expense not found." }
    }

    await db
      .update(apExpense)
      .set({ status: "approved" })
      .where(eq(apExpense.id, expenseId))

    await recordAuditEvent({
      actor: { id: ctx.userId, email: ctx.userEmail },
      action: "expense.update_status",
      target: { type: "expense", id: exp.id, label: `${exp.type} (${exp.vendor})` },
      metadata: { amount: exp.amount, tenantId: ctx.tenantId },
    })

    return {
      success: true,
      expenseId: exp.id,
      amount: `$${parseFloat(exp.amount).toFixed(2)}`,
      category: exp.type,
      status: "approved",
      message: `Expense of $${parseFloat(exp.amount).toFixed(2)} (${exp.type}) approved.`,
    }
  },
})

export const logTripExpenseTool = defineTmsTool({
  name: "logTripExpense",
  description: "Record a new driver or trip expense (fuel, toll, maintenance, lumper fee, per diem).",
  requiredPermissions: ["settlements.create"],
  inputSchema: z.object({
    tripId: z.string().optional().describe("Associated Trip ID"),
    driverId: z.string().optional().describe("Associated Driver ID"),
    category: z.enum(["fuel", "toll", "maintenance", "lumper", "scales", "per_diem", "parking", "other"]).default("fuel"),
    amount: z.number().describe("Expense amount in USD"),
    vendor: z.string().optional().describe("Vendor name (e.g. Love's, Pilot Flying J, TA)"),
    date: z.string().optional().describe("YYYY-MM-DD date of expense"),
    notes: z.string().optional().describe("Receipt notes or details"),
  }),
  execute: async (params, ctx) => {
    if (!hasPermission(ctx, ["settlements.create", "expenses.create", "settlements.module"])) {
      return permissionDeniedResult(["settlements.create"])
    }

    const expenseId = randomUUID()
    const expDate = params.date ? new Date(params.date) : new Date()

    await db.insert(apExpense).values({
      id: expenseId,
      tenantId: ctx.tenantId,
      tripId: params.tripId ?? null,
      driverId: params.driverId ?? null,
      type: params.category,
      vendor: params.vendor ?? null,
      amount: String(params.amount),
      date: expDate,
      status: "pending",
      notes: params.notes ?? null,
    })

    await recordAuditEvent({
      actor: { id: ctx.userId, email: ctx.userEmail },
      action: "expense.create",
      target: { type: "expense", id: expenseId, label: params.category },
      metadata: { amount: params.amount, vendor: params.vendor, tenantId: ctx.tenantId },
    })

    return {
      success: true,
      expenseId,
      category: params.category,
      amount: `$${params.amount.toFixed(2)}`,
      vendor: params.vendor || "Vendor",
      date: expDate.toLocaleDateString(),
      status: "pending",
      message: `Expense of $${params.amount.toFixed(2)} logged for review.`,
    }
  },
})

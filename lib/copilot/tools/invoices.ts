import { z } from "zod"
import { randomUUID } from "node:crypto"
import { eq, and, desc, or, sql } from "drizzle-orm"
import { db } from "@/lib/db"
import { invoice, load } from "@/lib/schema"
import { recordAuditEvent } from "@/lib/audit"
import { dispatchNotificationEvent } from "@/lib/notifications"
import { sendInvoiceEmail } from "@/lib/email"
import { defineTmsTool, hasPermission, permissionDeniedResult } from "../types"

export const queryInvoicesTool = defineTmsTool({
  name: "queryInvoices",
  description: "Query accounts receivable (AR) freight invoices with pending balances, overdue aging, and payment statuses.",
  requiredPermissions: ["accounting.invoices.view_all", "accounting.module"],
  inputSchema: z.object({
    status: z.enum(["all", "pending", "sent", "paid", "overdue", "cancelled"]).default("all"),
    limit: z.number().default(10),
  }),
  execute: async ({ status: filterStatus, limit }, ctx) => {
    if (!hasPermission(ctx, ["accounting.invoices.view_all", "invoices.view_all", "accounting.module"])) {
      return permissionDeniedResult(["accounting.invoices.view_all"])
    }

    const conditions = [eq(invoice.tenantId, ctx.tenantId)]
    if (filterStatus !== "all") {
      conditions.push(eq(invoice.status, filterStatus))
    }

    const rows = await db
      .select({
        id: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        customerName: invoice.customerName,
        amount: invoice.amount,
        status: invoice.status,
        dueDate: invoice.dueDate,
        paidDate: invoice.paidDate,
      })
      .from(invoice)
      .where(and(...conditions))
      .orderBy(desc(invoice.createdAt))
      .limit(limit)

    let totalPending = 0
    let totalOverdue = 0
    const now = new Date()

    const formatted = rows.map((inv) => {
      const amt = parseFloat(inv.amount || "0")
      const due = inv.dueDate ? new Date(inv.dueDate) : null
      const isOverdue = inv.status !== "paid" && due && due < now

      if (inv.status === "pending" || inv.status === "sent") {
        totalPending += amt
      }
      if (isOverdue) {
        totalOverdue += amt
      }

      return {
        id: inv.id,
        invoiceNumber: inv.invoiceNumber,
        customer: inv.customerName || "Customer",
        amount: `$${amt.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
        status: isOverdue ? "overdue" : inv.status,
        dueDate: due ? due.toLocaleDateString() : "Due on receipt",
        paidDate: inv.paidDate ? new Date(inv.paidDate).toLocaleDateString() : null,
      }
    })

    return {
      count: rows.length,
      pendingBalance: `$${totalPending.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      overdueBalance: `$${totalOverdue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      invoices: formatted,
    }
  },
})

export const createInvoiceTool = defineTmsTool({
  name: "createInvoice",
  description: "Generate an official accounts receivable invoice from a delivered load.",
  requiredPermissions: ["accounting.invoices.create"],
  inputSchema: z.object({
    loadId: z.string().describe("ID of the delivered load"),
    amount: z.number().optional().describe("Invoice amount (defaults to load agreed rate)"),
    dueDateDays: z.number().default(30).describe("Days until invoice is due (e.g. 30 for Net 30)"),
    notes: z.string().optional().describe("Invoice remittance notes"),
  }),
  execute: async ({ loadId, amount, dueDateDays, notes }, ctx) => {
    if (!hasPermission(ctx, ["accounting.invoices.create", "invoices.create", "accounting.module"])) {
      return permissionDeniedResult(["accounting.invoices.create"])
    }

    const [targetLoad] = await db
      .select()
      .from(load)
      .where(and(eq(load.id, loadId), eq(load.tenantId, ctx.tenantId)))
      .limit(1)

    if (!targetLoad) {
      return { success: false, error: "Load not found." }
    }

    const invoiceAmt = amount !== undefined ? amount : parseFloat(targetLoad.rate || "0")
    const invId = randomUUID()
    const invNum = `INV-${Math.floor(10000 + Math.random() * 90000)}`
    const dueDate = new Date(Date.now() + dueDateDays * 24 * 60 * 60 * 1000)

    await db.insert(invoice).values({
      id: invId,
      tenantId: ctx.tenantId,
      invoiceNumber: invNum,
      loadId: targetLoad.id,
      customerId: targetLoad.customerId ?? null,
      customerName: targetLoad.customerName ?? "Customer",
      customerEmail: targetLoad.customerEmail ?? null,
      amount: String(invoiceAmt),
      status: "pending",
      dueDate,
      notes: notes ?? null,
    })

    await recordAuditEvent({
      actor: { id: ctx.userId, email: ctx.userEmail },
      action: "invoice.create",
      target: { type: "invoice", id: invId, label: invNum },
      metadata: { loadNumber: targetLoad.loadNumber, amount: invoiceAmt, tenantId: ctx.tenantId },
    })

    return {
      success: true,
      invoiceId: invId,
      invoiceNumber: invNum,
      customerName: targetLoad.customerName || "Customer",
      amount: `$${invoiceAmt.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      dueDate: dueDate.toISOString().slice(0, 10),
      message: `Invoice #${invNum} created for Load #${targetLoad.loadNumber}.`,
    }
  },
})

export const sendInvoiceEmailTool = defineTmsTool({
  name: "sendInvoiceEmail",
  description: "Dispatch an invoice payment package email with Resend payment link to the customer.",
  requiredPermissions: ["accounting.invoices.send"],
  inputSchema: z.object({
    invoiceId: z.string().describe("ID of the invoice to email"),
    recipientEmail: z.string().email().describe("Customer billing email address"),
  }),
  execute: async ({ invoiceId, recipientEmail }, ctx) => {
    if (!hasPermission(ctx, ["accounting.invoices.send", "invoices.send", "accounting.module"])) {
      return permissionDeniedResult(["accounting.invoices.send"])
    }

    const [inv] = await db
      .select()
      .from(invoice)
      .where(and(eq(invoice.id, invoiceId), eq(invoice.tenantId, ctx.tenantId)))
      .limit(1)

    if (!inv) {
      return { success: false, error: "Invoice not found." }
    }

    const host = process.env.BETTER_AUTH_URL || "https://muvx.com"
    const emailResult = await sendInvoiceEmail({
      to: recipientEmail,
      invoiceNumber: inv.invoiceNumber,
      customerName: inv.customerName || "Valued Customer",
      amount: parseFloat(inv.amount || "0"),
      currency: "USD",
      dueDate: inv.dueDate ? new Date(inv.dueDate).toISOString().slice(0, 10) : "Due upon receipt",
      organizationName: "Muvx Freight",
      invoiceUrl: `${host}/invoices/${inv.id}`,
    })

    await db
      .update(invoice)
      .set({ status: "sent", customerEmail: recipientEmail })
      .where(eq(invoice.id, inv.id))

    await recordAuditEvent({
      actor: { id: ctx.userId, email: ctx.userEmail },
      action: "invoice.update",
      target: { type: "invoice", id: inv.id, label: inv.invoiceNumber },
      metadata: { sentTo: recipientEmail, tenantId: ctx.tenantId },
    })

    await dispatchNotificationEvent({
      organizationId: ctx.tenantId,
      category: "invoice",
      event: "invoice.emailed_by_copilot",
      severity: "success",
      title: `Invoice #${inv.invoiceNumber} Emailed`,
      message: `Invoice sent to ${recipientEmail} ($${parseFloat(inv.amount).toFixed(2)}).`,
      link: `/invoices/${inv.id}`,
    })

    return {
      success: !emailResult.error,
      invoiceNumber: inv.invoiceNumber,
      sentTo: recipientEmail,
      amount: `$${parseFloat(inv.amount).toFixed(2)}`,
      status: "sent",
    }
  },
})

export const markInvoicePaidTool = defineTmsTool({
  name: "markInvoicePaid",
  description: "Record customer payment for an invoice, marking it as paid.",
  requiredPermissions: ["accounting.invoices.apply_payment"],
  inputSchema: z.object({
    invoiceId: z.string().describe("ID of the invoice"),
    paidDate: z.string().optional().describe("YYYY-MM-DD payment receipt date"),
    referenceNumber: z.string().optional().describe("Check, ACH, or wire transaction reference number"),
  }),
  execute: async ({ invoiceId, paidDate, referenceNumber }, ctx) => {
    if (!hasPermission(ctx, ["accounting.invoices.apply_payment", "invoices.record_payment", "accounting.module"])) {
      return permissionDeniedResult(["accounting.invoices.apply_payment"])
    }

    const [inv] = await db
      .select()
      .from(invoice)
      .where(and(eq(invoice.id, invoiceId), eq(invoice.tenantId, ctx.tenantId)))
      .limit(1)

    if (!inv) {
      return { success: false, error: "Invoice not found." }
    }

    const paymentDate = paidDate ? new Date(paidDate) : new Date()

    await db
      .update(invoice)
      .set({
        status: "paid",
        paidDate: paymentDate,
        notes: referenceNumber ? `Payment Ref: ${referenceNumber}` : inv.notes,
      })
      .where(eq(invoice.id, inv.id))

    await recordAuditEvent({
      actor: { id: ctx.userId, email: ctx.userEmail },
      action: "invoice.update",
      target: { type: "invoice", id: inv.id, label: inv.invoiceNumber },
      metadata: { status: "paid", paidDate: paymentDate, referenceNumber, tenantId: ctx.tenantId },
    })

    return {
      success: true,
      invoiceNumber: inv.invoiceNumber,
      amount: `$${parseFloat(inv.amount).toFixed(2)}`,
      status: "paid",
      paidDate: paymentDate.toLocaleDateString(),
      message: `Invoice #${inv.invoiceNumber} recorded as paid.`,
    }
  },
})

export const getMissingPodsTool = defineTmsTool({
  name: "getMissingPods",
  description: "Query delivered freight loads lacking a signed Proof of Delivery (POD) for invoice factoring.",
  requiredPermissions: ["accounting.invoices.view_all", "loads.view_all"],
  inputSchema: z.object({}),
  execute: async (_params, ctx) => {
    if (!hasPermission(ctx, ["accounting.invoices.view_all", "loads.view_all", "accounting.module", "loads.module"])) {
      return permissionDeniedResult(["accounting.invoices.view_all", "loads.view_all"])
    }

    const rows = await db
      .select({
        id: load.id,
        loadNumber: load.loadNumber,
        customerName: load.customerName,
        rate: load.rate,
        destCity: load.destCity,
        destState: load.destState,
        deliveryDate: load.deliveryDate,
      })
      .from(load)
      .where(
        and(
          eq(load.tenantId, ctx.tenantId),
          eq(load.status, "delivered"),
          or(eq(load.podSigned, false), sql`${load.podSigned} IS NULL`)
        )
      )
      .orderBy(desc(load.deliveryDate))
      .limit(10)

    const totalUncollected = rows.reduce((sum, r) => sum + parseFloat(r.rate || "0"), 0)

    return {
      count: rows.length,
      totalUnbilledRevenue: `$${totalUncollected.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      missingPodLoads: rows.map((r) => ({
        id: r.id,
        loadNumber: r.loadNumber,
        customer: r.customerName || "Unknown Customer",
        destination: `${r.destCity || "Unknown"}, ${r.destState || ""}`,
        deliveredAt: r.deliveryDate ? new Date(r.deliveryDate).toLocaleDateString() : "Recent",
        unpaidAmount: r.rate ? `$${parseFloat(r.rate).toLocaleString()}` : "$0",
      })),
    }
  },
})

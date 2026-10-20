import { z } from "zod"
import { randomUUID } from "node:crypto"
import { eq, and, or, desc, like } from "drizzle-orm"
import { db } from "@/lib/db"
import { load, trip, invoice } from "@/lib/schema"
import { recordAuditEvent } from "@/lib/audit"
import { dispatchNotificationEvent } from "@/lib/notifications"
import { defineTmsTool, hasPermission, permissionDeniedResult } from "../types"

export const bookLoadTool = defineTmsTool({
  name: "bookLoad",
  description: "Book a new freight load into Muvx TMS with shipper, equipment, route, and linehaul rate.",
  requiredPermissions: ["loads.create"],
  inputSchema: z.object({
    customerName: z.string().describe("Customer or broker name (e.g. Walmart, CH Robinson)"),
    loadNumber: z.string().optional().describe("Load/tender number (auto-generated if omitted)"),
    originCity: z.string().describe("Pickup city"),
    originState: z.string().describe("Pickup 2-letter state code (e.g. IL)"),
    destCity: z.string().describe("Delivery city"),
    destState: z.string().describe("Delivery 2-letter state code (e.g. TX)"),
    rate: z.number().describe("Agreed linehaul rate amount in USD"),
    equipmentType: z
      .enum(["Dry Van", "Reefer", "Flatbed", "Step Deck", "Power Only", "Box Truck"])
      .default("Dry Van"),
    commodity: z.string().optional().describe("Description of freight goods"),
    weight: z.number().optional().describe("Total weight in lbs"),
    pickupDate: z.string().optional().describe("YYYY-MM-DD pickup date"),
    deliveryDate: z.string().optional().describe("YYYY-MM-DD delivery date"),
  }),
  execute: async (params, ctx) => {
    if (!hasPermission(ctx, ["loads.create", "loads.edit"])) {
      return permissionDeniedResult(["loads.create"])
    }

    const loadId = randomUUID()
    const loadNum = params.loadNumber || `LD-${Math.floor(100000 + Math.random() * 900000)}`

    await db.insert(load).values({
      id: loadId,
      tenantId: ctx.tenantId,
      loadNumber: loadNum,
      customerName: params.customerName,
      status: "available",
      originCity: params.originCity,
      originState: params.originState,
      destCity: params.destCity,
      destState: params.destState,
      loadType: params.equipmentType,
      commodity: params.commodity ?? null,
      weight: params.weight ? String(params.weight) : null,
      rate: String(params.rate),
      finalRate: String(params.rate),
      currency: "USD",
      pickupDate: params.pickupDate ? new Date(params.pickupDate) : new Date(),
      deliveryDate: params.deliveryDate ? new Date(params.deliveryDate) : null,
    })

    await recordAuditEvent({
      actor: { id: ctx.userId, email: ctx.userEmail },
      action: "load.create",
      target: { type: "load", id: loadId, label: loadNum },
      metadata: {
        customer: params.customerName,
        rate: params.rate,
        lane: `${params.originCity}, ${params.originState} -> ${params.destCity}, ${params.destState}`,
        tenantId: ctx.tenantId,
      },
    })

    await dispatchNotificationEvent({
      organizationId: ctx.tenantId,
      category: "load",
      event: "load.created_by_copilot",
      severity: "info",
      title: `Load #${loadNum} Booked`,
      message: `Booked for ${params.customerName} ($${params.rate.toLocaleString()}) by Copilot.`,
      link: `/loads/${loadId}`,
    })

    return {
      success: true,
      loadId,
      loadNumber: loadNum,
      customerName: params.customerName,
      origin: `${params.originCity}, ${params.originState}`,
      destination: `${params.destCity}, ${params.destState}`,
      rate: `$${params.rate.toLocaleString()}`,
      status: "available",
      message: `Load #${loadNum} booked successfully. Ready for driver dispatch.`,
    }
  },
})

export const queryLoadsTool = defineTmsTool({
  name: "queryLoads",
  description: "Query active freight loads in Muvx TMS by status, customer, or origin/destination.",
  requiredPermissions: ["loads.view_all", "loads.module"],
  inputSchema: z.object({
    status: z
      .enum(["all", "available", "booked", "dispatched", "in_transit", "delivered", "completed", "cancelled"])
      .default("all"),
    customerName: z.string().optional().describe("Filter by customer/broker name"),
    limit: z.number().default(10).describe("Max loads to retrieve"),
  }),
  execute: async ({ status, customerName, limit }, ctx) => {
    if (!hasPermission(ctx, ["loads.view_all", "loads.view_assigned", "loads.view_own", "loads.module"])) {
      return permissionDeniedResult(["loads.view_all", "loads.module"])
    }

    const conditions = [eq(load.tenantId, ctx.tenantId)]
    if (status !== "all") {
      conditions.push(eq(load.status, status))
    }
    if (customerName) {
      conditions.push(like(load.customerName, `%${customerName}%`))
    }

    const rows = await db
      .select({
        id: load.id,
        loadNumber: load.loadNumber,
        status: load.status,
        customerName: load.customerName,
        originCity: load.originCity,
        originState: load.originState,
        destCity: load.destCity,
        destState: load.destState,
        rate: load.rate,
        currency: load.currency,
        loadType: load.loadType,
        pickupDate: load.pickupDate,
        podSigned: load.podSigned,
        bolReceived: load.bolReceived,
      })
      .from(load)
      .where(and(...conditions))
      .orderBy(desc(load.createdAt))
      .limit(limit)

    return {
      count: rows.length,
      loads: rows.map((r) => ({
        id: r.id,
        loadNumber: r.loadNumber,
        customer: r.customerName || "Unknown Customer",
        origin: `${r.originCity || "Unknown"}, ${r.originState || ""}`,
        destination: `${r.destCity || "Unknown"}, ${r.destState || ""}`,
        status: r.status,
        equipment: r.loadType || "Dry Van",
        rate: r.rate ? `$${parseFloat(r.rate).toLocaleString()}` : "Pending",
        pickupDate: r.pickupDate ? new Date(r.pickupDate).toLocaleDateString() : "TBD",
        podSigned: r.podSigned ?? false,
        bolReceived: r.bolReceived ?? false,
      })),
    }
  },
})

export const updateLoadTool = defineTmsTool({
  name: "updateLoad",
  description: "Update details or status of an existing freight load.",
  requiredPermissions: ["loads.edit"],
  inputSchema: z.object({
    loadId: z.string().describe("ID of the load to update"),
    status: z
      .enum(["available", "booked", "dispatched", "in_transit", "delivered", "completed", "cancelled"])
      .optional()
      .describe("New load status"),
    rate: z.number().optional().describe("Updated linehaul rate amount in USD"),
    customerName: z.string().optional().describe("Updated customer name"),
    pickupDate: z.string().optional().describe("YYYY-MM-DD pickup date"),
    deliveryDate: z.string().optional().describe("YYYY-MM-DD delivery date"),
    commodity: z.string().optional().describe("Description of goods"),
    weight: z.number().optional().describe("Weight in lbs"),
    specialInstructions: z.string().optional().describe("Special dock or handling instructions"),
  }),
  execute: async (params, ctx) => {
    if (!hasPermission(ctx, ["loads.edit", "loads.update_status"])) {
      return permissionDeniedResult(["loads.edit"])
    }

    const [existing] = await db
      .select()
      .from(load)
      .where(and(eq(load.id, params.loadId), eq(load.tenantId, ctx.tenantId)))
      .limit(1)

    if (!existing) {
      return { success: false, error: "Load not found or unauthorized." }
    }

    const updates: Record<string, any> = {}
    if (params.status) updates.status = params.status
    if (params.rate !== undefined) {
      updates.rate = String(params.rate)
      updates.finalRate = String(params.rate)
    }
    if (params.customerName) updates.customerName = params.customerName
    if (params.pickupDate) updates.pickupDate = new Date(params.pickupDate)
    if (params.deliveryDate) updates.deliveryDate = new Date(params.deliveryDate)
    if (params.commodity) updates.commodity = params.commodity
    if (params.weight !== undefined) updates.weight = String(params.weight)
    if (params.specialInstructions) updates.specialInstructions = params.specialInstructions

    await db
      .update(load)
      .set(updates)
      .where(and(eq(load.id, params.loadId), eq(load.tenantId, ctx.tenantId)))

    await recordAuditEvent({
      actor: { id: ctx.userId, email: ctx.userEmail },
      action: "load.update",
      target: { type: "load", id: existing.id, label: existing.loadNumber },
      metadata: { updates, tenantId: ctx.tenantId },
    })

    return {
      success: true,
      loadId: existing.id,
      loadNumber: existing.loadNumber,
      updatedFields: Object.keys(updates),
      status: params.status || existing.status,
      message: `Load #${existing.loadNumber} updated successfully.`,
    }
  },
})

export const updateLoadDocsTool = defineTmsTool({
  name: "updateLoadDocs",
  description: "Update paperwork and quick-access flags for a load (signed POD, received BOL, or star/pin).",
  requiredPermissions: ["documents.upload", "loads.edit"],
  inputSchema: z.object({
    loadId: z.string().describe("ID of the load"),
    podSigned: z.boolean().optional().describe("Mark proof of delivery as signed"),
    bolReceived: z.boolean().optional().describe("Mark bill of lading as received"),
    isStarred: z.boolean().optional().describe("Star or unstar for quick access"),
  }),
  execute: async ({ loadId, podSigned, bolReceived, isStarred }, ctx) => {
    if (!hasPermission(ctx, ["documents.upload", "loads.edit", "loads.module"])) {
      return permissionDeniedResult(["documents.upload", "loads.edit"])
    }

    const [existing] = await db
      .select()
      .from(load)
      .where(and(eq(load.id, loadId), eq(load.tenantId, ctx.tenantId)))
      .limit(1)

    if (!existing) {
      return { success: false, error: "Load not found." }
    }

    const updates: Record<string, any> = {}
    if (podSigned !== undefined) updates.podSigned = podSigned
    if (bolReceived !== undefined) updates.bolReceived = bolReceived
    if (isStarred !== undefined) updates.isStarred = isStarred

    await db
      .update(load)
      .set(updates)
      .where(and(eq(load.id, loadId), eq(load.tenantId, ctx.tenantId)))

    return {
      success: true,
      loadNumber: existing.loadNumber,
      podSigned: podSigned !== undefined ? podSigned : existing.podSigned,
      bolReceived: bolReceived !== undefined ? bolReceived : existing.bolReceived,
      isStarred: isStarred !== undefined ? isStarred : existing.isStarred,
      message: `Document status updated for Load #${existing.loadNumber}.`,
    }
  },
})

export const deleteLoadTool = defineTmsTool({
  name: "deleteLoad",
  description: "Permanently delete a freight load from Muvx TMS by its load ID or load number.",
  requiredPermissions: ["loads.delete"],
  inputSchema: z.object({
    loadIdentifier: z.string().describe("Load ID (UUID) or Load Number (e.g. LD-102948) to delete"),
    reason: z.string().optional().describe("Optional reason for deleting the load"),
  }),
  execute: async ({ loadIdentifier, reason }, ctx) => {
    if (!hasPermission(ctx, ["loads.delete", "loads.edit"])) {
      return permissionDeniedResult(["loads.delete"])
    }

    const [existing] = await db
      .select()
      .from(load)
      .where(
        and(
          eq(load.tenantId, ctx.tenantId),
          or(eq(load.id, loadIdentifier), eq(load.loadNumber, loadIdentifier))
        )
      )
      .limit(1)

    if (!existing) {
      return { success: false, error: `Load "${loadIdentifier}" not found.` }
    }

    // Detach references in trips and invoices
    await db
      .update(trip)
      .set({ loadId: null })
      .where(and(eq(trip.loadId, existing.id), eq(trip.tenantId, ctx.tenantId)))

    await db
      .update(invoice)
      .set({ loadId: null })
      .where(and(eq(invoice.loadId, existing.id), eq(invoice.tenantId, ctx.tenantId)))

    await db
      .delete(load)
      .where(and(eq(load.id, existing.id), eq(load.tenantId, ctx.tenantId)))

    await recordAuditEvent({
      actor: { id: ctx.userId, email: ctx.userEmail },
      action: "load.delete",
      target: { type: "load", id: existing.id, label: existing.loadNumber },
      metadata: { reason: reason || "Deleted by Copilot", tenantId: ctx.tenantId },
    })

    return {
      success: true,
      loadId: existing.id,
      loadNumber: existing.loadNumber,
      message: `Load #${existing.loadNumber} deleted successfully.`,
    }
  },
})


import { z } from "zod"
import { randomUUID } from "node:crypto"
import { eq, and, or, like, ilike } from "drizzle-orm"
import { db } from "@/lib/db"
import { carrier } from "@/lib/schema"
import { recordAuditEvent } from "@/lib/audit"
import { defineTmsTool, hasPermission, permissionDeniedResult } from "../types"

export const queryCarriersTool = defineTmsTool({
  name: "queryCarriers",
  description: "Search partner carriers with MC#, DOT#, insurance expiry, and contact info.",
  requiredPermissions: ["fleet.view_all", "fleet.module"],
  inputSchema: z.object({
    query: z.string().optional().describe("Search by carrier name, MC#, or DOT#"),
    limit: z.number().default(10),
  }),
  execute: async ({ query, limit }, ctx) => {
    if (!hasPermission(ctx, ["fleet.view_all", "loads.view_all", "fleet.module", "loads.module"])) {
      return permissionDeniedResult(["fleet.view_all"])
    }

    const conditions = [eq(carrier.tenantId, ctx.tenantId)]
    if (query) {
      conditions.push(or(ilike(carrier.name, `%${query}%`), like(carrier.mcNumber, `%${query}%`), like(carrier.dotNumber, `%${query}%`)) as any)
    }

    const rows = await db
      .select({
        id: carrier.id,
        name: carrier.name,
        mcNumber: carrier.mcNumber,
        dotNumber: carrier.dotNumber,
        contactName: carrier.contactName,
        phone: carrier.phone,
        email: carrier.email,
        insuranceExpiry: carrier.insuranceExpiry,
        status: carrier.status,
      })
      .from(carrier)
      .where(and(...conditions))
      .limit(limit)

    return {
      count: rows.length,
      carriers: rows.map((c) => ({
        id: c.id,
        name: c.name,
        mcNumber: c.mcNumber ? `MC-${c.mcNumber}` : "N/A",
        dotNumber: c.dotNumber ? `DOT-${c.dotNumber}` : "N/A",
        contact: c.contactName || "N/A",
        phone: c.phone || "N/A",
        insuranceExpiry: c.insuranceExpiry ? new Date(c.insuranceExpiry).toISOString().slice(0, 10) : "N/A",
        status: c.status,
      })),
    }
  },
})

export const createCarrierTool = defineTmsTool({
  name: "createCarrier",
  description: "Onboard a partner motor carrier with MC and DOT numbers.",
  requiredPermissions: ["fleet.create"],
  inputSchema: z.object({
    name: z.string().describe("Carrier legal name"),
    mcNumber: z.string().optional().describe("Motor Carrier number"),
    dotNumber: z.string().optional().describe("US DOT number"),
    contactName: z.string().optional().describe("Dispatcher contact name"),
    email: z.string().email().optional().describe("Dispatch email"),
    phone: z.string().optional().describe("Dispatch phone"),
    insuranceExpiry: z.string().optional().describe("YYYY-MM-DD cargo insurance expiration"),
  }),
  execute: async (params, ctx) => {
    if (!hasPermission(ctx, ["fleet.create", "loads.create", "fleet.module", "loads.module"])) {
      return permissionDeniedResult(["fleet.create"])
    }

    const carrierId = randomUUID()

    await db.insert(carrier).values({
      id: carrierId,
      tenantId: ctx.tenantId,
      name: params.name,
      mcNumber: params.mcNumber ?? null,
      dotNumber: params.dotNumber ?? null,
      contactName: params.contactName ?? null,
      email: params.email ?? null,
      phone: params.phone ?? null,
      insuranceExpiry: params.insuranceExpiry ? new Date(params.insuranceExpiry) : null,
      status: "active",
    })

    await recordAuditEvent({
      actor: { id: ctx.userId, email: ctx.userEmail },
      action: "carrier.create",
      target: { type: "carrier", id: carrierId, label: params.name },
      metadata: { mcNumber: params.mcNumber, tenantId: ctx.tenantId },
    })

    return {
      success: true,
      carrierId,
      name: params.name,
      mcNumber: params.mcNumber ? `MC-${params.mcNumber}` : "N/A",
      status: "active",
      message: `Partner carrier '${params.name}' registered.`,
    }
  },
})

export const updateCarrierTool = defineTmsTool({
  name: "updateCarrier",
  description: "Update a carrier's name, MC#, DOT#, contact person, phone, email, insurance expiry, or status.",
  requiredPermissions: ["fleet.edit"],
  inputSchema: z.object({
    carrierIdentifier: z.string().optional().describe("Carrier ID (UUID), carrier name, or MC number"),
    carrierId: z.string().optional().describe("Carrier UUID if known"),
    name: z.string().optional().describe("Updated carrier legal name"),
    mcNumber: z.string().optional().describe("Updated MC number"),
    dotNumber: z.string().optional().describe("Updated US DOT number"),
    contactName: z.string().optional().describe("Updated dispatcher contact name"),
    email: z.string().email().optional().describe("Updated dispatch email"),
    phone: z.string().optional().describe("Updated dispatch phone"),
    insuranceExpiry: z.string().optional().describe("Updated YYYY-MM-DD cargo insurance expiration"),
    paymentTerms: z.enum(["Due on receipt", "Net 15", "Net 30", "Net 45", "Net 60"]).optional(),
    status: z.enum(["active", "inactive", "suspended"]).optional(),
    notes: z.string().optional().describe("Updated notes"),
  }),
  execute: async (params, ctx) => {
    if (!hasPermission(ctx, ["fleet.edit", "fleet.module"])) {
      return permissionDeniedResult(["fleet.edit"])
    }

    const identifier = params.carrierId || params.carrierIdentifier
    if (!identifier) {
      return { success: false, error: "Please specify carrierId or carrierIdentifier (name, MC#, or ID)." }
    }

    const [existing] = await db
      .select()
      .from(carrier)
      .where(
        and(
          eq(carrier.tenantId, ctx.tenantId),
          or(
            eq(carrier.id, identifier),
            eq(carrier.mcNumber, identifier),
            ilike(carrier.name, `%${identifier}%`)
          )
        )
      )
      .limit(1)

    if (!existing) {
      return { success: false, error: `Carrier '${identifier}' not found in directory.` }
    }

    const updates: Record<string, any> = { updatedAt: new Date() }
    if (params.name !== undefined) updates.name = params.name
    if (params.mcNumber !== undefined) updates.mcNumber = params.mcNumber
    if (params.dotNumber !== undefined) updates.dotNumber = params.dotNumber
    if (params.contactName !== undefined) updates.contactName = params.contactName
    if (params.email !== undefined) updates.email = params.email
    if (params.phone !== undefined) updates.phone = params.phone
    if (params.insuranceExpiry) updates.insuranceExpiry = new Date(params.insuranceExpiry)
    if (params.paymentTerms !== undefined) updates.paymentTerms = params.paymentTerms
    if (params.status) updates.status = params.status
    if (params.notes !== undefined) updates.notes = params.notes

    await db
      .update(carrier)
      .set(updates)
      .where(and(eq(carrier.id, existing.id), eq(carrier.tenantId, ctx.tenantId)))

    const finalName = params.name ?? existing.name

    await recordAuditEvent({
      actor: { id: ctx.userId, email: ctx.userEmail },
      action: "carrier.update",
      target: { type: "carrier", id: existing.id, label: finalName },
      metadata: { updates, tenantId: ctx.tenantId },
    })

    return {
      success: true,
      carrierId: existing.id,
      name: finalName,
      mcNumber: params.mcNumber ? `MC-${params.mcNumber}` : (existing.mcNumber ? `MC-${existing.mcNumber}` : "N/A"),
      status: params.status || existing.status,
      updatedFields: Object.keys(updates).filter((k) => k !== "updatedAt"),
      message: `Carrier '${finalName}' updated successfully.`,
    }
  },
})


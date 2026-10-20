import { z } from "zod"
import { randomUUID } from "node:crypto"
import { eq, and, or, like } from "drizzle-orm"
import { db } from "@/lib/db"
import { carrier } from "@/lib/schema"
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
      conditions.push(or(like(carrier.name, `%${query}%`), like(carrier.mcNumber, `%${query}%`)) as any)
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

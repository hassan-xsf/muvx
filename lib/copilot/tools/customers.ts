import { z } from "zod"
import { randomUUID } from "node:crypto"
import { eq, and, or, like } from "drizzle-orm"
import { db } from "@/lib/db"
import { customer } from "@/lib/schema"
import { recordAuditEvent } from "@/lib/audit"
import { defineTmsTool, hasPermission, permissionDeniedResult } from "../types"

export const queryCustomersTool = defineTmsTool({
  name: "queryCustomers",
  description: "Search shipper and freight broker customers with payment terms and credit limits.",
  requiredPermissions: ["customers.view_all", "customers.module"],
  inputSchema: z.object({
    query: z.string().optional().describe("Search by customer name or email"),
    limit: z.number().default(10).describe("Max results"),
  }),
  execute: async ({ query, limit }, ctx) => {
    if (!hasPermission(ctx, ["customers.view_all", "customers.module"])) {
      return permissionDeniedResult(["customers.view_all"])
    }

    const conditions = [eq(customer.tenantId, ctx.tenantId)]
    if (query) {
      conditions.push(or(like(customer.name, `%${query}%`), like(customer.email, `%${query}%`)) as any)
    }

    const rows = await db
      .select({
        id: customer.id,
        name: customer.name,
        contactName: customer.contactName,
        email: customer.email,
        phone: customer.phone,
        paymentTerms: customer.paymentTerms,
        creditLimit: customer.creditLimit,
        status: customer.status,
      })
      .from(customer)
      .where(and(...conditions))
      .limit(limit)

    return {
      count: rows.length,
      customers: rows.map((c) => ({
        id: c.id,
        name: c.name,
        contact: c.contactName || "N/A",
        email: c.email || "N/A",
        phone: c.phone || "N/A",
        terms: c.paymentTerms || "Net 30",
        creditLimit: c.creditLimit ? `$${parseFloat(c.creditLimit).toLocaleString()}` : "Unlimited",
        status: c.status,
      })),
    }
  },
})

export const createCustomerTool = defineTmsTool({
  name: "createCustomer",
  description: "Add a new shipper or freight broker customer to the master directory.",
  requiredPermissions: ["customers.create"],
  inputSchema: z.object({
    name: z.string().describe("Company or broker name"),
    contactName: z.string().optional().describe("Primary contact name"),
    email: z.string().email().optional().describe("Billing / dispatch email"),
    phone: z.string().optional().describe("Phone number"),
    paymentTerms: z.enum(["Due on receipt", "Net 15", "Net 30", "Net 45", "Net 60"]).default("Net 30"),
    creditLimit: z.number().optional().describe("Credit limit in USD"),
    address: z.string().optional().describe("Billing address"),
    city: z.string().optional().describe("City"),
    state: z.string().optional().describe("2-letter state code"),
    zip: z.string().optional().describe("Postal code"),
  }),
  execute: async (params, ctx) => {
    if (!hasPermission(ctx, ["customers.create", "customers.module"])) {
      return permissionDeniedResult(["customers.create"])
    }

    const customerId = randomUUID()

    await db.insert(customer).values({
      id: customerId,
      tenantId: ctx.tenantId,
      name: params.name,
      contactName: params.contactName ?? null,
      email: params.email ?? null,
      phone: params.phone ?? null,
      paymentTerms: params.paymentTerms,
      creditLimit: params.creditLimit ? String(params.creditLimit) : null,
      address: params.address ?? null,
      city: params.city ?? null,
      state: params.state ?? null,
      zip: params.zip ?? null,
      status: "active",
    })

    await recordAuditEvent({
      actor: { id: ctx.userId, email: ctx.userEmail },
      action: "customer.create",
      target: { type: "customer", id: customerId, label: params.name },
      metadata: { paymentTerms: params.paymentTerms, tenantId: ctx.tenantId },
    })

    return {
      success: true,
      customerId,
      name: params.name,
      paymentTerms: params.paymentTerms,
      creditLimit: params.creditLimit ? `$${params.creditLimit.toLocaleString()}` : "Unlimited",
      message: `Customer '${params.name}' added to directory.`,
    }
  },
})

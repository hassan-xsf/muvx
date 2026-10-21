import { z } from "zod"
import { randomUUID } from "node:crypto"
import { eq, and, or, desc, like } from "drizzle-orm"
import { db } from "@/lib/db"
import { load, trip, invoice } from "@/lib/schema"
import { recordAuditEvent } from "@/lib/audit"
import { dispatchNotificationEvent } from "@/lib/notifications"
import { normalizeSubdivisionCode } from "@/lib/geography"
import { defineTmsTool, hasPermission, permissionDeniedResult } from "../types"

const stopInputSchema = z.object({
  facilityName: z.string().optional().describe("Facility or dock name"),
  address: z.string().optional().describe("Street address"),
  city: z.string().describe("City name"),
  state: z.string().describe("State or province code"),
  zip: z.string().optional().describe("Postal code"),
  type: z.enum(["pickup", "delivery"]).describe("Stop type"),
  appointmentDate: z.string().optional().describe("Appointment date/time"),
  notes: z.string().optional().describe("Stop notes or special handling"),
})

export const bookLoadTool = defineTmsTool({
  name: "bookLoad",
  description:
    "Book a comprehensive freight load into Muvx TMS with full origin/destination addresses, facility names, appointments, equipment specifications, pricing, miles, reefer temperature, and tender references.",
  requiredPermissions: ["loads.create"],
  inputSchema: z.object({
    customerName: z.string().describe("Customer or broker name (e.g. Walmart, CH Robinson, TQL, Echo)"),
    customerEmail: z.string().optional().describe("Customer contact/billing email"),
    loadNumber: z.string().optional().describe("Load/tender number (auto-generated if omitted)"),
    tenderNumber: z.string().optional().describe("Shipper tender/order reference number"),
    rateConfirmNumber: z.string().optional().describe("Rate confirmation agreement number"),
    bolNumber: z.string().optional().describe("Bill of Lading reference number"),

    // Origin (Pickup)
    originFacility: z.string().optional().describe("Pickup facility or shipper name (e.g. Atlanta Cold Storage DC #4)"),
    originAddress: z.string().optional().describe("Pickup street address (e.g. 1500 Logistics Parkway)"),
    originCity: z.string().describe("Pickup city"),
    originState: z.string().describe("Pickup state or province code (e.g. GA, TX, ON)"),
    originZip: z.string().optional().describe("Pickup postal/ZIP code (e.g. 30301)"),
    originContact: z.string().optional().describe("Pickup dock or shipping contact name"),
    originPhone: z.string().optional().describe("Pickup facility phone number"),
    originAppointment: z.string().optional().describe("Pickup appointment timestamp or time window"),
    pickupDate: z.string().optional().describe("Pickup date (YYYY-MM-DD)"),

    // Destination (Delivery)
    destFacility: z.string().optional().describe("Delivery facility or consignee name (e.g. Dallas Mega Fulfillment)"),
    destAddress: z.string().optional().describe("Delivery street address (e.g. 8400 Horizon Boulevard)"),
    destCity: z.string().describe("Delivery city"),
    destState: z.string().describe("Delivery state or province code (e.g. TX, IL, QC)"),
    destZip: z.string().optional().describe("Delivery postal/ZIP code (e.g. 75201)"),
    destContact: z.string().optional().describe("Delivery receiver contact name"),
    destPhone: z.string().optional().describe("Delivery facility phone number"),
    destAppointment: z.string().optional().describe("Delivery appointment timestamp or time window"),
    deliveryDate: z.string().optional().describe("Delivery date (YYYY-MM-DD)"),

    // Financials
    rate: z.number().describe("Agreed total revenue / billing rate amount"),
    customerRate: z.number().optional().describe("Customer billed amount (if different from base rate)"),
    carrierRate: z.number().optional().describe("Target carrier pay / cost amount"),
    currency: z.string().default("USD").describe("Currency code (USD, CAD)"),

    // Cargo & Equipment
    equipmentType: z
      .enum(["Dry Van", "Reefer", "Flatbed", "Step Deck", "Power Only", "Box Truck"])
      .default("Dry Van")
      .describe("Trailer / equipment type"),
    commodity: z.string().optional().describe("Cargo commodity description (e.g. Frozen Poultry, Paper Rolls)"),
    weight: z.number().optional().describe("Total cargo weight in lbs"),
    miles: z.number().optional().describe("Total loaded route trip miles"),
    deadhead: z.number().optional().describe("Estimated empty deadhead miles"),

    // Reefer & Handling Specs
    temperature: z.string().optional().describe("Temperature setting for Reefer loads (e.g. -10°F Frozen, 34°F Continuous)"),
    isRefrigerated: z.boolean().optional().describe("Whether load requires active refrigerated unit"),
    specialInstructions: z.string().optional().describe("Dock hours, tarp, straps, PPE, or special instructions"),

    // Multi-stop route
    stops: z.array(stopInputSchema).optional().describe("Optional intermediate stops along the route"),
  }),
  execute: async (params, ctx) => {
    if (!hasPermission(ctx, ["loads.create", "loads.edit"])) {
      return permissionDeniedResult(["loads.create"])
    }

    const loadId = randomUUID()
    const loadNum = params.loadNumber?.trim() || `LD-${Math.floor(100000 + Math.random() * 900000)}`

    // Dynamically normalize state codes to official ISO 2-letter postal standard
    const originState = normalizeSubdivisionCode("US", params.originState)
    const destState = normalizeSubdivisionCode("US", params.destState)

    const isReefer =
      params.isRefrigerated ??
      (params.equipmentType === "Reefer" || Boolean(params.temperature))

    const customerRateNum = params.customerRate ?? params.rate
    const carrierRateNum = params.carrierRate ?? null
    const targetProfit =
      carrierRateNum && customerRateNum > carrierRateNum
        ? (customerRateNum - carrierRateNum).toFixed(2)
        : null

    const pickupDateTime = params.originAppointment
      ? new Date(params.originAppointment)
      : params.pickupDate
      ? new Date(params.pickupDate)
      : new Date()

    const deliveryDateTime = params.destAppointment
      ? new Date(params.destAppointment)
      : params.deliveryDate
      ? new Date(params.deliveryDate)
      : null

    await db.insert(load).values({
      id: loadId,
      tenantId: ctx.tenantId,
      loadNumber: loadNum,
      customerName: params.customerName,
      customerEmail: params.customerEmail ?? null,
      status: "available",
      tenderNumber: params.tenderNumber ?? null,
      rateConfirmNumber: params.rateConfirmNumber ?? null,
      bolNumber: params.bolNumber ?? null,

      // Origin
      originAddress: params.originAddress ?? null,
      originCity: params.originCity,
      originState,
      originZip: params.originZip ?? null,
      originContact: params.originContact || params.originFacility || null,
      originPhone: params.originPhone ?? null,
      originAppointment: pickupDateTime,
      pickupDate: pickupDateTime,

      // Destination
      destAddress: params.destAddress ?? null,
      destCity: params.destCity,
      destState,
      destZip: params.destZip ?? null,
      destContact: params.destContact || params.destFacility || null,
      destPhone: params.destPhone ?? null,
      destAppointment: deliveryDateTime,
      deliveryDate: deliveryDateTime,

      // Freight & Rates
      loadType: params.equipmentType,
      commodity: params.commodity ?? null,
      weight: params.weight ? String(params.weight) : null,
      rate: String(params.rate),
      customerRate: String(customerRateNum),
      carrierRate: carrierRateNum ? String(carrierRateNum) : null,
      targetProfit,
      finalRate: String(params.rate),
      currency: params.currency || "USD",
      miles: params.miles ? String(params.miles) : null,
      deadhead: params.deadhead ? String(params.deadhead) : null,

      // Specs
      temperature: params.temperature ?? null,
      isRefrigerated: isReefer,
      specialInstructions: params.specialInstructions ?? null,
      stops: params.stops && params.stops.length > 0 ? JSON.stringify(params.stops) : null,
      isStarred: false,
    })

    await recordAuditEvent({
      actor: { id: ctx.userId, email: ctx.userEmail },
      action: "load.create",
      target: { type: "load", id: loadId, label: loadNum },
      metadata: {
        customer: params.customerName,
        rate: params.rate,
        origin: `${params.originCity}, ${originState}`,
        destination: `${params.destCity}, ${destState}`,
        equipment: params.equipmentType,
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
      customerEmail: params.customerEmail,
      tenderNumber: params.tenderNumber,
      rateConfirmNumber: params.rateConfirmNumber,
      originFacility: params.originFacility,
      originAddress: params.originAddress,
      originCity: params.originCity,
      originState,
      originZip: params.originZip,
      originAppointment: params.originAppointment,
      pickupDate: params.pickupDate,
      destFacility: params.destFacility,
      destAddress: params.destAddress,
      destCity: params.destCity,
      destState,
      destZip: params.destZip,
      destAppointment: params.destAppointment,
      deliveryDate: params.deliveryDate,
      equipmentType: params.equipmentType,
      commodity: params.commodity,
      weight: params.weight ? `${params.weight.toLocaleString()} lbs` : undefined,
      miles: params.miles ? `${params.miles.toLocaleString()} mi` : undefined,
      temperature: params.temperature,
      isRefrigerated: isReefer,
      rate: `$${params.rate.toLocaleString()}`,
      currency: params.currency || "USD",
      specialInstructions: params.specialInstructions,
      status: "available",
      message: `Load #${loadNum} booked into TMS with complete origin/destination, cargo, and pricing details.`,
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
        originAddress: load.originAddress,
        originCity: load.originCity,
        originState: load.originState,
        originZip: load.originZip,
        destAddress: load.destAddress,
        destCity: load.destCity,
        destState: load.destState,
        destZip: load.destZip,
        rate: load.rate,
        currency: load.currency,
        loadType: load.loadType,
        commodity: load.commodity,
        weight: load.weight,
        miles: load.miles,
        temperature: load.temperature,
        pickupDate: load.pickupDate,
        deliveryDate: load.deliveryDate,
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
        originAddress: r.originAddress || undefined,
        originZip: r.originZip || undefined,
        destination: `${r.destCity || "Unknown"}, ${r.destState || ""}`,
        destAddress: r.destAddress || undefined,
        destZip: r.destZip || undefined,
        status: r.status,
        equipment: r.loadType || "Dry Van",
        commodity: r.commodity || undefined,
        weight: r.weight ? `${r.weight} lbs` : undefined,
        miles: r.miles ? `${r.miles} mi` : undefined,
        rate: r.rate ? `$${parseFloat(r.rate).toLocaleString()}` : "Pending",
        pickupDate: r.pickupDate ? new Date(r.pickupDate).toLocaleDateString() : "TBD",
        deliveryDate: r.deliveryDate ? new Date(r.deliveryDate).toLocaleDateString() : "TBD",
        podSigned: r.podSigned ?? false,
        bolReceived: r.bolReceived ?? false,
      })),
    }
  },
})

export const updateLoadTool = defineTmsTool({
  name: "updateLoad",
  description: "Update details, route, equipment, rates, or status of an existing freight load.",
  requiredPermissions: ["loads.edit"],
  inputSchema: z.object({
    loadId: z.string().describe("ID of the load to update"),
    status: z
      .enum(["available", "booked", "dispatched", "in_transit", "delivered", "completed", "cancelled"])
      .optional()
      .describe("New load status"),
    rate: z.number().optional().describe("Updated linehaul rate amount in USD"),
    customerRate: z.number().optional().describe("Updated customer rate amount"),
    carrierRate: z.number().optional().describe("Updated carrier rate amount"),
    customerName: z.string().optional().describe("Updated customer name"),
    originAddress: z.string().optional().describe("Updated origin street address"),
    originCity: z.string().optional().describe("Updated origin city"),
    originState: z.string().optional().describe("Updated origin state code"),
    originZip: z.string().optional().describe("Updated origin postal/ZIP code"),
    destAddress: z.string().optional().describe("Updated destination street address"),
    destCity: z.string().optional().describe("Updated destination city"),
    destState: z.string().optional().describe("Updated destination state code"),
    destZip: z.string().optional().describe("Updated destination postal/ZIP code"),
    pickupDate: z.string().optional().describe("YYYY-MM-DD pickup date"),
    deliveryDate: z.string().optional().describe("YYYY-MM-DD delivery date"),
    equipmentType: z
      .enum(["Dry Van", "Reefer", "Flatbed", "Step Deck", "Power Only", "Box Truck"])
      .optional(),
    commodity: z.string().optional().describe("Description of goods"),
    weight: z.number().optional().describe("Weight in lbs"),
    miles: z.number().optional().describe("Total route miles"),
    temperature: z.string().optional().describe("Reefer temperature setting"),
    isRefrigerated: z.boolean().optional(),
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
    if (params.customerRate !== undefined) updates.customerRate = String(params.customerRate)
    if (params.carrierRate !== undefined) updates.carrierRate = String(params.carrierRate)
    if (params.customerName) updates.customerName = params.customerName
    if (params.originAddress !== undefined) updates.originAddress = params.originAddress
    if (params.originCity !== undefined) updates.originCity = params.originCity
    if (params.originState !== undefined) {
      updates.originState = normalizeSubdivisionCode("US", params.originState)
    }
    if (params.originZip !== undefined) updates.originZip = params.originZip
    if (params.destAddress !== undefined) updates.destAddress = params.destAddress
    if (params.destCity !== undefined) updates.destCity = params.destCity
    if (params.destState !== undefined) {
      updates.destState = normalizeSubdivisionCode("US", params.destState)
    }
    if (params.destZip !== undefined) updates.destZip = params.destZip
    if (params.pickupDate) updates.pickupDate = new Date(params.pickupDate)
    if (params.deliveryDate) updates.deliveryDate = new Date(params.deliveryDate)
    if (params.equipmentType) updates.loadType = params.equipmentType
    if (params.commodity !== undefined) updates.commodity = params.commodity
    if (params.weight !== undefined) updates.weight = String(params.weight)
    if (params.miles !== undefined) updates.miles = String(params.miles)
    if (params.temperature !== undefined) updates.temperature = params.temperature
    if (params.isRefrigerated !== undefined) updates.isRefrigerated = params.isRefrigerated
    if (params.specialInstructions !== undefined) updates.specialInstructions = params.specialInstructions

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

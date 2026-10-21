import { z } from "zod"
import { randomUUID } from "node:crypto"
import { eq, and, or, ilike } from "drizzle-orm"
import { db } from "@/lib/db"
import { load, trip, driver, truck, trailer, carrier } from "@/lib/schema"
import { recordAuditEvent } from "@/lib/audit"
import { dispatchNotificationEvent } from "@/lib/notifications"
import { defineTmsTool, hasPermission, permissionDeniedResult } from "../types"

export const dispatchTripTool = defineTmsTool({
  name: "dispatchTrip",
  description: "Assign an available driver, tractor unit, or partner carrier to an active load, officially dispatching the trip.",
  requiredPermissions: ["loads.assign_driver", "loads.assign_truck"],
  inputSchema: z.object({
    loadIdentifier: z.string().optional().describe("Load ID (UUID) or Load Number (e.g. 'LD-1001')"),
    loadId: z.string().optional().describe("Load UUID if known"),
    driverIdentifier: z.string().optional().describe("Driver ID (UUID) or Driver Name (e.g. 'John Doe' or 'John')"),
    driverId: z.string().optional().describe("Driver UUID if known"),
    truckIdentifier: z.string().optional().describe("Tractor ID (UUID) or Unit Number (e.g. 'TRK-104' or '104')"),
    truckId: z.string().optional().describe("Tractor UUID if known"),
    trailerIdentifier: z.string().optional().describe("Trailer ID (UUID) or Unit Number (e.g. 'TLR-5301')"),
    trailerId: z.string().optional().describe("Trailer UUID if known"),
    carrierIdentifier: z.string().optional().describe("Partner carrier name, MC#, or ID if brokering out"),
    carrierRate: z.number().optional().describe("Carrier pay / rate in USD"),
  }),
  execute: async (params, ctx) => {
    if (!hasPermission(ctx, ["loads.assign_driver", "loads.assign_truck", "loads.edit", "loads.module"])) {
      return permissionDeniedResult(["loads.assign_driver", "loads.assign_truck"])
    }

    const loadTarget = params.loadId || params.loadIdentifier
    if (!loadTarget) {
      return { success: false, error: "Please specify loadId or loadIdentifier (e.g. 'LD-1001')." }
    }

    // 1. Resolve Load
    const [targetLoad] = await db
      .select()
      .from(load)
      .where(
        and(
          eq(load.tenantId, ctx.tenantId),
          or(
            eq(load.id, loadTarget),
            eq(load.loadNumber, loadTarget),
            ilike(load.loadNumber, `%${loadTarget}%`)
          )
        )
      )
      .limit(1)

    if (!targetLoad) {
      return { success: false, error: `Load '${loadTarget}' not found or unauthorized.` }
    }

    // 2. Resolve Driver if specified
    let resolvedDriverId: string | null = null
    let resolvedDriverName = "Unassigned"
    const driverTarget = params.driverId || params.driverIdentifier
    if (driverTarget) {
      const [matchedDriver] = await db
        .select()
        .from(driver)
        .where(
          and(
            eq(driver.tenantId, ctx.tenantId),
            or(
              eq(driver.id, driverTarget),
              ilike(driver.firstName, `%${driverTarget}%`),
              ilike(driver.lastName, `%${driverTarget}%`)
            )
          )
        )
        .limit(1)

      if (matchedDriver) {
        resolvedDriverId = matchedDriver.id
        resolvedDriverName = `${matchedDriver.firstName} ${matchedDriver.lastName}`
      }
    }

    // 3. Resolve Truck if specified
    let resolvedTruckId: string | null = null
    let resolvedTruckUnit = "None"
    const truckTarget = params.truckId || params.truckIdentifier
    if (truckTarget) {
      const [matchedTruck] = await db
        .select()
        .from(truck)
        .where(
          and(
            eq(truck.tenantId, ctx.tenantId),
            or(
              eq(truck.id, truckTarget),
              eq(truck.unitNumber, truckTarget),
              ilike(truck.unitNumber, `%${truckTarget}%`)
            )
          )
        )
        .limit(1)

      if (matchedTruck) {
        resolvedTruckId = matchedTruck.id
        resolvedTruckUnit = matchedTruck.unitNumber
      }
    }

    // 4. Resolve Trailer if specified
    let resolvedTrailerId: string | null = null
    const trailerTarget = params.trailerId || params.trailerIdentifier
    if (trailerTarget) {
      const [matchedTrailer] = await db
        .select()
        .from(trailer)
        .where(
          and(
            eq(trailer.tenantId, ctx.tenantId),
            or(
              eq(trailer.id, trailerTarget),
              eq(trailer.unitNumber, trailerTarget),
              ilike(trailer.unitNumber, `%${trailerTarget}%`)
            )
          )
        )
        .limit(1)

      if (matchedTrailer) {
        resolvedTrailerId = matchedTrailer.id
      }
    }

    // 5. Resolve Carrier if specified
    let resolvedCarrierId: string | null = null
    let resolvedCarrierName: string | null = null
    const carrierTarget = params.carrierIdentifier
    if (carrierTarget) {
      const [matchedCarrier] = await db
        .select()
        .from(carrier)
        .where(
          and(
            eq(carrier.tenantId, ctx.tenantId),
            or(
              eq(carrier.id, carrierTarget),
              eq(carrier.mcNumber, carrierTarget),
              ilike(carrier.name, `%${carrierTarget}%`)
            )
          )
        )
        .limit(1)

      if (matchedCarrier) {
        resolvedCarrierId = matchedCarrier.id
        resolvedCarrierName = matchedCarrier.name
      }
    }

    const tripId = randomUUID()
    const tripNum = `TRP-${Math.floor(1000 + Math.random() * 9000)}`

    await db.insert(trip).values({
      id: tripId,
      tenantId: ctx.tenantId,
      loadId: targetLoad.id,
      driverId: resolvedDriverId,
      truckId: resolvedTruckId,
      trailerId: resolvedTrailerId,
      carrierId: resolvedCarrierId,
      carrierRate: params.carrierRate ? String(params.carrierRate) : null,
      tripNumber: tripNum,
      status: "dispatched",
      startDate: new Date(),
    })

    await db
      .update(load)
      .set({ status: "dispatched", updatedAt: new Date() })
      .where(eq(load.id, targetLoad.id))

    await recordAuditEvent({
      actor: { id: ctx.userId, email: ctx.userEmail },
      action: "trip.create",
      target: { type: "trip", id: tripId, label: tripNum },
      metadata: {
        loadNumber: targetLoad.loadNumber,
        driver: resolvedDriverName,
        truck: resolvedTruckUnit,
        carrier: resolvedCarrierName,
        tenantId: ctx.tenantId,
      },
    })

    await dispatchNotificationEvent({
      organizationId: ctx.tenantId,
      category: "trip",
      event: "trip.dispatched_by_copilot",
      severity: "success",
      title: `Trip #${tripNum} Dispatched`,
      message: `Assigned Load #${targetLoad.loadNumber} to ${resolvedDriverName} (${resolvedTruckUnit}).`,
      link: `/trips/${tripId}`,
    })

    return {
      success: true,
      tripId,
      tripNumber: tripNum,
      loadNumber: targetLoad.loadNumber,
      driverName: resolvedDriverName,
      truckUnit: resolvedTruckUnit,
      carrierName: resolvedCarrierName || undefined,
      carrierRate: params.carrierRate ? `$${params.carrierRate.toLocaleString()}` : undefined,
      status: "dispatched",
      message: `Trip #${tripNum} created. Load #${targetLoad.loadNumber} dispatched to ${resolvedDriverName} in Tractor #${resolvedTruckUnit}.`,
    }
  },
})

export const updateTripTool = defineTmsTool({
  name: "updateTrip",
  description: "Update a trip's assigned driver, tractor, trailer, status, or carrier rates.",
  requiredPermissions: ["loads.edit"],
  inputSchema: z.object({
    tripIdentifier: z.string().optional().describe("Trip ID (UUID) or Trip Number (e.g. 'TRP-1040')"),
    tripId: z.string().optional().describe("Trip UUID if known"),
    driverIdentifier: z.string().optional().describe("Reassign driver by name or ID"),
    truckIdentifier: z.string().optional().describe("Reassign tractor by unit number or ID"),
    trailerIdentifier: z.string().optional().describe("Reassign trailer by unit number or ID"),
    carrierIdentifier: z.string().optional().describe("Reassign carrier by name or ID"),
    carrierRate: z.number().optional().describe("Updated carrier rate"),
    status: z.enum(["pending", "dispatched", "in_transit", "completed", "cancelled"]).optional(),
    totalMiles: z.number().optional().describe("Actual total miles completed"),
    totalExpense: z.number().optional().describe("Total trip expenses"),
    notes: z.string().optional().describe("Updated trip notes"),
  }),
  execute: async (params, ctx) => {
    if (!hasPermission(ctx, ["loads.edit", "loads.update_status", "loads.module"])) {
      return permissionDeniedResult(["loads.edit"])
    }

    const tripTarget = params.tripId || params.tripIdentifier
    if (!tripTarget) {
      return { success: false, error: "Please specify tripId or tripIdentifier (e.g. 'TRP-1040')." }
    }

    const [existing] = await db
      .select()
      .from(trip)
      .where(
        and(
          eq(trip.tenantId, ctx.tenantId),
          or(
            eq(trip.id, tripTarget),
            eq(trip.tripNumber, tripTarget),
            ilike(trip.tripNumber, `%${tripTarget}%`)
          )
        )
      )
      .limit(1)

    if (!existing) {
      return { success: false, error: `Trip '${tripTarget}' not found.` }
    }

    const updates: Record<string, any> = { updatedAt: new Date() }
    if (params.status) {
      updates.status = params.status
      if (params.status === "completed") {
        updates.endDate = new Date()
      }
    }
    if (params.totalMiles !== undefined) updates.totalMiles = String(params.totalMiles)
    if (params.totalExpense !== undefined) updates.totalExpense = String(params.totalExpense)
    if (params.carrierRate !== undefined) updates.carrierRate = String(params.carrierRate)
    if (params.notes !== undefined) updates.notes = params.notes

    if (params.driverIdentifier) {
      const [matchedDriver] = await db
        .select()
        .from(driver)
        .where(
          and(
            eq(driver.tenantId, ctx.tenantId),
            or(
              eq(driver.id, params.driverIdentifier),
              ilike(driver.firstName, `%${params.driverIdentifier}%`),
              ilike(driver.lastName, `%${params.driverIdentifier}%`)
            )
          )
        )
        .limit(1)
      if (matchedDriver) updates.driverId = matchedDriver.id
    }

    if (params.truckIdentifier) {
      const [matchedTruck] = await db
        .select()
        .from(truck)
        .where(
          and(
            eq(truck.tenantId, ctx.tenantId),
            or(
              eq(truck.id, params.truckIdentifier),
              eq(truck.unitNumber, params.truckIdentifier),
              ilike(truck.unitNumber, `%${params.truckIdentifier}%`)
            )
          )
        )
        .limit(1)
      if (matchedTruck) updates.truckId = matchedTruck.id
    }

    if (params.trailerIdentifier) {
      const [matchedTrailer] = await db
        .select()
        .from(trailer)
        .where(
          and(
            eq(trailer.tenantId, ctx.tenantId),
            or(
              eq(trailer.id, params.trailerIdentifier),
              eq(trailer.unitNumber, params.trailerIdentifier),
              ilike(trailer.unitNumber, `%${params.trailerIdentifier}%`)
            )
          )
        )
        .limit(1)
      if (matchedTrailer) updates.trailerId = matchedTrailer.id
    }

    await db
      .update(trip)
      .set(updates)
      .where(and(eq(trip.id, existing.id), eq(trip.tenantId, ctx.tenantId)))

    // Sync load status if changed
    if (existing.loadId && params.status) {
      if (params.status === "in_transit") {
        await db.update(load).set({ status: "in_transit", updatedAt: new Date() }).where(eq(load.id, existing.loadId))
      } else if (params.status === "completed") {
        await db.update(load).set({ status: "delivered", updatedAt: new Date() }).where(eq(load.id, existing.loadId))
      }
    }

    await recordAuditEvent({
      actor: { id: ctx.userId, email: ctx.userEmail },
      action: "trip.update",
      target: { type: "trip", id: existing.id, label: existing.tripNumber },
      metadata: { updates, tenantId: ctx.tenantId },
    })

    return {
      success: true,
      tripId: existing.id,
      tripNumber: existing.tripNumber,
      status: params.status || existing.status,
      updatedFields: Object.keys(updates).filter((k) => k !== "updatedAt"),
      message: `Trip #${existing.tripNumber} updated successfully.`,
    }
  },
})

export const updateTripStatusTool = defineTmsTool({
  name: "updateTripStatus",
  description: "Quickly update the dispatch status (in_transit, completed, cancelled) or mileage of a trip.",
  requiredPermissions: ["loads.update_status"],
  inputSchema: z.object({
    tripIdentifier: z.string().optional().describe("Trip ID (UUID) or Trip Number (e.g. 'TRP-1040')"),
    tripId: z.string().optional().describe("Trip UUID if known"),
    status: z.enum(["pending", "dispatched", "in_transit", "completed", "cancelled"]).describe("New trip status"),
    totalMiles: z.number().optional().describe("Actual total miles completed"),
    totalExpense: z.number().optional().describe("Total trip expenses"),
  }),
  execute: async (params, ctx) => {
    if (!hasPermission(ctx, ["loads.update_status", "loads.edit", "loads.module"])) {
      return permissionDeniedResult(["loads.update_status"])
    }

    const tripTarget = params.tripId || params.tripIdentifier
    if (!tripTarget) {
      return { success: false, error: "Please specify tripId or tripIdentifier (e.g. 'TRP-1040')." }
    }

    const [existing] = await db
      .select()
      .from(trip)
      .where(
        and(
          eq(trip.tenantId, ctx.tenantId),
          or(
            eq(trip.id, tripTarget),
            eq(trip.tripNumber, tripTarget),
            ilike(trip.tripNumber, `%${tripTarget}%`)
          )
        )
      )
      .limit(1)

    if (!existing) {
      return { success: false, error: "Trip not found." }
    }

    const updates: Record<string, any> = { status: params.status, updatedAt: new Date() }
    if (params.status === "completed") {
      updates.endDate = new Date()
    }
    if (params.totalMiles !== undefined) updates.totalMiles = String(params.totalMiles)
    if (params.totalExpense !== undefined) updates.totalExpense = String(params.totalExpense)

    await db
      .update(trip)
      .set(updates)
      .where(and(eq(trip.id, existing.id), eq(trip.tenantId, ctx.tenantId)))

    if (existing.loadId) {
      if (params.status === "in_transit") {
        await db.update(load).set({ status: "in_transit", updatedAt: new Date() }).where(eq(load.id, existing.loadId))
      } else if (params.status === "completed") {
        await db.update(load).set({ status: "delivered", updatedAt: new Date() }).where(eq(load.id, existing.loadId))
      }
    }

    await recordAuditEvent({
      actor: { id: ctx.userId, email: ctx.userEmail },
      action: "trip.update",
      target: { type: "trip", id: existing.id, label: existing.tripNumber },
      metadata: { status: params.status, tenantId: ctx.tenantId },
    })

    return {
      success: true,
      tripNumber: existing.tripNumber,
      status: params.status,
      message: `Trip #${existing.tripNumber} status updated to '${params.status}'.`,
    }
  },
})


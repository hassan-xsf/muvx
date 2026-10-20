import { z } from "zod"
import { randomUUID } from "node:crypto"
import { eq, and } from "drizzle-orm"
import { db } from "@/lib/db"
import { load, trip, driver } from "@/lib/schema"
import { recordAuditEvent } from "@/lib/audit"
import { dispatchNotificationEvent } from "@/lib/notifications"
import { defineTmsTool, hasPermission, permissionDeniedResult } from "../types"

export const dispatchTripTool = defineTmsTool({
  name: "dispatchTrip",
  description: "Assign an available driver and tractor unit to an active load, officially dispatching the trip.",
  requiredPermissions: ["loads.assign_driver", "loads.assign_truck"],
  inputSchema: z.object({
    loadId: z.string().describe("ID of the load to dispatch"),
    driverId: z.string().describe("ID of the driver to assign"),
    truckId: z.string().optional().describe("ID of the tractor/truck"),
    trailerId: z.string().optional().describe("ID of the trailer"),
  }),
  execute: async ({ loadId, driverId, truckId, trailerId }, ctx) => {
    if (!hasPermission(ctx, ["loads.assign_driver", "loads.assign_truck", "loads.edit", "loads.module"])) {
      return permissionDeniedResult(["loads.assign_driver", "loads.assign_truck"])
    }

    const [targetLoad] = await db
      .select()
      .from(load)
      .where(and(eq(load.id, loadId), eq(load.tenantId, ctx.tenantId)))
      .limit(1)

    if (!targetLoad) {
      return { success: false, error: "Load not found or unauthorized." }
    }

    const [assignedDriver] = await db
      .select()
      .from(driver)
      .where(and(eq(driver.id, driverId), eq(driver.tenantId, ctx.tenantId)))
      .limit(1)

    const tripId = randomUUID()
    const tripNum = `TRP-${Math.floor(1000 + Math.random() * 9000)}`

    await db.insert(trip).values({
      id: tripId,
      tenantId: ctx.tenantId,
      loadId,
      driverId,
      truckId: truckId ?? null,
      trailerId: trailerId ?? null,
      tripNumber: tripNum,
      status: "dispatched",
      startDate: new Date(),
    })

    await db
      .update(load)
      .set({ status: "dispatched" })
      .where(eq(load.id, loadId))

    await recordAuditEvent({
      actor: { id: ctx.userId, email: ctx.userEmail },
      action: "trip.create",
      target: { type: "trip", id: tripId, label: tripNum },
      metadata: {
        loadNumber: targetLoad.loadNumber,
        driver: assignedDriver ? `${assignedDriver.firstName} ${assignedDriver.lastName}` : driverId,
        tenantId: ctx.tenantId,
      },
    })

    await dispatchNotificationEvent({
      organizationId: ctx.tenantId,
      category: "trip",
      event: "trip.dispatched_by_copilot",
      severity: "success",
      title: `Trip #${tripNum} Dispatched`,
      message: `Assigned Load #${targetLoad.loadNumber} to ${assignedDriver ? `${assignedDriver.firstName} ${assignedDriver.lastName}` : "driver"}.`,
      link: `/trips/${tripId}`,
    })

    return {
      success: true,
      tripId,
      tripNumber: tripNum,
      loadNumber: targetLoad.loadNumber,
      driverName: assignedDriver ? `${assignedDriver.firstName} ${assignedDriver.lastName}` : "Assigned Driver",
      status: "dispatched",
      message: `Trip #${tripNum} created. Load #${targetLoad.loadNumber} status updated to 'dispatched'.`,
    }
  },
})

export const updateTripStatusTool = defineTmsTool({
  name: "updateTripStatus",
  description: "Update status, odometer miles, or financial totals of a dispatched trip.",
  requiredPermissions: ["loads.update_status"],
  inputSchema: z.object({
    tripId: z.string().describe("ID of the trip"),
    status: z.enum(["pending", "dispatched", "in_transit", "completed", "cancelled"]).describe("New trip status"),
    totalMiles: z.number().optional().describe("Actual total miles completed"),
    totalExpense: z.number().optional().describe("Total trip expenses"),
  }),
  execute: async ({ tripId, status: newStatus, totalMiles, totalExpense }, ctx) => {
    if (!hasPermission(ctx, ["loads.update_status", "loads.edit", "loads.module"])) {
      return permissionDeniedResult(["loads.update_status"])
    }

    const [existing] = await db
      .select()
      .from(trip)
      .where(and(eq(trip.id, tripId), eq(trip.tenantId, ctx.tenantId)))
      .limit(1)

    if (!existing) {
      return { success: false, error: "Trip not found." }
    }

    const updates: Record<string, any> = { status: newStatus }
    if (newStatus === "completed") {
      updates.endDate = new Date()
    }
    if (totalMiles !== undefined) updates.totalMiles = String(totalMiles)
    if (totalExpense !== undefined) updates.totalExpense = String(totalExpense)

    await db
      .update(trip)
      .set(updates)
      .where(and(eq(trip.id, tripId), eq(trip.tenantId, ctx.tenantId)))

    if (existing.loadId) {
      if (newStatus === "in_transit") {
        await db.update(load).set({ status: "in_transit" }).where(eq(load.id, existing.loadId))
      } else if (newStatus === "completed") {
        await db.update(load).set({ status: "delivered" }).where(eq(load.id, existing.loadId))
      }
    }

    await recordAuditEvent({
      actor: { id: ctx.userId, email: ctx.userEmail },
      action: "trip.update",
      target: { type: "trip", id: tripId, label: existing.tripNumber },
      metadata: { status: newStatus, tenantId: ctx.tenantId },
    })

    return {
      success: true,
      tripNumber: existing.tripNumber,
      status: newStatus,
      message: `Trip #${existing.tripNumber} status updated to '${newStatus}'.`,
    }
  },
})

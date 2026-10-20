import { z } from "zod"
import { randomUUID } from "node:crypto"
import { eq, and } from "drizzle-orm"
import { db } from "@/lib/db"
import { driver, truck, trailer } from "@/lib/schema"
import { recordAuditEvent } from "@/lib/audit"
import { defineTmsTool, hasPermission, permissionDeniedResult } from "../types"

export const getFleetStatusTool = defineTmsTool({
  name: "getFleetStatus",
  description: "Query real driver availability, tractor unit status, and flag CDL license expirations within 30 days.",
  requiredPermissions: ["drivers.view_all", "fleet.view_all", "fleet.module", "drivers.module"],
  inputSchema: z.object({
    statusFilter: z.enum(["all", "active", "on_duty", "inactive"]).default("all"),
  }),
  execute: async ({ statusFilter }, ctx) => {
    if (!hasPermission(ctx, ["drivers.view_all", "fleet.view_all", "fleet.module", "drivers.module", "safety.module"])) {
      return permissionDeniedResult(["drivers.view_all", "fleet.view_all"])
    }

    const driverConditions = [eq(driver.tenantId, ctx.tenantId)]
    if (statusFilter !== "all") {
      driverConditions.push(eq(driver.status, statusFilter))
    }

    const drivers = await db
      .select({
        id: driver.id,
        firstName: driver.firstName,
        lastName: driver.lastName,
        phone: driver.phone,
        email: driver.email,
        cdlNumber: driver.cdlNumber,
        cdlState: driver.cdlState,
        cdlExpiry: driver.cdlExpiration,
        status: driver.status,
      })
      .from(driver)
      .where(and(...driverConditions))
      .limit(15)

    const trucks = await db
      .select({
        id: truck.id,
        unitNumber: truck.unitNumber,
        make: truck.make,
        model: truck.model,
        year: truck.year,
        status: truck.status,
        currentMiles: truck.currentMiles,
      })
      .from(truck)
      .where(eq(truck.tenantId, ctx.tenantId))
      .limit(15)

    const now = new Date()
    const thirtyDaysFromNow = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)

    const driverList = drivers.map((d) => {
      const expiry = d.cdlExpiry ? new Date(d.cdlExpiry) : null
      const isExpiringSoon = expiry ? expiry <= thirtyDaysFromNow : false
      const isExpired = expiry ? expiry < now : false

      return {
        id: d.id,
        name: `${d.firstName} ${d.lastName}`,
        phone: d.phone || "N/A",
        status: d.status,
        license: `${d.cdlState || ""} ${d.cdlNumber || "N/A"}`.trim(),
        licenseExpiry: expiry ? expiry.toISOString().slice(0, 10) : "Not on file",
        cdlAlert: isExpired ? "EXPIRED" : isExpiringSoon ? "EXPIRING_SOON" : "VALID",
      }
    })

    return {
      activeDriversCount: drivers.filter((d) => d.status === "active").length,
      availableTrucksCount: trucks.filter((t) => t.status === "available").length,
      drivers: driverList,
      trucks: trucks.map((t) => ({
        id: t.id,
        unitNumber: t.unitNumber,
        model: `${t.year || ""} ${t.make || ""} ${t.model || ""}`.trim() || "Tractor",
        status: t.status,
        odometer: t.currentMiles ? `${parseFloat(t.currentMiles).toLocaleString()} mi` : "N/A",
      })),
      complianceSummary: {
        totalDrivers: drivers.length,
        expiringSoonCount: driverList.filter((d) => d.cdlAlert === "EXPIRING_SOON").length,
        expiredCount: driverList.filter((d) => d.cdlAlert === "EXPIRED").length,
      },
    }
  },
})

export const createDriverTool = defineTmsTool({
  name: "createDriver",
  description: "Add a new commercial driver to the fleet directory.",
  requiredPermissions: ["drivers.create"],
  inputSchema: z.object({
    firstName: z.string().describe("Driver first name"),
    lastName: z.string().describe("Driver last name"),
    phone: z.string().optional().describe("Contact phone number"),
    email: z.string().email().optional().describe("Email address"),
    licenseNumber: z.string().describe("Commercial Driver License (CDL) number"),
    licenseState: z.string().describe("2-letter licensing state code (e.g. TX)"),
    licenseExpiration: z.string().describe("YYYY-MM-DD CDL expiration date"),
    notes: z.string().optional().describe("Qualifications or certifications"),
  }),
  execute: async (params, ctx) => {
    if (!hasPermission(ctx, ["drivers.create", "fleet.create"])) {
      return permissionDeniedResult(["drivers.create"])
    }

    const driverId = randomUUID()

    await db.insert(driver).values({
      id: driverId,
      tenantId: ctx.tenantId,
      firstName: params.firstName,
      lastName: params.lastName,
      phone: params.phone ?? null,
      email: params.email ?? null,
      cdlNumber: params.licenseNumber,
      cdlState: params.licenseState,
      cdlExpiration: new Date(params.licenseExpiration),
      status: "active",
      notes: params.notes ?? null,
    })

    await recordAuditEvent({
      actor: { id: ctx.userId, email: ctx.userEmail },
      action: "driver.create",
      target: { type: "driver", id: driverId, label: `${params.firstName} ${params.lastName}` },
      metadata: { licenseState: params.licenseState, tenantId: ctx.tenantId },
    })

    return {
      success: true,
      driverId,
      name: `${params.firstName} ${params.lastName}`,
      license: `${params.licenseState} ${params.licenseNumber}`,
      expiration: params.licenseExpiration,
      status: "active",
      message: `Driver ${params.firstName} ${params.lastName} added to fleet.`,
    }
  },
})

export const updateDriverTool = defineTmsTool({
  name: "updateDriver",
  description: "Update a driver's CDL renewal date, active status, or contact information.",
  requiredPermissions: ["drivers.edit"],
  inputSchema: z.object({
    driverId: z.string().describe("ID of the driver"),
    status: z.enum(["active", "inactive", "on_duty"]).optional().describe("New status"),
    licenseExpiration: z.string().optional().describe("Updated YYYY-MM-DD CDL expiration date"),
    phone: z.string().optional().describe("Updated phone number"),
    email: z.string().email().optional().describe("Updated email"),
    notes: z.string().optional().describe("Updated notes"),
  }),
  execute: async (params, ctx) => {
    if (!hasPermission(ctx, ["drivers.edit", "fleet.edit"])) {
      return permissionDeniedResult(["drivers.edit"])
    }

    const [existing] = await db
      .select()
      .from(driver)
      .where(and(eq(driver.id, params.driverId), eq(driver.tenantId, ctx.tenantId)))
      .limit(1)

    if (!existing) {
      return { success: false, error: "Driver not found." }
    }

    const updates: Record<string, any> = {}
    if (params.status) updates.status = params.status
    if (params.licenseExpiration) updates.cdlExpiration = new Date(params.licenseExpiration)
    if (params.phone) updates.phone = params.phone
    if (params.email) updates.email = params.email
    if (params.notes) updates.notes = params.notes

    await db
      .update(driver)
      .set(updates)
      .where(and(eq(driver.id, params.driverId), eq(driver.tenantId, ctx.tenantId)))

    await recordAuditEvent({
      actor: { id: ctx.userId, email: ctx.userEmail },
      action: "driver.update",
      target: { type: "driver", id: existing.id, label: `${existing.firstName} ${existing.lastName}` },
      metadata: { updates, tenantId: ctx.tenantId },
    })

    return {
      success: true,
      name: `${existing.firstName} ${existing.lastName}`,
      status: params.status || existing.status,
      message: `Driver record updated successfully.`,
    }
  },
})

export const createTruckTool = defineTmsTool({
  name: "createTruck",
  description: "Register a commercial tractor unit in the fleet inventory.",
  requiredPermissions: ["fleet.create"],
  inputSchema: z.object({
    unitNumber: z.string().describe("Truck/unit number (e.g. TRK-104)"),
    vin: z.string().optional().describe("17-character Vehicle Identification Number"),
    make: z.string().optional().describe("Manufacturer (e.g. Freightliner, Kenworth, Peterbilt)"),
    model: z.string().optional().describe("Model name (e.g. Cascadia, T680)"),
    year: z.string().optional().describe("Model year (e.g. 2024)"),
    licensePlate: z.string().optional().describe("License plate number"),
    currentMiles: z.number().optional().describe("Current odometer reading"),
  }),
  execute: async (params, ctx) => {
    if (!hasPermission(ctx, ["fleet.create", "fleet.trucks.create"])) {
      return permissionDeniedResult(["fleet.create"])
    }

    const truckId = randomUUID()

    await db.insert(truck).values({
      id: truckId,
      tenantId: ctx.tenantId,
      unitNumber: params.unitNumber,
      vin: params.vin ?? null,
      make: params.make ?? null,
      model: params.model ?? null,
      year: params.year ?? null,
      licensePlate: params.licensePlate ?? null,
      currentMiles: params.currentMiles ? String(params.currentMiles) : null,
      status: "available",
    })

    await recordAuditEvent({
      actor: { id: ctx.userId, email: ctx.userEmail },
      action: "truck.create",
      target: { type: "truck", id: truckId, label: params.unitNumber },
      metadata: { unitNumber: params.unitNumber, make: params.make, tenantId: ctx.tenantId },
    })

    return {
      success: true,
      truckId,
      unitNumber: params.unitNumber,
      makeModel: `${params.year || ""} ${params.make || ""} ${params.model || ""}`.trim(),
      status: "available",
      message: `Tractor Unit #${params.unitNumber} registered.`,
    }
  },
})

export const updateTruckTool = defineTmsTool({
  name: "updateTruck",
  description: "Update tractor status (available, maintenance, out_of_service) or odometer miles.",
  requiredPermissions: ["fleet.edit"],
  inputSchema: z.object({
    truckId: z.string().describe("ID of the truck/tractor"),
    status: z.enum(["available", "dispatched", "maintenance", "out_of_service"]).optional().describe("New status"),
    currentMiles: z.number().optional().describe("Updated odometer miles"),
    nextServiceMiles: z.number().optional().describe("Next scheduled service miles"),
  }),
  execute: async ({ truckId, status: newStatus, currentMiles, nextServiceMiles }, ctx) => {
    if (!hasPermission(ctx, ["fleet.edit", "fleet.trucks.edit"])) {
      return permissionDeniedResult(["fleet.edit"])
    }

    const [existing] = await db
      .select()
      .from(truck)
      .where(and(eq(truck.id, truckId), eq(truck.tenantId, ctx.tenantId)))
      .limit(1)

    if (!existing) {
      return { success: false, error: "Truck not found." }
    }

    const updates: Record<string, any> = {}
    if (newStatus) updates.status = newStatus
    if (currentMiles !== undefined) updates.currentMiles = String(currentMiles)
    if (nextServiceMiles !== undefined) updates.nextServiceMiles = String(nextServiceMiles)

    await db
      .update(truck)
      .set(updates)
      .where(and(eq(truck.id, truckId), eq(truck.tenantId, ctx.tenantId)))

    return {
      success: true,
      unitNumber: existing.unitNumber,
      status: newStatus || existing.status,
      odometer: currentMiles !== undefined ? `${currentMiles.toLocaleString()} mi` : existing.currentMiles,
      message: `Tractor #${existing.unitNumber} updated successfully.`,
    }
  },
})

export const createTrailerTool = defineTmsTool({
  name: "createTrailer",
  description: "Register a trailer (Dry Van, Reefer, Flatbed, Step Deck) in the fleet inventory.",
  requiredPermissions: ["fleet.create"],
  inputSchema: z.object({
    unitNumber: z.string().describe("Trailer unit number (e.g. TLR-5301)"),
    type: z.enum(["Dry Van", "Reefer", "Flatbed", "Step Deck", "Power Only"]).default("Dry Van"),
    length: z.string().default("53'").describe("Length (e.g. 53', 48')"),
    licensePlate: z.string().optional().describe("License plate"),
  }),
  execute: async (params, ctx) => {
    if (!hasPermission(ctx, ["fleet.create", "fleet.trailers.create"])) {
      return permissionDeniedResult(["fleet.create"])
    }

    const trailerId = randomUUID()

    await db.insert(trailer).values({
      id: trailerId,
      tenantId: ctx.tenantId,
      unitNumber: params.unitNumber,
      type: params.type,
      length: params.length,
      licensePlate: params.licensePlate ?? null,
      status: "available",
    })

    return {
      success: true,
      trailerId,
      unitNumber: params.unitNumber,
      type: params.type,
      length: params.length,
      status: "available",
      message: `Trailer #${params.unitNumber} (${params.type}) registered.`,
    }
  },
})

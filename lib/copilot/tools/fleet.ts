import { z } from "zod"
import { randomUUID } from "node:crypto"
import { eq, and, or, ilike } from "drizzle-orm"
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
  description: "Update a driver's name, CDL license, active status, contact info, pay rate, or notes.",
  requiredPermissions: ["drivers.edit"],
  inputSchema: z.object({
    driverIdentifier: z.string().optional().describe("Driver ID (UUID) or full name (e.g. 'John Doe' or 'John')"),
    driverId: z.string().optional().describe("Driver UUID if known"),
    firstName: z.string().optional().describe("Updated driver first name"),
    lastName: z.string().optional().describe("Updated driver last name"),
    status: z.enum(["active", "inactive", "on_duty"]).optional().describe("New status"),
    licenseNumber: z.string().optional().describe("Updated CDL license number"),
    licenseState: z.string().optional().describe("Updated 2-letter licensing state code (e.g. TX)"),
    licenseExpiration: z.string().optional().describe("Updated YYYY-MM-DD CDL expiration date"),
    phone: z.string().optional().describe("Updated phone number"),
    email: z.string().email().optional().describe("Updated email"),
    payRate: z.string().optional().describe("Updated pay rate (e.g. '0.65' or '30.00')"),
    payType: z.enum(["per_mile", "hourly", "percentage"]).optional().describe("Pay structure"),
    notes: z.string().optional().describe("Updated qualifications or notes"),
  }),
  execute: async (params, ctx) => {
    if (!hasPermission(ctx, ["drivers.edit", "fleet.edit"])) {
      return permissionDeniedResult(["drivers.edit"])
    }

    const identifier = params.driverId || params.driverIdentifier
    if (!identifier) {
      return { success: false, error: "Please specify driverId or driverIdentifier (name or ID)." }
    }

    const [existing] = await db
      .select()
      .from(driver)
      .where(
        and(
          eq(driver.tenantId, ctx.tenantId),
          or(
            eq(driver.id, identifier),
            ilike(driver.firstName, `%${identifier}%`),
            ilike(driver.lastName, `%${identifier}%`)
          )
        )
      )
      .limit(1)

    if (!existing) {
      return { success: false, error: `Driver '${identifier}' not found in fleet.` }
    }

    const updates: Record<string, any> = { updatedAt: new Date() }
    if (params.firstName !== undefined) updates.firstName = params.firstName
    if (params.lastName !== undefined) updates.lastName = params.lastName
    if (params.status) updates.status = params.status
    if (params.licenseNumber !== undefined) updates.cdlNumber = params.licenseNumber
    if (params.licenseState !== undefined) updates.cdlState = params.licenseState
    if (params.licenseExpiration) updates.cdlExpiration = new Date(params.licenseExpiration)
    if (params.phone !== undefined) updates.phone = params.phone
    if (params.email !== undefined) updates.email = params.email
    if (params.payRate !== undefined) updates.payRate = params.payRate
    if (params.payType !== undefined) updates.payType = params.payType
    if (params.notes !== undefined) updates.notes = params.notes

    await db
      .update(driver)
      .set(updates)
      .where(and(eq(driver.id, existing.id), eq(driver.tenantId, ctx.tenantId)))

    const finalFirstName = params.firstName ?? existing.firstName
    const finalLastName = params.lastName ?? existing.lastName

    await recordAuditEvent({
      actor: { id: ctx.userId, email: ctx.userEmail },
      action: "driver.update",
      target: { type: "driver", id: existing.id, label: `${finalFirstName} ${finalLastName}` },
      metadata: { updates, tenantId: ctx.tenantId },
    })

    return {
      success: true,
      driverId: existing.id,
      name: `${finalFirstName} ${finalLastName}`,
      status: params.status || existing.status,
      updatedFields: Object.keys(updates).filter((k) => k !== "updatedAt"),
      message: `Driver '${finalFirstName} ${finalLastName}' updated successfully.`,
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
  description: "Update tractor unit number, make, model, year, VIN, license plate, status, or odometer miles.",
  requiredPermissions: ["fleet.edit"],
  inputSchema: z.object({
    truckIdentifier: z.string().optional().describe("Truck ID (UUID) or Unit Number (e.g. 'TRK-104' or '104')"),
    truckId: z.string().optional().describe("Truck UUID if known"),
    unitNumber: z.string().optional().describe("Updated unit/truck number"),
    make: z.string().optional().describe("Manufacturer (e.g. Freightliner, Kenworth, Peterbilt, Volvo)"),
    model: z.string().optional().describe("Model name (e.g. Cascadia, T680, 579)"),
    year: z.string().optional().describe("Model year (e.g. 2024)"),
    vin: z.string().optional().describe("17-character Vehicle Identification Number"),
    licensePlate: z.string().optional().describe("License plate number"),
    licenseState: z.string().optional().describe("License state code (e.g. TX)"),
    status: z.enum(["available", "dispatched", "maintenance", "out_of_service"]).optional().describe("New status"),
    currentMiles: z.number().optional().describe("Updated odometer miles"),
    nextServiceMiles: z.number().optional().describe("Next scheduled service miles"),
    notes: z.string().optional().describe("Updated notes or maintenance details"),
  }),
  execute: async (params, ctx) => {
    if (!hasPermission(ctx, ["fleet.edit", "fleet.trucks.edit"])) {
      return permissionDeniedResult(["fleet.edit"])
    }

    const identifier = params.truckId || params.truckIdentifier
    if (!identifier) {
      return { success: false, error: "Please specify truckId or truckIdentifier (unit number or ID)." }
    }

    const [existing] = await db
      .select()
      .from(truck)
      .where(
        and(
          eq(truck.tenantId, ctx.tenantId),
          or(
            eq(truck.id, identifier),
            eq(truck.unitNumber, identifier),
            ilike(truck.unitNumber, `%${identifier}%`)
          )
        )
      )
      .limit(1)

    if (!existing) {
      return { success: false, error: `Truck/Tractor '${identifier}' not found in fleet.` }
    }

    const updates: Record<string, any> = { updatedAt: new Date() }
    if (params.unitNumber !== undefined) updates.unitNumber = params.unitNumber
    if (params.make !== undefined) updates.make = params.make
    if (params.model !== undefined) updates.model = params.model
    if (params.year !== undefined) updates.year = params.year
    if (params.vin !== undefined) updates.vin = params.vin
    if (params.licensePlate !== undefined) updates.licensePlate = params.licensePlate
    if (params.licenseState !== undefined) updates.licenseState = params.licenseState
    if (params.status) updates.status = params.status
    if (params.currentMiles !== undefined) updates.currentMiles = String(params.currentMiles)
    if (params.nextServiceMiles !== undefined) updates.nextServiceMiles = String(params.nextServiceMiles)
    if (params.notes !== undefined) updates.notes = params.notes

    await db
      .update(truck)
      .set(updates)
      .where(and(eq(truck.id, existing.id), eq(truck.tenantId, ctx.tenantId)))

    const finalUnitNumber = params.unitNumber ?? existing.unitNumber

    await recordAuditEvent({
      actor: { id: ctx.userId, email: ctx.userEmail },
      action: "truck.update",
      target: { type: "truck", id: existing.id, label: finalUnitNumber },
      metadata: { updates, tenantId: ctx.tenantId },
    })

    return {
      success: true,
      truckId: existing.id,
      unitNumber: finalUnitNumber,
      status: params.status || existing.status,
      odometer: params.currentMiles !== undefined ? `${params.currentMiles.toLocaleString()} mi` : existing.currentMiles,
      updatedFields: Object.keys(updates).filter((k) => k !== "updatedAt"),
      message: `Tractor #${finalUnitNumber} updated successfully.`,
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

export const updateTrailerTool = defineTmsTool({
  name: "updateTrailer",
  description: "Update trailer unit number, type, length, license plate, status, or notes.",
  requiredPermissions: ["fleet.edit"],
  inputSchema: z.object({
    trailerIdentifier: z.string().optional().describe("Trailer ID (UUID) or Unit Number (e.g. 'TLR-5301')"),
    trailerId: z.string().optional().describe("Trailer UUID if known"),
    unitNumber: z.string().optional().describe("Updated trailer unit number"),
    type: z.enum(["Dry Van", "Reefer", "Flatbed", "Step Deck", "Power Only"]).optional(),
    length: z.string().optional().describe("Updated length (e.g. 53', 48')"),
    licensePlate: z.string().optional().describe("Updated license plate"),
    status: z.enum(["available", "in_use", "maintenance", "out_of_service"]).optional(),
    notes: z.string().optional().describe("Updated trailer notes"),
  }),
  execute: async (params, ctx) => {
    if (!hasPermission(ctx, ["fleet.edit", "fleet.trailers.edit"])) {
      return permissionDeniedResult(["fleet.edit"])
    }

    const identifier = params.trailerId || params.trailerIdentifier
    if (!identifier) {
      return { success: false, error: "Please specify trailerId or trailerIdentifier (unit number or ID)." }
    }

    const [existing] = await db
      .select()
      .from(trailer)
      .where(
        and(
          eq(trailer.tenantId, ctx.tenantId),
          or(
            eq(trailer.id, identifier),
            eq(trailer.unitNumber, identifier),
            ilike(trailer.unitNumber, `%${identifier}%`)
          )
        )
      )
      .limit(1)

    if (!existing) {
      return { success: false, error: `Trailer '${identifier}' not found in fleet.` }
    }

    const updates: Record<string, any> = { updatedAt: new Date() }
    if (params.unitNumber !== undefined) updates.unitNumber = params.unitNumber
    if (params.type !== undefined) updates.type = params.type
    if (params.length !== undefined) updates.length = params.length
    if (params.licensePlate !== undefined) updates.licensePlate = params.licensePlate
    if (params.status) updates.status = params.status
    if (params.notes !== undefined) updates.notes = params.notes

    await db
      .update(trailer)
      .set(updates)
      .where(and(eq(trailer.id, existing.id), eq(trailer.tenantId, ctx.tenantId)))

    const finalUnit = params.unitNumber ?? existing.unitNumber

    return {
      success: true,
      trailerId: existing.id,
      unitNumber: finalUnit,
      type: params.type ?? existing.type,
      status: params.status || existing.status,
      updatedFields: Object.keys(updates).filter((k) => k !== "updatedAt"),
      message: `Trailer #${finalUnit} updated successfully.`,
    }
  },
})

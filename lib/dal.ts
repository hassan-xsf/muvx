import "server-only"
import { db } from "@/lib/db"
import { auth } from "@/lib/auth"
import { eq, and, desc, sql, ne, gte, isNull, inArray } from "drizzle-orm"
import { headers } from "next/headers"
import {
  customer,
  facility,
  load,
  trip,
  driver,
  truck,
  trailer,
  invoice,
  payStub,
  apExpense,
  carrier,
  carrierPayment,
  organization,
  member,
  invitation,
  user,
  signupAttempt,
  systemSetting,
  session as sessionTable,
  errorLog,
  auditLog,
  account as accountTable,
} from "@/lib/schema"
import { listAuditEvents } from "@/lib/audit"
import { cache } from "react"
import { ROLE_CATALOG } from "@/lib/auth-roles"

// ─────────────────────────────────────────────────────────────────────────────
// ROLE RESOLUTION (platform + workspace, kept distinct)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Resolved role view for a user. Distinguishes the platform role
 * (user.role) from per-workspace roles (member.role) so the admin
 * UI can show both without conflating them.
 */
export type ResolvedRole = {
  userId: string
  email: string
  name: string
  image: string | null
  /** Platform role — `"user" | "admin"` from Better Auth's admin plugin. */
  platformRole: "user" | "admin" | null
  /**
   * Per-workspace roles — one per (user, organization) membership.
   * Values: `"owner" | "admin" | "member" | "operations_manager" |
   * "dispatcher" | "accounting" | "driver" | "safety"`.
   */
  workspaceMemberships: {
    organizationId: string
    organizationName: string
    organizationSlug: string
    role: string
    createdAt: Date
  }[]
  /** The currently-active org on the user's session, if any. */
  activeOrganizationId: string | null
}

export const resolveUserRoles = cache(
  async (userId: string): Promise<ResolvedRole | null> => {
    console.log(`[DAL] resolveUserRoles ${userId}`)
    const [u] = await db
      .select({
        id: user.id,
        email: user.email,
        name: user.name,
        image: user.image,
        role: user.role,
      })
      .from(user)
      .where(eq(user.id, userId))
      .limit(1)
    if (!u) return null

    const memberships = await db
      .select({
        organizationId: member.organizationId,
        role: member.role,
        createdAt: member.createdAt,
        orgName: organization.name,
        orgSlug: organization.slug,
      })
      .from(member)
      .innerJoin(organization, eq(organization.id, member.organizationId))
      .where(eq(member.userId, userId))

    const session = await getSession()
    const activeOrganizationId =
      (session?.session as any)?.activeOrganizationId ?? null

    return {
      userId: u.id,
      email: u.email,
      name: u.name,
      image: u.image,
      platformRole: (u.role as "user" | "admin" | null) ?? "user",
      workspaceMemberships: memberships.map((m) => ({
        organizationId: m.organizationId,
        organizationName: m.orgName,
        organizationSlug: m.orgSlug,
        role: m.role,
        createdAt: m.createdAt,
      })),
      activeOrganizationId,
    }
  }
)

/** Lists every user with both role views in a single query — powers
 *  the admin "Change role" Sheet's user picker and the user detail
 *  page. Bounded to first 200 users. */
export const listUsersWithResolvedRoles = cache(
  async (opts: { search?: string; limit?: number; offset?: number } = {}) => {
    const limit = Math.min(opts.limit ?? 50, 200)
    const offset = opts.offset ?? 0
    const needle = opts.search?.trim().toLowerCase()
    console.log(
      `[DAL] listUsersWithResolvedRoles search=${needle ?? "(none)"} limit=${limit} offset=${offset}`
    )
    const conditions = []
    if (needle) {
      conditions.push(
        sql`(LOWER(${user.email}) LIKE ${`%${needle}%`} OR LOWER(${user.name}) LIKE ${`%${needle}%`})`
      )
    }
    const where = conditions.length > 0 ? and(...conditions) : undefined
    const rows = await db
      .select({
        id: user.id,
        email: user.email,
        name: user.name,
        image: user.image,
        platformRole: user.role,
        createdAt: user.createdAt,
      })
      .from(user)
      .where(where)
      .orderBy(desc(user.createdAt))
      .limit(limit)
      .offset(offset)
    return { users: rows, total: rows.length }
  }
)

// ─────────────────────────────────────────────────────────────────────────────
// AUTH CONTEXT
// ─────────────────────────────────────────────────────────────────────────────

export const getSession = cache(async () => {
  const headersList = await headers()
  return auth.api.getSession({ headers: headersList })
})

export const getCurrentUser = cache(async () => {
  const session = await getSession()
  return session?.user ?? null
})

export const getActiveOrganizationId = cache(async (): Promise<string | null> => {
  const session = await getSession()
  return session?.session?.activeOrganizationId ?? null
})

/** Thrown by requireTenant() when there is no usable tenant context.
 *  Route handlers map these to HTTP status codes via tenantErrorResponse(). */
export class TenantError extends Error {
  constructor(
    public code: "UNAUTHORIZED" | "NO_ACTIVE_ORGANIZATION" | "FORBIDDEN",
    message?: string
  ) {
    super(message ?? code)
    this.name = "TenantError"
  }
}

/**
 * Ensures we have a valid user and active organization, AND that
 * the user is not currently suspended from this workspace (WS-26).
 *
 * Platform admins (`user.role='admin'`) bypass the suspension check
 * so they can still inspect suspended workspaces.
 *
 * Use this in any Server Action or Route Handler that touches
 * tenant data — it gives the same gate as the dashboard layout.
 */
export async function requireTenant() {
  const session = await getSession()
  if (!session?.user) {
    throw new TenantError("UNAUTHORIZED")
  }
  const orgId = session.session.activeOrganizationId
  if (!orgId) {
    throw new TenantError("NO_ACTIVE_ORGANIZATION")
  }

  // WS-26 — workspace-scoped suspension gate. Skip for platform admins.
  const platformRole = (session.user as any).role ?? null
  if (platformRole !== "admin") {
    const [row] = await db
      .select({
        membershipId: member.id,
        suspendedAt: member.suspendedAt,
        suspendedUntil: member.suspendedUntil,
        organizationSuspended: organization.suspended,
      })
      .from(member)
      .innerJoin(organization, eq(organization.id, member.organizationId))
      .where(
        and(
          eq(member.userId, session.user.id),
          eq(member.organizationId, orgId),
        ),
      )
      .limit(1)
    if (!row) {
      console.log(
        `[DAL] requireTenant: user=${session.user.id} is not a member of org=${orgId} → FORBIDDEN`,
      )
      throw new TenantError("FORBIDDEN")
    }
    if (
      row.organizationSuspended ||
      row?.suspendedAt &&
      (!row.suspendedUntil ||
        (row.suspendedUntil as Date) > new Date())
    ) {
      console.log(
        `[DAL] requireTenant: user=${session.user.id} suspended from org=${orgId} → FORBIDDEN`,
      )
      throw new TenantError("FORBIDDEN")
    }
  }

  return {
    userId: session.user.id,
    userRole: platformRole,
    tenantId: orgId,
  }
}

/**
 * requirePermission — Phase 2 (R-01 from the audit).
 *
 * Wraps Better Auth's `auth.api.hasPermission` server call. Reads the
 * current session + the active-org membership role from BA's RBAC
 * declarations in `lib/auth-roles.ts`. Throws `TenantError("FORBIDDEN")`
 * on deny so `withTenant` maps it to HTTP 403.
 *
 * Usage:
 *   export const POST = withTenant(async (req, { tenantId }) => {
 *     await requirePermission({ resource: "load", action: "create" })
 *     // ...
 *   })
 */
export async function requirePermission(opts: {
  resource: string
  action: string
}): Promise<void> {
  const headersList = await headers()
  try {
    const result = await auth.api.hasPermission({
      headers: headersList,
      body: { permissions: { [opts.resource]: [opts.action] } },
    })
    if (!result?.success) {
      console.warn(
        `[DAL] requirePermission DENY: resource=${opts.resource} action=${opts.action} result=false`,
      )
      throw new TenantError("FORBIDDEN")
    }
    console.log(
      `[DAL] requirePermission ALLOW: resource=${opts.resource} action=${opts.action}`,
    )
  } catch (err) {
    if (err instanceof TenantError) throw err
    console.error(
      `[DAL] requirePermission ERROR: resource=${opts.resource} action=${opts.action}:`,
      err,
    )
    throw new TenantError("FORBIDDEN")
  }
}

/**
 * getEffectivePermissions — returns the flat set of "resource:action"
 * permission strings for a given member in a workspace.
 *
 * Used by:
 *   - /settings/roles member-level permission inspector (GAP-3)
 *   - Impact preview when changing a member's role (WS-39)
 *   - "Who has this permission?" reverse lookup
 *
 * Resolves the member's role → looks up ROLE_CATALOG → flattens all
 * (resource, action) pairs into "resource:action" strings.
 */
export async function getEffectivePermissions(
  userId: string,
  tenantId: string,
): Promise<string[]> {
  const [row] = await db
    .select({ role: member.role })
    .from(member)
    .where(
      and(eq(member.userId, userId), eq(member.organizationId, tenantId)),
    )
    .limit(1)

  if (!row) return []

  const catalogEntry = ROLE_CATALOG.find((r) => r.id === row.role)
  if (!catalogEntry) return []

  const perms: string[] = []
  for (const [resource, actions] of Object.entries(
    catalogEntry.role.statements,
  )) {
    for (const action of actions as readonly string[]) {
      perms.push(`${resource}:${action}`)
    }
  }
  return perms
}

const TENANT_ERROR_STATUS: Record<TenantError["code"], number> = {
  UNAUTHORIZED: 401,
  NO_ACTIVE_ORGANIZATION: 409,
  FORBIDDEN: 403,
}

/**
 * Wraps a route handler body so tenant errors become the right HTTP status
 * instead of a blanket 500. Usage:
 *
 *   export const POST = withTenant(async (req) => { ... })
 *   export const PATCH = withTenant(async (req, ctx, { params }) => { ... })
 */
export function withTenant<TReq, TCtx = unknown>(
  handler: (
    req: TReq,
    ctx: { tenantId: string; userId: string; userRole: string | null },
    routeCtx: TCtx
  ) => Promise<Response>
) {
  return async (req: TReq, routeCtx: TCtx): Promise<Response> => {
    try {
      return await handler(req, await requireTenant(), routeCtx)
    } catch (err) {
      if (err instanceof TenantError) {
        return Response.json({ error: err.code }, { status: TENANT_ERROR_STATUS[err.code] })
      }
      throw err
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// LOADS
// ─────────────────────────────────────────────────────────────────────────────

export const getLoadsForOrg = async (tenantId: string) => {
  return db
    .select()
    .from(load)
    .where(eq(load.tenantId, tenantId))
    .orderBy(desc(load.createdAt))
}

export const getLoadById = async (loadId: string, tenantId: string) => {
  const [result] = await db
    .select()
    .from(load)
    .where(and(eq(load.id, loadId), eq(load.tenantId, tenantId)))
    .limit(1)
  return result ?? null
}

export const getLoadWithTripDetails = async (loadId: string, tenantId: string) => {
  const [loadRecord] = await db
    .select()
    .from(load)
    .where(and(eq(load.id, loadId), eq(load.tenantId, tenantId)))
    .limit(1)

  if (!loadRecord) return null

  const [tripRecord] = await db
    .select({
      id: trip.id,
      tripNumber: trip.tripNumber,
      status: trip.status,
      startDate: trip.startDate,
      driverFirstName: driver.firstName,
      driverLastName: driver.lastName,
      driverPhone: driver.phone,
      driverLicenseNumber: driver.cdlNumber,
      truckUnitNumber: truck.unitNumber,
      truckVin: truck.vin,
      truckLicensePlate: truck.licensePlate,
      trailerUnitNumber: trailer.unitNumber,
      trailerLicensePlate: trailer.licensePlate,
    })
    .from(trip)
    .leftJoin(driver, eq(trip.driverId, driver.id))
    .leftJoin(truck, eq(trip.truckId, truck.id))
    .leftJoin(trailer, eq(trip.trailerId, trailer.id))
    .where(and(eq(trip.loadId, loadId), eq(trip.tenantId, tenantId)))
    .orderBy(desc(trip.createdAt))
    .limit(1)

  return {
    ...loadRecord,
    trip: tripRecord ?? null,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// TRIPS
// ─────────────────────────────────────────────────────────────────────────────

export const getTripsForOrg = async (tenantId: string) => {
  return db
    .select()
    .from(trip)
    .where(eq(trip.tenantId, tenantId))
    .orderBy(desc(trip.createdAt))
}

export const getTripsWithDetailsForOrg = async (tenantId: string) => {
  return db
    .select({
      id: trip.id,
      tripNumber: trip.tripNumber,
      status: trip.status,
      startDate: trip.startDate,
      endDate: trip.endDate,
      totalMiles: trip.totalMiles,
      totalRevenue: trip.totalRevenue,
      createdAt: trip.createdAt,
      loadId: trip.loadId,
      loadNumber: load.loadNumber,
      originCity: load.originCity,
      originState: load.originState,
      destCity: load.destCity,
      destState: load.destState,
      driverId: trip.driverId,
      driverFirstName: driver.firstName,
      driverLastName: driver.lastName,
      driverPhone: driver.phone,
      truckId: trip.truckId,
      truckUnitNumber: truck.unitNumber,
      trailerId: trip.trailerId,
      trailerUnitNumber: trailer.unitNumber,
    })
    .from(trip)
    .leftJoin(load, eq(trip.loadId, load.id))
    .leftJoin(driver, eq(trip.driverId, driver.id))
    .leftJoin(truck, eq(trip.truckId, truck.id))
    .leftJoin(trailer, eq(trip.trailerId, trailer.id))
    .where(eq(trip.tenantId, tenantId))
    .orderBy(desc(trip.createdAt))
}

export const getTripByIdWithDetails = async (tripId: string, tenantId: string) => {
  const [result] = await db
    .select({
      id: trip.id,
      tripNumber: trip.tripNumber,
      status: trip.status,
      startDate: trip.startDate,
      endDate: trip.endDate,
      totalMiles: trip.totalMiles,
      totalRevenue: trip.totalRevenue,
      totalExpense: trip.totalExpense,
      carrierRate: trip.carrierRate,
      createdAt: trip.createdAt,
      updatedAt: trip.updatedAt,
      loadId: trip.loadId,
      loadNumber: load.loadNumber,
      loadStatus: load.status,
      originCity: load.originCity,
      originState: load.originState,
      originZip: load.originZip,
      destCity: load.destCity,
      destState: load.destState,
      destZip: load.destZip,
      commodity: load.commodity,
      weight: load.weight,
      pickupDate: load.pickupDate,
      deliveryDate: load.deliveryDate,
      driverId: trip.driverId,
      driverFirstName: driver.firstName,
      driverLastName: driver.lastName,
      driverPhone: driver.phone,
      driverEmail: driver.email,
      truckId: trip.truckId,
      truckUnitNumber: truck.unitNumber,
      truckMake: truck.make,
      truckModel: truck.model,
      trailerId: trip.trailerId,
      trailerUnitNumber: trailer.unitNumber,
      trailerType: trailer.type,
      carrierId: trip.carrierId,
      carrierName: carrier.name,
      carrierDotNumber: carrier.dotNumber,
      carrierPhone: carrier.phone,
    })
    .from(trip)
    .leftJoin(load, eq(trip.loadId, load.id))
    .leftJoin(driver, eq(trip.driverId, driver.id))
    .leftJoin(truck, eq(trip.truckId, truck.id))
    .leftJoin(trailer, eq(trip.trailerId, trailer.id))
    .leftJoin(carrier, eq(trip.carrierId, carrier.id))
    .where(and(eq(trip.id, tripId), eq(trip.tenantId, tenantId)))
    .limit(1)

  return result ?? null
}

// ─────────────────────────────────────────────────────────────────────────────
// CUSTOMERS & FACILITIES
// ─────────────────────────────────────────────────────────────────────────────

export const getCustomersForOrg = async (tenantId: string) => {
  return db
    .select()
    .from(customer)
    .where(eq(customer.tenantId, tenantId))
    .orderBy(desc(customer.createdAt))
}

export const getCustomerById = async (customerId: string, tenantId: string) => {
  const [result] = await db
    .select()
    .from(customer)
    .where(and(eq(customer.id, customerId), eq(customer.tenantId, tenantId)))
    .limit(1)
  return result ?? null
}

export const getFacilitiesForOrg = async (tenantId: string) => {
  return db
    .select()
    .from(facility)
    .where(eq(facility.tenantId, tenantId))
    .orderBy(desc(facility.createdAt))
}

export const getFacilityById = async (facilityId: string, tenantId: string) => {
  const [result] = await db
    .select()
    .from(facility)
    .where(and(eq(facility.id, facilityId), eq(facility.tenantId, tenantId)))
    .limit(1)
  return result ?? null
}

// ─────────────────────────────────────────────────────────────────────────────
// ACCOUNTS PAYABLE / EXPENSES
// ─────────────────────────────────────────────────────────────────────────────

export const getExpensesWithDetailsForOrg = async (tenantId: string) => {
  return db
    .select({
      id: apExpense.id,
      tripId: apExpense.tripId,
      driverId: apExpense.driverId,
      type: apExpense.type,
      vendor: apExpense.vendor,
      amount: apExpense.amount,
      date: apExpense.date,
      status: apExpense.status,
      notes: apExpense.notes,
      receipt: apExpense.receipt,
      createdAt: apExpense.createdAt,
      tripNumber: trip.tripNumber,
      driverFirstName: driver.firstName,
      driverLastName: driver.lastName,
      loadId: trip.loadId,
      loadNumber: load.loadNumber,
    })
    .from(apExpense)
    .leftJoin(trip, eq(apExpense.tripId, trip.id))
    .leftJoin(driver, eq(apExpense.driverId, driver.id))
    .leftJoin(load, eq(trip.loadId, load.id))
    .where(eq(apExpense.tenantId, tenantId))
    .orderBy(desc(apExpense.date))
}

export const getExpenseById = async (expenseId: string, tenantId: string) => {
  const [result] = await db
    .select()
    .from(apExpense)
    .where(and(eq(apExpense.id, expenseId), eq(apExpense.tenantId, tenantId)))
    .limit(1)
  return result ?? null
}

// ─────────────────────────────────────────────────────────────────────────────
// DRIVERS
// ─────────────────────────────────────────────────────────────────────────────

export const getDriversForOrg = async (tenantId: string) => {
  return db
    .select()
    .from(driver)
    .where(eq(driver.tenantId, tenantId))
    .orderBy(desc(driver.createdAt))
}

export const getDriversWithDetailsForOrg = async (tenantId: string) => {
  return db
    .select({
      id: driver.id,
      tenantId: driver.tenantId,
      userId: driver.userId,
      firstName: driver.firstName,
      lastName: driver.lastName,
      email: driver.email,
      phone: driver.phone,
      cdlNumber: driver.cdlNumber,
      cdlState: driver.cdlState,
      cdlExpiration: driver.cdlExpiration,
      dateOfBirth: driver.dateOfBirth,
      address: driver.address,
      city: driver.city,
      state: driver.state,
      zip: driver.zip,
      status: driver.status,
      hireDate: driver.hireDate,
      payRate: driver.payRate,
      payType: driver.payType,
      emergencyContact: driver.emergencyContact,
      emergencyPhone: driver.emergencyPhone,
      notes: driver.notes,
      createdAt: driver.createdAt,
      userImage: user.image,
      userEmailVerified: user.emailVerified,
    })
    .from(driver)
    .leftJoin(user, eq(driver.userId, user.id))
    .where(eq(driver.tenantId, tenantId))
    .orderBy(desc(driver.createdAt))
}

export const getWorkspaceMembersForDriverAssignment = async (orgId: string) => {
  return db
    .select({
      userId: user.id,
      name: user.name,
      email: user.email,
      role: member.role,
    })
    .from(member)
    .innerJoin(user, eq(member.userId, user.id))
    .where(eq(member.organizationId, orgId))
}

// ─────────────────────────────────────────────────────────────────────────────
// TRUCKS
// ─────────────────────────────────────────────────────────────────────────────

export const getTrucksForOrg = async (tenantId: string) => {
  return db
    .select()
    .from(truck)
    .where(eq(truck.tenantId, tenantId))
    .orderBy(desc(truck.createdAt))
}

// ─────────────────────────────────────────────────────────────────────────────
// TRAILERS
// ─────────────────────────────────────────────────────────────────────────────

export const getTrailersForOrg = async (tenantId: string) => {
  return db
    .select()
    .from(trailer)
    .where(eq(trailer.tenantId, tenantId))
    .orderBy(desc(trailer.createdAt))
}

// ─────────────────────────────────────────────────────────────────────────────
// INVOICES
// ─────────────────────────────────────────────────────────────────────────────

export const getInvoicesForOrg = async (tenantId: string) => {
  return db
    .select()
    .from(invoice)
    .where(eq(invoice.tenantId, tenantId))
    .orderBy(desc(invoice.createdAt))
}

export const getInvoicesWithDetailsForOrg = async (tenantId: string) => {
  return db
    .select({
      id: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      amount: invoice.amount,
      status: invoice.status,
      dueDate: invoice.dueDate,
      paidDate: invoice.paidDate,
      customerName: invoice.customerName,
      customerEmail: invoice.customerEmail,
      notes: invoice.notes,
      createdAt: invoice.createdAt,
      loadId: invoice.loadId,
      loadNumber: load.loadNumber,
      originCity: load.originCity,
      originState: load.originState,
      destCity: load.destCity,
      destState: load.destState,
      loadRate: load.rate,
    })
    .from(invoice)
    .leftJoin(load, eq(invoice.loadId, load.id))
    .where(eq(invoice.tenantId, tenantId))
    .orderBy(desc(invoice.createdAt))
}

export const getDeliveredLoadsForBilling = async (tenantId: string) => {
  return db
    .select()
    .from(load)
    .where(and(eq(load.tenantId, tenantId), eq(load.status, "delivered")))
    .orderBy(desc(load.createdAt))
}

export const getInvoiceById = async (invoiceId: string, tenantId: string) => {
  const [result] = await db
    .select({
      id: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      amount: invoice.amount,
      status: invoice.status,
      dueDate: invoice.dueDate,
      paidDate: invoice.paidDate,
      customerName: invoice.customerName,
      customerEmail: invoice.customerEmail,
      notes: invoice.notes,
      createdAt: invoice.createdAt,
      loadId: invoice.loadId,
      loadNumber: load.loadNumber,
      originCity: load.originCity,
      originState: load.originState,
      destCity: load.destCity,
      destState: load.destState,
      pickupDate: load.pickupDate,
      deliveryDate: load.deliveryDate,
      commodity: load.commodity,
      loadRate: load.rate,
    })
    .from(invoice)
    .leftJoin(load, eq(invoice.loadId, load.id))
    .where(and(eq(invoice.id, invoiceId), eq(invoice.tenantId, tenantId)))
    .limit(1)
  return result ?? null
}

export const getInvoiceByLoadId = async (loadId: string, tenantId: string) => {
  const [result] = await db
    .select({
      id: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      amount: invoice.amount,
      status: invoice.status,
    })
    .from(invoice)
    .where(and(eq(invoice.loadId, loadId), eq(invoice.tenantId, tenantId)))
    .limit(1)
  return result ?? null
}


// ─────────────────────────────────────────────────────────────────────────────
// PAYROLL
// ─────────────────────────────────────────────────────────────────────────────

export const getPayStubsForOrg = async (tenantId: string) => {
  return db
    .select()
    .from(payStub)
    .where(eq(payStub.tenantId, tenantId))
    .orderBy(desc(payStub.createdAt))
}

export const getPayStubsWithDetailsForOrg = async (tenantId: string) => {
  return db
    .select({
      id: payStub.id,
      tenantId: payStub.tenantId,
      driverId: payStub.driverId,
      payPeriodStart: payStub.payPeriodStart,
      payPeriodEnd: payStub.payPeriodEnd,
      totalMiles: payStub.totalMiles,
      payRate: payStub.payRate,
      grossPay: payStub.grossPay,
      deductions: payStub.deductions,
      netPay: payStub.netPay,
      status: payStub.status,
      paidDate: payStub.paidDate,
      notes: payStub.notes,
      createdAt: payStub.createdAt,
      updatedAt: payStub.updatedAt,
      driverFirstName: driver.firstName,
      driverLastName: driver.lastName,
      driverEmail: driver.email,
      driverPhone: driver.phone,
      driverPayType: driver.payType,
      driverPayRate: driver.payRate,
    })
    .from(payStub)
    .leftJoin(driver, eq(payStub.driverId, driver.id))
    .where(eq(payStub.tenantId, tenantId))
    .orderBy(desc(payStub.createdAt))
}

// ─────────────────────────────────────────────────────────────────────────────
// AP EXPENSES
// ─────────────────────────────────────────────────────────────────────────────

export const getApExpensesForOrg = async (tenantId: string) => {
  return db
    .select()
    .from(apExpense)
    .where(eq(apExpense.tenantId, tenantId))
    .orderBy(desc(apExpense.createdAt))
}

// ─────────────────────────────────────────────────────────────────────────────
// CARRIER PAYMENTS
// ─────────────────────────────────────────────────────────────────────────────

export const getCarrierPaymentsForOrg = async (tenantId: string) => {
  return db
    .select()
    .from(carrierPayment)
    .where(eq(carrierPayment.tenantId, tenantId))
    .orderBy(desc(carrierPayment.createdAt))
}

export const getCarrierPaymentsWithDetailsForOrg = async (tenantId: string) => {
  return db
    .select({
      id: carrierPayment.id,
      carrierId: carrierPayment.carrierId,
      tripId: carrierPayment.tripId,
      driverId: carrierPayment.driverId,
      amount: carrierPayment.amount,
      additions: carrierPayment.additions,
      deductions: carrierPayment.deductions,
      netAmount: carrierPayment.netAmount,
      currency: carrierPayment.currency,
      status: carrierPayment.status,
      invoiceNumber: carrierPayment.invoiceNumber,
      paymentDate: carrierPayment.paymentDate,
      paymentMethod: carrierPayment.paymentMethod,
      referenceNumber: carrierPayment.referenceNumber,
      notes: carrierPayment.notes,
      createdAt: carrierPayment.createdAt,
      carrierName: carrier.name,
      carrierMcNumber: carrier.mcNumber,
      carrierDotNumber: carrier.dotNumber,
      carrierPhone: carrier.phone,
      carrierEmail: carrier.email,
      carrierPaymentTerms: carrier.paymentTerms,
      tripNumber: trip.tripNumber,
      tripMiles: trip.totalMiles,
      loadId: trip.loadId,
      loadNumber: load.loadNumber,
      originCity: load.originCity,
      originState: load.originState,
      destCity: load.destCity,
      destState: load.destState,
      driverFirstName: driver.firstName,
      driverLastName: driver.lastName,
    })
    .from(carrierPayment)
    .leftJoin(carrier, eq(carrierPayment.carrierId, carrier.id))
    .leftJoin(trip, eq(carrierPayment.tripId, trip.id))
    .leftJoin(load, eq(trip.loadId, load.id))
    .leftJoin(driver, eq(carrierPayment.driverId, driver.id))
    .where(eq(carrierPayment.tenantId, tenantId))
    .orderBy(desc(carrierPayment.createdAt))
}

export const getCarrierPaymentById = async (id: string, tenantId: string) => {
  const [result] = await db
    .select()
    .from(carrierPayment)
    .where(and(eq(carrierPayment.id, id), eq(carrierPayment.tenantId, tenantId)))
    .limit(1)
  return result ?? null
}

// ─────────────────────────────────────────────────────────────────────────────
// CARRIERS DIRECTORY
// ─────────────────────────────────────────────────────────────────────────────

export const getCarriersForOrg = async (tenantId: string) => {
  return db
    .select()
    .from(carrier)
    .where(eq(carrier.tenantId, tenantId))
    .orderBy(desc(carrier.createdAt))
}

export const getCarrierById = async (carrierId: string, tenantId: string) => {
  const [result] = await db
    .select()
    .from(carrier)
    .where(and(eq(carrier.id, carrierId), eq(carrier.tenantId, tenantId)))
    .limit(1)
  return result ?? null
}

// ─────────────────────────────────────────────────────────────────────────────
// ORGANIZATION
// ─────────────────────────────────────────────────────────────────────────────

export const getOrganizationById = async (orgId: string) => {
  const [result] = await db
    .select()
    .from(organization)
    .where(eq(organization.id, orgId))
    .limit(1)
  return result ?? null
}

/** Phase 3 (WS-09) — full workspace profile for /settings/workspace. */
export const getWorkspaceProfile = async (orgId: string) => {
  console.log("[DAL] getWorkspaceProfile", orgId)
  try {
    const [row] = await db
      .select({
        id: organization.id,
        name: organization.name,
        slug: organization.slug,
        logo: organization.logo,
        businessType: organization.businessType,
        dotNumber: organization.dotNumber,
        mcNumber: organization.mcNumber,
        ein: organization.ein,
        phone: organization.phone,
        addressLine1: organization.addressLine1,
        addressLine2: organization.addressLine2,
        city: organization.city,
        state: organization.state,
        postalCode: organization.postalCode,
        country: organization.country,
        defaultCurrency: organization.defaultCurrency,
        timeZone: organization.timeZone,
        fiscalYearStart: organization.fiscalYearStart,
        metadata: organization.metadata,
      })
      .from(organization)
      .where(eq(organization.id, orgId))
      .limit(1)

    if (!row) return null

    let parsedMeta: Record<string, any> = {}
    if (row.metadata) {
      try {
        parsedMeta =
          typeof row.metadata === "string"
            ? JSON.parse(row.metadata)
            : row.metadata
      } catch (err) {
        console.warn("[DAL] failed to parse org metadata:", err)
      }
    }

    const merged = {
      ...row,
      // Fallback to onboarding metadata if direct columns were empty
      businessType: row.businessType || parsedMeta.businessType || null,
      dotNumber: row.dotNumber || parsedMeta.dotNumber || null,
      mcNumber: row.mcNumber || parsedMeta.mcNumber || null,
      // Operational properties collected during onboarding
      fleetSize: parsedMeta.fleetSize || null,
      teamSize: parsedMeta.teamSize || null,
      geographicScope: parsedMeta.geographicScope || null,
      currentTool: parsedMeta.currentTool || null,
      freightTypes: Array.isArray(parsedMeta.freightTypes)
        ? parsedMeta.freightTypes
        : [],
      primaryGoals: Array.isArray(parsedMeta.primaryGoals)
        ? parsedMeta.primaryGoals
        : [],
      supportEmail: parsedMeta.supportEmail || null,
      website: parsedMeta.website || null,
      onboardingCompletedAt: parsedMeta.onboardingCompletedAt || null,
      metadata: parsedMeta,
    }

    console.log("[DAL] getWorkspaceProfile result: found with onboarding fields")
    return merged
  } catch (e) {
    console.error("[DAL] getWorkspaceProfile FAILED:", e)
    throw e
  }
}

export const getMembersForOrg = async (orgId: string) => {
  return db
    .select()
    .from(member)
    .where(eq(member.organizationId, orgId))
}

// ─────────────────────────────────────────────────────────────────────────────
// AGGREGATES / KPIs
// ─────────────────────────────────────────────────────────────────────────────

export const getActiveLoadsCount = async (tenantId: string) => {
  const [result] = await db
    .select({ count: sql<number>`count(*)` })
    .from(load)
    .where(and(
      eq(load.tenantId, tenantId),
      sql`${load.status} IN ('booked', 'dispatched', 'in_transit')`
    ))
  return Number(result?.count ?? 0)
}

export const getOnTimePercent = async (tenantId: string) => {
  // Delivered loads vs on-time
  const [result] = await db
    .select({ count: sql<number>`count(*)` })
    .from(load)
    .where(and(
      eq(load.tenantId, tenantId),
      eq(load.status, "delivered")
    ))
  return Number(result?.count ?? 0)
}

export const getMonthlyRevenue = async (tenantId: string) => {
  const [result] = await db
    .select({ total: sql<string>`coalesce(sum(${invoice.amount}::numeric), 0)` })
    .from(invoice)
    .where(and(
      eq(invoice.tenantId, tenantId),
      sql`${invoice.createdAt} >= date_trunc('month', now())`
    ))
  return Number(result?.total ?? 0)
}

export const getActiveDriversCount = async (tenantId: string) => {
  const [result] = await db
    .select({ count: sql<number>`count(*)` })
    .from(driver)
    .where(and(
      eq(driver.tenantId, tenantId),
      eq(driver.status, "active")
    ))
  return Number(result?.count ?? 0)
}

// ─────────────────────────────────────────────────────────────────────────────
// ADMIN CONSOLE
// ─────────────────────────────────────────────────────────────────────────────

/** Returns true if the current session's user has `role = 'admin'` in the DB.
 *  Use this for UI gating (sidebar entry, nav-user dropdown). For route
 *  protection, use `requireAdmin()` which throws `TenantError`. */
export const getIsAdmin = cache(async (): Promise<boolean> => {
  const session = await getSession()
  if (!session?.user?.id) return false
  // [DAL] admin gate is DB-based — read user.role fresh each call.
  // We don't trust the cached role on session.user because it might be
  // stale relative to a recent setRole call.
  const rows = await db
    .select({ role: user.role })
    .from(user)
    .where(eq(user.id, session.user.id))
    .limit(1)
  return rows[0]?.role === "admin"
})

/** Gate the /admin/* route group. Must be a signed-in user with `role = 'admin'`. */
export async function requireAdmin() {
  const session = await getSession()
  if (!session?.user) {
    throw new TenantError("UNAUTHORIZED")
  }
  const isAdmin = await getIsAdmin()
  if (!isAdmin) {
    throw new TenantError("FORBIDDEN")
  }
  return {
    userId: session.user.id,
    userEmail: session.user.email,
    userName: session.user.name ?? "Admin",
    userImage: session.user.image ?? null,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// ADMIN OVERVIEW
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Comprehensive data layer for the /admin home page.
 *
 * Returns the KPI numbers, the deltas, the brute-force counters,
 * the impersonation status, the system health snapshot, and the
 * last 20 audit events. All counts are real (no toy values).
 */
export async function getAdminOverview(): Promise<{
  kpis: {
    totalUsers: number
    usersDelta7d: number
    totalOrgs: number
    orgsDelta7d: number
    suspended: number
    openAppeals: number
    banned: number
    pendingInvitations: number
    failedSignups24h: number
    activeSessions: number
  }
  impersonation: {
    active: boolean
    startedByEmail: string | null
  }
  systemHealth: {
    dbLatencyMs: number
    resendConfigured: boolean
    betterAuthUrlSet: boolean
    maintenanceMode: boolean
    errors24h: number
    lastErrorAt: string | null
  }
  recentEvents: Array<{
    id: string
    action: string
    actorEmail: string
    targetType: string
    targetLabel: string | null
    metadata: Record<string, unknown> | null
    createdAt: string
  }>
}> {
  console.log("[DAL] getAdminOverview")
  const start = performance.now()
  const now = new Date()
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
  const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000)

  const [
    totalUsersRow,
    newUsers7d,
    totalOrgsRow,
    newOrgs7d,
    suspended,
    openAppeals,
    banned,
    pendingInv,
    failedSignups24h,
    activeSessionsRow,
    errors24h,
    lastError,
    maintenanceRow,
    sessionUser,
    recentEvents,
  ] = await Promise.all([
    db.select({ count: sql<number>`count(*)::int` }).from(user),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(user)
      .where(gte(user.createdAt, sevenDaysAgo)),
    db.select({ count: sql<number>`count(*)::int` }).from(organization),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(organization)
      .where(gte(organization.createdAt, sevenDaysAgo)),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(user)
      .where(
        and(
          sql`${user.suspendedAt} IS NOT NULL`,
          sql`(${user.suspendedUntil} IS NULL OR ${user.suspendedUntil} > NOW())`
        )
      ),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(user)
      .where(eq(user.appealStatus, "open")),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(user)
      .where(eq(user.banned, true)),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(invitation)
      .where(eq(invitation.status, "pending")),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(signupAttempt)
      .where(
        and(
          eq(signupAttempt.success, false),
          gte(signupAttempt.createdAt, oneDayAgo)
        )
      ),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(sessionTable)
      .where(gte(sessionTable.expiresAt, now)),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(errorLog)
      .where(
        and(
          gte(errorLog.createdAt, oneDayAgo),
          eq(errorLog.level, "error")
        )
      ),
    db
      .select({ createdAt: errorLog.createdAt, message: errorLog.message })
      .from(errorLog)
      .orderBy(desc(errorLog.createdAt))
      .limit(1),
    db
      .select({ value: systemSetting.value })
      .from(systemSetting)
      .where(eq(systemSetting.key, "maintenance"))
      .orderBy(desc(systemSetting.updatedAt))
      .limit(1),
    getSession(),
    import("./audit").then(({ listAuditEvents }) =>
      listAuditEvents({ limit: 20, offset: 0 })
    ),
  ])

  // DB roundtrip latency probe (cheap)
  const probeStart = performance.now()
  await db.select({ ok: sql<number>`1` }).from(user).limit(1)
  const dbLatencyMs = Math.round(performance.now() - probeStart)

  const session = sessionUser
  const impersonatedBy = (session?.session as any)?.impersonatedBy ?? null

  const maintenanceValue = (maintenanceRow?.[0]?.value as any) ?? null
  const maintenanceMode = !!maintenanceValue?.enabled

  console.log(
    `[DAL] getAdminOverview done in ${Math.round(performance.now() - start)}ms`
  )

  return {
    kpis: {
      totalUsers: Number(totalUsersRow[0]?.count ?? 0),
      usersDelta7d: Number(newUsers7d[0]?.count ?? 0),
      totalOrgs: Number(totalOrgsRow[0]?.count ?? 0),
      orgsDelta7d: Number(newOrgs7d[0]?.count ?? 0),
      suspended: Number(suspended[0]?.count ?? 0),
      openAppeals: Number(openAppeals[0]?.count ?? 0),
      banned: Number(banned[0]?.count ?? 0),
      pendingInvitations: Number(pendingInv[0]?.count ?? 0),
      failedSignups24h: Number(failedSignups24h[0]?.count ?? 0),
      activeSessions: Number(activeSessionsRow[0]?.count ?? 0),
    },
    impersonation: {
      active: !!impersonatedBy,
      startedByEmail: impersonatedBy ?? null,
    },
    systemHealth: {
      dbLatencyMs,
      resendConfigured: !!process.env.RESEND_API_KEY,
      betterAuthUrlSet: !!process.env.BETTER_AUTH_URL,
      maintenanceMode,
      errors24h: Number(errors24h[0]?.count ?? 0),
      lastErrorAt: lastError[0]?.createdAt?.toISOString() ?? null,
    },
    recentEvents: recentEvents.events.map((e) => ({
      id: e.id,
      action: e.action,
      actorEmail: e.actorEmail,
      targetType: e.targetType,
      targetLabel: e.targetLabel,
      metadata: e.metadata,
      createdAt: e.createdAt.toISOString(),
    })),
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// ADMIN CONSOLE
// ─────────────────────────────────────────────────────────────────────────────

/** Counts used by the admin home dashboard. All run in parallel. */
export async function getAdminStats() {
  const [users, banned, suspended, orgs, members, invitations, appeals] =
    await Promise.all([
      db.select({ count: sql<number>`count(*)` }).from(user),
      db
        .select({ count: sql<number>`count(*)` })
        .from(user)
        .where(eq(user.banned, true)),
      // Suspended = suspended_at is set AND (suspended_until is null OR in the future)
      db
        .select({ count: sql<number>`count(*)` })
        .from(user)
        .where(
          and(
            sql`${user.suspendedAt} IS NOT NULL`,
            sql`(${user.suspendedUntil} IS NULL OR ${user.suspendedUntil} > NOW())`
          )
        ),
      db.select({ count: sql<number>`count(*)` }).from(organization),
      db.select({ count: sql<number>`count(*)` }).from(member),
      db
        .select({ count: sql<number>`count(*)` })
        .from(invitation)
        .where(eq(invitation.status, "pending")),
      db
        .select({ count: sql<number>`count(*)` })
        .from(user)
        .where(eq(user.appealStatus, "open")),
    ])
  return {
    totalUsers: Number(users[0]?.count ?? 0),
    bannedUsers: Number(banned[0]?.count ?? 0),
    suspendedUsers: Number(suspended[0]?.count ?? 0),
    openAppeals: Number(appeals[0]?.count ?? 0),
    totalOrgs: Number(orgs[0]?.count ?? 0),
    totalMembers: Number(members[0]?.count ?? 0),
    pendingInvitations: Number(invitations[0]?.count ?? 0),
  }
}

/** Returns every organization across all tenants (admin-only view).
 *  Includes a member count per org for the table. */
export async function getAllOrgsForAdmin() {
  const rows = await db
    .select({
      id: organization.id,
      name: organization.name,
      slug: organization.slug,
      logo: organization.logo,
      createdAt: organization.createdAt,
      memberCount: sql<number>`(
        SELECT count(*)::int FROM ${member} WHERE ${member.organizationId} = ${organization.id}
      )`,
    })
    .from(organization)
    .orderBy(desc(organization.createdAt))
  return rows
}

// ─────────────────────────────────────────────────────────────────────────────
// ADMIN: SINGLE-USER / SINGLE-ORG / DEDICATED DETAIL PAGES
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Full user record for the dedicated /admin/users/[id] page.
 * Mirrors the projection of listEnrichedUsersForAdmin but for one id.
 * Returns null if the user doesn't exist.
 *
 * Includes the "deep info" the user-detail page renders:
 *   - profile + status fields
 *   - last sign-in timestamp + last sign-in IP + last UA
 *   - active session count + total session count
 *   - distinct sign-in IPs in the last 90 days (top 10)
 *   - linked OAuth accounts (from `account` table)
 *   - signup attempt (if any — has the IP they signed up from)
 */
export async function getEnrichedUserById(id: string) {
  console.log(`[DAL] getEnrichedUserById ${id}`)
  const [u] = await db
    .select({
      id: user.id,
      name: user.name,
      email: user.email,
      emailVerified: user.emailVerified,
      image: user.image,
      role: user.role,
      banned: user.banned,
      banReason: user.banReason,
      banExpires: user.banExpires,
      suspendedAt: user.suspendedAt,
      suspendedUntil: user.suspendedUntil,
      suspendedReason: user.suspendedReason,
      suspendedBy: user.suspendedBy,
      appealMessage: user.appealMessage,
      appealStatus: user.appealStatus,
      appealSubmittedAt: user.appealSubmittedAt,
      phone: user.phone,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      username: user.username,
      displayUsername: user.displayUsername,
    })
    .from(user)
    .where(eq(user.id, id))
    .limit(1)
  if (!u) return null

  // Fan out: last sign-in, session counts, distinct IPs, linked
  // accounts, signup attempt, audit count.
  const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)
  const [
    lastSession,
    activeSessionCountRow,
    totalSessionCountRow,
    distinctIps,
    linkedAccounts,
    signupRow,
    auditCountRow,
  ] = await Promise.all([
    // Last sign-in (most-recent session, regardless of expiry)
    db
      .select({
        createdAt: sessionTable.createdAt,
        ipAddress: sessionTable.ipAddress,
        userAgent: sessionTable.userAgent,
      })
      .from(sessionTable)
      .where(eq(sessionTable.userId, id))
      .orderBy(desc(sessionTable.createdAt))
      .limit(1),
    // Active session count
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(sessionTable)
      .where(
        and(eq(sessionTable.userId, id), gte(sessionTable.expiresAt, new Date()))
      ),
    // Total session count (active + expired, all-time)
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(sessionTable)
      .where(eq(sessionTable.userId, id)),
    // Distinct IPs in last 90 days, with first/last seen + count
    db.execute(sql`
      SELECT
        ip_address,
        MIN(created_at) AS first_seen,
        MAX(created_at) AS last_seen,
        COUNT(*)::int AS sign_in_count
      FROM ${sessionTable}
      WHERE ${sessionTable.userId} = ${id}
        AND ${sessionTable.ipAddress} IS NOT NULL
        AND ${sessionTable.createdAt} >= ${ninetyDaysAgo.toISOString()}
      GROUP BY ip_address
      ORDER BY last_seen DESC
      LIMIT 10
    ` as any),
    // Linked OAuth accounts (provider + provider account id)
    db
      .select({
        id: accountTable.id,
        providerId: accountTable.providerId,
        accountId: accountTable.accountId,
        createdAt: accountTable.createdAt,
        lastSignInAt: accountTable.updatedAt,
      })
      .from(accountTable)
      .where(eq(accountTable.userId, id))
      .orderBy(desc(accountTable.updatedAt)),
    // Signup attempt (if any) — the IP they signed up from
    db
      .select({
        id: signupAttempt.id,
        ipAddress: signupAttempt.ipAddress,
        userAgent: signupAttempt.userAgent,
        createdAt: signupAttempt.createdAt,
      })
      .from(signupAttempt)
      .where(eq(signupAttempt.email, u.email))
      .orderBy(desc(signupAttempt.createdAt))
      .limit(1),
    // Total audit events as actor or target — for "events" badge
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(auditLog)
      .where(
        sql`(${auditLog.actorId} = ${id} OR ${auditLog.targetId} = ${id})`
      ),
  ])

  return {
    ...u,
    lastSignInAt: lastSession[0]?.createdAt ?? null,
    lastSignInIp: lastSession[0]?.ipAddress ?? null,
    lastSignInUserAgent: lastSession[0]?.userAgent ?? null,
    activeSessionCount: Number(activeSessionCountRow[0]?.count ?? 0),
    totalSessionCount: Number(totalSessionCountRow[0]?.count ?? 0),
    distinctSignInIps: (distinctIps as any[]).map((r) => ({
      ip: r.ip_address as string,
      firstSeen: r.first_seen as Date,
      lastSeen: r.last_seen as Date,
      signInCount: Number(r.sign_in_count),
    })),
    linkedAccounts: linkedAccounts.map((a) => ({
      id: a.id,
      providerId: a.providerId,
      accountId: a.accountId,
      createdAt: a.createdAt,
      lastSignInAt: a.lastSignInAt,
    })),
    signupFromIp: signupRow[0]?.ipAddress ?? null,
    signupFromUa: signupRow[0]?.userAgent ?? null,
    signupAt: signupRow[0]?.createdAt ?? null,
    auditEventCount: Number(auditCountRow[0]?.count ?? 0),
  }
}

/**
 * Single org with member count + status, for the dedicated
 * /admin/workspaces/[id] page. Returns null if the org doesn't exist.
 */
export async function getEnrichedOrgById(id: string) {
  console.log(`[DAL] getEnrichedOrgById ${id}`)
  const [o] = await db
    .select({
      id: organization.id,
      name: organization.name,
      slug: organization.slug,
      logo: organization.logo,
      createdAt: organization.createdAt,
      metadata: organization.metadata,
      suspended: organization.suspended,
      suspendedAt: organization.suspendedAt,
      suspendedReason: organization.suspendedReason,
      suspendedBy: organization.suspendedBy,
    })
    .from(organization)
    .where(eq(organization.id, id))
    .limit(1)
  if (!o) return null

  const [counts] = await db
    .select({
      memberCount: sql<number>`count(*)::int`,
      ownerCount: sql<number>`count(*) FILTER (WHERE ${member.role} = 'owner')::int`,
    })
    .from(member)
    .where(eq(member.organizationId, id))

  return {
    ...o,
    memberCount: Number(counts?.memberCount ?? 0),
    ownerCount: Number(counts?.ownerCount ?? 0),
  }
}

/**
 * Paginated, searchable list of all orgs across all tenants.
 * Replaces getAllOrgsForAdmin — same shape plus search/status/limit/offset.
 */
export async function listAllOrgsForAdmin(opts: {
  search?: string
  statusFilter?: "all" | "active" | "suspended"
  limit?: number
  offset?: number
} = {}) {
  const limit = Math.min(opts.limit ?? 50, 200)
  const offset = opts.offset ?? 0
  const search = opts.search?.trim().toLowerCase()
  const status = opts.statusFilter ?? "all"

  const conditions: any[] = []
  if (search) {
    conditions.push(
      sql`(LOWER(${organization.name}) LIKE ${`%${search}%`} OR LOWER(${organization.slug}) LIKE ${`%${search}%`})`
    )
  }
  if (status === "suspended") {
    conditions.push(eq(organization.suspended, true))
  }
  if (status === "active") {
    conditions.push(eq(organization.suspended, false))
  }
  const where = conditions.length > 0 ? and(...conditions) : undefined

  const [rows, totalRow] = await Promise.all([
    db
      .select({
        id: organization.id,
        name: organization.name,
        slug: organization.slug,
        logo: organization.logo,
        createdAt: organization.createdAt,
        suspended: organization.suspended,
        suspendedAt: organization.suspendedAt,
        suspendedReason: organization.suspendedReason,
        memberCount: sql<number>`(
          SELECT count(*)::int FROM ${member} WHERE ${member.organizationId} = ${organization.id}
        )`,
        ownerCount: sql<number>`(
          SELECT count(*)::int FROM ${member} WHERE ${member.organizationId} = ${organization.id} AND ${member.role} = 'owner'
        )`,
      })
      .from(organization)
      .where(where)
      .orderBy(desc(organization.createdAt))
      .limit(limit)
      .offset(offset),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(organization)
      .where(where),
  ])
  return { orgs: rows, total: Number(totalRow[0]?.count ?? 0) }
}

/**
 * Paginated members of a workspace for the dedicated
 * /admin/workspaces/[id] page. Joins user for email/name/role
 * metadata and a left-join to the user's most recent session for
 * "last active" display.
 */
export async function listWorkspaceMembersForAdmin(
  orgId: string,
  opts: { search?: string; limit?: number; offset?: number } = {}
) {
  const limit = Math.min(opts.limit ?? 50, 200)
  const offset = opts.offset ?? 0
  const search = opts.search?.trim().toLowerCase()

  const conditions: any[] = [eq(member.organizationId, orgId)]
  if (search) {
    conditions.push(
      sql`(LOWER(${user.email}) LIKE ${`%${search}%`} OR LOWER(${user.name}) LIKE ${`%${search}%`})`
    )
  }
  const where = and(...conditions)

  const [rows, totalRow] = await Promise.all([
    db
      .select({
        memberId: member.id,
        userId: user.id,
        email: user.email,
        name: user.name,
        image: user.image,
        role: member.role,
        platformRole: user.role,
        banned: user.banned,
        suspended: sql<boolean>`(${user.suspendedAt} IS NOT NULL AND (${user.suspendedUntil} IS NULL OR ${user.suspendedUntil} > NOW()))`,
        lastActiveAt: sql<Date | null>`(
          SELECT MAX(${sessionTable.createdAt}) FROM ${sessionTable}
          WHERE ${sessionTable.userId} = ${user.id}
        )`,
        joinedAt: member.createdAt,
      })
      .from(member)
      .innerJoin(user, eq(user.id, member.userId))
      .where(where)
      .orderBy(desc(member.createdAt))
      .limit(limit)
      .offset(offset),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(member)
      .innerJoin(user, eq(user.id, member.userId))
      .where(where),
  ])
  return { members: rows, total: Number(totalRow[0]?.count ?? 0) }
}

/**
 * TMS stats for one workspace — powers the 6-tile stat grid on the
 * dedicated workspace detail page.
 *
 * NOTE on date binding: postgres-js (the driver underneath Drizzle
 * here) does not accept raw `Date` objects as parameters. The
 * official postgres-js guidance is to serialize dates as ISO strings
 * before interpolation. We do that here, and use a plain SQL interval
 * for the "last 30 days" comparison so we don't need a JS Date at all
 * in the query.
 */
export async function getOrgStats(orgId: string) {
  console.log(`[DAL] getOrgStats ${orgId}`)

  const [
    activeLoadsRow,
    totalLoadsRow,
    activeDriversRow,
    totalDriversRow,
    activeTrucksRow,
    totalTrucksRow,
    paidInvoicesRow,
    outstandingInvoicesRow,
    revenue30dRow,
    revenueAllRow,
    lastAuditRow,
  ] = await Promise.all([
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(load)
      .where(
        and(
          eq(load.tenantId, orgId),
          sql`${load.status} IN ('booked', 'dispatched', 'in_transit')`
        )
      ),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(load)
      .where(eq(load.tenantId, orgId)),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(driver)
      .where(and(eq(driver.tenantId, orgId), eq(driver.status, "active"))),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(driver)
      .where(eq(driver.tenantId, orgId)),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(truck)
      .where(
        and(
          eq(truck.tenantId, orgId),
          sql`${truck.status} IN ('available', 'in_use')`
        )
      ),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(truck)
      .where(eq(truck.tenantId, orgId)),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(invoice)
      .where(and(eq(invoice.tenantId, orgId), eq(invoice.status, "paid"))),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(invoice)
      .where(
        and(
          eq(invoice.tenantId, orgId),
          sql`${invoice.status} IN ('pending', 'overdue')`
        )
      ),
    db
      .select({
        total: sql<string>`coalesce(sum(${invoice.amount}::numeric), 0)`,
      })
      .from(invoice)
      .where(
        and(
          eq(invoice.tenantId, orgId),
          eq(invoice.status, "paid"),
          // Use a SQL interval rather than passing a JS Date —
          // postgres-js rejects raw Date parameters.
          sql`${invoice.paidDate} >= NOW() - INTERVAL '30 days'`
        )
      ),
    db
      .select({
        total: sql<string>`coalesce(sum(${invoice.amount}::numeric), 0)`,
      })
      .from(invoice)
      .where(and(eq(invoice.tenantId, orgId), eq(invoice.status, "paid"))),
    // Last activity = most recent audit event scoped to this org.
    // We look at two ways events reference an org: targetType='org'
    // and targetId=orgId, or metadata.organizationId=orgId.
    db.execute(sql`
      SELECT created_at FROM ${auditLog}
      WHERE (${auditLog.targetType} = 'org' AND ${auditLog.targetId} = ${orgId})
         OR (${auditLog.metadata}->>'organizationId' = ${orgId})
      ORDER BY created_at DESC LIMIT 1
    ` as any),
  ])

  return {
    loads: {
      active: Number(activeLoadsRow[0]?.count ?? 0),
      total: Number(totalLoadsRow[0]?.count ?? 0),
    },
    drivers: {
      active: Number(activeDriversRow[0]?.count ?? 0),
      total: Number(totalDriversRow[0]?.count ?? 0),
    },
    trucks: {
      active: Number(activeTrucksRow[0]?.count ?? 0),
      total: Number(totalTrucksRow[0]?.count ?? 0),
    },
    invoices: {
      paid: Number(paidInvoicesRow[0]?.count ?? 0),
      outstanding: Number(outstandingInvoicesRow[0]?.count ?? 0),
    },
    revenue: {
      last30d: Number(revenue30dRow[0]?.total ?? 0),
      allTime: Number(revenueAllRow[0]?.total ?? 0),
    },
    lastActivityAt: (lastAuditRow?.[0] as any)?.created_at ?? null,
  }
}

/** Activity events for one user — powers the /admin/users/[id]
 *  Activity tab. Server-side version of the /activity API route. */
export async function getUserActivityForAdmin(
  userId: string,
  opts: { limit?: number } = {}
) {
  const limit = Math.min(opts.limit ?? 50, 200)
  console.log(`[DAL] getUserActivityForAdmin ${userId} limit=${limit}`)
  return listAuditEvents({ targetId: userId, limit, offset: 0 })
}

/** Activity events for one org — powers the /admin/workspaces/[id]
 *  Activity tab. */
export async function getOrgActivityForAdmin(
  orgId: string,
  opts: { limit?: number } = {}
) {
  const limit = Math.min(opts.limit ?? 30, 200)
  console.log(`[DAL] getOrgActivityForAdmin ${orgId} limit=${limit}`)
  const where = sql`(
    (${auditLog.targetType} = 'org' AND ${auditLog.targetId} = ${orgId})
    OR (${auditLog.metadata}->>'organizationId' = ${orgId})
  )`
  const [rows, totalRow] = await Promise.all([
    db
      .select()
      .from(auditLog)
      .where(where)
      .orderBy(desc(auditLog.createdAt))
      .limit(limit),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(auditLog)
      .where(where),
  ])
  return { events: rows, total: Number(totalRow[0]?.count ?? 0) }
}

/** Admin-only enriched user list. Returns Better Auth admin fields
 *  (role, banned, banReason, banExpires) AND our custom suspend fields
 *  (suspendedAt, suspendedUntil, suspendedReason, appealStatus, etc).
 *  Search filters by email/name (case-insensitive contains). */
export async function listEnrichedUsersForAdmin(opts: {
  search?: string
  statusFilter?: "all" | "active" | "banned" | "suspended"
  limit?: number
  offset?: number
} = {}) {
  const limit = Math.min(opts.limit ?? 50, 200)
  const offset = opts.offset ?? 0
  const search = opts.search?.trim().toLowerCase()
  const status = opts.statusFilter ?? "all"

  // Base WHERE assembled by hand
  const conditions: any[] = []
  if (search) {
    conditions.push(sql`(LOWER(${user.email}) LIKE ${`%${search}%`} OR LOWER(${user.name}) LIKE ${`%${search}%`})`)
  }
  if (status === "banned") {
    conditions.push(eq(user.banned, true))
  }
  if (status === "suspended") {
    conditions.push(
      and(
        sql`${user.suspendedAt} IS NOT NULL`,
        sql`(${user.suspendedUntil} IS NULL OR ${user.suspendedUntil} > NOW())`
      )
    )
  }
  if (status === "active") {
    conditions.push(eq(user.banned, false))
    // Active = not banned AND not currently suspended
    conditions.push(
      sql`(${user.suspendedAt} IS NULL OR ${user.suspendedUntil} <= NOW())`
    )
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined

  const [rows, totalRow] = await Promise.all([
    db
      .select({
        id: user.id,
        name: user.name,
        email: user.email,
        emailVerified: user.emailVerified,
        image: user.image,
        role: user.role,
        banned: user.banned,
        banReason: user.banReason,
        banExpires: user.banExpires,
        suspendedAt: user.suspendedAt,
        suspendedUntil: user.suspendedUntil,
        suspendedReason: user.suspendedReason,
        suspendedBy: user.suspendedBy,
        appealStatus: user.appealStatus,
        appealSubmittedAt: user.appealSubmittedAt,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      })
      .from(user)
      .where(where)
      .orderBy(desc(user.createdAt))
      .limit(limit)
      .offset(offset),
    db
      .select({ count: sql<number>`count(*)` })
      .from(user)
      .where(where),
  ])
  return { users: rows, total: Number(totalRow[0]?.count ?? 0) }
}

/** Returns users with an open appeal — for the appeals inbox. */
export async function listOpenAppealsForAdmin() {
  return db
    .select({
      id: user.id,
      name: user.name,
      email: user.email,
      suspendedAt: user.suspendedAt,
      suspendedUntil: user.suspendedUntil,
      suspendedReason: user.suspendedReason,
      appealMessage: user.appealMessage,
      appealSubmittedAt: user.appealSubmittedAt,
      appealStatus: user.appealStatus,
    })
    .from(user)
    .where(eq(user.appealStatus, "open"))
    .orderBy(desc(user.appealSubmittedAt))
}

// ─────────────────────────────────────────────────────────────────────────────
// PHASE 1 — Workspace team page helpers (WS-16…WS-30)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * listWorkspaceMembers — used by /settings/team.
 *
 * Returns the active workspace's members with:
 *   - profile + role (workspace + platform)
 *   - banned / platform-suspended status
 *   - workspace-scoped suspension (WS-26)
 *   - last-active timestamp
 *
 * Powers: WS-22 search, WS-23 status badges, WS-26 suspend UI.
 */
export async function listWorkspaceMembers(
  orgId: string,
  opts: {
    search?: string
    status?: "all" | "active" | "suspended"
    limit?: number
    offset?: number
  } = {},
) {
  const limit = Math.min(opts.limit ?? 50, 200)
  const offset = opts.offset ?? 0
  const search = opts.search?.trim().toLowerCase()
  const status = opts.status ?? "all"

  const conditions: any[] = [eq(member.organizationId, orgId)]
  if (search) {
    conditions.push(
      sql`(LOWER(${user.email}) LIKE ${`%${search}%`} OR LOWER(${user.name}) LIKE ${`%${search}%`})`,
    )
  }
  if (status === "active") {
    conditions.push(
      sql`(${member.suspendedAt} IS NULL OR ${member.suspendedUntil} <= NOW())`,
    )
  }
  if (status === "suspended") {
    conditions.push(
      sql`(${member.suspendedAt} IS NOT NULL AND (${member.suspendedUntil} IS NULL OR ${member.suspendedUntil} > NOW()))`,
    )
  }
  const where = and(...conditions)

  const [rows, totalRow] = await Promise.all([
    db
      .select({
        memberId: member.id,
        userId: user.id,
        email: user.email,
        name: user.name,
        image: user.image,
        role: member.role,
        platformRole: user.role,
        banned: user.banned,
        userSuspendedAt: user.suspendedAt,
        userSuspendedUntil: user.suspendedUntil,
        memberSuspendedAt: member.suspendedAt,
        memberSuspendedUntil: member.suspendedUntil,
        memberSuspendedReason: member.suspendedReason,
        memberSuspendedBy: member.suspendedBy,
        joinedAt: member.createdAt,
        lastActiveAt: sql<Date | null>`(
          SELECT MAX(${sessionTable.createdAt}) FROM ${sessionTable}
          WHERE ${sessionTable.userId} = ${user.id}
        )`,
      })
      .from(member)
      .innerJoin(user, eq(user.id, member.userId))
      .where(where)
      .orderBy(desc(member.createdAt))
      .limit(limit)
      .offset(offset),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(member)
      .innerJoin(user, eq(user.id, member.userId))
      .where(where),
  ])
  return { members: rows, total: Number(totalRow[0]?.count ?? 0) }
}

/**
 * listInvitationsForOrg — workspace-side invitation list with status filter
 * (WS-19). Distinct from Better Auth's `listInvitations` which doesn't
 * surface accepted/canceled/rejected cleanly to the UI.
 */
export async function listInvitationsForOrg(
  orgId: string,
  opts: {
    status?: "pending" | "accepted" | "rejected" | "canceled" | "all"
  } = {},
) {
  const status = opts.status ?? "all"
  const conditions: any[] = [eq(invitation.organizationId, orgId)]
  if (status !== "all") conditions.push(eq(invitation.status, status))
  const where = and(...conditions)
  return db
    .select({
      id: invitation.id,
      email: invitation.email,
      role: invitation.role,
      status: invitation.status,
      expiresAt: invitation.expiresAt,
      createdAt: invitation.createdAt,
      inviterEmail: invitation.inviterEmail,
    })
    .from(invitation)
    .where(where)
    .orderBy(desc(invitation.createdAt))
}

/**
 * listOrgRecentAudit — WS-30 "Recent access changes" card.
 *
 * Returns audit rows whose action is one of the access-management
 * actions AND whose scope is this org (either targetType='org'
 * with targetId=orgId, or metadata.organizationId=orgId).
 */
export async function listOrgRecentAudit(
  orgId: string,
  opts: { limit?: number } = {},
) {
  const limit = Math.min(opts.limit ?? 20, 100)
  const actions = [
    "user.invite-to-org",
    "user.invite-resent",
    "user.invite-cancelled",
    "user.set-member-role",
    "user.remove-from-org",
    "user.suspend-from-workspace",
    "user.lift-workspace-suspension",
    "org.transfer-ownership",
  ] as const
  const where = and(
    inArray(auditLog.action, actions as unknown as string[]),
    sql`(${auditLog.targetType} = 'org' AND ${auditLog.targetId} = ${orgId}
       OR ${auditLog.metadata}->>'organizationId' = ${orgId})`,
  )
  const rows = await db
    .select()
    .from(auditLog)
    .where(where)
    .orderBy(desc(auditLog.createdAt))
    .limit(limit)
  return { events: rows }
}

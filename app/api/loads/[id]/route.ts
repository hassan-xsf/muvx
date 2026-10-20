import { NextResponse } from "next/server"
import { z } from "zod"
import { db } from "@/lib/db"
import { load, trip, invoice } from "@/lib/schema"
import { eq, and } from "drizzle-orm"
import { getSession } from "@/lib/dal"
import { getEffectivePermissions } from "@/lib/can"
import { recordAuditEvent } from "@/lib/audit"

const patchLoadSchema = z.object({
  customerName: z.string().min(1).optional(),
  customerEmail: z.string().email().optional().nullable(),
  customerPhone: z.string().optional().nullable(),
  originFacility: z.string().optional().nullable(),
  originAddress: z.string().optional().nullable(),
  originCity: z.string().optional(),
  originState: z.string().optional(),
  originZip: z.string().optional().nullable(),
  destFacility: z.string().optional().nullable(),
  destAddress: z.string().optional().nullable(),
  destCity: z.string().optional(),
  destState: z.string().optional(),
  destZip: z.string().optional().nullable(),
  rate: z.union([z.number(), z.string()]).optional(),
  loadType: z.string().optional(),
  commodity: z.string().optional().nullable(),
  weight: z.union([z.number(), z.string()]).optional().nullable(),
  status: z
    .enum(["available", "booked", "dispatched", "in_transit", "delivered", "completed", "cancelled"])
    .optional(),
  notes: z.string().optional().nullable(),
  specialInstructions: z.string().optional().nullable(),
})

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession()
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  const tenantId = session.session.activeOrganizationId
  if (!tenantId) {
    return NextResponse.json({ error: "No active workspace" }, { status: 400 })
  }

  const { id } = await params
  const [row] = await db
    .select()
    .from(load)
    .where(and(eq(load.id, id), eq(load.tenantId, tenantId)))
    .limit(1)

  if (!row) {
    return NextResponse.json({ error: "Load not found" }, { status: 404 })
  }

  return NextResponse.json({ load: row })
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession()
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  const tenantId = session.session.activeOrganizationId
  if (!tenantId) {
    return NextResponse.json({ error: "No active workspace" }, { status: 400 })
  }

  const perms = await getEffectivePermissions(session.user.id, tenantId)
  if (!perms.has("loads.edit") && !perms.has("loads.module")) {
    return NextResponse.json({ error: "Permission denied (loads.edit required)" }, { status: 403 })
  }

  const { id } = await params
  const body = await req.json().catch(() => ({}))
  const parsed = patchLoadSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid load update payload", details: parsed.error.format() }, { status: 400 })
  }

  const [existing] = await db
    .select()
    .from(load)
    .where(and(eq(load.id, id), eq(load.tenantId, tenantId)))
    .limit(1)

  if (!existing) {
    return NextResponse.json({ error: "Load not found" }, { status: 404 })
  }

  const updates: Record<string, any> = {
    updatedAt: new Date(),
  }

  for (const [key, value] of Object.entries(parsed.data)) {
    if (value !== undefined) {
      if (key === "rate" || key === "weight") {
        updates[key] = String(value)
        if (key === "rate") updates.finalRate = String(value)
      } else {
        updates[key] = value
      }
    }
  }

  const [updated] = await db
    .update(load)
    .set(updates)
    .where(and(eq(load.id, id), eq(load.tenantId, tenantId)))
    .returning()

  await recordAuditEvent({
    actor: { id: session.user.id, email: session.user.email },
    action: "load.update",
    target: { type: "load", id, label: existing.loadNumber },
    metadata: { updates, tenantId },
  })

  return NextResponse.json({ ok: true, load: updated })
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession()
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  const tenantId = session.session.activeOrganizationId
  if (!tenantId) {
    return NextResponse.json({ error: "No active workspace" }, { status: 400 })
  }

  const perms = await getEffectivePermissions(session.user.id, tenantId)
  if (!perms.has("loads.delete") && !perms.has("loads.edit")) {
    return NextResponse.json({ error: "Permission denied (loads.delete required)" }, { status: 403 })
  }

  const { id } = await params
  const [existing] = await db
    .select()
    .from(load)
    .where(and(eq(load.id, id), eq(load.tenantId, tenantId)))
    .limit(1)

  if (!existing) {
    return NextResponse.json({ error: "Load not found" }, { status: 404 })
  }

  // Clear references in trips and invoices before deletion
  await db
    .update(trip)
    .set({ loadId: null })
    .where(and(eq(trip.loadId, id), eq(trip.tenantId, tenantId)))

  await db
    .update(invoice)
    .set({ loadId: null })
    .where(and(eq(invoice.loadId, id), eq(invoice.tenantId, tenantId)))

  await db
    .delete(load)
    .where(and(eq(load.id, id), eq(load.tenantId, tenantId)))

  await recordAuditEvent({
    actor: { id: session.user.id, email: session.user.email },
    action: "load.delete",
    target: { type: "load", id, label: existing.loadNumber },
    metadata: { loadNumber: existing.loadNumber, customer: existing.customerName, tenantId },
  })

  return NextResponse.json({ ok: true, message: `Load #${existing.loadNumber} deleted.` })
}

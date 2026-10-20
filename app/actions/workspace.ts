"use server"

import { z } from "zod"
import { eq } from "drizzle-orm"
import { db } from "@/lib/db"
import { organization, user as userTable } from "@/lib/schema"
import { requireTenant, requirePermission, TenantError } from "@/lib/dal"
import { recordAuditEvent } from "@/lib/audit"
import { isWorkspaceLogoKey } from "@/lib/storage"
// Field-level permission map removed per Q&A (Oct 15, 2026):
// Owner + Admin can edit any field. The resource-level
// `workspace: ["update"]` gate (line ~118) is the only permission
// check. Sensitive fields (DOT, MC, EIN, legal name) get a
// confirmation modal in the UI, NOT a server-side block.

// ─── Phase 3 — WS-10: update workspace profile ──────────────────────────────
// Server action gated by `workspace: ["update"]` (owner + admin only).
// Captures a before/after snapshot in the audit row for WS-14.

const businessTypeEnum = z.enum([
  "broker",
  "carrier",
  "shipper",
  "3pl",
  "other",
])

const profileSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  slug: z
    .string()
    .min(2)
    .max(50)
    .regex(/^[a-z0-9-]+$/, "Use lowercase letters, numbers, and hyphens")
    .optional(),
  businessType: businessTypeEnum.nullable().optional(),
  dotNumber: z
    .string()
    .max(20, "DOT# too long")
    .regex(/^[A-Za-z0-9-]*$/, "DOT# must be alphanumeric")
    .nullable()
    .optional()
    .or(z.literal("").transform(() => null)),
  mcNumber: z
    .string()
    .max(20, "MC# too long")
    .regex(/^[A-Za-z0-9-]*$/, "MC# must be alphanumeric")
    .nullable()
    .optional()
    .or(z.literal("").transform(() => null)),
  ein: z
    .string()
    .max(20, "EIN too long")
    .regex(/^[0-9-]*$/, "EIN must be digits with optional dash")
    .nullable()
    .optional()
    .or(z.literal("").transform(() => null)),
  phone: z
    .string()
    .max(30)
    .regex(/^[+()0-9 -]*$/, "Phone has invalid characters")
    .nullable()
    .optional()
    .or(z.literal("").transform(() => null)),
  addressLine1: z.string().max(200).nullable().optional(),
  addressLine2: z.string().max(200).nullable().optional(),
  city: z.string().max(100).nullable().optional(),
  state: z.string().max(50).nullable().optional(),
  postalCode: z
    .string()
    .max(20)
    .regex(/^[A-Za-z0-9 -]*$/, "Postal code has invalid characters")
    .nullable()
    .optional()
    .or(z.literal("").transform(() => null)),
  country: z.string().max(2).default("US"),
  defaultCurrency: z
    .string()
    .length(3, "Currency must be a 3-letter ISO code")
    .regex(/^[A-Z]{3}$/, "Currency must be uppercase letters")
    .default("USD"),
  timeZone: z.string().min(1).max(60).default("America/Chicago"),
  fiscalYearStart: z
    .string()
    .regex(/^(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])$/, "Must be MM-DD")
    .default("01-01"),
  logo: z
    .string()
    .max(2048, "Logo value is too long")
    .nullable()
    .optional()
    .or(z.literal("").transform(() => null)),
  // Onboarding & operational profile extensions
  fleetSize: z.string().nullable().optional(),
  teamSize: z.string().nullable().optional(),
  geographicScope: z.string().nullable().optional(),
  currentTool: z.string().nullable().optional(),
  freightTypes: z.array(z.string()).optional(),
  primaryGoals: z.array(z.string()).optional(),
  website: z.string().max(255).nullable().optional(),
  supportEmail: z
    .string()
    .email()
    .nullable()
    .optional()
    .or(z.literal("").transform(() => null)),
})

export type UpdateWorkspaceProfileInput = z.input<typeof profileSchema>

export type UpdateWorkspaceProfileResult =
  | { ok: true; organization: { id: string; name: string; slug: string } }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> }

export async function updateWorkspaceProfileAction(
  raw: UpdateWorkspaceProfileInput,
): Promise<UpdateWorkspaceProfileResult> {
  console.log("[WORKSPACE/ACTION] updateWorkspaceProfileAction called")
  return withUpdateWorkspaceProfile(raw)
}

async function withUpdateWorkspaceProfile(
  raw: UpdateWorkspaceProfileInput,
): Promise<UpdateWorkspaceProfileResult> {
  // 1. Auth + resource-level permission gate
  let ctx
  try {
    ctx = await requireTenant()
    await requirePermission({ resource: "workspace", action: "update" })
  } catch (err) {
    if (err instanceof TenantError) {
      return { ok: false, error: err.code }
    }
    throw err
  }

  // 2. Validate
  const parsed = profileSchema.safeParse(raw)
  if (!parsed.success) {
    const fieldErrors: Record<string, string[]> = {}
    for (const issue of parsed.error.issues) {
      const k = issue.path.join(".") || "_"
      ;(fieldErrors[k] ??= []).push(issue.message)
    }
    return { ok: false, error: "VALIDATION_ERROR", fieldErrors }
  }
  const data = parsed.data
  if (
    data.logo &&
    !z.string().url().safeParse(data.logo).success &&
    !isWorkspaceLogoKey(ctx.tenantId, data.logo)
  ) {
    return {
      ok: false,
      error: "VALIDATION_ERROR",
      fieldErrors: { logo: ["Logo must be a valid URL or a logo uploaded to this workspace."] },
    }
  }

  // 3. Snapshot before
  const [before] = await db
    .select()
    .from(organization)
    .where(eq(organization.id, ctx.tenantId))
    .limit(1)
  if (!before) {
    return { ok: false, error: "WORKSPACE_NOT_FOUND" }
  }

  // 4. Apply update (only the fields present in input)
  // Parse existing metadata and merge new operational onboarding fields
  let existingMeta: Record<string, any> = {}
  if (before.metadata) {
    try {
      existingMeta =
        typeof before.metadata === "string"
          ? JSON.parse(before.metadata)
          : before.metadata
    } catch (e) {
      console.warn("[WORKSPACE/ACTION] failed to parse existing metadata:", e)
    }
  }

  const updatedMeta = {
    ...existingMeta,
    businessType: data.businessType ?? existingMeta.businessType ?? null,
    dotNumber: data.dotNumber ?? existingMeta.dotNumber ?? null,
    mcNumber: data.mcNumber ?? existingMeta.mcNumber ?? null,
    fleetSize: data.fleetSize !== undefined ? data.fleetSize : (existingMeta.fleetSize ?? null),
    teamSize: data.teamSize !== undefined ? data.teamSize : (existingMeta.teamSize ?? null),
    geographicScope:
      data.geographicScope !== undefined
        ? data.geographicScope
        : (existingMeta.geographicScope ?? null),
    currentTool:
      data.currentTool !== undefined
        ? data.currentTool
        : (existingMeta.currentTool ?? null),
    freightTypes:
      data.freightTypes !== undefined
        ? data.freightTypes
        : (existingMeta.freightTypes ?? []),
    primaryGoals:
      data.primaryGoals !== undefined
        ? data.primaryGoals
        : (existingMeta.primaryGoals ?? []),
    website: data.website !== undefined ? data.website : (existingMeta.website ?? null),
    supportEmail:
      data.supportEmail !== undefined
        ? data.supportEmail
        : (existingMeta.supportEmail ?? null),
  }

  const patch: Partial<typeof organization.$inferInsert> = {
    name: data.name ?? before.name,
    slug: data.slug ?? before.slug,
    businessType: data.businessType ?? null,
    dotNumber: data.dotNumber ?? null,
    mcNumber: data.mcNumber ?? null,
    ein: data.ein ?? null,
    phone: data.phone ?? null,
    addressLine1: data.addressLine1 ?? null,
    addressLine2: data.addressLine2 ?? null,
    city: data.city ?? null,
    state: data.state ?? null,
    postalCode: data.postalCode ?? null,
    country: data.country,
    defaultCurrency: data.defaultCurrency,
    timeZone: data.timeZone,
    fiscalYearStart: data.fiscalYearStart,
    logo: data.logo ?? null,
    metadata: JSON.stringify(updatedMeta),
  }
  await db
    .update(organization)
    .set(patch)
    .where(eq(organization.id, ctx.tenantId))

  // 5. Read after
  const [after] = await db
    .select()
    .from(organization)
    .where(eq(organization.id, ctx.tenantId))
    .limit(1)
  if (!after) {
    return { ok: false, error: "WORKSPACE_NOT_FOUND" }
  }

  // 6. Build before/after diff (only fields that changed)
  const PROFILE_KEYS = [
    "name",
    "slug",
    "logo",
    "businessType",
    "dotNumber",
    "mcNumber",
    "ein",
    "phone",
    "addressLine1",
    "addressLine2",
    "city",
    "state",
    "postalCode",
    "country",
    "defaultCurrency",
    "timeZone",
    "fiscalYearStart",
  ] as const
  const changes: Record<string, { before: unknown; after: unknown }> = {}
  for (const k of PROFILE_KEYS) {
    const b = before[k as keyof typeof before]
    const a = after[k as keyof typeof after]
    if (b !== a) changes[k] = { before: b ?? null, after: a ?? null }
  }

  // 7. Audit (WS-14, R-07)
  const [actor] = await db
    .select({ email: userTable.email })
    .from(userTable)
    .where(eq(userTable.id, ctx.userId))
    .limit(1)

  await recordAuditEvent({
    actor: { id: ctx.userId, email: actor?.email ?? "(unknown)" },
    action: "workspace.update",
    target: { type: "workspace", id: after.id, label: after.name },
    metadata: {
      tenantId: after.id,
      changedFields: Object.keys(changes),
      changes,
      changedFieldCount: Object.keys(changes).length,
    },
  })

  console.log(
    `[WORKSPACE/ACTION] ✅ updated ${Object.keys(changes).length} field(s) for org ${after.id}`,
  )

  try {
    const { dispatchNotificationEvent } = await import("@/lib/notifications")
    await dispatchNotificationEvent({
      organizationId: ctx.tenantId,
      category: "system",
      event: "system.workspace_updated",
      severity: "info",
      title: "Workspace Profile Updated",
      message: `Company profile details for "${after.name}" were updated.`,
      link: "/settings/workspace",
      metadata: { changedFields: Object.keys(changes) },
    })
  } catch (e) {
    console.error("[NOTIFICATIONS] Error dispatching system.workspace_updated:", e)
  }

  return {
    ok: true,
    organization: { id: after.id, name: after.name, slug: after.slug },
  }
}

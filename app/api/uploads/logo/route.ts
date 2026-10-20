/**
 * POST /api/uploads/logo
 *
 * Multipart upload for the workspace logo. Stores a private object under
 * `workspace-logos/<orgId>/` and returns its key.
 *
 * Owner or admin only.
 */
import { NextRequest, NextResponse } from "next/server"
import { requireTenant, requirePermission, TenantError } from "@/lib/dal"
import { db } from "@/lib/db"
import { organization } from "@/lib/schema"
import { eq } from "drizzle-orm"
import { randomUUID } from "crypto"
import { uploadObject } from "@/lib/s3"

export const instant = false

const ALLOWED = new Set(["image/png", "image/jpeg", "image/webp", "image/svg+xml"])
const MAX_BYTES = 2 * 1024 * 1024

export async function POST(req: NextRequest) {
  try {
    const t = await requireTenant()
    await requirePermission({ resource: "workspace", action: "update" })

    const form = await req.formData()
    const file = form.get("file")
    if (!file || typeof file === "string") {
      return NextResponse.json({ error: "No file" }, { status: 400 })
    }
    if (!ALLOWED.has(file.type)) {
      return NextResponse.json(
        { error: `Unsupported file type: ${file.type}` },
        { status: 400 }
      )
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json(
        { error: "File too large (max 2 MB)" },
        { status: 400 }
      )
    }

    const ext = file.type.split("/")[1] === "svg+xml" ? "svg" : file.type.split("/")[1]
    const key = `workspace-logos/${t.tenantId}/${randomUUID()}.${ext}`

    const bytes = Buffer.from(await file.arrayBuffer())
    const legacyBucket = process.env.S3_BUCKET ?? "muvx-app-storage"
    const legacyRegion = process.env.S3_REGION ?? "ap-southeast-2"
    await uploadObject(
      key,
      bytes,
      file.type,
      process.env.MUVX_AWS_BUCKET
        ? undefined
        : { bucket: legacyBucket, region: legacyRegion },
    )

    // Persist immediately on the organization row so the new logo
    // shows up in the sidebar without waiting for the save action.
    await db
      .update(organization)
      .set({ logo: key })
      .where(eq(organization.id, t.tenantId))

    try {
      const { dispatchNotificationEvent } = await import("@/lib/notifications")
      await dispatchNotificationEvent({
        organizationId: t.tenantId,
        category: "system",
        event: "system.workspace_updated",
        severity: "info",
        title: "Company Logo Updated",
        message: "New organization logo has been uploaded and applied.",
        link: "/settings/workspace",
      })
    } catch (e) {
      console.error("[NOTIFICATIONS] Error dispatching system.workspace_updated for logo:", e)
    }

    return NextResponse.json({ key })
  } catch (err) {
    if (err instanceof TenantError) {
      return NextResponse.json(
        { error: err.code },
        {
          status:
            err.code === "UNAUTHORIZED"
              ? 401
              : err.code === "FORBIDDEN"
                ? 403
                : 409,
        }
      )
    }
    console.error(`[API/UPLOADS-LOGO] error:`, err)
    return NextResponse.json(
      { error: (err as Error)?.message || "Upload failed" },
      { status: 500 }
    )
  }
}

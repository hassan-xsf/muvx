import { eq } from "drizzle-orm"
import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { requireTenant, TenantError } from "@/lib/dal"
import { organization } from "@/lib/schema"
import { createPresignedGet, publicUrl } from "@/lib/s3"
import { isWorkspaceLogoKey } from "@/lib/storage"

export const instant = false

type LogoLocation = {
  key: string
  storage?: { bucket: string; region: string }
}

function getLogoLocation(value: string, tenantId: string): LogoLocation | null {
  if (isWorkspaceLogoKey(tenantId, value)) {
    if (value.startsWith(`workspace-logos/${tenantId}/`) && !process.env.MUVX_AWS_BUCKET) {
      return {
        key: value,
        storage: {
          bucket: process.env.S3_BUCKET ?? "muvx-app-storage",
          region: process.env.S3_REGION ?? "ap-southeast-2",
        },
      }
    }
    return { key: value }
  }

  let logoUrl: URL
  try {
    logoUrl = new URL(value)
  } catch {
    return null
  }

  const currentBucketUrl = new URL(publicUrl(""))
  if (logoUrl.origin === currentBucketUrl.origin) {
    const key = decodeURIComponent(logoUrl.pathname.replace(/^\/+/, ""))
    return isWorkspaceLogoKey(tenantId, key) ? { key } : null
  }

  const legacyBucket = process.env.S3_BUCKET ?? "muvx-app-storage"
  const legacyRegion = process.env.S3_REGION ?? "ap-southeast-2"
  const legacyBase = new URL(
    process.env.S3_PUBLIC_BASE ??
      `https://${legacyBucket}.s3.${legacyRegion}.amazonaws.com`,
  )
  const basePath = legacyBase.pathname.replace(/\/+$/, "")
  if (
    logoUrl.origin !== legacyBase.origin ||
    (basePath && !logoUrl.pathname.startsWith(`${basePath}/`))
  ) {
    return null
  }

  const key = decodeURIComponent(
    logoUrl.pathname.slice(basePath.length).replace(/^\/+/, ""),
  )
  if (!isWorkspaceLogoKey(tenantId, key)) {
    return null
  }

  if (
    legacyBucket === process.env.MUVX_AWS_BUCKET &&
    legacyRegion === (process.env.MUVX_AWS_REGION ?? "us-east-1")
  ) {
    return { key }
  }
  return { key, storage: { bucket: legacyBucket, region: legacyRegion } }
}

export async function GET() {
  try {
    const { tenantId } = await requireTenant()
    const [workspace] = await db
      .select({ logo: organization.logo })
      .from(organization)
      .where(eq(organization.id, tenantId))
      .limit(1)

    if (!workspace?.logo) {
      return NextResponse.json({ error: "LOGO_NOT_FOUND" }, { status: 404 })
    }

    const location = getLogoLocation(workspace.logo, tenantId)
    if (!location) {
      return NextResponse.json({ error: "LOGO_NOT_FOUND" }, { status: 404 })
    }

    const { url } = await createPresignedGet(
      location.key,
      300,
      undefined,
      location.storage,
    )
    return NextResponse.redirect(url, {
      status: 307,
      headers: { "Cache-Control": "private, no-store, max-age=0" },
    })
  } catch (error) {
    if (error instanceof TenantError) {
      const status =
        error.code === "UNAUTHORIZED"
          ? 401
          : error.code === "FORBIDDEN"
            ? 403
            : 409
      return NextResponse.json({ error: error.code }, { status })
    }
    console.error("[API/WORKSPACE-LOGO] Failed to resolve workspace logo")
    return NextResponse.json(
      { error: "Could not load workspace logo." },
      { status: 500 },
    )
  }
}

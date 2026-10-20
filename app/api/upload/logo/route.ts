/**
 * POST /api/upload/logo — generate a presigned S3 PUT URL for a workspace logo.
 *
 * Flow:
 *   1. Client POSTs { contentType, contentLength } (headers only, no file bytes)
 *   2. Server validates tenant + permission + file constraints
 *   3. Server returns { uploadUrl, key, maxSize, allowedTypes }
 *   4. Client uploads the file directly to S3 via PUT (fetch)
 *   5. Client saves the returned key through the workspace profile action
 *
 * The server never touches the file bytes — credentials stay server-side.
 */
import { NextRequest, NextResponse } from "next/server"
import { presignWorkspaceLogo } from "@/lib/storage"
import { TenantError } from "@/lib/dal"
import { s3Configured } from "@/lib/s3"

// Node.js is the default runtime for route handlers, which is what the
// @aws-sdk/S3 client requires. The `runtime = "nodejs"` export was removed
// because it's incompatible with `cacheComponents` and the Edge runtime is
// deprecated — Node.js is selected automatically.
export async function POST(req: NextRequest) {
  try {
    if (!s3Configured) {
      return NextResponse.json(
        {
          error: "NOT_CONFIGURED",
          message:
            "S3 storage is not configured. Set MUVX_AWS_BUCKET / " +
            "MUVX_AWS_REGION env vars and run: npx tsx scripts/create-s3-bucket.ts",
        },
        { status: 503 },
      )
    }

    const body = await req.json().catch(() => null)
    if (!body || typeof body !== "object") {
      return NextResponse.json(
        { error: "BODY_REQUIRED", message: "Content-Type and contentLength are required" },
        { status: 400 },
      )
    }

    const contentType = (body as { contentType?: string }).contentType
    const contentLength = (body as { contentLength?: number }).contentLength

    if (!contentType || !contentLength) {
      return NextResponse.json(
        { error: "BAD_REQUEST", message: "contentType and contentLength are required" },
        { status: 400 },
      )
    }

    const result = await presignWorkspaceLogo({
      contentType,
      contentLength,
    })

    return NextResponse.json(result)
  } catch (err) {
    if (err instanceof TenantError) {
      const status =
        err.code === "UNAUTHORIZED"
          ? 401
          : err.code === "FORBIDDEN"
            ? 403
            : 409
      return NextResponse.json({ error: err.code }, { status })
    }
    const message = err instanceof Error ? err.message : "Unknown error"
    return NextResponse.json(
      { error: "INTERNAL", message },
      { status: 500 },
    )
  }
}

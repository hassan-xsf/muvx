import "server-only"

import {
  createPresignedPut,
  deleteObject,
  logoKey,
} from "@/lib/s3"
import { requireTenant, requirePermission } from "@/lib/dal"

/**
 * MUVX Storage Service — business-logic layer above the raw S3 client.
 *
 * Every storage operation is:
 *   1. Tenant-scoped (the workspaceId is embedded in the S3 key)
 *   2. Permission-checked (requireTenant + requirePermission)
 *   3. Audited (returns a key that gets persisted to the org/row)
 *
 * Usage from a route handler:
 *   const { uploadUrl, key } = await presignWorkspaceLogo()
 *   // browser uploads to uploadUrl, then saves { logo: key } through the
 *   // workspace profile action.
 */

// ─── Logo upload ──────────────────────────────────────────────────

const ALLOWED_IMAGE_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
] as const

const MAX_LOGO_SIZE = 5 * 1024 * 1024 // 5 MB

function isAllowedImageType(
  contentType: string,
): contentType is (typeof ALLOWED_IMAGE_TYPES)[number] {
  return (ALLOWED_IMAGE_TYPES as readonly string[]).includes(contentType)
}

export interface LogoUploadUrlResult {
  uploadUrl: string
  key: string
  maxSize: number
  allowedTypes: readonly string[]
}

/** True only for server-generated logo keys in this workspace's namespaces. */
export function isWorkspaceLogoKey(
  workspaceId: string,
  key: string,
): boolean {
  const escapedWorkspaceId = workspaceId.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  return (
    new RegExp(
      `^logos/${escapedWorkspaceId}-\\d+\\.(?:png|jpe?g|webp|gif)$`,
      "i",
    ).test(key) ||
    new RegExp(
      `^workspace-logos/${escapedWorkspaceId}/[a-f0-9-]+\\.(?:png|jpe?g|webp|svg)$`,
      "i",
    ).test(key)
  )
}

/**
 * Generate a presigned PUT URL for a workspace logo upload.
 *
 * - Requires an active workspace + `workspace: update` permission
 * - Validates the requested content type and size
 * - Server chooses the S3 key (workspace-scoped), so the client
 *   cannot write to arbitrary paths
 */
export async function presignWorkspaceLogo(
  opts: { contentType: string; contentLength: number },
): Promise<LogoUploadUrlResult> {
  const ctx = await requireTenant()
  // Only owner + admin can change the logo (same gate as profile edit)
  await requirePermission({ resource: "workspace", action: "update" })

  if (!isAllowedImageType(opts.contentType)) {
    throw new Error(
      `Unsupported file type: ${opts.contentType}. Allowed: ${ALLOWED_IMAGE_TYPES.join(", ")}`,
    )
  }
  if (opts.contentLength > MAX_LOGO_SIZE) {
    throw new Error(
      `File too large: ${(opts.contentLength / 1024 / 1024).toFixed(1)}MB. Max: ${MAX_LOGO_SIZE / 1024 / 1024}MB`,
    )
  }

  const key = logoKey(ctx.tenantId, `logo.${opts.contentType.split("/")[1]}`)
  const { url } = await createPresignedPut(
    key,
    opts.contentType,
    opts.contentLength,
  )

  return {
    uploadUrl: url,
    key,
    maxSize: MAX_LOGO_SIZE,
    allowedTypes: ALLOWED_IMAGE_TYPES,
  }
}

/** Delete a workspace logo from S3. */
export async function deleteWorkspaceLogo(
  key: string,
): Promise<void> {
  const ctx = await requireTenant()
  await requirePermission({ resource: "workspace", action: "update" })
  // Ensure the key belongs to this workspace
  if (!isWorkspaceLogoKey(ctx.tenantId, key)) {
    throw new Error("Logo key does not belong to this workspace")
  }
  await deleteObject(key)
}

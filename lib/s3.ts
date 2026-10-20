import "server-only"

import { S3Client } from "@aws-sdk/client-s3"
import { getSignedUrl } from "@aws-sdk/s3-request-presigner"
import { PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3"

/**
 * MUVX S3 storage layer — single source of truth for all file operations.
 *
 * Design: all file uploads go through presigned POST URLs generated here on
 * the server. This keeps AWS credentials 100 % server-side — the browser
 * uploads directly to S3 without the server ever touching the file bytes.
 *
 * Bucket + region are read from environment variables:
 *   MUVX_AWS_BUCKET     — S3 bucket name (e.g. "muvx-prod-storage")
 *   MUVX_AWS_REGION     — AWS region       (e.g. "us-east-1")
 *   MUVX_AWS_ACCESS_KEY_ID / MUVX_AWS_SECRET_ACCESS_KEY  — optional, falls
 *   back to the AWS SDK's default credential chain (EC2/ECS/SSO).
 *
 * Key layout inside the bucket:
 *   logos/{workspaceId}/{filename}      — workspace logos
 *   docs/{workspaceId}/{category}/{filename} — operational documents
 *   uploads/{workspaceId}/{filename}    — ad-hoc uploads
 */

const bucket = process.env.MUVX_AWS_BUCKET
const region = process.env.MUVX_AWS_REGION ?? "us-east-1"

/**
 * Whether S3 storage is configured. Returns false in local dev when
 * MUVX_AWS_BUCKET is not set — the upload endpoint returns a clear 503
 * instead of crashing the server at import time.
 */
export const s3Configured = !!bucket

/**
 * S3 client — lazily created so it doesn't crash during SSR when env vars
 * aren't set (e.g. local dev without S3). The functions below check `bucket`
 * at call time and throw a clear error.
 */
const _s3Clients = new Map<string, S3Client>()
function getS3(
  clientRegion = region,
  bucketName: string | undefined = bucket,
): S3Client {
  if (!bucketName) {
    throw new Error(
      "S3 storage is not configured — set MUVX_AWS_BUCKET in your environment",
    )
  }
  let client = _s3Clients.get(clientRegion)
  if (!client) {
    client = new S3Client({
      region: clientRegion,
      credentials:
        process.env.MUVX_AWS_ACCESS_KEY_ID && process.env.MUVX_AWS_SECRET_ACCESS_KEY
          ? {
              accessKeyId: process.env.MUVX_AWS_ACCESS_KEY_ID,
              secretAccessKey: process.env.MUVX_AWS_SECRET_ACCESS_KEY,
            }
          : undefined, // fall back to default credential chain (SSO/EC2/ECS)
    })
    _s3Clients.set(clientRegion, client)
  }
  return client
}

// ─── Key path helpers ─────────────────────────────────────────────

export function logoKey(workspaceId: string, filename: string): string {
  // Sanitize filename: keep extension, replace everything else with a hash
  const ext = filename.split(".").pop()
  const safe = `${workspaceId}-${Date.now()}.${ext}`
  return `logos/${safe}`
}

/**
 * Generate a presigned POST URL for direct-to-S3 upload from the browser.
 *
 * The key is chosen by the server (workspace-scoped), so the caller can't
 * write to arbitrary paths. The browser gets a time-limited URL and uploads
 * the file bytes directly to S3 — our server never handles them.
 */
export async function createPresignedPut(
  key: string,
  contentType: string,
  contentLength: number,
  expiresInSec = 300, // 5 minutes
): Promise<{ url: string }> {
  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    ContentType: contentType,
    ContentLength: contentLength,
    // ACL removed — bucket has BlockPublicAcls=true; use presigned GET URLs for public access
  })
  const url = await getSignedUrl(getS3(), command, {
    expiresIn: expiresInSec,
  })
  // Return the key too so the client can save it via the workspace API
  return { url }
}

/** Upload a server-received file using the configured private S3 storage. */
export async function uploadObject(
  key: string,
  body: Uint8Array,
  contentType: string,
  storage?: { bucket: string; region: string },
): Promise<void> {
  const targetBucket = storage?.bucket ?? bucket
  if (!targetBucket) {
    throw new Error(
      "S3 storage is not configured — set MUVX_AWS_BUCKET in your environment",
    )
  }
  await getS3(storage?.region, targetBucket).send(
    new PutObjectCommand({
      Bucket: targetBucket,
      Key: key,
      Body: body,
      ContentType: contentType,
    }),
  )
}

/** Full public URL for a key stored in the bucket. 
 * Note: Objects are private by default (bucket blocks public ACLs).
 * For public access, use presigned GET URLs with appropriate expiry.
 */
export function publicUrl(key: string): string {
  return `https://${bucket}.s3.${region}.amazonaws.com/${key}`
}

/**
 * Generate a time-limited presigned GET URL for a private S3 object.
 *
 * `mediaType` is passed through as S3's `ResponseContentType`, which overrides
 * the stored Content-Type on the response. Without it a GET can come back as
 * `application/octet-stream` (or with no type at all) even though the object
 * was uploaded with the right type — and a model fetching that URL then refuses
 * the file with "expected application/pdf, detected unknown".
 */
export async function createPresignedGet(
  key: string,
  expiresInSec = 3600, // 1 hour default
  mediaType?: string,
  storage?: { bucket: string; region: string },
): Promise<{ url: string }> {
  const { GetObjectCommand } = await import("@aws-sdk/client-s3")
  const targetBucket = storage?.bucket ?? bucket
  const targetRegion = storage?.region ?? region
  if (!targetBucket) {
    throw new Error(
      "S3 storage is not configured — set MUVX_AWS_BUCKET in your environment",
    )
  }
  const command = new GetObjectCommand({
    Bucket: targetBucket,
    Key: key,
    ...(mediaType ? { ResponseContentType: mediaType } : {}),
  })
  const url = await getSignedUrl(
    getS3(targetRegion, targetBucket),
    command,
    { expiresIn: expiresInSec },
  )
  return { url }
}

/** Delete an object by key. */
export async function deleteObject(key: string): Promise<void> {
  await getS3().send(
    new DeleteObjectCommand({ Bucket: bucket, Key: key }),
  )
}

/** Check whether a bucket exists (used by the setup script). */
export async function bucketExists(): Promise<boolean> {
  try {
    const { HeadBucketCommand } = await import("@aws-sdk/client-s3")
    await getS3().send(
      new HeadBucketCommand({ Bucket: bucket }),
    )
    return true
  } catch {
    return false
  }
}

const self = {
  createPresignedPut,
  publicUrl,
  uploadObject,
  deleteObject,
  bucketExists,
  logoKey,
}
export default self

"use client"

import * as React from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { usePermissions } from "@/lib/permissions-context"
import { toast } from "sonner"
import {
  Upload,
  Trash2,
  Loader2,
  Check,
  Paintbrush,
  Eye,
} from "lucide-react"
import { updateWorkspaceProfileAction } from "@/app/actions/workspace"
import { SettingsPageHeader } from "@/components/settings/settings-page-header"
import { getWorkspaceLogoImageSource } from "@/lib/workspace-logo-url"

type Profile = {
  id: string
  name: string
  slug: string
  logo: string | null
  businessType: string | null
  dotNumber: string | null
  mcNumber: string | null
  ein: string | null
  phone: string | null
  addressLine1: string | null
  addressLine2: string | null
  city: string | null
  state: string | null
  postalCode: string | null
  country: string
  defaultCurrency: string
  timeZone: string
  fiscalYearStart: string
}

export function BrandingClient() {
  const router = useRouter()
  const queryClient = useQueryClient()
  const perms = usePermissions()
  const canEdit = perms.has("workspace.profile.edit")

  const { data, isLoading } = useQuery<{ profile: Profile }>({
    queryKey: ["workspace-profile"],
    queryFn: async () => {
      const r = await fetch("/api/settings/workspace-profile")
      if (!r.ok) throw new Error("Failed to load")
      return r.json()
    },
  })

  const fileRef = React.useRef<HTMLInputElement>(null)
  const [logoUrl, setLogoUrl] = React.useState<string | null>(null)
  const [uploading, setUploading] = React.useState(false)
  const [saving, setSaving] = React.useState(false)
  const [removed, setRemoved] = React.useState(false)

  React.useEffect(() => {
    if (data?.profile) setLogoUrl(data.profile.logo)
  }, [data])

  const handleFile = async (file: File) => {
    if (!file) return
    if (!file.type.startsWith("image/")) {
      toast.error("Logo must be an image (PNG, JPG, SVG).")
      return
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error("Logo must be under 2 MB.")
      return
    }
    setUploading(true)
    const localUrl = URL.createObjectURL(file)
    setLogoUrl(localUrl)
    setRemoved(false)
    try {
      const fd = new FormData()
      fd.append("file", file)
      const r = await fetch("/api/uploads/logo", { method: "POST", body: fd })
      if (!r.ok) {
        const j = await r.json().catch(() => ({}))
        throw new Error(j.error || "Upload failed")
      }
      const j = await r.json()
      if (typeof j.key !== "string") {
        throw new Error("Upload response did not include a workspace logo key.")
      }
      setLogoUrl(j.key)
      URL.revokeObjectURL(localUrl)
      toast.success("Logo uploaded")
    } catch (e) {
      URL.revokeObjectURL(localUrl)
      setLogoUrl(data?.profile.logo ?? null)
      toast.error((e as Error).message || "Upload failed")
    } finally {
      setUploading(false)
    }
  }

  const handleSave = async () => {
    if (!data) return
    setSaving(true)
    try {
      const finalLogo = removed ? null : logoUrl
      const result = await updateWorkspaceProfileAction({
        name: data.profile.name,
        logo: finalLogo,
      })
      if ((result as any)?.error) {
        toast.error((result as any).error)
        return
      }
      toast.success("Branding saved")
      queryClient.invalidateQueries({ queryKey: ["workspace-profile"] })
      router.refresh()
    } catch (e) {
      toast.error((e as Error).message || "Failed to save")
    } finally {
      setSaving(false)
    }
  }

  if (isLoading || !data) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    )
  }

  const initials = (data.profile.name || "M")
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase()

  const isDirty =
    (removed && data.profile.logo) ||
    (!removed && logoUrl !== data.profile.logo)

  return (
    <div>
      <SettingsPageHeader
        kicker="Workspace"
        title="Branding"
        description="Logo, name, and how Muvx looks to your team and customers."
        icon={Paintbrush}
      >
        {canEdit && (
          <Button
            onClick={handleSave}
            disabled={!isDirty || saving || uploading}
            className="h-10 gap-1.5 rounded-full bg-brand-ink px-5 text-[13px] font-medium text-brand-cream hover:bg-brand-ink-soft disabled:opacity-50"
          >
            {saving ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Check className="size-3.5" />
            )}
            Save changes
          </Button>
        )}
      </SettingsPageHeader>

      {!canEdit && (
        <div className="mb-6 rounded-xl border border-brand-rule bg-brand-card p-4 text-[13px] text-brand-muted-soft">
          You can view branding settings, but only owners and admins can change them.
        </div>
      )}

      {/* Logo card */}
      <div className="grid gap-4 md:grid-cols-3">
        {/* Logo uploader */}
        <div className="md:col-span-2 rounded-xl border border-brand-rule bg-brand-card p-6">
          <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-brand-muted-soft">
            Logo
          </p>
          <p className="mt-1 text-[14px] text-brand-ink">
            The mark your team and customers see.
          </p>
          <div className="mt-5 flex items-center gap-5">
            <div className="shrink-0">
              {logoUrl && !removed ? (
                <div className="size-28 rounded-xl border border-brand-rule overflow-hidden bg-brand-cream flex items-center justify-center">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={getWorkspaceLogoImageSource(logoUrl, data.profile.id)}
                    alt="Workspace logo"
                    className="max-h-full max-w-full object-contain"
                  />
                </div>
              ) : (
                <div className="size-28 rounded-xl border border-brand-rule bg-brand-ink text-brand-cream flex items-center justify-center font-serif text-4xl">
                  {initials}
                </div>
              )}
            </div>
            <div className="flex-1 space-y-3">
              <p className="text-[14px] font-semibold text-brand-ink">
                {data.profile.name}
              </p>
              <p className="text-[12px] text-brand-muted-soft">
                {logoUrl && !removed
                  ? "200 × 60 px recommended · transparent backgrounds work"
                  : "No logo uploaded yet — using a default mark with your initials"}
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0]
                    if (f) handleFile(f)
                    if (fileRef.current) fileRef.current.value = ""
                  }}
                />
                <Button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  disabled={!canEdit || uploading}
                  className="h-9 gap-1.5 rounded-full bg-brand-ink px-4 text-[13px] font-medium text-brand-cream hover:bg-brand-ink-soft"
                >
                  {uploading ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <Upload className="size-3.5" />
                  )}
                  {logoUrl && !removed ? "Replace logo" : "Upload logo"}
                </Button>
                {logoUrl && !removed && (
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => setRemoved(true)}
                    disabled={!canEdit}
                    className="h-9 text-[13px] text-brand-muted-soft hover:text-red-600"
                  >
                    <Trash2 className="size-3.5" />
                    <span className="ml-1.5">Remove</span>
                  </Button>
                )}
              </div>
              <p className="text-[11px] text-brand-muted-soft">
                PNG, JPG, or SVG · Max 2 MB
              </p>
            </div>
          </div>
        </div>

        {/* Live preview */}
        <div className="rounded-xl border border-brand-rule bg-brand-card p-6">
          <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-brand-muted-soft flex items-center gap-1">
            <Eye className="size-3" /> Preview
          </p>
          <p className="mt-1 text-[14px] text-brand-ink">How it appears</p>
          <div className="mt-5 space-y-3">
            {/* Sidebar tile mock */}
            <div className="rounded-lg border border-brand-rule bg-brand-card p-3 flex items-center gap-3">
              <div className="size-9 rounded-md bg-brand-ink text-brand-cream flex items-center justify-center font-serif text-[15px] shrink-0">
                {initials}
              </div>
              <div className="min-w-0">
                <p className="text-[13px] font-semibold text-brand-ink truncate">
                  {data.profile.name}
                </p>
                <p className="text-[10px] font-mono uppercase tracking-wide text-brand-muted-soft">
                  /{data.profile.slug}
                </p>
              </div>
            </div>
            {/* Browser tab */}
            <div className="rounded-lg border border-brand-rule bg-brand-cream p-2.5">
              <div className="flex items-center gap-2">
                <div className="size-4 rounded bg-brand-ink flex items-center justify-center font-serif text-[8px] text-brand-cream">
                  {initials}
                </div>
                <span className="text-[11px] text-brand-ink/80 truncate">
                  {data.profile.name} · Muvx TMS
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Color tokens */}
      <div className="mt-6 rounded-xl border border-brand-rule bg-brand-card p-6">
        <div className="flex items-end justify-between flex-wrap gap-2">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-brand-muted-soft">
              Brand colors
            </p>
            <p className="mt-1 text-[14px] text-brand-ink">
              The Muvx palette
            </p>
          </div>
          <p className="text-[12px] text-brand-muted-soft">
            Custom brand colors land in a follow-up release.
          </p>
        </div>
        <div className="mt-5 grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { name: "Brand ink", value: "#16181d", text: "text-brand-cream" },
            { name: "Brand accent", value: "#d9622b", text: "text-brand-cream" },
            { name: "Brand cream", value: "#f5f2ec", text: "text-brand-ink" },
            { name: "Brand rule", value: "#e4ddd3", text: "text-brand-ink" },
          ].map((c) => (
            <div key={c.name} className="rounded-lg border border-brand-rule overflow-hidden">
              <div
                className={`h-16 flex items-end p-3 font-mono text-[11px] ${c.text}`}
                style={{ background: c.value }}
              >
                {c.value}
              </div>
              <div className="p-3">
                <p className="text-[12px] font-medium text-brand-ink">{c.name}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

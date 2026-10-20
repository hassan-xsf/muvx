"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { authClient } from "@/lib/auth-client"
import { useAuthStore } from "@/lib/stores/auth-store"
import {
  updateWorkspaceProfileAction,
  type UpdateWorkspaceProfileInput,
} from "@/app/actions/workspace"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Loader2,
  Building2,
  Check,
  AlertCircle,
  Lock,
  Upload,
  X,
  Truck,
  Compass,
  Package,
  Target,
} from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"

import { getAvailableTimezones } from "@/lib/timezone"
import { getAllCurrencies } from "@/lib/currencies"
import { getAllCountries } from "@/lib/geography"
import { getWorkspaceLogoImageSource } from "@/lib/workspace-logo-url"

const BUSINESS_TYPES = [
  { value: "carrier", label: "Carrier (Own trucks & drivers)" },
  { value: "broker", label: "Freight Broker (Non-asset logistics)" },
  { value: "both", label: "Both (Asset carrier + Brokerage)" },
  { value: "3pl", label: "3PL (Third-party logistics provider)" },
  { value: "shipper", label: "Direct Shipper / Private Fleet" },
  { value: "other", label: "Other Logistics Service" },
]

const FLEET_SIZES = [
  { value: "1-5", label: "1–5 trucks (Small Fleet / Owner-Op)" },
  { value: "6-20", label: "6–20 trucks (Growing Fleet)" },
  { value: "21-50", label: "21–50 trucks (Mid-Size Carrier)" },
  { value: "51-100", label: "51–100 trucks (Commercial Fleet)" },
  { value: "100+", label: "100+ trucks (Enterprise Fleet)" },
]

const TEAM_SIZES = [
  { value: "just-me", label: "Just me (Owner-Operator)" },
  { value: "2-5", label: "2–5 people (Lean Team)" },
  { value: "6-20", label: "6–20 people (Growing Office)" },
  { value: "21-50", label: "21–50 people (Multi-Department)" },
  { value: "50+", label: "50+ people (Enterprise)" },
]

const SCOPES = [
  { value: "local", label: "Local (Metro / Single Region)" },
  { value: "regional", label: "Regional (Multi-State Corridors)" },
  { value: "national", label: "National (Coast-to-Coast 48 States)" },
  { value: "international", label: "Cross-Border (US, Canada, Mexico)" },
]

const TOOLS = [
  { value: "spreadsheet", label: "Spreadsheets (Excel / Google Sheets)" },
  { value: "another-tms", label: "Another TMS (Migrating to Muvx)" },
  { value: "multiple-tools", label: "Patchwork of disjointed tools" },
  { value: "manual", label: "Manual (Phone / SMS / Paper dispatching)" },
]

const FREIGHT_TYPES = [
  { id: "dry-van", label: "Dry Van (53')", desc: "General enclosed freight" },
  { id: "reefer", label: "Refrigerated (Reefer)", desc: "Temperature-controlled" },
  { id: "flatbed", label: "Flatbed & Stepdeck", desc: "Open deck & machinery" },
  { id: "ltl", label: "LTL Consolidated", desc: "Less-than-truckload partials" },
  { id: "specialized", label: "Specialized / Heavy Haul", desc: "Overweight & oversize" },
  { id: "intermodal", label: "Intermodal & Drayage", desc: "Port & rail containers" },
]

const STRATEGIC_GOALS = [
  "Dispatch faster",
  "Track loads in real time",
  "Keep documents together",
  "Invoice and get paid quicker",
  "Cut down manual paperwork",
  "Manage drivers and equipment",
  "Reduce empty miles",
  "Improve on-time delivery",
]

const DYNAMIC_CURRENCIES = getAllCurrencies()
const DYNAMIC_TIMEZONES = getAvailableTimezones()
const DYNAMIC_COUNTRIES = getAllCountries()

const FISCAL_YEAR_STARTS = [
  { value: "01-01", label: "January 1 (Standard calendar year)" },
  { value: "04-01", label: "April 1 (Q2 fiscal start)" },
  { value: "07-01", label: "July 1 (Q3 fiscal start)" },
  { value: "10-01", label: "October 1 (Federal fiscal start)" },
]

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
  supportEmail: string | null
  website: string | null
  addressLine1: string | null
  addressLine2: string | null
  city: string | null
  state: string | null
  postalCode: string | null
  country: string | null
  defaultCurrency: string
  timeZone: string
  fiscalYearStart: string
  fleetSize: string | null
  teamSize: string | null
  geographicScope: string | null
  currentTool: string | null
  freightTypes: string[]
  primaryGoals: string[]
  onboardingCompletedAt?: string | null
}

export function WorkspaceSettingsClient() {
  const router = useRouter()
  const queryClient = useQueryClient()
  const activeOrg = useAuthStore((s) => s.activeOrganization)
  const setActiveOrganization = useAuthStore((s) => s.setActiveOrganization)

  // ─── Auth + permission check ─────────────────────────────────────
  const [ready, setReady] = useState(false)
  const [canEdit, setCanEdit] = useState(false)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const { data } = await authClient.getSession()
      if (cancelled) return
      if (!data?.user) {
        router.replace("/login")
        return
      }
      const { data: perm } = await authClient.organization.hasPermission({
        permissions: { workspace: ["update"] },
      })
      if (cancelled) return
      setCanEdit(!!perm?.success)
      setReady(true)
    })()
    return () => {
      cancelled = true
    }
  }, [router])

  // ─── Profile fetch ───────────────────────────────────────────────
  const profileQuery = useQuery({
    queryKey: ["workspace-profile", activeOrg?.id],
    queryFn: async () => {
      const r = await fetch("/api/settings/workspace-profile", {
        credentials: "include",
      })
      if (!r.ok) throw new Error(`HTTP ${r.status}`)
      const j = (await r.json()) as { profile: Profile }
      return j.profile
    },
    enabled: !!activeOrg?.id,
    staleTime: 30_000,
  })

  // ─── Local form state ────────────────────────────────────────────
  const [form, setForm] = useState<Partial<Profile>>({})
  const [logoPreviewUrl, setLogoPreviewUrl] = useState<string | null>(null)
  const [logoPreviewOrganizationId, setLogoPreviewOrganizationId] = useState<
    string | null
  >(null)

  useEffect(() => {
    return () => {
      if (logoPreviewUrl) URL.revokeObjectURL(logoPreviewUrl)
    }
  }, [logoPreviewUrl])

  useEffect(() => {
    if (profileQuery.data) {
      const d = profileQuery.data
      setForm({
        name: d.name,
        slug: d.slug,
        logo: d.logo ?? null,
        businessType: d.businessType,
        dotNumber: d.dotNumber,
        mcNumber: d.mcNumber,
        ein: d.ein,
        phone: d.phone,
        supportEmail: d.supportEmail,
        website: d.website,
        addressLine1: d.addressLine1,
        addressLine2: d.addressLine2,
        city: d.city,
        state: d.state,
        postalCode: d.postalCode,
        country: d.country ?? "US",
        defaultCurrency: d.defaultCurrency || "USD",
        timeZone: d.timeZone || "America/Chicago",
        fiscalYearStart: d.fiscalYearStart || "01-01",
        fleetSize: d.fleetSize,
        teamSize: d.teamSize,
        geographicScope: d.geographicScope,
        currentTool: d.currentTool,
        freightTypes: d.freightTypes || [],
        primaryGoals: d.primaryGoals || [],
      })
    }
  }, [profileQuery.data])

  // ─── Slug availability check ─────────────────────────────────────
  const slugClean = (form.slug ?? "").trim().toLowerCase()
  const slugFormatValid = /^[a-z0-9-]{2,50}$/.test(slugClean)
  const slugChanged =
    !!profileQuery.data && slugClean !== (profileQuery.data.slug ?? "")

  const slugQuery = useQuery({
    queryKey: ["check-slug", slugClean, activeOrg?.id],
    queryFn: async () => {
      const { data, error } = await authClient.organization.checkSlug({
        slug: slugClean,
      })
      if (error) throw new Error(error.code || "SLUG_CHECK_FAILED")
      return data
    },
    enabled: slugChanged && slugFormatValid && canEdit,
    staleTime: 10_000,
    retry: false,
  })

  const slugAvailable = slugChanged
    ? slugQuery.data
      ? (slugQuery.data as { status: boolean }).status === true
      : slugQuery.isError
        ? false
        : null
    : true

  // ─── Save mutation ───────────────────────────────────────────────
  const saveMutation = useMutation({
    mutationFn: async () => {
      return await updateWorkspaceProfileAction({
        logo: form.logo ?? null,
        name: form.name,
        slug: slugClean,
        businessType:
          (form.businessType as
            | "broker"
            | "carrier"
            | "shipper"
            | "3pl"
            | "other"
            | null) ?? null,
        dotNumber: form.dotNumber ?? null,
        mcNumber: form.mcNumber ?? null,
        ein: form.ein ?? null,
        phone: form.phone ?? null,
        supportEmail: form.supportEmail ?? null,
        website: form.website ?? null,
        addressLine1: form.addressLine1 ?? null,
        addressLine2: form.addressLine2 ?? null,
        city: form.city ?? null,
        state: form.state ?? null,
        postalCode: form.postalCode ?? null,
        country: form.country ?? "US",
        defaultCurrency: form.defaultCurrency ?? "USD",
        timeZone: form.timeZone ?? "America/Chicago",
        fiscalYearStart: form.fiscalYearStart ?? "01-01",
        fleetSize: form.fleetSize ?? null,
        teamSize: form.teamSize ?? null,
        geographicScope: form.geographicScope ?? null,
        currentTool: form.currentTool ?? null,
        freightTypes: form.freightTypes ?? [],
        primaryGoals: form.primaryGoals ?? [],
      } satisfies UpdateWorkspaceProfileInput)
    },
    onSuccess: (result) => {
      if (!result.ok) {
        if (result.error === "FORBIDDEN") {
          toast.error("You don't have permission to edit the workspace profile.")
        } else if (result.error === "VALIDATION_ERROR") {
          toast.error("Please fix the highlighted fields.")
        } else {
          toast.error(result.error)
        }
        return
      }
      toast.success("Workspace profile updated")
      setLogoPreviewUrl(null)
      setLogoPreviewOrganizationId(null)
      if (activeOrg && result.organization) {
        setActiveOrganization({
          ...activeOrg,
          name: result.organization.name,
          slug: result.organization.slug,
        })
      }
      queryClient.invalidateQueries({ queryKey: ["workspace-profile"] })
      router.refresh()
    },
    onError: (err) => {
      console.error("[WORKSPACE] save error:", err)
      toast.error("Failed to save workspace profile")
    },
  })

  // ─── Logo upload (S3 presigned PUT) ──────────────────────────────
  const [logoUploading, setLogoUploading] = useState(false)

  const uploadLogoMutation = useMutation({
    mutationFn: async (file: File) => {
      setLogoUploading(true)
      const presignRes = await fetch("/api/upload/logo", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contentType: file.type,
          contentLength: file.size,
        }),
      })
      if (!presignRes.ok) {
        const err = await presignRes.json().catch(() => ({}))
        throw new Error(err.message || err.error || `Upload failed (${presignRes.status})`)
      }
      const { uploadUrl, key } = await presignRes.json()
      if (typeof key !== "string") {
        throw new Error("Upload response did not include a workspace logo key.")
      }

      const putRes = await fetch(uploadUrl, {
        method: "PUT",
        body: file,
        headers: { "Content-Type": file.type },
      })
      if (!putRes.ok) throw new Error(`S3 upload failed (${putRes.status})`)

      return { key, previewUrl: URL.createObjectURL(file) }
    },
    onSuccess: ({ key, previewUrl }) => {
      setForm((s) => ({ ...s, logo: key }))
      setLogoPreviewUrl(previewUrl)
      setLogoPreviewOrganizationId(activeOrg?.id ?? null)
      toast.success("Logo uploaded. Remember to save changes.")
    },
    onError: (err: Error) => {
      toast.error(err.message)
    },
    onSettled: () => {
      setLogoUploading(false)
    },
  })

  if (!ready || profileQuery.isLoading) {
    return (
      <div className="p-4 lg:p-8 space-y-6 max-w-3xl mx-auto">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  if (profileQuery.isError) {
    return (
      <div className="p-8 max-w-2xl mx-auto">
        <Card className="border-brand-rule bg-brand-card p-6 flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-brand-accent mt-0.5" />
          <div>
            <p className="font-medium text-brand-ink">Failed to load workspace profile</p>
            <p className="text-sm text-brand-muted-soft mt-1">
              {(profileQuery.error as Error)?.message}
            </p>
          </div>
        </Card>
      </div>
    )
  }

  const profile = profileQuery.data!
  const update = (k: keyof Profile, v: any) =>
    setForm((s) => ({ ...s, [k]: v }))

  const toggleFreight = (id: string) => {
    const curr = form.freightTypes || []
    const next = curr.includes(id) ? curr.filter((x) => x !== id) : [...curr, id]
    update("freightTypes", next)
  }

  const toggleGoal = (goal: string) => {
    const curr = form.primaryGoals || []
    const next = curr.includes(goal)
      ? curr.filter((x) => x !== goal)
      : [...curr, goal]
    update("primaryGoals", next)
  }

  const dirty =
    JSON.stringify({
      ...form,
      slug: slugClean,
    }) !==
    JSON.stringify({
      name: profile.name,
      slug: profile.slug,
      logo: profile.logo,
      businessType: profile.businessType,
      dotNumber: profile.dotNumber,
      mcNumber: profile.mcNumber,
      ein: profile.ein,
      phone: profile.phone,
      supportEmail: profile.supportEmail,
      website: profile.website,
      addressLine1: profile.addressLine1,
      addressLine2: profile.addressLine2,
      city: profile.city,
      state: profile.state,
      postalCode: profile.postalCode,
      country: profile.country,
      defaultCurrency: profile.defaultCurrency,
      timeZone: profile.timeZone,
      fiscalYearStart: profile.fiscalYearStart,
      fleetSize: profile.fleetSize,
      teamSize: profile.teamSize,
      geographicScope: profile.geographicScope,
      currentTool: profile.currentTool,
      freightTypes: profile.freightTypes || [],
      primaryGoals: profile.primaryGoals || [],
    })

  const slugOk = !slugChanged || (slugFormatValid && slugAvailable === true)
  const canSave = dirty && canEdit && slugOk && !saveMutation.isPending

  const handleReset = () => {
    if (profileQuery.data) {
      const d = profileQuery.data
      setForm({
        name: d.name,
        slug: d.slug,
        logo: d.logo ?? null,
        businessType: d.businessType,
        dotNumber: d.dotNumber,
        mcNumber: d.mcNumber,
        ein: d.ein,
        phone: d.phone,
        supportEmail: d.supportEmail,
        website: d.website,
        addressLine1: d.addressLine1,
        addressLine2: d.addressLine2,
        city: d.city,
        state: d.state,
        postalCode: d.postalCode,
        country: d.country ?? "US",
        defaultCurrency: d.defaultCurrency || "USD",
        timeZone: d.timeZone || "America/Chicago",
        fiscalYearStart: d.fiscalYearStart || "01-01",
        fleetSize: d.fleetSize,
        teamSize: d.teamSize,
        geographicScope: d.geographicScope,
        currentTool: d.currentTool,
        freightTypes: d.freightTypes || [],
        primaryGoals: d.primaryGoals || [],
      })
    }
  }

  return (
    <div className="p-4 lg:p-8 space-y-6 max-w-3xl mx-auto pb-16">
      {/* ── Header ── */}
      <div>
        <div className="flex items-center gap-3 mb-2">
          <div className="flex size-9 items-center justify-center rounded-lg bg-brand-accent-tint text-brand-accent">
            <Building2 className="h-4 w-4" strokeWidth={1.8} />
          </div>
          <h1 className="font-serif text-3xl tracking-tight text-brand-ink">
            <span className="italic text-brand-accent">Workspace</span> profile
          </h1>
        </div>
        <p className="text-sm text-brand-ink/80">
          Company details, regulatory identifiers, fleet capacity, and operational defaults.
          {canEdit ? (
            " Changes are visible to your team immediately and recorded in the audit log."
          ) : (
            <span className="inline-flex items-center gap-1.5 ml-1">
              <Lock className="h-3 w-3" />
              You have read-only access.
            </span>
          )}
        </p>
      </div>

      {/* ── 1. Identity ── */}
      <Card className="border-brand-rule bg-brand-card p-6 space-y-5">
        <div>
          <h2 className="font-serif text-xl text-brand-ink">Identity</h2>
          <p className="text-xs text-brand-muted-soft mt-1">
            How your workspace appears to your team, drivers, and on invoices.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="org-name">Workspace name</Label>
            <Input
              id="org-name"
              value={form.name ?? ""}
              onChange={(e) => update("name", e.target.value)}
              placeholder="Acme Logistics LLC"
              disabled={!canEdit}
              className="h-10"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="org-slug">Workspace URL</Label>
            <div className="flex items-center rounded-lg border border-brand-rule bg-white overflow-hidden focus-within:ring-2 focus-within:ring-brand-accent/20 focus-within:border-brand-accent">
              <span className="px-3 text-xs text-brand-muted-soft font-mono tracking-tight bg-brand-cream border-r border-brand-rule h-10 flex items-center shrink-0">
                muvx.com/
              </span>
              <input
                id="org-slug"
                value={form.slug ?? ""}
                onChange={(e) => {
                  update(
                    "slug",
                    e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "")
                  )
                }}
                placeholder="acme-logistics"
                disabled={!canEdit}
                className="flex-1 h-10 px-3 text-sm bg-transparent outline-none placeholder:text-brand-muted-soft/60 disabled:opacity-60"
              />
            </div>
            <div className="min-h-[20px] text-xs">
              {canEdit && slugChanged && !slugFormatValid && (form.slug ?? "").length > 0 && (
                <p className="text-brand-accent">
                  Use lowercase letters, numbers, and hyphens only.
                </p>
              )}
              {canEdit && slugChanged && slugFormatValid && slugQuery.isFetching && (
                <p className="text-brand-muted-soft">Checking availability…</p>
              )}
              {canEdit && slugChanged && slugFormatValid && slugAvailable === true && (
                <p className="text-emerald-700 flex items-center gap-1">
                  <Check className="h-3 w-3" /> This URL is available.
                </p>
              )}
              {canEdit && slugChanged && (slugAvailable === false || slugQuery.isError) && (
                <p className="text-brand-accent">✗ This URL is already taken.</p>
              )}
            </div>
          </div>
        </div>

        <Separator className="bg-brand-rule" />

        {/* Logo */}
        <div className="space-y-3">
          <Label>Workspace logo</Label>
          <div className="flex items-start gap-6">
            {form.logo ? (
              <Avatar className="size-20 border border-brand-rule">
                <AvatarImage
                  src={
                    (logoPreviewOrganizationId === activeOrg?.id
                      ? logoPreviewUrl
                      : null) ??
                    getWorkspaceLogoImageSource(
                      form.logo,
                      activeOrg?.id ?? profileQuery.data?.id,
                    )
                  }
                  alt={form.name ?? "Workspace logo"}
                  className="object-cover"
                />
                <AvatarFallback className="bg-brand-cream text-brand-muted-soft">
                  <Building2 className="h-7 w-7" />
                </AvatarFallback>
              </Avatar>
            ) : (
              <div className="size-20 rounded-xl border-2 border-dashed border-brand-rule bg-brand-cream flex items-center justify-center">
                <Building2 className="h-7 w-7 text-brand-muted-soft" />
              </div>
            )}

            <div className="space-y-2">
              <div className="flex items-center gap-2">
                {canEdit && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => document.getElementById("logo-upload")?.click()}
                    disabled={logoUploading}
                    className="h-8 border-brand-rule"
                  >
                    {logoUploading ? (
                      <>
                        <Loader2 className="h-3 w-3 mr-1 animate-spin" /> Uploading…
                      </>
                    ) : (
                      <>
                        <Upload className="h-3 w-3 mr-1" />
                        {form.logo ? "Change" : "Upload"}
                      </>
                    )}
                  </Button>
                )}
                {form.logo && canEdit && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      update("logo", null)
                      toast.info("Logo will be removed on save.")
                    }}
                    className="h-8 text-brand-muted-soft hover:text-destructive"
                  >
                    <X className="h-3 w-3 mr-1" /> Remove
                  </Button>
                )}
              </div>
              <input
                id="logo-upload"
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={async (e) => {
                  const file = e.target.files?.[0]
                  if (!file) return
                  if (!canEdit) {
                    toast.error("You don't have permission to upload a logo.")
                    return
                  }
                  await uploadLogoMutation.mutateAsync(file)
                  e.target.value = ""
                }}
                className="hidden"
              />
              <p className="text-xs text-brand-muted-soft">
                PNG, JPG, or WebP. Max 4 MB. Displayed on invoices and navigation.
              </p>
            </div>
          </div>
        </div>

        <Separator className="bg-brand-rule" />

        {/* Business Structure & Contact */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="businessType">Business model</Label>
            <Select
              value={form.businessType ?? "carrier"}
              onValueChange={(v) => update("businessType", v || null)}
              disabled={!canEdit}
            >
              <SelectTrigger id="businessType" className="h-10">
                <SelectValue placeholder="Select business model…" />
              </SelectTrigger>
              <SelectContent>
                {BUSINESS_TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="phone">Dispatch phone</Label>
            <Input
              id="phone"
              value={form.phone ?? ""}
              onChange={(e) => update("phone", e.target.value || null)}
              placeholder="+1 555 123 4567"
              disabled={!canEdit}
              className="h-10 font-mono text-sm"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="supportEmail">Rate con & billing email</Label>
            <Input
              id="supportEmail"
              type="email"
              value={form.supportEmail ?? ""}
              onChange={(e) => update("supportEmail", e.target.value || null)}
              placeholder="dispatch@company.com"
              disabled={!canEdit}
              className="h-10 font-mono text-sm"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="website">Website</Label>
          <Input
            id="website"
            value={form.website ?? ""}
            onChange={(e) => update("website", e.target.value || null)}
            placeholder="https://www.company.com"
            disabled={!canEdit}
            className="h-10 font-mono text-sm"
          />
        </div>

        <Separator className="bg-brand-rule" />

        {/* Regulatory Identifiers */}
        <div>
          <h3 className="text-sm font-semibold text-brand-ink mb-1">
            Regulatory credentials
          </h3>
          <p className="text-xs text-brand-muted-soft mb-3">
            Federal Motor Carrier Safety Administration (FMCSA) and IRS tax IDs.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="dotNumber">USDOT #</Label>
              <Input
                id="dotNumber"
                value={form.dotNumber ?? ""}
                onChange={(e) => update("dotNumber", e.target.value || null)}
                placeholder="1234567"
                maxLength={20}
                disabled={!canEdit}
                className="h-10 font-mono text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="mcNumber">MC / FF #</Label>
              <Input
                id="mcNumber"
                value={form.mcNumber ?? ""}
                onChange={(e) => update("mcNumber", e.target.value || null)}
                placeholder="MC-123456"
                maxLength={20}
                disabled={!canEdit}
                className="h-10 font-mono text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ein">Federal Tax ID (EIN)</Label>
              <Input
                id="ein"
                value={form.ein ?? ""}
                onChange={(e) => update("ein", e.target.value || null)}
                placeholder="12-3456789"
                maxLength={20}
                disabled={!canEdit}
                className="h-10 font-mono text-sm"
              />
            </div>
          </div>
        </div>
      </Card>

      {/* ── 2. Fleet & Operations (Onboarding Profile) ── */}
      <Card className="border-brand-rule bg-brand-card p-6 space-y-5">
        <div>
          <h2 className="font-serif text-xl text-brand-ink">Fleet & operations</h2>
          <p className="text-xs text-brand-muted-soft mt-1">
            Operational profile calibrated during onboarding. Powers load matching and dispatch automation.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="fleetSize">Fleet scale (Power units)</Label>
            <Select
              value={form.fleetSize ?? "6-20"}
              onValueChange={(v) => update("fleetSize", v)}
              disabled={!canEdit}
            >
              <SelectTrigger id="fleetSize" className="h-10">
                <SelectValue placeholder="Select fleet scale…" />
              </SelectTrigger>
              <SelectContent>
                {FLEET_SIZES.map((f) => (
                  <SelectItem key={f.value} value={f.value}>
                    {f.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="geographicScope">Operating corridor scope</Label>
            <Select
              value={form.geographicScope ?? "national"}
              onValueChange={(v) => update("geographicScope", v)}
              disabled={!canEdit}
            >
              <SelectTrigger id="geographicScope" className="h-10">
                <SelectValue placeholder="Select corridor scope…" />
              </SelectTrigger>
              <SelectContent>
                {SCOPES.map((s) => (
                  <SelectItem key={s.value} value={s.value}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="teamSize">Team headcount</Label>
            <Select
              value={form.teamSize ?? "2-5"}
              onValueChange={(v) => update("teamSize", v)}
              disabled={!canEdit}
            >
              <SelectTrigger id="teamSize" className="h-10">
                <SelectValue placeholder="Select team size…" />
              </SelectTrigger>
              <SelectContent>
                {TEAM_SIZES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="currentTool">Migration origin tool</Label>
            <Select
              value={form.currentTool ?? "spreadsheet"}
              onValueChange={(v) => update("currentTool", v)}
              disabled={!canEdit}
            >
              <SelectTrigger id="currentTool" className="h-10">
                <SelectValue placeholder="Select prior tool…" />
              </SelectTrigger>
              <SelectContent>
                {TOOLS.map((tool) => (
                  <SelectItem key={tool.value} value={tool.value}>
                    {tool.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <Separator className="bg-brand-rule" />

        {/* Equipment & Trailer Capabilities */}
        <div className="space-y-2.5">
          <div>
            <Label className="text-sm font-semibold text-brand-ink">
              Trailer & equipment capabilities
            </Label>
            <p className="text-xs text-brand-muted-soft mt-0.5">
              Select all equipment types your fleet operates. Informs automated load matching.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5 pt-1">
            {FREIGHT_TYPES.map((ft) => {
              const isSelected = (form.freightTypes || []).includes(ft.id)
              return (
                <button
                  key={ft.id}
                  type="button"
                  onClick={() => canEdit && toggleFreight(ft.id)}
                  disabled={!canEdit}
                  className={cn(
                    "p-3 rounded-lg border text-left transition-colors flex flex-col justify-between",
                    isSelected
                      ? "bg-brand-accent-tint border-brand-accent/40 text-brand-ink"
                      : "bg-white border-brand-rule hover:bg-brand-cream/50 text-brand-ink/80"
                  )}
                >
                  <div className="flex items-center justify-between w-full">
                    <span className="text-xs font-semibold">{ft.label}</span>
                    {isSelected && <Check className="h-3.5 w-3.5 text-brand-accent" />}
                  </div>
                  <span className="text-[11px] text-brand-muted-soft mt-1">
                    {ft.desc}
                  </span>
                </button>
              )
            })}
          </div>
        </div>

        <Separator className="bg-brand-rule" />

        {/* Strategic Priorities */}
        <div className="space-y-2.5">
          <div>
            <Label className="text-sm font-semibold text-brand-ink">
              Strategic priorities
            </Label>
            <p className="text-xs text-brand-muted-soft mt-0.5">
              Focus areas configured during setup for automation triggers and alerts.
            </p>
          </div>

          <div className="flex flex-wrap gap-2 pt-1">
            {STRATEGIC_GOALS.map((goal) => {
              const isSelected = (form.primaryGoals || []).includes(goal)
              return (
                <button
                  key={goal}
                  type="button"
                  onClick={() => canEdit && toggleGoal(goal)}
                  disabled={!canEdit}
                  className={cn(
                    "px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors flex items-center gap-1.5",
                    isSelected
                      ? "bg-brand-ink text-brand-cream border-brand-ink"
                      : "bg-white border-brand-rule text-brand-ink/80 hover:bg-brand-cream/60"
                  )}
                >
                  {isSelected && <Check className="h-3 w-3" />}
                  {goal}
                </button>
              )
            })}
          </div>
        </div>
      </Card>

      {/* ── 3. Address ── */}
      <Card className="border-brand-rule bg-brand-card p-6 space-y-5">
        <div>
          <h2 className="font-serif text-xl text-brand-ink">Address</h2>
          <p className="text-xs text-brand-muted-soft mt-1">
            Official terminal or headquarters address for invoices and regulatory correspondence.
          </p>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="addressLine1">Address line 1</Label>
          <Input
            id="addressLine1"
            value={form.addressLine1 ?? ""}
            onChange={(e) => update("addressLine1", e.target.value || null)}
            placeholder="123 Main St"
            maxLength={200}
            disabled={!canEdit}
            className="h-10"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="addressLine2">Address line 2</Label>
          <Input
            id="addressLine2"
            value={form.addressLine2 ?? ""}
            onChange={(e) => update("addressLine2", e.target.value || null)}
            placeholder="Suite 200"
            maxLength={200}
            disabled={!canEdit}
            className="h-10"
          />
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="space-y-1.5 col-span-2 md:col-span-2">
            <Label htmlFor="city">City</Label>
            <Input
              id="city"
              value={form.city ?? ""}
              onChange={(e) => update("city", e.target.value || null)}
              placeholder="Chicago"
              maxLength={100}
              disabled={!canEdit}
              className="h-10"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="state">State / Province</Label>
            <Input
              id="state"
              value={form.state ?? ""}
              onChange={(e) => update("state", e.target.value || null)}
              placeholder="IL"
              maxLength={50}
              disabled={!canEdit}
              className="h-10"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="postalCode">Postal code</Label>
            <Input
              id="postalCode"
              value={form.postalCode ?? ""}
              onChange={(e) => update("postalCode", e.target.value || null)}
              placeholder="60601"
              maxLength={20}
              disabled={!canEdit}
              className="h-10 font-mono text-sm"
            />
          </div>
        </div>

        <div className="space-y-1.5 max-w-xs">
          <Label htmlFor="country">Country</Label>
          <Select
            value={form.country ?? "US"}
            onValueChange={(v) => update("country", v)}
            disabled={!canEdit}
          >
            <SelectTrigger id="country" className="h-10">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="max-h-72">
              {DYNAMIC_COUNTRIES.map((c) => (
                <SelectItem key={c.code} value={c.code}>
                  {c.code} — {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </Card>

      {/* ── 4. Operations / Regional Defaults ── */}
      <Card className="border-brand-rule bg-brand-card p-6 space-y-5">
        <div>
          <h2 className="font-serif text-xl text-brand-ink">Regional defaults</h2>
          <p className="text-xs text-brand-muted-soft mt-1">
            Standards used across invoices, settlements, and dispatch scheduling.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="defaultCurrency">Default currency</Label>
            <Select
              value={form.defaultCurrency ?? "USD"}
              onValueChange={(v) => update("defaultCurrency", v)}
              disabled={!canEdit}
            >
              <SelectTrigger id="defaultCurrency" className="h-10">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="max-h-72">
                {DYNAMIC_CURRENCIES.map((c) => (
                  <SelectItem key={c.code} value={c.code}>
                    {c.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="timeZone">Time zone</Label>
            <Select
              value={form.timeZone ?? "America/Chicago"}
              onValueChange={(v) => update("timeZone", v)}
              disabled={!canEdit}
            >
              <SelectTrigger id="timeZone" className="h-10">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="max-h-72">
                {DYNAMIC_TIMEZONES.map((tz) => (
                  <SelectItem key={tz.id} value={tz.id}>
                    {tz.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="fiscalYearStart">Fiscal year start</Label>
            <Select
              value={form.fiscalYearStart ?? "01-01"}
              onValueChange={(v) => update("fiscalYearStart", v)}
              disabled={!canEdit}
            >
              <SelectTrigger id="fiscalYearStart" className="h-10">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FISCAL_YEAR_STARTS.map((f) => (
                  <SelectItem key={f.value} value={f.value}>
                    {f.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </Card>

      {/* ── 5. Save Row ── */}
      <div className="flex items-center justify-between pt-2">
        <div className="text-xs text-brand-muted-soft">
          {canEdit ? (
            <>
              <Badge
                variant="outline"
                className="border-brand-rule text-brand-muted-soft mr-2"
              >
                audit logged
              </Badge>
              All changes are recorded in the workspace audit log.
            </>
          ) : (
            <>Read-only — only owners and admins can edit the profile.</>
          )}
        </div>

        <div className="flex items-center gap-3">
          {dirty && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleReset}
              disabled={saveMutation.isPending}
              className="h-10 text-xs border-brand-rule text-brand-muted-soft hover:text-brand-ink"
            >
              Reset
            </Button>
          )}

          <Button
            onClick={() => saveMutation.mutate()}
            disabled={!canSave}
            className="bg-brand-ink hover:bg-brand-ink-soft text-brand-cream h-10 px-5 text-sm"
          >
            {saveMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Saving…
              </>
            ) : (
              "Save changes"
            )}
          </Button>
        </div>
      </div>
    </div>
  )
}

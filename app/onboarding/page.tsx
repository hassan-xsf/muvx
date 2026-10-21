"use client"

import { useState, useEffect, useRef, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { useMutation, useQuery } from "@tanstack/react-query"
import { authClient } from "@/lib/auth-client"
import { useAuthStore } from "@/lib/stores/auth-store"
import {
  useOnboardingStore,
  GOALS,
  type BusinessType,
  type FleetSize,
  type TeamSize,
  type GeographicScope,
  type CurrentTool,
  type FreightType,
  type TeamRole,
  type TeamInvite,
  type Goal,
} from "@/lib/stores/onboarding-store"
import { ROLE_CATALOG } from "@/lib/auth-roles"
import { MuvxLogo } from "@/components/brand/muvx-logo"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
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
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  Hash,
  Truck,
  Users,
  Sparkles,
  ShieldCheck,
  X,
  Plus,
  Mail,
  Trash2,
  Check,
} from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { OnboardingSkeleton } from "@/components/onboarding/onboarding-skeleton"
// Brand class strings are defined in app/globals.css under @layer components:
// .btn-primary · .btn-secondary · .input-base · .field-label · .field-error
// · .error-banner · .display-heading · .italic-accent · .eyebrow

// ─── Options ───
const RESERVED_SLUGS = [
  "admin", "api", "dashboard", "settings", "login", "signup",
  "onboarding", "select-org", "auth-redirect", "www", "app",
  "help", "support", "billing", "terms", "privacy", "about",
  "contact", "blog", "docs", "status", "public", "static",
]

const BUSINESS_OPTIONS: { value: BusinessType; label: string; blurb: string }[] = [
  { value: "carrier", label: "Carrier", blurb: "You run your own trucks and drivers." },
  { value: "broker", label: "Broker", blurb: "You arrange freight for other carriers." },
  { value: "both", label: "Both", blurb: "You operate trucks and broker loads." },
]

const FLEET_SIZE_OPTIONS: { value: FleetSize; label: string }[] = [
  { value: "1-5", label: "1–5 trucks" },
  { value: "6-20", label: "6–20 trucks" },
  { value: "21-50", label: "21–50 trucks" },
  { value: "51-100", label: "51–100 trucks" },
  { value: "100+", label: "100+ trucks" },
]

const TEAM_SIZE_OPTIONS: { value: TeamSize; label: string }[] = [
  { value: "just-me", label: "Just me" },
  { value: "2-5", label: "2–5 people" },
  { value: "6-20", label: "6–20 people" },
  { value: "21-50", label: "21–50 people" },
  { value: "50+", label: "50+ people" },
]

const SCOPE_OPTIONS: { value: GeographicScope; label: string }[] = [
  { value: "local", label: "Local — one city or region" },
  { value: "regional", label: "Regional — multi-state" },
  { value: "national", label: "National — coast to coast" },
  { value: "international", label: "International — cross-border" },
]

const TOOL_OPTIONS: { value: CurrentTool; label: string }[] = [
  { value: "spreadsheet", label: "Spreadsheets" },
  { value: "another-tms", label: "Another TMS" },
  { value: "multiple-tools", label: "A patchwork of tools" },
  { value: "manual", label: "Mostly manual (paper, calls, texts)" },
]

const FREIGHT_OPTIONS: { value: FreightType; label: string }[] = [
  { value: "dry-van", label: "Dry van" },
  { value: "reefer", label: "Reefer" },
  { value: "flatbed", label: "Flatbed" },
  { value: "ltl", label: "LTL" },
  { value: "specialized", label: "Specialized" },
  { value: "intermodal", label: "Intermodal" },
]

// ─── Role list for invites — SINGLE SOURCE OF TRUTH ──────────────────
// Derived from ROLE_CATALOG in lib/auth-roles.ts. `owner` is excluded —
// the first invitee becomes owner implicitly via org creation; additional
// owners are set only through transfer-ownership. `member` is now
// included (was missing from the old hardcoded list; GAP-2).
const TEAM_ROLES: { value: TeamRole; label: string; description: string }[] =
  ROLE_CATALOG.filter((r) => r.id !== "owner").map((r) => ({
    value: r.id as TeamRole,
    label: r.label,
    description: r.description,
  }))

const STEPS = [
  { stop: "STOP 01", subtitle: "WHAT YOU RUN", title: ["Tell us about", "your company."] },
  { stop: "STOP 02", subtitle: "WE'LL TAILOR THE REST", title: ["What do you", "operate?"] },
  { stop: "STOP 03", subtitle: "ONLY WHAT MATTERS TO YOU", title: ["A little more about", "your operation."] },
  { stop: "STOP 04", subtitle: "SO WE CAN HELP YOU SWITCH", title: ["How do you run", "freight today?"] },
  { stop: "STOP 05", subtitle: "GET YOUR TEAM IN", title: ["Invite your", "teammates."] },
  { stop: "STOP 06", subtitle: "WE'LL PRIORITISE THIS", title: ["What should Muvx fix", "first for you?"] },
]

function OnboardingContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const isCreatingAdditionalWorkspace = searchParams.get("create") === "1"
  const setActiveOrganization = useAuthStore((s) => s.setActiveOrganization)

  const {
    draft, currentStep, completedSteps, highestReached,
    setField, toggleFreightType, toggleGoal,
    addTeamInvite, updateTeamInvite, removeTeamInvite,
    nextStep, prevStep, goToStep, reset, isStepValid, asksFleetSize,
  } = useOnboardingStore()

  const [error, setError] = useState("")
  const [done, setDone] = useState(false)
  const [checkingExistingOrg, setCheckingExistingOrg] = useState(true)

  // ─── Check existing org ───
  useEffect(() => {
    const check = async () => {
      console.log("[ONBOARDING] Checking existing orgs...")
      try {
        if (isCreatingAdditionalWorkspace) {
          console.log("[ONBOARDING] creating an additional workspace")
          return
        }
        // Invite recipients may have a user account but no membership yet.
        // Resolve the pending invite before showing workspace creation.
        const routingRes = await fetch("/api/me/routing", { cache: "no-store" })
        if (routingRes.ok) {
          const routing = (await routingRes.json()) as { destination?: string }
          if (routing.destination?.startsWith("/invite/")) {
            console.log("[ONBOARDING] pending invite →", routing.destination)
            router.replace(routing.destination)
            return
          }
        }
        const { data: orgs } = await authClient.organization.list()
        // [ONBOARDING] organization.list() returns a bare array, not { organizations }
        const list = orgs ?? []

        if (list.length > 0) {
          // Membership means the account already belongs to a workspace.
          // The workspace owner's onboarding metadata must never decide
          // whether an invited teammate gets asked to create another one.
          const existing = list[0] as any
          console.log("[ONBOARDING] existing workspace membership → dashboard")
          await authClient.organization.setActive({ organizationId: existing.id })
          router.replace("/dashboard")
          return
        }
      } catch (err) {
        console.error("[ONBOARDING] check existing failed:", err)
      } finally {
        setCheckingExistingOrg(false)
      }
    }
    check()
  }, [isCreatingAdditionalWorkspace, router, setField])

  // ─── Slug check ───
  // Better Auth `POST /organization/check-slug` returns { status: true } when
  // the slug is AVAILABLE; it throws ORGANIZATION_SLUG_ALREADY_TAKEN when
  // the slug is taken (verified in node_modules/better-auth/.../crud-org.mjs).
  const slugIsReserved = RESERVED_SLUGS.includes(draft.slug)
  const slugIsValid = draft.slug.length >= 2 && /^[a-z0-9-]+$/.test(draft.slug) && !slugIsReserved

  const {
    data: slugCheck,
    isFetching: checkingSlug,
    isError: slugCheckFailed,
    error: slugCheckError,
  } = useQuery({
    queryKey: ["check-slug", draft.slug],
    queryFn: async () => {
      console.log("[ONBOARDING] checkSlug →", draft.slug)
      const r = await authClient.organization.checkSlug({ slug: draft.slug })
      console.log("[ONBOARDING] checkSlug response:", JSON.stringify(r))
      if (r.error) {
        // Surface as a thrown error so React Query marks the query failed
        // AND we keep the error.code for the UI to inspect.
        throw new Error(r.error.code || r.error.message || "SLUG_CHECK_FAILED")
      }
      return r.data
    },
    enabled: slugIsValid,
    staleTime: 5 * 1000,
    retry: false,
  })
  // `status: true` => available. `status: false` (or query error) => not available.
  const slugAvailable = slugIsValid
    ? slugCheck
      ? slugCheck.status === true
      : slugCheckFailed
        ? false
        : null
    : null
  const slugTaken = slugCheckFailed || slugCheck?.status === false

  // ─── Auto-generate slug from company name ───
  // Only run on step 0 while user hasn't manually edited the slug. The setField
  // call below updates the store synchronously, which would re-trigger this
  // effect and cause an infinite loop — guard against that with a ref.
  const [slugManuallyEdited, setSlugManuallyEdited] = useState(false)
  const lastGeneratedFor = useRef<string>("")
  useEffect(() => {
    if (slugManuallyEdited || currentStep !== 0) return
    const name = draft.companyName.trim()
    if (!name) return
    if (lastGeneratedFor.current === name) return
    const gen = name
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .substring(0, 50)
    lastGeneratedFor.current = name
    if (gen && gen !== draft.slug) {
      console.log("[ONBOARDING] auto-generating slug:", gen)
      setField("slug", gen)
    }
  }, [draft.companyName, slugManuallyEdited, currentStep, setField, draft.slug])

  // ─── Final mutation: create org + invite team ───
  const submitMutation = useMutation({
    mutationFn: async () => {
      console.log("[ONBOARDING] Finalizing setup...")

      // Metadata must be an object (record<string, any>), not a JSON string
      const metadata = {
        dotNumber: draft.dotNumber.trim() || null,
        mcNumber: draft.mcNumber.trim() || null,
        businessType: draft.businessType || null,
        fleetSize: draft.fleetSize || null,
        teamSize: draft.teamSize || null,
        geographicScope: draft.geographicScope || null,
        currentTool: draft.currentTool || null,
        freightTypes: draft.freightTypes,
        primaryGoals: draft.primaryGoals,
        onboardingCompleted: true,
        onboardingCompletedAt: new Date().toISOString(),
      }

      const result = await authClient.organization.create({
        name: draft.companyName.trim(),
        slug: draft.slug.trim(),
        metadata, // Pass as object, not JSON string
      })

      if (result.error) {
        console.error("[ONBOARDING] create org error:", result.error)
        switch (result.error.code) {
          case "ORGANIZATION_ALREADY_EXISTS":
          case "ORGANIZATION_SLUG_ALREADY_TAKEN":
            throw new Error("This URL is already taken. Please go back and choose another.")
          case "YOU_HAVE_REACHED_THE_MAXIMUM_NUMBER_OF_ORGANIZATIONS":
            throw new Error("You've reached the maximum number of workspaces. Please contact support.")
          case "YOU_ARE_NOT_ALLOWED_TO_CREATE_A_NEW_ORGANIZATION":
            throw new Error("You're not allowed to create a new workspace. Contact your administrator.")
          case "SLUG_INVALID":
          case "INVALID_SLUG":
            throw new Error("That URL isn't valid. Use lowercase letters, numbers, and hyphens only.")
          case "USER_NOT_FOUND":
            throw new Error("Your session expired. Please sign in again.")
          default:
            throw new Error(result.error.message || "Failed to create organization")
        }
      }

      // [ONBOARDING] organization.create() returns the org object directly,
      // not wrapped in { organization }
      const createdOrg = result.data
      if (!createdOrg?.id) {
        throw new Error("Organization was created but no id was returned")
      }

      // Send team invitations
      const validInvites = draft.teamInvites.filter(
        (inv) => inv.email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(inv.email)
      )

      if (validInvites.length > 0) {
        console.log(`[ONBOARDING] Sending ${validInvites.length} invites...`)
        for (const invite of validInvites) {
          try {
            await authClient.organization.inviteMember({
              email: invite.email,
              role: invite.role,
              organizationId: createdOrg.id,
            })
            console.log(`[ONBOARDING] ✅ Invited ${invite.email} as ${invite.role}`)
          } catch (err) {
            console.error(`[ONBOARDING] Failed to invite ${invite.email}:`, err)
            // Don't fail the whole flow
          }
        }
      }

      return createdOrg
    },
    onSuccess: async (org) => {
      if (org?.id) {
        await authClient.organization.setActive({ organizationId: org.id })
        setActiveOrganization({
          id: org.id,
          name: org.name,
          slug: org.slug,
          logo: org.logo,
          metadata: org.metadata as Record<string, any> | null,
        })
        console.log("[ONBOARDING] ✅ Setup complete")
        setDone(true)
        toast.success("Welcome to Muvx!")
        reset()
        // Route by data role — platform admins go to /admin,
        // regular users to /dashboard.
        setTimeout(async () => {
          try {
            const r = await fetch("/api/me/routing", { cache: "no-store" })
            if (r.ok) {
              const d = (await r.json()) as { destination: string }
              console.log(`[ONBOARDING] → ${d.destination}`)
              router.push(d.destination)
              return
            }
          } catch (err) {
            console.warn("[ONBOARDING] routing fetch failed:", err)
          }
          router.push("/dashboard")
        }, 1500)
      }
    },
    onError: (err: Error) => {
      console.error("[ONBOARDING] Submit failed:", err)
      setError(err.message)
    },
  })

  // ─── Step navigation ───
  const handleNext = () => {
    setError("")
    if (currentStep === 0) {
      if (!draft.companyName.trim() || draft.companyName.trim().length < 2) {
        setError("Please enter your company name")
        return
      }
      if (!draft.slug || !slugIsValid) {
        setError("Please choose a valid company URL")
        return
      }
      if (slugIsReserved) {
        setError("This URL is reserved. Please choose another.")
        return
      }
      if (slugTaken || slugAvailable === false) {
        setError("This URL is already taken. Please choose another.")
        return
      }
      // If a check is still pending, force the user to wait — guards against
      // racing the create-org call before we've confirmed availability.
      if (slugIsValid && checkingSlug) {
        setError("Checking URL availability, please wait a moment.")
        return
      }
    }
    if (currentStep === 2) {
      if (asksFleetSize() && !draft.fleetSize) {
        setError("Please select your fleet size")
        return
      }
    }
    if (currentStep === 4) {
      // Validate team invite emails
      for (const inv of draft.teamInvites) {
        if (inv.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(inv.email)) {
          setError(`Invalid email: ${inv.email}`)
          return
        }
      }
    }
    nextStep()
  }

  const handleSubmit = () => {
    setError("")
    if (draft.primaryGoals.length === 0) {
      setError("Please pick at least one goal")
      return
    }
    submitMutation.mutate()
  }

  // ─── Loading state ───
  if (checkingExistingOrg) {
    return <OnboardingSkeleton />
  }

  if (done) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4" style={{ background: "#f7f3ec" }}>
        <div className="w-full max-w-md text-center">
          <div
            className="mx-auto w-16 h-16 rounded-full flex items-center justify-center mb-6"
            style={{ background: "rgba(94,140,106,0.1)" }}
          >
            <CheckCircle2 className="h-8 w-8" style={{ color: "#5e8c6a" }} />
          </div>
          <h1 className="font-serif text-4xl tracking-tight" style={{ color: "#16181d" }}>
            You&apos;re all set
          </h1>
          <p className="mt-3 font-geist" style={{ color: "#4a4e57" }}>
            Your workspace is ready. Taking you to your dashboard...
          </p>
        </div>
      </div>
    )
  }

  const totalSteps = STEPS.length
  const stepInfo = STEPS[currentStep]
  const showFleetSize = currentStep === 2 && asksFleetSize()

  return (
    <div className="relative min-h-screen w-full overflow-hidden" style={{ background: "#f7f3ec" }}>
      {/* Background contour lines */}
      <div className="pointer-events-none absolute inset-0" aria-hidden="true">
        <svg viewBox="0 0 1600 900" className="absolute inset-0 h-full w-full opacity-40" preserveAspectRatio="none">
          <path d="M1010 105C1120 180 1200 105 1310 160C1410 210 1510 135 1600 185" fill="none" stroke="#ead4c5" strokeWidth="1" />
          <path d="M0 710C180 665 320 742 490 700C640 663 760 730 900 684" fill="none" stroke="#ead4c5" strokeWidth="1" />
          <path d="M900 155C1030 235 1150 165 1250 220C1360 278 1490 220 1600 265" fill="none" stroke="#ead4c5" strokeWidth="1" />
        </svg>
      </div>

      <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-[920px] flex-col px-6 py-12 md:px-16">
        {/* Top bar */}
        <div className="flex items-center justify-between">
          <a href="/" className="flex items-center transition-opacity hover:opacity-90">
            <MuvxLogo variant="horizontal" className="h-8 w-auto" />
          </a>
          <span className="font-geist-mono text-[11px] uppercase tracking-[0.04em]" style={{ color: "#8a8b8f" }}>
            Setup · {currentStep + 1} of {totalSteps}
          </span>
        </div>

        {/* Progress bar — segmented rail with completed/current/future
            states. Each segment is also a step jumper for steps the user
            has already reached, so they can revise earlier answers without
            losing what they typed later. */}
        <div className="mt-8 flex gap-1.5">
          {STEPS.map((_, i) => (
            <button
              key={i}
              onClick={() => goToStep(i)}
              disabled={i > highestReached}
              className={cn(
                "h-[3px] flex-1 rounded-full transition-colors",
                i < currentStep ? "cursor-pointer" : "",
                i === currentStep
                  ? "bg-[#d9622b]"
                  : i < currentStep
                  ? "bg-[#d9622b]/60 hover:bg-[#d9622b]"
                  : "bg-[#e4ddd3]"
              )}
              aria-label={`Go to ${STEPS[i].stop}`}
            />
          ))}
        </div>

        {/* Main content */}
        <div className="mt-10 flex-1">
          {/* Eyebrow + headline */}
          <div className="mb-8">
            <div className="flex items-center gap-2.5">
              <span className="size-[7px] shrink-0 rounded-full bg-[#d9622b]" />
              <span className="font-geist-mono text-[11px] font-medium uppercase tracking-[0.04em]" style={{ color: "#16181d" }}>
                {stepInfo.stop}
              </span>
              <span className="font-geist-mono text-[11px] tracking-[0.04em]" style={{ color: "#8a8b8f" }}>
                · {stepInfo.subtitle}
              </span>
            </div>
            <h1 className={cn("display-heading", "mt-5")}>
              <span className="block">{stepInfo.title[0]}</span>
              <span className={cn("block", "italic-accent")}>
                {stepInfo.title[1]}
              </span>
            </h1>
          </div>

          {error && (
            <div className={cn("error-banner", "mb-6")} role="alert">
              {error}
            </div>
          )}

          {/* Step content */}
          <div className="space-y-6">
            {currentStep === 0 && (
              <StepCompany
                companyName={draft.companyName}
                slug={draft.slug}
                dotNumber={draft.dotNumber}
                mcNumber={draft.mcNumber}
                onCompanyNameChange={(v) => setField("companyName", v)}
                onSlugChange={(v) => {
                  setSlugManuallyEdited(true)
                  setField("slug", v.toLowerCase().replace(/[^a-z0-9-]/g, ""))
                }}
                onDotChange={(v) => setField("dotNumber", v.replace(/\D/g, ""))}
                onMcChange={(v) => setField("mcNumber", v.replace(/\D/g, ""))}
                slugIsValid={slugIsValid}
                slugIsReserved={slugIsReserved}
                slugAvailable={slugAvailable}
                checkingSlug={checkingSlug}
              />
            )}

            {currentStep === 1 && (
              <StepBusiness
                businessType={draft.businessType}
                onChange={(v) => setField("businessType", v)}
              />
            )}

            {currentStep === 2 && (
              <StepOperation
                fleetSize={draft.fleetSize}
                teamSize={draft.teamSize}
                geographicScope={draft.geographicScope}
                showFleetSize={showFleetSize}
                onFleetSizeChange={(v) => setField("fleetSize", v)}
                onTeamSizeChange={(v) => setField("teamSize", v)}
                onScopeChange={(v) => setField("geographicScope", v)}
              />
            )}

            {currentStep === 3 && (
              <StepCurrent
                currentTool={draft.currentTool}
                freightTypes={draft.freightTypes}
                onToolChange={(v) => setField("currentTool", v)}
                onToggleFreight={(t) => toggleFreightType(t)}
              />
            )}

            {currentStep === 4 && (
              <StepTeam
                invites={draft.teamInvites}
                onAdd={addTeamInvite}
                onUpdate={updateTeamInvite}
                onRemove={removeTeamInvite}
              />
            )}

            {currentStep === 5 && (
              <StepGoals
                selected={draft.primaryGoals}
                onToggle={(g) => toggleGoal(g)}
              />
            )}
          </div>
        </div>

        {/* Footer nav */}
        <div className="mt-12 flex items-center justify-between">
          <Button
            type="button"
            variant="ghost"
            onClick={prevStep}
            disabled={currentStep === 0 || submitMutation.isPending}
            className="font-geist text-sm text-[#4a4e57] hover:text-[#16181d] hover:bg-transparent"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>

          {currentStep < totalSteps - 1 ? (
            <Button
              type="button"
              onClick={handleNext}
              disabled={!isStepValid(currentStep) || checkingSlug}
              className="h-9 px-4 inline-flex items-center justify-center rounded-full bg-brand-ink hover:bg-brand-ink-soft text-brand-cream text-sm transition-colors"
            >
              Continue <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          ) : (
            <Button
              type="button"
              onClick={handleSubmit}
              disabled={!isStepValid(currentStep) || submitMutation.isPending}
              className="h-9 px-4 inline-flex items-center justify-center rounded-full bg-brand-ink hover:bg-brand-ink-soft text-brand-cream text-sm transition-colors"
            >
              {submitMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Setting up...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4 mr-2" />
                  Open my workspace
                </>
              )}
            </Button>
          )}
        </div>

        {/* Trust signals */}
        <div className="mt-10 flex items-center justify-center gap-4 font-geist-mono text-[10px] tracking-[0.04em]" style={{ color: "#8a8b8f" }}>
          <div className="flex items-center gap-1.5">
            <ShieldCheck className="h-3.5 w-3.5" />
            <span>SOC 2 TYPE II</span>
          </div>
          <span>·</span>
          <span>ENCRYPTED AT REST</span>
          <span>·</span>
          <span>MULTI-TENANT ISOLATED</span>
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Onboarding page — wraps the content in Suspense so that useSearchParams()
// in OnboardingContent can stream in after prerender instead of blocking it.
export default function OnboardingPage() {
  return (
    <Suspense fallback={<OnboardingSkeleton />}>
      <OnboardingContent />
    </Suspense>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// STEP 1: Company
// ─────────────────────────────────────────────────────────────────────────────
function StepCompany({
  companyName, slug, dotNumber, mcNumber,
  onCompanyNameChange, onSlugChange, onDotChange, onMcChange,
  slugIsValid, slugIsReserved, slugAvailable, checkingSlug,
}: {
  companyName: string
  slug: string
  dotNumber: string
  mcNumber: string
  onCompanyNameChange: (v: string) => void
  onSlugChange: (v: string) => void
  onDotChange: (v: string) => void
  onMcChange: (v: string) => void
  slugIsValid: boolean
  slugIsReserved: boolean
  slugAvailable: boolean | null
  checkingSlug: boolean
}) {
  return (
    <div className="space-y-5">
      <div>
        <label htmlFor="companyName" className="field-label">Company name</label>
        <input
          id="companyName"
          autoFocus
          value={companyName}
          onChange={(e) => onCompanyNameChange(e.target.value)}
          placeholder="ABC Logistics"
          className="input-base"
        />
      </div>

      <div>
        <label htmlFor="slug" className="field-label">Company URL</label>
        <div className="flex items-center rounded-lg border border-[#d1ccc5] bg-white overflow-hidden focus-within:ring-2 focus-within:ring-[#d9622b]/20 focus-within:border-[#d9622b]">
          <span className="px-3 text-sm text-[#8a8b8f] font-geist-mono tracking-[0.04em] bg-[#f5f2ec] border-r border-[#e4ddd3] h-11 flex items-center">
            muvx.com/
          </span>
          <input
            id="slug"
            type="text"
            placeholder="abc-logistics"
            value={slug}
            onChange={(e) => onSlugChange(e.target.value)}
            className="flex-1 h-11 px-3 text-[15px] bg-transparent outline-none placeholder-[#a8a29a]"
          />
        </div>
        <div className="min-h-[24px] mt-1.5 text-[12.5px] font-geist">
          {slug && slugIsReserved && (
            <p className="text-[#d9622b]">This URL is reserved. Please choose another.</p>
          )}
          {slug && !slugIsValid && !slugIsReserved && (
            <p className="text-[#d9622b]">Use lowercase letters, numbers, and hyphens only.</p>
          )}
          {slug && slugIsValid && checkingSlug && (
            <p className="text-[#8a8b8f]">Checking availability...</p>
          )}
          {slug && slugIsValid && !checkingSlug && slugAvailable === true && (
            <p style={{ color: "#5e8c6a" }}>✓ This URL is available</p>
          )}
          {slug && slugIsValid && !checkingSlug && slugAvailable === false && (
            <p className="text-[#d9622b]">✗ This URL is already taken</p>
          )}
          {!slug && (
            <p className="text-[#8a8b8f]">Your team will use this URL to sign in.</p>
          )}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="dotNumber" className="field-label">
            DOT number <span className="text-[#a8a29a] normal-case tracking-normal">— Optional</span>
          </label>
          <input
            id="dotNumber"
            inputMode="numeric"
            value={dotNumber}
            onChange={(e) => onDotChange(e.target.value)}
            placeholder="1234567"
            maxLength={10}
            className={cn("input-base", "font-mono")}
          />
        </div>
        <div>
          <label htmlFor="mcNumber" className="field-label">
            MC number <span className="text-[#a8a29a] normal-case tracking-normal">— Optional</span>
          </label>
          <input
            id="mcNumber"
            inputMode="numeric"
            value={mcNumber}
            onChange={(e) => onMcChange(e.target.value)}
            placeholder="654321"
            maxLength={10}
            className={cn("input-base", "font-mono")}
          />
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// STEP 2: Business type
// ─────────────────────────────────────────────────────────────────────────────
function StepBusiness({
  businessType, onChange,
}: {
  businessType: BusinessType | ""
  onChange: (v: BusinessType) => void
}) {
  return (
    <div className="space-y-3">
      {BUSINESS_OPTIONS.map((b) => {
        const active = businessType === b.value
        return (
          <button
            key={b.value}
            type="button"
            onClick={() => onChange(b.value)}
            className={cn(
              "flex items-start gap-3 rounded-xl border p-4 text-left transition-all w-full",
              active
                ? "border-[#d9622b] bg-[#fff0e6]"
                : "border-[#d1ccc5] bg-white hover:border-[#c4bdb3] hover:bg-[#fffdf9]"
            )}
          >
            <span
              className={cn(
                "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors",
                active
                  ? "border-[#d9622b] bg-[#d9622b]"
                  : "border-[#d1ccc5] bg-white"
              )}
            >
              {active && <Check className="h-3 w-3 text-white" strokeWidth={3} />}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block font-geist text-[16px] font-semibold" style={{ color: "#16181d" }}>
                {b.label}
              </span>
              <span className="mt-0.5 block font-geist text-[14px]" style={{ color: "#73757a" }}>
                {b.blurb}
              </span>
            </span>
          </button>
        )
      })}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// STEP 3: Operation scale
// ─────────────────────────────────────────────────────────────────────────────
function StepOperation({
  fleetSize, teamSize, geographicScope, showFleetSize,
  onFleetSizeChange, onTeamSizeChange, onScopeChange,
}: {
  fleetSize: FleetSize | ""
  teamSize: TeamSize | ""
  geographicScope: GeographicScope | ""
  showFleetSize: boolean
  onFleetSizeChange: (v: FleetSize) => void
  onTeamSizeChange: (v: TeamSize) => void
  onScopeChange: (v: GeographicScope) => void
}) {
  return (
    <div className="space-y-5">
      {showFleetSize && (
        <div>
          <label htmlFor="fleet-size" className="field-label">Fleet size</label>
          <Select value={fleetSize} onValueChange={(v) => onFleetSizeChange(v as FleetSize)}>
            <SelectTrigger className="w-full h-11 border-[#d1ccc5] focus:border-[#d9622b] focus:ring-2 focus:ring-[#d9622b]/20">
              <SelectValue placeholder="Select fleet size…" />
            </SelectTrigger>
            <SelectContent>
              {FLEET_SIZE_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <div>
        <label htmlFor="team-size" className="field-label">Team size</label>
        <Select value={teamSize} onValueChange={(v) => onTeamSizeChange(v as TeamSize)}>
          <SelectTrigger className="w-full h-11 border-[#d1ccc5] focus:border-[#d9622b] focus:ring-2 focus:ring-[#d9622b]/20">
            <SelectValue placeholder="Select team size…" />
          </SelectTrigger>
          <SelectContent>
            {TEAM_SIZE_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div>
        <label htmlFor="scope" className="field-label">Geographic scope</label>
        <Select value={geographicScope} onValueChange={(v) => onScopeChange(v as GeographicScope)}>
          <SelectTrigger className="w-full h-11 border-[#d1ccc5] focus:border-[#d9622b] focus:ring-2 focus:ring-[#d9622b]/20">
            <SelectValue placeholder="Select geographic scope…" />
          </SelectTrigger>
          <SelectContent>
            {SCOPE_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// STEP 4: Current setup
// ─────────────────────────────────────────────────────────────────────────────
function StepCurrent({
  currentTool, freightTypes,
  onToolChange, onToggleFreight,
}: {
  currentTool: CurrentTool | ""
  freightTypes: FreightType[]
  onToolChange: (v: CurrentTool) => void
  onToggleFreight: (t: FreightType) => void
}) {
  return (
    <div className="space-y-6">
      <div>
        <label htmlFor="currentTool" className="field-label">
          How do you manage freight today?
        </label>
        <Select value={currentTool} onValueChange={(v) => onToolChange(v as CurrentTool)}>
          <SelectTrigger className="w-full h-11 border-[#d1ccc5] focus:border-[#d9622b] focus:ring-2 focus:ring-[#d9622b]/20">
            <SelectValue placeholder="Select an option…" />
          </SelectTrigger>
          <SelectContent>
            {TOOL_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div>
        <label className="field-label">
          What kinds of freight do you move?
          <span className="text-[#a8a29a] normal-case tracking-normal ml-2">Pick all that apply</span>
        </label>
        <div className="flex flex-wrap gap-2 mt-1.5">
          {FREIGHT_OPTIONS.map((f) => {
            const active = freightTypes.includes(f.value)
            return (
              <button
                key={f.value}
                type="button"
                onClick={() => onToggleFreight(f.value)}
                className={cn(
                  "inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-geist font-medium transition-colors border",
                  active
                    ? "bg-[#16181d] text-[#f5f2ec] border-[#16181d]"
                    : "bg-white text-[#16181d] border-[#d1ccc5] hover:border-[#16181d]"
                )}
              >
                {active && <Check className="h-3.5 w-3.5" strokeWidth={2.5} />}
                {f.label}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// STEP 5: Team invites
// ─────────────────────────────────────────────────────────────────────────────
function StepTeam({
  invites, onAdd, onUpdate, onRemove,
}: {
  invites: TeamInvite[]
  onAdd: () => void
  onUpdate: (index: number, patch: Partial<TeamInvite>) => void
  onRemove: (index: number) => void
}) {
  return (
    <div className="space-y-4">
      <p className="text-sm font-geist" style={{ color: "#4a4e57" }}>
        Get your team in from day one. They&apos;ll receive an email with a sign-up link.
        You can always invite more later from Settings.
      </p>

      <div className="space-y-2.5">
        {invites.map((inv, i) => {
          const emailValid = !inv.email || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(inv.email)
          return (
            <div
              key={i}
              className="flex gap-2 items-start rounded-xl border border-[#d1ccc5] bg-white p-3"
            >
              <div className="flex-1 space-y-2">
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#8a8b8f]" />
                  <input
                    type="email"
                    inputMode="email"
                    value={inv.email}
                    onChange={(e) => onUpdate(i, { email: e.target.value })}
                    placeholder="teammate@company.com"
                    className={cn(
                      "h-10 w-full rounded-lg border bg-white pl-9 pr-3 text-sm outline-none",
                      emailValid
                        ? "border-[#d1ccc5] focus:border-[#d9622b] focus:ring-2 focus:ring-[#d9622b]/20"
                        : "border-[#d9622b] focus:border-[#d9622b] focus:ring-2 focus:ring-[#d9622b]/20"
                    )}
                  />
                </div>
                <Select
                  value={inv.role}
                  onValueChange={(v) => onUpdate(i, { role: v as TeamRole })}
                >
                  <SelectTrigger className="w-full h-10 border-[#d1ccc5] focus:border-[#d9622b] focus:ring-2 focus:ring-[#d9622b]/20 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TEAM_ROLES.map((r) => (
                      <SelectItem key={r.value} value={r.value}>
                        <div className="flex flex-col">
                          <span className="font-medium">{r.label}</span>
                          <span className="text-xs text-[#8a8b8f]">{r.description}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <button
                type="button"
                onClick={() => onRemove(i)}
                className="flex h-10 w-10 items-center justify-center rounded-lg text-[#8a8b8f] hover:bg-[#fef2f2] hover:text-[#d9622b] transition-colors flex-shrink-0"
                aria-label="Remove invite"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          )
        })}
      </div>

      <Button
        type="button"
        variant="outline"
        onClick={onAdd}
        className="w-full h-11 rounded-full border-dashed border-[#d1ccc5] hover:border-[#16181d] hover:bg-[#fffdf9] font-geist"
      >
        <Plus className="h-4 w-4 mr-2" />
        Invite another teammate
      </Button>

      {invites.length === 0 && (
        <p className="text-center text-xs font-geist" style={{ color: "#8a8b8f" }}>
          No invites yet. You can always add team members from Settings.
        </p>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// STEP 6: Goals
// ─────────────────────────────────────────────────────────────────────────────
function StepGoals({
  selected, onToggle,
}: {
  selected: readonly string[]
  onToggle: (g: Goal) => void
}) {
  return (
    <div className="space-y-3">
      <p className="text-sm font-geist" style={{ color: "#4a4e57" }}>
        Pick as many as you like. We&apos;ll lead with these on your dashboard.
      </p>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {GOALS.map((g) => {
          const active = selected.includes(g)
          return (
            <button
              key={g}
              type="button"
              onClick={() => onToggle(g)}
              className={cn(
                "flex items-center gap-2.5 rounded-xl border p-3.5 text-left font-geist text-[14px] transition-colors",
                active
                  ? "border-[#d9622b] bg-[#fff0e6] text-[#16181d] font-medium"
                  : "border-[#d1ccc5] bg-white text-[#16181d] hover:border-[#c4bdb3]"
              )}
            >
              <span
                className={cn(
                  "flex h-4 w-4 shrink-0 items-center justify-center rounded-[5px] border transition-colors",
                  active
                    ? "border-[#d9622b] bg-[#d9622b]"
                    : "border-[#c8c2b8] bg-white"
                )}
              >
                {active && <Check className="h-2.5 w-2.5 text-white" strokeWidth={3} />}
              </span>
              {g}
            </button>
          )
        })}
      </div>
    </div>
  )
}

import { redirect } from "next/navigation"
import { and, eq, isNull, lte, gte, or, sql } from "drizzle-orm"
import { AppSidebarPermission as AppSidebar } from "@/components/app-sidebar-permission"
import { SiteHeader } from "@/components/site-header"
import { AnnouncementBanner } from "@/components/announcement-banner"
import { PermissionsBootstrap } from "@/components/permissions/permissions-bootstrap"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import {
  getSession,
  getOrganizationById,
  getMembersForOrg,
  getIsAdmin,
} from "@/lib/dal"
import { getEffectivePermissions } from "@/lib/can"
import { db } from "@/lib/db"
import { announcement, member, user as userTable } from "@/lib/schema"
import { isMaintenanceMode } from "@/lib/request-gate"

export const instant = false

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // [LAYOUT] Gate: must be signed in
  const session = await getSession()
  if (!session?.user) {
    console.log("[DASHBOARD-LAYOUT] no session → /login")
    redirect("/login")
  }

  // [LAYOUT] Gate: maintenance mode. Admins always see the app.
  const isAdminForGate = await getIsAdmin()
  if (!isAdminForGate) {
    const maintenance = await isMaintenanceMode()
    if (maintenance) {
      console.log("[DASHBOARD-LAYOUT] maintenance on, non-admin → /maintenance")
      redirect("/maintenance")
    }
  }

  // [LAYOUT] Gate: must have an active organization
  const orgId = session.session.activeOrganizationId
  if (!orgId) {
    // Sessions can lose their active-org cookie after logout/login or an
    // invitation flow. Recover a single valid membership before deciding the
    // user needs onboarding; onboarding is only for users with no workspace.
    const memberships = await getMembersForUser(session.user.id)
    if (memberships.length === 1) {
      // Cookie mutation must happen in a route handler or browser client.
      // /auth-redirect sets the sole workspace active with Better Auth and
      // then returns here.
      console.log("[DASHBOARD-LAYOUT] one workspace with no active org → /auth-redirect")
      redirect("/auth-redirect")
    }
    console.log("[DASHBOARD-LAYOUT] no memberships → /onboarding")
    redirect(memberships.length > 1 ? "/select-org" : "/onboarding")
  }

  // [LAYOUT] Fetch the active org, the user's membership,
  // and the list of currently-active announcements — all in parallel.
  const [org, members, activeAnnouncements] = await Promise.all([
    getOrganizationById(orgId),
    getMembersForOrg(orgId),
    fetchActiveAnnouncements({
      userId: session.user.id,
      orgId,
      isAdmin: isAdminForGate,
    }),
  ])

  // [LAYOUT] If the active org in session doesn't exist (e.g. deleted),
  // bounce to /select-org so the user can pick a valid one
  if (!org) {
    console.warn("[DASHBOARD-LAYOUT] active org not found in DB, redirecting to /select-org")
    redirect("/select-org")
  }

  // [LAYOUT] Find this user's role in the active org
  const myMembership = members.find((m) => m.userId === session.user.id)
  // Never render a workspace solely because it remains in a stale session.
  // This can happen after a member is removed in another browser/session.
  // The centralized resolver will choose another membership or onboarding.
  if (!myMembership && !isAdminForGate) {
    console.warn("[DASHBOARD-LAYOUT] active org has no membership → /auth-redirect")
    redirect("/auth-redirect")
  }
  const role = myMembership?.role ?? "member"

  // [LAYOUT] Gate: workspace-scoped suspension (WS-26).
  // Phase 1 added `member.suspendedAt` + `member.suspendedUntil`. If
  // the active-org membership is currently suspended, bounce the
  // user to a workspace-specific suspended screen. Platform admins
  // bypass this gate so they can still inspect suspended workspaces.
  if (
    !isAdminForGate &&
    (org.suspended ||
      (myMembership?.suspendedAt &&
        (!myMembership.suspendedUntil ||
          new Date(myMembership.suspendedUntil as any) > new Date())))
  ) {
    console.log(
      `[DASHBOARD-LAYOUT] workspace suspended user=${session.user.id} org=${orgId} → /workspace-suspended`,
    )
    redirect("/workspace-suspended")
  }

  // [LAYOUT] Detect impersonation (Better Auth sets session.session.impersonatedBy)
  const impersonatedBy =
    (session.session as any).impersonatedBy ?? null
  if (impersonatedBy) {
    console.log("[DASHBOARD-LAYOUT] impersonation active by:", impersonatedBy)
  }

  // [LAYOUT] Serialize the session for the client components
  const sidebarSession = {
    userId: session.user.id,
    userName: session.user.name ?? "User",
    userEmail: session.user.email,
    userImage: session.user.image ?? null,
    userRole: role,
  }

  // [LAYOUT] Compute the effective permission set once per request and
  // hydrate it to the client via PermissionsBootstrap. Every client
  // component below this point can read the set with `usePermissions()`
  // and gate UI on it. The set is rebuilt on every request, so a
  // permission change made in another tab takes effect on next nav.
  const permissionSet = await getEffectivePermissions(
    session.user.id,
    orgId
  )
  const permissions = Array.from(permissionSet)

  return (
    <SidebarProvider
      style={
        {
          "--sidebar-width": "260px",
          "--sidebar-width-icon": "60px",
          "--header-height": "calc(var(--spacing) * 14)",
        } as React.CSSProperties
      }
    >
      <PermissionsBootstrap permissions={permissions} role={role}>
        <AppSidebar
          org={{
            id: org.id,
            name: org.name,
            slug: org.slug,
            logo: org.logo,
            metadata: (org.metadata as Record<string, any> | null) ?? null,
          }}
          session={sidebarSession}
          isImpersonating={!!impersonatedBy}
        />
        <SidebarInset className="bg-background min-w-0 overflow-x-hidden print:overflow-visible print:bg-white print:m-0 print:p-0">
          <div className="print:hidden">
            <SiteHeader
              userName={session.user.name ?? "User"}
              userEmail={session.user.email}
              userImage={session.user.image ?? null}
              isImpersonating={!!impersonatedBy}
            />
            <AnnouncementBanner initial={activeAnnouncements} />
          </div>
          <main className="flex-1 min-w-0 overflow-y-auto print:overflow-visible print:p-0">{children}</main>
        </SidebarInset>
      </PermissionsBootstrap>
    </SidebarProvider>
  )
}

async function getMembersForUser(userId: string) {
  return db
    .select({ organizationId: member.organizationId })
    .from(member)
    .where(eq(member.userId, userId))
}

/**
 * Server-side fetch of currently-active announcements for a user.
 * Mirrors the API route used by the polling client component so the
 * first paint is banner-aware.
 */
async function fetchActiveAnnouncements({
  userId,
  orgId,
  isAdmin,
}: {
  userId: string
  orgId: string
  isAdmin: boolean
}) {
  const now = new Date()
  const visibilityOr = [eq(announcement.scope, "global")]
  if (isAdmin) visibilityOr.push(eq(announcement.scope, "admins_only"))
  // All orgs the user belongs to (just the active one in this layout,
  // but the API endpoint checks all memberships).
  visibilityOr.push(
    and(eq(announcement.scope, "org"), eq(announcement.organizationId, orgId))!
  )

  const rows = await db
    .select({
      id: announcement.id,
      title: announcement.title,
      body: announcement.body,
      kind: announcement.kind,
      dismissible: announcement.dismissible,
    })
    .from(announcement)
    .where(
      and(
        or(...visibilityOr)!,
        or(isNull(announcement.startsAt), lte(announcement.startsAt, now))!,
        or(isNull(announcement.endsAt), gte(announcement.endsAt, now))!
      )
    )
    .orderBy(announcement.createdAt)

  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    body: r.body,
    kind: r.kind as "info" | "warn" | "success" | "maintenance",
    dismissible: r.dismissible,
    link: null as string | null,
    linkLabel: null as string | null,
  }))
}

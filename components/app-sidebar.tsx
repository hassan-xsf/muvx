"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { MuvxLogoMark } from "@/components/brand/muvx-logo"
import { useQuery } from "@tanstack/react-query"
import { authClient } from "@/lib/auth-client"
import {
  LayoutDashboard,
  Truck,
  Map,
  Users,
  Receipt,
  Banknote,
  ClipboardList,
  TrendingUp,
  Settings,
  Plus,
  ChevronsUpDown,
  Building2,
  CreditCard,
  MoreVertical,
  Bot,
  ShieldCheck,
  Scale,
  type LucideIcon,
} from "lucide-react"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupAction,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  SidebarSeparator,
} from "@/components/ui/sidebar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

import { NavUser } from "@/components/nav-user"
import { SidebarCopilotBot } from "@/components/ai/muvx-bot"
import { cn } from "@/lib/utils"

// ─── Nav config ──────────────────────────────────────────────────

import { usePermissions } from "@/lib/permissions-context"

type NavItem = {
  label: string
  href: string
  icon: LucideIcon
  permissions?: string[]
}

const MAIN_NAV: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Copilot", href: "/copilot", icon: Bot },
  {
    label: "Loads",
    href: "/loads",
    icon: Truck,
    permissions: ["loads.module", "loads.view_all", "loads.view_own"],
  },
  {
    label: "Trips",
    href: "/trips",
    icon: Map,
    permissions: ["trips.module", "trips.view_all", "trips.view_assigned"],
  },
  {
    label: "Fleet",
    href: "/fleet",
    icon: Truck,
    permissions: ["fleet.module", "fleet.view_all"],
  },
  {
    label: "Drivers",
    href: "/drivers",
    icon: Users,
    permissions: ["drivers.module", "drivers.view_all", "drivers.view_own"],
  },
  {
    label: "Safety & Compliance",
    href: "/safety",
    icon: ShieldCheck,
    permissions: ["drivers.module", "fleet.module"],
  },
  {
    label: "Customers",
    href: "/customers",
    icon: Building2,
    permissions: ["customers.module", "customers.view_all"],
  },
  {
    label: "Invoices",
    href: "/invoices",
    icon: Receipt,
    permissions: ["invoices.module", "invoices.view_all", "invoices.view_own"],
  },
  {
    label: "Accounts Payable",
    href: "/accounts-payable",
    icon: Receipt,
    permissions: ["accounting.module", "accounting.invoices.view_all"],
  },
  {
    label: "Carrier Pay",
    href: "/carrier-pay",
    icon: Banknote,
    permissions: ["accounting.module", "settlements.module", "settlements.view_all", "accounting.carrier_pay.view"],
  },
  {
    label: "Payroll",
    href: "/payroll",
    icon: ClipboardList,
    permissions: ["accounting.module", "accounting.payroll.view"],
  },
  {
    label: "Settlements",
    href: "/settlements",
    icon: Scale,
    permissions: ["accounting.module", "settlements.module", "settlements.view_all"],
  },
  {
    label: "Reports",
    href: "/reports",
    icon: TrendingUp,
    permissions: ["reports.module", "reports.view"],
  },
]

const ACCOUNT_NAV: NavItem[] = [
  {
    label: "Workspace",
    href: "/settings/workspace",
    icon: Building2,
    permissions: ["workspace.module", "workspace.profile.view"],
  },
  {
    label: "Billing",
    href: "/settings/billing",
    icon: CreditCard,
    permissions: ["workspace.module", "workspace.profile.view"],
  },
  {
    label: "Settings",
    href: "/settings",
    icon: Settings,
    permissions: ["workspace.module", "workspace.profile.view", "users.module"],
  },
]

// ─── Component ───────────────────────────────────────────────────

type SidebarSession = {
  userId: string
  userName: string
  userEmail: string
  userImage: string | null
  userRole: string
}

type SidebarOrg = {
  id: string
  name: string
  slug: string
  logo: string | null
  metadata: Record<string, any> | null
}

export function AppSidebar({
  org,
  session,
  isImpersonating = false,
}: {
  org: SidebarOrg
  session: SidebarSession
  isImpersonating?: boolean
}) {
  const pathname = usePathname()
  const perms = usePermissions()

  const visibleMainNav = React.useMemo(() => {
    return MAIN_NAV.filter((item) => {
      if (!item.permissions || item.permissions.length === 0) return true
      return item.permissions.some((p) => perms.has(p))
    })
  }, [perms])

  const visibleAccountNav = React.useMemo(() => {
    return ACCOUNT_NAV.filter((item) => {
      if (!item.permissions || item.permissions.length === 0) return true
      return item.permissions.some((p) => perms.has(p))
    })
  }, [perms])

  // [SIDEBAR] List of all orgs the user is a member of (for the switcher)
  const { data: orgsData } = useQuery({
    queryKey: ["orgs-list"],
    queryFn: async () => {
      const r = await authClient.organization.list()
      return r.data ?? []
    },
  })
  const orgs = (orgsData ?? []) as { id: string; name: string; slug: string }[]

  const handleSwitchOrg = async (orgId: string) => {
    console.log("[SIDEBAR] switching org →", orgId)
    await authClient.organization.setActive({ organizationId: orgId })
    // Reload to re-derive session, TanStack cache, and server components
    // against the new tenantId. DB is the source of truth.
    window.location.reload()
  }

  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border">
      {/* ─── Brand header ─── */}
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              render={<Link href="/dashboard" />}
              size="lg"
              tooltip="Muvx TMS"
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
            >
              <div className="flex aspect-square size-8 items-center justify-center rounded-md bg-[#16181d] text-white shrink-0 p-1.5 shadow-sm">
                <MuvxLogoMark className="size-full text-white" />
              </div>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-serif text-[18px] font-semibold tracking-tight text-brand-ink">
                  Muvx<span className="text-brand-accent">TMS</span>
                </span>
                <span className="truncate font-mono text-[10px] uppercase tracking-[0.04em] text-brand-muted-soft">
                  Transportation management
                </span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>

        {/* ─── Org switcher ─── */}
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <SidebarMenuButton
                    size="lg"
                    tooltip={org.name}
                    className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground border border-sidebar-border"
                  />
                }
              >
                <div className="flex aspect-square size-8 items-center justify-center rounded-md bg-brand-accent-tint text-brand-accent flex-shrink-0">
                  <Building2 className="size-4" />
                </div>
                <div className="grid flex-1 text-left text-sm leading-tight min-w-0">
                  <span className="truncate font-semibold text-brand-ink">
                    {org.name}
                  </span>
                  <span className="truncate font-mono text-[10px] uppercase tracking-[0.04em] text-brand-muted-soft">
                    /{org.slug}
                  </span>
                </div>
                <ChevronsUpDown className="ml-auto size-4 text-brand-muted-soft" />
              </DropdownMenuTrigger>
              <DropdownMenuContent
                className="min-w-[220px] rounded-lg border-sidebar-border bg-brand-card p-1"
                side="right"
                align="end"
                sideOffset={4}
              >
                {/* Base UI's GroupLabel throws unless it sits inside a
                    Menu.Group, so the label and its items share one. */}
                <DropdownMenuGroup>
                  <DropdownMenuLabel className="font-mono text-[10px] uppercase tracking-[0.04em] text-brand-muted-soft px-2 py-1.5">
                    Workspaces
                  </DropdownMenuLabel>
                  {orgs.map((o) => (
                    <DropdownMenuItem
                      key={o.id}
                      onClick={() => handleSwitchOrg(o.id)}
                      className="rounded-md cursor-pointer"
                    >
                      <Building2 className="mr-2 size-4 text-brand-muted-soft" />
                      <span className="truncate flex-1">{o.name}</span>
                      {o.id === org.id && (
                        <span className="ml-auto text-brand-accent">✓</span>
                      )}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuGroup>
                <DropdownMenuSeparator className="bg-sidebar-border" />
                <DropdownMenuItem
                  render={
                    <Link
                      href="/onboarding?create=1"
                      className="rounded-md cursor-pointer text-brand-accent"
                    />
                  }
                >
                  <Plus className="mr-2 size-4" />
                  New workspace
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarSeparator className="bg-sidebar-border" />

      <SidebarContent>
        {/* ─── MAIN ─── */}
        <SidebarGroup>
          <SidebarGroupLabel className="font-mono text-[10px] uppercase tracking-[0.04em] text-brand-muted-soft">
            Main
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {visibleMainNav.map((item) => {
                const isActive =
                  pathname === item.href ||
                  pathname.startsWith(item.href + "/")
                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      render={<Link href={item.href} />}
                      isActive={isActive}
                      tooltip={item.label}
                      className={cn(
                        "h-9 px-2.5 gap-2.5 [&>svg]:size-5!",
                        isActive
                          ? "bg-brand-ink text-brand-cream hover:bg-brand-ink hover:text-brand-cream"
                          : "text-brand-ink/80 hover:bg-brand-accent-tint hover:text-brand-ink"
                      )}
                    >
                      {item.href === "/copilot" ? (
                        <SidebarCopilotBot isActive={isActive} />
                      ) : (
                        <item.icon className="size-5 shrink-0" />
                      )}
                      <span className="text-[15px] font-medium leading-none">{item.label}</span>
                    </SidebarMenuButton>

                    {item.href === "/copilot" && (
                      <DropdownMenu>
                        <DropdownMenuTrigger
                          render={
                            <SidebarMenuAction
                              showOnHover={false}
                              className={cn(
                                "text-brand-muted-soft hover:text-brand-ink right-1.5",
                                isActive && "text-brand-cream/80 hover:text-brand-cream"
                              )}
                            />
                          }
                        >
                          <MoreVertical className="size-4" />
                          <span className="sr-only">Copilot Options</span>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent
                          className="w-52 rounded-xl border-brand-rule bg-brand-card p-1 shadow-lg"
                          side="right"
                          align="start"
                          sideOffset={6}
                        >
                          <DropdownMenuGroup>
                            <DropdownMenuLabel className="font-mono text-[10px] uppercase tracking-[0.04em] text-brand-muted-soft px-2 py-1.5">
                              AI Copilot
                            </DropdownMenuLabel>
                            <DropdownMenuItem
                              render={<Link href="/settings/copilot" />}
                              className="rounded-lg cursor-pointer text-xs"
                            >
                              <Settings className="mr-2 size-3.5 text-brand-muted-soft" />
                              <span>Copilot Settings</span>
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => {
                                fetch("/api/copilot/chats", { method: "DELETE" })
                                  .then(() => {
                                    window.location.href = "/copilot"
                                  })
                                  .catch(() => {})
                              }}
                              className="rounded-lg cursor-pointer text-xs"
                            >
                              <Plus className="mr-2 size-3.5 text-brand-muted-soft" />
                              <span>New Conversation</span>
                            </DropdownMenuItem>
                          </DropdownMenuGroup>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </SidebarMenuItem>
                )
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarSeparator className="bg-sidebar-border" />

        {/* ─── SETTINGS ─── */}
        <SidebarGroup>
          <SidebarGroupLabel className="font-mono text-[10px] uppercase tracking-[0.04em] text-brand-muted-soft">
            Settings
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {visibleAccountNav.map((item) => {
                const isActive =
                  item.href === "/settings"
                    ? pathname === "/settings" ||
                      (pathname.startsWith("/settings/") &&
                        pathname !== "/settings/workspace" &&
                        pathname !== "/settings/billing")
                    : pathname === item.href
                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      render={<Link href={item.href} />}
                      isActive={isActive}
                      tooltip={item.label}
                      className={cn(
                        "h-9 px-2.5 gap-2.5 [&>svg]:size-5!",
                        isActive
                          ? "bg-brand-ink text-brand-cream hover:bg-brand-ink hover:text-brand-cream"
                          : "text-brand-ink/80 hover:bg-brand-accent-tint hover:text-brand-ink"
                      )}
                    >
                      <item.icon className="size-5 shrink-0" />
                      <span className="text-[15px] font-medium leading-none">{item.label}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      {/* ─── Footer: identity card (sidebar-07 parity) + keyboard hints ─── */}
      <SidebarFooter>
        <NavUser
          user={session}
          isImpersonating={isImpersonating}
        />

      </SidebarFooter>

      <SidebarRail className="border-sidebar-border" />
    </Sidebar>
  )
}

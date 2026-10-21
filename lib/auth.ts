import { betterAuth } from "better-auth/minimal"
import { drizzleAdapter } from "better-auth/adapters/drizzle"
import { nextCookies } from "better-auth/next-js"
import { db } from "./db"
import * as schema from "./schema"
import {
  emailOTP,
  username,
  organization,
  admin,
  lastLoginMethod,
  multiSession,
} from "better-auth/plugins"
import { sendOtpEmail, sendInvitationEmail } from "./email"
import {
  ac,
  owner,
  administrator,
  member,
  opsManager,
  dispatcher,
  accounting,
  driverRole,
  safety,
} from "./auth-roles"
import { anonymizeUserReferences } from "./cascade"
import { recordAuditEvent } from "./audit"

console.log("[AUTH] Initializing Better Auth...")
console.log("[AUTH] Database URL exists:", !!process.env.DATABASE_URL)
console.log("[AUTH] Better Auth URL:", process.env.BETTER_AUTH_URL)
console.log("[AUTH] Google Client ID exists:", !!process.env.GOOGLE_CLIENT_ID)
console.log("[AUTH] Resend API Key exists:", !!process.env.RESEND_API_KEY)

export const auth = betterAuth({
  baseURL: process.env.BETTER_AUTH_URL || "http://localhost:3000",
  secret: process.env.BETTER_AUTH_SECRET,
  trustedOrigins: [
    "https://app.muvxtms.com",
    "http://app.muvxtms.com",
    "http://52.62.31.143",
    "http://localhost:3000",
    ...(process.env.BETTER_AUTH_URL ? [process.env.BETTER_AUTH_URL] : []),
  ],

  plugins: [
    username(),
    organization({
      ac,
      roles: {
        owner,
        admin: administrator,
        member,
        operations_manager: opsManager,
        dispatcher,
        accounting,
        driver: driverRole,
        safety,
      },
      creatorRole: "owner",
      allowUserToCreateOrganization: true,
      // Allow up to 3 orgs per user - prevents accidental "hit limit" errors
      // while still encouraging single-org usage for TMS
      organizationLimit: 3,
      teams: { enabled: false },
      // ─── Dynamic Access Control (Phase 3 — WS-31/32/33) ────────────
      // Enables per-workspace custom roles in addition to the global
      // ROLE_CATALOG. Creates the `organizationRole` table on migration.
      // Roles created at the org level are checked via hasPermission()
      // (not checkRolePermission, which is static-only on the client).
      dynamicAccessControl: {
        enabled: true,
        // Cap custom roles per org to prevent permission sprawl
        maximumRolesPerOrganization: 20,
      },

      // ─── Invitation email (Phase 1 — WS-16, WS-18) ────────────────
      // Required: without this callback, `authClient.organization.inviteMember()`
      // silently inserts a row but NEVER sends email. That was the
      // root cause of "invitations not working" in production.
      // Verified against https://better-auth.com/docs/plugins/organization
      async sendInvitationEmail(data: {
        id: string
        email: string
        role: string
        organization: {
          id: string
          name: string
          slug: string
          createdAt: Date
          logo?: string | null
          metadata?: any
        }
        invitation: {
          id: string
          organizationId: string
          email: string
          role: string | null
          status: string
          expiresAt: Date
          inviterId: string | null
          teamId?: string | null
        }
        inviter: {
          id: string
          organizationId: string
          userId: string
          role: string
          createdAt: Date
          user: {
            id: string
            createdAt: Date
            updatedAt: Date
            email: string
            emailVerified: boolean
            name: string
            image?: string | null
          }
        }
      }) {
        console.log(
          `[AUTH] organization.sendInvitationEmail id=${data.id} email=${data.email} role=${data.role} org=${data.organization?.name}`,
        )
        try {
          await sendInvitationEmail({
            id: data.id,
            email: data.email,
            role: data.role,
            inviter: {
              id: data.inviter.user.id,
              name: data.inviter.user.name,
              email: data.inviter.user.email,
            },
            organization: {
              id: data.organization.id,
              name: data.organization.name,
              slug: data.organization.slug,
            },
            expiresAt: data.invitation.expiresAt,
          })
          console.log(`[AUTH] ✅ invitation email sent to ${data.email}`)
        } catch (err) {
          console.error(`[AUTH] ❌ invitation email failed:`, err)
          throw err
        }
      },

      // ─── Lifecycle hooks (Phase 1) ────────────────────────────────
      // `organizationHooks` is the top-level key (NOT `hooks`). Each
      // hook is a TOP-LEVEL field (NOT nested under before/after).
      // The earlier `hooks: { before: { removeMember } }` shape was the
      // deprecated legacy alias and silently fired nothing.
      //
      // The destructive workspace cascade lives in `lib/cascade.ts` and
      // is invoked from `app/actions/remove-member.ts` — NOT from these
      // hooks — because those hooks run outside a request transaction we
      // control. These hooks here are observability + audit only.
      organizationHooks: {
        beforeRemoveMember: async ({ member, user, organization }) => {
          console.log(
            `[AUTH] organizationHooks.beforeRemoveMember memberId=${member?.id} userId=${user?.id} orgId=${organization?.id}`
          )
        },
        afterRemoveMember: async ({ member, user, organization }) => {
          console.log(
            `[AUTH] organizationHooks.afterRemoveMember memberId=${member?.id} userId=${user?.id} orgId=${organization?.id}`
          )
          // Best-effort audit. Use stable labels because the user/member
          // rows may already be deleted by the time this fires.
          await recordAuditEvent({
            actor: {
              id: user?.id ?? "(unknown)",
              email: user?.email ?? "(unknown)",
            },
            action: "user.remove-from-org",
            target: {
              type: "member",
              id: member?.id ?? null,
              label: user?.email ?? null,
            },
            metadata: {
              organizationId: organization?.id,
              organizationName: organization?.name,
              via: "ba.organizationHooks.afterRemoveMember",
            },
          })
        },
        beforeUpdateMemberRole: async ({ member, newRole, user, organization }) => {
          console.log(
            `[AUTH] organizationHooks.beforeUpdateMemberRole memberId=${member?.id} ${member?.role}→${newRole} orgId=${organization?.id}`
          )
          // Pass through unchanged. We could veto here by throwing an
          // APIError; Better Auth's last-owner guard already covers
          // the demote-from-owner path.
          return { data: { role: newRole } }
        },
        afterUpdateMemberRole: async ({ member, previousRole, user, organization }) => {
          console.log(
            `[AUTH] organizationHooks.afterUpdateMemberRole memberId=${member?.id} ${previousRole}→${member.role} orgId=${organization?.id}`
          )
          await recordAuditEvent({
            actor: {
              id: user?.id ?? "(unknown)",
              email: user?.email ?? "(unknown)",
            },
            action: "user.set-member-role",
            target: {
              type: "member",
              id: member?.id ?? null,
              label: user?.email ?? null,
            },
            metadata: {
              organizationId: organization?.id,
              organizationName: organization?.name,
              previousRole,
              newRole: member.role,
              via: "ba.organizationHooks.afterUpdateMemberRole",
            },
          })
        },
      },
    }),
    admin({
      defaultRole: "user",
      adminRoles: ["admin"],
      // Safer defaults for production usage
      impersonationSessionDuration: 60 * 30, // 30 minutes
      defaultBanReason: "Policy violation",
      defaultBanExpiresIn: 60 * 60 * 24 * 30, // 30 days
      bannedUserMessage:
        "Your account has been suspended. Contact support@muvx.com if you believe this is a mistake.",
    }),
    lastLoginMethod(),
    multiSession(),
    emailOTP({
      otpLength: 6,
      expiresIn: 600,
      disableSignUp: false,
      async sendVerificationOTP({ email, otp, type }) {
        console.log("[AUTH] === emailOTP.sendVerificationOTP called ===")
        console.log("[AUTH] emailOTP type:", type)
        try {
          await sendOtpEmail({ email, otp, type })
          console.log("[AUTH] ✅ emailOTP email sent successfully")
        } catch (err) {
          console.error("[AUTH] ❌ emailOTP email send failed:", err)
          throw err
        }
      },
    }),
    // MUST be the last plugin — it wraps cookie writes so Server Actions
    // and Route Handlers actually persist the session cookie.
    nextCookies(),
  ],

  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false,
  },

  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID as string,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
    },
  },

  // ─── Cascade hooks ──────────────────────────────────────────────────
  // `databaseHooks.user.delete.before` anonymizes audit_log and
  // email_broadcast references to the user before Better Auth's
  // internal delete fires. This is belt-and-braces: the cascade
  // library (`lib/cascade.ts`) also calls this from the server-side
  // transaction, but external scripts that call removeUser directly
  // get the same protection.
  //
  // `organizationHooks.beforeRemoveMember` does NOT cascade — the
  // cascade library is the only place that does workspace-scoped
  // cleanup, and it runs from a server action with proper audit.
  // This hook just logs the intent for debugging.
  advanced: {
    ipAddress: {
      ipAddressHeaders: [
        "x-forwarded-for",
        "x-real-ip",
        "cf-connecting-ip",
        "true-client-ip",
        "x-client-ip",
      ],
      ipv6Subnet: 128,
      disableIpTracking: false,
    },
  },

  databaseHooks: {
    session: {
      create: {
        before: async (sess, ctx) => {
          let resolvedIp = sess.ipAddress
          if (
            !resolvedIp ||
            resolvedIp === "0000:0000:0000:0000:0000:0000:0000:0000" ||
            resolvedIp === "::1"
          ) {
            const headerIp =
              ctx?.request?.headers?.get("x-forwarded-for")?.split(",")[0]?.trim() ||
              ctx?.request?.headers?.get("x-real-ip") ||
              ctx?.request?.headers?.get("cf-connecting-ip") ||
              "127.0.0.1"
            resolvedIp = headerIp === "::1" ? "127.0.0.1" : headerIp
          }
          return {
            data: {
              ...sess,
              ipAddress: resolvedIp,
            },
          }
        },
        after: async (sess) => {
          try {
            await recordAuditEvent({
              actor: {
                id: sess.userId,
                email: "(authenticated user)",
              },
              action: "session.create",
              target: {
                type: "session",
                id: sess.id,
                label: `Session on ${sess.ipAddress || "local"}`,
              },
              metadata: {
                sessionId: sess.id,
                ipAddress: sess.ipAddress,
                userAgent: sess.userAgent,
                createdAt: sess.createdAt,
              },
              skipRequestContext: true,
            })
          } catch (e) {
            console.error("[AUTH] Failed to write session.create audit log:", e)
          }
        },
      },
    },
    user: {
      delete: {
        before: async (user) => {
          console.log(`[AUTH] databaseHooks.user.delete.before ${user.id}`)
          try {
            await anonymizeUserReferences(user.id, db as any)
          } catch (err) {
            console.error(
              `[AUTH] anonymizeUserReferences failed in user.delete.before:`,
              err
            )
            // Don't rethrow — Better Auth will still try the delete,
            // and the FK is now nullable+SET NULL, so it'll succeed
            // even if our anonymization had a partial failure.
          }
          return true
        },
      },
    },
  },

  database: drizzleAdapter(db, {
    provider: "pg",
    schema,
  }),

  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    updateAge: 60 * 60 * 24, // 1 day
  },

  user: {
    additionalFields: {
      phone: {
        type: "string",
        required: false,
        input: true,
      },
    },
  },
})

console.log("[AUTH] ✅ Better Auth initialized")

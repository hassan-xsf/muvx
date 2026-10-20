import { z } from "zod"
import { randomUUID } from "node:crypto"
import { eq, and, gt } from "drizzle-orm"
import { db } from "@/lib/db"
import { member, invitation, user as userTable, organization } from "@/lib/schema"
import { recordAuditEvent } from "@/lib/audit"
import { dispatchNotificationEvent } from "@/lib/notifications"
import { sendInvitationEmail } from "@/lib/email"
import { cascadeRemoveMember } from "@/lib/cascade"
import { defineTmsTool, hasPermission, permissionDeniedResult } from "../types"

export const listWorkspaceMembersTool = defineTmsTool({
  name: "listWorkspaceMembers",
  description: "List active team members, their operational roles, suspension states, and pending invitations in the current workspace.",
  requiredPermissions: ["users.module", "workspace.module"],
  inputSchema: z.object({}),
  execute: async (_params, ctx) => {
    if (!hasPermission(ctx, ["users.module", "workspace.module", "users.invite", "users.change_role"])) {
      return permissionDeniedResult(["users.module", "workspace.module"])
    }

    const members = await db
      .select({
        id: member.id,
        role: member.role,
        suspendedAt: member.suspendedAt,
        userId: userTable.id,
        userName: userTable.name,
        userEmail: userTable.email,
        createdAt: member.createdAt,
      })
      .from(member)
      .innerJoin(userTable, eq(member.userId, userTable.id))
      .where(eq(member.organizationId, ctx.tenantId))

    const pendingInvites = await db
      .select({
        id: invitation.id,
        email: invitation.email,
        role: invitation.role,
        status: invitation.status,
        expiresAt: invitation.expiresAt,
        createdAt: invitation.createdAt,
      })
      .from(invitation)
      .where(and(eq(invitation.organizationId, ctx.tenantId), eq(invitation.status, "pending")))

    return {
      totalMembers: members.length,
      totalPendingInvitations: pendingInvites.length,
      members: members.map((m) => ({
        memberId: m.id,
        name: m.userName || "User",
        email: m.userEmail,
        role: m.role,
        isSuspended: !!m.suspendedAt,
        joinedAt: new Date(m.createdAt).toLocaleDateString(),
      })),
      pendingInvitations: pendingInvites.map((inv) => ({
        invitationId: inv.id,
        email: inv.email,
        role: inv.role || "member",
        status: inv.status,
        expiresAt: new Date(inv.expiresAt).toLocaleDateString(),
      })),
    }
  },
})

export const inviteWorkspaceMemberTool = defineTmsTool({
  name: "inviteWorkspaceMember",
  description: "Send an email invitation to a new team member with an assigned role.",
  requiredPermissions: ["users.invite"],
  inputSchema: z.object({
    email: z.string().email().describe("Invitee email address"),
    role: z.enum(["admin", "member", "dispatcher", "driver", "accountant", "safety_officer"]).default("member"),
  }),
  execute: async ({ email, role }, ctx) => {
    if (!hasPermission(ctx, ["users.invite", "users.module"])) {
      return permissionDeniedResult(["users.invite"])
    }

    const inviteId = randomUUID()
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)

    await db.insert(invitation).values({
      id: inviteId,
      organizationId: ctx.tenantId,
      email,
      role,
      status: "pending",
      expiresAt,
      inviterId: ctx.userId,
      inviterEmail: ctx.userEmail,
    })

    const [org] = await db
      .select({ id: organization.id, name: organization.name, slug: organization.slug })
      .from(organization)
      .where(eq(organization.id, ctx.tenantId))
      .limit(1)

    try {
      await sendInvitationEmail({
        id: inviteId,
        email,
        role,
        inviter: {
          id: ctx.userId,
          name: ctx.userName || ctx.userEmail,
          email: ctx.userEmail,
        },
        organization: {
          id: ctx.tenantId,
          name: org?.name || "Muvx Freight",
          slug: org?.slug || "muvx",
        },
        expiresAt,
      })
    } catch (emailErr) {
      console.error("[COPILOT/INVITE] Email send warning:", emailErr)
    }

    await recordAuditEvent({
      actor: { id: ctx.userId, email: ctx.userEmail },
      action: "user.invite-to-org",
      target: { type: "invitation", id: inviteId, label: email },
      metadata: { role, tenantId: ctx.tenantId },
    })

    await dispatchNotificationEvent({
      organizationId: ctx.tenantId,
      category: "team",
      event: "team.invitation_sent",
      severity: "info",
      title: "Team Invitation Sent",
      message: `Invitation sent to ${email} with role '${role}'.`,
      link: "/settings/team",
      metadata: { inviteId, email, role },
    })

    return {
      success: true,
      inviteId,
      email,
      role,
      expiresAt: expiresAt.toISOString().slice(0, 10),
      message: `Invitation email sent to ${email} with role '${role}'.`,
    }
  },
})

export const resendInvitationTool = defineTmsTool({
  name: "resendInvitation",
  description: "Resend an invitation email to a pending team invitee.",
  requiredPermissions: ["users.invite"],
  inputSchema: z.object({
    invitationId: z.string().describe("ID of the pending invitation"),
  }),
  execute: async ({ invitationId }, ctx) => {
    if (!hasPermission(ctx, ["users.invite", "users.module"])) {
      return permissionDeniedResult(["users.invite"])
    }

    const [inv] = await db
      .select()
      .from(invitation)
      .where(
        and(
          eq(invitation.id, invitationId),
          eq(invitation.organizationId, ctx.tenantId),
          gt(invitation.expiresAt, new Date())
        )
      )
      .limit(1)

    if (!inv) {
      return { success: false, error: "Invitation not found or has expired." }
    }

    const [org] = await db
      .select({ id: organization.id, name: organization.name, slug: organization.slug })
      .from(organization)
      .where(eq(organization.id, ctx.tenantId))
      .limit(1)

    await sendInvitationEmail({
      id: inv.id,
      email: inv.email,
      role: inv.role ?? "member",
      inviter: { id: ctx.userId, name: ctx.userName || ctx.userEmail, email: ctx.userEmail },
      organization: { id: ctx.tenantId, name: org?.name || "Muvx Freight", slug: org?.slug || "muvx" },
      expiresAt: inv.expiresAt,
    })

    await recordAuditEvent({
      actor: { id: ctx.userId, email: ctx.userEmail },
      action: "user.invite-resent",
      target: { type: "invitation", id: inv.id, label: inv.email },
      metadata: { organizationId: ctx.tenantId },
    })

    return {
      success: true,
      invitationId: inv.id,
      email: inv.email,
      message: `Invitation email resent to ${inv.email}.`,
    }
  },
})

export const cancelInvitationTool = defineTmsTool({
  name: "cancelInvitation",
  description: "Revoke or cancel a pending team invitation.",
  requiredPermissions: ["users.invite"],
  inputSchema: z.object({
    invitationId: z.string().describe("ID of the invitation to cancel"),
  }),
  execute: async ({ invitationId }, ctx) => {
    if (!hasPermission(ctx, ["users.invite", "users.remove", "users.module"])) {
      return permissionDeniedResult(["users.invite"])
    }

    const [inv] = await db
      .select()
      .from(invitation)
      .where(and(eq(invitation.id, invitationId), eq(invitation.organizationId, ctx.tenantId)))
      .limit(1)

    if (!inv) {
      return { success: false, error: "Invitation not found." }
    }

    await db
      .update(invitation)
      .set({ status: "cancelled" })
      .where(eq(invitation.id, invitationId))

    await recordAuditEvent({
      actor: { id: ctx.userId, email: ctx.userEmail },
      action: "user.invite-cancelled",
      target: { type: "invitation", id: inv.id, label: inv.email },
      metadata: { organizationId: ctx.tenantId },
    })

    return {
      success: true,
      invitationId,
      email: inv.email,
      message: `Invitation for ${inv.email} was cancelled.`,
    }
  },
})

export const updateMemberRoleTool = defineTmsTool({
  name: "updateMemberRole",
  description: "Update an existing team member's role or suspend/reinstate their workspace access.",
  requiredPermissions: ["users.change_role"],
  inputSchema: z.object({
    memberId: z.string().describe("ID of the workspace member"),
    role: z.enum(["admin", "member", "dispatcher", "driver", "accountant", "safety_officer"]).optional().describe("New role"),
    suspend: z.boolean().optional().describe("Set true to suspend, false to reinstate"),
    suspendReason: z.string().optional().describe("Reason for suspension"),
  }),
  execute: async ({ memberId, role: newRole, suspend, suspendReason }, ctx) => {
    if (!hasPermission(ctx, ["users.change_role", "users.suspend", "users.module"])) {
      return permissionDeniedResult(["users.change_role"])
    }

    const [existing] = await db
      .select()
      .from(member)
      .where(and(eq(member.id, memberId), eq(member.organizationId, ctx.tenantId)))
      .limit(1)

    if (!existing) {
      return { success: false, error: "Member not found." }
    }

    if (existing.role === "owner") {
      return { success: false, error: "Cannot modify the owner's role or suspend the owner." }
    }

    const updates: Record<string, any> = {}
    if (newRole) updates.role = newRole
    if (suspend === true) {
      updates.suspendedAt = new Date()
      updates.suspendedReason = suspendReason ?? "Suspended by Copilot"
      updates.suspendedBy = ctx.userId
    } else if (suspend === false) {
      updates.suspendedAt = null
      updates.suspendedReason = null
      updates.suspendedBy = null
    }

    await db
      .update(member)
      .set(updates)
      .where(and(eq(member.id, memberId), eq(member.organizationId, ctx.tenantId)))

    await recordAuditEvent({
      actor: { id: ctx.userId, email: ctx.userEmail },
      action: suspend ? "user.suspend-from-workspace" : "user.set-member-role",
      target: { type: "member", id: memberId, label: memberId },
      metadata: { updates, tenantId: ctx.tenantId },
    })

    return {
      success: true,
      memberId,
      role: newRole || existing.role,
      isSuspended: suspend !== undefined ? suspend : !!existing.suspendedAt,
      message: `Workspace member permissions updated.`,
    }
  },
})

export const removeMemberTool = defineTmsTool({
  name: "removeMember",
  description: "Remove a member from the workspace with safe cascading cleanup.",
  requiredPermissions: ["users.remove"],
  inputSchema: z.object({
    memberId: z.string().describe("ID of the workspace member to remove"),
  }),
  execute: async ({ memberId }, ctx) => {
    if (!hasPermission(ctx, ["users.remove", "users.module"])) {
      return permissionDeniedResult(["users.remove"])
    }

    const [target] = await db
      .select({ id: member.id, role: member.role, userId: member.userId })
      .from(member)
      .where(and(eq(member.id, memberId), eq(member.organizationId, ctx.tenantId)))
      .limit(1)

    if (!target) {
      return { success: false, error: "Member not found in this workspace." }
    }

    if (target.role === "owner") {
      return { success: false, error: "Cannot remove the workspace owner." }
    }

    if (target.userId === ctx.userId) {
      return { success: false, error: "You cannot remove yourself from the workspace via Copilot." }
    }

    const cascadeResult = await cascadeRemoveMember({
      memberId: target.id,
      organizationId: ctx.tenantId,
      actor: { id: ctx.userId, email: ctx.userEmail },
    })

    await recordAuditEvent({
      actor: { id: ctx.userId, email: ctx.userEmail },
      action: "user.remove-from-org",
      target: { type: "member", id: target.id, label: target.userId },
      metadata: { cascadeResult, tenantId: ctx.tenantId },
    })

    return {
      success: true,
      memberId: target.id,
      userId: target.userId,
      cascadeSummary: cascadeResult,
      message: `Member removed from workspace successfully.`,
    }
  },
})

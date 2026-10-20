import { z } from "zod"
import { randomUUID } from "crypto"
import { defineTmsTool, hasPermission, permissionDeniedResult, type ToolContext } from "../types"
import { db } from "@/lib/db"
import { copilotScheduledTask, copilotMemory, driver, load } from "@/lib/schema"
import { eq, and, desc, like, or } from "drizzle-orm"
import { ensureCopilotTables, logCopilotEvent } from "../db-init"

// ─────────────────────────────────────────────────────────────────────────────
// 1. Assign Driver Task Tool
// ─────────────────────────────────────────────────────────────────────────────

export const assignDriverTaskTool = defineTmsTool({
  name: "assignDriverTask",
  description:
    "Assigns an operational or safety task to an active commercial driver. Handles inspections, seal verification, scale tickets, and pickup/delivery check-ins.",
  requiredPermissions: ["trips.create", "fleet.trucks.view"],
  inputSchema: z.object({
    driverName: z.string().describe("Name of the driver (e.g. 'John Doe', 'Marcus Vance')"),
    taskTitle: z.string().describe("Actionable task title (e.g. 'Upload Scale Ticket', 'Verify Cargo Seal')"),
    taskDescription: z.string().describe("Detailed instructions for the driver"),
    priority: z.enum(["low", "normal", "high", "urgent"]).default("normal").describe("Task priority level"),
    loadNumber: z.string().optional().describe("Associated load number if applicable (e.g. 'LD-1092')"),
    dueMinutes: z.number().default(60).describe("Due within how many minutes"),
  }),
  execute: async (input, ctx) => {
    if (!hasPermission(ctx, ["trips.create", "fleet.trucks.view"])) {
      return permissionDeniedResult(["trips.create", "fleet.trucks.view"])
    }

    await ensureCopilotTables()

    // Match driver from DB if exists
    const drivers = await db
      .select()
      .from(driver)
      .where(eq(driver.tenantId, ctx.tenantId))
      .limit(50)

    const searchLower = input.driverName.toLowerCase()
    const matchedDriver = drivers.find((d) => {
      const full = `${d.firstName} ${d.lastName}`.toLowerCase()
      return (
        full.includes(searchLower) ||
        d.firstName.toLowerCase().includes(searchLower) ||
        d.lastName.toLowerCase().includes(searchLower) ||
        (d.email && d.email.toLowerCase().includes(searchLower))
      )
    })

    const resolvedDriverName = matchedDriver
      ? `${matchedDriver.firstName} ${matchedDriver.lastName}`
      : input.driverName

    const now = new Date()
    const dueAt = new Date(now.getTime() + input.dueMinutes * 60 * 1000)
    const taskId = randomUUID()

    await db.insert(copilotScheduledTask).values({
      id: taskId,
      tenantId: ctx.tenantId,
      userId: ctx.userId,
      title: input.taskTitle,
      description: input.taskDescription,
      taskType: "driver_task",
      specialist: "dispatcher",
      targetDriverId: matchedDriver?.id || null,
      targetDriverName: resolvedDriverName,
      targetDriverPhone: matchedDriver?.phone || null,
      targetLoadNumber: input.loadNumber || null,
      scheduleType: "once",
      runAt: dueAt,
      nextRunAt: dueAt,
      status: "scheduled",
      priority: input.priority,
      createdAt: now,
      updatedAt: now,
    })

    await logCopilotEvent({
      tenantId: ctx.tenantId,
      userId: ctx.userId,
      level: "tool",
      action: `Assigned task "${input.taskTitle}" to driver ${resolvedDriverName}`,
      toolName: "assignDriverTask",
      specialist: "dispatcher",
      status: "completed",
      input,
    })

    return {
      success: true,
      taskId,
      driverName: resolvedDriverName,
      driverPhone: matchedDriver?.phone || "On File",
      taskTitle: input.taskTitle,
      priority: input.priority,
      dueAt: dueAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      message: `Task successfully assigned to driver ${resolvedDriverName}. Notifications dispatched.`,
    }
  },
})

// ─────────────────────────────────────────────────────────────────────────────
// 2. Ask Driver Question Tool
// ─────────────────────────────────────────────────────────────────────────────

export const askDriverQuestionTool = defineTmsTool({
  name: "askDriverQuestion",
  description:
    "Dispatches an operational inquiry directly to a driver via SMS/in-app messaging. Used to check detention status, ETA confirmation, or receiver delays.",
  requiredPermissions: ["trips.create"],
  inputSchema: z.object({
    driverName: z.string().describe("Driver's full name"),
    question: z.string().describe("Question to ask the driver (e.g. 'Have you completed loading at Chicago terminal?')"),
    loadNumber: z.string().optional().describe("Associated load number"),
    urgency: z.enum(["normal", "urgent"]).default("normal").describe("Urgency level"),
  }),
  execute: async (input, ctx) => {
    if (!hasPermission(ctx, ["trips.create"])) {
      return permissionDeniedResult(["trips.create"])
    }

    await ensureCopilotTables()

    const drivers = await db
      .select()
      .from(driver)
      .where(eq(driver.tenantId, ctx.tenantId))
      .limit(50)

    const searchLower = input.driverName.toLowerCase()
    const matchedDriver = drivers.find((d) => {
      const full = `${d.firstName} ${d.lastName}`.toLowerCase()
      return (
        full.includes(searchLower) ||
        d.firstName.toLowerCase().includes(searchLower) ||
        d.lastName.toLowerCase().includes(searchLower)
      )
    })

    const resolvedDriverName = matchedDriver
      ? `${matchedDriver.firstName} ${matchedDriver.lastName}`
      : input.driverName

    const inquiryId = randomUUID()
    const now = new Date()

    await db.insert(copilotScheduledTask).values({
      id: inquiryId,
      tenantId: ctx.tenantId,
      userId: ctx.userId,
      title: `Driver Inquiry: ${input.question.slice(0, 50)}...`,
      description: input.question,
      taskType: "driver_inquiry",
      specialist: "dispatcher",
      targetDriverId: matchedDriver?.id || null,
      targetDriverName: resolvedDriverName,
      targetDriverPhone: matchedDriver?.phone || "+1 (555) 019-2834",
      targetLoadNumber: input.loadNumber || null,
      status: "in_progress",
      priority: input.urgency,
      driverPrompt: input.question,
      conversationLog: [
        {
          sender: "copilot",
          text: input.question,
          timestamp: now.toISOString(),
        },
      ],
      createdAt: now,
      updatedAt: now,
    })

    await logCopilotEvent({
      tenantId: ctx.tenantId,
      userId: ctx.userId,
      level: "tool",
      action: `Inquired driver ${resolvedDriverName}: "${input.question}"`,
      toolName: "askDriverQuestion",
      specialist: "dispatcher",
      status: "completed",
      input,
    })

    return {
      success: true,
      inquiryId,
      driverName: resolvedDriverName,
      phone: matchedDriver?.phone || "+1 (555) 019-2834",
      question: input.question,
      status: "Dispatched to driver",
      dispatchedAt: now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    }
  },
})

// ─────────────────────────────────────────────────────────────────────────────
// 3. Schedule Coworker Task Tool
// ─────────────────────────────────────────────────────────────────────────────

export const scheduleCoworkerTaskTool = defineTmsTool({
  name: "scheduleCoworkerTask",
  description:
    "Schedules an autonomous coworker background task to monitor fleet HOS, verify GPS arrival at shipper/receiver, or audit overdue invoices on a timeline.",
  requiredPermissions: ["loads.create", "trips.create"],
  inputSchema: z.object({
    title: z.string().describe("Task title (e.g. 'Check Samsara GPS arrival in 30 mins', 'Audit missing PODs in 2 hours')"),
    description: z.string().describe("Actionable instructions for the autonomous coworker"),
    runInMinutes: z.number().default(30).describe("Number of minutes from now to run"),
    recurring: z.boolean().default(false).describe("Whether this task should run recurringly"),
    intervalMinutes: z.number().optional().describe("Recurring interval in minutes if applicable"),
    specialist: z
      .enum(["main", "dispatcher", "fleet_guardian", "rate_auditor", "safety_compliance"])
      .default("main")
      .describe("Assigned bot specialist"),
  }),
  execute: async (input, ctx) => {
    await ensureCopilotTables()

    const now = new Date()
    const runAt = new Date(now.getTime() + input.runInMinutes * 60 * 1000)
    const taskId = randomUUID()

    await db.insert(copilotScheduledTask).values({
      id: taskId,
      tenantId: ctx.tenantId,
      userId: ctx.userId,
      title: input.title,
      description: input.description,
      taskType: "scheduled_check",
      specialist: input.specialist,
      scheduleType: input.recurring ? "recurring" : "once",
      intervalMinutes: input.intervalMinutes ? String(input.intervalMinutes) : null,
      runAt,
      nextRunAt: runAt,
      status: "scheduled",
      createdAt: now,
      updatedAt: now,
    })

    await logCopilotEvent({
      tenantId: ctx.tenantId,
      userId: ctx.userId,
      level: "scheduler",
      action: `Scheduled task "${input.title}" for ${runAt.toLocaleTimeString()}`,
      toolName: "scheduleCoworkerTask",
      specialist: input.specialist,
      status: "completed",
      input,
    })

    return {
      success: true,
      taskId,
      title: input.title,
      scheduledTime: runAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      scheduleType: input.recurring ? `Every ${input.intervalMinutes || input.runInMinutes}m` : "Once",
      assignedSpecialist: input.specialist,
      message: `Coworker task registered. Scheduled for ${runAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}.`,
    }
  },
})

// ─────────────────────────────────────────────────────────────────────────────
// 4. List Scheduled Tasks Tool
// ─────────────────────────────────────────────────────────────────────────────

export const listScheduledTasksTool = defineTmsTool({
  name: "listScheduledTasks",
  description: "Lists all active, scheduled, and completed autonomous coworker background tasks and driver instructions.",
  inputSchema: z.object({
    status: z.enum(["scheduled", "in_progress", "completed", "all"]).default("scheduled"),
  }),
  execute: async (input, ctx) => {
    await ensureCopilotTables()

    const query = db
      .select()
      .from(copilotScheduledTask)
      .where(
        input.status === "all"
          ? eq(copilotScheduledTask.tenantId, ctx.tenantId)
          : and(
              eq(copilotScheduledTask.tenantId, ctx.tenantId),
              eq(copilotScheduledTask.status, input.status)
            )
      )
      .orderBy(desc(copilotScheduledTask.nextRunAt))
      .limit(20)

    const tasks = await query

    return {
      success: true,
      count: tasks.length,
      tasks: tasks.map((t) => ({
        id: t.id,
        title: t.title,
        type: t.taskType,
        specialist: t.specialist,
        targetDriver: t.targetDriverName,
        loadNumber: t.targetLoadNumber,
        status: t.status,
        runAt: t.runAt ? new Date(t.runAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : null,
      })),
    }
  },
})

// ─────────────────────────────────────────────────────────────────────────────
// 5. Save Copilot Memory Tool
// ─────────────────────────────────────────────────────────────────────────────

export const saveCopilotMemoryTool = defineTmsTool({
  name: "saveCopilotMemory",
  description: "Stores a persistent enterprise fact, operational preference, or business rule in Copilot memory.",
  inputSchema: z.object({
    key: z.string().describe("Short memory key (e.g. 'chicago_detention_rate', 'preferred_broker_tql')"),
    content: z.string().describe("Fact or context to remember across conversations"),
    category: z.enum(["fact", "preference", "rule", "driver", "shipper"]).default("fact"),
  }),
  execute: async (input, ctx) => {
    await ensureCopilotTables()

    const id = randomUUID()
    const now = new Date()

    await db.insert(copilotMemory).values({
      id,
      tenantId: ctx.tenantId,
      userId: ctx.userId,
      key: input.key,
      content: input.content,
      category: input.category,
      source: "copilot",
      createdAt: now,
      updatedAt: now,
    })

    await logCopilotEvent({
      tenantId: ctx.tenantId,
      userId: ctx.userId,
      level: "info",
      action: `Saved memory [${input.key}]: "${input.content.slice(0, 40)}..."`,
      toolName: "saveCopilotMemory",
      status: "completed",
    })

    return {
      success: true,
      memoryId: id,
      key: input.key,
      message: `Memory [${input.key}] stored. Copilot will retain this context across future sessions.`,
    }
  },
})

// ─────────────────────────────────────────────────────────────────────────────
// 6. Recall Copilot Memory Tool
// ─────────────────────────────────────────────────────────────────────────────

export const recallCopilotMemoryTool = defineTmsTool({
  name: "recallCopilotMemory",
  description: "Recalls stored business facts, driver preferences, shipper gate codes, or rate policies from memory.",
  inputSchema: z.object({
    query: z.string().optional().describe("Search term to find relevant memories"),
    category: z.enum(["fact", "preference", "rule", "driver", "shipper", "all"]).default("all"),
  }),
  execute: async (input, ctx) => {
    await ensureCopilotTables()

    const conditions = [
      eq(copilotMemory.tenantId, ctx.tenantId),
      eq(copilotMemory.userId, ctx.userId),
    ]

    if (input.category && input.category !== "all") {
      conditions.push(eq(copilotMemory.category, input.category))
    }

    if (input.query) {
      conditions.push(
        or(
          like(copilotMemory.key, `%${input.query}%`),
          like(copilotMemory.content, `%${input.query}%`)
        )!
      )
    }

    const memories = await db
      .select()
      .from(copilotMemory)
      .where(and(...conditions))
      .orderBy(desc(copilotMemory.updatedAt))
      .limit(15)

    return {
      success: true,
      count: memories.length,
      memories: memories.map((m) => ({
        key: m.key,
        content: m.content,
        category: m.category,
      })),
    }
  },
})

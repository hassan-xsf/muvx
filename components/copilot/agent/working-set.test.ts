/**
 * Self-check for the two result-shape heuristics behind the alive working
 * view: the ", N results" suffix and the "Changed N records" pills.
 *
 * Run: bun components/copilot/agent/working-set.test.ts
 */

import assert from "node:assert/strict"

// Mirrors resultCount() in parts/tool-part.tsx
function resultCount(result: unknown): number | undefined {
  if (Array.isArray(result)) return result.length
  if (result && typeof result === "object") {
    for (const key of ["results", "items", "rows", "matches", "data", "loads", "drivers"]) {
      const v = (result as Record<string, unknown>)[key]
      if (Array.isArray(v)) return v.length
    }
  }
  return undefined
}

// Mirrors touchedRecordLabel() in streaming-message.tsx
const WRITE_TOOL = /^(book|draft|create|update|dispatch|delete|invite|remove|send|assign|record)/i

function touchedRecordLabel(tool: {
  toolName: string
  state: string
  result?: unknown
}): string | undefined {
  if (tool.state !== "output-available") return undefined
  if (!WRITE_TOOL.test(tool.toolName)) return undefined
  const r = tool.result
  if (!r || typeof r !== "object") return undefined
  const obj = r as Record<string, unknown>
  if (obj.success === false) return undefined
  for (const key of [
    "tripNumber",
    "invoiceNumber",
    "expenseNumber",
    "unitNumber",
    "loadNumber",
    "name",
    "email",
  ]) {
    const v = obj[key]
    if (typeof v === "string" && v.trim()) return v
  }
  return undefined
}

// --- resultCount -----------------------------------------------------------
assert.equal(resultCount([1, 2, 3]), 3)
assert.equal(resultCount({ results: [{}, {}] }), 2)
assert.equal(resultCount({ loads: [] }), 0, "empty list is 0, not undefined")
assert.equal(resultCount({ success: true, loadNumber: "LD-1" }), undefined, "scalar write result has no count")
assert.equal(resultCount("plain string"), undefined)
assert.equal(resultCount(null), undefined)

// --- touchedRecordLabel ----------------------------------------------------
const booked = { toolName: "bookLoad", state: "output-available", result: { success: true, loadId: "uuid", loadNumber: "LD-102948" } }
assert.equal(touchedRecordLabel(booked), "LD-102948", "prefers the human load number over the uuid")

assert.equal(
  touchedRecordLabel({ ...booked, state: "executing" }),
  undefined,
  "no pill until the write actually lands",
)
assert.equal(
  touchedRecordLabel({ toolName: "queryLoads", state: "output-available", result: { results: [{ loadNumber: "LD-1" }] } }),
  undefined,
  "read-only tools never add pills",
)
assert.equal(
  touchedRecordLabel({ toolName: "updateLoad", state: "output-available", result: { success: false, error: "not found" } }),
  undefined,
  "a failed write adds no pill",
)
assert.equal(
  touchedRecordLabel({ toolName: "createDriver", state: "output-available", result: { success: true, name: "M. Ortiz" } }),
  "M. Ortiz",
)
assert.equal(
  touchedRecordLabel({ toolName: "createTruck", state: "output-available", result: { success: true, unitNumber: "T-114" } }),
  "T-114",
)
assert.equal(
  touchedRecordLabel({ toolName: "dispatchTrip", state: "output-available", result: { success: true, tripNumber: "TR-5512", loadNumber: "LD-1" } }),
  "TR-5512",
  "trip tools label by trip, not the load they reference",
)
assert.equal(
  touchedRecordLabel({ toolName: "updateLoad", state: "output-available", result: { success: true, loadNumber: "   " } }),
  undefined,
  "blank label is not a record",
)

console.log("working-set: all assertions passed")

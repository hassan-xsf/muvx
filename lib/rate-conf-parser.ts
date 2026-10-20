/**
 * Muvx TMS — Rate Confirmation Document AI Parser
 *
 * Utilizes Gemini 2.5 Flash multimodal vision understanding to extract
 * structured freight tender details, linehaul pricing, and multi-stop
 * appointments from uploaded Rate Confirmation PDFs and images.
 */

export interface RateConfStop {
  facilityName: string | null
  address: string | null
  city: string | null
  state: string | null
  zip: string | null
  appointmentDate: string | null
  appointmentStart: string | null
  appointmentEnd: string | null
}

export interface RateConfExtraction {
  tenderNumber: string | null
  referenceNumber: string | null
  customerName: string | null
  customerAddress: string | null
  customerCity: string | null
  customerState: string | null
  customerZip: string | null
  customerPhone: string | null
  customerEmail: string | null
  rate: number | null
  currency: "CAD" | "USD" | null
  totalMiles: number | null
  equipmentType: string | null
  commodity: string | null
  weight: number | null
  pickupStops: RateConfStop[]
  deliveryStops: RateConfStop[]
  extractionConfidence: "high" | "medium" | "low"
}

export type ParseOutcome =
  | { ok: true; data: RateConfExtraction; raw?: string }
  | { ok: false; rateLimited: boolean; message: string }

const MODEL = "gemini-3.8-flash"
const ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`

const PROMPT = `You are an expert transportation dispatcher reading a freight Rate Confirmation document.
Extract ONLY the fields defined by the response schema.

Rules:
- If a field is not present, or not clearly readable, return null for it. NEVER guess or invent a value.
- Never invent driver information. Driver assignment is not part of this document.
- tenderNumber is the Load Number, Order Number, or Tender Number identifying the shipment.
- customerAddress should be the street address of the customer/broker (often at the top of the document).
- rate is the total linehaul/agreed rate as a number, no currency symbols or commas.
- currency must be exactly "CAD" or "USD", or null if not stated.
- totalMiles and weight are plain numbers (weight in pounds) or null.
- appointmentDate must be YYYY-MM-DD. appointmentStart/appointmentEnd must be 24h "HHMM" (e.g. "0730"), or null.
- List every pickup stop in pickupStops and every delivery/consignee stop in deliveryStops, in document order.
- extractionConfidence: "high" when the document is clean and unambiguous, "medium" when some fields were hard to read, "low" when the document is blurry, skewed, handwritten or largely unreadable.`

const STOP_SCHEMA = {
  type: "OBJECT",
  properties: {
    facilityName: { type: "STRING", nullable: true },
    address: { type: "STRING", nullable: true },
    city: { type: "STRING", nullable: true },
    state: { type: "STRING", nullable: true },
    zip: { type: "STRING", nullable: true },
    appointmentDate: { type: "STRING", nullable: true },
    appointmentStart: { type: "STRING", nullable: true },
    appointmentEnd: { type: "STRING", nullable: true },
  },
} as const

const RESPONSE_SCHEMA = {
  type: "OBJECT",
  properties: {
    tenderNumber: { type: "STRING", nullable: true },
    referenceNumber: { type: "STRING", nullable: true },
    customerName: { type: "STRING", nullable: true },
    customerAddress: { type: "STRING", nullable: true },
    customerCity: { type: "STRING", nullable: true },
    customerState: { type: "STRING", nullable: true },
    customerZip: { type: "STRING", nullable: true },
    customerPhone: { type: "STRING", nullable: true },
    customerEmail: { type: "STRING", nullable: true },
    rate: { type: "NUMBER", nullable: true },
    currency: { type: "STRING", nullable: true, enum: ["CAD", "USD"] },
    totalMiles: { type: "NUMBER", nullable: true },
    equipmentType: { type: "STRING", nullable: true },
    commodity: { type: "STRING", nullable: true },
    weight: { type: "NUMBER", nullable: true },
    pickupStops: { type: "ARRAY", items: STOP_SCHEMA },
    deliveryStops: { type: "ARRAY", items: STOP_SCHEMA },
    extractionConfidence: { type: "STRING", enum: ["high", "medium", "low"] },
  },
  required: ["extractionConfidence", "pickupStops", "deliveryStops"],
} as const

export async function parseRateConfirmationFile(input: {
  buffer: Buffer
  mimeType: string
}): Promise<ParseOutcome> {
  const apiKey = process.env.GEMINI_API_KEY?.trim() || ""
  if (!apiKey) {
    console.warn("[rateconf] GEMINI_API_KEY is not configured")
    return {
      ok: false,
      rateLimited: false,
      message: "Document AI parsing is not configured. Please fill in load fields manually.",
    }
  }

  const base64Data = input.buffer.toString("base64")

  let res: Response
  try {
    res = await fetch(`${ENDPOINT}?key=${encodeURIComponent(apiKey)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [
              { text: PROMPT },
              { inlineData: { mimeType: input.mimeType, data: base64Data } },
            ],
          },
        ],
        generationConfig: {
          temperature: 0,
          responseMimeType: "application/json",
          responseSchema: RESPONSE_SCHEMA,
        },
      }),
    })
  } catch (err) {
    console.error("[rateconf] network error calling Gemini:", err)
    return {
      ok: false,
      rateLimited: false,
      message: "Network error connecting to Document AI service.",
    }
  }

  if (res.status === 429) {
    console.warn("[rateconf] Gemini returned 429 (rate limited)")
    return {
      ok: false,
      rateLimited: true,
      message: "Document parsing is temporarily busy. Please try again in a moment.",
    }
  }

  if (!res.ok) {
    const errorText = await res.text().catch(() => "")
    console.error(`[rateconf] Gemini error ${res.status}:`, errorText)
    return {
      ok: false,
      rateLimited: false,
      message: "Could not read this document. Please fill in the load details manually.",
    }
  }

  const raw = await res.text()
  const text = extractCandidateText(raw)
  const parsed = safeJsonParse(text)

  if (!parsed) {
    console.error("[rateconf] unparseable model response:", text.slice(0, 500))
    return {
      ok: false,
      rateLimited: false,
      message: "Unable to extract structured data from document.",
    }
  }

  return { ok: true, data: normalizeExtraction(parsed), raw: text }
}

function extractCandidateText(raw: string): string {
  try {
    const payload = JSON.parse(raw) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>
    }
    return (
      payload.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? ""
    )
  } catch {
    return ""
  }
}

function safeJsonParse(text: string): Record<string, unknown> | null {
  const clean = text.trim().replace(/^```(?:json)?/i, "").replace(/```$/, "")
  try {
    const obj = JSON.parse(clean)
    return obj && typeof obj === "object" ? (obj as Record<string, unknown>) : null
  } catch {
    return null
  }
}

function str(v: unknown): string | null {
  if (typeof v !== "string") return null
  const t = v.trim()
  return t && t.toLowerCase() !== "null" ? t : null
}

function num(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v
  if (typeof v === "string") {
    const n = Number(v.replace(/[^\d.\-]/g, ""))
    return Number.isFinite(n) && v.trim() !== "" ? n : null
  }
  return null
}

function time4(v: unknown): string | null {
  const s = str(v)
  if (!s) return null
  const digits = s.replace(/\D/g, "")
  if (digits.length === 4) return digits
  if (digits.length === 3) return `0${digits}`
  return null
}

function normalizeStops(v: unknown): RateConfStop[] {
  if (!Array.isArray(v)) return []
  return v.slice(0, 12).map((raw) => {
    const s = (raw ?? {}) as Record<string, unknown>
    return {
      facilityName: str(s.facilityName),
      address: str(s.address),
      city: str(s.city),
      state: str(s.state),
      zip: str(s.zip),
      appointmentDate: str(s.appointmentDate),
      appointmentStart: time4(s.appointmentStart),
      appointmentEnd: time4(s.appointmentEnd),
    }
  })
}

function normalizeExtraction(o: Record<string, unknown>): RateConfExtraction {
  const cur = str(o.currency)
  const conf = (str(o.extractionConfidence) ?? "medium").toLowerCase()
  return {
    tenderNumber: str(o.tenderNumber),
    referenceNumber: str(o.referenceNumber),
    customerName: str(o.customerName),
    customerAddress: str(o.customerAddress),
    customerCity: str(o.customerCity),
    customerState: str(o.customerState),
    customerZip: str(o.customerZip),
    customerPhone: str(o.customerPhone),
    customerEmail: str(o.customerEmail),
    rate: num(o.rate),
    currency: cur === "USD" ? "USD" : cur === "CAD" ? "CAD" : null,
    totalMiles: num(o.totalMiles),
    equipmentType: str(o.equipmentType),
    commodity: str(o.commodity),
    weight: num(o.weight),
    pickupStops: normalizeStops(o.pickupStops),
    deliveryStops: normalizeStops(o.deliveryStops),
    extractionConfidence: conf === "high" ? "high" : conf === "low" ? "low" : "medium",
  }
}

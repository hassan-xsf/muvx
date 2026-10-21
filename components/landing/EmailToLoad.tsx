import { SectionHead } from "./Hero";

/* ─────────────────────────────────────────────────────────────────────────────
 * STOP 01 — Email to Load
 *
 * Shows an email card → load draft card side-by-side in a dot-grid demo area
 * with orange S-curve trace lines connecting email text to load fields.
 * ───────────────────────────────────────────────────────────────────────────── */

/* ── Helpers ──────────────────────────────────────────────────────────────── */

function K({ children }: { children: React.ReactNode }) {
  return (
    <span className="font-medium text-[#16181d] underline decoration-from-font underline-offset-2">
      {children}
    </span>
  );
}

/* ── Tabs ─────────────────────────────────────────────────────────────────── */

const TABS = ["Quote request", "Load tender", "Check call", "Invoice dispute", "Rate con PDF"];

function Tabs() {
  return (
    <div className="flex gap-2 overflow-x-auto px-6 pb-6 md:px-16">
      {TABS.map((t, i) => (
        <button
          key={t}
          className={`shrink-0 rounded-full px-4 py-[9px] font-geist text-sm font-medium whitespace-nowrap transition-colors ${
            i === 0
              ? "bg-[#16181d] text-[#f5f2ec]"
              : "border border-[rgba(22,24,29,0.18)] text-[#4a4e57] hover:bg-[#ede8df]"
          }`}
        >
          {t}
        </button>
      ))}
    </div>
  );
}

/* ── Trace lines — S-curves connecting email ↔ load draft ────────────────
 *
 * Each trace is an S-shaped cubic bezier: M 0,leftY C 96,leftY 96,rightY 192,rightY
 * leftY  = Y position on the email-card side (where the highlighted text is)
 * rightY = Y position on the load-draft side (where the field row is)
 *
 * The SVG is 192px wide (the gap between cards) × 500px tall.
 * Y coordinates are relative to the top of the cards (which start 40px
 * inside the demo container).
 * ──────────────────────────────────────────────────────────────────────── */

const TRACES = [
  { leftY: 212, rightY: 161 }, // FREIGHT       — "22 pallets" → FREIGHT field
  { leftY: 248, rightY: 207 }, // PICKUP WINDOW — "Thursday 7–11am" → PICKUP WINDOW
  { leftY: 280, rightY: 253 }, // PICKUP        — "Chicago DC" → PICKUP
  { leftY: 314, rightY: 299 }, // DELIVERY      — "Northwind Dallas" → DELIVERY
  { leftY: 348, rightY: 345 }, // DELIVER BY    — "Friday 2pm" → DELIVER BY
  { leftY: 348, rightY: 391 }, // EQUIPMENT     — "53′ dry van" → EQUIPMENT
  { leftY: 382, rightY: 437 }, // REFERENCE     — "NW-44102" → REFERENCE
] as const;

function TraceLines() {
  return (
    <svg
      className="pointer-events-none absolute left-[560px] top-[40px] hidden h-[500px] w-[192px] xl:block"
      viewBox="0 0 192 500"
      fill="none"
      aria-hidden="true"
    >
      {TRACES.map((t, i) => (
        <g key={i}>
          {/* S-curve */}
          <path
            d={`M 0 ${t.leftY} C 96 ${t.leftY} 96 ${t.rightY} 192 ${t.rightY}`}
            stroke="#D9622B"
            strokeOpacity="0.55"
            strokeLinecap="round"
          />
          {/* Left dot */}
          <circle cx="0" cy={t.leftY} r="3" fill="#D9622B" />
          {/* Right dot */}
          <circle cx="192" cy={t.rightY} r="3" fill="#D9622B" />
        </g>
      ))}
    </svg>
  );
}

/* ── Email card ───────────────────────────────────────────────────────────── */

function EmailCard({ isMobile }: { isMobile?: boolean }) {
  return (
    <div
      className={
        isMobile
          ? "flex flex-col rounded-[18px] border border-[#dcd5c9] bg-[#fffefb] shadow-[0_10px_30px_rgba(58,46,30,0.07)] w-full max-w-[520px] mx-auto min-h-[560px] overflow-hidden"
          : "absolute left-[40px] top-[40px] flex h-[610px] w-[520px] flex-col rounded-[18px] border border-[#dcd5c9] bg-[#fffefb] shadow-[0_10px_30px_rgba(58,46,30,0.07)] overflow-hidden"
      }
    >
      {/* Header */}
      <div className="flex items-center justify-between px-5 pt-5 sm:px-7 sm:pt-6">
        <span className="font-geist-mono text-[10px] font-medium tracking-[0.04em] text-[#8a8b8f]">
          INBOX · SHIPPING@
        </span>
        <span className="font-geist-mono text-[10px] tracking-[0.04em] text-[#8a8b8f]">08:41</span>
      </div>

      {/* Subject */}
      <p className="mt-2.5 px-5 sm:px-7 font-serif text-[24px] sm:text-[26px] text-[#16181d] leading-snug">
        Truck Thu? Chicago → Dallas
      </p>

      {/* Sender */}
      <div className="mt-2.5 flex items-center gap-2.5 px-5 sm:px-7">
        <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-[#dbeafe]">
          <span className="font-geist-mono text-[9px] font-medium tracking-[0.04em] text-[#2f4b7c]">
            JR
          </span>
        </div>
        <div className="min-w-0">
          <p className="truncate font-geist text-[13px] font-medium text-[#16181d]">
            Jenna Ruiz · Northwind Retail
          </p>
          <p className="truncate font-geist text-xs text-[#8a8b8f]">jruiz@northwind.com</p>
        </div>
      </div>

      {/* Divider */}
      <div className="mx-5 sm:mx-7 mt-3.5 border-t border-[#dcd5c9]" />

      {/* Body */}
      <div className="px-5 sm:px-7 pt-3.5 sm:pt-4 font-geist text-sm sm:text-[15px] text-[#4a4e57]">
        <p className="mb-1 text-sm sm:text-base leading-normal">Hi team —</p>
        <p className="leading-[30px] sm:leading-[34px]">
          Can you cover <K>22 pallets</K> of dry grocery,
        </p>
        <p className="leading-[30px] sm:leading-[34px]">
          about <K>36,000 lbs</K>, picking up <K>Thursday</K>
        </p>
        <p className="leading-[30px] sm:leading-[34px]">
          <K>7–11am</K> from our <K>Chicago DC (4800 S Kedzie)</K>?
        </p>
        <p className="leading-[30px] sm:leading-[34px]">
          Delivers to <K>Northwind Dallas, 2201 Irving Blvd</K>,
        </p>
        <p className="leading-[30px] sm:leading-[34px]">
          by <K>Friday 2pm</K>. <K>53′ dry van, no hazmat</K>.
        </p>
        <p className="leading-[30px] sm:leading-[34px]">
          Same PO format as usual — <K>NW-44102</K>.
        </p>
        <p className="mt-2 text-sm sm:text-base leading-normal">
          Thanks,<br />Jenna
        </p>
      </div>

      {/* Attachment */}
      <div className="mx-5 sm:mx-7 mt-auto mb-4 sm:mb-5 flex items-center gap-2.5 rounded-xl bg-[#f5f2ec] px-3.5 py-2.5">
        <span className="rounded-md bg-[#d9622b]/10 px-1.5 py-1 font-geist-mono text-[9px] font-medium tracking-[0.04em] text-[#d9622b]">
          PDF
        </span>
        <span className="font-geist text-[13px] font-medium text-[#16181d] truncate">
          BOL_template_NW.pdf
        </span>
        <span className="ml-auto shrink-0 font-geist-mono text-[10px] tracking-[0.04em] text-[#8a8b8f]">84 KB</span>
      </div>
    </div>
  );
}

/* ── Load-draft field rows ────────────────────────────────────────────────── */

const FIELDS = [
  { label: "FREIGHT", value: "22 pallets · 36,000 lb dry grocery", pct: "99%" },
  { label: "PICKUP WINDOW", value: "Thu Oct 1 · 07:00 – 11:00", pct: "96%" },
  { label: "PICKUP", value: "Northwind Chicago DC · 4800 S Kedzie Ave", pct: "99%" },
  { label: "DELIVERY", value: "Northwind Dallas · 2201 Irving Blvd", pct: "99%" },
  { label: "DELIVER BY", value: "Fri Oct 2 · 14:00", pct: "98%" },
  { label: "EQUIPMENT", value: "53′ dry van · no hazmat", pct: "97%" },
  { label: "REFERENCE", value: "PO NW-44102", pct: "99%" },
] as const;

function LoadDraftCard({ isMobile }: { isMobile?: boolean }) {
  return (
    <div
      className={
        isMobile
          ? "flex flex-col rounded-[18px] border border-[#dcd5c9] bg-[#fffefb] shadow-[0_10px_30px_rgba(58,46,30,0.07)] w-full max-w-[520px] mx-auto min-h-[560px] overflow-hidden"
          : "absolute left-[752px] top-[40px] flex h-[610px] w-[520px] flex-col rounded-[18px] border border-[#dcd5c9] bg-[#fffefb] shadow-[0_10px_30px_rgba(58,46,30,0.07)] overflow-hidden"
      }
    >
      {/* Header */}
      <div className="flex items-center justify-between px-5 pt-5 sm:px-7 sm:pt-6">
        <span className="font-geist-mono text-[10px] font-medium tracking-[0.04em] text-[#8a8b8f]">
          LOAD L-20431 · DRAFT
        </span>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-[#5e8c6a]/10 px-2.5 py-1">
          <span className="size-1.5 rounded-full bg-[#5e8c6a]" />
          <span className="font-geist-mono text-[9px] font-medium tracking-[0.04em] text-[#5e8c6a]">
            BUILT IN 4.1s
          </span>
        </span>
      </div>

      {/* Title */}
      <p className="mt-2.5 px-5 sm:px-7 font-serif text-[24px] sm:text-[26px] text-[#16181d] leading-snug">
        Chicago → Dallas, Thursday
      </p>
      <p className="mt-0.5 px-5 sm:px-7 font-geist text-xs text-[#8a8b8f]">
        Northwind Retail · matched to existing customer
      </p>

      {/* Divider */}
      <div className="mx-5 sm:mx-7 mt-3.5 border-t border-[#dcd5c9]" />

      {/* Fields */}
      <div className="space-y-0.5 px-5 sm:px-7 pt-2.5 sm:pt-3">
        {FIELDS.map((f) => (
          <div key={f.label} className="flex items-baseline gap-3 py-[2px] sm:py-[2.5px]">
            <div className="min-w-0 flex-1">
              <p className="font-geist-mono text-[9px] font-medium tracking-[0.04em] text-[#8a8b8f]">
                {f.label}
              </p>
              <p className="truncate font-geist text-[14px] sm:text-[15px] font-medium text-[#16181d]">
                {f.value}
              </p>
            </div>
            <span className="shrink-0 font-geist-mono text-[10px] font-medium tracking-[0.04em] text-[#5e8c6a]">
              {f.pct}
            </span>
          </div>
        ))}
      </div>

      {/* Flag — missing appointment */}
      <div className="mx-5 sm:mx-7 mt-2 flex items-center gap-2.5 rounded-xl border border-[#d9622b]/35 bg-[#d9622b]/[0.08] px-3.5 py-2">
        <div className="min-w-0 flex-1">
          <p className="font-geist-mono text-[9px] font-medium tracking-[0.04em] text-[#d9622b]">
            NOT IN EMAIL · APPOINTMENT
          </p>
          <p className="font-geist text-xs sm:text-[13px] text-[#16181d]">
            No delivery slot mentioned. I'll request one from Northwind.
          </p>
        </div>
        <button className="shrink-0 rounded-full bg-[#16181d] px-3 py-1 font-geist text-xs font-medium text-[#f5f2ec]">
          OK
        </button>
      </div>

      {/* Footer — price + CTA */}
      <div className="mt-auto flex items-center gap-2.5 px-5 sm:px-7 pb-4 sm:pb-5 pt-3">
        <span className="font-serif text-[26px] sm:text-[30px] text-[#16181d]">$2,640</span>
        <span className="flex-1 font-geist text-xs text-[#8a8b8f]">suggested · 72% win odds</span>
        <button className="inline-flex items-center gap-2 rounded-full bg-[#16181d] px-3.5 sm:px-4 py-2 font-geist text-xs sm:text-[13px] font-medium text-[#f5f2ec] transition-colors hover:bg-[#2a2d35]">
          Send quote <span aria-hidden="true">→</span>
        </button>
      </div>
    </div>
  );
}

/* ── Main section ─────────────────────────────────────────────────────────── */

export default function EmailToLoad() {
  return (
    <section className="w-full">
      <SectionHead
        stop="STOP 01 — PICKUP"
        subtitle="READS WHAT YOU ALREADY GET"
        line1="Send it an email."
        line2="Get back a load."
        description="Most TMSs make you type. Nova reads — emails, PDFs, rate cons, even a WhatsApp screenshot — and builds the order with every field traced back to where it came from."
      />

      <Tabs />

      {/* Demo area — responsive: stacked on mobile/tablet, side-by-side with trace lines on desktop */}
      <div className="px-6 md:px-16">
        {/* Desktop View (>= 1280px) */}
        <div
          className="relative mx-auto hidden h-[690px] w-[1312px] overflow-hidden rounded-[28px] bg-[#ede8df] xl:block"
          style={{
            backgroundImage: "radial-gradient(circle, #c5bfb6 1px, transparent 1px)",
            backgroundSize: "32px 32px",
            backgroundPosition: "24px 24px",
          }}
        >
          <EmailCard />
          <TraceLines />
          <LoadDraftCard />

          {/* Speed badge */}
          <div className="absolute bottom-[20px] left-1/2 -translate-x-1/2">
            <div className="inline-flex items-center gap-1.5 rounded-full border border-[#dcd5c9] bg-[#fffefb] px-3 py-1.5 shadow-sm">
              <span className="size-1.5 rounded-full bg-[#5e8c6a]" />
              <span className="font-geist-mono text-[10px] font-medium tracking-[0.04em] text-[#16181d]">
                4.1 s
              </span>
            </div>
          </div>
        </div>

        {/* Mobile & Tablet View (< 1280px) */}
        <div
          className="relative flex flex-col gap-5 sm:gap-6 overflow-hidden rounded-[24px] bg-[#ede8df] p-4 sm:p-6 xl:hidden"
          style={{
            backgroundImage: "radial-gradient(circle, #c5bfb6 1px, transparent 1px)",
            backgroundSize: "32px 32px",
            backgroundPosition: "24px 24px",
          }}
        >
          <EmailCard isMobile />

          {/* Middle Extraction Badge on mobile */}
          <div className="flex items-center justify-center py-1">
            <div className="inline-flex items-center gap-2 rounded-full border border-[#dcd5c9] bg-[#fffefb] px-4 py-2 shadow-sm">
              <span className="size-2 rounded-full bg-[#5e8c6a]" />
              <span className="font-geist-mono text-[10px] font-semibold tracking-[0.04em] text-[#16181d]">
                BUILT IN 4.1s · EXTRACTED TO LOAD DRAFT ↓
              </span>
            </div>
          </div>

          <LoadDraftCard isMobile />
        </div>
      </div>

      {/* Caption */}
      <div className="flex flex-col gap-4 px-6 pt-5 font-geist-mono text-[10px] tracking-[0.04em] sm:flex-row sm:items-start sm:gap-6 md:px-16">
        <p className="flex-1 text-[#8a8b8f]">
          EVERY FIELD SHOWS ITS SOURCE. HOVER A LINE TO SEE WHERE NOVA READ IT.
        </p>
        <p className="shrink-0 font-medium text-[#16181d]">
          TRY IT → FORWARD ANY LOAD EMAIL TO TRY@NOVA.FREIGHT
        </p>
      </div>
    </section>
  );
}

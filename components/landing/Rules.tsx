import { SectionHead } from "./Hero";

/* ─────────────────────────────────────────────────────────────────────────────
 * STOP 03 — Plain-English Rules
 *
 * Rule composer with colored/underlined spans, plus a 4-column parse grid.
 * ───────────────────────────────────────────────────────────────────────────── */

const PARSE_CARDS = [
  { color: "#d9622b", label: "WHEN", text: "Nova's ETA runs past the delivery appointment" },
  { color: "#2f4b7c", label: "FOR", text: "Customers tagged Priority · 14 today" },
  {
    color: "#5e8c6a",
    label: "DO",
    text: "Email their contact, offer 2 slots from the receiver's calendar",
  },
  { color: "#8c6239", label: "UNLESS", text: "The fix costs over $150 → ask Priya first" },
] as const;

export default function Rules() {
  const u = "underline decoration-from-font underline-offset-2";

  return (
    <section className="w-full">
      <SectionHead
        stop="STOP 03 — HANDOFF"
        subtitle="RULES YOU CAN READ"
        line1="Tell it how you work."
        line2="In a sentence."
        description="No flowcharts. No WHEN/THEN builders. No IT ticket. Write the rule the way you'd explain it to a new dispatcher — Nova shows how it understood you before anything runs."
      />

      <div className="px-6 md:px-16">
        <div className="flex flex-col gap-6 sm:gap-8 rounded-[28px] bg-[#ede8df] px-4 py-7 sm:px-14 sm:py-12">
          {/* Rule input card */}
          <div className="flex flex-col gap-3.5 rounded-[20px] border border-[#dcd5c9] bg-[#fffefb] px-4 py-5 shadow-[0_10px_30px_rgba(58,46,30,0.06)] sm:px-8 sm:py-7">
            <div className="flex items-center justify-between font-geist-mono text-[9px] sm:text-[10px] tracking-[0.04em] text-[#8a8b8f]">
              <span className="font-medium">NEW RULE · WRITTEN BY PRIYA, DISPATCH LEAD</span>
              <span className="hidden sm:inline">⌘ ENTER TO PREVIEW</span>
            </div>
            <p className="font-serif text-[clamp(22px,3.5vw,44px)] leading-[1.2] sm:leading-[1.18] tracking-[-0.44px] text-[#16181d]">
              When a <span className={`text-[#2f4b7c] ${u}`}>priority customer</span>
              's delivery <span className={`text-[#d9622b] ${u}`}>is going to be late</span>,{" "}
              <span className={`text-[#5e8c6a] ${u}`}>
                tell them before they ask — and offer two new slots
              </span>
              . If fixing it <span className={`text-[#8c6239] ${u}`}>costs more than $150, </span>
              <span className={`italic text-[#8c6239] ${u}`}>ask me first</span>.
            </p>
          </div>

          {/* Parse label */}
          <p className="font-geist-mono text-[10px] font-medium tracking-[0.04em] text-[#16181d]">
            HOW NOVA UNDERSTOOD IT
          </p>

          {/* Parse cards */}
          <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
            {PARSE_CARDS.map((c) => (
              <div
                key={c.label}
                className="flex flex-col gap-2 rounded-2xl border border-[#dcd5c9] bg-[#fffefb] px-[18px] py-4"
              >
                <div className="flex items-center gap-2">
                  <span className="h-[3px] w-3.5 rounded-sm" style={{ backgroundColor: c.color }} />
                  <span
                    className="font-geist-mono text-[10px] font-medium tracking-[0.04em]"
                    style={{ color: c.color }}
                  >
                    {c.label}
                  </span>
                </div>
                <p className="font-geist text-[14px] sm:text-[15px] font-medium leading-[21px] text-[#16181d]">
                  {c.text}
                </p>
              </div>
            ))}
          </div>

          {/* Bottom row */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-1">
            <div className="flex items-center gap-2.5">
              <span className="size-[7px] shrink-0 rounded-full bg-[#5e8c6a]" />
              <span className="font-geist-mono text-[9px] sm:text-[10px] font-medium tracking-[0.04em] text-[#4a4e57]">
                BACK-TESTED ON YOUR LAST 30 DAYS: WOULD HAVE FIRED 23 TIMES · 21 LOOKED RIGHT
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <button className="flex-1 sm:flex-initial rounded-full border border-[rgba(22,24,29,0.25)] px-4 sm:px-5 py-2.5 sm:py-3 font-geist text-xs sm:text-sm font-medium text-[#16181d] transition-colors hover:bg-[#dcd5c9]/40">
                Edit wording
              </button>
              <button className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 rounded-full bg-[#16181d] px-4 sm:px-5 py-2.5 sm:py-3 font-geist text-xs sm:text-sm font-medium text-[#f5f2ec] transition-colors hover:bg-[#2a2d35]">
                Turn it on <span aria-hidden="true">→</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

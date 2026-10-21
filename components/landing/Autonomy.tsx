import { SectionHead } from "./Hero";

/* ─────────────────────────────────────────────────────────────────────────────
 * STOP 02 — Autonomy
 *
 * Left: Autonomy dial — 6 workflow rows with Watch / Suggest / Act toggles.
 * Right: The Ledger — timestamped log of what Nova did during lunch.
 * ───────────────────────────────────────────────────────────────────────────── */

/* ── Data ────────────────────────────────────────────────────────────────── */

type Level = "watch" | "suggest" | "act";

interface Workflow {
  name: string;
  sub: string;
  active: Level;
}

const WORKFLOWS: Workflow[] = [
  {
    name: "Check calls & tracking updates",
    sub: "ELD, app pings and carrier emails",
    active: "act",
  },
  { name: "Customer ETA updates", sub: "Tells customers before they ask", active: "act" },
  { name: "Carrier tendering", sub: "Ranks carriers, drafts the tender", active: "suggest" },
  { name: "Reroutes that cost over $100", sub: "Weather, closures, HOS limits", active: "suggest" },
  { name: "Invoicing & POD matching", sub: "Matches POD to BOL, sends invoice", active: "act" },
  { name: "Rate changes on contract lanes", sub: "Spots drift against market", active: "watch" },
];

interface LedgerEntry {
  time: string;
  title: string;
  why: string;
  badge: "ACT" | "ASKED";
}

const LEDGER: LedgerEntry[] = [
  {
    time: "12:02",
    title: "Told Acme L-20418 is 40 min late",
    why: "Why: Priority customer, delay > 30 min",
    badge: "ACT",
  },
  {
    time: "12:09",
    title: "Logged check call on L-20402",
    why: "Why: ELD ping, on schedule",
    badge: "ACT",
  },
  {
    time: "12:15",
    title: "Held the tender on L-20455",
    why: "Why: Rate 9% above lane average — asked Priya",
    badge: "ASKED",
  },
  {
    time: "12:31",
    title: "Matched 6 PODs, drafted invoices",
    why: "Why: $48,920 · zero mismatches",
    badge: "ACT",
  },
  {
    time: "12:40",
    title: "Flagged Blue Line's insurance",
    why: "Why: Expires in 3 days — 2 loads booked",
    badge: "ASKED",
  },
];

/* ── Segmented toggle ─────────────────────────────────────────────────────── */

const LEVELS: Level[] = ["watch", "suggest", "act"];
const LEVEL_LABEL: Record<Level, string> = { watch: "Watch", suggest: "Suggest", act: "Act" };

function SegmentedToggle({ active }: { active: Level }) {
  return (
    <div className="flex shrink-0 gap-0.5 rounded-full bg-[#ede8df] p-[3px]">
      {LEVELS.map((lvl) => {
        const on = lvl === active;
        const showDot = on && lvl === "act";
        return (
          <div
            key={lvl}
            className={`flex items-center gap-1.5 rounded-full px-3.5 py-[7px] ${on ? "bg-[#16181d]" : ""}`}
          >
            {showDot && <span className="size-[5px] rounded-full bg-[#f5f2ec]" />}
            <span
              className={`font-geist text-[13px] font-medium whitespace-nowrap ${on ? "text-[#f5f2ec]" : "text-[#4a4e57]"}`}
            >
              {LEVEL_LABEL[lvl]}
            </span>
          </div>
        );
      })}
    </div>
  );
}

/* ── Main ─────────────────────────────────────────────────────────────────── */

export default function Autonomy() {
  return (
    <section className="w-full">
      <SectionHead
        stop="STOP 02 — IN TRANSIT"
        subtitle="YOU SET HOW MUCH IT DOES ALONE"
        line1="Muvx drives the miles."
        line2="You make the calls."
        description="Choose, workflow by workflow, how much Nova does on its own. Start cautious, hand over more as it earns your trust. Every action is logged with the reason behind it."
      />

      <div className="flex flex-col gap-6 px-6 md:px-16 lg:flex-row">
        {/* ── Left: Autonomy dial ──────────────────────────────── */}
        <div className="flex flex-col rounded-3xl border border-[#dcd5c9] bg-[#fffefb] px-5 py-6 sm:px-8 sm:py-7 shadow-[0_10px_30px_rgba(58,46,30,0.06)] lg:w-[800px] lg:shrink-0">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 pb-[18px]">
            <p className="font-serif text-[24px] sm:text-[30px] text-[#16181d]">Autonomy, per workflow</p>
            <div className="flex flex-wrap gap-2.5 sm:gap-4 font-geist-mono text-[9px] tracking-[0.04em]">
              {(["WATCH", "SUGGEST", "ACT"] as const).map((l) => (
                <span key={l} className="flex gap-1.5">
                  <span className="font-medium text-[#16181d]">{l}</span>
                  <span className="text-[#8a8b8f]">
                    {l === "WATCH"
                      ? "only observes"
                      : l === "SUGGEST"
                        ? "asks you"
                        : "does it, tells you"}
                  </span>
                </span>
              ))}
            </div>
          </div>

          {/* Workflow rows */}
          {WORKFLOWS.map((w) => (
            <div
              key={w.name}
              className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 border-t border-[#dcd5c9] py-3.5 sm:py-4"
            >
              <div className="min-w-0 flex-1">
                <p className="font-geist text-sm sm:text-base font-medium text-[#16181d]">{w.name}</p>
                <p className="font-geist text-xs sm:text-[13px] text-[#8a8b8f]">{w.sub}</p>
              </div>
              <div className="self-start sm:self-center">
                <SegmentedToggle active={w.active} />
              </div>
            </div>
          ))}
        </div>

        {/* ── Right: The Ledger ────────────────────────────────── */}
        <div className="flex flex-1 flex-col gap-[18px] rounded-3xl border border-[#dcd5c9] bg-[#e7e0d3] p-5 sm:p-7">
          {/* Header */}
          <div>
            <p className="font-geist-mono text-[9px] font-medium tracking-[0.04em] text-[#8a8b8f]">
              THE LEDGER · TODAY 12:00 – 13:00
            </p>
            <p className="mt-1.5 font-serif text-[24px] sm:text-[30px] text-[#16181d]">While you were at lunch</p>
          </div>

          {/* Entries */}
          {LEDGER.map((e) => {
            const asked = e.badge === "ASKED";
            return (
              <div key={e.time} className="flex gap-3 sm:gap-3.5">
                <span
                  className={`shrink-0 font-geist-mono text-[10px] font-medium tracking-[0.04em] ${asked ? "text-[#d9622b]" : "text-[#8a8b8f]"}`}
                >
                  {e.time}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-geist text-[13px] sm:text-sm font-medium leading-[19px] text-[#16181d]">
                    {e.title}
                  </p>
                  <p className="font-geist text-xs leading-[17px] text-[#8a8b8f]">{e.why}</p>
                </div>
                <span
                  className={`shrink-0 self-start rounded-full border px-2 py-[3px] font-geist-mono text-[8px] font-medium tracking-[0.04em] ${
                    asked
                      ? "border-[#d9622b]/60 text-[#d9622b]"
                      : "border-[#16181d]/20 text-[#4a4e57]"
                  }`}
                >
                  {e.badge}
                </span>
              </div>
            );
          })}

          {/* Footer */}
          <div className="flex items-center gap-2 pt-1.5">
            <span className="size-1.5 rounded-full bg-[#5e8c6a]" />
            <span className="font-geist-mono text-[9px] tracking-[0.04em] text-[#8a8b8f]">
              ANY ACTION CAN BE UNDONE FOR 10 MINUTES
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}

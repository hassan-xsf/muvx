import { Eyebrow } from "./Hero";

/* ─────────────────────────────────────────────────────────────────────────────
 * STOP 05 — Pricing
 * ───────────────────────────────────────────────────────────────────────────── */

const PROMISES = [
  {
    n: "01",
    title: "Unlimited seats",
    desc: "Dispatch, finance, drivers and customers — no per-user fees.",
  },
  {
    n: "02",
    title: "Every agent included",
    desc: "Reading, pricing, tendering, tracking, billing. One price.",
  },
  {
    n: "03",
    title: "Live in a day",
    desc: "We import loads, customers and carriers from your old TMS.",
  },
] as const;

export default function Pricing() {
  return (
    <section className="flex w-full flex-col gap-8 sm:gap-12 px-6 pt-16 sm:pt-24 lg:pt-[140px] md:px-16">
      <Eyebrow stop="STOP 05 — BILLING" subtitle="PRICING THAT MOVES WITH YOU" />

      {/* Heading + description */}
      <div className="flex flex-col gap-6 sm:gap-10 lg:flex-row lg:items-end lg:gap-16">
        <div className="max-w-[760px] font-serif text-[clamp(36px,5.5vw,76px)] leading-[0.98] sm:leading-[0.96] tracking-[-1px] sm:tracking-[-1.52px]">
          <p className="mb-0 text-[#16181d]">Pay for freight moved.</p>
          <p className="italic text-[#d9622b]">Not for seats.</p>
        </div>
        <div className="flex max-w-[520px] flex-col gap-3.5 sm:gap-[18px] lg:flex-1">
          <p className="font-geist text-base sm:text-lg leading-6 sm:leading-7 text-[#4a4e57]">
            One simple price per load. Your whole team, your drivers and your customers get in free.
            Every AI capability is included — nothing is an add-on.
          </p>
          <a
            href="#pricing"
            className="inline-flex items-center gap-2 font-geist text-base font-medium text-[#16181d]"
          >
            See pricing <span className="text-[#d9622b]">→</span>
          </a>
        </div>
      </div>

      {/* Promise cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {PROMISES.map((p) => (
          <div
            key={p.n}
            className="flex flex-col gap-3 sm:gap-3.5 rounded-[22px] border border-[#dcd5c9] bg-[#fffefb] p-5 sm:p-7 shadow-[0_4px_14px_rgba(58,46,30,0.03)]"
          >
            <span className="font-geist-mono text-[10px] font-medium tracking-[0.04em] text-[#d9622b]">
              {p.n}
            </span>
            <p className="font-serif text-[26px] sm:text-[34px] leading-tight text-[#16181d]">{p.title}</p>
            <p className="font-geist text-sm sm:text-[15px] leading-[20px] sm:leading-[22px] text-[#4a4e57]">{p.desc}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

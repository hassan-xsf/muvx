import { Eyebrow } from "./Hero";

/* ─────────────────────────────────────────────────────────────────────────────
 * STOP 04 — Delivered (Stats + Testimonial)
 * ───────────────────────────────────────────────────────────────────────────── */

const STATS = [
  { value: "4s", desc: "from customer email to a priced, ready-to-send load" },
  { value: "1 in 12", desc: "loads that actually need a human decision" },
  { value: "0", desc: "check calls your team has to make by hand" },
  { value: "2.1 days", desc: "faster from delivery to cash in the bank" },
] as const;

export default function Stats() {
  return (
    <section className="flex w-full flex-col gap-8 sm:gap-12 px-6 pt-16 sm:pt-24 lg:pt-[140px] md:px-16">
      <Eyebrow stop="STOP 04 — DELIVERED" subtitle="WHAT CHANGES ON DAY ONE" />

      {/* Headline */}
      <div className="max-w-full font-serif text-[clamp(36px,5.5vw,76px)] leading-[0.98] sm:leading-[0.96] tracking-[-1px] sm:tracking-[-1.52px]">
        <p className="mb-0 text-[#16181d]">Less typing. Fewer calls.</p>
        <p className="italic text-[#d9622b]">More freight per person.</p>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-1 border-t border-[#dcd5c9] sm:grid-cols-2 lg:grid-cols-4">
        {STATS.map((s, i) => (
          <div
            key={s.value}
            className={`flex flex-col gap-2.5 sm:gap-3 pb-6 pt-6 sm:pb-8 sm:pt-8 pr-4 sm:pr-7 border-b border-[#dcd5c9] last:border-b-0 lg:border-b-0 ${
              i % 2 === 1 ? "sm:border-l sm:border-[#dcd5c9] sm:pl-7" : ""
            } ${i >= 1 ? "lg:border-l lg:border-[#dcd5c9] lg:pl-7" : "lg:pl-0"} ${
              i < 2 ? "sm:border-b sm:border-[#dcd5c9] lg:border-b-0" : "sm:border-b-0"
            }`}
          >
            <p className="font-serif text-[clamp(48px,6vw,88px)] leading-none tracking-[-2px] sm:tracking-[-2.64px] text-[#16181d]">
              {s.value}
            </p>
            <p className="font-geist text-sm sm:text-[15px] leading-[20px] sm:leading-[22px] text-[#4a4e57]">{s.desc}</p>
          </div>
        ))}
      </div>

      {/* Testimonial */}
      <div className="flex gap-4 sm:gap-16 pt-10 sm:pt-16 lg:pt-24">
        {/* Opening quote mark */}
        <span
          className="hidden shrink-0 font-serif text-[160px] leading-[120px] text-[#d9622b] sm:block"
          aria-hidden="true"
        >
          "
        </span>

        <div className="flex flex-col gap-7">
          <p className="font-serif text-[clamp(28px,3.2vw,46px)] leading-[1.17] text-[#16181d]">
            It's the first TMS that feels like it works the night shift for us. I open it at seven
            and the day is already mostly done — it just leaves me the three calls that are actually
            mine.
          </p>

          {/* Attribution */}
          <div className="flex items-center gap-3.5">
            <div className="flex size-11 items-center justify-center rounded-full bg-[#e7e0d3]">
              <span className="font-serif text-lg text-[#4a4e57]">PR</span>
            </div>
            <div>
              <p className="font-geist text-[15px] font-medium text-[#16181d]">Priya Raman</p>
              <p className="font-geist text-[13px] text-[#8a8b8f]">
                Dispatch Lead, Northbound Freight · 140 trucks
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

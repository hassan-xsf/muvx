"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useAuth } from "./landing-utils"

/* ─────────────────────────────────────────────────────────────────────────────
 * Final CTA — "Your next load is already in your inbox."
 *
 * Wavy contour lines in background, route-end visual, CTA buttons.
 * ───────────────────────────────────────────────────────────────────────────── */

const CTA_CONTOUR = "M0 0C220 -20 440 20 660 0S1100 -20 1400 0S1760 20 1920 0";

export default function FinalCTA() {
  const { user } = useAuth()
  const router = useRouter()

  return (
    <section className="w-full px-6 pt-16 sm:pt-24 lg:pt-[140px] md:px-16">
      <div className="relative overflow-hidden rounded-[32px] bg-[#ede8df] px-6 py-12 sm:px-16 sm:py-20 md:min-h-[520px]">
        {/* ── Background wavy lines ─────────────────────────── */}
        <svg
          className="pointer-events-none absolute inset-0 h-full w-full"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          {[68, 160, 240, 318, 400, 474].map((y) => (
            <path
              key={y}
              d={CTA_CONTOUR}
              fill="none"
              stroke="#bdb5aa"
              strokeWidth="1"
              opacity="0.3"
              transform={`translate(0, ${y})`}
            />
          ))}
        </svg>

        {/* ── Destination marker (top-right) ────────────────── */}
        <div className="pointer-events-none absolute right-16 top-[280px] hidden items-center gap-4 lg:flex">
          <svg width="60" height="2" aria-hidden="true">
            <line
              x1="0"
              y1="1"
              x2="60"
              y2="1"
              stroke="#b0a99f"
              strokeWidth="1.5"
              strokeDasharray="4 4"
            />
          </svg>
          <div className="relative flex items-center justify-center">
            <span className="size-11 rounded-full border-[1.5px] border-[#b0a99f]" />
            <span className="absolute size-[18px] rounded-full bg-[#b0a99f]" />
          </div>
        </div>
        <p className="pointer-events-none absolute bottom-[calc(50%-40px)] right-16 hidden font-geist-mono text-[10px] font-medium tracking-[0.04em] text-[#16181d] lg:block">
          STOP 06 — DELIVERED
        </p>

        {/* ── Content ───────────────────────────────────────── */}
        <div className="relative z-10 flex flex-col gap-6 sm:gap-8">
          {/* Eyebrow */}
          <div className="flex items-center gap-2.5">
            <span className="size-[7px] shrink-0 rounded-full bg-[#d9622b]" />
            <span className="font-geist-mono text-[11px] font-medium tracking-[0.04em] text-[#16181d]">
              YOUR NEXT LOAD
            </span>
            <span className="font-geist-mono text-[11px] tracking-[0.04em] text-[#8a8b8f]">
              · STARTS WITH ONE EMAIL
            </span>
          </div>

          {/* Headline */}
          <div className="max-w-[900px] font-serif text-[clamp(36px,6vw,88px)] leading-[0.98] sm:leading-[0.96] tracking-[-1px] sm:tracking-[-1.76px]">
            <p className="mb-0 text-[#16181d]">Your next load is</p>
            <p className="italic text-[#d9622b]">already in your inbox.</p>
          </div>

          {/* CTA buttons */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            {user ? (
              <button
                onClick={() => router.push("/dashboard")}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2.5 rounded-full bg-[#16181d] px-6 py-3.5 sm:py-4 font-geist text-base font-medium text-[#f5f2ec] transition-colors hover:bg-[#2a2d35]"
              >
                Go to Dashboard <span aria-hidden="true">→</span>
              </button>
            ) : (
              <>
                <Link
                  href="/signup"
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2.5 rounded-full bg-[#16181d] px-6 py-3.5 sm:py-4 font-geist text-base font-medium text-[#f5f2ec] transition-colors hover:bg-[#2a2d35]"
                >
                  Get early access <span aria-hidden="true">→</span>
                </Link>
                <Link
                  href="/contact"
                  className="w-full sm:w-auto inline-flex items-center justify-center rounded-full border border-[rgba(22,24,29,0.25)] px-[22px] py-3.5 sm:py-4 font-geist text-base font-medium text-[#16181d] transition-colors hover:bg-[#dcd5c9]/40 text-center"
                >
                  Book a 20-min walkthrough
                </Link>
              </>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

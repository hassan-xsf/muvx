"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useAuth } from "./landing-utils"
import { Instrument_Serif } from "next/font/google"
import { OrbitBorderButton } from "@/components/originkit/orbit-border-button"

const instrumentSerif = Instrument_Serif({
  weight: "400",
  subsets: ["latin"],
  style: ["normal", "italic"],
})


/* ─────────────────────────────────────────────────────────────────────────────
 * Eyebrow
 * ───────────────────────────────────────────────────────────────────────────── */
export function Eyebrow({ stop, subtitle }: { stop: string; subtitle: string }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="size-[7px] shrink-0 rounded-full bg-[#d9622b]" />

      <span className="font-geist-mono text-[11px] font-medium uppercase tracking-[0.04em] text-[#16181d]">
        {stop}
      </span>

      <span className="font-geist-mono text-[11px] tracking-[0.04em] text-[#8a8b8f]">
        · {subtitle}
      </span>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
 * SectionHead — reusable heading block for STOP sections
 * ───────────────────────────────────────────────────────────────────────────── */
export function SectionHead({
  stop,
  subtitle,
  line1,
  line2,
  description,
}: {
  stop: string;
  subtitle: string;
  line1: string;
  line2: string;
  description: string;
}) {
  return (
    <div className="flex flex-col gap-7 px-6 pb-14 pt-[120px] md:px-16">
      <Eyebrow stop={stop} subtitle={subtitle} />
      <div className="flex flex-col gap-10 lg:flex-row lg:items-end lg:gap-16">
        <div className="max-w-[760px] font-serif text-[clamp(48px,5.5vw,76px)] leading-[0.96] tracking-[-1.52px]">
          <p className="mb-0 text-[#16181d]">{line1}</p>
          <p className="italic text-[#d9622b]">{line2}</p>
        </div>
        <p className="max-w-[520px] font-geist text-lg leading-7 text-[#4a4e57] lg:flex-1">
          {description}
        </p>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
 * Hero
 * ───────────────────────────────────────────────────────────────────────────── */
export default function Hero() {
  const { user } = useAuth()
  const router = useRouter()

  return (
    <section className="relative w-full overflow-hidden from-white to-[#f7f3ec]">
      {/* ───────────────────────────────────────────────────────────────────
       * Background contour lines
       * ─────────────────────────────────────────────────────────────────── */}
      <div className="pointer-events-none absolute inset-0">
        <svg
          viewBox="0 0 1600 900"
          className="absolute inset-0 h-full w-full opacity-50"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <path
            d="M960 15C1080 95 1180 10 1300 72C1410 130 1510 35 1600 95"
            fill="none"
            stroke="#e7bca4"
            strokeWidth="1"
          />

          <path
            d="M1010 105C1120 180 1200 105 1310 160C1410 210 1510 135 1600 185"
            fill="none"
            stroke="#ead4c5"
            strokeWidth="1"
          />

          <path
            d="M900 155C1030 235 1150 165 1250 220C1360 278 1490 220 1600 265"
            fill="none"
            stroke="#ead4c5"
            strokeWidth="1"
          />

          <path
            d="M0 710C180 665 320 742 490 700C640 663 760 730 900 684"
            fill="none"
            stroke="#ead4c5"
            strokeWidth="1"
          />
        </svg>
      </div>

      <div className="relative z-10 mx-auto max-w-[1440px] px-6 pb-0 pt-[72px] md:px-16">
        {/* ────────────────────────────────────────────────────────────────
         * Eyebrow
         * ──────────────────────────────────────────────────────────────── */}
        <Eyebrow stop="BUILT FOR TRUCKING" subtitle="FROM DISPATCH TO DELIVERY" />

        {/* ────────────────────────────────────────────────────────────────
         * Main hero area
         * ──────────────────────────────────────────────────────────────── */}
        <div className="relative mt-7 min-h-[650px] lg:min-h-[680px]">
          {/* Truck image */}
          <div className="pointer-events-none absolute -right-[4%] top-0 hidden h-[650px] w-[64%] lg:block">
            <img
              src="/hero/hero.png"
              alt="MuvxTMS trucking fleet"
              className="absolute inset-0 h-full w-full object-cover object-[58%_50%]"
            />

            {/* Fade image into Muvx background */}
            <div className="absolute inset-y-0 left-0 w-[42%] bg-gradient-to-r from-[#f7f3ec] via-[#f7f3ec]/80 to-transparent" />

            {/* Bottom fade */}
            <div className="absolute inset-x-0 bottom-0 h-[28%] bg-gradient-to-t from-[#f7f3ec] to-transparent" />
          </div>

          {/* Mobile/tablet image */}
          <div className="relative mt-10 block h-[340px] w-full overflow-hidden rounded-[28px] lg:hidden">
            <img
              src="/hero/hero.png"
              alt="MuvxTMS trucking fleet"
              className="h-full w-full object-cover object-[58%_50%]"
            />

            <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-[#f7f3ec]/90 to-transparent" />
          </div>

          {/* ──────────────────────────────────────────────────────────────
           * Left content
           * ────────────────────────────────────────────────────────────── */}
          <div className="relative z-20 max-w-[760px] pt-1 lg:pt-[20px]">
            <h1 className={`${instrumentSerif.className} max-w-[760px] font-normal text-[clamp(56px,7.2vw,104px)] leading-[0.92] tracking-[-0.045em] text-[#16181d]`}>
              <span className="block ">The TMS built for</span>

              <span className="block italic font-serif text-[#d9622b]">the way your fleet moves.</span>
            </h1>

            <p className="mt-8 max-w-[560px] font-geist text-[18px] leading-7 text-[#4a4e57] md:text-[20px] md:leading-[30px]">
              Dispatch loads, manage drivers, track trucks, handle documents and move from delivery
              to payment — all in one system.
            </p>

            {/* CTA */}
            <div className="mt-8 flex flex-wrap items-center gap-3">
              {user ? (
                <OrbitBorderButton
                  onClick={() => router.push("/dashboard")}
                >
                  Dashboard&nbsp;&nbsp;→
                </OrbitBorderButton>
              ) : (
                <>
                  <Link
                    href="/signup"
                    className="inline-flex items-center gap-3 rounded-full bg-[#16181d] px-7 py-4 font-geist text-base font-medium text-[#f5f2ec] transition-colors hover:bg-[#2a2d35]"
                  >
                    <span className="flex size-7 items-center justify-center rounded-full bg-[#ff6b2f] text-sm">
                      ▶
                    </span>
                    See Muvx in action
                  </Link>

                  <Link
                    href="/signup"
                    className="inline-flex items-center rounded-full border border-[rgba(22,24,29,0.22)] px-7 py-4 font-geist text-base font-medium text-[#16181d] transition-colors hover:bg-[#ece7df]"
                  >
                    Book a demo&nbsp;&nbsp;→
                  </Link>
                </>
              )}
            </div>
          </div>

          {/* ──────────────────────────────────────────────────────────────
           * Route + metadata layer
           * ────────────────────────────────────────────────────────────── */}
          <div className="pointer-events-none absolute inset-0 hidden lg:block">
            {/* ── Route path ─────────────────────────────────── */}
            <svg
              viewBox="0 0 900 390"
              className="absolute right-[-4%] top-[80px] h-[390px] w-[68%]"
              fill="none"
              aria-hidden="true"
            >
              <path
                d="M60 170 C110 170 145 145 185 145 C268 145 268 195 350 195 C420 195 420 75 490 75 C602 75 602 145 714 145 C770 145 830 128 870 128"
                stroke="#df6a35"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              {/* Decorative route dots */}
              <circle cx="60" cy="170" r="4" fill="#df6a35" />
              <circle
                cx="350"
                cy="195"
                r="4.5"
                fill="#f7f3ec"
                stroke="#df6a35"
                strokeWidth="1.5"
                className="tms-blink"
              />
              <circle cx="870" cy="128" r="4" fill="#df6a35" />
            </svg>

            {/* ── Stop markers on route (connected to cards) ─────── */}
            <div
              className="absolute size-3.5 rounded-full border-2 border-[#df6a35] bg-[#f7f3ec] shadow-[0_0_0_4px_rgba(217,119,6,0.25)]"
              style={{ left: "calc(50% - 7px)", top: 218 }}
            />
            <div
              className="absolute size-3.5 rounded-full border-2 border-[#df6a35] bg-[#f7f3ec] shadow-[0_0_0_4px_rgba(217,119,6,0.25)] tms-blink"
              style={{ left: "calc(73% - 7px)", top: 148 }}
            />
            <div
              className="absolute size-3.5 rounded-full border-2 border-[#df6a35] bg-[#f7f3ec] shadow-[0_0_0_4px_rgba(217,119,6,0.25)]"
              style={{ left: "calc(90% - 7px)", top: 218 }}
            />

            {/* ── Connector lines (card → stop marker) ──────────── */}
            <div
              className="absolute w-px bg-[#df6a35]/35"
              style={{ left: "50%", top: 200, height: 18 }}
            />
            <div
              className="absolute w-px bg-[#df6a35]/35"
              style={{ left: "73%", top: 120, height: 28 }}
            />
            <div
              className="absolute w-px bg-[#df6a35]/35"
              style={{ left: "90%", top: 200, height: 18 }}
            />

            {/* ── Chicago card (start of route) ───────────────────── */}
            <div
              className="absolute flex w-[168px] flex-col gap-1 rounded-[12px] border border-[#ece3d8] bg-[#fffdf9] px-3 py-2.5 shadow-[0_6px_18px_rgba(58,46,30,0.06)]"
              style={{ left: "47%", top: 138 }}
            >
              <div className="flex items-center gap-2">
                <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-[#fff0e6] text-[#d9622b]">
                  <svg
                    viewBox="0 0 24 24"
                    className="size-3"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    aria-hidden="true"
                  >
                    <path d="M12 21s7-6.1 7-12a7 7 0 1 0-14 0c0 5.9 7 12 7 12Z" />
                    <circle cx="12" cy="9" r="2.2" />
                  </svg>
                </span>
                <span className="font-geist text-[13px] font-semibold text-[#16181d]">
                  Chicago, IL
                </span>
              </div>
              <p className="pl-7 font-geist text-[11px] text-[#73757a]">Sep 28, 10:00 AM</p>
            </div>

            {/* ── Mileage card (center of route) ──────────────────── */}
            <div
              className="absolute flex w-[156px] flex-col gap-1 rounded-[12px] border border-[#ece3d8] bg-[#fffdf9] px-3 py-2.5 shadow-[0_6px_18px_rgba(58,46,30,0.06)]"
              style={{ left: "68%", top: 58 }}
            >
              <div className="flex items-center gap-2">
                <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-[#fff0e6]">
                  <svg
                    viewBox="0 0 24 24"
                    className="size-3 text-[#16181d]"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    aria-hidden="true"
                  >
                    <path d="M3 16V8h11v8H3Z" />
                    <path d="M14 11h4l3 3v2h-7v-5Z" />
                    <circle cx="7" cy="17" r="2" />
                    <circle cx="18" cy="17" r="2" />
                  </svg>
                </span>
                <span className="font-geist text-[13px] font-semibold text-[#16181d]">
                  1,250 mi
                </span>
              </div>
              <p className="pl-7 font-geist text-[11px] text-[#73757a]">In Transit</p>
            </div>

            {/* ── Dallas card (end of route) ───────────────────────── */}
            <div
              className="absolute flex w-[168px] flex-col gap-1 rounded-[12px] border border-[#ece3d8] bg-[#fffdf9] px-3 py-2.5 shadow-[0_6px_18px_rgba(58,46,30,0.06)]"
              style={{ left: "84%", top: 138 }}
            >
              <div className="flex items-center gap-2">
                <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-[#fff0e6] text-[#d9622b]">
                  <svg
                    viewBox="0 0 24 24"
                    className="size-3"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    aria-hidden="true"
                  >
                    <path d="M12 21s7-6.1 7-12a7 7 0 1 0-14 0c0 5.9 7 12 7 12Z" />
                    <circle cx="12" cy="9" r="2.2" />
                  </svg>
                </span>
                <span className="font-geist text-[13px] font-semibold text-[#16181d]">
                  Dallas, TX
                </span>
              </div>
              <p className="pl-7 font-geist text-[11px] text-[#73757a]">Sep 29, 6:32 PM</p>
            </div>
          </div>
        </div>

        {/* ──────────────────────────────────────────────────────────────
         * Feature strip
         * ────────────────────────────────────────────────────────────── */}
        <div className="relative z-30 -mt-2 grid border-t border-[#e4ddd3] py-7 md:grid-cols-2 lg:grid-cols-4">
          {[
            {
              title: "Dispatch faster",
              description: "Assign loads and keep every trip moving.",
              icon: "truck",
            },
            {
              title: "Real-time visibility",
              description: "Know where your trucks are, always.",
              icon: "pin",
            },
            {
              title: "All documents in one place",
              description: "PODs, rate confirmations and more.",
              icon: "document",
            },
            {
              title: "Get paid faster",
              description: "From delivered load to invoice.",
              icon: "dollar",
            },
          ].map((item, index) => (
            <div
              key={item.title}
              className={[
                "flex items-start gap-4 px-0 py-4 lg:px-6 lg:py-2",
                index !== 0 ? "lg:border-l lg:border-[#e4ddd3]" : "",
              ].join(" ")}
            >
              <div className="flex size-12 shrink-0 items-center justify-center rounded-full bg-[#fff0e6] text-[#d9622b]">
                {item.icon === "truck" && (
                  <svg
                    viewBox="0 0 24 24"
                    className="size-5"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    aria-hidden="true"
                  >
                    <path d="M3 7h11v9H3z" />
                    <path d="M14 10h4l3 3v3h-7z" />
                    <circle cx="7" cy="17" r="2" />
                    <circle cx="18" cy="17" r="2" />
                  </svg>
                )}

                {item.icon === "pin" && (
                  <svg
                    viewBox="0 0 24 24"
                    className="size-5"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    aria-hidden="true"
                  >
                    <path d="M12 21s7-6.1 7-12a7 7 0 1 0-14 0c0 5.9 7 12 7 12Z" />
                    <circle cx="12" cy="9" r="2.2" />
                  </svg>
                )}

                {item.icon === "document" && (
                  <svg
                    viewBox="0 0 24 24"
                    className="size-5"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    aria-hidden="true"
                  >
                    <path d="M7 3h7l4 4v14H7z" />
                    <path d="M14 3v5h5" />
                    <path d="M10 13h5M10 16h5" />
                  </svg>
                )}

                {item.icon === "dollar" && (
                  <svg
                    viewBox="0 0 24 24"
                    className="size-5"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    aria-hidden="true"
                  >
                    <circle cx="12" cy="12" r="8" />
                    <path d="M14.5 9.3c-.6-.6-1.4-.9-2.5-.9-1.3 0-2.4.7-2.4 1.8 0 2.8 5.4 1.1 5.4 3.9 0 1.2-1 2.2-2.8 2.2-1.1 0-2.1-.4-2.8-1.2" />
                    <path d="M12 6.8v10.4" />
                  </svg>
                )}
              </div>

              <div>
                <p className="font-geist text-[15px] font-semibold text-[#16181d]">{item.title}</p>

                <p className="mt-1 max-w-[220px] font-geist text-xs leading-5 text-[#73757a]">
                  {item.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

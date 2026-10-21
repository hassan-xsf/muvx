"use client"

import { useState, useRef, useEffect } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useAuth } from "./landing-utils"
import {
  SquarePen,
  Award,
  Smile,
  FileCode2,
  BookOpen,
  Rocket,
  MessageSquare,
  Mail,
  GitFork,
  Split,
  Bot,
  Gauge,
  Shield,
  Smartphone,
  Link2,
} from "lucide-react"

/* ─────────────────────────────────────────────────────────────────────────────
 * Navbar — matches the Figma design: cream bg, logomark, centered links,
 * dark pill CTA. Fully responsive (links collapse on mobile).
 * ───────────────────────────────────────────────────────────────────────────── */

const NAV_ITEMS = [
  { label: "Transportation", hasDropdown: false, href: "/transportation" },
  { label: "Enterprise", hasDropdown: false, href: "/enterprise" },
  { label: "Pricing", hasDropdown: false, href: "/pricing" },
  { label: "Solutions", hasDropdown: true, href: "#solutions" },
  { label: "Resources", hasDropdown: true, href: "#resources" },
] as const

const SOLUTIONS_ITEMS = [
  { label: "Overview", icon: GitFork, href: "/solutions/overview" },
  { label: "Workflows", icon: Split, href: "/solutions/workflows" },
  { label: "Agents", icon: Bot, href: "/solutions/agents" },
  { label: "Analytics", icon: Gauge, href: "/solutions/analytics" },
  { label: "Security", icon: Shield, href: "/solutions/security" },
  { label: "Mobile App", icon: Smartphone, href: "/solutions/mobile-app" },
  { label: "Integrations", icon: Link2, href: "/solutions/integrations" },
]

const COMMUNITY_ITEMS = [
  { label: "Blog", icon: SquarePen, href: "/blog" },
  { label: "Recognition", icon: Award, href: "/recognition" },
  { label: "Customer Stories", icon: Smile, href: "/customers" },
  { label: "Developer Docs", icon: FileCode2, href: "/docs" },
]

const SUPPORT_ITEMS = [
  { label: "Product Wiki", icon: BookOpen, href: "/wiki" },
  { label: "Support", icon: MessageSquare, href: "/support" },
  { label: "Careers", icon: Rocket, href: "/careers" },
  { label: "Contact Us", icon: Mail, href: "/contact" },
]

export default function Navbar() {
  const { user } = useAuth()
  const router = useRouter()
  const [resourcesOpen, setResourcesOpen] = useState(false)
  const resourcesRef = useRef<HTMLDivElement>(null)
  const [solutionsOpen, setSolutionsOpen] = useState(false)
  const solutionsRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (resourcesRef.current && !resourcesRef.current.contains(event.target as Node)) {
        setResourcesOpen(false)
      }
      if (solutionsRef.current && !solutionsRef.current.contains(event.target as Node)) {
        setSolutionsOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  return (
    <header className="relative z-40 w-full bg-[#fbf8f3]">
      <div className="mx-auto flex max-w-[1440px] items-center gap-4 sm:gap-10 px-4 sm:px-6 py-3.5 sm:py-[22px] md:px-16">
        {/* ── Brand ─────────────────────────────────────────────── */}
        <Link href="/" className="flex shrink-0 items-center">
          <span className="font-serif text-[26px] sm:text-[30px] font-medium leading-none tracking-[-0.015em] text-[#16181d]">
            Muvx<span className="text-[#e8602b]">TMS</span>
          </span>
        </Link>

        {/* ── Nav links (hidden on mobile) ──────────────────────── */}
        <nav className="hidden flex-1 items-center justify-center gap-8 lg:flex">
          {NAV_ITEMS.map((item) => {
            if (item.label === "Solutions") {
              return (
                <div
                  key={item.label}
                  ref={solutionsRef}
                  className="relative"
                  onMouseEnter={() => setSolutionsOpen(true)}
                  onMouseLeave={() => setSolutionsOpen(false)}
                >
                  <button
                    onClick={() => setSolutionsOpen((prev) => !prev)}
                    className="group inline-flex items-center gap-1.5 font-geist text-sm font-medium text-[#4a4e57] transition-colors hover:text-[#16181d] cursor-pointer"
                  >
                    <span>{item.label}</span>
                    <svg
                      className={`size-3 text-[#7a7d85] transition-transform duration-200 group-hover:text-[#16181d] ${
                        solutionsOpen ? "rotate-180 text-[#16181d]" : ""
                      }`}
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                    >
                      <path d="m6 9 6 6 6-6" />
                    </svg>
                  </button>

                  {/* Solutions Dropdown Menu */}
                  {solutionsOpen && (
                    <div className="absolute left-1/2 -translate-x-1/2 top-full pt-3 z-50 w-[380px]">
                      <div className="rounded-2xl border border-[#dcd5c9] bg-[#fffefb] p-6 shadow-[0_16px_40px_rgba(22,24,29,0.08)]">
                        <p className="font-serif text-[15px] italic text-[#8a8b8f] mb-3.5">
                          Solutions
                        </p>
                        <div className="grid grid-cols-2 gap-x-6 gap-y-4">
                          {SOLUTIONS_ITEMS.map((s) => (
                            <Link
                              key={s.label}
                              href={s.href}
                              onClick={() => setSolutionsOpen(false)}
                              className="group/item flex items-center gap-2.5 text-[#16181d] transition-colors hover:text-[#d9622b]"
                            >
                              <s.icon
                                className="size-4 shrink-0 text-[#71757e] transition-colors group-hover/item:text-[#d9622b]"
                                strokeWidth={1.8}
                              />
                              <span className="font-geist text-[13.5px] font-medium leading-none">
                                {s.label}
                              </span>
                            </Link>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )
            }

            if (item.label === "Resources") {
              return (
                <div
                  key={item.label}
                  ref={resourcesRef}
                  className="relative"
                  onMouseEnter={() => setResourcesOpen(true)}
                  onMouseLeave={() => setResourcesOpen(false)}
                >
                  <button
                    onClick={() => setResourcesOpen((prev) => !prev)}
                    className="group inline-flex items-center gap-1.5 font-geist text-sm font-medium text-[#4a4e57] transition-colors hover:text-[#16181d] cursor-pointer"
                  >
                    <span>{item.label}</span>
                    <svg
                      className={`size-3 text-[#7a7d85] transition-transform duration-200 group-hover:text-[#16181d] ${
                        resourcesOpen ? "rotate-180 text-[#16181d]" : ""
                      }`}
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                    >
                      <path d="m6 9 6 6 6-6" />
                    </svg>
                  </button>

                  {/* Dropdown Menu */}
                  {resourcesOpen && (
                    <div className="absolute left-1/2 -translate-x-1/2 top-full pt-3 z-50 w-[420px]">
                      <div className="rounded-2xl border border-[#dcd5c9] bg-[#fffefb] p-6 shadow-[0_16px_40px_rgba(22,24,29,0.08)]">
                        {/* Community Section */}
                        <p className="font-serif text-[15px] italic text-[#8a8b8f] mb-3.5">
                          Community
                        </p>
                        <div className="grid grid-cols-2 gap-x-6 gap-y-4">
                          {COMMUNITY_ITEMS.map((c) => (
                            <Link
                              key={c.label}
                              href={c.href}
                              onClick={() => setResourcesOpen(false)}
                              className="group/item flex items-center gap-2.5 text-[#16181d] transition-colors hover:text-[#d9622b]"
                            >
                              <c.icon
                                className="size-4 shrink-0 text-[#71757e] transition-colors group-hover/item:text-[#d9622b]"
                                strokeWidth={1.8}
                              />
                              <span className="font-geist text-[13.5px] font-medium leading-none">
                                {c.label}
                              </span>
                            </Link>
                          ))}
                        </div>

                        {/* Support Section */}
                        <p className="font-serif text-[15px] italic text-[#8a8b8f] mb-3.5 mt-6">
                          Support
                        </p>
                        <div className="grid grid-cols-2 gap-x-6 gap-y-4">
                          {SUPPORT_ITEMS.map((s) => (
                            <Link
                              key={s.label}
                              href={s.href}
                              onClick={() => setResourcesOpen(false)}
                              className="group/item flex items-center gap-2.5 text-[#16181d] transition-colors hover:text-[#d9622b]"
                            >
                              <s.icon
                                className="size-4 shrink-0 text-[#71757e] transition-colors group-hover/item:text-[#d9622b]"
                                strokeWidth={1.8}
                              />
                              <span className="font-geist text-[13.5px] font-medium leading-none">
                                {s.label}
                              </span>
                            </Link>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )
            }

            return (
              <a
                key={item.label}
                href={item.href}
                className="group inline-flex items-center gap-1.5 font-geist text-sm font-medium text-[#4a4e57] transition-colors hover:text-[#16181d]"
              >
                <span>{item.label}</span>
                {item.hasDropdown && (
                  <svg
                    className="size-3 text-[#7a7d85] transition-transform group-hover:text-[#16181d]"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                  >
                    <path d="m6 9 6 6 6-6" />
                  </svg>
                )}
              </a>
            )
          })}
        </nav>

        {/* ── Right CTA ─────────────────────────────────────────── */}
        <div className="ml-auto flex shrink-0 items-center gap-3 sm:gap-6 lg:ml-0">
          {user ? (
            <button
              onClick={() => router.push("/dashboard")}
              className="rounded-full bg-[#16181d] px-4 sm:px-[22px] py-2 sm:py-[11px] font-geist text-xs sm:text-sm font-medium text-[#f5f2ec] transition-colors hover:bg-[#2a2d35]"
            >
              Dashboard&nbsp;&nbsp;→
            </button>
          ) : (
            <>
              <Link
                href="/login"
                className="hidden font-geist text-sm font-medium text-[#4a4e57] transition-colors hover:text-[#16181d] sm:block"
              >
                Log in
              </Link>
              <Link
                href="/signup"
                className="inline-flex items-center gap-1.5 sm:gap-2 rounded-full bg-[#16181d] px-4 sm:px-[22px] py-2 sm:py-[11px] font-geist text-xs sm:text-sm font-medium text-[#f5f2ec] transition-colors hover:bg-[#2a2d35]"
              >
                Get early access
                <span aria-hidden="true">→</span>
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  )
}

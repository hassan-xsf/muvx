"use client"

/**
 * AnnouncementBanner — the in-app banner shown above the main UI.
 * Polls /api/announcements/active every 60s so changes propagate
 * without a page refresh. Users can dismiss dismissible banners and
 * the dismissal is remembered for the session.
 */
import * as React from "react"
import Link from "next/link"
import {
  Info,
  AlertTriangle,
  CheckCircle2,
  Wrench,
  X,
  type LucideIcon,
} from "lucide-react"
import { cn } from "@/lib/utils"

type Announcement = {
  id: string
  title: string
  body: string
  kind: "info" | "warn" | "success" | "maintenance"
  dismissible: boolean
  link: string | null
  linkLabel: string | null
}

const KIND_META: Record<Announcement["kind"], { icon: LucideIcon; cls: string }> = {
  info: {
    icon: Info,
    cls: "border-blue-300 bg-blue-50 text-blue-950 [&_a]:text-blue-900",
  },
  warn: {
    icon: AlertTriangle,
    cls: "border-amber-300 bg-amber-50 text-amber-950 [&_a]:text-amber-900",
  },
  success: {
    icon: CheckCircle2,
    cls: "border-emerald-300 bg-emerald-50 text-emerald-950 [&_a]:text-emerald-900",
  },
  maintenance: {
    icon: Wrench,
    cls: "border-ink/20 bg-brand-ink text-brand-cream [&_a]:text-brand-cream",
  },
}

const DISMISS_KEY = "muvx:dismissed_announcements"

// --- localStorage-backed dismissed-announcements store ---
// Uses useSyncExternalStore so the server-rendered HTML and the
// client's initial hydration render both see an empty Set. After
// hydration the hook switches to reading localStorage; if that
// differs it re-renders naturally — never a hydration mismatch.

const DISMISSED_CHANGED = "muvx:dismissed-changed"

// Stable empty Set reference — must be cached so getServerSnapshot
// returns the same object identity on every call (useSyncExternalStore
// compares with Object.is; a new Set each call would loop forever).
const EMPTY_SET = new Set<string>()

let cachedRaw: string | null = null
let cachedSet: Set<string> | null = null

function readDismissed(): Set<string> {
  if (typeof window === "undefined") return EMPTY_SET
  try {
    const raw = localStorage.getItem(DISMISS_KEY)
    if (raw === cachedRaw && cachedSet) return cachedSet
    cachedRaw = raw
    cachedSet = new Set<string>(JSON.parse(raw ?? "[]"))
    return cachedSet
  } catch {
    cachedRaw = null
    cachedSet = null
    return EMPTY_SET
  }
}

function writeDismissed(next: Set<string>): void {
  try {
    const raw = JSON.stringify([...next])
    localStorage.setItem(DISMISS_KEY, raw)
    cachedRaw = raw
    cachedSet = next
  } catch {}
  // Notify same-tab listeners so useSyncExternalStore re-reads.
  window.dispatchEvent(new CustomEvent(DISMISSED_CHANGED))
}

function subscribeDismissed(onChange: () => void): () => void {
  const handler = () => {
    cachedRaw = null
    cachedSet = null
    onChange()
  }
  window.addEventListener(DISMISSED_CHANGED, handler)
  window.addEventListener("storage", handler)
  return () => {
    window.removeEventListener(DISMISSED_CHANGED, handler)
    window.removeEventListener("storage", handler)
  }
}

export function AnnouncementBanner({
  initial = [],
}: {
  initial?: Announcement[]
}) {
  const [items, setItems] = React.useState<Announcement[]>(initial)
  const dismissed = React.useSyncExternalStore(
    subscribeDismissed,
    readDismissed,
    () => EMPTY_SET
  )

  // Poll every 60s for new banners (e.g. admin just enabled maintenance mode)
  React.useEffect(() => {
    let cancelled = false
    async function fetchActive() {
      try {
        const r = await fetch("/api/announcements/active", { cache: "no-store" })
        if (!r.ok) return
        const d = await r.json()
        if (!cancelled && Array.isArray(d.announcements)) {
          setItems(d.announcements)
        }
      } catch {
        // ignore — banners are best-effort
      }
    }
    fetchActive()
    const t = setInterval(fetchActive, 60_000)
    return () => {
      cancelled = true
      clearInterval(t)
    }
  }, [])

  function dismiss(id: string) {
    const next = new Set(dismissed)
    next.add(id)
    writeDismissed(next)
  }

  const visible = items.filter((a) => !dismissed.has(a.id))
  if (visible.length === 0) return null

  return (
    <div className="pointer-events-none sticky top-0 z-40 flex flex-col gap-1.5 px-3 pt-3">
      {visible.map((a) => {
        const meta = KIND_META[a.kind] ?? KIND_META.info
        const Icon = meta.icon
        return (
          <div
            key={a.id}
            className={cn(
              "pointer-events-auto flex items-start gap-2.5 rounded-lg border px-3 py-2 text-[12.5px] shadow-sm",
              meta.cls
            )}
            role={a.kind === "maintenance" ? "alert" : "status"}
          >
            <Icon className="mt-0.5 size-3.5 shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="font-medium leading-snug">{a.title}</p>
              <p className="mt-0.5 leading-snug opacity-90">{a.body}</p>
              {a.link && a.linkLabel && (
                <Link
                  href={a.link}
                  className="mt-1 inline-block font-medium underline underline-offset-2"
                >
                  {a.linkLabel} →
                </Link>
              )}
            </div>
            {a.dismissible !== false && (
              <button
                onClick={() => dismiss(a.id)}
                className="rounded p-0.5 opacity-70 hover:bg-black/5 hover:opacity-100 transition-opacity"
                aria-label="Dismiss"
              >
                <X className="size-3.5" />
              </button>
            )}
          </div>
        )
      })}
    </div>
  )
}

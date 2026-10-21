import * as React from "react"
import { Truck, Receipt, MapPin, Fuel, ShieldCheck, Radio, Layers, Globe, Cpu } from "lucide-react"

export interface LogoProps {
  className?: string
}

export function SamsaraLogo({ className = "size-7" }: LogoProps) {
  return (
    <svg viewBox="0 0 100 100" fill="none" className={className}>
      <rect width="100" height="100" rx="22" fill="#0c1e30" />
      <path
        d="M28 62c0-14.36 11.64-26 26-26s26 11.64 26 26h-9c0-9.39-7.61-17-17-17s-17 7.61-17 17h-9z"
        fill="#00e599"
      />
      <circle cx="54" cy="62" r="5" fill="#ffffff" />
    </svg>
  )
}

export function MotiveLogo({ className = "size-7" }: LogoProps) {
  return (
    <svg viewBox="0 0 100 100" fill="none" className={className}>
      <rect width="100" height="100" rx="22" fill="#003e29" />
      <path d="M26 34l24 32 24-32h-12l-12 16-12-16H26z" fill="#00d084" />
    </svg>
  )
}

export function GeotabLogo({ className = "size-7" }: LogoProps) {
  return (
    <svg viewBox="0 0 100 100" fill="none" className={className}>
      <rect width="100" height="100" rx="22" fill="#002d62" />
      <path
        d="M50 24L26 38v28l24 14 24-14V38L50 24zm0 12l14 8-14 8-14-8 14-8zm-14 20l10 6v12l-10-6V56zm18 18V62l10-6v12l-10 6z"
        fill="#00a3e0"
      />
    </svg>
  )
}

export function DatLogo({ className = "size-7" }: LogoProps) {
  return (
    <svg viewBox="0 0 100 100" fill="none" className={className}>
      <rect width="100" height="100" rx="22" fill="#d9222a" />
      <path
        d="M28 32h16c10 0 18 8 18 18s-8 18-18 18H28V32zm14 26c4.5 0 8-3.5 8-8s-3.5-8-8-8h-4v16h4z"
        fill="#ffffff"
      />
      <path d="M64 42l10 26h-9l-2-6h-8l-2 6h-9l10-26h10zm-5 13h4l-2-6-2 6z" fill="#ffffff" />
    </svg>
  )
}

export function TruckstopLogo({ className = "size-7" }: LogoProps) {
  return (
    <svg viewBox="0 0 100 100" fill="none" className={className}>
      <rect width="100" height="100" rx="22" fill="#ef6c00" />
      <path d="M30 32h40v10H56v28H44V42H30V32z" fill="#ffffff" />
      <circle cx="70" cy="62" r="6" fill="#ffffff" />
    </svg>
  )
}

export function QuickBooksLogo({ className = "size-7" }: LogoProps) {
  return (
    <svg viewBox="0 0 100 100" fill="none" className={className}>
      <rect width="100" height="100" rx="22" fill="#2ca01c" />
      <path
        d="M48 28C36.95 28 28 36.95 28 48s8.95 20 20 20c7.37 0 13.82-4 17.25-10h-9.52c-2.3 3.65-6.38 6-11.73 6-7.73 0-14-6.27-14-14s6.27-14 14-14c5.35 0 9.43 2.35 11.73 6h9.52C61.82 32 55.37 28 48 28z"
        fill="#ffffff"
      />
      <path
        d="M52 72c11.05 0 20-8.95 20-20s-8.95-20-20-20c-7.37 0-13.82 4-17.25 10h9.52c2.3-3.65 6.38-6 11.73-6 7.73 0 14 6.27 14 14s-6.27 14-14 14c-5.35 0-9.43-2.35-11.73-6h-9.52C38.18 68 44.63 72 52 72z"
        fill="#ffffff"
      />
    </svg>
  )
}

export function XeroLogo({ className = "size-7" }: LogoProps) {
  return (
    <svg viewBox="0 0 100 100" fill="none" className={className}>
      <rect width="100" height="100" rx="22" fill="#13b5ea" />
      <circle cx="34" cy="50" r="10" stroke="#ffffff" strokeWidth="5" />
      <path d="M52 38l14 24M66 38L52 62" stroke="#ffffff" strokeWidth="5" strokeLinecap="round" />
    </svg>
  )
}

export function TriumphPayLogo({ className = "size-7" }: LogoProps) {
  return (
    <svg viewBox="0 0 100 100" fill="none" className={className}>
      <rect width="100" height="100" rx="22" fill="#003366" />
      <path d="M50 24L74 42v28L50 82 26 70V42l24-18zm0 12l-14 10v16l14 7 14-7V46L50 36z" fill="#00a8e8" />
    </svg>
  )
}

export function WexLogo({ className = "size-7" }: LogoProps) {
  return (
    <svg viewBox="0 0 100 100" fill="none" className={className}>
      <rect width="100" height="100" rx="22" fill="#582c83" />
      <path d="M26 36l8 28 8-20 8 20 8-28h8l-12 36h-8l-8-20-8 20h-8l-12-36h8z" fill="#ffffff" />
    </svg>
  )
}

export function ComdataLogo({ className = "size-7" }: LogoProps) {
  return (
    <svg viewBox="0 0 100 100" fill="none" className={className}>
      <rect width="100" height="100" rx="22" fill="#c41230" />
      <circle cx="50" cy="50" r="22" stroke="#ffffff" strokeWidth="8" />
      <circle cx="50" cy="50" r="8" fill="#ffcc00" />
    </svg>
  )
}

export function GoogleMapsLogo({ className = "size-7" }: LogoProps) {
  return (
    <svg viewBox="0 0 100 100" fill="none" className={className}>
      <rect width="100" height="100" rx="22" fill="#ffffff" stroke="#e5e5e5" strokeWidth="2" />
      <path
        d="M50 20c-13.25 0-24 10.75-24 24 0 18 24 40 24 40s24-22 24-40c0-13.25-10.75-24-24-24zm0 33a9 9 0 110-18 9 9 0 010 18z"
        fill="#ea4335"
      />
      <circle cx="50" cy="44" r="7" fill="#ffffff" />
    </svg>
  )
}

export function PcMilerLogo({ className = "size-7" }: LogoProps) {
  return (
    <svg viewBox="0 0 100 100" fill="none" className={className}>
      <rect width="100" height="100" rx="22" fill="#1b5e20" />
      <path
        d="M32 30h18c8.84 0 16 7.16 16 16s-7.16 16-16 16H42v12H32V30zm10 22h8c3.31 0 6-2.69 6-6s-2.69-6-6-6h-8v12z"
        fill="#a5d6a7"
      />
      <circle cx="68" cy="66" r="6" fill="#ffeb3b" />
    </svg>
  )
}

export function FmcsaLogo({ className = "size-7" }: LogoProps) {
  return (
    <svg viewBox="0 0 100 100" fill="none" className={className}>
      <rect width="100" height="100" rx="22" fill="#002868" />
      <path d="M50 20l24 9v24c0 16-10 30-24 35-14-5-24-19-24-35V29l24-9z" fill="#bf0a30" />
      <path d="M50 26L68 33v18c0 12-8 23-18 27-10-4-18-15-18-27V33l18-7z" fill="#ffffff" />
      <circle cx="50" cy="48" r="8" fill="#002868" />
    </svg>
  )
}

export function Project44Logo({ className = "size-7" }: LogoProps) {
  return (
    <svg viewBox="0 0 100 100" fill="none" className={className}>
      <rect width="100" height="100" rx="22" fill="#0052cc" />
      <path d="M30 68V32l20 20h20v16H30z" fill="#00d084" />
      <circle cx="64" cy="40" r="8" fill="#ffffff" />
    </svg>
  )
}

export function FourKitesLogo({ className = "size-7" }: LogoProps) {
  return (
    <svg viewBox="0 0 100 100" fill="none" className={className}>
      <rect width="100" height="100" rx="22" fill="#0f172a" />
      <path d="M50 22L76 48 50 74 24 48 50 22z" fill="#38bdf8" />
      <circle cx="50" cy="48" r="9" fill="#0f172a" />
    </svg>
  )
}

export function ZapierLogo({ className = "size-7" }: LogoProps) {
  return (
    <svg viewBox="0 0 100 100" fill="none" className={className}>
      <rect width="100" height="100" rx="22" fill="#ff4f00" />
      <path d="M50 24v52M24 50h52M32 32l36 36M68 32L32 68" stroke="#ffffff" strokeWidth="8" strokeLinecap="round" />
    </svg>
  )
}

export function SlackLogo({ className = "size-7" }: LogoProps) {
  return (
    <svg viewBox="0 0 100 100" fill="none" className={className}>
      <rect width="100" height="100" rx="22" fill="#4a154b" />
      <circle cx="40" cy="40" r="8" fill="#36c5f0" />
      <circle cx="60" cy="40" r="8" fill="#2eb67d" />
      <circle cx="40" cy="60" r="8" fill="#e01e5a" />
      <circle cx="60" cy="60" r="8" fill="#ecb22e" />
    </svg>
  )
}

export function TwilioLogo({ className = "size-7" }: LogoProps) {
  return (
    <svg viewBox="0 0 100 100" fill="none" className={className}>
      <rect width="100" height="100" rx="22" fill="#f22f46" />
      <circle cx="50" cy="50" r="26" stroke="#ffffff" strokeWidth="6" />
      <circle cx="42" cy="42" r="5" fill="#ffffff" />
      <circle cx="58" cy="42" r="5" fill="#ffffff" />
      <circle cx="42" cy="58" r="5" fill="#ffffff" />
      <circle cx="58" cy="58" r="5" fill="#ffffff" />
    </svg>
  )
}

export function GenericPlatformLogo({
  name,
  category,
  className = "size-7",
}: {
  name: string
  category?: string
  className?: string
}) {
  const initials = name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase()

  // Generate deterministic subtle background color based on name hash
  const colors = [
    { bg: "#1e293b", text: "#94a3b8" },
    { bg: "#14532d", text: "#86efac" },
    { bg: "#1e3a8a", text: "#93c5fd" },
    { bg: "#581c87", text: "#d8b4fe" },
    { bg: "#701a75", text: "#f0abfc" },
    { bg: "#7c2d12", text: "#fdba74" },
    { bg: "#134e4a", text: "#5eead4" },
  ]
  const idx = Math.abs(name.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0)) % colors.length
  const c = colors[idx]

  return (
    <div
      className={`flex items-center justify-center rounded-[14px] font-geist-mono text-[11px] font-bold tracking-tight shadow-sm ${className}`}
      style={{ backgroundColor: c.bg, color: c.text }}
      title={name}
    >
      {initials}
    </div>
  )
}

export const LOGO_MAP: Record<string, React.FC<LogoProps>> = {
  samsara: SamsaraLogo,
  motive: MotiveLogo,
  geotab: GeotabLogo,
  dat: DatLogo,
  truckstop: TruckstopLogo,
  quickbooks: QuickBooksLogo,
  xero: XeroLogo,
  triumph: TriumphPayLogo,
  efs: WexLogo,
  wex: WexLogo,
  comdata: ComdataLogo,
  google_maps: GoogleMapsLogo,
  pcmiler: PcMilerLogo,
  fmcsa: FmcsaLogo,
  project44: Project44Logo,
  fourkites: FourKitesLogo,
  zapier: ZapierLogo,
  slack: SlackLogo,
  twilio: TwilioLogo,
}

export function PlatformLogo({
  id,
  name,
  category,
  className = "size-7",
}: {
  id: string
  name: string
  category?: string
  className?: string
}) {
  const LogoComponent = LOGO_MAP[id]
  if (LogoComponent) {
    return <LogoComponent className={className} />
  }
  return <GenericPlatformLogo name={name} category={category} className={className} />
}

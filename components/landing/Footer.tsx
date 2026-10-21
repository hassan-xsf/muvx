import { MuvxLogo } from "@/components/brand/muvx-logo";

/* ─────────────────────────────────────────────────────────────────────────────
 * Footer
 * ───────────────────────────────────────────────────────────────────────────── */

const COLS = [
  {
    header: "PRODUCT",
    links: ["Email to load", "Autonomy", "Plain-English rules", "Tracking", "Billing"],
  },
  { header: "WHO IT'S FOR", links: ["Freight brokers", "Asset carriers", "3PLs", "Shippers"] },
  { header: "COMPANY", links: ["About", "Careers", "Security", "Contact"] },
  { header: "RESOURCES", links: ["Docs", "Changelog", "Switching from another TMS", "Status"] },
] as const;

export default function Footer() {
  return (
    <footer className="w-full px-6 pt-16 sm:pt-24 md:px-16">
      {/* Links grid */}
      <div className="flex flex-col gap-10 lg:flex-row lg:gap-12">
        {/* Brand */}
        <div className="min-w-[200px] lg:flex-1">
          <MuvxLogo variant="horizontal" className="h-8 sm:h-9 w-auto" />
          <p className="mt-3 max-w-[280px] font-geist text-sm leading-[21px] text-[#4a4e57]">
            The AI-native TMS for brokers, carriers and 3PLs.
          </p>
        </div>

        {/* Link columns */}
        <div className="grid grid-cols-2 gap-8 sm:grid-cols-4 lg:flex lg:flex-wrap lg:gap-12">
          {COLS.map((col) => (
            <div key={col.header} className="flex flex-col gap-3">
              <span className="font-geist-mono text-[10px] font-medium tracking-[0.04em] text-[#8a8b8f]">
                {col.header}
              </span>
              {col.links.map((link) => (
                <a
                  key={link}
                  href="#"
                  className="font-geist text-sm text-[#4a4e57] transition-colors hover:text-[#16181d]"
                >
                  {link}
                </a>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* Bottom bar */}
      <div className="mt-12 sm:mt-14 flex flex-col items-start justify-between gap-3 sm:gap-4 border-t border-[#dcd5c9] py-5 font-geist-mono text-[9px] sm:text-[10px] tracking-[0.04em] text-[#8a8b8f] sm:flex-row sm:items-center">
        <span>
          © 2026 NOVA FREIGHT &nbsp;·&nbsp; SOC 2 TYPE II &nbsp;·&nbsp; PRIVACY &nbsp;·&nbsp; TERMS
        </span>
        <span>MADE FOR THE PEOPLE WHO KEEP FREIGHT MOVING</span>
      </div>

      {/* Giant wordmark */}
      <p className="overflow-hidden pb-8 font-serif text-[clamp(64px,22vw,360px)] leading-[0.72] tracking-[-0.04em] text-[#e7e0d3]">
        MuvxTMS
      </p>
    </footer>
  );
}

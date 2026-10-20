import { notFound, redirect } from "next/navigation"
import Link from "next/link"
import { ChevronLeft } from "lucide-react"
import {
  getSession,
  getLoadWithTripDetails,
  getWorkspaceProfile,
} from "@/lib/dal"
import { formatWorkspaceDate } from "@/lib/timezone"
import { PrintDocumentButton } from "@/components/tms/print-document-button"
import type { LoadStop } from "@/lib/tms-tax"

export const instant = false

export default async function RateConfirmationPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const session = await getSession()
  if (!session?.user) redirect("/login")
  const tenantId = session.session.activeOrganizationId
  if (!tenantId) redirect("/onboarding")

  const { id } = await params
  const [load, profile] = await Promise.all([
    getLoadWithTripDetails(id, tenantId),
    getWorkspaceProfile(tenantId),
  ])

  if (!load) notFound()

  // Parse stops if present
  let stops: LoadStop[] = []
  if (load.stops) {
    try {
      stops = JSON.parse(load.stops)
    } catch (e) {
      console.warn("Failed to parse stops JSON:", e)
    }
  }

  const rateConNumber = load.rateConfirmNumber || `RC-${load.loadNumber}`
  const formattedDate = formatWorkspaceDate(
    load.createdAt,
    profile?.timeZone,
    undefined,
    { mode: "date" }
  )

  const currencySymbol = load.currency === "CAD" ? "C$" : "$"
  const baseRate = parseFloat(load.rate || "0")
  const finalRate = parseFloat(load.finalRate || load.rate || "0")
  const taxRate = load.salesTaxRate ? parseFloat(load.salesTaxRate) / 100 : 0

  return (
    <div className="min-h-screen bg-brand-cream/30 dark:bg-zinc-950 p-4 lg:p-8 print:p-0 print:bg-white print:text-black">
      {/* ─── SCREEN-ONLY HEADER ─── */}
      <div className="max-w-4xl mx-auto mb-6 flex items-center justify-between print:hidden">
        <Link
          href={`/loads/${load.id}`}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-brand-muted-soft hover:text-brand-ink transition-colors"
        >
          <ChevronLeft className="size-3.5" />
          Back to load {load.loadNumber}
        </Link>
        <div className="flex items-center gap-2">
          <PrintDocumentButton label="Print Rate Confirmation" />
        </div>
      </div>

      {/* ─── PROFESSIONAL RATE CONFIRMATION DOCUMENT ─── */}
      <div className="print-document-container max-w-4xl mx-auto bg-white dark:bg-zinc-900 border border-brand-rule print:border-0 p-8 sm:p-10 shadow-sm print:p-0 print:shadow-none text-zinc-900 dark:text-zinc-100 text-xs rounded-lg print:rounded-none">
        {/* Header */}
        <div className="border-b-2 border-black pb-4 mb-4">
          <div className="flex justify-between items-start">
            <div>
              <h1 className="font-serif text-2xl font-bold tracking-tight text-black dark:text-white uppercase">
                {profile?.name || "MUVX FREIGHT LOGISTICS"}
              </h1>
              <p className="text-[11px] text-zinc-600 dark:text-zinc-400 mt-0.5">
                {[profile?.addressLine1, profile?.city, profile?.state, profile?.postalCode]
                  .filter(Boolean)
                  .join(", ")}
              </p>
              <p className="text-[10px] font-mono text-zinc-500 mt-1">
                {profile?.dotNumber ? `USDOT: ${profile.dotNumber}` : ""}
                {profile?.mcNumber ? ` · MC/FF: ${profile.mcNumber}` : ""}
                {profile?.phone ? ` · TEL: ${profile.phone}` : ""}
              </p>
            </div>

            <div className="text-right">
              <span className="inline-block px-2.5 py-0.5 border border-black font-mono font-bold text-[10px] uppercase bg-zinc-100 dark:bg-zinc-800">
                Rate Confirmation
              </span>
              <h2 className="font-mono text-base font-bold text-black dark:text-white mt-1">
                {rateConNumber}
              </h2>
              <p className="text-[10px] text-zinc-500 font-mono">Date: {formattedDate}</p>
            </div>
          </div>
        </div>

        {/* References Matrix */}
        <div className="grid grid-cols-4 border border-black divide-x divide-black text-[10px] mb-4 font-mono">
          <div className="p-2">
            <span className="text-zinc-500 block">LOAD NUMBER</span>
            <span className="font-bold text-black dark:text-white text-xs">{load.loadNumber}</span>
          </div>
          <div className="p-2">
            <span className="text-zinc-500 block">CUSTOMER TENDER #</span>
            <span className="font-bold text-black dark:text-white text-xs">{load.tenderNumber || "—"}</span>
          </div>
          <div className="p-2">
            <span className="text-zinc-500 block">EQUIPMENT TYPE</span>
            <span className="font-bold text-black dark:text-white text-xs">{load.loadType || "Dry Van"}</span>
          </div>
          <div className="p-2">
            <span className="text-zinc-500 block">PAYMENT TERMS</span>
            <span className="font-bold text-black dark:text-white text-xs">NET 30 / QUICKPAY</span>
          </div>
        </div>

        {/* Financial Compensation Breakdown */}
        <div className="border border-black p-4 mb-4 bg-zinc-50 dark:bg-zinc-800/40">
          <p className="font-mono text-[10px] font-bold uppercase tracking-wider text-black dark:text-white mb-2">
            AGREED FINANCIAL COMPENSATION ({load.currency || "USD"})
          </p>
          <div className="space-y-1.5 font-mono text-xs">
            <div className="flex justify-between">
              <span>Agreed Freight Linehaul:</span>
              <span className="font-bold">
                {currencySymbol}{baseRate.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
            {load.salesTaxAmount && parseFloat(load.salesTaxAmount) > 0 && (
              <div className="flex justify-between text-zinc-600 dark:text-zinc-400">
                <span>Sales Tax ({load.salesTaxType?.toUpperCase() || "TAX"}):</span>
                <span>
                  + {currencySymbol}{parseFloat(load.salesTaxAmount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
            )}
            <div className="flex justify-between pt-2 border-t border-black text-sm font-bold text-black dark:text-white">
              <span>TOTAL AGREED RATE:</span>
              <span>
                {currencySymbol}{finalRate.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {load.currency || "USD"}
              </span>
            </div>
          </div>
        </div>

        {/* Multi-Stop Routing & Itinerary */}
        <div className="border border-black mb-4">
          <div className="bg-zinc-100 dark:bg-zinc-800 p-2 border-b border-black font-mono text-[9px] font-bold uppercase tracking-wider">
            ROUTING & APPOINTMENT SCHEDULE
          </div>

          <div className="divide-y divide-black">
            {stops.length > 0 ? (
              stops.map((stop, i) => {
                const isPickup = stop.type === "pickup"
                return (
                  <div key={stop.id || i} className="p-3 flex justify-between items-start">
                    <div>
                      <span className="inline-block px-1.5 py-0.5 border border-black font-mono font-bold text-[9px] uppercase mr-2">
                        {isPickup ? "PICKUP" : "DELIVERY"} #{i + 1}
                      </span>
                      <span className="font-bold text-sm text-black dark:text-white">
                        {stop.facilityName || `${stop.city}, ${stop.state}`}
                      </span>
                      <p className="text-[11px] text-zinc-600 dark:text-zinc-400 mt-0.5">
                        {stop.address ? `${stop.address}, ` : ""}
                        {stop.city}, {stop.state} {stop.zip}
                      </p>
                      {stop.contactPhone && (
                        <p className="text-[10px] text-zinc-500 font-mono mt-0.5">
                          Tel: {stop.contactPhone}
                        </p>
                      )}
                    </div>
                    <div className="text-right font-mono text-[11px]">
                      <span className="block font-bold">
                        {stop.appointmentDate || "Scheduled Date"}
                      </span>
                      <span className="text-zinc-500">
                        {stop.appointmentTime || "Appointment TBA"}
                      </span>
                    </div>
                  </div>
                )
              })
            ) : (
              <>
                <div className="p-3 flex justify-between items-start">
                  <div>
                    <span className="inline-block px-1.5 py-0.5 border border-black font-mono font-bold text-[9px] uppercase mr-2">
                      PICKUP
                    </span>
                    <span className="font-bold text-sm text-black dark:text-white">
                      {load.originCity}, {load.originState}
                    </span>
                    {load.originAddress && (
                      <p className="text-[11px] text-zinc-600 dark:text-zinc-400 mt-0.5">
                        {load.originAddress}
                      </p>
                    )}
                  </div>
                  <div className="text-right font-mono text-[11px]">
                    <span className="block font-bold">
                      {load.pickupDate ? formatWorkspaceDate(load.pickupDate, profile?.timeZone, undefined, { mode: "date" }) : "Scheduled"}
                    </span>
                  </div>
                </div>

                <div className="p-3 flex justify-between items-start">
                  <div>
                    <span className="inline-block px-1.5 py-0.5 border border-black font-mono font-bold text-[9px] uppercase mr-2">
                      DELIVERY
                    </span>
                    <span className="font-bold text-sm text-black dark:text-white">
                      {load.destCity}, {load.destState}
                    </span>
                    {load.destAddress && (
                      <p className="text-[11px] text-zinc-600 dark:text-zinc-400 mt-0.5">
                        {load.destAddress}
                      </p>
                    )}
                  </div>
                  <div className="text-right font-mono text-[11px]">
                    <span className="block font-bold">
                      {load.deliveryDate ? formatWorkspaceDate(load.deliveryDate, profile?.timeZone, undefined, { mode: "date" }) : "Scheduled"}
                    </span>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Cargo Specs & Special Instructions */}
        <div className="border border-black p-3 mb-4 space-y-1">
          <p className="font-mono text-[9px] font-bold uppercase tracking-wider text-zinc-500">
            CARGO SPECIFICATIONS & INSTRUCTIONS
          </p>
          <div className="grid grid-cols-3 gap-2 font-mono text-[11px] pt-1">
            <div>
              <span className="text-zinc-500 block text-[9px]">COMMODITY:</span>
              <span className="font-semibold">{load.commodity || "General Freight"}</span>
            </div>
            <div>
              <span className="text-zinc-500 block text-[9px]">WEIGHT:</span>
              <span className="font-semibold">{load.weight ? `${load.weight} lbs` : "—"}</span>
            </div>
            <div>
              <span className="text-zinc-500 block text-[9px]">TEMPERATURE:</span>
              <span className="font-semibold">
                {load.isRefrigerated ? load.temperature || "Continuous Reefer" : "Dry / Ambient"}
              </span>
            </div>
          </div>
          {load.specialInstructions && (
            <p className="text-[10px] text-zinc-700 dark:text-zinc-300 pt-2 border-t border-zinc-200 dark:border-zinc-800">
              Note: {load.specialInstructions}
            </p>
          )}
        </div>

        {/* Carrier Terms & Conditions */}
        <div className="text-[8px] text-zinc-500 leading-tight mb-6 border border-zinc-300 dark:border-zinc-700 p-2 space-y-1">
          <p className="font-bold text-black dark:text-white">TERMS AND CONDITIONS:</p>
          <p>
            1. Carrier agrees to transport the shipment in accordance with all federal and state FMCSA regulations.
          </p>
          <p>
            2. Two (2) hours free time allowed for loading and unloading. Detention is $50/hour thereafter, provided dispatcher is notified at least 30 minutes prior to detention commencement.
          </p>
          <p>
            3. Clean Bill of Lading (POD) signed by consignee must be submitted with carrier invoice to receive payment.
          </p>
          <p>
            4. Double-brokering is strictly prohibited and results in immediate forfeiture of freight compensation.
          </p>
        </div>

        {/* Signatures & Acceptance */}
        <div className="grid grid-cols-2 border border-black divide-x divide-black text-[9px] font-mono">
          <div className="p-3 space-y-4">
            <span className="font-bold uppercase block text-black dark:text-white">
              AUTHORIZED BROKER / DISPATCHER
            </span>
            <div className="pt-6 border-b border-black" />
            <div className="flex justify-between text-zinc-500 text-[8px]">
              <span>Authorized Signature</span>
              <span>Date</span>
            </div>
          </div>

          <div className="p-3 space-y-4">
            <span className="font-bold uppercase block text-black dark:text-white">
              CARRIER ACCEPTANCE & SIGNATURE
            </span>
            <div className="pt-6 border-b border-black" />
            <div className="flex justify-between text-zinc-500 text-[8px]">
              <span>Carrier Signature / Printed Name</span>
              <span>Date</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

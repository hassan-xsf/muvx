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

export default async function BillOfLadingPage({
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

  const pickups = stops.filter((s) => s.type === "pickup")
  const deliveries = stops.filter((s) => s.type === "delivery")

  const primaryShipper =
    pickups[0] || {
      facilityName: load.customerName || "Shipper Facility",
      address: load.originAddress || "",
      city: load.originCity || "",
      state: load.originState || "",
      zip: load.originZip || "",
      contactName: load.originContact || "",
      contactPhone: load.originPhone || "",
      notes: "",
    }

  const primaryConsignee =
    deliveries[deliveries.length - 1] || {
      facilityName: "Receiving Facility",
      address: load.destAddress || "",
      city: load.destCity || "",
      state: load.destState || "",
      zip: load.destZip || "",
      contactName: load.destContact || "",
      contactPhone: load.destPhone || "",
      notes: "",
    }

  const bolNumber = load.bolNumber || `BOL-${load.loadNumber}`
  const formattedDate = formatWorkspaceDate(
    load.pickupDate || load.createdAt,
    profile?.timeZone,
    undefined,
    { mode: "date" }
  )

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
          <PrintDocumentButton label="Print Bill of Lading" />
        </div>
      </div>

      {/* ─── PROFESSIONAL BILL OF LADING DOCUMENT ─── */}
      <div className="print-document-container max-w-4xl mx-auto bg-white dark:bg-zinc-900 border border-brand-rule print:border-0 p-8 sm:p-10 shadow-sm print:p-0 print:shadow-none text-zinc-900 dark:text-zinc-100 text-xs rounded-lg print:rounded-none">
        {/* Document Header */}
        <div className="border-b-2 border-black pb-4 mb-4">
          <div className="flex justify-between items-start">
            <div>
              <h1 className="font-serif text-2xl font-bold tracking-tight text-black dark:text-white uppercase">
                {profile?.name || "MUVX CARRIER LOGISTICS"}
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
              <span className="inline-block px-2 py-0.5 border border-black font-mono font-bold text-[10px] uppercase">
                Original — Non-Negotiable
              </span>
              <h2 className="font-mono text-base font-bold text-black dark:text-white mt-1">
                {bolNumber}
              </h2>
              <p className="text-[10px] text-zinc-500 font-mono">Date: {formattedDate}</p>
            </div>
          </div>

          <div className="mt-3 text-center">
            <h3 className="font-sans text-xs font-bold uppercase tracking-wider text-black dark:text-white">
              Standard Uniform Straight Bill of Lading
            </h3>
          </div>
        </div>

        {/* References Grid */}
        <div className="grid grid-cols-4 border border-black divide-x divide-black text-[10px] mb-4 font-mono">
          <div className="p-2">
            <span className="text-zinc-500 block">LOAD NUMBER</span>
            <span className="font-bold text-black dark:text-white text-xs">{load.loadNumber}</span>
          </div>
          <div className="p-2">
            <span className="text-zinc-500 block">CUSTOMER TENDER / REF</span>
            <span className="font-bold text-black dark:text-white text-xs">{load.tenderNumber || "—"}</span>
          </div>
          <div className="p-2">
            <span className="text-zinc-500 block">EQUIPMENT TYPE</span>
            <span className="font-bold text-black dark:text-white text-xs">{load.loadType || "Dry Van"}</span>
          </div>
          <div className="p-2">
            <span className="text-zinc-500 block">SPECIAL PROTECTIVE</span>
            <span className="font-bold text-black dark:text-white text-xs">
              {load.isRefrigerated ? `REEFER: ${load.temperature || "TEMP CONTROL"}` : "STANDARD DRY"}
            </span>
          </div>
        </div>

        {/* Shipper & Consignee Columns */}
        <div className="grid grid-cols-2 border border-black divide-x divide-black mb-4">
          {/* Shipper */}
          <div className="p-3 space-y-1">
            <p className="font-mono text-[9px] font-bold uppercase tracking-wider text-zinc-500 border-b border-zinc-200 dark:border-zinc-800 pb-1">
              SHIP FROM / SHIPPER (ORIGIN)
            </p>
            <p className="font-bold text-sm text-black dark:text-white">{primaryShipper.facilityName}</p>
            {primaryShipper.address && <p>{primaryShipper.address}</p>}
            <p className="font-medium">
              {primaryShipper.city}, {primaryShipper.state} {primaryShipper.zip}
            </p>
            {primaryShipper.contactPhone && (
              <p className="text-[10px] text-zinc-500">Contact: {primaryShipper.contactPhone}</p>
            )}
            {primaryShipper.appointmentDate && (
              <p className="text-[10px] font-mono text-zinc-700 dark:text-zinc-300">
                Pickup Appt: {primaryShipper.appointmentDate} {primaryShipper.appointmentTime || ""}
              </p>
            )}
          </div>

          {/* Consignee */}
          <div className="p-3 space-y-1">
            <p className="font-mono text-[9px] font-bold uppercase tracking-wider text-zinc-500 border-b border-zinc-200 dark:border-zinc-800 pb-1">
              SHIP TO / CONSIGNEE (DESTINATION)
            </p>
            <p className="font-bold text-sm text-black dark:text-white">{primaryConsignee.facilityName}</p>
            {primaryConsignee.address && <p>{primaryConsignee.address}</p>}
            <p className="font-medium">
              {primaryConsignee.city}, {primaryConsignee.state} {primaryConsignee.zip}
            </p>
            {primaryConsignee.contactPhone && (
              <p className="text-[10px] text-zinc-500">Contact: {primaryConsignee.contactPhone}</p>
            )}
            {primaryConsignee.appointmentDate && (
              <p className="text-[10px] font-mono text-zinc-700 dark:text-zinc-300">
                Delivery Appt: {primaryConsignee.appointmentDate} {primaryConsignee.appointmentTime || ""}
              </p>
            )}
          </div>
        </div>

        {/* Carrier & Equipment Assignment */}
        <div className="border border-black p-3 mb-4 space-y-1 bg-zinc-50 dark:bg-zinc-800/40">
          <p className="font-mono text-[9px] font-bold uppercase tracking-wider text-zinc-500">
            CARRIER & DISPATCH ASSIGNMENT
          </p>
          <div className="grid grid-cols-4 gap-2 font-mono text-[11px] pt-1">
            <div>
              <span className="text-zinc-500 block text-[9px]">DRIVER NAME:</span>
              <span className="font-semibold text-black dark:text-white">
                {load.trip
                  ? `${load.trip.driverFirstName} ${load.trip.driverLastName}`
                  : "Assigned Fleet Driver"}
              </span>
            </div>
            <div>
              <span className="text-zinc-500 block text-[9px]">TRACTOR / TRUCK #:</span>
              <span className="font-semibold text-black dark:text-white">
                {load.trip?.truckUnitNumber || "Power Unit #"}
              </span>
            </div>
            <div>
              <span className="text-zinc-500 block text-[9px]">TRAILER #:</span>
              <span className="font-semibold text-black dark:text-white">
                {load.trip?.trailerUnitNumber || "53' Trailer #"}
              </span>
            </div>
            <div>
              <span className="text-zinc-500 block text-[9px]">SEAL NUMBER:</span>
              <span className="font-semibold text-black dark:text-white">
                ____________________
              </span>
            </div>
          </div>
        </div>

        {/* Freight / Cargo Item Table */}
        <div className="border border-black mb-4">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="border-b border-black bg-zinc-100 dark:bg-zinc-800 text-[9px] font-mono uppercase tracking-wider">
                <th className="p-2 border-r border-black w-24">Handling Units</th>
                <th className="p-2 border-r border-black">Kind of Packaging, Description of Articles, Special Marks</th>
                <th className="p-2 border-r border-black w-28 text-right">Weight (lbs)</th>
                <th className="p-2 w-20 text-center">H.M.</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black font-sans text-xs">
              <tr className="min-h-16">
                <td className="p-2.5 border-r border-black font-mono">
                  Standard Pallets / TL
                </td>
                <td className="p-2.5 border-r border-black">
                  <p className="font-bold text-black dark:text-white">
                    {load.commodity || "Freight of All Kinds (FAK)"}
                  </p>
                  {load.isRefrigerated && (
                    <p className="text-[10px] font-mono text-blue-700 dark:text-blue-400 mt-1">
                      ** PROTECT FROM HEAT/FREEZE — MAINTAIN {load.temperature || "CONTINUOUS REEFER TEMP"} **
                    </p>
                  )}
                  {load.specialInstructions && (
                    <p className="text-[10px] text-zinc-600 dark:text-zinc-400 mt-1">
                      Special Handling: {load.specialInstructions}
                    </p>
                  )}
                </td>
                <td className="p-2.5 border-r border-black text-right font-mono font-bold">
                  {load.weight ? `${Number(load.weight).toLocaleString()} lbs` : "40,000 lbs (est)"}
                </td>
                <td className="p-2.5 text-center font-mono text-zinc-400">
                  NO
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Legal Boilerplate Clause */}
        <div className="text-[8px] text-zinc-500 leading-tight mb-6 border border-zinc-300 dark:border-zinc-700 p-2">
          RECEIVED, subject to individually determined rates or contracts that have been agreed upon in writing between the carrier and shipper, if applicable, otherwise to the rates, classifications, and rules that have been established by the carrier and are available to the shipper, on request. The property described above, in apparent good order, except as noted. The carrier agrees to carry said property to its usual place of delivery at said destination. Shipper certifies that the above named materials are properly classified, described, packaged, marked, and labeled.
        </div>

        {/* Signatures Grid */}
        <div className="grid grid-cols-3 border border-black divide-x divide-black text-[9px] font-mono">
          {/* Shipper Certification */}
          <div className="p-3 space-y-4">
            <span className="font-bold uppercase block text-black dark:text-white">SHIPPER SIGNATURE</span>
            <p className="text-zinc-500 text-[8px] leading-tight">
              This is to certify that the above named materials are properly packaged and described.
            </p>
            <div className="pt-6 border-b border-black" />
            <div className="flex justify-between text-zinc-500 text-[8px]">
              <span>Signature</span>
              <span>Date</span>
            </div>
          </div>

          {/* Carrier / Driver Acknowledgment */}
          <div className="p-3 space-y-4">
            <span className="font-bold uppercase block text-black dark:text-white">CARRIER / DRIVER</span>
            <p className="text-zinc-500 text-[8px] leading-tight">
              Carrier acknowledges receipt of packages and required placards in good condition.
            </p>
            <div className="pt-6 border-b border-black" />
            <div className="flex justify-between text-zinc-500 text-[8px]">
              <span>Driver Signature</span>
              <span>Date</span>
            </div>
          </div>

          {/* Consignee Delivery Confirmation */}
          <div className="p-3 space-y-4">
            <span className="font-bold uppercase block text-black dark:text-white">CONSIGNEE (RECEIVER)</span>
            <p className="text-zinc-500 text-[8px] leading-tight">
              Received in apparent good condition except as noted on this delivery receipt.
            </p>
            <div className="pt-6 border-b border-black" />
            <div className="flex justify-between text-zinc-500 text-[8px]">
              <span>Receiver Signature</span>
              <span>Date</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

import { notFound, redirect } from "next/navigation"
import Link from "next/link"
import {
  MapPin,
  Navigation,
  Truck,
  User,
  Phone,
  Mail,
  Calendar,
  Clock,
  ArrowLeft,
  ArrowUpRight,
  ExternalLink,
  DollarSign,
  Fuel,
  Receipt,
  FileText,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
  Container,
} from "lucide-react"
import { getSession, getTripByIdWithDetails, getExpensesWithDetailsForOrg, getDriversForOrg } from "@/lib/dal"
import { getEffectivePermissions } from "@/lib/can"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { StatusBadge } from "@/components/status-badge"
import { TripStatusUpdater } from "@/components/tms/trip-status-updater"
import { RecordExpenseDialog } from "@/components/tms/record-expense-dialog"
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "@/components/ui/table"

export const instant = false

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function TripDetailPage({ params }: PageProps) {
  const { id } = await params
  const session = await getSession()
  if (!session?.user) redirect("/login")
  const tenantId = session.session.activeOrganizationId
  if (!tenantId) redirect("/onboarding")

  const perms = await getEffectivePermissions(session.user.id, tenantId)
  if (
    !perms.has("loads.module") &&
    !perms.has("loads.view_assigned") &&
    !perms.has("loads.view_all") &&
    !perms.has("loads.view_own")
  ) {
    redirect("/")
  }

  const [trip, expenses, drivers] = await Promise.all([
    getTripByIdWithDetails(id, tenantId),
    getExpensesWithDetailsForOrg(tenantId),
    getDriversForOrg(tenantId),
  ])

  if (!trip) {
    notFound()
  }

  // Filter expenses associated with this trip or linked load
  const tripExpenses = expenses.filter(
    (e) =>
      (trip.tripNumber && e.tripNumber === trip.tripNumber) ||
      (trip.loadNumber && e.loadNumber === trip.loadNumber)
  )

  const totalTripExpenses = tripExpenses.reduce(
    (sum, e) => sum + parseFloat(e.amount || "0"),
    0
  )

  const mapUrl =
    trip.originCity && trip.destCity
      ? `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(
          `${trip.originCity}, ${trip.originState || ""}`
        )}&destination=${encodeURIComponent(`${trip.destCity}, ${trip.destState || ""}`)}`
      : null

  const isCompleted = trip.status === "completed"
  const isInProgress = trip.status === "in_progress"

  return (
    <div className="p-4 lg:p-8 space-y-6 max-w-7xl mx-auto">
      {/* ─── BREADCRUMB & BACK LINK ─── */}
      <div className="flex items-center gap-2 text-xs text-brand-muted-soft">
        <Link
          href="/trips"
          className="inline-flex items-center gap-1 hover:text-brand-ink transition-colors font-medium"
        >
          <ArrowLeft className="size-3.5" />
          Back to Trips
        </Link>
        <span>/</span>
        <span className="font-mono text-brand-ink font-semibold">{trip.tripNumber}</span>
      </div>

      {/* ─── HEADER COCKPIT ─── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-brand-rule">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="font-serif text-3xl tracking-tight text-brand-ink">
              Trip <span className="italic text-[#d9622b]">{trip.tripNumber}</span>
            </h1>
            <StatusBadge status={trip.status} />
            {trip.loadId && (
              <Badge variant="outline" className="font-mono text-xs border-brand-rule bg-brand-cream/50">
                Linked Load: {trip.loadNumber || trip.loadId}
              </Badge>
            )}
          </div>
          <p className="mt-1 text-sm text-[#73757a] flex items-center gap-2">
            <span>
              {trip.originCity ? `${trip.originCity}, ${trip.originState || ""}` : "Origin unassigned"} →{" "}
              {trip.destCity ? `${trip.destCity}, ${trip.destState || ""}` : "Destination unassigned"}
            </span>
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-2.5">
          <TripStatusUpdater tripId={trip.id} currentStatus={trip.status} />

          {mapUrl && (
            <a
              href={mapUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-full border border-brand-rule text-xs font-medium text-brand-ink hover:bg-brand-cream transition-colors shadow-2xs"
            >
              <Navigation className="size-3.5 text-blue-600" />
              Live Route
              <ExternalLink className="size-3 opacity-60" />
            </a>
          )}

          <RecordExpenseDialog
            trips={[{ id: trip.id, tripNumber: trip.tripNumber, loadNumber: trip.loadNumber }]}
            drivers={drivers}
          />

          {trip.loadId && (
            <>
              <Link
                href={`/loads/${trip.loadId}`}
                className="inline-flex items-center gap-1.5 h-9 px-4 rounded-full bg-brand-ink text-brand-cream text-xs font-medium hover:bg-brand-ink/90 transition-colors shadow-xs"
              >
                <Truck className="size-3.5 text-[#d9622b]" />
                Open Load Manifest
              </Link>
              <Link
                href={`/loads/${trip.loadId}/bol`}
                className="inline-flex items-center gap-1.5 h-9 px-3 rounded-full border border-brand-rule text-xs font-medium text-brand-ink hover:bg-brand-cream transition-colors"
              >
                <FileText className="size-3.5 text-brand-muted-soft" />
                BOL
              </Link>
              <Link
                href={`/loads/${trip.loadId}/rate-con`}
                className="inline-flex items-center gap-1.5 h-9 px-3 rounded-full border border-brand-rule text-xs font-medium text-brand-ink hover:bg-brand-cream transition-colors"
              >
                <Receipt className="size-3.5 text-brand-muted-soft" />
                Rate Con
              </Link>
            </>
          )}
        </div>
      </div>

      {/* ─── COCKPIT KPI CARDS (Dashboard Aesthetic) ─── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Route Mileage */}
        <Card className="border-brand-rule bg-brand-card p-5">
          <div className="flex items-start justify-between mb-3">
            <div className="flex size-9 items-center justify-center rounded-lg bg-brand-accent-tint text-brand-accent">
              <Navigation className="h-4 w-4" strokeWidth={1.8} />
            </div>
          </div>
          <p className="font-serif text-3xl tracking-tight text-brand-ink">
            {trip.totalMiles ? `${trip.totalMiles}` : "—"}
          </p>
          <p className="text-xs mt-0.5 text-brand-muted-soft">Trip Mileage</p>
          <p className="text-[10px] mt-1 italic text-brand-muted-soft/70">Planned route miles</p>
        </Card>

        {/* Tractor Unit */}
        <Card className="border-brand-rule bg-brand-card p-5">
          <div className="flex items-start justify-between mb-3">
            <div className="flex size-9 items-center justify-center rounded-lg bg-blue-500/10 text-blue-700">
              <Truck className="h-4 w-4" strokeWidth={1.8} />
            </div>
          </div>
          <p className="font-serif text-3xl tracking-tight text-brand-ink">
            {trip.truckUnitNumber || "Unassigned"}
          </p>
          <p className="text-xs mt-0.5 text-brand-muted-soft">Power Unit (Truck)</p>
          <p className="text-[10px] mt-1 italic text-brand-muted-soft/70">
            {trip.truckMake ? `${trip.truckMake} ${trip.truckModel || ""}` : "No unit linked"}
          </p>
        </Card>

        {/* Assigned Driver / Carrier */}
        <Card className="border-brand-rule bg-brand-card p-5">
          <div className="flex items-start justify-between mb-3">
            <div className="flex size-9 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-700">
              <User className="h-4 w-4" strokeWidth={1.8} />
            </div>
          </div>
          <p className="font-serif text-2xl tracking-tight text-brand-ink truncate">
            {trip.driverFirstName ? `${trip.driverFirstName} ${trip.driverLastName || ""}` : trip.carrierName || "Pending"}
          </p>
          <p className="text-xs mt-0.5 text-brand-muted-soft">
            {trip.carrierName ? "Brokered Carrier" : "Assigned Driver"}
          </p>
          <p className="text-[10px] mt-1 italic text-brand-muted-soft/70">
            {trip.driverPhone || trip.carrierPhone || "Contact details on file"}
          </p>
        </Card>

        {/* Realized Trip Expenses */}
        <Card className="border-brand-rule bg-brand-card p-5">
          <div className="flex items-start justify-between mb-3">
            <div className="flex size-9 items-center justify-center rounded-lg bg-purple-500/10 text-purple-700">
              <Receipt className="h-4 w-4" strokeWidth={1.8} />
            </div>
          </div>
          <p className="font-serif text-3xl tracking-tight text-purple-700">
            ${totalTripExpenses.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
          <p className="text-xs mt-0.5 text-brand-muted-soft">Logged Direct Costs</p>
          <p className="text-[10px] mt-1 italic text-brand-muted-soft/70">
            {tripExpenses.length} receipts attached
          </p>
        </Card>
      </div>

      {/* ─── TRIP MILESTONE PROGRESSION ─── */}
      <Card className="border-brand-rule bg-brand-card p-6">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-brand-muted-soft mb-4">
          Trip Execution Status
        </h2>
        <div className="relative flex flex-col md:flex-row items-center justify-between gap-4">
          {/* Step 1: Dispatched */}
          <div className="flex items-center gap-3 w-full md:w-auto">
            <div className="flex size-8 items-center justify-center rounded-full bg-emerald-500 text-white text-xs font-bold shadow-sm">
              <CheckCircle2 className="size-4" />
            </div>
            <div>
              <p className="text-xs font-semibold text-brand-ink">1. Trip Dispatched</p>
              <p className="text-[11px] text-brand-muted-soft">Equipment & driver assigned</p>
            </div>
          </div>

          <div className="hidden md:block flex-1 h-[2px] bg-brand-rule mx-2" />

          {/* Step 2: In Transit */}
          <div className="flex items-center gap-3 w-full md:w-auto">
            <div
              className={`flex size-8 items-center justify-center rounded-full text-xs font-bold shadow-sm ${
                isInProgress || isCompleted
                  ? "bg-[#d9622b] text-white"
                  : "bg-brand-cream text-brand-muted-soft border border-brand-rule"
              }`}
            >
              <Navigation className="size-4" />
            </div>
            <div>
              <p className="text-xs font-semibold text-brand-ink">2. En Route / Highway</p>
              <p className="text-[11px] text-brand-muted-soft">Rolling towards delivery</p>
            </div>
          </div>

          <div className="hidden md:block flex-1 h-[2px] bg-brand-rule mx-2" />

          {/* Step 3: Delivered */}
          <div className="flex items-center gap-3 w-full md:w-auto">
            <div
              className={`flex size-8 items-center justify-center rounded-full text-xs font-bold shadow-sm ${
                isCompleted
                  ? "bg-emerald-600 text-white"
                  : "bg-brand-cream text-brand-muted-soft border border-brand-rule"
              }`}
            >
              <CheckCircle2 className="size-4" />
            </div>
            <div>
              <p className="text-xs font-semibold text-brand-ink">3. Completed / Delivered</p>
              <p className="text-[11px] text-brand-muted-soft">POD received & closed out</p>
            </div>
          </div>
        </div>
      </Card>

      {/* ─── TWO-COLUMN DETAILS SECTION ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Route & Manifest Details (2 cols) */}
        <div className="lg:col-span-2 space-y-6">
          {/* Manifest Card */}
          <Card className="border-brand-rule bg-brand-card overflow-hidden">
            <div className="px-5 py-4 border-b border-brand-rule bg-brand-cream/30 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MapPin className="size-4 text-[#d9622b]" />
                <h3 className="font-semibold text-xs tracking-wide uppercase text-brand-ink">
                  Route Manifest & Coordinates
                </h3>
              </div>
              {mapUrl && (
                <a
                  href={mapUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-brand-accent hover:underline inline-flex items-center gap-1 font-medium"
                >
                  Open in Google Maps
                  <ExternalLink className="size-3" />
                </a>
              )}
            </div>

            <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Origin */}
              <div className="p-4 rounded-xl border border-brand-rule/60 bg-brand-cream/20 space-y-2">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-brand-muted-soft">
                  <div className="size-2 rounded-full bg-emerald-500" />
                  ORIGIN / SHIPPER
                </div>
                <p className="font-serif text-lg text-brand-ink font-semibold">
                  {trip.originCity ? `${trip.originCity}, ${trip.originState || ""}` : "Unspecified"}
                </p>
                <p className="text-xs text-brand-muted-soft">Zip Code: {trip.originZip || "—"}</p>
                {trip.pickupDate && (
                  <p className="text-xs text-brand-muted-soft flex items-center gap-1 pt-1">
                    <Calendar className="size-3 text-[#d9622b]" />
                    Pickup: {new Date(trip.pickupDate).toLocaleDateString()}
                  </p>
                )}
              </div>

              {/* Destination */}
              <div className="p-4 rounded-xl border border-brand-rule/60 bg-brand-cream/20 space-y-2">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-brand-muted-soft">
                  <div className="size-2 rounded-full bg-red-500" />
                  DESTINATION / CONSIGNEE
                </div>
                <p className="font-serif text-lg text-brand-ink font-semibold">
                  {trip.destCity ? `${trip.destCity}, ${trip.destState || ""}` : "Unspecified"}
                </p>
                <p className="text-xs text-brand-muted-soft">Zip Code: {trip.destZip || "—"}</p>
                {trip.deliveryDate && (
                  <p className="text-xs text-brand-muted-soft flex items-center gap-1 pt-1">
                    <Calendar className="size-3 text-[#d9622b]" />
                    Delivery: {new Date(trip.deliveryDate).toLocaleDateString()}
                  </p>
                )}
              </div>
            </div>

            {/* Cargo Specifics */}
            <div className="px-5 pb-5 grid grid-cols-2 sm:grid-cols-4 gap-4 border-t border-brand-rule/60 pt-4 text-xs">
              <div>
                <span className="text-brand-muted-soft block">Commodity</span>
                <span className="font-medium text-brand-ink">{trip.commodity || "General Freight"}</span>
              </div>
              <div>
                <span className="text-brand-muted-soft block">Weight</span>
                <span className="font-medium text-brand-ink">
                  {trip.weight ? `${Number(trip.weight).toLocaleString()} lbs` : "—"}
                </span>
              </div>
              <div>
                <span className="text-brand-muted-soft block">Trailer Equipment</span>
                <span className="font-medium text-brand-ink">
                  {trip.trailerUnitNumber ? `#${trip.trailerUnitNumber} (${trip.trailerType || "Dry Van"})` : "—"}
                </span>
              </div>
              <div>
                <span className="text-brand-muted-soft block">Carrier Rate</span>
                <span className="font-medium text-brand-ink">
                  {trip.carrierRate ? `$${trip.carrierRate}` : "Fleet Asset"}
                </span>
              </div>
            </div>
          </Card>

          {/* Related Trip Expenses Ledger */}
          <Card className="border-brand-rule bg-brand-card overflow-hidden">
            <div className="px-5 py-4 border-b border-brand-rule bg-brand-cream/30 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Receipt className="size-4 text-purple-600" />
                <h3 className="font-semibold text-xs tracking-wide uppercase text-brand-ink">
                  Attached Trip Expenses & Receipts
                </h3>
              </div>
              <RecordExpenseDialog
                trips={[{ id: trip.id, tripNumber: trip.tripNumber, loadNumber: trip.loadNumber }]}
                drivers={drivers}
              />
            </div>

            <Table>
              <TableHeader>
                <TableRow className="border-brand-rule hover:bg-transparent">
                  <TableHead className="text-xs font-semibold text-brand-muted-soft">Category</TableHead>
                  <TableHead className="text-xs font-semibold text-brand-muted-soft">Vendor</TableHead>
                  <TableHead className="text-xs font-semibold text-brand-muted-soft">Date</TableHead>
                  <TableHead className="text-xs font-semibold text-brand-muted-soft text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody className="divide-y divide-brand-rule">
                {tripExpenses.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="h-24 text-center text-xs text-brand-muted-soft">
                      No operational expenses or fuel receipts logged for this trip yet.
                    </TableCell>
                  </TableRow>
                ) : (
                  tripExpenses.map((exp) => (
                    <TableRow key={exp.id} className="hover:bg-brand-cream/40">
                      <TableCell className="text-xs font-medium text-brand-ink capitalize">
                        {exp.type || "General"}
                      </TableCell>
                      <TableCell className="text-xs text-brand-muted-soft">{exp.vendor || "—"}</TableCell>
                      <TableCell className="text-xs text-brand-muted-soft">
                        {exp.date ? new Date(exp.date).toLocaleDateString() : "—"}
                      </TableCell>
                      <TableCell className="text-xs font-mono font-semibold text-brand-ink text-right">
                        ${parseFloat(exp.amount || "0").toFixed(2)}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </Card>
        </div>

        {/* Right Column: Driver & Equipment Sidebar (1 col) */}
        <div className="space-y-6">
          {/* Driver Card */}
          <Card className="border-brand-rule bg-brand-card p-5 space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b border-brand-rule">
              <User className="size-4 text-[#d9622b]" />
              <h3 className="font-semibold text-xs tracking-wide uppercase text-brand-ink">
                Assigned Personnel
              </h3>
            </div>

            {trip.driverFirstName ? (
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="size-11 rounded-full bg-brand-cream flex items-center justify-center border border-brand-rule text-brand-ink font-bold text-sm">
                    {trip.driverFirstName[0]}
                    {trip.driverLastName ? trip.driverLastName[0] : ""}
                  </div>
                  <div>
                    <p className="font-semibold text-sm text-brand-ink">
                      {trip.driverFirstName} {trip.driverLastName || ""}
                    </p>
                    <p className="text-xs text-brand-muted-soft">Company Driver</p>
                  </div>
                </div>

                {trip.driverPhone && (
                  <div className="pt-2">
                    <a
                      href={`tel:${trip.driverPhone}`}
                      className="flex items-center gap-2 text-xs font-medium text-brand-accent hover:underline p-2 rounded-lg bg-brand-cream/60"
                    >
                      <Phone className="size-3.5" />
                      {trip.driverPhone}
                    </a>
                  </div>
                )}

                {trip.driverEmail && (
                  <div>
                    <a
                      href={`mailto:${trip.driverEmail}`}
                      className="flex items-center gap-2 text-xs text-brand-muted-soft hover:underline truncate"
                    >
                      <Mail className="size-3.5" />
                      {trip.driverEmail}
                    </a>
                  </div>
                )}
              </div>
            ) : trip.carrierName ? (
              <div className="space-y-3">
                <div>
                  <p className="font-semibold text-sm text-brand-ink">{trip.carrierName}</p>
                  <p className="text-xs text-brand-muted-soft">DOT #{trip.carrierDotNumber || "—"}</p>
                </div>
                {trip.carrierPhone && (
                  <a
                    href={`tel:${trip.carrierPhone}`}
                    className="flex items-center gap-2 text-xs font-medium text-brand-accent hover:underline p-2 rounded-lg bg-brand-cream/60"
                  >
                    <Phone className="size-3.5" />
                    {trip.carrierPhone}
                  </a>
                )}
              </div>
            ) : (
              <p className="text-xs text-brand-muted-soft">No driver or external carrier linked to this trip.</p>
            )}
          </Card>

          {/* Assigned Equipment */}
          <Card className="border-brand-rule bg-brand-card p-5 space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b border-brand-rule">
              <Truck className="size-4 text-blue-600" />
              <h3 className="font-semibold text-xs tracking-wide uppercase text-brand-ink">
                Equipment Fleet Units
              </h3>
            </div>

            <div className="space-y-3 text-xs">
              <div className="flex justify-between items-center py-1 border-b border-brand-rule/40">
                <span className="text-brand-muted-soft">Truck / Tractor:</span>
                <span className="font-mono font-semibold text-brand-ink">
                  {trip.truckUnitNumber ? `#${trip.truckUnitNumber}` : "Unassigned"}
                </span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-brand-rule/40">
                <span className="text-brand-muted-soft">Make / Model:</span>
                <span className="font-medium text-brand-ink">
                  {trip.truckMake ? `${trip.truckMake} ${trip.truckModel || ""}` : "—"}
                </span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-brand-rule/40">
                <span className="text-brand-muted-soft">Trailer Unit:</span>
                <span className="font-mono font-semibold text-brand-ink">
                  {trip.trailerUnitNumber ? `#${trip.trailerUnitNumber}` : "Unassigned"}
                </span>
              </div>
              <div className="flex justify-between items-center py-1">
                <span className="text-brand-muted-soft">Trailer Type:</span>
                <span className="font-medium text-brand-ink">{trip.trailerType || "Dry Van"}</span>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}

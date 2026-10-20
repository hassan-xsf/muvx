import { notFound, redirect } from "next/navigation"
import Link from "next/link"
import { ChevronLeft, FileText, CheckCircle2, Clock, Truck, Printer } from "lucide-react"
import { getSession, getInvoiceById, getWorkspaceProfile } from "@/lib/dal"
import { formatWorkspaceDate } from "@/lib/timezone"
import { Card } from "@/components/ui/card"
import { StatusBadge } from "@/components/status-badge"
import { PrintInvoiceButton } from "@/components/tms/print-invoice-button"
import { ApplyPaymentDialog } from "@/components/tms/apply-payment-dialog"

export const instant = false

export default async function InvoiceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const session = await getSession()
  if (!session?.user) redirect("/login")
  const tenantId = session.session.activeOrganizationId
  if (!tenantId) redirect("/onboarding")

  const { id } = await params
  const [inv, profile] = await Promise.all([
    getInvoiceById(id, tenantId),
    getWorkspaceProfile(tenantId),
  ])

  if (!inv) notFound()

  return (
    <div className="p-4 lg:p-8 space-y-6 max-w-4xl mx-auto">
      {/* Navigation & Actions */}
      <div className="flex items-center justify-between print:hidden">
        <Link
          href="/invoices"
          className="inline-flex items-center gap-1 text-[13px] text-brand-muted-soft hover:text-brand-ink transition-colors"
        >
          <ChevronLeft className="size-3.5" />
          Back to invoices
        </Link>
        <div className="flex flex-wrap items-center gap-2">
          {inv.loadId && (
            <>
              <Link
                href={`/loads/${inv.loadId}`}
                className="inline-flex items-center gap-1.5 h-9 px-3 rounded-full border border-brand-rule text-xs font-medium text-brand-ink hover:bg-brand-cream-soft transition-colors"
              >
                <Truck className="size-3.5 text-[#d9622b]" />
                View Load
              </Link>
              <Link
                href={`/loads/${inv.loadId}/bol`}
                className="inline-flex items-center gap-1.5 h-9 px-3 rounded-full border border-brand-rule text-xs font-medium text-brand-ink hover:bg-brand-cream-soft transition-colors"
              >
                <Printer className="size-3.5 text-brand-muted-soft" />
                BOL
              </Link>
              <Link
                href={`/loads/${inv.loadId}/rate-con`}
                className="inline-flex items-center gap-1.5 h-9 px-3 rounded-full border border-brand-rule text-xs font-medium text-brand-ink hover:bg-brand-cream-soft transition-colors"
              >
                <FileText className="size-3.5 text-brand-muted-soft" />
                Rate Con
              </Link>
            </>
          )}
          {inv.status !== "paid" && (
            <ApplyPaymentDialog
              invoiceId={inv.id}
              invoiceNumber={inv.invoiceNumber}
              totalAmount={inv.amount}
              customerName={inv.customerName}
            />
          )}
          <PrintInvoiceButton />
        </div>
      </div>

      {/* Invoice Document Canvas */}
      <Card className="print-document-container border-brand-rule bg-brand-card p-8 sm:p-12 shadow-sm space-y-8 print:border-0 print:shadow-none print:p-0">
        {/* Top Header */}
        <div className="flex items-start justify-between border-b border-brand-rule pb-8">
          <div>
            <h2 className="font-serif text-3xl font-bold tracking-tight text-brand-ink">
              {profile?.name || "MUVX CARRIER"}
            </h2>
            <div className="mt-2 text-xs text-brand-muted-soft space-y-0.5">
              {profile?.dotNumber && <div>USDOT: {profile.dotNumber}</div>}
              {profile?.mcNumber && <div>MC / FF: {profile.mcNumber}</div>}
              {profile?.addressLine1 && <div>{profile.addressLine1}</div>}
              <div>{profile?.city ? `${profile.city}, ` : ""}{profile?.state || ""} {profile?.postalCode || ""}</div>
            </div>
          </div>

          <div className="text-right">
            <h1 className="font-serif text-2xl font-bold text-brand-ink uppercase tracking-wide">
              INVOICE
            </h1>
            <div className="mt-2 space-y-1 text-xs">
              <div>
                <span className="font-mono text-brand-muted-soft">Invoice #: </span>
                <span className="font-mono font-bold text-brand-ink">{inv.invoiceNumber}</span>
              </div>
              <div>
                <span className="font-mono text-brand-muted-soft">Date: </span>
                <span className="font-mono text-brand-ink">
                  {formatWorkspaceDate(inv.createdAt, profile?.timeZone, undefined, { mode: "date" })}
                </span>
              </div>
              <div>
                <span className="font-mono text-brand-muted-soft">Due Date: </span>
                <span className="font-mono font-semibold text-brand-ink">
                  {inv.dueDate ? formatWorkspaceDate(inv.dueDate, profile?.timeZone, undefined, { mode: "date" }) : "Net 30"}
                </span>
              </div>
              <div className="pt-1">
                <StatusBadge status={inv.status} />
              </div>
            </div>
          </div>
        </div>

        {/* Bill To & Shipment Info */}
        <div className="grid grid-cols-2 gap-8 text-xs">
          <div>
            <h3 className="font-mono text-[10px] font-bold uppercase tracking-[0.05em] text-brand-muted-soft mb-2">
              Bill To Customer
            </h3>
            <div className="font-medium text-sm text-brand-ink">{inv.customerName || "—"}</div>
            {inv.customerEmail && <div className="text-brand-muted-soft mt-0.5">{inv.customerEmail}</div>}
          </div>

          <div>
            <h3 className="font-mono text-[10px] font-bold uppercase tracking-[0.05em] text-brand-muted-soft mb-2">
              Shipment Reference
            </h3>
            <div className="space-y-1">
              {inv.loadNumber && (
                <div>
                  <span className="text-brand-muted-soft">Load #: </span>
                  {inv.loadId ? (
                    <Link
                      href={`/loads/${inv.loadId}`}
                      className="font-mono font-semibold text-[#d9622b] hover:underline"
                    >
                      {inv.loadNumber} →
                    </Link>
                  ) : (
                    <span className="font-mono font-semibold text-brand-ink">{inv.loadNumber}</span>
                  )}
                </div>
              )}
              {inv.commodity && (
                <div>
                  <span className="text-brand-muted-soft">Commodity: </span>
                  <span className="text-brand-ink">{inv.commodity}</span>
                </div>
              )}
              {inv.originCity && inv.destCity && (
                <div>
                  <span className="text-brand-muted-soft">Route: </span>
                  <span className="text-brand-ink">
                    {inv.originCity}, {inv.originState || ""} → {inv.destCity}, {inv.destState || ""}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Line Items Table */}
        <div className="border border-brand-rule rounded-lg overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-brand-rule bg-brand-cream-soft/60">
                <th className="text-left font-mono text-[10px] uppercase tracking-[0.04em] px-4 py-2.5 text-brand-muted-soft">
                  Item Description
                </th>
                <th className="text-right font-mono text-[10px] uppercase tracking-[0.04em] px-4 py-2.5 text-brand-muted-soft">
                  Rate
                </th>
                <th className="text-right font-mono text-[10px] uppercase tracking-[0.04em] px-4 py-2.5 text-brand-muted-soft">
                  Amount
                </th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-brand-rule">
                <td className="px-4 py-3 text-brand-ink font-medium">
                  Linehaul Freight Transportation Charges {inv.loadNumber ? `(Load ${inv.loadNumber})` : ""}
                </td>
                <td className="px-4 py-3 text-right font-mono text-brand-ink">
                  ${parseFloat(inv.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </td>
                <td className="px-4 py-3 text-right font-mono font-semibold text-brand-ink">
                  ${parseFloat(inv.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </td>
              </tr>
            </tbody>
            <tfoot>
              <tr className="bg-brand-cream-soft/40">
                <td colSpan={2} className="px-4 py-3 text-right font-mono font-bold text-xs uppercase tracking-[0.04em] text-brand-ink">
                  Total Due
                </td>
                <td className="px-4 py-3 text-right font-serif text-lg font-bold text-brand-ink">
                  ${parseFloat(inv.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* Remittance & Factoring Notice */}
        <div className="rounded-lg border border-brand-rule bg-brand-cream-soft/30 p-4 text-xs space-y-2">
          <div className="font-mono text-[10px] uppercase font-bold tracking-[0.04em] text-brand-ink">
            Remittance Instructions
          </div>
          <p className="text-brand-muted-soft text-[11px] leading-relaxed">
            {inv.notes ||
              `Please remit payment within the specified terms. Make electronic transfers payable to ${profile?.name || "Carrier"}. Reference invoice #${inv.invoiceNumber} on all remittances.`}
          </p>
          {inv.paidDate && (
            <div className="flex items-center gap-1.5 text-emerald-600 font-medium pt-1">
              <CheckCircle2 className="size-3.5" />
              Paid and reconciled on {formatWorkspaceDate(inv.paidDate, profile?.timeZone, undefined, { mode: "date" })}
            </div>
          )}
        </div>
      </Card>
    </div>
  )
}

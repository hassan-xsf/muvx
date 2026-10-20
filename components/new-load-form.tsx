"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { useMutation, useQuery } from "@tanstack/react-query"
import { motion, AnimatePresence } from "motion/react"
import {
  ArrowRight,
  ArrowLeft,
  Check,
  RefreshCw,
  Sparkles,
  Truck,
  Thermometer,
  Layers,
  Package,
  Calendar,
  Clock,
  MapPin,
  Building2,
  DollarSign,
  ShieldCheck,
  AlertCircle,
} from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { getAllCountries, getSubdivisions } from "@/lib/geography"
import { getAllCurrencies } from "@/lib/currencies"
import {
  type SalesTaxType,
  type LoadStop,
  SALES_TAX_CONFIG,
  computeTaxAndFinalRate,
} from "@/lib/tms-tax"
import { RateConUploader } from "@/components/tms/rate-con-uploader"
import { AddressAutocompleteInput } from "@/components/tms/address-autocomplete-input"
import type { RateConfExtraction } from "@/lib/rate-conf-parser"

// ─── Equipment Types matching Onboarding Card Selection ───
const EQUIPMENT_OPTIONS = [
  {
    id: "Dry Van",
    label: "Dry Van",
    blurb: "Standard 53ft enclosed dry freight trailer.",
    icon: Truck,
  },
  {
    id: "Reefer",
    label: "Reefer (Refrigerated)",
    blurb: "Continuous temperature-controlled cold chain cargo.",
    icon: Thermometer,
  },
  {
    id: "Flatbed",
    label: "Flatbed",
    blurb: "Open deck trailer for construction & oversized materials.",
    icon: Layers,
  },
  {
    id: "Step Deck",
    label: "Step Deck",
    blurb: "Lower deck height for tall freight and heavy equipment.",
    icon: Layers,
  },
  {
    id: "Power Only",
    label: "Power Only",
    blurb: "Tractor power unit only for pre-loaded shipper trailers.",
    icon: Truck,
  },
  {
    id: "Box Truck",
    label: "Box Truck",
    blurb: "Straight truck dedicated for regional and city deliveries.",
    icon: Package,
  },
] as const

const REEFER_PRESETS = [
  { label: "Deep Frozen", temp: "-10°F to -15°F" },
  { label: "Frozen Meat / Poultry", temp: "0°F to 5°F" },
  { label: "Fresh Chilled / Dairy", temp: "34°F to 38°F" },
  { label: "Produce / Fruits", temp: "45°F to 50°F" },
  { label: "Controlled Ambient", temp: "65°F to 70°F" },
]

const STOPS_CONFIG = [
  {
    stop: "STOP 01",
    subtitle: "SHIPPER & IDENTIFIERS",
    title: ["Who are you moving", "this freight for?"],
    description: "Contracted shipper customer and load reference number.",
    nextAction: "Choose Equipment",
  },
  {
    stop: "STOP 02",
    subtitle: "TRAILER & CARGO",
    title: ["What equipment", "does this load require?"],
    description: "Trailer specification and cargo profile.",
    nextAction: "Set Pickup Stop",
  },
  {
    stop: "STOP 03",
    subtitle: "ORIGIN PICKUP",
    title: ["Where is the freight", "being picked up?"],
    description: "Facility dock location and scheduled appointment.",
    nextAction: "Set Delivery Stop",
  },
  {
    stop: "STOP 04",
    subtitle: "DESTINATION DELIVERY",
    title: ["Where is the freight", "being delivered?"],
    description: "Consignee dock location and receiving appointment.",
    nextAction: "Review & Set Rates",
  },
  {
    stop: "STOP 05",
    subtitle: "RATES & BILLING",
    title: ["What are the agreed", "freight rates?"],
    description: "Customer billing rate, sales tax, and itinerary summary.",
    nextAction: "Publish & Book Load",
  },
]

function generateLoadNumber() {
  const yr = new Date().getFullYear()
  const rand = Math.floor(1000 + Math.random() * 9000)
  return `LD-${yr}-${rand}`
}

export function NewLoadForm() {
  const router = useRouter()
  const [currentStep, setCurrentStep] = React.useState(0)
  const [highestReached, setHighestReached] = React.useState(0)
  const [error, setError] = React.useState("")

  // Master customer and facility catalogs for instant 1-click autocomplete
  const { data: catalogData } = useQuery<{
    customers: Array<{ id: string; name: string; currency?: string }>
    facilities: Array<{
      id: string
      name: string
      facilityType: string
      address: string
      city: string
      state: string
      zip?: string
      country?: string
      contactPhone?: string
    }>
  }>({
    queryKey: ["customers-and-facilities"],
    queryFn: async () => {
      const res = await fetch("/api/customers")
      if (!res.ok) return { customers: [], facilities: [] }
      return res.json()
    },
  })

  // Dynamic Geography & Currencies
  const allCountries = React.useMemo(() => getAllCountries(), [])
  const allCurrencies = React.useMemo(() => getAllCurrencies(), [])

  // ─── Step 1 State: Customer & Identifiers ───
  const [loadNumber, setLoadNumber] = React.useState(generateLoadNumber())
  const [customerName, setCustomerName] = React.useState("")
  const [tenderNumber, setTenderNumber] = React.useState("")

  // ─── Step 2 State: Equipment & Cargo ───
  const [loadType, setLoadType] = React.useState<string>("Dry Van")
  const [commodity, setCommodity] = React.useState("")
  const [weight, setWeight] = React.useState("")
  const [isRefrigerated, setIsRefrigerated] = React.useState(false)
  const [temperature, setTemperature] = React.useState("")
  const [specialInstructions, setSpecialInstructions] = React.useState("")

  // ─── Step 3 State: Origin Pickup ───
  const [originFacility, setOriginFacility] = React.useState("")
  const [originAddress, setOriginAddress] = React.useState("")
  const [originCountry, setOriginCountry] = React.useState("US")
  const [originCity, setOriginCity] = React.useState("")
  const [originState, setOriginState] = React.useState("")
  const [originZip, setOriginZip] = React.useState("")
  const [originDate, setOriginDate] = React.useState("")
  const [originTime, setOriginTime] = React.useState("")
  const [originContact, setOriginContact] = React.useState("")
  const [originPhone, setOriginPhone] = React.useState("")

  // ─── Step 4 State: Destination Delivery ───
  const [destFacility, setDestFacility] = React.useState("")
  const [destAddress, setDestAddress] = React.useState("")
  const [destCountry, setDestCountry] = React.useState("US")
  const [destCity, setDestCity] = React.useState("")
  const [destState, setDestState] = React.useState("")
  const [destZip, setDestZip] = React.useState("")
  const [destDate, setDestDate] = React.useState("")
  const [destTime, setDestTime] = React.useState("")
  const [destContact, setDestContact] = React.useState("")
  const [destPhone, setDestPhone] = React.useState("")

  // ─── Step 5 State: Rates, Tax & Billing ───
  const [currency, setCurrency] = React.useState("USD")
  const [rate, setRate] = React.useState("")
  const [carrierRate, setCarrierRate] = React.useState("")
  const [salesTaxType, setSalesTaxType] = React.useState<SalesTaxType>("none")

  // Auto-switch reefer flag on equipment change
  const handleSelectEquipment = (id: string) => {
    setLoadType(id)
    if (id === "Reefer") {
      setIsRefrigerated(true)
      if (!temperature) setTemperature("34°F to 38°F Continuous")
    } else {
      setIsRefrigerated(false)
    }
  }

  // Auto-fill form state when a Rate Confirmation PDF is extracted by Gemini
  const handleParsedRateCon = (data: RateConfExtraction) => {
    if (data.customerName) setCustomerName(data.customerName)
    if (data.tenderNumber || data.referenceNumber) {
      setTenderNumber(data.tenderNumber || data.referenceNumber || "")
    }
    if (data.rate) setRate(String(data.rate))
    if (data.currency) setCurrency(data.currency)
    if (data.commodity) setCommodity(data.commodity)
    if (data.weight) setWeight(String(data.weight))

    // Equipment selection
    if (data.equipmentType) {
      const eq = data.equipmentType.toLowerCase()
      if (eq.includes("reefer") || eq.includes("refrigerated") || eq.includes("temp")) {
        handleSelectEquipment("Reefer")
      } else if (eq.includes("flat")) {
        handleSelectEquipment("Flatbed")
      } else if (eq.includes("step")) {
        handleSelectEquipment("Step Deck")
      } else if (eq.includes("box")) {
        handleSelectEquipment("Box Truck")
      } else if (eq.includes("power")) {
        handleSelectEquipment("Power Only")
      } else {
        handleSelectEquipment("Dry Van")
      }
    }

    // Pickup stop details
    const pu = data.pickupStops?.[0]
    if (pu) {
      if (pu.facilityName) setOriginFacility(pu.facilityName)
      if (pu.address) setOriginAddress(pu.address)
      if (pu.city) setOriginCity(pu.city)
      if (pu.state) setOriginState(pu.state)
      if (pu.zip) setOriginZip(pu.zip)
      if (pu.appointmentDate) setOriginDate(pu.appointmentDate)
      if (pu.appointmentStart) {
        const t = pu.appointmentStart
        setOriginTime(t.length === 4 ? `${t.slice(0, 2)}:${t.slice(2)}` : t)
      }
    }

    // Delivery stop details
    const doStop = data.deliveryStops?.[0]
    if (doStop) {
      if (doStop.facilityName) setDestFacility(doStop.facilityName)
      if (doStop.address) setDestAddress(doStop.address)
      if (doStop.city) setDestCity(doStop.city)
      if (doStop.state) setDestState(doStop.state)
      if (doStop.zip) setDestZip(doStop.zip)
      if (doStop.appointmentDate) setDestDate(doStop.appointmentDate)
      if (doStop.appointmentStart) {
        const t = doStop.appointmentStart
        setDestTime(t.length === 4 ? `${t.slice(0, 2)}:${t.slice(2)}` : t)
      }
    }

    // Unlock all steps so dispatcher can jump directly to rate verification
    setHighestReached(4)
  }

  // Financial calculations via shared tax engine
  const baseRateNum = parseFloat(rate) || 0
  const carrierRateNum = parseFloat(carrierRate) || 0
  const { taxRate, taxAmount, finalRate } = computeTaxAndFinalRate(
    baseRateNum,
    salesTaxType
  )

  const grossMargin =
    baseRateNum > 0 && carrierRateNum > 0
      ? (((baseRateNum - carrierRateNum) / baseRateNum) * 100).toFixed(1)
      : null

  // Subdivisions for state pickers
  const originSubdivisions = React.useMemo(
    () => getSubdivisions(originCountry),
    [originCountry]
  )
  const destSubdivisions = React.useMemo(
    () => getSubdivisions(destCountry),
    [destCountry]
  )

  // Validation
  const validateStep = (step: number): boolean => {
    setError("")
    if (step === 0) {
      if (!customerName.trim()) {
        setError("Please enter the contracting customer or shipper name.")
        return false
      }
      if (!loadNumber.trim()) {
        setError("Please provide a load reference number.")
        return false
      }
      return true
    }

    if (step === 1) {
      if (!loadType) {
        setError("Please select the required equipment type.")
        return false
      }
      if (isRefrigerated && !temperature.trim()) {
        setError("Please specify the required reefer temperature setpoint.")
        return false
      }
      return true
    }

    if (step === 2) {
      if (!originCity.trim() || !originState.trim()) {
        setError("Please provide at least the City and State for origin pickup.")
        return false
      }
      return true
    }

    if (step === 3) {
      if (!destCity.trim() || !destState.trim()) {
        setError("Please provide at least the City and State for destination delivery.")
        return false
      }
      return true
    }

    if (step === 4) {
      if (!rate || baseRateNum <= 0) {
        setError("Please specify a valid agreed shipper rate.")
        return false
      }
      return true
    }

    return true
  }

  const handleNext = () => {
    if (validateStep(currentStep)) {
      const next = currentStep + 1
      setCurrentStep(next)
      if (next > highestReached) {
        setHighestReached(next)
      }
    }
  }

  const handleBack = () => {
    setError("")
    setCurrentStep((prev) => Math.max(0, prev - 1))
  }

  const goToStep = (target: number) => {
    if (target <= highestReached) {
      setError("")
      setCurrentStep(target)
    }
  }

  // Submit Mutation
  const createMutation = useMutation({
    mutationFn: async () => {
      const formattedStops: LoadStop[] = [
        {
          id: "stop-pickup-1",
          type: "pickup",
          facilityName: originFacility.trim(),
          address: originAddress.trim(),
          city: originCity.trim(),
          state: originState.trim(),
          country: originCountry,
          zip: originZip.trim(),
          contactName: originContact.trim() || undefined,
          contactPhone: originPhone.trim() || undefined,
          appointmentDate: originDate || undefined,
          appointmentTime: originTime || undefined,
          appointmentType: "strict",
        },
        {
          id: "stop-delivery-1",
          type: "delivery",
          facilityName: destFacility.trim(),
          address: destAddress.trim(),
          city: destCity.trim(),
          state: destState.trim(),
          country: destCountry,
          zip: destZip.trim(),
          contactName: destContact.trim() || undefined,
          contactPhone: destPhone.trim() || undefined,
          appointmentDate: destDate || undefined,
          appointmentTime: destTime || undefined,
          appointmentType: "strict",
        },
      ]

      const payload = {
        loadNumber: loadNumber.trim(),
        customerName: customerName.trim(),
        tenderNumber: tenderNumber.trim() || null,
        originAddress: originAddress.trim() || null,
        originCity: originCity.trim(),
        originState: originState.trim(),
        originZip: originZip.trim() || null,
        originContact: originContact.trim() || null,
        originPhone: originPhone.trim() || null,
        originAppointment: originDate || null,
        destAddress: destAddress.trim() || null,
        destCity: destCity.trim(),
        destState: destState.trim(),
        destZip: destZip.trim() || null,
        destContact: destContact.trim() || null,
        destPhone: destPhone.trim() || null,
        destAppointment: destDate || null,
        stops: formattedStops,
        loadType,
        commodity: commodity.trim() || null,
        weight: weight.trim() || null,
        temperature: isRefrigerated ? temperature.trim() : null,
        isRefrigerated,
        currency,
        rate: baseRateNum.toFixed(2),
        carrierRate: carrierRateNum > 0 ? carrierRateNum.toFixed(2) : null,
        salesTaxType,
        salesTaxRate: taxRate ? taxRate.toString() : null,
        salesTaxAmount: taxAmount ? taxAmount.toFixed(2) : null,
        finalRate: finalRate ? finalRate.toFixed(2) : baseRateNum.toFixed(2),
        specialInstructions: specialInstructions.trim() || null,
        pickupDate: originDate || null,
        deliveryDate: destDate || null,
      }

      const res = await fetch("/api/loads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error ?? "Failed to create load")
      }
      return res.json()
    },
    onSuccess: (data) => {
      toast.success(`Load ${loadNumber} created successfully!`)
      router.push(`/loads/${data.id}`)
    },
    onError: (err: Error) => {
      setError(err.message || "Failed to create load")
    },
  })

  const currentInfo = STOPS_CONFIG[currentStep]
  const isFinalStep = currentStep === STOPS_CONFIG.length - 1

  return (
    <div className="w-full">
      {/* ─── Segmented Pill Progress Tracker ─── */}
      <div className="flex gap-2">
        {STOPS_CONFIG.map((_, i) => (
          <button
            key={i}
            type="button"
            onClick={() => goToStep(i)}
            disabled={i > highestReached}
            className={cn(
              "h-[3px] flex-1 rounded-full transition-colors",
              i <= highestReached ? "cursor-pointer" : "cursor-not-allowed",
              i === currentStep
                ? "bg-[#d9622b]"
                : i < currentStep
                ? "bg-[#d9622b]/60 hover:bg-[#d9622b]"
                : "bg-[#e4ddd3] dark:bg-muted"
            )}
            aria-label={`Jump to ${STOPS_CONFIG[i].stop}`}
          />
        ))}
      </div>

      {/* ─── Main Content Canvas ─── */}
      <div className="mt-8 md:mt-12">
        {/* Eyebrow & Display Headline */}
        <div className="mb-8 md:mb-10">
          <div className="flex items-center gap-2.5">
            <span className="size-[7px] shrink-0 rounded-full bg-[#d9622b]" />
            <span
              className="font-mono text-[11px] font-medium uppercase tracking-[0.04em]"
              style={{ color: "#16181d" }}
            >
              {currentInfo.stop}
            </span>
            <span
              className="font-mono text-[11px] tracking-[0.04em]"
              style={{ color: "#8a8b8f" }}
            >
              · {currentInfo.subtitle}
            </span>
          </div>
          <h1 className="display-heading mt-4">
            <span className="block">{currentInfo.title[0]}</span>
            <span className="italic-accent block">{currentInfo.title[1]}</span>
          </h1>
          <p className="mt-2 text-[15px]" style={{ color: "#73757a" }}>
            {currentInfo.description}
          </p>
        </div>

        {/* Error Banner */}
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            className="error-banner mb-6"
            role="alert"
          >
            {error}
          </motion.div>
        )}

        {/* Form Steps */}
        <AnimatePresence mode="wait">
          {/* ─── STOP 01: SHIPPER & IDENTIFIERS ─── */}
          {currentStep === 0 && (
            <motion.div
              key="step-0"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
              className="space-y-6"
            >
              {/* AI Rate Confirmation Auto-fill banner */}
              <RateConUploader onParsed={handleParsedRateCon} />
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label htmlFor="customerName" className="field-label mb-0">
                    Customer / Shipper *
                  </label>
                  {catalogData?.customers && catalogData.customers.length > 0 && (
                    <span className="font-mono text-[11px] text-[#d9622b] flex items-center gap-1">
                      <Sparkles className="size-3" />
                      {catalogData.customers.length} saved customer{catalogData.customers.length > 1 ? "s" : ""}
                    </span>
                  )}
                </div>
                <input
                  id="customerName"
                  autoFocus
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="e.g. Walmart Logistics, Target, Tyson Foods"
                  className="input-base"
                />

                {/* Quick select saved customer chips */}
                {catalogData?.customers && catalogData.customers.length > 0 && (
                  <div className="mt-3 flex flex-wrap items-center gap-1.5">
                    <span className="font-mono text-[10px] uppercase text-[#8a8b8f] tracking-[0.04em] mr-1">
                      Quick select:
                    </span>
                    {catalogData.customers.slice(0, 5).map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => {
                          setCustomerName(c.name)
                          if (c.currency) setCurrency(c.currency)
                        }}
                        className={cn(
                          "px-2.5 py-1 rounded-full text-xs transition-colors border font-medium",
                          customerName === c.name
                            ? "border-[#d9622b] bg-[#fff0e6] text-[#d9622b]"
                            : "border-[#d1ccc5] bg-white text-[#16181d] hover:border-[#c4bdb3]"
                        )}
                      >
                        + {c.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="grid gap-5 sm:grid-cols-2">
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label htmlFor="loadNumber" className="field-label mb-0">
                      Load Reference # *
                    </label>
                    <button
                      type="button"
                      onClick={() => setLoadNumber(generateLoadNumber())}
                      className="font-mono text-[10px] uppercase text-[#8a8b8f] hover:text-[#16181d] flex items-center gap-1 transition-colors"
                      title="Generate new load reference"
                    >
                      <RefreshCw className="size-2.5" />
                      New Ref
                    </button>
                  </div>
                  <input
                    id="loadNumber"
                    value={loadNumber}
                    onChange={(e) => setLoadNumber(e.target.value)}
                    placeholder="LD-2026-1001"
                    className="input-base font-mono"
                  />
                </div>

                <div>
                  <label htmlFor="tenderNumber" className="field-label">
                    Tender / PO #{" "}
                    <span className="text-[#a8a29a] normal-case tracking-normal">
                      — Optional
                    </span>
                  </label>
                  <input
                    id="tenderNumber"
                    value={tenderNumber}
                    onChange={(e) => setTenderNumber(e.target.value)}
                    placeholder="PO-992810"
                    className="input-base font-mono"
                  />
                </div>
              </div>
            </motion.div>
          )}

          {/* ─── STOP 02: TRAILER & CARGO ─── */}
          {currentStep === 1 && (
            <motion.div
              key="step-1"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
              className="space-y-6"
            >
              {/* Equipment Cards (Identical style to Onboarding StepBusiness) */}
              <div>
                <label className="field-label mb-2.5">
                  Select Required Equipment Type *
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {EQUIPMENT_OPTIONS.map((opt) => {
                    const active = loadType === opt.id
                    const Icon = opt.icon
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => handleSelectEquipment(opt.id)}
                        className={cn(
                          "flex items-start gap-3.5 rounded-xl border p-4 text-left transition-all w-full",
                          active
                            ? "border-[#d9622b] bg-[#fff0e6]"
                            : "border-[#d1ccc5] bg-white hover:border-[#c4bdb3] hover:bg-[#fffdf9]"
                        )}
                      >
                        <span
                          className={cn(
                            "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors",
                            active
                              ? "border-[#d9622b] bg-[#d9622b]"
                              : "border-[#d1ccc5] bg-white"
                          )}
                        >
                          {active && (
                            <Check className="h-3 w-3 text-white" strokeWidth={3} />
                          )}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <Icon
                              className={cn(
                                "size-4 shrink-0",
                                active ? "text-[#d9622b]" : "text-[#8a8b8f]"
                              )}
                            />
                            <span
                              className="font-medium text-[15px]"
                              style={{ color: "#16181d" }}
                            >
                              {opt.label}
                            </span>
                          </div>
                          <span
                            className="mt-1 block text-[13px] leading-snug"
                            style={{ color: "#73757a" }}
                          >
                            {opt.blurb}
                          </span>
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Reefer Temperature Controls */}
              {isRefrigerated && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  className="rounded-xl border border-[#d9622b]/30 bg-[#fff8f5] p-5 space-y-4"
                >
                  <div className="flex items-center gap-2">
                    <Thermometer className="size-4 text-[#d9622b]" />
                    <span className="font-mono text-xs uppercase tracking-wider font-semibold text-[#d9622b]">
                      Reefer Temperature Management
                    </span>
                  </div>

                  <div>
                    <label className="field-label mb-1.5">
                      Target Continuous Temperature *
                    </label>
                    <input
                      value={temperature}
                      onChange={(e) => setTemperature(e.target.value)}
                      placeholder="e.g. 34°F to 38°F Continuous"
                      className="input-base font-mono"
                    />
                  </div>

                  <div>
                    <span className="font-mono text-[10px] uppercase text-[#8a8b8f] tracking-[0.04em] block mb-2">
                      Quick temperature presets:
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {REEFER_PRESETS.map((p) => (
                        <button
                          key={p.label}
                          type="button"
                          onClick={() => setTemperature(p.temp)}
                          className={cn(
                            "px-3 py-1 rounded-full text-xs font-medium border transition-colors",
                            temperature === p.temp
                              ? "border-[#d9622b] bg-[#d9622b] text-white"
                              : "border-[#d1ccc5] bg-white text-[#16181d] hover:border-[#c4bdb3]"
                          )}
                        >
                          {p.label} ({p.temp})
                        </button>
                      ))}
                    </div>
                  </div>
                </motion.div>
              )}

              {/* Commodity & Weight */}
              <div className="grid gap-5 sm:grid-cols-2">
                <div>
                  <label htmlFor="commodity" className="field-label">
                    Commodity / Cargo Description
                  </label>
                  <input
                    id="commodity"
                    value={commodity}
                    onChange={(e) => setCommodity(e.target.value)}
                    placeholder="e.g. Palletized Beverages, CPG"
                    className="input-base"
                  />
                </div>
                <div>
                  <label htmlFor="weight" className="field-label">
                    Estimated Gross Weight (lbs)
                  </label>
                  <input
                    id="weight"
                    value={weight}
                    onChange={(e) => setWeight(e.target.value)}
                    placeholder="e.g. 42,500"
                    className="input-base font-mono"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="specialInstructions" className="field-label">
                  Driver / Handling Instructions{" "}
                  <span className="text-[#a8a29a] normal-case tracking-normal">
                    — Optional
                  </span>
                </label>
                <input
                  id="specialInstructions"
                  value={specialInstructions}
                  onChange={(e) => setSpecialInstructions(e.target.value)}
                  placeholder="e.g. Clean sweep trailer, seal at shipper, check temps every 4 hours"
                  className="input-base"
                />
              </div>
            </motion.div>
          )}

          {/* ─── STOP 03: ORIGIN PICKUP ─── */}
          {currentStep === 2 && (
            <motion.div
              key="step-2"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
              className="space-y-6"
            >
              {/* Saved Facilities Quick Select */}
              {catalogData?.facilities && catalogData.facilities.length > 0 && (
                <div>
                  <span className="font-mono text-[10px] uppercase text-[#8a8b8f] tracking-[0.04em] block mb-2">
                    Quick-fill from saved facilities:
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {catalogData.facilities.slice(0, 4).map((f) => (
                      <button
                        key={f.id}
                        type="button"
                        onClick={() => {
                          setOriginFacility(f.name)
                          setOriginAddress(f.address || "")
                          setOriginCity(f.city || "")
                          setOriginState(f.state || "")
                          if (f.zip) setOriginZip(f.zip)
                          if (f.country) setOriginCountry(f.country)
                          if (f.contactPhone) setOriginPhone(f.contactPhone)
                        }}
                        className="px-2.5 py-1 rounded-full text-xs border border-[#d1ccc5] bg-white text-[#16181d] hover:border-[#d9622b] hover:bg-[#fff0e6] transition-colors"
                      >
                        + {f.name} ({f.city}, {f.state})
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <label htmlFor="originFacility" className="field-label">
                  Origin Facility / Shipper Dock Name
                </label>
                <input
                  id="originFacility"
                  autoFocus
                  value={originFacility}
                  onChange={(e) => setOriginFacility(e.target.value)}
                  placeholder="e.g. Atlanta Cold Storage DC #4"
                  className="input-base"
                />
              </div>

              <div>
                <label htmlFor="originAddress" className="field-label">
                  Street Address (Google Places / Autocomplete)
                </label>
                <AddressAutocompleteInput
                  id="originAddress"
                  value={originAddress}
                  onChange={setOriginAddress}
                  onSelectAddress={(data) => {
                    setOriginAddress(data.address)
                    if (data.city) setOriginCity(data.city)
                    if (data.state) setOriginState(data.state)
                    if (data.zip) setOriginZip(data.zip)
                    if (data.country) setOriginCountry(data.country)
                  }}
                  placeholder="e.g. 1500 Logistics Parkway"
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-4">
                <div>
                  <label htmlFor="originCountry" className="field-label">
                    Country
                  </label>
                  <select
                    id="originCountry"
                    value={originCountry}
                    onChange={(e) => {
                      setOriginCountry(e.target.value)
                      setOriginState("")
                    }}
                    className="input-base"
                  >
                    {allCountries.map((c) => (
                      <option key={c.code} value={c.code}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="sm:col-span-2">
                  <label htmlFor="originCity" className="field-label">
                    City *
                  </label>
                  <input
                    id="originCity"
                    value={originCity}
                    onChange={(e) => setOriginCity(e.target.value)}
                    placeholder="e.g. Atlanta"
                    className="input-base"
                  />
                </div>

                <div>
                  <label htmlFor="originState" className="field-label">
                    State / Region *
                  </label>
                  {originSubdivisions.length > 0 ? (
                    <select
                      id="originState"
                      value={originState}
                      onChange={(e) => setOriginState(e.target.value)}
                      className="input-base"
                    >
                      <option value="">Select...</option>
                      {originSubdivisions.map((s) => (
                        <option key={s.code} value={s.code}>
                          {s.code} — {s.name}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      id="originState"
                      value={originState}
                      onChange={(e) => setOriginState(e.target.value)}
                      placeholder="State/Prov"
                      className="input-base"
                    />
                  )}
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <div>
                  <label htmlFor="originZip" className="field-label">
                    Postal / Zip Code
                  </label>
                  <input
                    id="originZip"
                    value={originZip}
                    onChange={(e) => setOriginZip(e.target.value)}
                    placeholder="e.g. 30301"
                    className="input-base font-mono"
                  />
                </div>

                <div>
                  <label htmlFor="originDate" className="field-label">
                    Scheduled Pickup Date
                  </label>
                  <input
                    id="originDate"
                    type="date"
                    value={originDate}
                    onChange={(e) => setOriginDate(e.target.value)}
                    className="input-base"
                  />
                </div>

                <div>
                  <label htmlFor="originTime" className="field-label">
                    Appointment Time Window
                  </label>
                  <input
                    id="originTime"
                    type="time"
                    value={originTime}
                    onChange={(e) => setOriginTime(e.target.value)}
                    className="input-base"
                  />
                </div>
              </div>
            </motion.div>
          )}

          {/* ─── STOP 04: DESTINATION DELIVERY ─── */}
          {currentStep === 3 && (
            <motion.div
              key="step-3"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
              className="space-y-6"
            >
              {/* Saved Facilities Quick Select */}
              {catalogData?.facilities && catalogData.facilities.length > 0 && (
                <div>
                  <span className="font-mono text-[10px] uppercase text-[#8a8b8f] tracking-[0.04em] block mb-2">
                    Quick-fill from saved facilities:
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {catalogData.facilities.slice(0, 4).map((f) => (
                      <button
                        key={f.id}
                        type="button"
                        onClick={() => {
                          setDestFacility(f.name)
                          setDestAddress(f.address || "")
                          setDestCity(f.city || "")
                          setDestState(f.state || "")
                          if (f.zip) setDestZip(f.zip)
                          if (f.country) setDestCountry(f.country)
                          if (f.contactPhone) setDestPhone(f.contactPhone)
                        }}
                        className="px-2.5 py-1 rounded-full text-xs border border-[#d1ccc5] bg-white text-[#16181d] hover:border-[#d9622b] hover:bg-[#fff0e6] transition-colors"
                      >
                        + {f.name} ({f.city}, {f.state})
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <label htmlFor="destFacility" className="field-label">
                  Consignee / Destination Receiving Dock
                </label>
                <input
                  id="destFacility"
                  autoFocus
                  value={destFacility}
                  onChange={(e) => setDestFacility(e.target.value)}
                  placeholder="e.g. Dallas Mega Fulfillment Center"
                  className="input-base"
                />
              </div>

              <div>
                <label htmlFor="destAddress" className="field-label">
                  Street Address (Google Places / Autocomplete)
                </label>
                <AddressAutocompleteInput
                  id="destAddress"
                  value={destAddress}
                  onChange={setDestAddress}
                  onSelectAddress={(data) => {
                    setDestAddress(data.address)
                    if (data.city) setDestCity(data.city)
                    if (data.state) setDestState(data.state)
                    if (data.zip) setDestZip(data.zip)
                    if (data.country) setDestCountry(data.country)
                  }}
                  placeholder="e.g. 8400 Horizon Boulevard"
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-4">
                <div>
                  <label htmlFor="destCountry" className="field-label">
                    Country
                  </label>
                  <select
                    id="destCountry"
                    value={destCountry}
                    onChange={(e) => {
                      setDestCountry(e.target.value)
                      setDestState("")
                    }}
                    className="input-base"
                  >
                    {allCountries.map((c) => (
                      <option key={c.code} value={c.code}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="sm:col-span-2">
                  <label htmlFor="destCity" className="field-label">
                    City *
                  </label>
                  <input
                    id="destCity"
                    value={destCity}
                    onChange={(e) => setDestCity(e.target.value)}
                    placeholder="e.g. Dallas"
                    className="input-base"
                  />
                </div>

                <div>
                  <label htmlFor="destState" className="field-label">
                    State / Region *
                  </label>
                  {destSubdivisions.length > 0 ? (
                    <select
                      id="destState"
                      value={destState}
                      onChange={(e) => setDestState(e.target.value)}
                      className="input-base"
                    >
                      <option value="">Select...</option>
                      {destSubdivisions.map((s) => (
                        <option key={s.code} value={s.code}>
                          {s.code} — {s.name}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      id="destState"
                      value={destState}
                      onChange={(e) => setDestState(e.target.value)}
                      placeholder="State/Prov"
                      className="input-base"
                    />
                  )}
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <div>
                  <label htmlFor="destZip" className="field-label">
                    Postal / Zip Code
                  </label>
                  <input
                    id="destZip"
                    value={destZip}
                    onChange={(e) => setDestZip(e.target.value)}
                    placeholder="e.g. 75201"
                    className="input-base font-mono"
                  />
                </div>

                <div>
                  <label htmlFor="destDate" className="field-label">
                    Scheduled Delivery Date
                  </label>
                  <input
                    id="destDate"
                    type="date"
                    value={destDate}
                    onChange={(e) => setDestDate(e.target.value)}
                    className="input-base"
                  />
                </div>

                <div>
                  <label htmlFor="destTime" className="field-label">
                    Receiving Time Window
                  </label>
                  <input
                    id="destTime"
                    type="time"
                    value={destTime}
                    onChange={(e) => setDestTime(e.target.value)}
                    className="input-base"
                  />
                </div>
              </div>
            </motion.div>
          )}

          {/* ─── STOP 05: RATES & BILLING SUMMARY ─── */}
          {currentStep === 4 && (
            <motion.div
              key="step-4"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
              className="space-y-6"
            >
              {/* Financial Inputs */}
              <div className="grid gap-5 sm:grid-cols-3">
                <div>
                  <label htmlFor="currency" className="field-label">
                    Billing Currency
                  </label>
                  <select
                    id="currency"
                    value={currency}
                    onChange={(e) => setCurrency(e.target.value)}
                    className="input-base font-mono"
                  >
                    {allCurrencies.map((c) => (
                      <option key={c.code} value={c.code}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="rate" className="field-label">
                    Agreed Shipper Rate *
                  </label>
                  <input
                    id="rate"
                    autoFocus
                    type="number"
                    step="0.01"
                    value={rate}
                    onChange={(e) => setRate(e.target.value)}
                    placeholder="2850.00"
                    className="input-base font-mono text-base font-semibold"
                  />
                </div>

                <div>
                  <label htmlFor="carrierRate" className="field-label">
                    Target Carrier Pay{" "}
                    <span className="text-[#a8a29a] normal-case tracking-normal">
                      — Optional
                    </span>
                  </label>
                  <input
                    id="carrierRate"
                    type="number"
                    step="0.01"
                    value={carrierRate}
                    onChange={(e) => setCarrierRate(e.target.value)}
                    placeholder="2300.00"
                    className="input-base font-mono"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="salesTaxType" className="field-label">
                  Sales Tax Engine
                </label>
                <select
                  id="salesTaxType"
                  value={salesTaxType}
                  onChange={(e) => setSalesTaxType(e.target.value as SalesTaxType)}
                  className="input-base"
                >
                  {Object.entries(SALES_TAX_CONFIG).map(([k, cfg]) => (
                    <option key={k} value={k}>
                      {cfg.label} {cfg.defaultRate > 0 ? `(${cfg.defaultRate}%)` : ""}
                    </option>
                  ))}
                </select>
              </div>

              {/* Receipt-style Itinerary & Financial Summary Card */}
              <div
                className="rounded-2xl border border-[#d1ccc5] bg-white p-6 shadow-xs space-y-5"
                style={{ background: "#ffffff" }}
              >
                <div className="flex items-center justify-between border-b border-[#e4ddd3] pb-4">
                  <div>
                    <span className="font-mono text-[10px] uppercase text-[#8a8b8f] tracking-[0.04em] block">
                      ITINERARY & BILLING SUMMARY
                    </span>
                    <h3 className="font-serif text-xl font-medium text-[#16181d] mt-0.5">
                      {loadNumber} · {customerName || "Customer Shipper"}
                    </h3>
                  </div>
                  <span className="font-mono text-xs px-2.5 py-1 rounded-full bg-[#fff0e6] text-[#d9622b] font-medium border border-[#d9622b]/30">
                    {loadType}
                  </span>
                </div>

                {/* Route Overview */}
                <div className="grid grid-cols-2 gap-4 py-2 border-b border-[#e4ddd3]">
                  <div>
                    <span className="font-mono text-[10px] uppercase text-[#8a8b8f] tracking-[0.04em] block">
                      ORIGIN PICKUP
                    </span>
                    <p className="text-[14px] font-medium text-[#16181d] mt-0.5">
                      {originCity ? `${originCity}, ${originState}` : "Origin City, State"}
                    </p>
                    <p className="text-xs text-[#73757a] mt-0.5">
                      {originDate || "Appointment pending"} {originTime && `at ${originTime}`}
                    </p>
                  </div>

                  <div>
                    <span className="font-mono text-[10px] uppercase text-[#8a8b8f] tracking-[0.04em] block">
                      DESTINATION DELIVERY
                    </span>
                    <p className="text-[14px] font-medium text-[#16181d] mt-0.5">
                      {destCity ? `${destCity}, ${destState}` : "Destination City, State"}
                    </p>
                    <p className="text-xs text-[#73757a] mt-0.5">
                      {destDate || "Appointment pending"} {destTime && `at ${destTime}`}
                    </p>
                  </div>
                </div>

                {/* Financial Breakdown */}
                <div className="space-y-2 pt-1 font-mono text-xs">
                  <div className="flex justify-between text-[#73757a]">
                    <span>Contract Base Rate</span>
                    <span>
                      {currency} {baseRateNum.toFixed(2)}
                    </span>
                  </div>

                  {taxAmount > 0 && (
                    <div className="flex justify-between text-[#73757a]">
                      <span>
                        Sales Tax ({SALES_TAX_CONFIG[salesTaxType].label})
                      </span>
                      <span>
                        + {currency} {taxAmount.toFixed(2)}
                      </span>
                    </div>
                  )}

                  <div className="flex justify-between text-base font-semibold text-[#16181d] border-t border-[#e4ddd3] pt-2">
                    <span>Total Invoice Amount</span>
                    <span className="text-[#d9622b]">
                      {currency} {(finalRate || baseRateNum).toFixed(2)}
                    </span>
                  </div>

                  {grossMargin && (
                    <div className="flex justify-between text-emerald-700 dark:text-emerald-400 text-[11px] pt-1">
                      <span>Projected Gross Margin (Carrier Pay {currency} {carrierRateNum.toFixed(2)})</span>
                      <span>+{grossMargin}%</span>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ─── Footer Navigation ─── */}
        <div className="mt-12 pt-6 border-t border-[#e4ddd3] flex items-center justify-between">
          {currentStep > 0 ? (
            <button
              type="button"
              onClick={handleBack}
              className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-full border border-[#d1ccc5] text-sm font-medium text-[#16181d] hover:bg-[#fffdf9] transition-colors"
            >
              <ArrowLeft className="size-4" />
              Back
            </button>
          ) : (
            <button
              type="button"
              onClick={() => router.push("/loads")}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-sm text-[#8a8b8f] hover:text-[#16181d] transition-colors"
            >
              Discard & return
            </button>
          )}

          <div className="flex items-center gap-3">
            <span className="text-xs text-[#8a8b8f] hidden sm:inline">
              Step {currentStep + 1} of {STOPS_CONFIG.length}
            </span>

            {isFinalStep ? (
              <button
                type="button"
                onClick={() => createMutation.mutate()}
                disabled={createMutation.isPending}
                className="inline-flex items-center justify-center gap-2 rounded-full bg-[#d9622b] px-8 py-3 text-sm font-medium text-white shadow-xs hover:bg-[#c4531f] transition-colors disabled:opacity-60"
              >
                {createMutation.isPending ? "Publishing Load..." : "Publish & Book Load"}
                <ArrowRight className="size-4" />
              </button>
            ) : (
              <button
                type="button"
                onClick={handleNext}
                className="inline-flex items-center justify-center gap-2 rounded-full bg-[#16181d] px-8 py-3 text-sm font-medium text-white shadow-xs hover:bg-[#2a2d35] transition-colors"
              >
                {currentInfo.nextAction}
                <ArrowRight className="size-4" />
              </button>
            )}
          </div>
        </div>

        {/* Trust Signals Footer (Matches Onboarding) */}
        <div className="mt-12 flex items-center justify-center gap-4 font-mono text-[10px] tracking-[0.04em] text-[#8a8b8f]">
          <div className="flex items-center gap-1.5">
            <ShieldCheck className="h-3.5 w-3.5" />
            <span>REAL-TIME AUDIT LOGGED</span>
          </div>
          <span>·</span>
          <span>MULTI-STOP CAPABLE</span>
          <span>·</span>
          <span>ENTERPRISE TAX ENGINE</span>
        </div>
      </div>
    </div>
  )
}

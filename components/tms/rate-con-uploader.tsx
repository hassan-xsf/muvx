"use client"

import * as React from "react"
import { motion, AnimatePresence } from "motion/react"
import {
  Sparkles,
  UploadCloud,
  FileText,
  Loader2,
  CheckCircle2,
  AlertCircle,
  X,
} from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { sounds } from "@/lib/sound-effects"
import type { RateConfExtraction } from "@/lib/rate-conf-parser"

interface RateConUploaderProps {
  onParsed: (data: RateConfExtraction) => void
  defaultOpen?: boolean
}

export function RateConUploader({ onParsed, defaultOpen = false }: RateConUploaderProps) {
  const [isOpen, setIsOpen] = React.useState(defaultOpen)
  const [isDragging, setIsDragging] = React.useState(false)
  const [isUploading, setIsUploading] = React.useState(false)
  const [fileName, setFileName] = React.useState<string | null>(null)
  const fileInputRef = React.useRef<HTMLInputElement>(null)

  const handleFile = async (file: File) => {
    if (!file) return

    const validTypes = [
      "application/pdf",
      "image/png",
      "image/jpeg",
      "image/jpg",
      "image/webp",
    ]
    if (!validTypes.includes(file.type) && !file.name.toLowerCase().endsWith(".pdf")) {
      toast.error("Please upload a PDF or image file (PNG, JPG)")
      return
    }

    setFileName(file.name)
    setIsUploading(true)
    sounds.playPop()

    const formData = new FormData()
    formData.append("file", file)

    try {
      const res = await fetch("/api/loads/parse-rate-con", {
        method: "POST",
        body: formData,
      })

      const json = await res.json()

      if (!res.ok) {
        throw new Error(json.error || "Failed to extract rate confirmation")
      }

      const data: RateConfExtraction = json.data
      sounds.playSuccess()
      toast.success("Rate Confirmation extracted with AI!", {
        description: `Loaded ${data.customerName || "Customer"} · Rate: $${data.rate || 0} ${data.currency || "USD"}`,
      })

      onParsed(data)
      setIsOpen(false)
    } catch (err: any) {
      console.error("[RateConUploader] Error:", err)
      toast.error(err.message || "Failed to extract document. Please fill manually.")
    } finally {
      setIsUploading(false)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files?.[0]
    if (file) handleFile(file)
  }

  return (
    <div className="w-full mb-6">
      {!isOpen ? (
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-3.5 sm:p-4 rounded-xl border border-brand-accent/20 bg-brand-accent-tint/40 backdrop-blur-sm">
          <div className="flex items-start sm:items-center gap-3 min-w-0">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-brand-accent text-brand-cream shadow-sm">
              <Sparkles className="size-4 animate-pulse" />
            </div>
            <div className="min-w-0">
              <p className="text-xs sm:text-sm font-semibold text-brand-ink flex flex-wrap items-center gap-1.5">
                Have a Rate Confirmation PDF?
                <span className="inline-flex rounded-full bg-brand-accent/15 px-2 py-0.5 text-[10px] font-medium text-brand-accent">
                  Gemini 3.8 Flash
                </span>
              </p>
              <p className="text-[11px] sm:text-xs text-brand-muted-soft mt-0.5 leading-relaxed">
                Upload broker rate-con to auto-populate customer, linehaul rate, commodity, and multi-stop docks.
              </p>
            </div>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              sounds.playTrackpadClick()
              setIsOpen(true)
            }}
            className="w-full sm:w-auto shrink-0 border-brand-accent/30 text-brand-accent hover:bg-brand-accent hover:text-white transition-all text-xs font-medium rounded-lg h-8 cursor-pointer"
          >
            Auto-fill with AI
          </Button>
        </div>
      ) : (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          className="rounded-xl border border-brand-accent/30 bg-brand-card p-3.5 sm:p-4 shadow-sm"
        >
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2 min-w-0">
              <Sparkles className="size-4 text-brand-accent shrink-0" />
              <span className="text-xs font-semibold text-brand-ink uppercase tracking-wider font-mono truncate">
                Document AI Rate-Con Extraction
              </span>
            </div>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="text-brand-muted-soft hover:text-brand-ink rounded p-1"
            >
              <X className="size-4" />
            </button>
          </div>

          <div
            onDragOver={(e) => {
              e.preventDefault()
              setIsDragging(true)
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            onClick={() => !isUploading && fileInputRef.current?.click()}
            className={`cursor-pointer border-2 border-dashed rounded-lg p-4 sm:p-6 text-center transition-all ${
              isDragging
                ? "border-brand-accent bg-brand-accent-tint/50"
                : "border-brand-rule hover:border-brand-accent/50 bg-brand-cream/10"
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,image/png,image/jpeg,image/jpg"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) handleFile(f)
              }}
            />

            {isUploading ? (
              <div className="flex flex-col items-center justify-center py-3 space-y-2">
                <Loader2 className="size-8 text-brand-accent animate-spin" />
                <p className="text-xs font-medium text-brand-ink">
                  Reading document with Gemini 3.8 Flash...
                </p>
                <p className="text-[11px] text-brand-muted-soft">
                  Extracting tender #{fileName ? ` · ${fileName}` : ""}, pricing, and dock appointments
                </p>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center space-y-1.5">
                <div className="flex size-10 items-center justify-center rounded-full bg-brand-accent-tint text-brand-accent mb-1">
                  <UploadCloud className="size-5" />
                </div>
                <p className="text-xs font-medium text-brand-ink">
                  Click to select or drag & drop Rate Confirmation
                </p>
                <p className="text-[11px] text-brand-muted-soft">
                  PDF, PNG, or JPG up to 25MB · Instant parsing
                </p>
              </div>
            )}
          </div>
        </motion.div>
      )}
    </div>
  )
}

"use client"

import * as React from "react"
import { MapPin, Loader2, Building2 } from "lucide-react"
import { cn } from "@/lib/utils"

export interface SelectedAddressData {
  address: string
  city: string
  state: string
  zip: string
  country: string
  facilityName?: string
}

interface AddressSuggestion {
  id: string
  description: string
  mainText: string
  secondaryText: string
  address?: string
  city?: string
  state?: string
  zip?: string
  country?: string
  facilityName?: string
  source: "google" | "photon" | "nominatim"
}

interface AddressAutocompleteInputProps {
  id?: string
  value: string
  onChange: (value: string) => void
  onSelectAddress: (data: SelectedAddressData) => void
  placeholder?: string
  className?: string
  autoFocus?: boolean
  disabled?: boolean
}

export function AddressAutocompleteInput({
  id,
  value,
  onChange,
  onSelectAddress,
  placeholder = "e.g. 1500 Logistics Parkway",
  className,
  autoFocus,
  disabled,
}: AddressAutocompleteInputProps) {
  const [suggestions, setSuggestions] = React.useState<AddressSuggestion[]>([])
  const [isOpen, setIsOpen] = React.useState(false)
  const [isLoading, setIsLoading] = React.useState(false)
  const [highlightedIndex, setHighlightedIndex] = React.useState(-1)
  const wrapperRef = React.useRef<HTMLDivElement>(null)
  const abortControllerRef = React.useRef<AbortController | null>(null)

  // Debounced search
  React.useEffect(() => {
    if (!value || value.trim().length < 2) {
      setSuggestions([])
      setIsOpen(false)
      setIsLoading(false)
      return
    }

    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }

    const controller = new AbortController()
    abortControllerRef.current = controller

    setIsLoading(true)
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/places/autocomplete?input=${encodeURIComponent(value.trim())}`,
          { signal: controller.signal }
        )
        if (res.ok) {
          const data = await res.json()
          if (Array.isArray(data.suggestions) && data.suggestions.length > 0) {
            setSuggestions(data.suggestions)
            setIsOpen(true)
            setHighlightedIndex(-1)
          } else {
            setSuggestions([])
            setIsOpen(false)
          }
        }
      } catch (err: any) {
        if (err.name !== "AbortError") {
          console.error("Address autocomplete error:", err)
        }
      } finally {
        setIsLoading(false)
      }
    }, 200)

    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [value])

  // Handle click outside to close
  React.useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  const handleSelect = async (s: AddressSuggestion) => {
    setIsOpen(false)

    // If Google placeId, fetch full details for precise components
    if (s.source === "google" && !s.id.startsWith("photon-") && !s.id.startsWith("osm-")) {
      setIsLoading(true)
      try {
        const res = await fetch(`/api/places/details?placeId=${encodeURIComponent(s.id)}`)
        if (res.ok) {
          const details = await res.json()
          const finalAddress = details.address || s.address || s.mainText
          onChange(finalAddress)
          onSelectAddress({
            address: finalAddress,
            city: details.city || s.city || "",
            state: details.state || s.state || "",
            zip: details.zip || s.zip || "",
            country: details.country || s.country || "US",
            facilityName: details.facilityName || s.facilityName,
          })
          return
        }
      } catch (e) {
        console.warn("Details fetch failed, using suggestion data:", e)
      } finally {
        setIsLoading(false)
      }
    }

    // Direct structured suggestion (Photon / Nominatim)
    const finalAddress = s.address || s.mainText || s.description
    onChange(finalAddress)
    onSelectAddress({
      address: finalAddress,
      city: s.city || "",
      state: s.state || "",
      zip: s.zip || "",
      country: s.country || "US",
      facilityName: s.facilityName,
    })
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen || suggestions.length === 0) return

    if (e.key === "ArrowDown") {
      e.preventDefault()
      setHighlightedIndex((prev) => (prev < suggestions.length - 1 ? prev + 1 : 0))
    } else if (e.key === "ArrowUp") {
      e.preventDefault()
      setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : suggestions.length - 1))
    } else if (e.key === "Enter" && highlightedIndex >= 0) {
      e.preventDefault()
      handleSelect(suggestions[highlightedIndex])
    } else if (e.key === "Escape") {
      setIsOpen(false)
    }
  }

  return (
    <div ref={wrapperRef} className="relative w-full">
      <div className="relative">
        <input
          id={id}
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => {
            if (suggestions.length > 0) setIsOpen(true)
          }}
          placeholder={placeholder}
          autoFocus={autoFocus}
          disabled={disabled}
          autoComplete="off"
          className={cn("input-base pr-8", className)}
        />
        {isLoading && (
          <div className="absolute right-2.5 top-1/2 -translate-y-1/2 text-brand-muted-soft">
            <Loader2 className="size-3.5 animate-spin" />
          </div>
        )}
      </div>

      {isOpen && suggestions.length > 0 && (
        <ul
          className="absolute z-50 mt-1 max-h-64 w-full overflow-auto rounded-lg border border-brand-rule bg-white py-1 shadow-xl dark:bg-zinc-900 text-xs"
          role="listbox"
        >
          {suggestions.map((s, idx) => {
            const isHighlighted = idx === highlightedIndex
            return (
              <li
                key={s.id || idx}
                role="option"
                aria-selected={isHighlighted}
                onMouseDown={(e) => {
                  e.preventDefault()
                  handleSelect(s)
                }}
                onMouseEnter={() => setHighlightedIndex(idx)}
                className={cn(
                  "flex items-start gap-2.5 px-3 py-2 cursor-pointer transition-colors text-left border-b border-brand-rule/30 last:border-b-0",
                  isHighlighted
                    ? "bg-brand-cream-soft dark:bg-zinc-800 text-brand-ink dark:text-brand-cream"
                    : "text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800/60"
                )}
              >
                {s.facilityName ? (
                  <Building2 className="size-3.5 mt-0.5 shrink-0 text-[#d9622b]" />
                ) : (
                  <MapPin className="size-3.5 mt-0.5 shrink-0 text-[#d9622b]" />
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="font-medium text-brand-ink dark:text-brand-cream truncate">
                      {s.mainText}
                    </span>
                    {s.state && (
                      <span className="rounded bg-brand-cream-soft px-1.5 py-0.5 text-[9px] font-mono font-medium text-brand-muted uppercase border border-brand-rule/60">
                        {s.state}{s.zip ? ` ${s.zip}` : ""}
                      </span>
                    )}
                  </div>
                  {s.secondaryText && (
                    <div className="text-[11px] text-zinc-500 truncate mt-0.5">
                      {s.secondaryText}
                    </div>
                  )}
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

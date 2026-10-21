/**
 * lib/geography.ts — Dynamic Global Geography Engine.
 *
 * Provides ISO 3166-1 (249 countries) and ISO 3166-2 (thousands of administrative
 * subdivisions: states, provinces, territories, cantons, departments).
 * Zero hardcoded country/state arrays — dynamically indexed from official ISO data.
 */

import { allCountries, type Region } from "country-region-data"

export interface CountryOption {
  code: string // ISO 3166-1 alpha-2 e.g. "US", "CA", "MX", "DE"
  name: string // Official country name
  subdivisionCount: number
}

export interface SubdivisionOption {
  code: string // ISO 3166-2 code e.g. "TX", "ON", "BC", "NL"
  name: string // Full subdivision name e.g. "Texas", "Ontario"
  countryCode: string
}

// Major North American freight trading jurisdictions prioritized at the top of select dropdowns
const PRIORITY_FREIGHT_COUNTRIES = ["US", "CA", "MX"]

// Dynamically indexed lookup map built in-memory on module initialization
const dynamicSubdivisionIndex = new Map<string, string>()

for (const [, countryCode, regions] of allCountries) {
  if (!regions) continue
  const cCode = countryCode.toUpperCase()
  for (const [regionName, regionCode] of regions) {
    const code = (regionCode || regionName).toUpperCase()
    dynamicSubdivisionIndex.set(`${cCode}:${regionName.toLowerCase()}`, code)
    dynamicSubdivisionIndex.set(`${cCode}:${code.toLowerCase()}`, code)
    const globalKey = regionName.toLowerCase()
    if (!dynamicSubdivisionIndex.has(globalKey)) {
      dynamicSubdivisionIndex.set(globalKey, code)
    }
  }
}

/**
 * Returns all 249 official ISO 3166-1 countries dynamically.
 */
export function getAllCountries(): CountryOption[] {
  const mapped = allCountries.map(([name, code, regions]) => ({
    name,
    code,
    subdivisionCount: regions ? regions.length : 0,
  }))

  const priority: CountryOption[] = []
  const rest: CountryOption[] = []

  for (const c of mapped) {
    if (PRIORITY_FREIGHT_COUNTRIES.includes(c.code)) {
      priority.push(c)
    } else {
      rest.push(c)
    }
  }

  priority.sort(
    (a, b) =>
      PRIORITY_FREIGHT_COUNTRIES.indexOf(a.code) -
      PRIORITY_FREIGHT_COUNTRIES.indexOf(b.code)
  )

  rest.sort((a, b) => a.name.localeCompare(b.name))

  return [...priority, ...rest]
}

/**
 * Returns all official ISO 3166-2 subdivisions (states, provinces, territories)
 * dynamically for any given country code.
 */
export function getSubdivisions(countryCode: string): SubdivisionOption[] {
  if (!countryCode) return []

  const upperCode = countryCode.toUpperCase()
  const country = allCountries.find(
    ([, code]) => code.toUpperCase() === upperCode
  )

  if (!country || !country[2]) return []

  const regions: Region[] = country[2]
  return regions.map(([regionName, regionCode]) => ({
    name: regionName,
    code: regionCode || regionName,
    countryCode: upperCode,
  }))
}

/**
 * Look up the full name of a country by its ISO code dynamically.
 */
export function getCountryName(countryCode: string): string {
  if (!countryCode) return ""
  const upperCode = countryCode.toUpperCase()
  const country = allCountries.find(
    ([, code]) => code.toUpperCase() === upperCode
  )
  return country ? country[0] : countryCode
}

/**
 * Look up the full name of a subdivision (state/province) dynamically.
 */
export function getSubdivisionName(
  countryCode: string,
  subdivisionCode: string
): string {
  if (!countryCode || !subdivisionCode) return subdivisionCode || ""
  const regions = getSubdivisions(countryCode)
  const match = regions.find(
    (r) =>
      r.code.toUpperCase() === subdivisionCode.toUpperCase() ||
      r.name.toUpperCase() === subdivisionCode.toUpperCase()
  )
  return match ? match.name : subdivisionCode
}

/**
 * Dynamically normalizes any state, province, or region name/code from geocoding
 * into its official ISO 3166-2 abbreviation (e.g. "Texas" -> "TX", "Ontario" -> "ON").
 * Uses dynamic indexing from the official ISO catalog with zero hardcoded values.
 */
export function normalizeSubdivisionCode(
  countryCode: string | undefined | null,
  stateOrRegion: string | undefined | null
): string {
  if (!stateOrRegion) return ""
  let clean = stateOrRegion.trim()
  if (!clean) return ""

  // Strip international prefix format if present e.g. "US-TX" -> "TX"
  if (/^[a-zA-Z]{2}[-_][a-zA-Z0-9]{2,3}$/.test(clean)) {
    clean = clean.split(/[-_]/)[1]
  }

  // If already a valid 2-letter uppercase or lowercase code
  if (clean.length === 2 && /^[a-zA-Z]{2}$/.test(clean)) {
    return clean.toUpperCase()
  }

  const c = (countryCode || "US").toUpperCase()
  const lower = clean.toLowerCase()

  // 1. Direct match within specified country
  const countryMatch = dynamicSubdivisionIndex.get(`${c}:${lower}`)
  if (countryMatch) return countryMatch

  // 2. Global match across all countries
  const globalMatch = dynamicSubdivisionIndex.get(lower)
  if (globalMatch) return globalMatch

  return clean.toUpperCase()
}

/**
 * Formats a clean, multi-national geographic label.
 * e.g. "Dallas, TX, US" or "Toronto, ON, Canada"
 */
export function formatLocationString({
  city,
  state,
  countryCode,
  zip,
}: {
  city?: string | null
  state?: string | null
  countryCode?: string | null
  zip?: string | null
}): string {
  const parts: string[] = []
  if (city) parts.push(city)
  if (state) parts.push(normalizeSubdivisionCode(countryCode, state))
  if (zip) parts.push(zip)
  if (countryCode && countryCode !== "US") {
    parts.push(getCountryName(countryCode) || countryCode)
  }
  return parts.join(", ")
}

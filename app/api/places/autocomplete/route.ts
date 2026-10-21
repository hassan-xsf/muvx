import { NextResponse } from "next/server"
import { normalizeSubdivisionCode } from "@/lib/geography"

export interface AddressSuggestion {
  id: string
  description: string
  mainText: string
  secondaryText: string
  address?: string
  city?: string
  state?: string // 2-letter uppercase ISO code
  zip?: string
  country?: string // 2-letter uppercase ISO code
  facilityName?: string
  source: "google" | "photon" | "nominatim"
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const input = searchParams.get("input")?.trim()

  if (!input || input.length < 2) {
    return NextResponse.json({ suggestions: [] })
  }

  const googleKey =
    process.env.GOOGLE_PLACES_API_KEY ||
    process.env.GOOGLE_MAPS_API_KEY ||
    process.env.GOOGLE_API_KEY

  // 1. Try Google Places Autocomplete if key is available
  if (googleKey && !googleKey.startsWith("AIzaSy_REDACTED")) {
    try {
      const gUrl = `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(
        input
      )}&types=geocode|establishment&key=${googleKey}`
      const gRes = await fetch(gUrl, { signal: AbortSignal.timeout(2500) })
      if (gRes.ok) {
        const gData = await gRes.json()
        if (
          gData.status === "OK" &&
          Array.isArray(gData.predictions) &&
          gData.predictions.length > 0
        ) {
          const suggestions: AddressSuggestion[] = gData.predictions.map((p: any) => ({
            id: p.place_id,
            description: p.description,
            mainText: p.structured_formatting?.main_text || p.description,
            secondaryText: p.structured_formatting?.secondary_text || "",
            source: "google",
          }))
          return NextResponse.json({ suggestions })
        }
      }
    } catch {
      // Fall through to fast geocoding providers
    }
  }

  // 2. High-speed Photon Komoot Geocoder (100ms structured address resolution)
  try {
    const photonUrl = `https://photon.komoot.io/api/?q=${encodeURIComponent(
      input
    )}&limit=6`
    const pRes = await fetch(photonUrl, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(2000),
    })

    if (pRes.ok) {
      const pData = await pRes.json()
      if (Array.isArray(pData.features) && pData.features.length > 0) {
        const suggestions: AddressSuggestion[] = pData.features.map(
          (feat: any, idx: number) => {
            const prop = feat.properties || {}
            const countryCode = (prop.countrycode || "US").toUpperCase()
            const state = normalizeSubdivisionCode(countryCode, prop.state || "")
            const city =
              prop.city || prop.locality || prop.district || prop.county || ""
            const houseNumber = prop.housenumber ? `${prop.housenumber} ` : ""
            const streetName = prop.street || (prop.type === "street" ? prop.name : "")
            const street = streetName ? `${houseNumber}${streetName}` : ""
            const zip = prop.postcode || ""

            let facilityName: string | undefined
            if (
              prop.osm_key === "amenity" ||
              prop.osm_key === "industrial" ||
              prop.osm_key === "building" ||
              prop.osm_key === "shop" ||
              (prop.name && prop.name !== prop.street && prop.name !== city)
            ) {
              facilityName = prop.name
            }

            const mainText =
              facilityName ||
              street ||
              (city ? `${city}${state ? `, ${state}` : ""}` : prop.name || input)

            const secondaryParts = [
              facilityName && street ? street : null,
              city,
              state,
              zip,
              countryCode !== "US" ? prop.country : null,
            ].filter(Boolean)

            return {
              id: `photon-${prop.osm_id || idx}`,
              description: [mainText, ...secondaryParts].filter(Boolean).join(", "),
              mainText,
              secondaryText: secondaryParts.join(", "),
              address: street || (houseNumber ? `${houseNumber}${mainText}` : mainText),
              city,
              state,
              zip,
              country: countryCode,
              facilityName,
              source: "photon",
            }
          }
        )

        return NextResponse.json({ suggestions })
      }
    }
  } catch (err) {
    // Fall through to Nominatim
  }

  // 3. Fallback: Detailed Nominatim OpenStreetMap Geocoding
  try {
    const nomUrl = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(
      input
    )}&format=json&addressdetails=1&limit=6`
    const nRes = await fetch(nomUrl, {
      headers: {
        "User-Agent": "MuvxTMS/2.0 (dispatch@muvxtms.com)",
        Accept: "application/json",
      },
      signal: AbortSignal.timeout(3000),
    })

    if (nRes.ok) {
      const nData = await nRes.json()
      if (Array.isArray(nData) && nData.length > 0) {
        const suggestions: AddressSuggestion[] = nData.map((item: any, idx: number) => {
          const addr = item.address || {}
          const countryCode = (addr.country_code || "US").toUpperCase()
          const state = normalizeSubdivisionCode(countryCode, addr.state || "")
          const city =
            addr.city ||
            addr.town ||
            addr.village ||
            addr.municipality ||
            addr.county ||
            ""
          const houseNumber = addr.house_number ? `${addr.house_number} ` : ""
          const street = addr.road ? `${houseNumber}${addr.road}` : ""
          const zip = addr.postcode || ""

          const facilityName =
            item.class === "amenity" || item.class === "industrial" || item.type === "warehouse"
              ? item.name
              : undefined

          const mainText = facilityName || street || item.name || city
          const secondaryParts = [city, state, zip, countryCode].filter(Boolean)

          return {
            id: `osm-${item.place_id || idx}`,
            description: item.display_name,
            mainText,
            secondaryText: secondaryParts.join(", "),
            address: street || mainText,
            city,
            state,
            zip,
            country: countryCode,
            facilityName,
            source: "nominatim",
          }
        })

        return NextResponse.json({ suggestions })
      }
    }
  } catch (err) {
    console.error("Geocoding lookup error:", err)
  }

  return NextResponse.json({ suggestions: [] })
}

import { NextResponse } from "next/server"

interface Suggestion {
  id: string
  description: string
  mainText: string
  secondaryText: string
  city?: string
  state?: string
  zip?: string
  country?: string
  source: "google" | "photon"
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

  // 1. Try Google Places API if key exists
  if (googleKey && !googleKey.startsWith("AIzaSy_REDACTED")) {
    try {
      const gUrl = `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(
        input
      )}&types=geocode|establishment&key=${googleKey}`
      const gRes = await fetch(gUrl, { signal: AbortSignal.timeout(3500) })
      if (gRes.ok) {
        const gData = await gRes.json()
        if (gData.status === "OK" && Array.isArray(gData.predictions) && gData.predictions.length > 0) {
          const suggestions: Suggestion[] = gData.predictions.map((p: any) => ({
            id: p.place_id,
            description: p.description,
            mainText: p.structured_formatting?.main_text || p.description,
            secondaryText: p.structured_formatting?.secondary_text || "",
            source: "google",
          }))
          return NextResponse.json({ suggestions })
        }
      }
    } catch (e) {
      // Fallback below
    }
  }

  // 2. High-reliability fallback: Photon / OpenStreetMap Geocoding
  try {
    const photonUrl = `https://photon.komoot.io/api/?q=${encodeURIComponent(
      input
    )}&limit=6`
    const pRes = await fetch(photonUrl, {
      headers: { "User-Agent": "MuvxTMS/1.0" },
      signal: AbortSignal.timeout(3500),
    })

    if (pRes.ok) {
      const pData = await pRes.json()
      if (Array.isArray(pData.features)) {
        const suggestions: Suggestion[] = pData.features.map((f: any, idx: number) => {
          const p = f.properties || {}
          const streetNum = p.housenumber ? `${p.housenumber} ` : ""
          const street = p.street ? `${streetNum}${p.street}` : p.name || ""
          const city = p.city || p.locality || p.county || ""
          const state = p.state || ""
          const zip = p.postcode || ""
          const country = p.countrycode?.toUpperCase() || (p.country === "Canada" ? "CA" : "US")

          const parts = [street, city, state, zip].filter(Boolean)
          const description = parts.join(", ")

          return {
            id: `photon-${p.osm_id || idx}`,
            description: description || p.name || input,
            mainText: street || p.name || description,
            secondaryText: [city, state, country].filter(Boolean).join(", "),
            city,
            state,
            zip,
            country,
            source: "photon",
          }
        })

        return NextResponse.json({ suggestions })
      }
    }
  } catch (err) {
    console.error("Address autocomplete error:", err)
  }

  return NextResponse.json({ suggestions: [] })
}

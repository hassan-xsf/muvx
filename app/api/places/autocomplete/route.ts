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
  source: "google" | "nominatim" | "photon"
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

  // 1. Try Google Places API if valid key exists
  if (googleKey && !googleKey.startsWith("AIzaSy_REDACTED")) {
    try {
      const gUrl = `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(
        input
      )}&types=geocode|establishment&key=${googleKey}`
      const gRes = await fetch(gUrl, { signal: AbortSignal.timeout(2500) })
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
    } catch {
      // Fall through to Nominatim
    }
  }

  // 2. High-speed, high-accuracy Nominatim OpenStreetMap Geocoding
  try {
    const nomUrl = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(
      input
    )}&format=json&addressdetails=1&limit=6`
    const nRes = await fetch(nomUrl, {
      headers: {
        "User-Agent": "MuvxLogisticsApp/1.0 (dispatch@muvx.com)",
        Accept: "application/json",
      },
      signal: AbortSignal.timeout(3500),
    })

    if (nRes.ok) {
      const nData = await nRes.json()
      if (Array.isArray(nData) && nData.length > 0) {
        const suggestions: Suggestion[] = nData.map((item: any, idx: number) => {
          const addr = item.address || {}
          const houseNumber = addr.house_number ? `${addr.house_number} ` : ""
          const street = addr.road ? `${houseNumber}${addr.road}` : item.name || ""
          const city =
            addr.city ||
            addr.town ||
            addr.village ||
            addr.municipality ||
            addr.county ||
            ""
          const state = addr.state || ""
          const zip = addr.postcode || ""
          const country = (addr.country_code || "us").toUpperCase()

          const mainText = street || item.name || city
          const secondaryParts = [city, state, country].filter(Boolean)
          const secondaryText = secondaryParts.join(", ")

          return {
            id: `osm-${item.place_id || idx}`,
            description: item.display_name,
            mainText,
            secondaryText,
            city,
            state,
            zip,
            country,
            source: "nominatim",
          }
        })

        return NextResponse.json({ suggestions })
      }
    }
  } catch (err) {
    console.error("Nominatim geocoding error:", err)
  }

  return NextResponse.json({ suggestions: [] })
}

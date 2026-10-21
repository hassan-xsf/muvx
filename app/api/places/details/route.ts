import { NextResponse } from "next/server"
import { normalizeSubdivisionCode } from "@/lib/geography"

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const placeId = searchParams.get("placeId")?.trim()

  if (!placeId) {
    return NextResponse.json({ error: "placeId required" }, { status: 400 })
  }

  const googleKey =
    process.env.GOOGLE_PLACES_API_KEY ||
    process.env.GOOGLE_MAPS_API_KEY ||
    process.env.GOOGLE_API_KEY

  if (googleKey && !placeId.startsWith("photon-") && !placeId.startsWith("osm-")) {
    try {
      const gUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${encodeURIComponent(
        placeId
      )}&fields=address_components,formatted_address,geometry,name&key=${googleKey}`
      const gRes = await fetch(gUrl, { signal: AbortSignal.timeout(4000) })
      if (gRes.ok) {
        const gData = await gRes.json()
        if (gData.status === "OK" && gData.result) {
          const comps = gData.result.address_components || []
          let streetNumber = ""
          let route = ""
          let city = ""
          let state = ""
          let zip = ""
          let country = "US"

          for (const c of comps) {
            const types = c.types || []
            if (types.includes("street_number")) streetNumber = c.long_name
            if (types.includes("route")) route = c.long_name
            if (types.includes("locality")) city = c.long_name
            if (!city && types.includes("sublocality")) city = c.long_name
            if (!city && types.includes("administrative_area_level_2")) city = c.long_name
            if (types.includes("administrative_area_level_1")) {
              state = c.short_name || c.long_name
            }
            if (types.includes("postal_code")) zip = c.long_name
            if (types.includes("country")) country = (c.short_name || "US").toUpperCase()
          }

          // Normalize state to standard 2-letter uppercase postal code (e.g. "TX", "GA")
          state = normalizeSubdivisionCode(country, state)

          const street = [streetNumber, route].filter(Boolean).join(" ")
          const facilityName =
            gData.result.name && gData.result.name !== street && gData.result.name !== gData.result.formatted_address
              ? gData.result.name
              : undefined

          return NextResponse.json({
            address: street || gData.result.formatted_address,
            city,
            state,
            zip,
            country,
            facilityName,
            formattedAddress: gData.result.formatted_address,
            location: gData.result.geometry?.location,
          })
        }
      }
    } catch (e) {
      console.error("Google Place Details error:", e)
    }
  }

  return NextResponse.json({
    address: "",
    city: "",
    state: "",
    zip: "",
    country: "US",
  })
}

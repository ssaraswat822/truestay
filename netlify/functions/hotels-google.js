// netlify/functions/hotels-google.js
//
// OPTIONAL UPGRADE — not wired into the app yet.
//
// This shows how to replace Claude's web_search with REAL hotel data + REAL
// review text from the Google Places API. Once this returns solid data, you
// pass `hotels` into the Pass-2 prompt in surface.js (and remove the
// web_search tool), so Claude does ONLY the intent-reading and the
// honest-signal extraction — not the finding.
//
// Required env var: GOOGLE_PLACES_API_KEY
//
// Why Google Places: its Place Details endpoint returns individual user
// reviews WITH text — which is exactly what the "what guests actually say"
// feature needs. Most hotel APIs give you a star number but no review prose.

const TEXT_SEARCH = "https://places.googleapis.com/v1/places:searchText";
const DETAILS = "https://places.googleapis.com/v1/places/";

export async function handler(event) {
  if (!process.env.GOOGLE_PLACES_API_KEY) {
    return json(500, { error: "Missing GOOGLE_PLACES_API_KEY" });
  }

  const { destination, vibe = [] } = JSON.parse(event.body || "{}");
  if (!destination) return json(400, { error: "Missing 'destination'" });

  try {
    // 1. Find candidate hotels in the destination.
    const searchRes = await fetch(TEXT_SEARCH, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": process.env.GOOGLE_PLACES_API_KEY,
        // Field mask keeps cost down — only ask for what you use.
        "X-Goog-FieldMask":
          "places.id,places.displayName,places.formattedAddress,places.rating,places.priceLevel",
      },
      body: JSON.stringify({
        textQuery: `hotels in ${destination} ${vibe.join(" ")}`.trim(),
        maxResultCount: 8,
      }),
    });
    const search = await searchRes.json();
    const places = search.places || [];

    // 2. For each, pull details INCLUDING review text.
    const hotels = await Promise.all(
      places.slice(0, 6).map(async (p) => {
        const dRes = await fetch(`${DETAILS}${p.id}`, {
          headers: {
            "X-Goog-Api-Key": process.env.GOOGLE_PLACES_API_KEY,
            "X-Goog-FieldMask":
              "displayName,formattedAddress,rating,userRatingCount,reviews,websiteUri,googleMapsUri",
          },
        });
        const d = await dRes.json();
        return {
          name: d.displayName?.text,
          neighborhood: d.formattedAddress,
          rating_10: d.rating ? (d.rating * 2).toFixed(1) : null, // Google is /5
          review_count: d.userRatingCount,
          // Raw review prose — feed this to Claude to extract honest signals.
          reviews: (d.reviews || []).map((r) => r.text?.text).filter(Boolean),
          booking_url: d.websiteUri || d.googleMapsUri,
        };
      })
    );

    return json(200, { hotels });
  } catch (err) {
    console.error(err);
    return json(500, { error: String(err.message || err) });
  }
}

function json(statusCode, obj) {
  return {
    statusCode,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(obj),
  };
}

// netlify/functions/surface.js
//
// One endpoint, two AI passes:
//   1. Interpret the traveler's natural-language request into structured criteria.
//   2. Surface real hotels + the "honest signal" review layer.
//
// The Anthropic API key lives ONLY here (server-side), never in the browser.
//
// Required env var:  ANTHROPIC_API_KEY
// Optional (see comments lower down): GOOGLE_PLACES_API_KEY, AMADEUS_* etc.

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const MODEL = "claude-sonnet-4-6";

async function callClaude(messages, tools) {
  const body = { model: MODEL, max_tokens: 1500, messages };
  if (tools) body.tools = tools;

  const res = await fetch(ANTHROPIC_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Anthropic ${res.status}: ${text}`);
  }
  return res.json();
}

function extractText(data) {
  return (data.content || [])
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("\n");
}

function parseJSON(text, open, close) {
  const clean = text.replace(/```json|```/g, "").trim();
  const s = clean.indexOf(open);
  const e = clean.lastIndexOf(close);
  return JSON.parse(clean.slice(s, e + 1));
}

export async function handler(event) {
  // CORS preflight (handy during local dev / if you ever call cross-origin)
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: cors(), body: "" };
  }
  if (event.httpMethod !== "POST") {
    return resp(405, { error: "Method not allowed" });
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    return resp(500, { error: "Server missing ANTHROPIC_API_KEY" });
  }

  let query;
  try {
    ({ query } = JSON.parse(event.body || "{}"));
  } catch {
    return resp(400, { error: "Invalid JSON body" });
  }
  if (!query || !query.trim()) {
    return resp(400, { error: "Missing 'query'" });
  }

  try {
    // ---- Pass 1: intent & mood -> structured criteria ----
    const parsePrompt = `You are an expert travel concierge who reads between the lines. A traveler describes their ideal stay in natural, sometimes vibe-based language. Translate their INTENT and MOOD into concrete attributes.

Respond with ONLY a JSON object, no markdown, no preamble:
{"destination": string, "max_price_per_night_usd": number|null, "guests": string, "vibe": string[], "must_haves": string[], "mood_reading": string}

- vibe: the emotional/aesthetic qualities you infer (e.g. "whimsical", "design-led", "calm", "social")
- must_haves: concrete features implied by the request, even if not stated literally (e.g. "Wes Anderson" implies "characterful interiors"; "solo-friendly" implies "safe walkable area, good single rooms")
- mood_reading: one warm sentence reflecting back what they're really after.

Request: "${query}"`;

    const parsed = await callClaude([{ role: "user", content: parsePrompt }]);
    const criteria = parseJSON(extractText(parsed), "{", "}");

    // ---- Pass 2: listings + honest-signal review layer ----
    //
    // NOTE: this currently uses Claude's web_search to both find hotels and
    // read reviews. When you wire up a real data API (see README), fetch the
    // hotels + review text FIRST, then pass them into this prompt and drop the
    // web_search tool — the prompt logic stays the same.
    const searchPrompt = `Find real, currently-listed hotels matching this traveler's request. Use web search to find actual hotels AND to read what real guests say about them.

Request: "${query}"
Interpreted criteria: ${JSON.stringify(criteria)}

For each hotel, dig into real guest reviews. Extract CONCRETE, SPECIFIC observations — physical details, quirks, things only a real guest would notice (thin walls, slow elevator, great rooftop, parking fee, noisy street). Avoid generic marketing language. Also identify ONE honest downside that booking sites would bury.

Respond with ONLY a JSON array (no markdown), up to 6 hotels, best match first:
[{
  "name": string,
  "neighborhood": string,
  "all_in_estimate": string,
  "headline_rate": string,
  "rating": number,
  "match_score": number,
  "why_it_fits": string,
  "guest_signals": string[],
  "honest_take": string,
  "booking_url": string,
  "booking_site": string
}]

- match_score: 0-100, how well it fits their vibe and budget.
- rating: typical guest rating out of 10 (e.g. 8.7).
- why_it_fits: reference their SPECIFIC asks and mood. Under 28 words.
- all_in_estimate: estimated nightly price INCLUDING typical resort fees/taxes, number only like "420". headline_rate: the misleading base rate, number only like "359".
- guest_signals: 2-3 short, concrete, specific things real guests actually report. Under 14 words each. Mix positive and practical.
- honest_take: one candid downside, phrased helpfully. Under 24 words.
- booking_url: a REAL working URL from your search — prefer Booking.com, Expedia, or Hotels.com; else the hotel's official site. Never invent one. booking_site: short name.`;

    const searched = await callClaude(
      [{ role: "user", content: searchPrompt }],
      [{ type: "web_search_20250305", name: "web_search" }]
    );
    const hotels = parseJSON(extractText(searched), "[", "]");
    hotels.sort((a, b) => (b.match_score || 0) - (a.match_score || 0));

    return resp(200, { criteria, hotels });
  } catch (err) {
    console.error(err);
    return resp(500, { error: "Failed to surface stays", detail: String(err.message || err) });
  }
}

function cors() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };
}
function resp(statusCode, obj) {
  return {
    statusCode,
    headers: { "Content-Type": "application/json", ...cors() },
    body: JSON.stringify(obj),
  };
}

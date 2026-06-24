# truestay

Describe a hotel the way you'd describe it to a friend — *"somewhere that feels
like a Wes Anderson film, walkable to good coffee, under $400"* — and an AI layer
interprets what you actually want, surfaces real matches, and tells you **what
real guests actually say**, including the one honest downside booking sites bury.

Built with React + Vite, deployed on Netlify with serverless functions so API
keys stay server-side.

---

## The architecture in one picture

```
Browser (React)
   │  POST { query }
   ▼
/.netlify/functions/surface         ← your API key lives here, never in the browser
   │
   ├─ Pass 1 (Claude): natural language ─► structured criteria + mood reading
   └─ Pass 2 (Claude + web search): real hotels + "honest signal" review layer
   │
   ▼  { criteria, hotels }
Browser renders ranked cards
```

---

## Run it locally

```bash
npm install
npm i -g netlify-cli        # one-time, gives you `netlify dev`
cp .env.example .env        # then paste your real ANTHROPIC_API_KEY
netlify dev                 # serves the site AND the functions together
```

Open the URL it prints (usually http://localhost:8888). Using `netlify dev`
(not plain `vite`) matters — it's what makes `/.netlify/functions/surface`
resolve locally.

---

## Deploy to Netlify

1. Push this folder to a GitHub repo.
2. In Netlify: **Add new site → Import from Git**, pick the repo. The build
   settings come from `netlify.toml` automatically.
3. **Site settings → Environment variables →** add `ANTHROPIC_API_KEY`.
4. Deploy. That's it — you get a live URL you can drop in your LinkedIn post.

---

## Which APIs to go get

You need **one** key to ship the demo. The rest are optional upgrades.

### 1. Anthropic — REQUIRED (the AI brain)
- Get a key: https://console.anthropic.com → API Keys.
- Powers both the intent-reading and the honest-signal extraction.
- This is the only key the current code needs.

### 2. Google Places — RECOMMENDED first upgrade (real hotels + real reviews)
- Get a key: https://console.cloud.google.com → enable **Places API (New)**.
- **Why this one:** its Place Details endpoint returns individual user reviews
  *with text* — which is exactly what the "what guests actually say" feature
  feeds on. Most hotel APIs give you a star number but no review prose.
- A starter function is already scaffolded at
  `netlify/functions/hotels-google.js`. Wire its output into Pass 2 of
  `surface.js` and drop the `web_search` tool — then Claude does only the
  interpreting, not the finding.
- Has a generous free monthly credit; use a field mask (already done in the
  stub) to keep calls cheap.

### 3. Live pricing / availability — OPTIONAL
- **Xotelo** (https://xotelo.com) — free, no approval gate, OTA-sourced prices.
  Easiest drop-in for real nightly rates. Read-only, no booking.
- **Amadeus Self-Service** (https://developers.amadeus.com) — free test tier
  with real hotel search/availability; same code works in production (paid).
  More "real," but signup + test-inventory limits.

### 4. Affiliate deep-links + commission — OPTIONAL, later
- **Booking.com affiliate** / **Expedia Rapid** partner programs give you a
  guaranteed bookable `url` per hotel *with your affiliate ID* — so the
  "View deal" button can actually earn referral commission. Requires applying
  to the affiliate program.

### Recommended path
Ship today with **Anthropic only**. When you want it to feel truly real, add
**Google Places** (hotels + the all-important review text). Add **Xotelo or
Amadeus** if you want firmer live prices, and an **affiliate program** last if
you ever want the links to make money.

---

## Notes
- Prices and "all-in" estimates are AI estimates in the demo — clearly labeled
  as such. Real numbers come once you add a pricing API.
- Nothing here processes payments or bookings; it's a discovery/metasearch layer
  that hands off to the booking site. That's deliberate — it sidesteps all the
  licensing and payment complexity.

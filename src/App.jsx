import React, { useState } from "react";

const EXAMPLES = [
  "Somewhere in Chicago that feels like a Wes Anderson film, under $400 a night",
  "A hotel where I won't feel weird traveling solo, walkable to good coffee",
  "Quiet boutique stay in Kyoto near temples, traditional, with an onsen",
  "Beachfront in Tulum, adults-only, big pool, not full of bachelor parties",
];

export default function App() {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("idle"); // idle | parsing | searching | done | error
  const [criteria, setCriteria] = useState(null);
  const [results, setResults] = useState([]);
  const [error, setError] = useState("");

  async function run() {
    if (!query.trim()) return;
    setError("");
    setResults([]);
    setCriteria(null);

    try {
      setStatus("parsing");
      // Single call to our serverless backend. It runs BOTH AI passes
      // server-side so the Anthropic key never reaches the browser.
      const res = await fetch("/.netlify/functions/surface", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query }),
      });

      setStatus("searching");
      if (!res.ok) {
        const e = await res.json().catch(() => ({}));
        throw new Error(e.error || "Request failed");
      }
      const data = await res.json();
      setCriteria(data.criteria || null);
      setResults((data.hotels || []).sort((a, b) => (b.match_score || 0) - (a.match_score || 0)));
      setStatus("done");
    } catch (e) {
      console.error(e);
      setError("Something went wrong surfacing stays. Try again in a moment.");
      setStatus("error");
    }
  }

  const busy = status === "parsing" || status === "searching";

  function ratingLabel(r) {
    if (r >= 9) return "Exceptional";
    if (r >= 8) return "Very good";
    if (r >= 7) return "Good";
    return "Pleasant";
  }

  return (
    <div style={S.root}>
      <style>{CSS}</style>

      <nav style={S.nav}>
        <div style={S.logo}>
          <span style={S.logoMark}>◇</span> truestay
        </div>
        <div style={S.navLinks}>
          <span style={S.navLink}>How it works</span>
          <span style={S.navLink}>Sign in</span>
        </div>
      </nav>

      <section style={S.hero}>
        <h1 style={S.h1}>Find a hotel by describing it, not filtering it.</h1>
        <p style={S.sub}>
          Booking sites are built to sell you rooms. We read what you actually want — then show
          you what real guests actually say.
        </p>

        <div style={S.searchBar}>
          <span style={S.searchIcon}>⌕</span>
          <input
            style={S.input}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Try: a calm boutique hotel in Lisbon, walkable to nightlife, under $250"
            onKeyDown={(e) => e.key === "Enter" && run()}
          />
          <button style={{ ...S.searchBtn, opacity: busy ? 0.7 : 1 }} onClick={run} disabled={busy}>
            {busy ? "Searching…" : "Search"}
          </button>
        </div>

        {status === "idle" && (
          <div style={S.examples}>
            {EXAMPLES.map((ex, i) => (
              <button key={i} style={S.chip} className="chip" onClick={() => setQuery(ex)}>
                {ex.length > 50 ? ex.slice(0, 50) + "…" : ex}
              </button>
            ))}
          </div>
        )}
      </section>

      <div style={S.body}>
        {busy && (
          <div style={S.loading}>
            <div className="spinner" style={S.spinner} />
            {status === "parsing"
              ? "Reading what you're really after…"
              : "Surfacing stays & reading real guest reviews…"}
          </div>
        )}

        {criteria && criteria.mood_reading && (
          <div style={S.moodBar}>
            <div style={S.moodLeft}>
              <span style={S.moodLbl}>WHAT WE'RE HEARING</span>
              <p style={S.moodText}>{criteria.mood_reading}</p>
            </div>
            <div style={S.tagRow}>
              {criteria.destination && <Tag>📍 {criteria.destination}</Tag>}
              {criteria.max_price_per_night_usd && <Tag>≤ ${criteria.max_price_per_night_usd}/night</Tag>}
              {(criteria.vibe || []).slice(0, 3).map((v, i) => (
                <Tag key={i}>{v}</Tag>
              ))}
            </div>
          </div>
        )}

        {error && <div style={S.error}>{error}</div>}

        {results.length > 0 && (
          <div style={S.resultsHead}>
            {results.length} stays, ranked by how well they fit you
          </div>
        )}

        <div style={S.list}>
          {results.map((h, i) => (
            <article key={i} style={S.card} className="card">
              <div style={S.thumb}>
                <span style={S.thumbInitial}>{(h.name || "?")[0]}</span>
              </div>

              <div style={S.cardMid}>
                <h3 style={S.cardName}>{h.name}</h3>
                <div style={S.cardHood}>📍 {h.neighborhood}</div>
                <p style={S.cardWhy}>{h.why_it_fits}</p>

                {h.guest_signals && h.guest_signals.length > 0 && (
                  <div style={S.signals}>
                    <div style={S.sectionLbl}>WHAT GUESTS ACTUALLY SAY</div>
                    <div style={S.signalWrap}>
                      {h.guest_signals.map((g, gi) => (
                        <span key={gi} style={S.signalPill}>{g}</span>
                      ))}
                    </div>
                  </div>
                )}

                {h.honest_take && (
                  <div style={S.honest}>
                    <span style={S.honestLbl}>⚑ The honest take</span> {h.honest_take}
                  </div>
                )}
              </div>

              <div style={S.cardRight}>
                <div style={S.ratingRow}>
                  <div style={S.ratingText}>
                    <div style={S.ratingLabel}>{ratingLabel(h.rating || 8)}</div>
                    <div style={S.matchSub}>{h.match_score}% match</div>
                  </div>
                  <div style={S.ratingBox}>{(h.rating || 8).toFixed ? (h.rating).toFixed(1) : h.rating}</div>
                </div>

                <div style={S.priceBlock}>
                  {h.headline_rate && <div style={S.headline}>${String(h.headline_rate).replace(/\$/g, "")}</div>}
                  <div style={S.allIn}>${String(h.all_in_estimate).replace(/\$/g, "")}</div>
                  <div style={S.allInLbl}>est. all-in / night</div>
                </div>

                {h.booking_url && (
                  <a
                    href={h.booking_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={S.viewBtn}
                    className="viewBtn"
                  >
                    View deal →
                  </a>
                )}
                {h.booking_site && <div style={S.bookingSite}>on {h.booking_site}</div>}
              </div>
            </article>
          ))}
        </div>

        {status === "done" && (
          <p style={S.disclaimer}>
            Stays, ratings, and guest signals surfaced from live web results — estimates, not
            guarantees. Always verify pricing and availability on the booking site.
          </p>
        )}
      </div>
    </div>
  );
}

function Tag({ children }) {
  return <span style={S.tag}>{children}</span>;
}

const C = {
  bg: "#f5f7fa",
  card: "#ffffff",
  ink: "#1a2b3c",
  sub: "#5c6f80",
  muted: "#8a9bab",
  blue: "#0066ff",
  blueDark: "#0052cc",
  navy: "#003580",
  green: "#1a8754",
  amber: "#b8860b",
  rose: "#c4503a",
  line: "#e3e9ef",
};

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
* { box-sizing: border-box; }
.card { transition: box-shadow .2s ease, transform .2s ease; }
.card:hover { box-shadow: 0 8px 28px rgba(0,53,128,.12); transform: translateY(-2px); }
.spinner { animation: spin .8s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }
input:focus { outline: none; }
.viewBtn { transition: background .15s ease; }
.viewBtn:hover { background: ${C.blueDark} !important; }
.chip:hover { background: #eef3fb !important; border-color: ${C.blue} !important; color: ${C.navy} !important; }
button { cursor: pointer; font-family: inherit; }
.card { animation: rise .4s ease backwards; }
.card:nth-child(2){animation-delay:.05s}.card:nth-child(3){animation-delay:.1s}
.card:nth-child(4){animation-delay:.15s}.card:nth-child(5){animation-delay:.2s}.card:nth-child(6){animation-delay:.25s}
@keyframes rise { from { opacity:0; transform:translateY(12px);} to { opacity:1; transform:translateY(0);} }
`;

const S = {
  root: {
    minHeight: "100vh",
    background: C.bg,
    color: C.ink,
    fontFamily: "'Inter', system-ui, sans-serif",
  },
  nav: {
    display: "flex", justifyContent: "space-between", alignItems: "center",
    padding: "16px 28px", background: C.navy, color: "#fff",
  },
  logo: { fontSize: 21, fontWeight: 800, letterSpacing: -0.5, display: "flex", alignItems: "center", gap: 8 },
  logoMark: { color: "#7fb0ff", fontSize: 18 },
  navLinks: { display: "flex", gap: 22 },
  navLink: { fontSize: 14, opacity: 0.9, cursor: "pointer" },

  hero: {
    background: `linear-gradient(160deg, ${C.navy} 0%, #0066ff 100%)`,
    color: "#fff", padding: "56px 28px 72px", textAlign: "center",
  },
  h1: { fontSize: 38, fontWeight: 800, letterSpacing: -1, margin: "0 auto", maxWidth: 720, lineHeight: 1.12 },
  sub: { fontSize: 16, opacity: 0.92, maxWidth: 560, margin: "16px auto 0", lineHeight: 1.55 },

  searchBar: {
    display: "flex", alignItems: "center", background: "#fff", borderRadius: 10,
    maxWidth: 760, margin: "32px auto 0", padding: 6, boxShadow: "0 12px 40px rgba(0,0,0,.18)",
  },
  searchIcon: { fontSize: 22, color: C.muted, padding: "0 6px 0 14px" },
  input: {
    flex: 1, border: "none", fontSize: 15.5, padding: "14px 10px", color: C.ink,
    fontFamily: "inherit", background: "transparent",
  },
  searchBtn: {
    background: C.blue, color: "#fff", border: "none", borderRadius: 7,
    padding: "14px 30px", fontSize: 15, fontWeight: 700,
  },

  examples: { display: "flex", flexWrap: "wrap", gap: 9, justifyContent: "center", maxWidth: 720, margin: "20px auto 0" },
  chip: {
    background: "rgba(255,255,255,.12)", border: "1px solid rgba(255,255,255,.25)", color: "#fff",
    borderRadius: 20, padding: "8px 15px", fontSize: 13, transition: "all .2s ease",
  },

  body: { maxWidth: 940, margin: "0 auto", padding: "0 24px 80px" },

  loading: {
    display: "flex", alignItems: "center", justifyContent: "center", gap: 12,
    color: C.navy, marginTop: 40, fontSize: 15, fontWeight: 500,
  },
  spinner: {
    width: 20, height: 20, borderRadius: "50%",
    border: `2.5px solid ${C.line}`, borderTopColor: C.blue,
  },

  moodBar: {
    marginTop: 28, background: "#fff", border: `1px solid ${C.line}`, borderRadius: 12,
    padding: "18px 22px", boxShadow: "0 2px 12px rgba(0,53,128,.05)",
  },
  moodLeft: {},
  moodLbl: { color: C.blue, letterSpacing: 1.5, fontSize: 11, fontWeight: 700 },
  moodText: { fontSize: 18, margin: "7px 0 14px", lineHeight: 1.45, fontWeight: 500, color: C.ink },
  tagRow: { display: "flex", flexWrap: "wrap", gap: 8 },
  tag: {
    background: "#eef3fb", border: `1px solid ${C.line}`, color: C.navy,
    borderRadius: 20, padding: "5px 13px", fontSize: 13, fontWeight: 500,
  },

  error: { color: C.rose, marginTop: 24, fontSize: 14, textAlign: "center" },

  resultsHead: { marginTop: 30, marginBottom: 6, fontSize: 15, fontWeight: 700, color: C.ink },

  list: { display: "flex", flexDirection: "column", gap: 16, marginTop: 14 },
  card: {
    background: C.card, border: `1px solid ${C.line}`, borderRadius: 12,
    padding: 0, display: "flex", overflow: "hidden", minHeight: 200,
  },
  thumb: {
    width: 150, flexShrink: 0,
    background: `linear-gradient(150deg, #dce6f5, #b9cef0)`,
    display: "flex", alignItems: "center", justifyContent: "center",
  },
  thumbInitial: { fontSize: 48, fontWeight: 800, color: "#fff", opacity: 0.85 },

  cardMid: { flex: 1, padding: "18px 20px", display: "flex", flexDirection: "column" },
  cardName: { fontSize: 19, fontWeight: 700, margin: 0, color: C.navy },
  cardHood: { color: C.sub, fontSize: 13, marginTop: 3 },
  cardWhy: { color: C.ink, fontSize: 13.5, lineHeight: 1.55, marginTop: 10, marginBottom: 0 },

  signals: { marginTop: 14 },
  sectionLbl: { color: C.green, letterSpacing: 1, fontSize: 10.5, fontWeight: 700, marginBottom: 7 },
  signalWrap: { display: "flex", flexWrap: "wrap", gap: 7 },
  signalPill: {
    background: "#f0f9f4", border: "1px solid #cde9d9", color: "#176c44",
    borderRadius: 6, padding: "5px 10px", fontSize: 12, lineHeight: 1.3,
  },

  honest: {
    marginTop: 12, background: "#fdf3f0", border: "1px solid #f3d6cd",
    borderRadius: 7, padding: "9px 12px", fontSize: 12.5, color: "#7a3826", lineHeight: 1.5,
  },
  honestLbl: { color: C.rose, fontWeight: 700, marginRight: 4 },

  cardRight: {
    width: 178, flexShrink: 0, borderLeft: `1px solid ${C.line}`,
    padding: "18px 18px", display: "flex", flexDirection: "column", alignItems: "flex-end",
  },
  ratingRow: { display: "flex", alignItems: "center", gap: 9, alignSelf: "stretch", justifyContent: "flex-end" },
  ratingText: { textAlign: "right" },
  ratingLabel: { fontSize: 13, fontWeight: 700, color: C.navy },
  matchSub: { fontSize: 11, color: C.muted },
  ratingBox: {
    background: C.navy, color: "#fff", borderRadius: "7px 7px 7px 0",
    padding: "7px 9px", fontSize: 15, fontWeight: 700, minWidth: 38, textAlign: "center",
  },

  priceBlock: { marginTop: "auto", textAlign: "right", paddingTop: 14 },
  headline: { fontSize: 13, color: C.muted, textDecoration: "line-through" },
  allIn: { fontSize: 24, fontWeight: 800, color: C.ink, lineHeight: 1.1 },
  allInLbl: { fontSize: 10.5, color: C.muted, marginTop: 1 },

  viewBtn: {
    marginTop: 12, display: "block", width: "100%", textAlign: "center", textDecoration: "none",
    background: C.blue, color: "#fff", border: "none", borderRadius: 7,
    padding: "11px 0", fontSize: 14, fontWeight: 700,
  },
  bookingSite: { fontSize: 10.5, color: C.muted, marginTop: 5, textAlign: "center", alignSelf: "stretch" },

  disclaimer: { color: C.muted, fontSize: 11.5, marginTop: 30, textAlign: "center", lineHeight: 1.5, maxWidth: 600, marginLeft: "auto", marginRight: "auto" },
};

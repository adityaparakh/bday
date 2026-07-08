// ─────────────────────────────────────────────────────────────
//  EDIT THIS FILE to configure your invite. No other files needed.
// ─────────────────────────────────────────────────────────────

window.INVITE_CONFIG = {
  // ── The basics (shown on the public first page) ──────────────
  hostName: "Aditya",        // used in the hero: "Aditya's 30th"
  nickname: "Adi",           // used in the reveal: "Adi's 30th"
  milestone: "30th",         // the birthday number ("30th", "25th"…)
  occasion: "Escape",        // the teaser word under the wordmark
  dates: "Oct 9–11, 2026",
  tagline: "Yachts, sunsets, and a whole lot of dancing.",

  // Shown on the first page instead of the location — keeps the
  // destination off the landing page (revealed after they RSVP).
  locationTeaser: "☀️ Somewhere warm — RSVP for the details",

  // ── The reveal (shown AFTER a guest unlocks with their email) ─
  location: "Cabo San Lucas, México",   // full destination
  locationShort: "Cabo",                // the big word in the reveal animation

  // Where everyone's staying — the generous bit 🎉
  hotel: {
    name: "the [Your Resort Name]",     // ← put the real hotel here
    // The reassuring line. Edit freely.
    note: "Your room is already booked — and paid for. Just get yourself there and we'll handle the rest.",
  },

  // The weekend, told as chapters (your "journey"). Add/remove freely.
  itinerary: [
    { day: "Fri · Oct 9",  title: "The Arrival",   detail: "Fly in, settle into the resort, and a welcome dinner + drinks as the crew rolls in." },
    { day: "Sat · Oct 10", title: "Out to Sea",    detail: "The main event — a private yacht day on the water, sunset cocktails, then dancing well into the night." },
    { day: "Sun · Oct 11", title: "The Send-off",  detail: "A slow brunch and pool time, then flights home whenever you're ready." },
  ],

  // Getting there — flows into the flight-details form.
  travel: {
    airport: "Los Cabos International (SJD)",
    note: "Fly into SJD — it's about 40 minutes from the resort. Drop your flight times below and we'll sort out airport pickups.",
  },

  // ── Backend ──────────────────────────────────────────────────
  // Google Apps Script Web App URL (see README.md → step 3).
  appsScriptUrl: "https://script.google.com/macros/s/AKfycbxzyUG7XGcRktCgNsMaj66CuH2lltyMBuGyC_TVd5YXFtuc5WjcWksAJH4J839Fds946w/exec",

  // The vibe checklist shown under the hero (public — no location).
  highlights: [
    { icon: "🛥️", label: "A day out on the water" },
    { icon: "🌅", label: "Sunset cocktails" },
    { icon: "🪩", label: "Dancing till late" },
    { icon: "🌮", label: "Tacos & tequila" },
  ],
};

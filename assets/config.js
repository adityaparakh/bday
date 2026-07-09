// ─────────────────────────────────────────────────────────────
//  EDIT THIS FILE to configure your invite. No other files needed.
// ─────────────────────────────────────────────────────────────

window.INVITE_CONFIG = {
  // ── The basics (shown on the public first page) ──────────────
  hostName: "Aditya",        // used in the hero: "Aditya's 30th"
  nickname: "Adi",           // used in the reveal: "Adi's 30th"
  milestone: "30th",         // the birthday number ("30th", "25th"…)
  occasion: "Escape",        // the teaser word under the wordmark
  dates: "Oct 9-11, 2026",
  tagline: "Yachts, sunsets, and a whole lot of dancing.",

  // Shown on the first page instead of the location, so the spot stays
  // off the landing page (it gets revealed once they RSVP).
  locationTeaser: "☀️ Somewhere warm. RSVP for the details",

  // ── The reveal (shown AFTER a guest unlocks with their email) ─
  location: "Cabo San Lucas, México",   // full destination
  locationShort: "Cabo",                // the big word in the reveal animation

  // Where everyone's staying (the fun part) 🎉
  hotel: {
    name: "The Westin Los Cabos Resort Villas, Baja Point",
    note: "Your room's already booked and paid for. Just get yourself there and we've got the rest.",
    blurb: "Home base is a cliffside villa resort right on the Sea of Cortez, with infinity pools, a private beach, a full spa, and six restaurants.",
    amenities: ["🏖️ Private beach", "🏊 Infinity pools", "💆 Spa Otomí", "🍽️ 6 restaurants"],
    address: "Carretera Transpeninsular KM 22.5, San José del Cabo, B.C.S. 23400, México",
    phone: "+52 624 142 9000",
    phoneHref: "+526241429000",
    mapsUrl: "https://www.google.com/maps/search/?api=1&query=The%20Westin%20Los%20Cabos%20Resort%20Villas%20Baja%20Point",
    mapEmbed: "https://www.google.com/maps?q=The%20Westin%20Los%20Cabos%20Resort%20Villas%20Baja%20Point&z=13&output=embed",
    website: "https://www.marriott.com/en-us/hotels/sjdwb-the-westin-los-cabos-resort-villas-baja-point/overview/",
    photos: [
      { src: "assets/img/hotel-hero.jpg", alt: "The Westin Los Cabos on the cliffs above the beach" },
      { src: "assets/img/hotel-pool.jpg", alt: "Infinity pool at sunset over the Sea of Cortez" },
      { src: "assets/img/hotel-exterior.jpg", alt: "Resort villas exterior" },
    ],
  },

  // The weekend, told day by day.
  // Each day has timed `items`; `tag` shows a little pill (optional / formal / TBD).
  itinerary: [
    {
      day: "Fri · Oct 9", title: "Arrive & set sail",
      items: [
        { time: "By noon", text: "Get there and settle in" },
        { time: "Lunch",   text: "Grab a bite", tag: "optional" },
        { time: "4:00 pm", text: "Yacht + swimming in the ocean 🛥️" },
        { time: "Evening", text: "Dinner on the yacht" },
      ],
    },
    {
      day: "Sat · Oct 10", title: "Adventures & the big night",
      items: [
        { time: "9-11 am",   text: "Breakfast", tag: "optional" },
        { time: "Midday",    text: "Off to adventures", tag: "TBD" },
        { time: "7:00 pm",   text: "Dinner", tag: "formal" },
        { time: "10:00 pm+", text: "Night out 🪩" },
      ],
    },
    {
      day: "Sun · Oct 11", title: "The Send-off",
      items: [
        { time: "Morning", text: "Breakfast", tag: "optional" },
        { time: "Anytime", text: "Fly home ✈️" },
      ],
    },
  ],

  // Getting there. Flows into the flight-details form.
  travel: {
    airport: "Los Cabos International (SJD)",
    note: "Fly into SJD, about 40 minutes from the resort. Drop your flight times below and we'll sort out airport pickups.",
  },

  // ── Backend ──────────────────────────────────────────────────
  // Google Apps Script Web App URL (see README.md, step 3).
  appsScriptUrl: "https://script.google.com/macros/s/AKfycbxzyUG7XGcRktCgNsMaj66CuH2lltyMBuGyC_TVd5YXFtuc5WjcWksAJH4J839Fds946w/exec",
};

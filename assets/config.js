// ─────────────────────────────────────────────────────────────
//  EDIT THIS FILE to configure your invite. No other files needed.
// ─────────────────────────────────────────────────────────────

window.INVITE_CONFIG = {
  // Whose birthday, shown in the hero. e.g. "Aditya's 30th"
  hostName: "Aditya",
  // Public teaser word in the hero headline — keep the destination secret.
  occasion: "Escape",

  // Trip dates — shown publicly on the invite.
  dates: "Oct 9–11, 2026",       // e.g. "Nov 14–17, 2026"

  // SURPRISE! The real destination is hidden until a guest unlocks the
  // invite with their email. `locationTeaser` shows publicly; `location`
  // is only revealed on the RSVP screen after they're through the gate.
  location: "Cabo San Lucas, México",       // revealed after email unlock
  locationTeaser: "🤫 Destination is a surprise",  // shown publicly

  tagline: "Yachts, sunsets, and a whole lot of dancing.",

  // Paste your Google Apps Script Web App URL here after you deploy it
  // (see README.md → step 3). Until then the form runs in DEMO mode
  // and won't save anything.
  appsScriptUrl: "",

  // The vibe checklist shown under the hero.
  highlights: [
    { icon: "🛥️", label: "A day out on the water" },
    { icon: "🌅", label: "Sunset cocktails" },
    { icon: "🪩", label: "Dancing till late" },
    { icon: "🌮", label: "Tacos & tequila" },
  ],
};

/**
 * Cabo Birthday Invite — backend
 * ────────────────────────────────────────────────────────────
 * A Google Apps Script Web App that:
 *   1) checks a guest's email against a private allowlist, and
 *   2) pulls up their whole PARTY (everyone sharing their group key),
 *      then saves each person's RSVP + flight details back to the Sheet.
 *
 * One sheet ("Guestlist") is the single source of truth: it's both the
 * allowlist AND the RSVP data. It never lives in the website, so nobody
 * can read the guest list by viewing the page source.
 *
 * SHEET LAYOUT (one row per person):
 *   A Party | B Email | C Name | D Room | E Confirmed |
 *   F Arrival Flight | G Arrival Time | H Departure Flight |
 *   I Departure Time | J Notes | K Updated
 *
 *   • Party  — the group key. Everyone who should show up together shares
 *              the same value (e.g. "mete" for Mete + Elif).
 *   • Email  — put it on the party's lead (whoever logs in to RSVP). You
 *              can add emails to more rows too; matching ANY row returns
 *              the whole party.
 *
 * SETUP: open Extensions ▸ Apps Script, paste this file, run `setup` once,
 *   then Deploy ▸ New deployment ▸ Web app ▸ Execute as: Me ▸
 *   Who has access: Anyone. Copy the /exec URL into assets/config.js.
 */

var GUEST_SHEET = "Guestlist";

var MAX_GUESTS = 12;       // most a single submit may write (anti-flood)
var MAX_PARTY_ROWS = 20;   // hard ceiling on how big one party can grow
var MAX_LEN = 200;         // per-field character cap on guest-supplied text

var HEADERS = [
  "Party", "Email", "Name", "Room", "Confirmed",
  "Arrival Flight", "Arrival Time", "Departure Flight", "Departure Time",
  "Notes", "Updated",
];

// 0-based column positions into a row array (must match HEADERS order).
var C = {
  party: 0, email: 1, name: 2, room: 3, confirmed: 4,
  arrivalFlight: 5, arrivalTime: 6, departureFlight: 7, departureTime: 8,
  notes: 9, updated: 10,
};

/**
 * Run this ONCE from the Apps Script editor to create the Guestlist tab,
 * seed the headers, and drop in a sample party. Safe to re-run; it won't
 * touch a sheet that already exists.
 */
function setup() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(GUEST_SHEET);
  if (sheet) return; // already set up — leave existing data alone

  sheet = ss.insertSheet(GUEST_SHEET);
  sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);
  sheet.getRange(1, 1, 1, HEADERS.length).setFontWeight("bold");
  sheet.setFrozenRows(1);

  // Sample party so the shape is obvious: one email pulls up two names.
  var sample = [
    ["adi", "friend@example.com", "Adi", "1", "", "", "", "", "", "", ""],
    ["adi", "", "Andrea", "1", "", "", "", "", "", "", ""],
  ];
  sheet.getRange(2, 1, sample.length, HEADERS.length).setValues(sample);
}

function doGet() {
  return json({ ok: true, service: "cabo-invite", status: "alive" });
}

function doPost(e) {
  try {
    var body = JSON.parse((e && e.postData && e.postData.contents) || "{}");
    var action = body.action;

    if (action === "check") return json(handleCheck(body));
    if (action === "rsvp") return json(handleRsvp(body));

    return json({ ok: false, error: "Unknown action." });
  } catch (err) {
    return json({ ok: false, error: "Something went wrong. " + err });
  }
}

/**
 * Look up an email, then return the guest's WHOLE party — every person
 * sharing their Party key — so the form can prefill an editable list.
 */
function handleCheck(body) {
  var email = normalizeEmail(body.email);
  if (!email) return { ok: false, error: "Please enter your email." };

  var sheet = getSheet();
  if (!sheet) return { ok: false, error: "Guest list isn't set up yet." };
  var values = sheet.getDataRange().getValues();

  var found = findParty(values, email);
  if (!found) return { ok: true, allowed: false };

  // SECURITY: `check` is reachable by anyone who knows an allowlisted email
  // (there's no ownership proof), so we return only the minimum the form
  // needs to prefill — names + who's in. We deliberately do NOT echo back
  // flight itineraries here; that's sensitive (reveals when someone travels).
  var guests = [];
  var partyNotes = "";
  for (var i = 1; i < values.length; i++) {
    if (!rowInParty(values, i, found)) continue;
    var r = values[i];
    guests.push({
      row: i + 1,
      name: String(r[C.name] || ""),
      room: String(r[C.room] || ""),
      attending: String(r[C.confirmed] || ""),
    });
    if (!partyNotes && r[C.notes]) partyNotes = String(r[C.notes]);
  }

  return {
    ok: true,
    allowed: true,
    party: found.party,
    greetName: String(values[found.rowIdx][C.name] || ""),
    guests: guests,
    notes: partyNotes,
    alreadyRsvped: guests.some(function (g) { return g.attending; }),
  };
}

/**
 * Save the party's RSVP. Each incoming guest updates its own row (matched
 * by row number, but only if that row still belongs to this party — so a
 * client can't overwrite someone else's data). Guests added in the form
 * (no valid row) get appended. Re-submitting overwrites in place.
 */
function handleRsvp(body) {
  var email = normalizeEmail(body.email);
  if (!email) return { ok: false, error: "Missing email." };

  var lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    var sheet = getSheet();
    if (!sheet) return { ok: false, error: "Guest list isn't set up yet." };
    var values = sheet.getDataRange().getValues();

    var found = findParty(values, email);
    if (!found) return { ok: true, allowed: false };

    var incoming = Array.isArray(body.guests) ? body.guests : [];
    if (incoming.length > MAX_GUESTS) {
      return { ok: false, error: "That's a lot of names — please keep it to " + MAX_GUESTS + " per party." };
    }

    // Count how many rows this party already occupies, so appends can't
    // balloon the sheet past a sane ceiling (anti-flood).
    var partyRows = 0;
    for (var p = 1; p < values.length; p++) {
      if (rowInParty(values, p, found)) partyRows++;
    }

    var partyNotes = String(body.notes || "");
    var now = new Date();
    var notesPlaced = false;

    for (var k = 0; k < incoming.length; k++) {
      var g = incoming[k] || {};
      if (!String(g.name || "").trim()) continue; // skip blank rows

      var r = parseInt(g.row, 10);
      var writable = r >= 2 && r <= values.length && rowInParty(values, r - 1, found);
      if (!writable && partyRows >= MAX_PARTY_ROWS) continue; // party is full

      var rowVals = writable ? values[r - 1].slice() : blankRow();
      if (!writable) {
        rowVals[C.party] = found.party;   // new +1 joins this party
        rowVals[C.email] = "";
      }
      // sanitize every guest-supplied string (formula injection + length)
      rowVals[C.name] = safeCell(g.name);
      rowVals[C.confirmed] = g.attending === "Yes" ? "Yes" : (g.attending === "No" ? "No" : "");
      rowVals[C.arrivalFlight] = safeCell(g.arrivalFlight);
      rowVals[C.arrivalTime] = safeCell(g.arrivalTime);
      rowVals[C.departureFlight] = safeCell(g.departureFlight);
      rowVals[C.departureTime] = safeCell(g.departureTime);
      rowVals[C.notes] = notesPlaced ? String(rowVals[C.notes] || "") : safeCell(partyNotes);
      rowVals[C.updated] = now;
      notesPlaced = true; // party notes land on the first guest only

      if (writable) {
        sheet.getRange(r, 1, 1, HEADERS.length).setValues([rowVals]);
        values[r - 1] = rowVals; // keep our local copy in sync
      } else {
        sheet.appendRow(rowVals);
        values.push(rowVals);
        partyRows++;
      }
    }
    return { ok: true, allowed: true, saved: true };
  } finally {
    lock.releaseLock();
  }
}

// ── helpers ──────────────────────────────────────────────────

function getSheet() {
  return SpreadsheetApp.getActiveSpreadsheet().getSheetByName(GUEST_SHEET);
}

function normalizeEmail(v) {
  return String(v || "").trim().toLowerCase();
}

/**
 * Find the first row whose email matches, and return its party key + row.
 * Returns null if the email isn't on the list.
 */
function findParty(values, email) {
  for (var i = 1; i < values.length; i++) {
    if (normalizeEmail(values[i][C.email]) === email) {
      return { party: String(values[i][C.party] || "").trim(), rowIdx: i };
    }
  }
  return null;
}

/** Does row `i` belong to the matched party? */
function rowInParty(values, i, found) {
  if (i === found.rowIdx) return true; // the matched row always counts
  if (!found.party) return false;      // blank party key never groups
  return String(values[i][C.party] || "").trim().toLowerCase() ===
         found.party.toLowerCase();
}

function blankRow() {
  var row = [];
  for (var i = 0; i < HEADERS.length; i++) row.push("");
  return row;
}

/**
 * Make a guest-supplied string safe to drop into a cell:
 *   • caps its length, and
 *   • neutralizes spreadsheet formula injection — a value that starts with
 *     = + - @ (or a control char) is prefixed with ' so Sheets keeps it as
 *     text instead of executing it (=IMPORTRANGE, =HYPERLINK, …).
 */
function safeCell(v) {
  var s = String(v == null ? "" : v);
  if (s.length > MAX_LEN) s = s.slice(0, MAX_LEN);
  if (/^[=+\-@\t\r\n]/.test(s)) s = "'" + s;
  return s;
}

function json(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

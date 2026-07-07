/**
 * Cabo Birthday Invite — backend
 * ────────────────────────────────────────────────────────────
 * A Google Apps Script Web App that:
 *   1) checks a guest's email against a private allowlist, and
 *   2) saves RSVP + flight details into your Google Sheet.
 *
 * The allowlist lives HERE (in the Sheet), never in the website,
 * so nobody can read the guest list by viewing the page source.
 *
 * SETUP: see README.md. In short —
 *   - Create a Google Sheet, open Extensions ▸ Apps Script
 *   - Paste this file, run `setup` once, then Deploy ▸ New deployment
 *     ▸ Web app ▸ Execute as: Me ▸ Who has access: Anyone
 *   - Copy the /exec URL into assets/config.js
 */

var ALLOWLIST_SHEET = "Allowlist";
var RSVP_SHEET = "RSVPs";

var RSVP_HEADERS = [
  "Timestamp", "Email", "Name", "Attending", "Party size",
  "Arrival airline", "Arrival flight", "Arrival date", "Arrival time",
  "Departure airline", "Departure flight", "Departure date", "Departure time",
  "Notes",
];

/**
 * Run this ONCE from the Apps Script editor to create the two tabs
 * and seed the allowlist headers. Safe to re-run; it won't wipe data.
 */
function setup() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();

  var allow = ss.getSheetByName(ALLOWLIST_SHEET);
  if (!allow) {
    allow = ss.insertSheet(ALLOWLIST_SHEET);
    allow.getRange(1, 1, 1, 2).setValues([["Email", "Name (optional)"]]);
    allow.getRange("A2").setValue("friend@example.com");
    allow.setFrozenRows(1);
  }

  var rsvp = ss.getSheetByName(RSVP_SHEET);
  if (!rsvp) {
    rsvp = ss.insertSheet(RSVP_SHEET);
    rsvp.getRange(1, 1, 1, RSVP_HEADERS.length).setValues([RSVP_HEADERS]);
    rsvp.setFrozenRows(1);
    rsvp.getRange(1, 1, 1, RSVP_HEADERS.length).setFontWeight("bold");
  }
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

/** Look up an email in the allowlist. Returns whether they're invited. */
function handleCheck(body) {
  var email = normalizeEmail(body.email);
  if (!email) return { ok: false, error: "Please enter your email." };

  var match = findInAllowlist(email);
  if (!match) return { ok: true, allowed: false };

  return { ok: true, allowed: true, name: match.name, alreadyRsvped: !!match.rsvpRow };
}

/** Save (or update) a guest's RSVP. Re-submitting overwrites their row. */
function handleRsvp(body) {
  var email = normalizeEmail(body.email);
  if (!email) return { ok: false, error: "Missing email." };

  var match = findInAllowlist(email);
  if (!match) return { ok: true, allowed: false };

  var lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(RSVP_SHEET);
    var d = body.data || {};
    var row = [
      new Date(),
      email,
      d.name || match.name || "",
      d.attending || "",
      d.partySize || "",
      d.arrivalAirline || "", d.arrivalFlight || "", d.arrivalDate || "", d.arrivalTime || "",
      d.departureAirline || "", d.departureFlight || "", d.departureDate || "", d.departureTime || "",
      d.notes || "",
    ];

    var existing = findRsvpRow(sheet, email);
    if (existing) {
      sheet.getRange(existing, 1, 1, row.length).setValues([row]);
    } else {
      sheet.appendRow(row);
    }
    return { ok: true, allowed: true, saved: true };
  } finally {
    lock.releaseLock();
  }
}

// ── helpers ──────────────────────────────────────────────────

function normalizeEmail(v) {
  return String(v || "").trim().toLowerCase();
}

function findInAllowlist(email) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(ALLOWLIST_SHEET);
  if (!sheet) return null;
  var values = sheet.getDataRange().getValues();
  for (var i = 1; i < values.length; i++) {
    if (normalizeEmail(values[i][0]) === email) {
      return { name: String(values[i][1] || "").trim() };
    }
  }
  return null;
}

function findRsvpRow(sheet, email) {
  var values = sheet.getDataRange().getValues();
  for (var i = 1; i < values.length; i++) {
    if (normalizeEmail(values[i][1]) === email) return i + 1; // 1-indexed row
  }
  return null;
}

function json(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

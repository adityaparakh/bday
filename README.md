# 🌅 Cabo Birthday Invite

A private, email-gated birthday invitation. Guests unlock the invite with
their email, RSVP, and drop their flight details — everything lands in a
Google Sheet. Hosted free on **GitHub Pages**, backend runs on **Google
Apps Script** (no servers, no cost).

```
index.html ─ fetch() ─▶ Google Apps Script Web App ─▶ Google Sheet
 (GitHub Pages)      (email → party lookup + save)     (one "Guestlist" tab)
```

**Why this design:** GitHub Pages is public and static, so the guest list
can never live in the website — anyone could "View Source." The guest list
lives in the Sheet and is checked by the Apps Script backend. The page only
ever sends the typed email and gets back that guest's **party** (everyone
sharing their group key), which it prefills as an editable list.

---

## What to edit

Everything you'll touch is in **`assets/config.js`**:
name, dates, location, the vibe list, and the backend URL.

---

## Setup — three steps

### 1. Create the Google Sheet + backend

1. Go to <https://sheets.new> and name the sheet (e.g. "Cabo RSVPs").
2. **Extensions ▸ Apps Script**. Delete the sample code.
3. Copy **all** of `apps-script/Code.gs` from this repo and paste it in. Save.
4. In the toolbar, pick the **`setup`** function and click **Run**.
   Approve the permission prompt (it's your own script). This creates one
   **Guestlist** tab, seeded with headers and a sample party.

### 2. Add your guest list

Fill the **Guestlist** tab — **one row per person**:

| Col | Header | What goes in it |
|-----|--------|-----------------|
| A | **Party** | Group key. Everyone who should appear together shares the same value (e.g. `mete` for Mete + Elif). |
| B | **Email** | Put it on the party's **lead** (whoever logs in). Add emails to more rows too — matching any row returns the whole party. |
| C | **Name** | The guest's name (guests can edit this when they RSVP). |
| D | **Room** | For your own planning; doesn't affect grouping. |
| E–J | Confirmed, Arrival/Departure Flight + Time, Notes | Left blank — the RSVP form writes these back. |
| K | **Updated** | Auto-stamped when a guest submits. |

**How the lookup works:** a guest enters their email → the backend finds their
row → reads its **Party** → returns every name with that Party as an editable
list. So `mete@…` pulls up *Mete + Elif*; a solo traveler pulls up just
themselves (and can add a +1, which appends a row to their party).

Emails are matched case-insensitively and trimmed. Add/remove guests here
anytime — no redeploy needed. A guest can only ever write to rows in **their
own** party, so no one can overwrite someone else's details.

### 3. Deploy the backend + wire it up

1. In Apps Script: **Deploy ▸ New deployment**.
2. Gear icon ▸ **Web app**.
   - **Execute as:** Me
   - **Who has access:** **Anyone**  ← required so guests' browsers can call it
3. **Deploy**, approve, and copy the **Web app URL** (ends in `/exec`).
4. Paste it into `assets/config.js`:
   ```js
   appsScriptUrl: "https://script.google.com/macros/s/AKfy.../exec",
   ```

> Re-deploying later: use **Deploy ▸ Manage deployments ▸ (edit) ▸ New version**
> so the `/exec` URL stays the same. Editing the Guestlist tab does **not**
> need a redeploy.

---

## Publish on GitHub Pages

1. Create a repo and push these files (or drag-and-drop upload).
2. Repo **Settings ▸ Pages**.
3. **Source:** Deploy from a branch → **main** / **/ (root)** → Save.
4. Wait ~1 min; your invite is live at
   `https://<you>.github.io/<repo>/`.

Share that link with your friends. 🎉

---

## Demo mode

If `appsScriptUrl` is empty, the site runs in **demo mode**: any valid-looking
email unlocks the invite and nothing is saved. Great for previewing the design
before you set up the Sheet. Fill in the URL to go live.

## Test locally

Open `index.html` directly, or serve it:
```bash
python3 -m http.server 8000   # then visit http://localhost:8000
```

---

## The RSVP sheet columns

`Timestamp · Email · Name · Attending · Party size · Arrival airline/flight/date/time · Departure airline/flight/date/time · Notes`

Re-submitting from the same email **updates** that guest's row instead of
adding a duplicate.

---

## Files

| File | What it is |
|------|-----------|
| `index.html` | The invite page |
| `assets/styles.css` | Sunset theme & layout |
| `assets/app.js` | Gate, form, confetti logic |
| `assets/config.js` | **Your settings** — edit this |
| `apps-script/Code.gs` | Backend (paste into Apps Script) |

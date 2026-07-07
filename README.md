# 🌅 Cabo Birthday Invite

A private, email-gated birthday invitation. Guests unlock the invite with
their email, RSVP, and drop their flight details — everything lands in a
Google Sheet. Hosted free on **GitHub Pages**, backend runs on **Google
Apps Script** (no servers, no cost).

```
index.html ─ fetch() ─▶ Google Apps Script Web App ─▶ Google Sheet
 (GitHub Pages)          (allowlist check + save)      (Allowlist + RSVPs)
```

**Why this design:** GitHub Pages is public and static, so the guest list
can never live in the website — anyone could "View Source." The allowlist
lives in the Sheet and is checked by the Apps Script backend. The page only
ever sends the typed email and gets back "you're in" or "you're not."

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
   Approve the permission prompt (it's your own script). This creates two
   tabs: **Allowlist** and **RSVPs**.

### 2. Add your guest list

In the **Allowlist** tab:
- Column **A** — one invited email per row.
- Column **B** — their name (optional; used to greet them).

Emails are matched case-insensitively and trimmed. Add/remove guests here
anytime — no redeploy needed.

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
> so the `/exec` URL stays the same. Editing the Allowlist tab does **not**
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

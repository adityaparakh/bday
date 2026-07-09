/* ─────────────────────────────────────────────────────────────
   Birthday Escape Invite: front-end logic
   - a stepped "deck": one slide at a time, Next/Back to move through
   - injects config into the page
   - email gate → backend allowlist check
   - RSVP + flight details → backend save
   - confetti celebrations
   ───────────────────────────────────────────────────────────── */

(function () {
  "use strict";

  var cfg = window.INVITE_CONFIG || {};
  var DEMO = !cfg.appsScriptUrl;

  // ── Local persistence (remember email + save RSVP draft) ──
  // All wrapped in try/catch so private mode / disabled storage never breaks.
  var STORE = {
    read: function (k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    write: function (k, v) { try { localStorage.setItem(k, v); } catch (e) {} },
    remove: function (k) { try { localStorage.removeItem(k); } catch (e) {} },
  };
  var EMAIL_KEY = "bday.email";
  function draftKey(email) { return "bday.draft." + (email || ""); }
  function savedEmail() { return STORE.read(EMAIL_KEY) || ""; }
  function rememberEmail(v) { v ? STORE.write(EMAIL_KEY, v) : STORE.remove(EMAIL_KEY); }
  function getDraft(email) { try { return JSON.parse(STORE.read(draftKey(email)) || "null"); } catch (e) { return null; } }
  function setDraft(email, d) { STORE.write(draftKey(email), JSON.stringify(d)); }
  function clearDraft(email) { STORE.remove(draftKey(email)); }
  // Snapshot of the last resolved view, so a refresh can restore the right
  // screen INSTANTLY (no backend round-trip) before revalidating in the bg.
  function snapKey(email) { return "bday.snap." + (email || ""); }
  function getSnap(email) { try { return JSON.parse(STORE.read(snapKey(email)) || "null"); } catch (e) { return null; } }
  function setSnap(email, s) { STORE.write(snapKey(email), JSON.stringify(s)); }
  function clearSnap(email) { STORE.remove(snapKey(email)); }

  // ── Populate content from config ──────────────────────
  function setText(id, value) {
    var el = document.getElementById(id);
    if (el && value != null) el.textContent = value;
  }

  var milestone = cfg.milestone ? " " + cfg.milestone : "";
  setText("host-line", (cfg.hostName || "The") + "'s" + milestone);   // "Adi's 30th"
  setText("occasion-line", cfg.occasion || "Escape");
  setText("dates-chip", cfg.dates);
  setText("loc-chip", cfg.locationTeaser || "☀️ RSVP for the details");
  setText("tagline", cfg.tagline);
  document.title = "You're Invited 🌅";

  // The reveal + trip details (populated now, shown after unlock)
  setText("reveal-place", cfg.locationShort || cfg.location);
  setText("reveal-occasion", (cfg.nickname || cfg.hostName || "the birthday") + "'s" + milestone);
  setText("reveal-when", cfg.dates);

  var H = cfg.hotel;
  if (H) {
    setText("stay-note", H.note);
    setText("hotel-name", H.name);
    setText("hotel-blurb", H.blurb);
    setText("hotel-address", H.address);
    setText("hotel-phone", H.phone);

    var gal = document.getElementById("hotel-gallery");
    if (gal && H.photos && H.photos.length) {
      var main = H.photos[0];
      var html = '<img class="hotel-hero-img" src="' + main.src + '" alt="' + escapeHtml(main.alt || "") + '" loading="lazy" />';
      var thumbs = H.photos.slice(1);
      if (thumbs.length) {
        html += '<div class="hotel-thumbs">' + thumbs.map(function (p) {
          return '<img src="' + p.src + '" alt="' + escapeHtml(p.alt || "") + '" loading="lazy" />';
        }).join("") + "</div>";
      }
      gal.innerHTML = html;
    }

    var chips = document.getElementById("amenity-chips");
    if (chips && H.amenities) {
      chips.innerHTML = H.amenities.map(function (a) { return "<li>" + escapeHtml(a) + "</li>"; }).join("");
    }

    var mapLink = document.getElementById("hotel-map-link");
    if (mapLink && H.mapsUrl) mapLink.href = H.mapsUrl;
    var mapBtn = document.getElementById("hotel-map-btn");
    if (mapBtn && H.mapsUrl) mapBtn.href = H.mapsUrl;
    var phoneLink = document.getElementById("hotel-phone-link");
    if (phoneLink && H.phoneHref) phoneLink.href = "tel:" + H.phoneHref;
  }

  var timeline = document.getElementById("timeline");
  if (timeline && Array.isArray(cfg.itinerary)) {
    timeline.innerHTML = "";
    cfg.itinerary.forEach(function (c) {
      var li = document.createElement("li");
      li.className = "t-item";
      var html =
        '<span class="t-day">' + escapeHtml(c.day || "") + "</span>" +
        '<span class="t-title">' + escapeHtml(c.title || "") + "</span>";
      if (Array.isArray(c.items) && c.items.length) {
        html += '<ul class="t-sched">' + c.items.map(function (it) {
          var tag = it.tag
            ? ' <em class="tag tag-' + escapeHtml(String(it.tag).toLowerCase()) + '">' + escapeHtml(it.tag) + "</em>"
            : "";
          return '<li><span class="t-time">' + escapeHtml(it.time || "") + "</span>" +
                 '<span class="t-what">' + escapeHtml(it.text || "") + tag + "</span></li>";
        }).join("") + "</ul>";
      } else if (c.detail) {
        html += '<span class="t-detail">' + escapeHtml(c.detail) + "</span>";
      }
      li.innerHTML = html;
      timeline.appendChild(li);
    });
  }

  if (cfg.travel) {
    var tNote = cfg.travel.note || "";
    if (cfg.travel.airport) tNote = "Nearest airport: " + cfg.travel.airport + ". " + tNote;
    setText("travel-note", tNote);
  }

  // ── Element refs ──────────────────────────────────────
  var gateForm = document.getElementById("gate-form");
  var gateEmail = document.getElementById("gate-email");
  var gateError = document.getElementById("gate-error");
  var gateSubmit = document.getElementById("gate-submit");

  var rsvpForm = document.getElementById("rsvp-form");
  var rsvpError = document.getElementById("rsvp-error");
  var rsvpSubmit = document.getElementById("rsvp-submit");
  var welcome = document.getElementById("welcome-name");
  var guestList = document.getElementById("guest-list");
  var addGuestBtn = document.getElementById("add-guest");
  var partyNotes = document.getElementById("party-notes");
  var guestTpl = document.getElementById("guest-card-tpl");

  var successTitle = document.getElementById("success-title");
  var successMsg = document.getElementById("success-msg");
  var editBtn = document.getElementById("edit-rsvp");
  var progressBar = document.getElementById("progress-bar");

  var guestEmail = "";     // the email they unlocked with
  var guestGreet = "";     // name to greet them by (their own row)
  var uid = 0;             // unique-ish counter for radio-group names

  // ── The deck ──────────────────────────────────────────
  var STEPS = ["hero", "gate", "reveal", "stay", "weekend", "travel", "rsvp", "success"];
  var slides = {};
  document.querySelectorAll(".slide").forEach(function (s) { slides[s.dataset.step] = s; });
  var currentIndex = 0;

  // goTo works for any slide, including the side-screens (confirmed, faq)
  // that live outside the linear STEPS progression.
  function goTo(step, opts) {
    if (!slides[step]) return;
    opts = opts || {};
    Object.keys(slides).forEach(function (name) {
      var el = slides[name];
      if (!el) return;
      var on = name === step;
      el.classList.toggle("is-active", on);
      if (on) el.removeAttribute("hidden");
      else el.setAttribute("hidden", "");
    });
    currentIndex = STEPS.indexOf(step);   // -1 for side-screens
    if (progressBar) {
      if (currentIndex >= 0) progressBar.style.width = ((currentIndex + 1) / STEPS.length * 100) + "%";
      else if (step === "confirmed") progressBar.style.width = "100%";
    }
    window.scrollTo(0, 0);
    onEnter(step, opts);
  }

  function next() {
    if (currentIndex < 0) return;                     // side-screens use their own buttons
    var step = STEPS[currentIndex];
    if (step === "gate" || step === "rsvp") return;   // these advance only on submit
    goTo(STEPS[Math.min(currentIndex + 1, STEPS.length - 1)]);
  }
  function back() {
    if (currentIndex < 0) return;
    goTo(STEPS[Math.max(currentIndex - 1, 0)]);
  }

  function onEnter(step, opts) {
    if (step === "reveal") runReveal(opts.silent);
    if (step === "gate") setTimeout(function () { gateEmail.focus(); }, 80);
    if (step === "stay") loadMap();
  }

  // Load the map iframe only when the guest reaches the "stay" slide.
  function loadMap() {
    var f = document.getElementById("hotel-map");
    if (f && cfg.hotel && cfg.hotel.mapEmbed && !f.getAttribute("src")) {
      f.setAttribute("src", cfg.hotel.mapEmbed);
    }
  }

  document.querySelectorAll("[data-next]").forEach(function (b) { b.addEventListener("click", next); });
  document.querySelectorAll("[data-back]").forEach(function (b) { b.addEventListener("click", back); });
  document.querySelectorAll("[data-goto]").forEach(function (b) {
    b.addEventListener("click", function () { goTo(b.getAttribute("data-goto")); });
  });

  // FAQ can be opened from a few places; remember where to return to.
  var faqReturn = "confirmed";
  document.querySelectorAll("[data-faq]").forEach(function (b) {
    b.addEventListener("click", function () {
      var active = document.querySelector(".slide.is-active");
      faqReturn = (active && active.dataset.step) || "confirmed";
      goTo("faq");
    });
  });
  var faqBack = document.getElementById("faq-back");
  if (faqBack) faqBack.addEventListener("click", function () { goTo(faqReturn); });

  var notYou = document.getElementById("not-you");
  if (notYou) notYou.addEventListener("click", resetIdentity);

  function resetIdentity() {
    if (guestEmail) clearDraft(guestEmail);
    rememberEmail("");
    guestEmail = "";
    guestGreet = "";
    if (gateEmail) gateEmail.value = "";
    if (welcome) welcome.hidden = true;
    goTo("gate");
  }

  // keyboard: ← / → to move (ignored while typing)
  document.addEventListener("keydown", function (e) {
    var tag = (document.activeElement && document.activeElement.tagName) || "";
    if (/^(INPUT|TEXTAREA|SELECT)$/.test(tag)) return;
    if (e.key === "ArrowRight") next();
    else if (e.key === "ArrowLeft") back();
  });

  // touch swipe (horizontal-dominant only, so it won't fight scrolling)
  var tx = 0, ty = 0;
  document.addEventListener("touchstart", function (e) {
    tx = e.changedTouches[0].clientX; ty = e.changedTouches[0].clientY;
  }, { passive: true });
  document.addEventListener("touchend", function (e) {
    var dx = e.changedTouches[0].clientX - tx;
    var dy = e.changedTouches[0].clientY - ty;
    if (Math.abs(dx) > 70 && Math.abs(dx) > Math.abs(dy) * 1.8) {
      if (dx < 0) next(); else back();
    }
  }, { passive: true });

  // ── Backend call (text/plain avoids CORS preflight) ───
  function callBackend(payload) {
    if (DEMO) {
      return new Promise(function (resolve) {
        setTimeout(function () {
          if (payload.action === "check") {
            var done = /done|rsvpd/.test(payload.email);   // demo: pretend this party already RSVP'd
            resolve({
              ok: true, allowed: /@/.test(payload.email), party: "demo",
              greetName: "Adi", notes: done ? "No nut allergies, please." : "",
              alreadyRsvped: done,
              guests: [
                { row: 2, name: "Adi", attending: done ? "Yes" : "" },
                { row: 3, name: "Andrea", attending: done ? "No" : "" },
              ],
            });
          } else {
            resolve({ ok: true, allowed: true, saved: true });
          }
        }, 650);
      });
    }
    return fetch(cfg.appsScriptUrl, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(payload),
    }).then(function (r) { return r.json(); });
  }

  // ── Email gate ────────────────────────────────────────
  gateForm.addEventListener("submit", function (e) {
    e.preventDefault();
    hideError(gateError);

    var email = (gateEmail.value || "").trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return showError(gateError, "That doesn't look like an email address.");
    }

    loading(gateSubmit, true);
    callBackend({ action: "check", email: email })
      .then(function (res) {
        loading(gateSubmit, false);
        if (!res || !res.ok) {
          return showError(gateError, (res && res.error) || "Couldn't reach the server. Try again.");
        }
        if (!res.allowed) {
          return showError(gateError, "Hmm, that email isn't on the guest list. Double-check it, or ping " + (cfg.hostName || "the host") + ".");
        }
        // unlocked
        rememberEmail(email);
        saveSnap(email, res);
        showState(email, res, { silent: false });   // fresh unlock → confetti on reveal
      })
      .catch(function () {
        loading(gateSubmit, false);
        showError(gateError, "Couldn't reach the server. Check your connection and try again.");
      });
  });

  function runReveal(silent) {
    var reveal = document.getElementById("reveal");
    if (reveal) {
      reveal.classList.remove("show");
      void reveal.offsetWidth;   // force reflow so the animation restarts
      reveal.classList.add("show");
    }
    if (silent) return;          // returning visitor: replay the text, skip the confetti
    burstConfetti();
    // a second pop timed to the big destination word landing
    if (!reduce) setTimeout(burstConfetti, 700);
  }

  function applyGreeting() {
    if (guestGreet) {
      welcome.textContent = "Hey " + guestGreet.split(" ")[0] + " 👋";
      welcome.hidden = false;
    } else {
      welcome.hidden = true;
    }
  }

  // Persist just enough to repaint the right screen on the next load.
  function saveSnap(email, data) {
    if (!email || !data) return;
    setSnap(email, {
      greetName: data.greetName || "",
      notes: data.notes || "",
      alreadyRsvped: !!data.alreadyRsvped,
      guests: (data.guests || []).map(function (g) {
        return { row: g.row || "", name: g.name || "", attending: g.attending || "" };
      }),
    });
  }

  // Render + navigate to the screen matching `data` (a snapshot or a fresh
  // backend response). With opts.onlyMoveIfChanged, it refreshes the content
  // but won't yank a user who's already navigated past the landing screens.
  function showState(email, data, opts) {
    opts = opts || {};
    guestEmail = email;
    guestGreet = data.greetName || "";
    applyGreeting();
    renderParty(data.guests || [], data.notes || "");

    var target = data.alreadyRsvped ? "confirmed" : "reveal";
    if (data.alreadyRsvped) renderConfirmed(data.guests || []);

    if (opts.onlyMoveIfChanged) {
      var active = document.querySelector(".slide.is-active");
      var step = active && active.dataset.step;
      if (step !== "reveal" && step !== "confirmed") return; // they've moved on
      if (step === target) return;                           // already correct
    }
    goTo(target, { silent: !!opts.silent });
  }

  // ── Party rendering (editable guest list) ─────────────
  // If the guest has an unsaved draft on this device, it wins over what the
  // backend returned (the backend omits flight times for privacy, so the
  // draft is the only place their typed flights survive a refresh).
  function renderParty(guests, notes) {
    var draft = guestEmail ? getDraft(guestEmail) : null;
    var src = (draft && draft.guests && draft.guests.length) ? draft.guests : guests;
    var noteVal = draft ? (draft.notes || "") : (notes || "");

    guestList.innerHTML = "";
    if (!src.length) addGuestCard({}, true);          // always show at least one row
    src.forEach(function (g) { addGuestCard(g, !g.row); });  // rows without a row# are removable +1s
    if (partyNotes) partyNotes.value = noteVal;
  }

  // ── Confirmed summary (returning guest who already RSVP'd) ──
  function renderConfirmed(guests) {
    var named = (guests || []).filter(function (g) { return String(g.name || "").trim(); });
    var first = guestGreet ? guestGreet.split(" ")[0] : "";
    setText("confirmed-greet", first ? "You're all set, " + first + "!" : "You're all set!");

    var list = document.getElementById("confirmed-party");
    if (list) {
      list.innerHTML = named.map(function (g) {
        var st = g.attending === "Yes" ? { c: "is-in", t: "In 🍹" }
               : g.attending === "No" ? { c: "is-out", t: "Can't make it" }
               : { c: "is-none", t: "No response yet" };
        return '<li class="cp-row"><span class="cp-name">' + escapeHtml(g.name) +
               '</span><span class="cp-status ' + st.c + '">' + st.t + "</span></li>";
      }).join("");
    }
    var coming = named.filter(function (g) { return g.attending === "Yes"; }).length;
    setText("confirmed-count", coming ? (coming + (coming === 1 ? " person" : " people") + " coming 🌴") : "");
    setText("confirmed-recap", [cfg.locationShort || cfg.location, cfg.dates, cfg.hotel && cfg.hotel.name]
      .filter(Boolean).join("  ·  "));
  }

  // ── FAQ (config-driven, native accordion) ─────────────
  function renderFaq() {
    var wrap = document.getElementById("faq-list");
    if (!wrap || !Array.isArray(cfg.faq)) return;
    wrap.innerHTML = cfg.faq.map(function (f) {
      return '<details class="faq-item"><summary>' + escapeHtml(f.q) +
             "</summary><p>" + escapeHtml(f.a) + "</p></details>";
    }).join("");
  }

  function addGuestCard(g, isNew) {
    g = g || {};
    var frag = guestTpl.content.cloneNode(true);
    var card = frag.querySelector(".guest-card");
    if (g.row) card.dataset.row = g.row;

    var groupName = "att-" + (uid++);
    var inChoice = card.querySelector(".g-in");
    var outChoice = card.querySelector(".g-out");
    inChoice.name = outChoice.name = groupName;

    card.querySelector(".g-name").value = g.name || "";
    card.querySelector(".g-af").value = g.arrivalFlight || "";
    card.querySelector(".g-at").value = g.arrivalTime || "";
    card.querySelector(".g-df").value = g.departureFlight || "";
    card.querySelector(".g-dt").value = g.departureTime || "";

    if (g.attending === "Yes") {
      inChoice.checked = true;
      card.querySelector(".g-flights").hidden = false;
    } else if (g.attending === "No") {
      outChoice.checked = true;
    }

    // form-added guests can be removed; roster guests just toggle "out"
    if (isNew) card.querySelector(".g-remove").hidden = false;

    guestList.appendChild(frag);
  }

  // Each card shows/hides its own flight block from its In/Out choice
  guestList.addEventListener("change", function (e) {
    var card = e.target.closest(".guest-card");
    if (!card) return;
    if (e.target.classList.contains("g-in") || e.target.classList.contains("g-out")) {
      card.querySelector(".g-flights").hidden = !card.querySelector(".g-in").checked;
    }
    clearCardError(card);       // editing a card clears its validation state
  });
  guestList.addEventListener("input", function (e) {
    var card = e.target.closest(".guest-card");
    if (card) clearCardError(card);
  });

  guestList.addEventListener("click", function (e) {
    var btn = e.target.closest(".g-remove");
    if (btn) btn.closest(".guest-card").remove();
  });

  // ── Per-guest validation helpers ──────────────────────
  function badCard(card, highlightEl, msg) {
    card.classList.add("invalid");
    if (highlightEl) highlightEl.classList.add("invalid");
    var err = card.querySelector(".g-error");
    if (err) { err.textContent = msg; err.hidden = false; }
  }
  function clearCardError(card) {
    card.classList.remove("invalid");
    card.querySelectorAll(".invalid").forEach(function (el) { el.classList.remove("invalid"); });
    var err = card.querySelector(".g-error");
    if (err) { err.hidden = true; err.textContent = ""; }
  }

  addGuestBtn.addEventListener("click", function () {
    addGuestCard({}, true);
    var cards = guestList.querySelectorAll(".guest-card");
    var last = cards[cards.length - 1];
    if (last) last.querySelector(".g-name").focus();
    saveDraft();
  });

  // ── RSVP draft: snapshot the form to this device as they edit ──
  function currentDraft() {
    var cards = Array.prototype.slice.call(guestList.querySelectorAll(".guest-card"));
    return {
      guests: cards.map(function (card) {
        return {
          row: card.dataset.row || "",
          name: card.querySelector(".g-name").value,
          attending: card.querySelector(".g-in").checked ? "Yes"
                   : (card.querySelector(".g-out").checked ? "No" : ""),
          arrivalFlight: card.querySelector(".g-af").value,
          arrivalTime: card.querySelector(".g-at").value,
          departureFlight: card.querySelector(".g-df").value,
          departureTime: card.querySelector(".g-dt").value,
        };
      }),
      notes: partyNotes ? partyNotes.value : "",
    };
  }
  function saveDraft() { if (guestEmail) setDraft(guestEmail, currentDraft()); }
  rsvpForm.addEventListener("input", saveDraft);
  rsvpForm.addEventListener("change", saveDraft);
  guestList.addEventListener("click", function (e) {   // removing a +1 also updates the draft
    if (e.target.closest(".g-remove")) saveDraft();
  });

  // ── RSVP submit ───────────────────────────────────────
  rsvpForm.addEventListener("submit", function (e) {
    e.preventDefault();
    hideError(rsvpError);

    var cards = Array.prototype.slice.call(guestList.querySelectorAll(".guest-card"));
    var guests = [];
    var anyYes = false;
    var firstBad = null;

    cards.forEach(function (card) {
      clearCardError(card);
      var nameEl = card.querySelector(".g-name");
      var nm = nameEl.value.trim();
      var inC = card.querySelector(".g-in").checked;
      var outC = card.querySelector(".g-out").checked;
      var answered = inC || outC;

      if (!nm && !answered) return;                   // untouched row — skip

      if (!nm) {
        firstBad = firstBad || nameEl;
        return badCard(card, nameEl, "Add a name, or clear this row.");
      }
      if (!answered) {
        firstBad = firstBad || card.querySelector(".g-in");
        return badCard(card, card.querySelector(".g-attend"),
          "Let us know if " + nm.split(" ")[0] + " is in or out.");
      }

      var at = card.querySelector(".g-at").value;
      var dt = card.querySelector(".g-dt").value;
      if (inC && at && dt && dt <= at) {
        firstBad = firstBad || card.querySelector(".g-dt");
        return badCard(card, card.querySelector(".g-dt"),
          "Departure is before arrival — check the times.");
      }

      if (inC) anyYes = true;
      guests.push({
        row: card.dataset.row || "",
        name: nm,
        attending: inC ? "Yes" : "No",
        arrivalFlight: card.querySelector(".g-af").value.trim(),
        arrivalTime: at,
        departureFlight: card.querySelector(".g-df").value.trim(),
        departureTime: dt,
      });
    });

    if (firstBad) {
      firstBad.focus();
      return showError(rsvpError, "Please fix the highlighted fields above.");
    }
    if (!guests.length) {
      return showError(rsvpError, "Add at least one name so we know who's coming.");
    }

    loading(rsvpSubmit, true);
    callBackend({ action: "rsvp", email: guestEmail, guests: guests, notes: partyNotes.value || "" })
      .then(function (res) {
        loading(rsvpSubmit, false);
        if (!res || !res.ok) {
          return showError(rsvpError, (res && res.error) || "Couldn't save that. Try again.");
        }
        // remember that this party has now RSVP'd, so a refresh lands on the
        // confirmed screen (not the reveal) with the right in/out per guest.
        saveSnap(guestEmail, {
          greetName: guestGreet, notes: partyNotes.value || "",
          alreadyRsvped: true, guests: guests,
        });
        showSuccess(anyYes);
      })
      .catch(function () {
        loading(rsvpSubmit, false);
        showError(rsvpError, "Couldn't save that. Check your connection and try again.");
      });
  });

  function showSuccess(anyYes) {
    if (anyYes) {
      successTitle.textContent = "You're locked in! 🎉";
      successMsg.textContent = "See you in " + (cfg.location || "paradise") + ". We'll send the full itinerary soon.";
    } else {
      successTitle.textContent = "We'll miss you 💛";
      successMsg.textContent = "Thanks for letting us know. If plans change, come back and update your RSVP.";
    }
    goTo("success");
    if (anyYes) burstConfetti();
  }

  editBtn.addEventListener("click", function () { goTo("rsvp"); });

  renderFaq();

  // ── Returning visitor: restore instantly, then revalidate ──
  (function restore() {
    var saved = savedEmail();
    if (!saved) return;

    // 1) Paint the last known screen immediately from the local snapshot, so
    //    we never flash the cover while the backend round-trips.
    var snap = getSnap(saved);
    if (snap) showState(saved, snap, { silent: true });

    // 2) Revalidate in the background and reconcile with the server.
    callBackend({ action: "check", email: saved })
      .then(function (res) {
        if (!res || !res.ok) return;                 // transient error: keep cached view
        if (!res.allowed) {                          // removed from the guest list
          rememberEmail(""); clearSnap(saved); clearDraft(saved);
          if (snap) resetIdentity();                 // pull them back to the gate
          return;
        }
        saveSnap(saved, res);
        // If we already painted a cached screen, only re-navigate when the
        // coarse state actually changed; otherwise this is the first paint.
        showState(saved, res, { silent: true, onlyMoveIfChanged: !!snap });
      })
      .catch(function () { /* offline: keep the cached view (or stay on cover) */ });
  })();

  // ── Small UI helpers ──────────────────────────────────
  function loading(btn, on) {
    btn.classList.toggle("loading", on);
    btn.disabled = on;
  }
  function showError(el, msg) { el.textContent = msg; el.hidden = false; }
  function hideError(el) { el.hidden = true; el.textContent = ""; }
  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  // ── Confetti (canvas, no dependencies) ────────────────
  var canvas = document.getElementById("confetti");
  var ctx = canvas.getContext("2d");
  var pieces = [];
  var raf = null;
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var COLORS = ["#ffd166", "#ff9e42", "#ff3d8b", "#2dd4bf", "#ff6b5e", "#fff6e9"];

  function sizeCanvas() {
    canvas.width = window.innerWidth * devicePixelRatio;
    canvas.height = window.innerHeight * devicePixelRatio;
  }
  sizeCanvas();
  window.addEventListener("resize", sizeCanvas);

  function burstConfetti() {
    if (reduce) return;
    var count = 140;
    for (var i = 0; i < count; i++) {
      pieces.push({
        x: Math.random() * canvas.width,
        y: -20 * devicePixelRatio,
        w: (6 + Math.random() * 6) * devicePixelRatio,
        h: (8 + Math.random() * 8) * devicePixelRatio,
        vx: (Math.random() - 0.5) * 4 * devicePixelRatio,
        vy: (2 + Math.random() * 4) * devicePixelRatio,
        rot: Math.random() * Math.PI,
        vr: (Math.random() - 0.5) * 0.3,
        color: COLORS[(Math.random() * COLORS.length) | 0],
        life: 0,
      });
    }
    if (!raf) tick();
  }

  function tick() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (var i = pieces.length - 1; i >= 0; i--) {
      var p = pieces[i];
      p.vy += 0.05 * devicePixelRatio;
      p.x += p.vx;
      p.y += p.vy;
      p.rot += p.vr;
      p.life++;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      ctx.restore();
      if (p.y > canvas.height + 40 * devicePixelRatio) pieces.splice(i, 1);
    }
    if (pieces.length) {
      raf = requestAnimationFrame(tick);
    } else {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      raf = null;
    }
  }
})();

/* ─────────────────────────────────────────────────────────────
   Birthday Escape Invite — front-end logic
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

  // ── Populate content from config ──────────────────────
  function setText(id, value) {
    var el = document.getElementById(id);
    if (el && value != null) el.textContent = value;
  }

  var milestone = cfg.milestone ? " " + cfg.milestone : "";
  setText("host-line", (cfg.hostName || "The") + "'s" + milestone);   // "Aditya's 30th"
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
  var attendingFields = document.getElementById("attending-fields");

  var successTitle = document.getElementById("success-title");
  var successMsg = document.getElementById("success-msg");
  var editBtn = document.getElementById("edit-rsvp");
  var progressBar = document.getElementById("progress-bar");

  var guestEmail = "";
  var guestName = "";

  // ── The deck ──────────────────────────────────────────
  var STEPS = ["hero", "gate", "reveal", "stay", "weekend", "travel", "rsvp", "success"];
  var slides = {};
  document.querySelectorAll(".slide").forEach(function (s) { slides[s.dataset.step] = s; });
  var currentIndex = 0;

  function goTo(step) {
    var idx = STEPS.indexOf(step);
    if (idx < 0) return;
    currentIndex = idx;
    STEPS.forEach(function (name) {
      var s = slides[name];
      if (!s) return;
      var on = name === step;
      s.classList.toggle("is-active", on);
      if (on) s.removeAttribute("hidden");
      else s.setAttribute("hidden", "");
    });
    if (progressBar) progressBar.style.width = ((idx + 1) / STEPS.length * 100) + "%";
    window.scrollTo(0, 0);
    onEnter(step);
  }

  function next() {
    var step = STEPS[currentIndex];
    if (step === "gate" || step === "rsvp") return;   // these advance only on submit
    goTo(STEPS[Math.min(currentIndex + 1, STEPS.length - 1)]);
  }
  function back() {
    goTo(STEPS[Math.max(currentIndex - 1, 0)]);
  }

  function onEnter(step) {
    if (step === "reveal") runReveal();
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
            resolve({ ok: true, allowed: /@/.test(payload.email), name: "" });
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
        // unlocked → move into the reveal
        guestEmail = email;
        guestName = res.name || "";
        if (guestName) {
          welcome.textContent = "Hey " + guestName.split(" ")[0] + " 👋";
          welcome.hidden = false;
          var nameInput = document.getElementById("rsvp-name");
          if (nameInput && !nameInput.value) nameInput.value = guestName;
        }
        goTo("reveal");
      })
      .catch(function () {
        loading(gateSubmit, false);
        showError(gateError, "Couldn't reach the server. Check your connection and try again.");
      });
  });

  function runReveal() {
    var reveal = document.getElementById("reveal");
    if (reveal) {
      reveal.classList.remove("show");
      void reveal.offsetWidth;   // force reflow so the animation restarts
      reveal.classList.add("show");
    }
    burstConfetti();
    // a second pop timed to the big destination word landing
    if (!reduce) setTimeout(burstConfetti, 700);
  }

  // ── Show/hide flight fields based on attendance ───────
  rsvpForm.addEventListener("change", function (e) {
    if (e.target.name === "attending") {
      attendingFields.hidden = e.target.value !== "Yes";
    }
  });

  // ── RSVP submit ───────────────────────────────────────
  rsvpForm.addEventListener("submit", function (e) {
    e.preventDefault();
    hideError(rsvpError);

    var fd = new FormData(rsvpForm);
    var attending = fd.get("attending");
    if (!attending) {
      return showError(rsvpError, "Let us know if you're coming first!");
    }

    var data = {
      name: (fd.get("name") || guestName || "").trim(),
      attending: attending,
      partySize: attending === "Yes" ? (fd.get("partySize") || "") : "",
      arrivalAirline: fd.get("arrivalAirline") || "",
      arrivalFlight: fd.get("arrivalFlight") || "",
      arrivalDate: fd.get("arrivalDate") || "",
      arrivalTime: fd.get("arrivalTime") || "",
      departureAirline: fd.get("departureAirline") || "",
      departureFlight: fd.get("departureFlight") || "",
      departureDate: fd.get("departureDate") || "",
      departureTime: fd.get("departureTime") || "",
      notes: fd.get("notes") || "",
    };

    loading(rsvpSubmit, true);
    callBackend({ action: "rsvp", email: guestEmail, data: data })
      .then(function (res) {
        loading(rsvpSubmit, false);
        if (!res || !res.ok) {
          return showError(rsvpError, (res && res.error) || "Couldn't save that. Try again.");
        }
        showSuccess(attending);
      })
      .catch(function () {
        loading(rsvpSubmit, false);
        showError(rsvpError, "Couldn't save that. Check your connection and try again.");
      });
  });

  function showSuccess(attending) {
    if (attending === "Yes") {
      successTitle.textContent = "You're locked in! 🎉";
      successMsg.textContent = "See you in " + (cfg.location || "paradise") + ". We'll send the full itinerary soon.";
    } else {
      successTitle.textContent = "We'll miss you 💛";
      successMsg.textContent = "Thanks for letting us know. If plans change, come back and update your RSVP.";
    }
    goTo("success");
    if (attending === "Yes") burstConfetti();
  }

  editBtn.addEventListener("click", function () { goTo("rsvp"); });

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

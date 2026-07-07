/* ─────────────────────────────────────────────────────────────
   Cabo Birthday Invite — front-end logic
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

  setText("host-line", (cfg.hostName || "The") + "'s");
  setText("occasion-line", cfg.occasion || "Birthday");
  setText("dates-chip", cfg.dates);
  setText("loc-chip", cfg.location);
  setText("tagline", cfg.tagline);
  setText("foot-loc", cfg.location);
  document.title = (cfg.hostName ? cfg.hostName + "'s " : "") + "Cabo Birthday — You're Invited";

  var list = document.getElementById("highlight-list");
  if (list && Array.isArray(cfg.highlights)) {
    list.innerHTML = "";
    cfg.highlights.forEach(function (h) {
      var li = document.createElement("li");
      li.innerHTML = '<span class="emoji">' + h.icon + "</span><span>" + escapeHtml(h.label) + "</span>";
      list.appendChild(li);
    });
  }

  // ── Element refs ──────────────────────────────────────
  var gate = document.getElementById("gate");
  var gateForm = document.getElementById("gate-form");
  var gateEmail = document.getElementById("gate-email");
  var gateError = document.getElementById("gate-error");
  var gateSubmit = document.getElementById("gate-submit");

  var rsvpPane = document.getElementById("rsvp-pane");
  var rsvpForm = document.getElementById("rsvp-form");
  var rsvpError = document.getElementById("rsvp-error");
  var rsvpSubmit = document.getElementById("rsvp-submit");
  var welcome = document.getElementById("welcome-name");
  var attendingFields = document.getElementById("attending-fields");

  var successPane = document.getElementById("success");
  var successTitle = document.getElementById("success-title");
  var successMsg = document.getElementById("success-msg");
  var editBtn = document.getElementById("edit-rsvp");

  var guestEmail = "";
  var guestName = "";

  // ── Backend call (text/plain avoids CORS preflight) ───
  function callBackend(payload) {
    if (DEMO) {
      // Demo mode: pretend everyone whose email contains a "@" is invited.
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
        // unlocked
        guestEmail = email;
        guestName = res.name || "";
        openRsvp();
      })
      .catch(function () {
        loading(gateSubmit, false);
        showError(gateError, "Couldn't reach the server. Check your connection and try again.");
      });
  });

  function openRsvp() {
    gate.hidden = true;
    successPane.hidden = true;
    rsvpPane.hidden = false;
    if (guestName) {
      welcome.textContent = "Welcome, " + guestName.split(" ")[0] + "! 🌴";
      var nameInput = document.getElementById("rsvp-name");
      if (nameInput && !nameInput.value) nameInput.value = guestName;
    }
    burstConfetti();
    rsvpPane.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  // ── Show/hide flight fields based on attendance ───────
  rsvpForm.addEventListener("change", function (e) {
    if (e.target.name === "attending") {
      var coming = e.target.value === "Yes";
      attendingFields.hidden = !coming;
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
    rsvpPane.hidden = true;
    successPane.hidden = false;
    if (attending === "Yes") {
      successTitle.textContent = "You're locked in! 🎉";
      successMsg.textContent = "See you in " + (cfg.location || "Cabo") + ". We'll send the full itinerary soon.";
      burstConfetti();
    } else {
      successTitle.textContent = "We'll miss you 💛";
      successMsg.textContent = "Thanks for letting us know. If plans change, come back and update your RSVP.";
    }
    successPane.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  editBtn.addEventListener("click", function () {
    successPane.hidden = true;
    rsvpPane.hidden = false;
    rsvpPane.scrollIntoView({ behavior: "smooth", block: "center" });
  });

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

/* ════════════════════════════════════════════════════════
   voice.js — Web Speech API ingredient input (v3 robust)
   ════════════════════════════════════════════════════════ */

const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

export function initVoiceInput({
  onIngredients,
  micBtnId  = "voice-mic-btn",
  previewId = "voice-preview",
}) {
  const micBtn  = document.getElementById(micBtnId);
  const preview = document.getElementById(previewId);
  if (!micBtn) return;

  // ── Browser support check ──────────────────────────────────────────────────
  if (!SpeechRecognition) {
    micBtn.disabled = true;
    micBtn.title    = "Voice input needs Chrome or Edge";
    micBtn.style.opacity = "0.35";
    if (preview) {
      preview.textContent  = "⚠️ Voice input needs Chrome or Edge browser";
      preview.style.display = "block";
    }
    return;
  }

  let listening = false;

  // ── Helpers ────────────────────────────────────────────────────────────────
  function setListening(val) {
    listening = val;
    micBtn.classList.toggle("listening", val);
    micBtn.textContent = val ? "🔴" : "🎤";
    micBtn.title = val ? "Stop listening" : "Voice input — click to speak";
  }

  function showPreview(msg, autohide = 0) {
    if (!preview) return;
    preview.textContent  = msg;
    preview.style.display = "block";
    if (autohide) setTimeout(() => { preview.style.display = "none"; }, autohide);
  }

  // Clean "I have eggs, tomatoes and garlic" → ["eggs","tomatoes","garlic"]
  function parseIngredients(text) {
    return text
      .toLowerCase()
      .replace(/^(i (have|see|got|need)|we have|add|put in|there'?s?)\s+/i, "")
      .replace(/\s+(and|also|plus|with)\s+/g, ",")
      .split(/[,،]/g)
      .map(s => s.trim().replace(/[.!?]+$/, ""))
      .filter(s => s.length > 1 && s.length < 50 && /[a-z]/.test(s));
  }

  // ── Recognition factory — always create fresh (avoids reuse bugs) ──────────
  function createRecog() {
    const r = new SpeechRecognition();
    r.continuous      = false;   // single-shot
    r.interimResults  = true;    // show live transcript
    r.maxAlternatives = 1;
    r.lang            = "en-IN"; // good for Indian food names

    let finalTranscript = "";

    r.onstart = () => {
      setListening(true);
      finalTranscript = "";
      showPreview("🎤 Listening… say your ingredients");
    };

    r.onresult = (e) => {
      // Accumulate results correctly using resultIndex
      let interim = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const result = e.results[i];
        if (result.isFinal) {
          finalTranscript += result[0].transcript;
        } else {
          interim += result[0].transcript;
        }
      }
      showPreview(`"${finalTranscript || interim}"`);
    };

    r.onspeechend = () => {
      r.stop();
    };

    r.onend = () => {
      setListening(false);
      // Process whatever we have
      const text = finalTranscript.trim();
      if (text) {
        const ings = parseIngredients(text);
        if (ings.length) {
          onIngredients(ings);
          showPreview(`✅ Added: ${ings.join(", ")}`, 3000);
        } else {
          showPreview("⚠️ Couldn't parse ingredients — try again", 3000);
        }
      } else {
        showPreview("No speech detected — try again", 3000);
      }
    };

    r.onerror = (e) => {
      setListening(false);
      const msgs = {
        "no-speech":          "🎤 No speech detected — try again",
        "audio-capture":      "⚠️ Microphone not found",
        "not-allowed":        "🚫 Microphone blocked — click the 🔒 icon and allow mic",
        "network":            "⚠️ Network error during recognition",
        "service-not-allowed":"⚠️ Voice blocked — use localhost or HTTPS",
        "aborted":            "",  // user cancelled, silent
      };
      const msg = msgs[e.error];
      if (msg !== undefined) showPreview(msg || "", msg ? 4000 : 0);
    };

    return r;
  }

  // ── Button handler ─────────────────────────────────────────────────────────
  let activeRecog = null;

  micBtn.addEventListener("click", () => {
    if (listening) {
      activeRecog?.stop();
      return;
    }
    activeRecog = createRecog();
    try {
      activeRecog.start();
    } catch (err) {
      setListening(false);
      showPreview("⚠️ Could not start mic: " + err.message, 4000);
    }
  });
}

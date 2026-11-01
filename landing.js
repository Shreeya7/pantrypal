/* ════════════════════════════════════════════════════════
   landing.js — Splash screen + simple fire transition
   ════════════════════════════════════════════════════════ */

import "./cursor.js";

// ─── Refs ─────────────────────────────────────────────────────────────────────
// NOTE: ES modules are deferred — DOM is already ready here, no DOMContentLoaded needed
const landing   = document.getElementById("landing");
const ctaBtn    = document.getElementById("landing-cta");
const appContent = document.getElementById("app-content");
const ambientCanvas = document.getElementById("ambient-canvas");

// ─── Spawn floating emojis ────────────────────────────────────────────────────
const FOOD_EMOJIS = [
  "🧄","🌶️","🍋","🥕","🧅","🫚","🌿","🍅","🥦","🫛",
  "🥚","🫙","🧈","🍞","🍗","🫕","🥩","🐟","🍎","🧀",
  "🌱","🥜","🍄","🥬","🌽","🥑","🍊","🫐","🍇","🧆",
];

(function spawnFloatingEmojis() {
  const count = Math.min(28, Math.floor(window.innerWidth / 50));
  for (let i = 0; i < count; i++) {
    const el = document.createElement("span");
    el.className = "float-emoji";
    el.textContent = FOOD_EMOJIS[i % FOOD_EMOJIS.length];
    el.style.cssText = `
      left: ${Math.random() * 92 + 2}%;
      top:  ${Math.random() * 88 + 4}%;
      font-size: ${(Math.random() * 1.2 + 1.5).toFixed(2)}rem;
      --dur:   ${(Math.random() * 5 + 5).toFixed(1)}s;
      --delay: ${(Math.random() * 4).toFixed(1)}s;
      --rot-a: ${Math.round(Math.random() * 24 - 12)}deg;
      --rot-b: ${Math.round(Math.random() * 16 - 8)}deg;
      --rot-c: ${Math.round(Math.random() * 16 - 8)}deg;
    `;
    landing.appendChild(el);
  }
})();

// ─── Simple CSS fire transition ───────────────────────────────────────────────
function fireTransition(onDone) {
  // Create a gradient overlay that sweeps up like fire
  const overlay = document.createElement("div");
  overlay.style.cssText = `
    position: fixed;
    inset: 0;
    z-index: 9500;
    background: linear-gradient(
      to top,
      #8b0000 0%,
      #cc2200 20%,
      #ff4500 45%,
      #ff8c00 65%,
      #ffcc00 80%,
      #fff5cc 100%
    );
    transform: translateY(101%);
    transition: transform 0.65s cubic-bezier(0.55, 0, 0.45, 1);
    pointer-events: none;
  `;
  document.body.appendChild(overlay);

  // Sweep up
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      overlay.style.transform = "translateY(0%)";
    });
  });

  // Hold briefly, then fade out
  setTimeout(() => {
    overlay.style.transition = "opacity 0.55s ease";
    overlay.style.opacity    = "0";
    onDone();
    setTimeout(() => overlay.remove(), 600);
  }, 750);
}

// ─── Enter app ────────────────────────────────────────────────────────────────
function enterApp() {
  ctaBtn.disabled = true;
  ctaBtn.textContent = "🔥 Launching…";

  fireTransition(() => {
    // Fade out landing
    landing.style.transition = "opacity 0.4s ease";
    landing.style.opacity    = "0";
    setTimeout(() => { landing.style.display = "none"; }, 450);

    // Reveal main app
    appContent.style.opacity        = "1";
    appContent.style.pointerEvents  = "auto";

    // Start ambient particles
    startAmbient();
  });
}

ctaBtn.addEventListener("click", enterApp);

// Also allow Enter / Space
document.addEventListener("keydown", (e) => {
  if ((e.key === "Enter" || e.key === " ") && !ctaBtn.disabled) {
    e.preventDefault();
    enterApp();
  }
});

// ─── Ambient background particles (main app) ──────────────────────────────────
function startAmbient() {
  const canvas = ambientCanvas;
  if (!canvas) return;
  const ctx = canvas.getContext("2d");

  function resize() {
    canvas.width  = window.innerWidth;
    canvas.height = window.innerHeight;
  }
  resize();
  window.addEventListener("resize", resize);

  const particles = Array.from({ length: 55 }, () => ({
    x:    Math.random() * canvas.width,
    y:    Math.random() * canvas.height,
    r:    Math.random() * 1.4 + 0.4,
    vx:   (Math.random() - 0.5) * 0.18,
    vy:   -(Math.random() * 0.25 + 0.08),
    life: Math.random(),
    maxLife: Math.random() * 0.7 + 0.3,
    gold: Math.random() > 0.5,
  }));

  (function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    particles.forEach(p => {
      p.x   += p.vx;
      p.y   += p.vy;
      p.life += 0.003;
      if (p.life > p.maxLife || p.y < 0) {
        p.x   = Math.random() * canvas.width;
        p.y   = canvas.height + 5;
        p.life = 0;
      }
      const a = Math.sin((p.life / p.maxLife) * Math.PI) * 0.35;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = p.gold
        ? `rgba(212,175,55,${a})`
        : `rgba(61,184,112,${a})`;
      ctx.fill();
    });
    requestAnimationFrame(draw);
  })();
}

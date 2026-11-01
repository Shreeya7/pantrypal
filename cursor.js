/* ════════════════════════════════════════════════════════
   cursor.js — Custom golden cursor + sparkle trail
   Performance: GPU-accelerated transform, pooled sparkles
   ════════════════════════════════════════════════════════ */

// ─── Create DOM elements ──────────────────────────────────────────────────────
const orb = document.createElement("div");
orb.id = "cursor-orb";
document.body.appendChild(orb);

const dot = document.createElement("div");
dot.id = "cursor-dot";
document.body.appendChild(dot);

// ─── Smooth orb position (lerp) — GPU transform, no layout thrash ────────────
let orbX = -100, orbY = -100;
let targetX = -100, targetY = -100;

function lerp(a, b, t) { return a + (b - a) * t; }

function animateOrb() {
  orbX = lerp(orbX, targetX, 0.22); // snappier than 0.12
  orbY = lerp(orbY, targetY, 0.22);
  // transform instead of left/top → compositor layer, no reflow
  orb.style.transform = `translate(${orbX}px, ${orbY}px)`;
  requestAnimationFrame(animateOrb);
}
animateOrb();

// ─── Mouse tracking ───────────────────────────────────────────────────────────
let lastSparkleTime = 0;

document.addEventListener("mousemove", (e) => {
  targetX = e.clientX;
  targetY = e.clientY;

  // Dot follows instantly via transform
  dot.style.transform = `translate(${e.clientX}px, ${e.clientY}px)`;

  // Throttle sparkles to max ~20/s to reduce DOM thrash
  const now = Date.now();
  if (now - lastSparkleTime > 50) {
    spawnSparkle(e.clientX, e.clientY);
    lastSparkleTime = now;
  }
}, { passive: true });

// ─── Sparkle pool (recycle DOM nodes) ────────────────────────────────────────
const POOL_SIZE = 25;
const SPARKLE_COLORS = [
  "rgba(212,175,55,0.9)",
  "rgba(240,208,96,0.8)",
  "rgba(255,255,200,0.7)",
  "rgba(61,184,112,0.6)",
  "rgba(224,100,50,0.5)",
];

// Pre-create pool
const pool = [];
for (let i = 0; i < POOL_SIZE; i++) {
  const s = document.createElement("div");
  s.className = "sparkle";
  s.style.display = "none";
  document.body.appendChild(s);
  pool.push({ el: s, free: true });
}

function getPooledSparkle() {
  return pool.find(p => p.free) || null;
}

function spawnSparkle(x, y) {
  const entry = getPooledSparkle();
  if (!entry) return; // pool exhausted, skip

  const s     = entry.el;
  const size  = Math.random() * 5 + 2;
  const color = SPARKLE_COLORS[Math.floor(Math.random() * SPARKLE_COLORS.length)];
  const dur   = (Math.random() * 0.4 + 0.35).toFixed(2);
  const dx    = (Math.random() - 0.5) * 60;
  const dy    = -(Math.random() * 50 + 20);

  entry.free = false;
  s.style.cssText = `
    display: block;
    position: fixed;
    left: 0; top: 0;
    transform: translate(${x}px, ${y}px);
    width: ${size}px;
    height: ${size}px;
    border-radius: 50%;
    pointer-events: none;
    z-index: 99999;
    background: ${color};
    box-shadow: 0 0 ${size * 2}px ${color};
    --dur: ${dur}s;
    --dx: ${dx}px;
    --dy: ${dy}px;
    animation: sparkle-fly ${dur}s ease-out forwards;
  `;

  setTimeout(() => {
    s.style.display = "none";
    entry.free = true;
  }, parseFloat(dur) * 1000 + 20);
}

// ─── Click burst ─────────────────────────────────────────────────────────────
document.addEventListener("click", (e) => {
  // Ring pulse
  const ring = document.createElement("div");
  ring.className = "click-ring";
  ring.style.transform = `translate(${e.clientX}px, ${e.clientY}px)`;
  document.body.appendChild(ring);
  setTimeout(() => ring.remove(), 550);

  // Burst — use 6 pool sparkles at once
  for (let i = 0; i < 6; i++) {
    const entry = getPooledSparkle();
    if (!entry) continue;
    const s     = entry.el;
    const angle = (i / 6) * Math.PI * 2;
    const dist  = Math.random() * 50 + 30;
    const size  = Math.random() * 6 + 3;
    const color = SPARKLE_COLORS[Math.floor(Math.random() * SPARKLE_COLORS.length)];

    entry.free = false;
    s.style.cssText = `
      display: block;
      position: fixed;
      left: 0; top: 0;
      transform: translate(${e.clientX}px, ${e.clientY}px);
      width: ${size}px;
      height: ${size}px;
      border-radius: 50%;
      pointer-events: none;
      z-index: 99999;
      background: ${color};
      box-shadow: 0 0 ${size * 2}px ${color};
      --dur: 0.65s;
      --dx: ${Math.cos(angle) * dist}px;
      --dy: ${Math.sin(angle) * dist}px;
      animation: sparkle-fly 0.65s ease-out forwards;
    `;
    setTimeout(() => { s.style.display = "none"; entry.free = true; }, 680);
  }
});

// ─── Hide/show on window blur ─────────────────────────────────────────────────
document.addEventListener("mouseleave", () => {
  orb.style.opacity = "0";
  dot.style.opacity = "0";
});
document.addEventListener("mouseenter", () => {
  orb.style.opacity = "1";
  dot.style.opacity = "1";
});

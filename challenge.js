/* ════════════════════════════════════════════════════════
   challenge.js — Chef's Challenge (anti-waste game)
   ════════════════════════════════════════════════════════ */

import { api }              from "./api.js";
import { buildRecipeCard }  from "./cards.js";
import { openModal }        from "./modal.js";
import { toastError, toastSuccess, toastWarn } from "./toast.js";
import { awardXP, track, recordCook } from "./gamification.js";

const challengePanel = document.getElementById("panel-challenge");

let countdownInterval = null;

// ─── Format countdown ─────────────────────────────────────────────────────────
function formatTimeLeft(ms) {
  if (ms <= 0) return "⚠️ Expired!";
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  if (h > 48) return `${Math.floor(h/24)} days`;
  if (h > 0)  return `${h}h ${m}m`;
  return `${m} min`;
}

// ─── Render the countdown timer ───────────────────────────────────────────────
function startCountdown(expiresAt) {
  const el = document.getElementById("challenge-timer");
  if (!el) return;
  if (countdownInterval) clearInterval(countdownInterval);

  function tick() {
    const ms = new Date(expiresAt) - Date.now();
    el.textContent = formatTimeLeft(ms);
    el.className = "challenge-timer " + (ms < 86400000 ? "urgent" : "");
  }
  tick();
  countdownInterval = setInterval(tick, 30000);
}

// ─── Main load ────────────────────────────────────────────────────────────────
export async function loadChallenge() {
  const container = document.getElementById("challenge-container");
  if (!container) return;

  container.innerHTML = `
    <div class="loading-state"><div class="spinner"></div><span>Scanning your fridge for expiring items…</span></div>`;

  try {
    // 1. Get expiring items (within 5 days)
    const expiring = await api.getExpiring(5);

    if (!expiring.length) {
      container.innerHTML = `
        <div class="challenge-empty">
          <div class="challenge-empty-icon">✅</div>
          <h3>Nothing Expiring Soon!</h3>
          <p>Your fridge looks great — no items expiring within 5 days.<br>
             Add some items to your fridge and come back.</p>
        </div>`;
      return;
    }

    // 2. Match recipes using expiring ingredients
    const ingNames = expiring.map(i => i.name.toLowerCase());
    const results  = await api.matchRecipes(ingNames, 6);

    if (!results.length) {
      container.innerHTML = `
        <div class="challenge-empty">
          <div class="challenge-empty-icon">🤔</div>
          <h3>No matches found</h3>
          <p>Expiring items: <strong>${ingNames.join(", ")}</strong><br>
             Try adding more variety to your fridge.</p>
        </div>`;
      return;
    }

    // 3. Find earliest expiry for the timer
    const earliest = expiring
      .filter(i => i.expires_at)
      .sort((a, b) => new Date(a.expires_at) - new Date(b.expires_at))[0];

    // 4. Render
    const urgentCount   = expiring.filter(i => i.urgency === "critical" || i.urgency === "expired").length;
    const savedEstimate = expiring.length * 45; // ~45 rupees average per item

    container.innerHTML = `
      <div class="challenge-header glass-card">
        <div class="challenge-header__left">
          <div class="challenge-eyebrow">♻️ Anti-Waste Challenge</div>
          <h2 class="challenge-title">Use these before they expire!</h2>
          <div class="challenge-ing-chips">
            ${expiring.map(i => `
              <span class="challenge-chip urgency-${i.urgency || "ok"}">
                ${i.name}
                ${i.days_remaining != null ? `<small>${i.days_remaining}d</small>` : ""}
              </span>`).join("")}
          </div>
        </div>
        <div class="challenge-header__right">
          <div class="challenge-stat">
            <div class="challenge-stat__val" id="challenge-timer">—</div>
            <div class="challenge-stat__label">Until first expiry</div>
          </div>
          <div class="challenge-stat">
            <div class="challenge-stat__val" style="color:var(--c-green)">₹${savedEstimate}</div>
            <div class="challenge-stat__label">Savings potential</div>
          </div>
          <div class="challenge-stat">
            <div class="challenge-stat__val" style="color:var(--c-red)">${urgentCount}</div>
            <div class="challenge-stat__label">Critical items</div>
          </div>
        </div>
      </div>

      <div class="challenge-reward-bar">
        🏆 Complete this challenge → <strong>200 XP + Zero Waste Hero badge</strong>
      </div>

      <h3 class="challenge-subtitle">Best Recipes for Your Challenge</h3>
      <div class="recipe-grid" id="challenge-grid"></div>`;

    // Start timer
    if (earliest) startCountdown(earliest.expires_at);

    // Render recipe cards
    const grid = container.querySelector("#challenge-grid");
    results.forEach(recipe => {
      const card = buildRecipeCard(recipe, { showMatch: true });

      // Add "Accept Challenge" overlay button
      const acceptBtn = document.createElement("button");
      acceptBtn.className = "challenge-accept-btn";
      acceptBtn.textContent = "⚔️ Accept Challenge";
      acceptBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        onChallengeAccepted(recipe);
      });
      card.appendChild(acceptBtn);

      card.addEventListener("click", () => openModal(recipe.id));
      grid.appendChild(card);
    });

    toastSuccess(`Found ${results.length} recipes for your ${expiring.length} expiring items!`);

  } catch (err) {
    container.innerHTML = `<p class="error-msg">Failed to load challenge: ${err.message}</p>`;
    toastError("Challenge load failed");
  }
}

// ─── On challenge accepted ────────────────────────────────────────────────────
function onChallengeAccepted(recipe) {
  toastSuccess(`⚔️ Challenge accepted! Starting cooking mode for "${recipe.title}"…`);

  // Award XP + track
  awardXP(200, "Chef's Challenge completed!");
  track("challenge");
  recordCook();

  // Open modal (which has the Cook Now button)
  setTimeout(() => openModal(recipe.id), 500);
}

// ─── Expose a hook for the cook-done button in modal ─────────────────────────
window.__challengeComplete = () => {
  awardXP(200, "Chef's Challenge completed!");
  track("challenge");
  recordCook();
};

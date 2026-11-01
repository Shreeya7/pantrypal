/* ════════════════════════════════════════════════════════
   app.js — Tab routing + Smart Match + all feature wiring
   ════════════════════════════════════════════════════════ */

import { api }                      from "./api.js";
import { buildRecipeCard }           from "./cards.js";
import { openModal }                 from "./modal.js";
import { toastSuccess, toastError, toastWarn, toastInfo } from "./toast.js";
import { loadInventory, getExpiringIngredientNames, checkExpiryNotification } from "./inventory.js";
import { initDiscovery }            from "./recipes.js";
import "./roulette.js";
import { initVoiceInput }           from "./voice.js";
import { loadChallenge }            from "./challenge.js";
import { renderPlanner }            from "./planner.js";
import { renderExplorer }           from "./explorer.js";
import { renderGrocery }            from "./grocery.js";
import { awardXP, track, renderHUD, recordCook } from "./gamification.js";

// ─── Tab routing ──────────────────────────────────────────────────────────────

const tabs   = document.querySelectorAll(".nav-tab");
const panels = document.querySelectorAll(".tab-panel");

let inventoryLoaded   = false;
let discoveryInitted  = false;
let challengeLoaded   = false;
let plannerLoaded     = false;
let explorerLoaded    = false;
let groceryLoaded     = false;

function activateTab(name) {
  tabs.forEach(t => {
    const active = t.dataset.tab === name;
    t.classList.toggle("active", active);
    t.setAttribute("aria-selected", active);
  });
  panels.forEach(p => {
    p.classList.toggle("active", p.id === `panel-${name}`);
  });

  // Lazy-load per tab
  if (name === "inventory" && !inventoryLoaded) {
    inventoryLoaded = true;
    loadInventory();
  }
  if (name === "discovery" && !discoveryInitted) {
    discoveryInitted = true;
    initDiscovery();
  }
  if (name === "challenge" && !challengeLoaded) {
    challengeLoaded = true;
    loadChallenge();
  }
  if (name === "planner" && !plannerLoaded) {
    plannerLoaded = true;
    renderPlanner();
  }
  if (name === "explorer" && !explorerLoaded) {
    explorerLoaded = true;
    renderExplorer();
  }
  if (name === "grocery" && !groceryLoaded) {
    groceryLoaded = true;
    renderGrocery();
  }
}

tabs.forEach(tab => {
  tab.addEventListener("click", () => activateTab(tab.dataset.tab));
});

// ─── Hero stat: live recipe count ─────────────────────────────────────────────

(async () => {
  try {
    const data = await api.getRecipes({ limit: 1, offset: 0 });
    const total = data.total ?? 0;
    document.querySelectorAll(".hero-stat__num").forEach((el, i) => {
      if (i === 0 && total > 0) el.textContent = (total / 1000).toFixed(0) + "K+";
    });
  } catch { /* silent */ }
})();

// ─── Gamification: init HUD ───────────────────────────────────────────────────
renderHUD();

// ─── Global expiry notification check on startup ──────────────────────────────
// Runs after a short delay so the app has loaded
setTimeout(() => checkExpiryNotification(), 1500);

// ─── Smart Match ──────────────────────────────────────────────────────────────

const chipList     = document.getElementById("selected-chips");
const ingInput     = document.getElementById("ingredient-input");
const addIngBtn    = document.getElementById("add-ingredient-btn");
const findBtn      = document.getElementById("find-recipes-btn");
const matchResults = document.getElementById("match-results");
const expiryToggle = document.getElementById("use-expiring-toggle");

let ingredients = new Set();

function syncFindBtn() {
  findBtn.disabled = ingredients.size === 0;
  findBtn.textContent = ingredients.size > 0
    ? `🔍 Find Recipes (${ingredients.size} ingredient${ingredients.size > 1 ? "s" : ""})`
    : "🔍 Find Recipes";
}

function addIngredient(raw) {
  const parts = raw.split(",").map(s => s.trim().toLowerCase()).filter(Boolean);
  let added = 0;
  parts.forEach(val => {
    if (!val || val.length < 2 || ingredients.has(val)) return;
    ingredients.add(val);
    renderChip(val);
    added++;
  });
  ingInput.value = "";
  syncFindBtn();
  if (added) ingInput.focus();
}

function removeIngredient(val) {
  ingredients.delete(val);
  syncFindBtn();
  if (ingredients.size === 0) showWelcomeState();
}

function renderChip(val) {
  const chip = document.createElement("div");
  chip.className = "ingredient-chip";
  chip.setAttribute("role", "listitem");
  chip.innerHTML = `
    <span>${val}</span>
    <button class="chip-remove" aria-label="Remove ${val}" title="Remove">&times;</button>`;
  chip.querySelector(".chip-remove").addEventListener("click", () => {
    chip.style.transform = "scale(0)";
    chip.style.opacity = "0";
    chip.style.transition = "all 0.2s ease";
    setTimeout(() => { chip.remove(); removeIngredient(val); }, 200);
  });
  chipList.appendChild(chip);
}

function showWelcomeState() {
  matchResults.innerHTML = `
    <div class="welcome-state">
      <div class="welcome-grid">
        <div class="welcome-card glass-card">
          <div class="welcome-card__num">1</div>
          <div class="welcome-card__label">Add ingredients you have</div>
        </div>
        <div class="welcome-card glass-card">
          <div class="welcome-card__num">2</div>
          <div class="welcome-card__label">We find matching recipes</div>
        </div>
        <div class="welcome-card glass-card">
          <div class="welcome-card__num">3</div>
          <div class="welcome-card__label">Cook without shopping</div>
        </div>
      </div>
    </div>`;
}

addIngBtn.addEventListener("click", () => addIngredient(ingInput.value));

ingInput.addEventListener("keydown", e => {
  if (e.key === "Enter" || e.key === ",") {
    e.preventDefault();
    addIngredient(ingInput.value);
  }
});

// Expiry toggle — auto-fill from fridge
expiryToggle.addEventListener("change", async () => {
  if (!expiryToggle.checked) return;
  const names = await getExpiringIngredientNames(7);
  if (!names.length) {
    toastInfo("No items expiring within 7 days found in your fridge.");
    expiryToggle.checked = false;
    return;
  }
  // Clear existing & add
  ingredients.clear();
  chipList.innerHTML = "";
  names.forEach(n => { ingredients.add(n); renderChip(n); });
  syncFindBtn();
  toastSuccess(`Added ${names.length} expiring ingredient${names.length > 1 ? "s" : ""}!`);
});

// ─── Voice Input ──────────────────────────────────────────────────────────────
initVoiceInput({
  micBtnId: "voice-mic-btn",
  previewId: "voice-preview",
  onIngredients: (ings) => {
    ings.forEach(i => {
      if (!ingredients.has(i)) {
        ingredients.add(i);
        renderChip(i);
      }
    });
    syncFindBtn();
    toastSuccess(`🎤 Added: ${ings.join(", ")}`);
    track("voice");
    awardXP(15, "Voice ingredient input");
  },
});

// ─── Find recipes ─────────────────────────────────────────────────────────────
findBtn.addEventListener("click", async () => {
  if (!ingredients.size) return;

  const ings = [...ingredients];

  // Show loading
  matchResults.innerHTML = `
    <div class="loading-state">
      <div class="spinner"></div>
      <span>Searching ${ings.length} ingredient${ings.length > 1 ? "s" : ""} across 62,000+ recipes…</span>
    </div>`;

  findBtn.disabled = true;
  findBtn.textContent = "Searching…";

  try {
    const results = await api.matchRecipes(ings, 20);

    if (!results.length) {
      matchResults.innerHTML = `
        <div class="empty-state">
          <div class="empty-state__icon">🥲</div>
          <p>No recipes match those ingredients. Try removing one or two!</p>
        </div>`;
      toastWarn("No matches found. Try different ingredients.");
      return;
    }

    // Track for gamification
    track("match");
    awardXP(25, "Found recipe matches");

    const perfect = results.filter(r => r.match_score === 100).length;
    if (perfect > 0) {
      track("perfect");
      awardXP(30, "Perfect ingredient match!");
    }

    // Header
    const header = document.createElement("div");
    header.className = "match-results-header";
    header.innerHTML = `
      <h3>Found <strong>${results.length}</strong> matches</h3>
      <p class="match-results-subtext">
        ${perfect ? `✅ ${perfect} recipe${perfect > 1 ? "s" : ""} you can make right now · ` : ""}
        Sorted by ingredient overlap
      </p>`;

    const grid = document.createElement("div");
    grid.className = "recipe-grid";

    results.forEach(recipe => {
      const card = buildRecipeCard(recipe, { showMatch: true });
      card.addEventListener("click", () => openModal(recipe.id));
      card.addEventListener("keydown", e => { if (e.key === "Enter") openModal(recipe.id); });
      grid.appendChild(card);
    });

    matchResults.innerHTML = "";
    matchResults.appendChild(header);
    matchResults.appendChild(grid);
    toastSuccess(`Found ${results.length} recipes!`);

  } catch (err) {
    matchResults.innerHTML = `<p class="error-msg">Search failed: ${err.message}</p>`;
    toastError("Match failed: " + err.message);
  } finally {
    findBtn.disabled = false;
    syncFindBtn();
  }
});

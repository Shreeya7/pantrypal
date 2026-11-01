/* ════════════════════════════════════════════════════════
   planner.js — 7-Day Meal Planner + AI Planner
   ════════════════════════════════════════════════════════ */

import { api }        from "./api.js";
import { getEmoji }   from "./cards.js";
import { toastSuccess, toastError, toastInfo } from "./toast.js";
import { awardXP, track } from "./gamification.js";

const DAYS   = ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"];
const MEALS  = [
  { id: "breakfast", label: "Breakfast 🌅", icon: "🌅" },
  { id: "lunch",     label: "Lunch ☀️",     icon: "☀️" },
  { id: "dinner",    label: "Dinner 🌙",    icon: "🌙" },
];

function weekKey() {
  const now  = new Date();
  const week = Math.ceil(now.getDate() / 7);
  return `pantrypal_planner_${now.getFullYear()}_W${week}_${now.getMonth()}`;
}
function loadPlan() {
  try { return JSON.parse(localStorage.getItem(weekKey()) || "{}"); }
  catch { return {}; }
}
function savePlan(plan) { localStorage.setItem(weekKey(), JSON.stringify(plan)); }
function cellKey(day, meal) { return `${day}__${meal}`; }

// ─── Main render ──────────────────────────────────────────────────────────────
export function renderPlanner() {
  const container = document.getElementById("planner-container");
  if (!container) return;

  const plan        = loadPlan();
  const totalSlots  = DAYS.length * MEALS.length;
  const filledSlots = Object.keys(plan).length;
  const isFullWeek  = filledSlots === totalSlots;

  container.innerHTML = `
    <div class="planner-toolbar glass-card">
      <div class="planner-toolbar__left">
        <h2 class="planner-title">📅 This Week's Meal Plan</h2>
        <p class="planner-subtitle">${filledSlots}/${totalSlots} meals planned</p>
      </div>
      <div class="planner-toolbar__right">
        <button class="btn btn--ai planner-btn" id="planner-ai-btn">✨ AI Plan My Week</button>
        <button class="btn btn--ghost planner-btn" id="planner-clear-btn">🗑 Clear Week</button>
        <button class="btn btn--gold planner-btn" id="planner-shoplist-btn" ${filledSlots === 0 ? "disabled" : ""}>
          🛒 Shopping List
        </button>
      </div>
    </div>

    ${isFullWeek ? `<div class="planner-congrats">🎉 Full week planned! <strong>+150 XP earned.</strong></div>` : ""}

    <div class="planner-grid-wrap">
      <div class="planner-grid">
        <!-- Header row -->
        <div class="planner-corner"></div>
        ${DAYS.map(d => `<div class="planner-day-header">${d.slice(0,3)}</div>`).join("")}

        <!-- Meal rows -->
        ${MEALS.map(meal => `
          <div class="planner-meal-label">
            <span>${meal.icon}</span>
            <span>${meal.label.split(" ")[0]}</span>
          </div>
          ${DAYS.map(day => {
            const key    = cellKey(day, meal.id);
            const recipe = plan[key];
            return recipe
              ? `<div class="planner-cell planner-cell--filled" data-key="${key}" data-day="${day}" data-meal="${meal.id}">
                   <div class="planner-cell-emoji">${recipe.emoji || "🍽️"}</div>
                   <div class="planner-cell-name">${recipe.title}</div>
                   <button class="planner-cell-remove" data-key="${key}" title="Remove">✕</button>
                 </div>`
              : `<div class="planner-cell planner-cell--empty" data-key="${key}" data-day="${day}" data-meal="${meal.id}">
                   <span class="planner-add-icon">＋</span>
                 </div>`;
          }).join("")}
        `).join("")}
      </div>
    </div>`;

  // Wire events
  container.querySelectorAll(".planner-cell--empty").forEach(cell => {
    cell.addEventListener("click", () => openRecipePicker(cell.dataset.day, cell.dataset.meal));
  });
  container.querySelectorAll(".planner-cell-remove").forEach(btn => {
    btn.addEventListener("click", (e) => { e.stopPropagation(); removeFromPlan(btn.dataset.key); });
  });
  container.querySelectorAll(".planner-cell--filled").forEach(cell => {
    cell.addEventListener("click", (e) => {
      if (!e.target.classList.contains("planner-cell-remove")) {
        const r = loadPlan()[cell.dataset.key];
        if (r?.id) import("./modal.js").then(m => m.openModal(r.id));
      }
    });
  });

  document.getElementById("planner-clear-btn")?.addEventListener("click", () => {
    if (!confirm("Clear all planned meals for this week?")) return;
    savePlan({});
    renderPlanner();
    toastInfo("Week cleared.");
  });

  document.getElementById("planner-shoplist-btn")?.addEventListener("click", generateShoppingList);
  document.getElementById("planner-ai-btn")?.addEventListener("click", openAIPrefsModal);
}

// ─── Recipe picker popup ──────────────────────────────────────────────────────
function openRecipePicker(day, mealType) {
  const el = document.createElement("div");
  el.id = "recipe-picker-overlay";
  el.innerHTML = `
    <div class="picker-panel glass-card">
      <div class="picker-header">
        <h3>Add ${mealType} for ${day}</h3>
        <button class="modal-close" id="picker-close">✕</button>
      </div>
      <div class="picker-search-row">
        <input type="search" id="picker-search" class="field-input" placeholder="Search recipes…" autofocus />
      </div>
      <div id="picker-results" class="picker-results"></div>
    </div>`;
  document.body.appendChild(el);
  el.querySelector("#picker-close").addEventListener("click", () => el.remove());
  el.addEventListener("click", e => { if (e.target === el) el.remove(); });

  let timeout;
  const searchInput = el.querySelector("#picker-search");
  const resultsEl   = el.querySelector("#picker-results");

  async function search(q) {
    resultsEl.innerHTML = `<div class="loading-state"><div class="spinner"></div></div>`;
    try {
      const data = await api.getRecipes({ search: q || mealType, limit: 12 });
      if (!data.results.length) {
        resultsEl.innerHTML = `<p style="color:var(--c-text-3);padding:var(--s-4)">No results for "${q}"</p>`;
        return;
      }
      resultsEl.innerHTML = "";
      data.results.forEach(r => {
        const item = document.createElement("div");
        item.className = "picker-result-item";
        item.innerHTML = `
          <span class="picker-item-emoji">${getEmoji(r)}</span>
          <div class="picker-item-info">
            <div class="picker-item-name">${r.title}</div>
            <div class="picker-item-meta">
              ${r.cuisine ? `<span class="pill">${r.cuisine}</span>` : ""}
              ${r.prep_time ? `<span class="pill">⏱ ${r.prep_time + (r.cook_time || 0)} min</span>` : ""}
            </div>
          </div>`;
        item.addEventListener("click", () => {
          addToPlan(day, mealType, { id: r.id, title: r.title, emoji: getEmoji(r) });
          el.remove();
        });
        resultsEl.appendChild(item);
      });
    } catch { resultsEl.innerHTML = `<p class="error-msg">Search failed</p>`; }
  }

  searchInput.addEventListener("input", e => {
    clearTimeout(timeout);
    timeout = setTimeout(() => search(e.target.value.trim()), 300);
  });
  search(""); // load default results
}

// ─── All cuisines available in the DB ────────────────────────────────────────
// Sorted by recipe count (from actual DB query)
const DB_CUISINES = [
  { val: "",                  label: "✨ Any" },
  { val: "european",          label: "🇪🇺 European" },
  { val: "french",            label: "🇫🇷 French" },
  { val: "asian",             label: "🌏 Asian" },
  { val: "middle eastern region", label: "🕌 Middle Eastern" },
  { val: "korean",            label: "🇰🇷 Korean" },
  { val: "mediterranean",     label: "🌊 Mediterranean" },
  { val: "greek",             label: "🇬🇷 Greek" },
  { val: "american",          label: "🇺🇸 American" },
  { val: "italian",           label: "🇮🇹 Italian" },
  { val: "filipino",          label: "🇵🇭 Filipino" },
  { val: "thai",              label: "🇹🇭 Thai" },
  { val: "turkish",           label: "🇹🇷 Turkish" },
  { val: "chinese",           label: "🇨🇳 Chinese" },
  { val: "german",            label: "🇩🇪 German" },
  { val: "japanese",          label: "🇯🇵 Japanese" },
  { val: "caribbean",         label: "🌴 Caribbean" },
  { val: "vietnamese",        label: "🇻🇳 Vietnamese" },
  { val: "russian",           label: "🇷🇺 Russian" },
  { val: "latin american",    label: "🌎 Latin American" },
  { val: "african",           label: "🌍 African" },
  { val: "indian",            label: "🇮🇳 Indian" },
  { val: "british",           label: "🇬🇧 British" },
  { val: "spanish",           label: "🇪🇸 Spanish" },
  { val: "mexican",           label: "🇲🇽 Mexican" },
];

// ─── AI Meal Planner — Preferences Modal ──────────────────────────────────────
function openAIPrefsModal() {
  const el = document.createElement("div");
  el.id = "ai-planner-overlay";
  el.innerHTML = `
    <div class="ai-planner-modal glass-card">
      <div class="ai-modal-header">
        <div class="ai-modal-title">
          <span class="ai-modal-icon">✨</span>
          <h3>AI Meal Planner</h3>
        </div>
        <button class="modal-close" id="ai-modal-close">✕</button>
      </div>
      <p class="ai-modal-sub">Tell me your preferences and I'll plan your whole week using recipes from our database, prioritising your fridge ingredients.</p>

      <div class="ai-prefs-form">
        <div class="ai-pref-group">
          <label class="ai-pref-label">🥦 Dietary Preference</label>
          <div class="ai-pref-chips" id="pref-diet">
            <button class="ai-chip active" data-val="any">✨ Any</button>
            <button class="ai-chip" data-val="vegetarian">🥗 Vegetarian</button>
            <button class="ai-chip" data-val="vegan">🌿 Vegan</button>
            <button class="ai-chip" data-val="gluten_free">🌾 Gluten-Free</button>
          </div>
        </div>

        <div class="ai-pref-group">
          <label class="ai-pref-label">🌍 Cuisine Style</label>
          <div class="ai-pref-chips ai-pref-chips--wrap" id="pref-cuisine">
            ${DB_CUISINES.map((c, i) =>
              `<button class="ai-chip ${i === 0 ? "active" : ""}" data-val="${c.val}">${c.label}</button>`
            ).join("")}
          </div>
        </div>

        <div class="ai-pref-group">
          <label class="ai-pref-label">⏱ Cook Time per Meal</label>
          <div class="ai-pref-chips" id="pref-time">
            <button class="ai-chip active" data-val="any">⚡ Any</button>
            <button class="ai-chip" data-val="quick">🏃 Quick (&lt;30 min)</button>
            <button class="ai-chip" data-val="medium">👨‍🍳 Medium (30–60 min)</button>
            <button class="ai-chip" data-val="slow">🐌 Slow (60+ min)</button>
          </div>
        </div>

        <div class="ai-pref-group">
          <label class="ai-pref-label">👨‍👩‍👧 Servings</label>
          <div class="ai-servings-row">
            <button class="ai-servings-btn" id="servings-minus">−</button>
            <span id="servings-val" class="ai-servings-num">2</span>
            <button class="ai-servings-btn" id="servings-plus">+</button>
            <span style="font-size:0.72rem;color:var(--c-text-4)">people</span>
          </div>
        </div>

        <label class="ai-pref-fridge-toggle">
          <input type="checkbox" id="ai-use-fridge" checked />
          <span class="ai-pref-label">🧊 Prioritise my current fridge ingredients</span>
        </label>
      </div>

      <div class="ai-modal-actions">
        <button class="btn btn--ghost" id="ai-cancel-btn">Cancel</button>
        <button class="btn btn--ai btn--lg" id="ai-generate-btn">✨ Generate My Week</button>
      </div>
    </div>`;

  document.body.appendChild(el);

  el.querySelector("#ai-modal-close").addEventListener("click", () => el.remove());
  el.querySelector("#ai-cancel-btn").addEventListener("click",  () => el.remove());
  el.addEventListener("click", e => { if (e.target === el) el.remove(); });

  // Single-select chip groups
  el.querySelectorAll(".ai-pref-chips").forEach(group => {
    group.querySelectorAll(".ai-chip").forEach(chip => {
      chip.addEventListener("click", () => {
        group.querySelectorAll(".ai-chip").forEach(c => c.classList.remove("active"));
        chip.classList.add("active");
      });
    });
  });

  // Servings counter
  let servings = 2;
  const servingsEl = el.querySelector("#servings-val");
  el.querySelector("#servings-minus").addEventListener("click", () => {
    if (servings > 1) servingsEl.textContent = --servings;
  });
  el.querySelector("#servings-plus").addEventListener("click", () => {
    if (servings < 10) servingsEl.textContent = ++servings;
  });

  // Generate
  el.querySelector("#ai-generate-btn").addEventListener("click", async () => {
    const prefs = {
      diet:      el.querySelector("#pref-diet .ai-chip.active")?.dataset.val    || "any",
      cuisine:   el.querySelector("#pref-cuisine .ai-chip.active")?.dataset.val || "",
      time:      el.querySelector("#pref-time .ai-chip.active")?.dataset.val    || "any",
      servings,
      useFridge: el.querySelector("#ai-use-fridge")?.checked ?? true,
    };
    el.remove();
    await runAIPlanner(prefs);
  });
}

// ─── AI Planner engine ────────────────────────────────────────────────────────
async function runAIPlanner(prefs) {
  const container = document.getElementById("planner-container");

  // Progress overlay
  const overlay = document.createElement("div");
  overlay.className = "ai-planning-overlay";
  overlay.innerHTML = `
    <div class="ai-planning-card glass-card">
      <div class="ai-planning-icon">✨</div>
      <h3>Planning your week…</h3>
      <p id="ai-progress-text">Starting…</p>
      <div class="ai-progress-bar"><div class="ai-progress-fill" id="ai-progress-fill"></div></div>
    </div>`;
  document.body.appendChild(overlay);

  const setProgress = (pct, text) => {
    const fill = document.getElementById("ai-progress-fill");
    const txt  = document.getElementById("ai-progress-text");
    if (fill) fill.style.width = pct + "%";
    if (txt)  txt.textContent  = text;
  };

  try {
    // ── Step 1: Build API params from prefs ───────────────────────────────────
    const apiParams = { limit: 100 };
    if (prefs.cuisine)              apiParams.cuisine = prefs.cuisine;
    if (prefs.diet === "vegan")     apiParams.diet    = "vegan";
    if (prefs.diet === "vegetarian") apiParams.diet   = "vegetarian";
    if (prefs.diet === "gluten_free") apiParams.diet  = "gluten";

    // ── Step 2: Fetch two pages = up to 200 recipes as primary pool ───────────
    setProgress(15, `Finding ${prefs.cuisine || "all cuisine"} recipes…`);
    const [page1, page2] = await Promise.all([
      api.getRecipes({ ...apiParams, offset: 0   }).catch(() => ({ results: [] })),
      api.getRecipes({ ...apiParams, offset: 100 }).catch(() => ({ results: [] })),
    ]);
    let pool = [...(page1.results || []), ...(page2.results || [])];

    if (!pool.length) {
      // Fallback: fetch without cuisine/diet filter
      setProgress(25, "No exact matches — broadening search…");
      const fallback = await api.getRecipes({ limit: 100, offset: 0 }).catch(() => ({ results: [] }));
      pool = fallback.results || [];
    }

    // ── Step 3: Optionally boost fridge-matching recipes to front ─────────────
    if (prefs.useFridge) {
      setProgress(40, "Checking your fridge…");
      const fridge = await api.getInventory().catch(() => []);
      const fridgeIng = fridge.map(i => i.name.toLowerCase());

      if (fridgeIng.length > 0) {
        setProgress(55, "Matching fridge ingredients to recipes…");
        // Get fridge-matched recipes (up to 60, don't care if empty)
        const matched = await api.matchRecipes(fridgeIng, 60).catch(() => []);

        if (matched.length > 0) {
          // Filter matched by cuisine preference if one was chosen
          let boosted = matched;
          if (prefs.cuisine) {
            boosted = matched.filter(r =>
              (r.cuisines || []).some(c => c.includes(prefs.cuisine)) ||
              (r.cuisine || "").toLowerCase().includes(prefs.cuisine)
            );
            if (!boosted.length) boosted = matched; // don't filter too aggressively
          }
          // Apply diet filter to matches
          if (prefs.diet === "vegan")      boosted = boosted.filter(r => (r.dietary_tags || []).includes("vegan"));
          if (prefs.diet === "vegetarian") boosted = boosted.filter(r => (r.dietary_tags || []).some(t => t.includes("vegetarian")));

          // Merge: boosted first, then remaining pool (deduplicated)
          const boostedIds = new Set(boosted.map(r => r.id));
          pool = [...boosted, ...pool.filter(r => !boostedIds.has(r.id))];
        }
      }
    }

    setProgress(70, "Applying cook time filter…");

    // ── Step 4: Cook time filter ───────────────────────────────────────────────
    if (prefs.time !== "any") {
      const maxTime = prefs.time === "quick" ? 30 : prefs.time === "medium" ? 60 : 9999;
      const filtered = pool.filter(r => {
        const total = (r.prep_time || 0) + (r.cook_time || 0);
        return total === 0 || total <= maxTime; // 0 = unknown time, keep it
      });
      if (filtered.length >= 21) pool = filtered;
    }

    // ── Step 5: Deduplicate ────────────────────────────────────────────────────
    const seen = new Set();
    pool = pool.filter(r => { if (seen.has(r.id)) return false; seen.add(r.id); return true; });

    if (pool.length < 21) {
      // Still not enough — pad with general recipes
      setProgress(80, "Padding with extra recipes…");
      const pad = await api.getRecipes({ limit: 100, offset: Math.floor(Math.random() * 500) }).catch(() => ({ results: [] }));
      (pad.results || []).forEach(r => { if (!seen.has(r.id)) { seen.add(r.id); pool.push(r); } });
    }

    setProgress(85, "Shuffling for variety…");

    // ── Step 6: Shuffle for variety (Fisher-Yates) ────────────────────────────
    // Keep top fridge-matches at front (first 10) if we have them, shuffle rest
    const frontSlice  = pool.slice(0, Math.min(10, pool.length));
    const restSlice   = pool.slice(10);
    for (let i = restSlice.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [restSlice[i], restSlice[j]] = [restSlice[j], restSlice[i]];
    }
    pool = [...frontSlice, ...restSlice];

    setProgress(95, "Filling your weekly grid…");

    // ── Step 7: Fill empty grid slots ─────────────────────────────────────────
    const plan = loadPlan();
    let   idx  = 0;
    for (const day of DAYS) {
      for (const meal of MEALS) {
        const key = cellKey(day, meal.id);
        if (plan[key]) continue; // preserve manually set slots
        if (idx < pool.length) {
          const r = pool[idx++];
          plan[key] = { id: r.id, title: r.title, emoji: getEmoji(r) };
        }
      }
    }

    savePlan(plan);
    setProgress(100, "Done! 🎉");

    setTimeout(() => {
      overlay.remove();
      renderPlanner();
      toastSuccess("✨ AI planned your full week! +50 XP");
      awardXP(50, "AI meal plan generated");
      track("ai_planner");
    }, 600);

  } catch (err) {
    overlay.remove();
    toastError("AI planner failed: " + err.message);
  }
}

// ─── Plan mutations ───────────────────────────────────────────────────────────
function addToPlan(day, meal, recipe) {
  const plan = loadPlan();
  plan[cellKey(day, meal)] = recipe;
  savePlan(plan);
  const filled = Object.keys(plan).length;
  awardXP(10, `Planned ${meal} for ${day}`);
  if (filled === DAYS.length * MEALS.length) {
    track("planner_full");
    awardXP(100, "Full week planned!");
    toastSuccess("🎉 Full week planned! +100 XP bonus!");
  }
  renderPlanner();
  toastSuccess(`Added "${recipe.title}" to ${day} ${meal}`);
}

function removeFromPlan(key) {
  const plan = loadPlan();
  delete plan[key];
  savePlan(plan);
  renderPlanner();
}

// ─── Shopping list ────────────────────────────────────────────────────────────
async function generateShoppingList() {
  const plan      = loadPlan();
  const recipeIds = [...new Set(Object.values(plan).map(r => r.id).filter(Boolean))];
  if (!recipeIds.length) { toastInfo("No recipes planned yet."); return; }

  const btn = document.getElementById("planner-shoplist-btn");
  btn.disabled = true; btn.textContent = "Generating…";

  try {
    const recipes = await Promise.all(recipeIds.map(id => api.getRecipe(id).catch(() => null)));
    const allIngredients = new Map();
    recipes.filter(Boolean).forEach(r => {
      (r.ingredients || []).forEach(ing => {
        const key = ing.toLowerCase().trim();
        if (key) allIngredients.set(key, (allIngredients.get(key) || 0) + 1);
      });
    });

    const fridge      = await api.getInventory().catch(() => []);
    const fridgeNames = new Set(fridge.map(i => i.name.toLowerCase().trim()));

    const haveList = [], needList = [];
    for (const [ing, count] of allIngredients.entries()) {
      const inFridge = [...fridgeNames].some(f =>
        f.includes(ing.split(" ")[0]) || ing.includes(f.split(" ")[0])
      );
      (inFridge ? haveList : needList).push({ ing, count });
    }

    // Save to grocery list
    const { addToGrocery } = await import("./grocery.js");
    needList.forEach(({ ing }) => addToGrocery(ing, "", "meal-plan"));

    // Download
    const weekLabel = `Week of ${new Date().toLocaleDateString("en-IN", { day:"numeric", month:"short" })}`;
    const lines = [
      `🛒 PantryPal Shopping List — ${weekLabel}`,
      `Covering ${recipeIds.length} planned recipe${recipeIds.length > 1 ? "s" : ""}`,
      "",
      `✅ ALREADY IN FRIDGE (${haveList.length} items):`,
      ...haveList.map(({ ing }) => `  ✓ ${ing}`),
      "",
      `🛒 NEED TO BUY (${needList.length} items):`,
      ...needList.map(({ ing }) => `  • ${ing}`),
    ];
    const blob = new Blob([lines.join("\n")], { type: "text/plain" });
    const url  = URL.createObjectURL(blob);
    const a    = Object.assign(document.createElement("a"), {
      href: url, download: `pantrypal_shopping_${weekLabel.replace(/\s/g,"_")}.txt`,
    });
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);

    toastSuccess(`🛒 ${needList.length} items added to Grocery List & downloaded!`);
    awardXP(20, "Generated shopping list");
  } catch (err) {
    toastError("Failed: " + err.message);
  } finally {
    btn.disabled = false;
    btn.textContent = "🛒 Shopping List";
  }
}

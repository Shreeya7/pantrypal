/* ════════════════════════════════════════════════════════
   modal.js — Premium Recipe Detail Modal
   (with Favorites, Shopping List, Cooking Mode)
   ════════════════════════════════════════════════════════ */

import { api }        from "./api.js";
import { getEmoji }   from "./cards.js";
import { toastError, toastSuccess, toastInfo } from "./toast.js";
import { favorites }  from "./favorites.js";

const dialog = document.getElementById("recipe-modal");

function getHealthColor(score) {
  if (!score) return "var(--c-text-3)";
  if (score >= 70) return "var(--c-green)";
  if (score >= 45) return "var(--c-amber)";
  return "var(--c-red)";
}

function isIndian(recipe) {
  return (recipe.cuisine || "").toLowerCase().includes("indian") || recipe.category === "Indian";
}

// ─── Shopping list generator ──────────────────────────────────────────────────
function openShoppingList(recipe) {
  const ings = recipe.ingredients || [];
  if (!ings.length) { toastInfo("No ingredient list for this recipe."); return; }

  const items = ings.map(i => `• ${i}`).join("\n");
  const blob  = new Blob([`Shopping List — ${recipe.title}\n\n${items}`], { type: "text/plain" });
  const url   = URL.createObjectURL(blob);
  const a     = Object.assign(document.createElement("a"), {
    href: url,
    download: `${recipe.title.replace(/\s+/g, "_")}_shopping_list.txt`,
  });
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  toastSuccess("🛒 Shopping list downloaded!");
}

// ─── Cooking Mode ─────────────────────────────────────────────────────────────
function openCookingMode(recipe) {
  const dirs = recipe.directions || [];
  if (!dirs.length) { toastInfo("No instructions available for cooking mode."); return; }

  let current = 0;

  const cookEl = document.createElement("div");
  cookEl.id = "cooking-mode";
  cookEl.setAttribute("role", "dialog");
  cookEl.setAttribute("aria-modal", "true");
  cookEl.setAttribute("aria-label", `Cooking mode: ${recipe.title}`);

  function renderStep() {
    const total  = dirs.length;
    const step   = dirs[current];
    const pct    = Math.round(((current + 1) / total) * 100);

    cookEl.innerHTML = `
      <div class="cook-overlay">
        <div class="cook-header">
          <div class="cook-title-row">
            <span class="cook-emoji">${getEmoji(recipe)}</span>
            <div>
              <div class="cook-recipe-name">${recipe.title}</div>
              <div class="cook-step-label">Step ${current + 1} of ${total}</div>
            </div>
          </div>
          <button class="cook-exit" id="cook-exit-btn" aria-label="Exit cooking mode">✕ Exit</button>
        </div>

        <div class="cook-progress-bar">
          <div class="cook-progress-fill" style="width:${pct}%"></div>
        </div>

        <div class="cook-body">
          <div class="cook-step-num">${current + 1}</div>
          <p class="cook-step-text">${step}</p>
        </div>

        <div class="cook-footer">
          <button class="btn btn--ghost cook-nav-btn" id="cook-prev" ${current === 0 ? "disabled" : ""}>
            ← Prev
          </button>
          <div class="cook-dots">
            ${dirs.map((_, i) => `<span class="cook-dot ${i === current ? "active" : i < current ? "done" : ""}"></span>`).join("")}
          </div>
          ${current < total - 1
            ? `<button class="btn btn--gold cook-nav-btn" id="cook-next">Next →</button>`
            : `<button class="btn btn--green cook-nav-btn" id="cook-done">🎉 Done!</button>`}
        </div>
      </div>`;

    cookEl.querySelector("#cook-exit-btn").addEventListener("click", () => cookEl.remove());
    const prev = cookEl.querySelector("#cook-prev");
    if (prev) prev.addEventListener("click", () => { current--; renderStep(); });
    const next = cookEl.querySelector("#cook-next");
    if (next) next.addEventListener("click", () => { current++; renderStep(); });
    const done = cookEl.querySelector("#cook-done");
    if (done) done.addEventListener("click", () => {
      cookEl.remove();
      toastSuccess("🎉 Recipe complete! Enjoy your meal!");
    });
  }

  // Keyboard nav
  function onKey(e) {
    if (e.key === "ArrowRight" && current < dirs.length - 1) { current++; renderStep(); }
    if (e.key === "ArrowLeft"  && current > 0)              { current--; renderStep(); }
    if (e.key === "Escape")                                  { cookEl.remove(); document.removeEventListener("keydown", onKey); }
  }
  document.addEventListener("keydown", onKey);
  cookEl.addEventListener("remove", () => document.removeEventListener("keydown", onKey));

  renderStep();
  document.body.appendChild(cookEl);
}

// ─── Main modal ───────────────────────────────────────────────────────────────
export async function openModal(recipeId) {
  dialog.innerHTML = `
    <div class="modal-inner">
      <button class="modal-close" id="modal-close-btn" aria-label="Close">✕</button>
      <div class="modal-loader">
        <div class="spinner"></div>
        <p style="color:var(--c-text-3);font-size:0.875rem">Loading recipe…</p>
      </div>
    </div>`;
  dialog.showModal();
  dialog.querySelector("#modal-close-btn").addEventListener("click", closeModal);

  try {
    const r = await api.getRecipe(recipeId);
    renderModal(r);
  } catch (err) {
    dialog.innerHTML = `
      <div class="modal-inner">
        <button class="modal-close" id="modal-close-btn" aria-label="Close">✕</button>
        <div class="modal-error">
          <div style="font-size:2.5rem">😕</div>
          <p class="error-msg">Couldn't load recipe. ${err.message}</p>
          <button class="btn btn--ghost" onclick="document.getElementById('recipe-modal').close()">Close</button>
        </div>
      </div>`;
    dialog.querySelector("#modal-close-btn").addEventListener("click", closeModal);
    toastError("Failed to load recipe details");
  }
}

function renderModal(r) {
  const emoji    = getEmoji(r);
  const indian   = isIndian(r);
  const totalMin = (r.prep_time || 0) + (r.cook_time || 0);
  const health   = r.healthiness;
  const diet     = (r.dietary_tags || []);
  const isFav    = favorites.has(r.id);

  const dietPills = diet.map(d => {
    const icons = { vegan:"🌿", vegetarian:"🥦", gluten_free:"🌾", nut_free:"🥜",
                    dairy_free:"🥛", halal:"☪️", kosher:"✡️", "non-vegetarian":"🍖", eggetarian:"🥚" };
    return `<span class="pill">${icons[d.toLowerCase()] || ""} ${d.replace(/_/g," ")}</span>`;
  }).join("");

  const ings = (r.ingredients || []);
  const ingsHtml = ings.length
    ? `<div class="ing-grid">${ings.map(i =>
        `<div class="ing-item"><span class="ing-check">●</span>${i}</div>`
      ).join("")}</div>`
    : `<p style="color:var(--c-text-3);font-size:0.85rem">No ingredients listed.</p>`;

  const dirs = (r.directions || []);
  const dirsHtml = dirs.length
    ? `<ol class="step-list">${dirs.map((step, i) =>
        `<li class="step-item">
           <div class="step-num">${i + 1}</div>
           <p class="step-text">${step}</p>
         </li>`
      ).join("")}</ol>`
    : `<p style="color:var(--c-text-3);font-size:0.85rem">No instructions listed.</p>`;

  dialog.innerHTML = `
    <div class="modal-inner">
      <button class="modal-close" id="modal-close-btn" aria-label="Close">✕</button>

      <div class="modal-hero">
        <div class="modal-emoji-wrap">${emoji}</div>
        <div class="modal-header-info">
          <h2 class="modal-title">${r.title}</h2>
          <div class="modal-pills">
            ${indian ? `<span class="cuisine-badge india-badge">🇮🇳 Indian</span>` : ""}
            ${r.cuisine && !indian ? `<span class="cuisine-badge">${r.cuisine}</span>` : ""}
            ${r.course     ? `<span class="pill">${r.course}</span>`     : ""}
            ${r.difficulty ? `<span class="pill">${r.difficulty}</span>` : ""}
            ${dietPills}
          </div>
          <div class="modal-stats">
            ${r.prep_time != null ? `<div><div class="modal-stat__val">${r.prep_time}</div><div class="modal-stat__key">Prep (min)</div></div>` : ""}
            ${r.cook_time != null ? `<div><div class="modal-stat__val">${r.cook_time}</div><div class="modal-stat__key">Cook (min)</div></div>` : ""}
            ${totalMin > 0 ? `<div><div class="modal-stat__val">${totalMin}</div><div class="modal-stat__key">Total (min)</div></div>` : ""}
            ${ings.length ? `<div><div class="modal-stat__val">${ings.length}</div><div class="modal-stat__key">Ingredients</div></div>` : ""}
            ${health != null ? `<div><div class="modal-stat__val" style="color:${getHealthColor(health)}">${Math.round(health)}</div><div class="modal-stat__key">Health Score</div></div>` : ""}
          </div>

          <!-- Action buttons -->
          <div class="modal-actions">
            <button class="btn btn--gold modal-action-btn" id="cook-mode-btn" ${!dirs.length ? "disabled" : ""}>
              👨‍🍳 Cook Now
            </button>
            <button class="btn btn--ghost modal-action-btn" id="shopping-btn" ${!ings.length ? "disabled" : ""}>
              🛒 Shopping List
            </button>
            <button class="btn btn--ghost modal-action-btn fav-btn ${isFav ? "fav-btn--active" : ""}" id="fav-btn">
              ${isFav ? "⭐ Saved" : "☆ Save"}
            </button>
          </div>
        </div>
      </div>

      <div class="modal-body">
        <section>
          <div class="section-heading">Ingredients <span class="section-count">${ings.length}</span></div>
          ${ingsHtml}
        </section>
        <section>
          <div class="section-heading">Instructions <span class="section-count">${dirs.length} steps</span></div>
          ${dirsHtml}
        </section>
      </div>
    </div>`;

  // Wiring
  dialog.querySelector("#modal-close-btn").addEventListener("click", closeModal);

  dialog.querySelector("#cook-mode-btn").addEventListener("click", () => {
    closeModal();
    openCookingMode(r);
  });

  dialog.querySelector("#shopping-btn").addEventListener("click", () => openShoppingList(r));

  const favBtn = dialog.querySelector("#fav-btn");
  favBtn.addEventListener("click", () => {
    const added = favorites.toggle(r);
    favBtn.textContent  = added ? "⭐ Saved" : "☆ Save";
    favBtn.classList.toggle("fav-btn--active", added);
    toastSuccess(added ? `⭐ Saved "${r.title}"` : `Removed from favorites`);
  });
}

function closeModal() { dialog.close(); }

dialog.addEventListener("click", e => { if (e.target === dialog) closeModal(); });
dialog.addEventListener("cancel", () => closeModal());

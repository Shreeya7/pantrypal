/* ════════════════════════════════════════════════════════
   grocery.js — Persistent Grocery List
   ════════════════════════════════════════════════════════ */

import { api }        from "./api.js";
import { toastSuccess, toastError, toastInfo } from "./toast.js";
import { awardXP }    from "./gamification.js";

const STORE_KEY = "pantrypal_grocery_list";
let _idCounter  = Date.now();

// ─── State helpers ─────────────────────────────────────────────────────────────
export function loadGrocery() {
  try { return JSON.parse(localStorage.getItem(STORE_KEY) || "[]"); }
  catch { return []; }
}
function saveGrocery(list) { localStorage.setItem(STORE_KEY, JSON.stringify(list)); }

export function addToGrocery(name, qty = "", source = "manual") {
  if (!name?.trim()) return;
  const list = loadGrocery();
  const norm = name.trim().toLowerCase();
  // De-duplicate
  if (list.some(i => i.name.toLowerCase() === norm)) return;
  list.push({ id: ++_idCounter, name: name.trim(), qty, source, bought: false, addedAt: Date.now() });
  saveGrocery(list);
  renderGrocery();
}

export function removeFromGrocery(id) {
  const list = loadGrocery().filter(i => i.id !== id);
  saveGrocery(list);
  renderGrocery();
}

export function toggleBought(id) {
  const list = loadGrocery().map(i => i.id === id ? { ...i, bought: !i.bought } : i);
  saveGrocery(list);
  renderGrocery();
}

// ─── Render the grocery panel ─────────────────────────────────────────────────
export function renderGrocery() {
  const container = document.getElementById("grocery-container");
  if (!container) return;

  const list    = loadGrocery();
  const bought  = list.filter(i => i.bought);
  const pending = list.filter(i => !i.bought);

  container.innerHTML = `
    <div class="grocery-toolbar glass-card">
      <div class="grocery-toolbar__left">
        <h2 class="grocery-title">🛒 Grocery List</h2>
        <p class="grocery-subtitle">${pending.length} to buy · ${bought.length} done</p>
      </div>
      <div class="grocery-toolbar__right">
        <button class="btn btn--amber grocery-btn" id="grocery-add-expiring-btn">
          🔥 Add Expiring Items
        </button>
        <button class="btn btn--ghost grocery-btn" id="grocery-clear-bought-btn" ${!bought.length ? "disabled":""}>
          ✅ Clear Bought
        </button>
        <button class="btn btn--gold grocery-btn" id="grocery-download-btn" ${!list.length ? "disabled":""}>
          ⬇ Download
        </button>
      </div>
    </div>

    <!-- Add custom item -->
    <div class="grocery-add-row glass-card">
      <span class="grocery-add-icon">＋</span>
      <input type="text" id="grocery-custom-input" class="field-input grocery-custom-input"
             placeholder="Add item… (e.g. oat milk, 2 tomatoes)" />
      <input type="text" id="grocery-qty-input" class="field-input grocery-qty-input"
             placeholder="Qty" />
      <button class="btn btn--green" id="grocery-add-btn">Add</button>
    </div>

    <!-- Items list -->
    <div class="grocery-list" id="grocery-list-el">
      ${!list.length ? `
        <div class="empty-state">
          <div class="empty-state__icon">🛒</div>
          <p>Your grocery list is empty.<br>Add items manually or import from your expiring fridge items!</p>
        </div>` : `
        ${pending.length ? `
          <div class="grocery-section-label">🛒 To Buy (${pending.length})</div>
          ${pending.map(item => groceryItemHTML(item)).join("")}` : ""}
        ${bought.length ? `
          <div class="grocery-section-label bought-label">✅ Done (${bought.length})</div>
          ${bought.map(item => groceryItemHTML(item)).join("")}` : ""}
      `}
    </div>`;

  // Wire add
  const customInput = container.querySelector("#grocery-custom-input");
  const qtyInput    = container.querySelector("#grocery-qty-input");
  container.querySelector("#grocery-add-btn").addEventListener("click", () => {
    const name = customInput.value.trim();
    if (!name) { customInput.focus(); return; }
    addToGrocery(name, qtyInput.value.trim(), "manual");
    customInput.value = "";
    qtyInput.value    = "";
    customInput.focus();
    toastSuccess(`Added "${name}" to grocery list`);
  });
  customInput.addEventListener("keydown", e => {
    if (e.key === "Enter") container.querySelector("#grocery-add-btn").click();
  });

  // Wire "Add expiring items"
  container.querySelector("#grocery-add-expiring-btn").addEventListener("click", addExpiringItems);

  // Wire "Clear bought"
  container.querySelector("#grocery-clear-bought-btn")?.addEventListener("click", () => {
    const filtered = loadGrocery().filter(i => !i.bought);
    saveGrocery(filtered);
    renderGrocery();
    toastInfo("Cleared bought items.");
  });

  // Wire download
  container.querySelector("#grocery-download-btn")?.addEventListener("click", downloadGrocery);

  // Wire item interactions (check / delete)
  container.querySelectorAll(".grocery-item").forEach(el => {
    const id = parseInt(el.dataset.id, 10);
    el.querySelector(".grocery-check")?.addEventListener("click", () => toggleBought(id));
    el.querySelector(".grocery-del")?.addEventListener("click", () => removeFromGrocery(id));
  });
}

function groceryItemHTML(item) {
  const sourceTag = item.source === "expiring"   ? `<span class="grocery-tag grocery-tag--expiring">🔥 Expiring</span>`
                  : item.source === "meal-plan"  ? `<span class="grocery-tag grocery-tag--plan">📅 Meal Plan</span>`
                  : "";
  return `
    <div class="grocery-item glass-card ${item.bought ? "grocery-item--bought" : ""}" data-id="${item.id}">
      <button class="grocery-check ${item.bought ? "checked" : ""}" aria-label="${item.bought ? "Mark as not bought" : "Mark as bought"}">
        ${item.bought ? "✅" : "⬜"}
      </button>
      <div class="grocery-item__info">
        <span class="grocery-item__name">${item.name}</span>
        ${item.qty ? `<span class="grocery-item__qty">${item.qty}</span>` : ""}
        ${sourceTag}
      </div>
      <button class="grocery-del" aria-label="Remove ${item.name}">✕</button>
    </div>`;
}

// ─── Add expiring fridge items ─────────────────────────────────────────────────
async function addExpiringItems() {
  const btn = document.getElementById("grocery-add-expiring-btn");
  if (btn) { btn.disabled = true; btn.textContent = "Loading…"; }

  try {
    const items = await api.getExpiring(5); // within 5 days
    if (!items.length) {
      toastInfo("No items expiring within 5 days 🎉");
      return;
    }
    let added = 0;
    items.forEach(item => {
      const list = loadGrocery();
      const norm = item.name.toLowerCase();
      if (!list.some(i => i.name.toLowerCase() === norm)) {
        list.push({
          id: ++_idCounter,
          name: item.name,
          qty: item.quantity || "",
          source: "expiring",
          bought: false,
          addedAt: Date.now(),
          daysLeft: item.days_remaining,
        });
        saveGrocery(list);
        added++;
      }
    });
    renderGrocery();
    if (added) {
      toastSuccess(`Added ${added} expiring item${added > 1 ? "s" : ""} to your grocery list!`);
      awardXP(15, "Added expiring items to grocery list");
    } else {
      toastInfo("All expiring items already in your list.");
    }
  } catch (err) {
    toastError("Could not fetch expiring items: " + err.message);
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = "🔥 Add Expiring Items"; }
  }
}

// ─── Download ─────────────────────────────────────────────────────────────────
function downloadGrocery() {
  const list    = loadGrocery();
  const pending = list.filter(i => !i.bought);
  const bought  = list.filter(i => i.bought);
  const date    = new Date().toLocaleDateString("en-IN", { day:"numeric", month:"short", year:"numeric" });

  const lines = [
    `🛒 PantryPal Grocery List — ${date}`,
    "",
    `📋 TO BUY (${pending.length}):`,
    ...pending.map(i => `  • ${i.name}${i.qty ? "  " + i.qty : ""}${i.source === "expiring" ? "  ⚠️ expiring" : ""}`),
    "",
    `✅ ALREADY BOUGHT (${bought.length}):`,
    ...bought.map(i => `  ✓ ${i.name}${i.qty ? "  " + i.qty : ""}`),
  ];

  const blob = new Blob([lines.join("\n")], { type: "text/plain" });
  const url  = URL.createObjectURL(blob);
  const a    = Object.assign(document.createElement("a"), {
    href: url, download: `pantrypal_grocery_${date.replace(/\s/g,"_")}.txt`,
  });
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
  toastSuccess("Grocery list downloaded!");
}

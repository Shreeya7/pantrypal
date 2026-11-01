/* ════════════════════════════════════════════════════════
   inventory.js — Fridge expiry tracker + expiry notifications
   ════════════════════════════════════════════════════════ */

import { api }        from "./api.js";
import { toastSuccess, toastError, toastWarn } from "./toast.js";

const listEl    = document.getElementById("fridge-list");
const banner    = document.getElementById("expiry-banner");
const addForm   = document.getElementById("add-item-form");

// Category → emoji map
const CAT_ICONS = {
  meat: "🥩", chicken: "🍗", fish: "🐟", vegetable: "🥦", fruit: "🍎",
  dairy: "🧀", egg: "🥚", grain: "🌾", bread: "🍞", spice: "🌶️",
  frozen: "🧊", other: "📦", "": "🫙",
};

// ─── Load & Render ────────────────────────────────────────────────────────────

export async function loadInventory() {
  listEl.innerHTML = `<div class="loading-state"><div class="spinner"></div><span>Loading fridge…</span></div>`;

  try {
    const items = await api.getInventory();
    renderInventory(items);
    loadExpiringBanner();
    checkExpiryNotification(); // global header notification
  } catch (err) {
    listEl.innerHTML = `<p class="error-msg">Failed to load fridge items. Is the backend running?</p>`;
    toastError("Could not load inventory");
  }
}

function renderInventory(items) {
  if (!items.length) {
    listEl.innerHTML = `
      <div class="empty-state">
        <div class="empty-state__icon">🧊</div>
        <p>Your fridge is empty. Add your first item!</p>
      </div>`;
    return;
  }

  // Sort: critical first, then by days remaining
  items.sort((a, b) => {
    const urgencyOrder = { expired: 0, critical: 1, warning: 2, ok: 3 };
    const au = urgencyOrder[a.urgency] ?? 3;
    const bu = urgencyOrder[b.urgency] ?? 3;
    return au !== bu ? au - bu : (a.days_remaining ?? 999) - (b.days_remaining ?? 999);
  });

  listEl.innerHTML = "";
  items.forEach(item => listEl.appendChild(buildItemEl(item)));
}

function buildItemEl(item) {
  const icon       = CAT_ICONS[item.category || ""] ?? "🫙";
  const urgency    = item.urgency || "ok";
  const days       = item.days_remaining;
  const expiryDate = item.expires_at
    ? new Date(item.expires_at).toLocaleDateString("en-IN", { day:"numeric", month:"short" })
    : null;

  let daysLabel = "", daysColor = "var(--c-green)";
  if (urgency === "expired") { daysLabel = "Expired"; daysColor = "var(--c-red)"; }
  else if (days != null) {
    if (days === 0)      { daysLabel = "Today!";    daysColor = "var(--c-red)"; }
    else if (days === 1) { daysLabel = "Tomorrow";  daysColor = "var(--c-red)"; }
    else                 { daysLabel = `${days}d left`; }
    if (urgency === "critical") daysColor = "var(--c-red)";
    else if (urgency === "warning") daysColor = "var(--c-amber)";
  }

  const barPct   = days != null ? Math.min(Math.max((days / 14) * 100, 2), 100) : 100;
  const barClass = urgency === "critical" || urgency === "expired" ? "critical"
                 : urgency === "warning" ? "warning" : "ok";

  const el = document.createElement("div");
  el.className = `fridge-item glass-card urgency-${urgency}`;
  el.setAttribute("data-id", item.id);
  el.setAttribute("role", "listitem");

  el.innerHTML = `
    <div class="fridge-item__icon">${icon}</div>
    <div class="fridge-item__name">
      ${item.name}
      <div class="fridge-item__sub">
        ${item.quantity ? `<span class="item-qty">${item.quantity}</span>` : ""}
        ${item.category ? `<span class="item-cat">${item.category}</span>` : ""}
      </div>
    </div>
    <div class="fridge-item__expiry">
      ${daysLabel ? `<span class="expiry-days" style="color:${daysColor}">${daysLabel}</span>` : ""}
      ${expiryDate ? `<span class="expiry-date">exp ${expiryDate}</span>` : ""}
      ${days != null ? `
        <div class="expiry-bar">
          <div class="expiry-bar__fill expiry-bar__fill--${barClass}" style="width:${barPct}%"></div>
        </div>` : ""}
    </div>
    <button class="grocery-add-shortcut" data-name="${item.name}" data-qty="${item.quantity || ""}"
            title="Add to grocery list" aria-label="Add ${item.name} to grocery list">
      🛒
    </button>
    <button class="del-btn" aria-label="Remove ${item.name}" title="Remove">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
        <path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
      </svg>
    </button>`;

  el.querySelector(".del-btn").addEventListener("click", () => deleteItem(item.id, item.name, el));
  el.querySelector(".grocery-add-shortcut").addEventListener("click", async () => {
    const { addToGrocery } = await import("./grocery.js");
    addToGrocery(item.name, item.quantity || "", "manual");
    toastSuccess(`"${item.name}" added to grocery list 🛒`);
  });
  return el;
}

async function deleteItem(id, name, el) {
  el.style.opacity = "0.4";
  el.style.pointerEvents = "none";
  try {
    await api.deleteItem(id);
    el.style.transform = "translateX(20px)";
    el.style.opacity   = "0";
    el.style.transition = "all 0.3s ease";
    setTimeout(() => el.remove(), 300);
    toastSuccess(`Removed "${name}" from fridge`);
  } catch {
    el.style.opacity      = "1";
    el.style.pointerEvents = "auto";
    toastError("Failed to remove item");
  }
}

// ─── Expiring Banner (within inventory panel) ─────────────────────────────────
async function loadExpiringBanner() {
  try {
    const items = await api.getExpiring(7);
    if (!items.length) { banner.hidden = true; return; }
    banner.hidden = false;
    banner.innerHTML = `
      <span class="expiry-banner__icon">⚠️</span>
      <span style="font-weight:600;color:var(--c-amber)">Use soon:</span>
      ${items.slice(0, 5).map(i =>
        `<span class="expiry-banner__item">${i.name}${i.days_remaining != null ? ` (${i.days_remaining}d)` : ""}</span>`
      ).join("")}
    `;
  } catch { /* silent */ }
}

// ─── Global Header Expiry Notification ───────────────────────────────────────
export async function checkExpiryNotification() {
  const notifEl = document.getElementById("expiry-notification");
  if (!notifEl) return;

  try {
    const items = await api.getExpiring(3); // within 3 days = urgent
    if (!items.length) {
      notifEl.hidden = true;
      return;
    }

    notifEl.hidden = false;
    const names = items.slice(0, 4).map(i =>
      `<strong>${i.name}</strong>${i.days_remaining != null
        ? i.days_remaining === 0 ? " <em>(today!)</em>"
        : ` <em>(${i.days_remaining}d)</em>`
        : ""}`
    ).join(", ");

    notifEl.innerHTML = `
      <div class="expiry-notif-inner">
        <span class="expiry-notif-pulse"></span>
        <span class="expiry-notif-text">
          🔥 About to expire: ${names}${items.length > 4 ? ` +${items.length - 4} more` : ""}
        </span>
        <button class="expiry-notif-action" id="expiry-notif-grocery-btn">
          🛒 Add all to Grocery List
        </button>
        <button class="expiry-notif-dismiss" id="expiry-notif-dismiss" aria-label="Dismiss">✕</button>
      </div>`;

    notifEl.querySelector("#expiry-notif-grocery-btn").addEventListener("click", async () => {
      const { addToGrocery } = await import("./grocery.js");
      let added = 0;
      items.forEach(i => {
        addToGrocery(i.name, i.quantity || "", "expiring");
        added++;
      });
      // Switch to grocery tab
      document.querySelector("[data-tab='grocery']")?.click();
      toastSuccess(`Added ${added} expiring items to your grocery list!`);
      notifEl.hidden = true;
    });

    notifEl.querySelector("#expiry-notif-dismiss").addEventListener("click", () => {
      notifEl.hidden = true;
    });

  } catch { /* silent */ }
}

// ─── Add Form ─────────────────────────────────────────────────────────────────
addForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const btn = addForm.querySelector("button[type=submit]");
  btn.disabled = true;
  btn.textContent = "Adding…";

  const fd = new FormData(addForm);
  const payload = Object.fromEntries(
    [...fd.entries()].filter(([_, v]) => v.trim())
  );

  if (!payload.name) {
    toastWarn("Please enter an item name");
    btn.disabled = false;
    btn.textContent = "Add to Fridge";
    return;
  }

  try {
    await api.addItem(payload);
    toastSuccess(`✅ Added "${payload.name}" to your fridge!`);
    addForm.reset();
    loadInventory();
  } catch (err) {
    toastError("Failed to add item: " + err.message);
  } finally {
    btn.disabled = false;
    btn.innerHTML = "Add to Fridge";
  }
});

// Set default purchase date to today
document.getElementById("item-bought").valueAsDate = new Date();

// ─── Public: get names for use in Smart Match ─────────────────────────────────
export async function getExpiringIngredientNames(days = 7) {
  try {
    const items = await api.getExpiring(days);
    return items.map(i => i.name.toLowerCase());
  } catch {
    return [];
  }
}

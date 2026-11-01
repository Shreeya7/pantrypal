/* ════════════════════════════════════════════════════════
   PantryPal API client
   ════════════════════════════════════════════════════════ */

const BASE = "/api";

async function _fetch(path, opts = {}) {
  const res = await fetch(BASE + path, {
    headers: { "Content-Type": "application/json" },
    ...opts,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `HTTP ${res.status}`);
  }
  return res.json();
}

export const api = {
  // Recipes
  getRecipes: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return _fetch(`/recipes${q ? "?" + q : ""}`);
  },
  getRecipe: (id) => _fetch(`/recipes/${id}`),
  randomRecipe: () => _fetch("/recipes/random"),
  matchRecipes: (ingredients, limit = 20) =>
    _fetch("/recipes/match", {
      method: "POST",
      body: JSON.stringify({ ingredients, limit }),
    }),

  // Inventory
  getInventory: () => _fetch("/inventory"),
  addItem: (item) =>
    _fetch("/inventory", { method: "POST", body: JSON.stringify(item) }),
  deleteItem: (id) =>
    _fetch(`/inventory/${id}`, { method: "DELETE" }),
  getExpiring: (days = 7) =>
    _fetch(`/inventory/expiring?days=${days}`),

  // Roulette
  spin: (ingredients = []) =>
    _fetch(`/roulette${ingredients.length ? "?ingredients=" + encodeURIComponent(ingredients.join(",")) : ""}`),

  // Health
  health: () => _fetch("/health"),
};

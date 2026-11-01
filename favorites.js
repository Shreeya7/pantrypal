/* ════════════════════════════════════════════════════════
   favorites.js — Local favorites store + UI
   ════════════════════════════════════════════════════════ */

const KEY = "pantrypal_favorites";

function load() {
  try { return JSON.parse(localStorage.getItem(KEY) || "{}"); }
  catch { return {}; }
}
function save(data) {
  localStorage.setItem(KEY, JSON.stringify(data));
}

export const favorites = {
  add(recipe) {
    const d = load();
    d[recipe.id] = { id: recipe.id, title: recipe.title, cuisine: recipe.cuisine, addedAt: Date.now() };
    save(d);
  },
  remove(id) {
    const d = load();
    delete d[id];
    save(d);
  },
  has(id) { return id in load(); },
  all()   { return Object.values(load()).sort((a,b) => b.addedAt - a.addedAt); },
  toggle(recipe) {
    if (this.has(recipe.id)) { this.remove(recipe.id); return false; }
    else { this.add(recipe); return true; }
  },
};

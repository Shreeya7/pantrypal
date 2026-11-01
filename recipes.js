/* ════════════════════════════════════════════════════════
   recipes.js — Discovery tab: infinite scroll + filters
   ════════════════════════════════════════════════════════ */

import { api }           from "./api.js";
import { buildRecipeCard } from "./cards.js";
import { openModal }     from "./modal.js";
import { toastError }    from "./toast.js";

const grid       = document.getElementById("discovery-grid");
const loader     = document.getElementById("discovery-loader");
const sentinel   = document.getElementById("discovery-sentinel");
const searchEl   = document.getElementById("discovery-search");
const filterCourse = document.getElementById("filter-course");
const filterDiet   = document.getElementById("filter-diet");
const filterDiff   = document.getElementById("filter-difficulty");
const indianBtn    = document.getElementById("filter-indian-btn");

let offset = 0;
const LIMIT = 24;
let loading = false;
let exhausted = false;
let indianOnly = false;

// Debounce helper
function debounce(fn, ms) {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
}

// Build query params from current filter state
function buildParams() {
  const params = {
    limit: LIMIT,
    offset,
  };
  const q = searchEl.value.trim();
  if (q)                          params.search = q;
  if (filterCourse.value)         params.course = filterCourse.value;
  if (filterDiet.value === "vegan")       params.vegan = true;
  if (filterDiet.value === "gluten")      params.gluten_free = true;
  if (filterDiet.value === "nut_free")    params.diet = "nut_free";
  if (filterDiff.value)           params.difficulty = filterDiff.value;
  if (indianOnly)                 params.cuisine = "indian";
  return params;
}

// Reset and reload
function reset() {
  offset = 0;
  exhausted = false;
  grid.innerHTML = "";
  loadMore();
}

// Fetch next page and render
async function loadMore() {
  if (loading || exhausted) return;
  loading = true;
  loader.style.display = "flex";

  try {
    const data = await api.getRecipes(buildParams());
    const results = data.results || [];

    if (results.length === 0 && offset === 0) {
      grid.innerHTML = `
        <div class="empty-state" style="grid-column:1/-1">
          <div class="empty-state__icon">🔍</div>
          <p>No recipes found. Try different filters.</p>
        </div>`;
      exhausted = true;
      return;
    }

    // Remove end message if re-adding
    const prev = grid.querySelector(".end-msg");
    if (prev) prev.remove();

    results.forEach(recipe => {
      const card = buildRecipeCard(recipe);
      card.addEventListener("click",  () => openModal(recipe.id));
      card.addEventListener("keydown", e => { if (e.key === "Enter" || e.key === " ") openModal(recipe.id); });
      grid.appendChild(card);
    });

    offset += results.length;

    if (offset >= data.total || results.length < LIMIT) {
      exhausted = true;
      if (grid.children.length > 0) {
        const end = document.createElement("p");
        end.className = "end-msg";
        end.style.gridColumn = "1/-1";
        end.textContent = `✨ Showing all ${data.total.toLocaleString()} recipes`;
        grid.appendChild(end);
      }
    }
  } catch (err) {
    toastError("Failed to load recipes: " + err.message);
  } finally {
    loading = false;
    loader.style.display = "none";
  }
}

// Intersection observer for infinite scroll
const obs = new IntersectionObserver(
  entries => { if (entries[0].isIntersecting) loadMore(); },
  { rootMargin: "200px" }
);
obs.observe(sentinel);

// Filter listeners
const debouncedReset = debounce(reset, 350);
searchEl.addEventListener("input", debouncedReset);
filterCourse.addEventListener("change", reset);
filterDiet.addEventListener("change", reset);
filterDiff.addEventListener("change", reset);

// Indian toggle
indianBtn.addEventListener("click", () => {
  indianOnly = !indianOnly;
  indianBtn.classList.toggle("active", indianOnly);
  indianBtn.setAttribute("aria-pressed", indianOnly);
  reset();
});

// Initial load triggered by tab activation (see app.js)
export function initDiscovery() {
  if (grid.children.length === 0) reset();
}

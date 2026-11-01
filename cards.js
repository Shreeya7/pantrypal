/* ════════════════════════════════════════════════════════
   cards.js — Recipe card renderer (shared)
   ════════════════════════════════════════════════════════ */

const FOOD_EMOJIS = {
  chicken:   "🍗", beef: "🥩", pork: "🥓", fish: "🐟", seafood: "🦐",
  pasta:     "🍝", rice: "🍚", bread: "🍞", pizza: "🍕", burger: "🍔",
  salad:     "🥗", soup: "🍲", curry: "🍛", dessert: "🍰", cake: "🎂",
  cookie:    "🍪", chocolate: "🍫", ice:  "🍦", egg: "🍳", tofu: "🧊",
  mushroom:  "🍄", potato: "🥔", corn: "🌽", carrot: "🥕", broccoli: "🥦",
  tomato:    "🍅", pepper: "🌶️", avocado: "🥑", lemon: "🍋", garlic: "🧄",
  ginger:    "🫚", lamb: "🐑", turkey: "🦃", vegetable: "🥦",
  drink:     "🥤", cocktail: "🍹", wine: "🍷", coffee: "☕",
  indian:    "🫕", biryani: "🍚", dosa: "🫓",
};

export function getEmoji(recipe) {
  const text = `${recipe.title} ${recipe.main_ingredient || ""}
                ${recipe.cuisine || ""}`.toLowerCase();
  for (const [k, v] of Object.entries(FOOD_EMOJIS)) {
    if (text.includes(k)) return v;
  }
  const courses = (recipe.courses || []).join(" ").toLowerCase();
  if (courses.includes("dessert")) return "🍰";
  if (courses.includes("breakfast")) return "🍳";
  if (courses.includes("drink")) return "🥤";
  if (courses.includes("salad")) return "🥗";
  if (courses.includes("soup")) return "🍲";
  return "🍽️";
}

function getHealthColor(score) {
  if (!score) return "#555";
  if (score >= 70) return "var(--c-green)";
  if (score >= 45) return "var(--c-amber)";
  return "var(--c-red)";
}

function getMatchColor(pct) {
  if (pct >= 80) return "var(--c-green)";
  if (pct >= 50) return "var(--c-gold)";
  return "var(--c-amber)";
}

function getDifficultyClass(diff) {
  if (!diff) return "";
  const d = diff.toLowerCase();
  if (d === "easy") return "pill--easy";
  if (d === "hard") return "pill--hard";
  return "pill--medium";
}

function isIndian(recipe) {
  const c = (recipe.cuisine || "").toLowerCase();
  const cats = (recipe.cuisines || []).map(x => x.toLowerCase());
  return c.includes("indian") || cats.some(x => x.includes("indian")) || recipe.category === "Indian";
}

export function buildRecipeCard(recipe, opts = {}) {
  const { showMatch = false } = opts;

  const emoji    = getEmoji(recipe);
  const indian   = isIndian(recipe);
  const totalMin = (recipe.prep_time || 0) + (recipe.cook_time || 0);
  const timeStr  = totalMin > 0 ? `${totalMin} min` : null;
  const diff     = recipe.difficulty;
  const health   = recipe.healthiness;

  // Dietary tags
  const diet = (recipe.dietary_tags || []);
  const isVeg = diet.some(d => ["vegan","vegetarian"].includes(d.toLowerCase()));

  // Match score markup
  let matchHtml = "";
  if (showMatch) {
    const pct   = recipe.match_score ?? 0;
    const color = getMatchColor(pct);
    const canCook = pct === 100;
    const missing = recipe.missing_ingredients || [];
    matchHtml = `
      <div class="match-score-row">
        <div>
          <span class="match-score-pct" style="color:${color}">${pct}%</span>
        </div>
        <div class="match-score-bar">
          <div class="match-score-bar__fill"
               style="width:${pct}%;background:${color}"></div>
        </div>
      </div>
      ${canCook
        ? `<p class="match-can-cook">✅ Can cook now!</p>`
        : missing.length
          ? `<p class="match-missing">Missing: ${missing.slice(0,3).join(", ")}${missing.length > 3 ? "…" : ""}</p>`
          : ""}
    `;
  }

  // Pills
  const pills = [];
  if (timeStr) pills.push(`<span class="pill pill--time">⏱ ${timeStr}</span>`);
  if (diff)    pills.push(`<span class="pill ${getDifficultyClass(diff)}">${diff}</span>`);
  if (isVeg)   pills.push(`<span class="pill pill--veg">🌿 Veg</span>`);

  // Health bar
  const healthBar = health != null
    ? `<div class="health-bar" title="Healthiness: ${health}">
         <div class="health-bar__fill"
              style="width:${Math.min(health,100)}%;background:${getHealthColor(health)}">
         </div>
       </div>`
    : "";

  const card = document.createElement("article");
  card.className = "recipe-card glass-card";
  card.setAttribute("tabindex", "0");
  card.setAttribute("role", "button");
  card.setAttribute("aria-label", `View recipe: ${recipe.title}`);
  card.dataset.id = recipe.id;

  card.innerHTML = `
    <div class="recipe-card__top">
      <div class="recipe-card__emoji">${emoji}</div>
      <div class="recipe-card__badge">
        ${indian
          ? `<span class="cuisine-badge india-badge">🇮🇳 Indian</span>`
          : recipe.cuisine
            ? `<span class="cuisine-badge">${recipe.cuisine}</span>`
            : ""}
      </div>
    </div>
    <div class="recipe-card__body">
      <h3 class="recipe-card__title">${recipe.title}</h3>
      <div class="recipe-card__meta">
        ${pills.join("")}
        ${healthBar}
      </div>
      ${matchHtml}
    </div>
  `;

  return card;
}

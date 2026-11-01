/* ════════════════════════════════════════════════════════
   roulette.js — Recipe Roulette with confetti
   ════════════════════════════════════════════════════════ */

import { api }             from "./api.js";
import { buildRecipeCard } from "./cards.js";
import { openModal }       from "./modal.js";
import { toastError, toastSuccess } from "./toast.js";

const spinBtn       = document.getElementById("spin-btn");
const wheel         = document.getElementById("roulette-wheel");
const chosenEl      = document.getElementById("roulette-chosen");
const resultsEl     = document.getElementById("roulette-results");
const confettiEl    = document.getElementById("confetti-container");

const CONFETTI_COLORS = [
  "#d4af37","#f0d060","#3db870","#5b9cf6",
  "#b06ed4","#e05050","#f0a030","#ffffff",
];

function launchConfetti() {
  for (let i = 0; i < 80; i++) {
    const piece = document.createElement("div");
    piece.className = "confetti-piece";
    const size    = Math.random() * 10 + 5;
    const left    = Math.random() * 100;
    const delay   = Math.random() * 0.8;
    const duration = Math.random() * 2.5 + 1.5;
    const color   = CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)];
    const rotation = Math.random() * 360;
    const shape   = Math.random() > 0.5 ? "50%" : "2px";

    piece.style.cssText = `
      left: ${left}%;
      width: ${size}px;
      height: ${size}px;
      background: ${color};
      border-radius: ${shape};
      transform: rotate(${rotation}deg);
      animation-duration: ${duration}s;
      animation-delay: ${delay}s;
    `;
    confettiEl.appendChild(piece);
  }
  setTimeout(() => confettiEl.innerHTML = "", 4000);
}

function spinAnimation() {
  return new Promise(resolve => {
    wheel.classList.remove("spin-settle");
    wheel.classList.add("spinning");

    const wheelInner = wheel.querySelector(".wheel-inner");
    if (wheelInner) {
      const frames = ["🎲","🎰","🎯","✨","🎲","⭐"];
      let i = 0;
      const interval = setInterval(() => {
        wheelInner.textContent = frames[i % frames.length];
        i++;
      }, 200);
      setTimeout(() => {
        clearInterval(interval);
        wheelInner.textContent = "🎉";
      }, 1800);
    }

    setTimeout(() => {
      wheel.classList.remove("spinning");
      wheel.classList.add("spin-settle");
      setTimeout(() => {
        wheel.classList.remove("spin-settle");
        resolve();
      }, 800);
    }, 2000);
  });
}

async function spin() {
  spinBtn.disabled = true;
  spinBtn.textContent = "Spinning…";
  chosenEl.innerHTML = "";
  resultsEl.innerHTML = "";

  // Get fridge ingredients for the spin
  let ingredients = [];
  try {
    const { api: apiMod } = await import("./api.js");
    const inv = await apiMod.getInventory();
    ingredients = inv.map(i => i.name.toLowerCase());
  } catch { /* no fridge items, spin globally */ }

  // Run animation and API call in parallel
  const [, data] = await Promise.all([
    spinAnimation(),
    api.spin(ingredients).catch(err => {
      toastError("Spin failed: " + err.message);
      return null;
    }),
  ]);

  spinBtn.disabled = false;
  spinBtn.innerHTML = "🎲 Spin Again!";

  if (!data) return;

  launchConfetti();

  // Show chosen ingredients
  if (data.chosen_ingredients?.length) {
    chosenEl.innerHTML = `
      <p class="chosen-label">Spun ingredients</p>
      <div class="chosen-chips">
        ${data.chosen_ingredients.map(i =>
          `<span class="chosen-chip">${i}</span>`
        ).join("")}
      </div>`;
  }

  // Show results
  if (data.recipes?.length) {
    const heading = document.createElement("h3");
    heading.className = "roulette-subtitle";
    heading.innerHTML = `🎉 <span style="color:var(--c-gold)">${data.recipes.length}</span> recipe${data.recipes.length > 1 ? "s" : ""} for you!`;
    resultsEl.appendChild(heading);

    const grid = document.createElement("div");
    grid.className = "recipe-grid";
    data.recipes.forEach(recipe => {
      const card = buildRecipeCard(recipe);
      card.addEventListener("click", () => openModal(recipe.id));
      card.addEventListener("keydown", e => { if (e.key === "Enter") openModal(recipe.id); });
      grid.appendChild(card);
    });
    resultsEl.appendChild(grid);
    toastSuccess(`🎉 Spun ${data.recipes.length} delicious recipes!`);
  } else {
    resultsEl.innerHTML = `
      <div class="empty-state">
        <div class="empty-state__icon">🎲</div>
        <p>No recipes found for those ingredients. Add more items to your fridge!</p>
      </div>`;
  }
}

spinBtn.addEventListener("click", spin);

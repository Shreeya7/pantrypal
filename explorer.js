/* ════════════════════════════════════════════════════════
   explorer.js — Cuisine World Explorer
   v2: sessionStorage cache, gold SVG map, stagger animation
   ════════════════════════════════════════════════════════ */

import { api }        from "./api.js";
import { toastInfo }  from "./toast.js";
import { awardXP, track } from "./gamification.js";

// ─── Cuisine data ─────────────────────────────────────────────────────────────
const CUISINES = [
  // Asia
  { q:"indian",       name:"Indian",        flag:"🇮🇳", emoji:"🍛", continent:"Asia",     dishes:["Biryani","Butter Chicken","Dosa","Palak Paneer"] },
  { q:"chinese",      name:"Chinese",       flag:"🇨🇳", emoji:"🥢", continent:"Asia",     dishes:["Kung Pao Chicken","Dim Sum","Mapo Tofu","Fried Rice"] },
  { q:"japanese",     name:"Japanese",      flag:"🇯🇵", emoji:"🍱", continent:"Asia",     dishes:["Ramen","Sushi","Tempura","Miso Soup"] },
  { q:"thai",         name:"Thai",          flag:"🇹🇭", emoji:"🥘", continent:"Asia",     dishes:["Pad Thai","Tom Yum","Green Curry","Mango Sticky Rice"] },
  { q:"korean",       name:"Korean",        flag:"🇰🇷", emoji:"🍲", continent:"Asia",     dishes:["Bibimbap","Bulgogi","Kimchi Jjigae","Tteokbokki"] },
  { q:"vietnamese",   name:"Vietnamese",    flag:"🇻🇳", emoji:"🍜", continent:"Asia",     dishes:["Pho","Banh Mi","Bun Bo Hue","Goi Cuon"] },
  { q:"middle eastern", name:"Middle Eastern", flag:"🕌", emoji:"🫔", continent:"Asia",  dishes:["Hummus","Falafel","Shawarma","Kebab"] },
  { q:"turkish",      name:"Turkish",       flag:"🇹🇷", emoji:"🧆", continent:"Asia",     dishes:["Döner","Börek","Baklava","Pide"] },
  // Europe
  { q:"italian",      name:"Italian",       flag:"🇮🇹", emoji:"🍝", continent:"Europe",   dishes:["Pizza","Pasta Carbonara","Risotto","Tiramisu"] },
  { q:"french",       name:"French",        flag:"🇫🇷", emoji:"🥐", continent:"Europe",   dishes:["Coq au Vin","Bouillabaisse","Crêpes","Ratatouille"] },
  { q:"spanish",      name:"Spanish",       flag:"🇪🇸", emoji:"🥘", continent:"Europe",   dishes:["Paella","Gazpacho","Tortilla Española","Churros"] },
  { q:"greek",        name:"Greek",         flag:"🇬🇷", emoji:"🫒", continent:"Europe",   dishes:["Moussaka","Souvlaki","Spanakopita","Baklava"] },
  { q:"mediterranean", name:"Mediterranean", flag:"🌊", emoji:"🐟", continent:"Europe",   dishes:["Grilled Fish","Tabbouleh","Hummus","Shakshuka"] },
  { q:"british",      name:"British",       flag:"🇬🇧", emoji:"🥧", continent:"Europe",   dishes:["Fish & Chips","Shepherd's Pie","Full English","Scones"] },
  { q:"german",       name:"German",        flag:"🇩🇪", emoji:"🌭", continent:"Europe",   dishes:["Schnitzel","Bratwurst","Sauerkraut","Black Forest Cake"] },
  // Americas
  { q:"american",     name:"American",      flag:"🇺🇸", emoji:"🍔", continent:"Americas", dishes:["BBQ Ribs","Mac & Cheese","Clam Chowder","Pecan Pie"] },
  { q:"mexican",      name:"Mexican",       flag:"🇲🇽", emoji:"🌮", continent:"Americas", dishes:["Tacos","Guacamole","Enchiladas","Mole Poblano"] },
  { q:"brazilian",    name:"Brazilian",     flag:"🇧🇷", emoji:"🍖", continent:"Americas", dishes:["Feijoada","Churrasco","Pão de Queijo","Caipirinha"] },
  { q:"caribbean",    name:"Caribbean",     flag:"🌴", emoji:"🍗", continent:"Americas",  dishes:["Jerk Chicken","Roti","Ackee & Saltfish","Rum Cake"] },
  // Africa
  { q:"moroccan",     name:"Moroccan",      flag:"🇲🇦", emoji:"🫕", continent:"Africa",   dishes:["Tagine","Couscous","Harira","Pastilla"] },
  { q:"ethiopian",    name:"Ethiopian",     flag:"🇪🇹", emoji:"🫓", continent:"Africa",   dishes:["Injera","Doro Wat","Tibs","Shiro"] },
];

const CONTINENT_ORDER = ["Asia","Europe","Americas","Africa"];
const CACHE_KEY  = "pantrypal_explorer_counts";
const CACHE_TTL  = 10 * 60 * 1000; // 10 minutes

// ─── Cache helpers ─────────────────────────────────────────────────────────────
function getCached() {
  try {
    const raw = sessionStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const { ts, data } = JSON.parse(raw);
    if (Date.now() - ts > CACHE_TTL) { sessionStorage.removeItem(CACHE_KEY); return null; }
    return data;
  } catch { return null; }
}
function setCache(data) {
  try { sessionStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), data })); } catch {}
}

// ─── Aesthetic gold SVG world map ─────────────────────────────────────────────
const MAP_SVG = `
<svg class="explorer-map-bg" viewBox="0 0 1000 520" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <defs>
    <linearGradient id="goldFill" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%"   stop-color="#d4af37" stop-opacity="0.30"/>
      <stop offset="50%"  stop-color="#f0d060" stop-opacity="0.18"/>
      <stop offset="100%" stop-color="#c8960c" stop-opacity="0.28"/>
    </linearGradient>
    <linearGradient id="goldGlow" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%"   stop-color="#ffe066" stop-opacity="0.12"/>
      <stop offset="100%" stop-color="#d4af37" stop-opacity="0.06"/>
    </linearGradient>
    <filter id="mapGlow" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur in="SourceGraphic" stdDeviation="2.5" result="blur"/>
      <feComposite in="SourceGraphic" in2="blur" operator="over"/>
    </filter>
    <filter id="contGlow" x="-10%" y="-10%" width="120%" height="120%">
      <feGaussianBlur in="SourceAlpha" stdDeviation="3" result="blur"/>
      <feFlood flood-color="#d4af37" flood-opacity="0.4" result="color"/>
      <feComposite in="color" in2="blur" operator="in" result="shadow"/>
      <feComposite in="SourceGraphic" in2="shadow" operator="over"/>
    </filter>
    <radialGradient id="globeGrad" cx="50%" cy="45%" r="50%">
      <stop offset="0%" stop-color="#d4af37" stop-opacity="0.05"/>
      <stop offset="100%" stop-color="#d4af37" stop-opacity="0"/>
    </radialGradient>
  </defs>

  <!-- Globe glow background -->
  <ellipse cx="500" cy="255" rx="490" ry="245" fill="url(#globeGrad)"/>

  <!-- Latitude grid lines -->
  <g stroke="#d4af37" stroke-opacity="0.12" stroke-width="0.7" fill="none" stroke-dasharray="3,10">
    <line x1="10" y1="85"  x2="990" y2="85"/>
    <line x1="10" y1="170" x2="990" y2="170"/>
    <line x1="10" y1="255" x2="990" y2="255"/>
    <line x1="10" y1="340" x2="990" y2="340"/>
    <line x1="10" y1="425" x2="990" y2="425"/>
  </g>
  <!-- Longitude grid lines -->
  <g stroke="#d4af37" stroke-opacity="0.12" stroke-width="0.7" fill="none" stroke-dasharray="3,10">
    <line x1="125" y1="10" x2="125" y2="510"/>
    <line x1="250" y1="10" x2="250" y2="510"/>
    <line x1="375" y1="10" x2="375" y2="510"/>
    <line x1="500" y1="10" x2="500" y2="510"/>
    <line x1="625" y1="10" x2="625" y2="510"/>
    <line x1="750" y1="10" x2="750" y2="510"/>
    <line x1="875" y1="10" x2="875" y2="510"/>
  </g>

  <!-- Equator (bold) -->
  <line x1="10" y1="255" x2="990" y2="255" stroke="#d4af37" stroke-opacity="0.28" stroke-width="1.2"/>
  <!-- Tropic of Cancer -->
  <line x1="10" y1="195" x2="990" y2="195" stroke="#d4af37" stroke-opacity="0.15" stroke-width="0.7" stroke-dasharray="8,6"/>
  <!-- Tropic of Capricorn -->
  <line x1="10" y1="315" x2="990" y2="315" stroke="#d4af37" stroke-opacity="0.15" stroke-width="0.7" stroke-dasharray="8,6"/>

  <!-- ═══ CONTINENTS ═══ (stylised, hand-tuned Mercator approximation) -->

  <!-- NORTH AMERICA -->
  <path filter="url(#contGlow)" fill="url(#goldFill)" stroke="#e8c84a" stroke-width="1.2" stroke-opacity="0.65"
    d="M68,58 L92,48 L128,44 L165,50 L196,60 L218,78
       L230,100 L240,122 L244,148 L234,172 L216,196
       L200,218 L190,240 L180,258 L164,265
       L148,258 L132,242 L112,218 L94,194
       L76,168 L64,140 L60,112 L62,82 Z"/>
  <!-- Alaska -->
  <path fill="url(#goldFill)" stroke="#e8c84a" stroke-width="0.8" stroke-opacity="0.55"
    d="M45,55 L66,45 L72,56 L64,68 L50,66 Z"/>
  <!-- Greenland -->
  <path fill="url(#goldFill)" stroke="#e8c84a" stroke-width="0.8" stroke-opacity="0.45"
    d="M250,28 L288,18 L308,24 L312,50 L300,72 L274,78 L250,68 L238,50 Z"/>

  <!-- CENTRAL AMERICA + MEXICO -->
  <path fill="url(#goldFill)" stroke="#e8c84a" stroke-width="0.9" stroke-opacity="0.6"
    d="M165,265 L196,255 L218,260 L228,278 L218,292 L196,295 L174,282 Z"/>

  <!-- CARIBBEAN islands (scattered dots) -->
  <g fill="#d4af37" fill-opacity="0.5">
    <circle cx="236" cy="274" r="3"/>
    <circle cx="252" cy="268" r="2.5"/>
    <circle cx="268" cy="272" r="2"/>
    <circle cx="258" cy="280" r="2"/>
  </g>

  <!-- SOUTH AMERICA -->
  <path filter="url(#contGlow)" fill="url(#goldFill)" stroke="#e8c84a" stroke-width="1.2" stroke-opacity="0.65"
    d="M186,295 L224,278 L260,286 L280,308 L286,340
       L282,380 L270,418 L248,448 L224,462 L198,456
       L172,436 L156,404 L148,366 L150,328 L162,302 Z"/>

  <!-- EUROPE -->
  <path filter="url(#contGlow)" fill="url(#goldFill)" stroke="#e8c84a" stroke-width="1.1" stroke-opacity="0.65"
    d="M418,62 L450,50 L490,46 L520,56 L534,76 L532,98
       L518,116 L498,128 L472,130 L448,122 L428,108 L414,88 Z"/>
  <!-- Scandinavia -->
  <path fill="url(#goldFill)" stroke="#e8c84a" stroke-width="0.8" stroke-opacity="0.55"
    d="M458,30 L486,18 L510,28 L520,50 L510,56 L490,46 L465,45 Z"/>
  <!-- UK -->
  <path fill="url(#goldFill)" stroke="#e8c84a" stroke-width="0.7" stroke-opacity="0.5"
    d="M402,72 L416,60 L424,72 L416,86 L404,82 Z"/>
  <!-- Iberian Peninsula -->
  <path fill="url(#goldFill)" stroke="#e8c84a" stroke-width="0.8" stroke-opacity="0.5"
    d="M414,112 L436,106 L448,118 L446,136 L428,140 L414,128 Z"/>
  <!-- Italy -->
  <path fill="url(#goldFill)" stroke="#e8c84a" stroke-width="0.7" stroke-opacity="0.5"
    d="M476,118 L488,112 L496,128 L492,148 L480,152 L470,138 Z"/>

  <!-- AFRICA -->
  <path filter="url(#contGlow)" fill="url(#goldFill)" stroke="#e8c84a" stroke-width="1.3" stroke-opacity="0.70"
    d="M432,142 L490,130 L536,140 L560,168 L572,204
       L578,248 L576,298 L562,346 L540,388 L514,412
       L486,420 L458,408 L434,378 L418,338 L412,290
       L414,240 L420,192 L426,166 Z"/>
  <!-- Madagascar -->
  <path fill="url(#goldFill)" stroke="#e8c84a" stroke-width="0.7" stroke-opacity="0.45"
    d="M574,348 L584,330 L594,342 L590,370 L578,376 Z"/>

  <!-- ASIA MAIN -->
  <path filter="url(#contGlow)" fill="url(#goldFill)" stroke="#e8c84a" stroke-width="1.3" stroke-opacity="0.70"
    d="M532,52 L600,38 L680,32 L760,38 L830,52 L890,74
       L930,102 L944,132 L938,164 L916,188 L882,202
       L840,210 L796,210 L750,206 L706,198 L668,192
       L630,186 L594,170 L562,150 L538,122 L528,94 Z"/>
  <!-- Indian Subcontinent -->
  <path filter="url(#contGlow)" fill="url(#goldFill)" stroke="#e8c84a" stroke-width="1.1" stroke-opacity="0.68"
    d="M634,194 L676,185 L704,196 L714,224 L710,258
       L694,278 L672,286 L648,278 L634,254 L626,226 Z"/>
  <!-- Sri Lanka -->
  <path fill="url(#goldFill)" stroke="#e8c84a" stroke-width="0.5" stroke-opacity="0.5"
    d="M692,290 L700,282 L706,292 L698,302 Z"/>
  <!-- Arabian Peninsula -->
  <path fill="url(#goldFill)" stroke="#e8c84a" stroke-width="0.9" stroke-opacity="0.55"
    d="M562,156 L604,152 L622,174 L618,204 L592,216 L566,208 L548,186 Z"/>
  <!-- Japan -->
  <path fill="url(#goldFill)" stroke="#e8c84a" stroke-width="0.8" stroke-opacity="0.55"
    d="M860,102 L876,90 L888,102 L882,124 L866,128 L856,116 Z"/>
  <!-- Southeast Asia peninsula -->
  <path fill="url(#goldFill)" stroke="#e8c84a" stroke-width="0.9" stroke-opacity="0.55"
    d="M726,196 L764,200 L794,220 L800,254 L780,268 L754,262 L734,244 L724,218 Z"/>
  <!-- Borneo/Indonesia (simplified) -->
  <path fill="url(#goldFill)" stroke="#e8c84a" stroke-width="0.7" stroke-opacity="0.45"
    d="M778,270 L820,260 L840,276 L838,298 L810,304 L782,292 Z"/>
  <path fill="url(#goldFill)" stroke="#e8c84a" stroke-width="0.7" stroke-opacity="0.4"
    d="M836,272 L870,268 L888,284 L880,300 L854,298 Z"/>
  <!-- Philippines -->
  <g fill="url(#goldFill)" stroke="#e8c84a" stroke-width="0.5" stroke-opacity="0.4">
    <ellipse cx="834" cy="222" rx="8" ry="16"/>
    <ellipse cx="844" cy="245" rx="6" ry="12"/>
  </g>

  <!-- OCEANIA / AUSTRALIA -->
  <path filter="url(#contGlow)" fill="url(#goldFill)" stroke="#e8c84a" stroke-width="1.2" stroke-opacity="0.65"
    d="M778,304 L842,290 L896,298 L928,322 L934,358
       L916,390 L878,406 L838,404 L804,384 L782,352
       L774,322 Z"/>
  <!-- New Zealand -->
  <path fill="url(#goldFill)" stroke="#e8c84a" stroke-width="0.7" stroke-opacity="0.45"
    d="M940,360 L956,344 L966,358 L960,378 L944,382 Z"/>
  <!-- New Guinea -->
  <path fill="url(#goldFill)" stroke="#e8c84a" stroke-width="0.8" stroke-opacity="0.45"
    d="M840,288 L880,278 L902,290 L900,306 L874,308 L846,300 Z"/>

  <!-- ═══ DECORATIVE ELEMENTS ═══ -->

  <!-- Compass rose — bottom right -->
  <g transform="translate(930, 440)" stroke="#d4af37" stroke-opacity="0.45" fill="#d4af37" fill-opacity="0.3">
    <line x1="0" y1="-28" x2="0" y2="28"  stroke-width="1.2"/>
    <line x1="-28" y1="0" x2="28" y2="0"  stroke-width="1.2"/>
    <line x1="-20" y1="-20" x2="20" y2="20" stroke-width="0.6"/>
    <line x1="20" y1="-20" x2="-20" y2="20"  stroke-width="0.6"/>
    <polygon points="0,-28 5,-14 -5,-14" fill="#d4af37" fill-opacity="0.7"/>
    <polygon points="0,28 5,14 -5,14"/>
    <polygon points="-28,0 -14,5 -14,-5"/>
    <polygon points="28,0 14,5 14,-5"/>
    <circle cx="0" cy="0" r="4.5" fill="none" stroke="#d4af37" stroke-width="1.2" stroke-opacity="0.6"/>
    <text x="0" y="-34" text-anchor="middle" fill="#d4af37" fill-opacity="0.65" font-size="9" font-family="serif">N</text>
  </g>

  <!-- Shimmer animation overlay -->
  <rect x="0" y="0" width="1000" height="520" fill="url(#goldGlow)" opacity="0">
    <animate attributeName="opacity" values="0;0.6;0" dur="6s" repeatCount="indefinite"/>
  </rect>

  <!-- Outer border frame -->
  <rect x="4" y="4" width="992" height="512" fill="none" stroke="#d4af37" stroke-opacity="0.2" stroke-width="1" rx="6"/>
</svg>`;

// ─── Render ───────────────────────────────────────────────────────────────────
export async function renderExplorer() {
  const container = document.getElementById("explorer-container");
  if (!container) return;

  container.innerHTML = `
    <div class="explorer-intro glass-card">
      ${MAP_SVG}
      <div class="explorer-intro__text">
        <h2 class="explorer-intro__title">🌍 World Cuisine Atlas</h2>
        <p class="explorer-intro__sub">Click any cuisine below to explore its recipes. Counts pulled live from the database.</p>
      </div>
    </div>
    <div id="explorer-grid-wrap" class="explorer-loading">
      <div class="loading-state"><div class="spinner"></div><span>Loading cuisine data…</span></div>
    </div>`;

  // ── Try cache first ──────────────────────────────────────────────────────────
  let countMap = getCached();
  if (!countMap) {
    const counts = await Promise.all(
      CUISINES.map(c =>
        api.getRecipes({ cuisine: c.q, limit: 1 })
          .then(d => ({ q: c.q, total: d.total }))
          .catch(() => ({ q: c.q, total: 0 }))
      )
    );
    countMap = Object.fromEntries(counts.map(c => [c.q, c.total]));
    setCache(countMap);
  }

  const maxCount = Math.max(...Object.values(countMap), 1);
  const gridWrap = container.querySelector("#explorer-grid-wrap");
  gridWrap.className = "explorer-grids";
  gridWrap.innerHTML = "";

  let tileIndex = 0;

  CONTINENT_ORDER.forEach(continent => {
    const cuisines = CUISINES.filter(c => c.continent === continent);
    if (!cuisines.length) return;

    const section = document.createElement("div");
    section.className = "explorer-section";
    section.innerHTML = `
      <div class="explorer-continent-label">
        <span class="explorer-continent-line"></span>
        <span class="explorer-continent-name">${continent}</span>
        <span class="explorer-continent-line"></span>
      </div>
      <div class="explorer-row">
        ${cuisines.map(c => {
          const count    = countMap[c.q] || 0;
          const barWidth = Math.round((count / maxCount) * 100);
          const dishes   = c.dishes.slice(0, 3).join(" · ");
          const delay    = (tileIndex++ * 60) + "ms";
          return `
            <div class="explorer-tile glass-card" data-cuisine="${c.q}" tabindex="0" role="button"
                 aria-label="Explore ${c.name} cuisine, ${count} recipes"
                 style="animation-delay:${delay}">
              <div class="explorer-tile__flag">${c.flag}</div>
              <div class="explorer-tile__emoji">${c.emoji}</div>
              <div class="explorer-tile__name">${c.name}</div>
              <div class="explorer-tile__dishes">${dishes}</div>
              <div class="explorer-tile__count-wrap">
                <div class="explorer-count-bar">
                  <div class="explorer-count-fill" style="width:${barWidth}%"></div>
                </div>
                <span class="explorer-tile__count">${count.toLocaleString()} recipes</span>
              </div>
            </div>`;
        }).join("")}
      </div>`;
    gridWrap.appendChild(section);
  });

  // Wire click events
  let exploredCuisines = new Set();
  gridWrap.querySelectorAll(".explorer-tile").forEach(tile => {
    tile.addEventListener("click", () => {
      const cuisine = tile.dataset.cuisine;
      exploredCuisines.add(cuisine);

      if (exploredCuisines.size === 10) {
        awardXP(120, "Explored 10 world cuisines!");
      }

      navigateToCuisine(cuisine, tile.querySelector(".explorer-tile__name")?.textContent);
    });
    tile.addEventListener("keydown", e => { if (e.key === "Enter" || e.key === " ") tile.click(); });
  });
}

// ─── Switch to Discovery with cuisine pre-filtered ────────────────────────────
function navigateToCuisine(cuisine, label) {
  const discoveryTab = document.querySelector("[data-tab='discovery']");
  if (discoveryTab) discoveryTab.click();

  setTimeout(() => {
    const indianBtn = document.getElementById("filter-indian-btn");
    const searchEl  = document.getElementById("discovery-search");

    if (cuisine === "indian" && indianBtn) {
      if (!indianBtn.classList.contains("active")) indianBtn.click();
    } else {
      if (indianBtn?.classList.contains("active")) indianBtn.click();
      if (searchEl) {
        searchEl.value = label || cuisine;
        searchEl.dispatchEvent(new Event("input"));
      }
    }
    toastInfo(`🌍 Showing ${label || cuisine} recipes`);
  }, 150);
}

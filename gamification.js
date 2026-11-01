/* ════════════════════════════════════════════════════════
   gamification.js — XP, Levels, Achievements, Streaks
   ════════════════════════════════════════════════════════ */

const STORE_KEY  = "pantrypal_gamification";

// ─── Level config ─────────────────────────────────────────────────────────────
export const LEVELS = [
  { name: "Home Cook",       min: 0,    icon: "🍳", color: "#888" },
  { name: "Sous Chef",       min: 200,  icon: "👨‍🍳", color: "#5b9cf6" },
  { name: "Chef de Partie",  min: 600,  icon: "🔪", color: "#3db870" },
  { name: "Head Chef",       min: 1400, icon: "⭐", color: "#d4af37" },
  { name: "Executive Chef",  min: 3000, icon: "🏆", color: "#e05050" },
  { name: "Master Chef",     min: 6000, icon: "👑", color: "#b06ed4" },
];

// ─── Achievement definitions ──────────────────────────────────────────────────
export const ACHIEVEMENTS = [
  { id: "first_match",    icon: "🔍", title: "First Match",       desc: "Run your first ingredient search",       xp: 50  },
  { id: "first_cook",     icon: "👨‍🍳", title: "Initiation",         desc: "Complete your first recipe in Cook Mode", xp: 100 },
  { id: "first_item",     icon: "🧊", title: "Stocked Up",         desc: "Add your first fridge item",             xp: 30  },
  { id: "fridge_10",      icon: "🏠", title: "Full Fridge",        desc: "Add 10+ items to your fridge",           xp: 75  },
  { id: "indian_fan",     icon: "🇮🇳", title: "Curry Lover",        desc: "Open 5 Indian recipes",                  xp: 80  },
  { id: "challenge_win",  icon: "♻️", title: "Zero Waste Hero",    desc: "Complete a Chef's Challenge",            xp: 200 },
  { id: "spin_5",         icon: "🎲", title: "Lucky Spinner",      desc: "Spin the roulette 5 times",              xp: 60  },
  { id: "planner_week",   icon: "📅", title: "Meal Prepper",       desc: "Plan a full week of meals",              xp: 150 },
  { id: "explorer_10",    icon: "🌍", title: "World Traveler",     desc: "Explore 10 different cuisines",          xp: 120 },
  { id: "fav_10",         icon: "⭐", title: "Recipe Collector",   desc: "Save 10 favourite recipes",              xp: 100 },
  { id: "voice_cook",     icon: "🎤", title: "Voice Chef",         desc: "Use voice input to find a recipe",       xp: 80  },
  { id: "streak_3",       icon: "🔥", title: "On a Roll",          desc: "3-day cooking streak",                   xp: 150 },
  { id: "streak_7",       icon: "💪", title: "Week Warrior",       desc: "7-day cooking streak",                   xp: 350 },
  { id: "perfect_match",  icon: "💯", title: "Perfect Pantry",     desc: "Match a recipe with 100% ingredients",   xp: 120 },
];

// ─── State helpers ────────────────────────────────────────────────────────────
function defaultState() {
  return { xp: 0, unlocked: [], streak: 0, lastCookDate: null, counters: {} };
}

export function loadState() {
  try { return { ...defaultState(), ...JSON.parse(localStorage.getItem(STORE_KEY) || "{}") }; }
  catch { return defaultState(); }
}

function saveState(s) { localStorage.setItem(STORE_KEY, JSON.stringify(s)); }

// ─── Level utilities ──────────────────────────────────────────────────────────
export function getLevel(xp) {
  for (let i = LEVELS.length - 1; i >= 0; i--) {
    if (xp >= LEVELS[i].min) return { ...LEVELS[i], index: i };
  }
  return { ...LEVELS[0], index: 0 };
}

export function xpToNextLevel(xp) {
  const level = getLevel(xp);
  const next  = LEVELS[level.index + 1];
  if (!next) return { needed: 0, progress: 100 };
  const needed   = next.min - level.min;
  const progress = ((xp - level.min) / needed) * 100;
  return { needed: next.min - xp, progress: Math.min(progress, 100) };
}

// ─── Award XP ─────────────────────────────────────────────────────────────────
export function awardXP(amount, reason) {
  const s = loadState();
  const prevLevel = getLevel(s.xp);
  s.xp += amount;
  saveState(s);
  const newLevel  = getLevel(s.xp);

  // Show XP toast
  showXPPopup(amount, reason);

  // Level-up?
  if (newLevel.index > prevLevel.index) {
    setTimeout(() => showLevelUp(newLevel), 800);
  }

  // Update HUD
  renderHUD();
  return s.xp;
}

// ─── Increment counter & check achievement ────────────────────────────────────
export function track(event, value = 1) {
  const s = loadState();
  s.counters[event] = (s.counters[event] || 0) + value;
  saveState(s);
  checkAchievements(s);
  renderHUD();
}

function checkAchievements(s) {
  const c = s.counters;
  const checks = [
    ["first_match",   c.match >= 1],
    ["first_cook",    c.cook  >= 1],
    ["first_item",    c.item  >= 1],
    ["fridge_10",     c.item  >= 10],
    ["indian_fan",    c.indian_open >= 5],
    ["challenge_win", c.challenge >= 1],
    ["spin_5",        c.spin  >= 5],
    ["planner_week",  c.planner_full >= 1],
    ["explorer_10",   c.explore >= 10],
    ["fav_10",        c.fav   >= 10],
    ["voice_cook",    c.voice >= 1],
    ["streak_3",      s.streak >= 3],
    ["streak_7",      s.streak >= 7],
    ["perfect_match", c.perfect >= 1],
  ];
  checks.forEach(([id, met]) => {
    if (met && !s.unlocked.includes(id)) {
      s.unlocked.push(id);
      saveState(s);
      const ach = ACHIEVEMENTS.find(a => a.id === id);
      if (ach) {
        setTimeout(() => {
          showAchievementPopup(ach);
          awardXP(ach.xp, `Achievement: ${ach.title}`);
        }, 400);
      }
    }
  });
}

// ─── Streak ───────────────────────────────────────────────────────────────────
export function recordCook() {
  const s    = loadState();
  const today = new Date().toDateString();
  const yesterday = new Date(Date.now() - 86400000).toDateString();

  if (s.lastCookDate === today) return; // already recorded today

  s.streak = s.lastCookDate === yesterday ? (s.streak || 0) + 1 : 1;
  s.lastCookDate = today;
  s.counters.cook = (s.counters.cook || 0) + 1;
  saveState(s);
  checkAchievements(s);
  renderHUD();
}

// ─── HUD rendering ────────────────────────────────────────────────────────────
export function renderHUD() {
  const hud = document.getElementById("xp-hud");
  if (!hud) return;
  const s       = loadState();
  const level   = getLevel(s.xp);
  const { progress, needed } = xpToNextLevel(s.xp);
  const isMax   = level.index === LEVELS.length - 1;

  hud.innerHTML = `
    <button class="xp-hud__pill" id="xp-hud-toggle" title="View achievements">
      <span class="xp-level-icon">${level.icon}</span>
      <div class="xp-details">
        <div class="xp-level-name">${level.name}</div>
        <div class="xp-bar-wrap">
          <div class="xp-bar-fill" style="width:${progress}%;background:${level.color}"></div>
        </div>
        <div class="xp-numbers">${s.xp.toLocaleString()} XP ${isMax ? "(MAX)" : `· ${needed} to next`}</div>
      </div>
      ${s.streak > 0 ? `<div class="xp-streak" title="${s.streak}-day streak">🔥${s.streak}</div>` : ""}
    </button>`;

  hud.querySelector("#xp-hud-toggle")?.addEventListener("click", openAchievementsPanel);
}

// ─── Achievements panel ───────────────────────────────────────────────────────
function openAchievementsPanel() {
  const s      = loadState();
  const level  = getLevel(s.xp);
  const { progress, needed } = xpToNextLevel(s.xp);
  const isMax  = level.index === LEVELS.length - 1;

  const el = document.createElement("div");
  el.id = "achievements-overlay";
  el.innerHTML = `
    <div class="ach-panel glass-card">
      <div class="ach-header">
        <h2 class="ach-title">🏅 Your Progress</h2>
        <button class="modal-close" id="ach-close">✕</button>
      </div>

      <!-- Level card -->
      <div class="ach-level-card" style="--level-color:${level.color}">
        <div class="ach-level-icon">${level.icon}</div>
        <div>
          <div class="ach-level-name">${level.name}</div>
          <div class="ach-xp">${s.xp.toLocaleString()} XP total</div>
          <div class="ach-progress-wrap">
            <div class="ach-progress-fill" style="width:${progress}%;background:${level.color}"></div>
          </div>
          <div class="ach-progress-label">${isMax ? "👑 Max Level!" : `${needed} XP to next level`}</div>
        </div>
      </div>

      <!-- All levels -->
      <div class="ach-levels-row">
        ${LEVELS.map((l, i) => `
          <div class="ach-level-step ${l.index <= level.index ? "unlocked" : ""}" style="--c:${l.color}">
            <div class="ach-step-icon">${l.icon}</div>
            <div class="ach-step-name">${l.name}</div>
            <div class="ach-step-xp">${l.min} XP</div>
          </div>`).join("")}
      </div>

      <!-- Streak -->
      ${s.streak > 0 ? `
        <div class="ach-streak-bar">
          🔥 <strong>${s.streak}-day</strong> cooking streak — keep it going!
        </div>` : ""}

      <!-- Achievements grid -->
      <h3 class="ach-section-title">Achievements <span class="section-count">${s.unlocked.length}/${ACHIEVEMENTS.length}</span></h3>
      <div class="ach-grid">
        ${ACHIEVEMENTS.map(a => {
          const done = s.unlocked.includes(a.id);
          return `
            <div class="ach-badge ${done ? "ach-badge--done" : "ach-badge--locked"}" title="${a.desc}">
              <div class="ach-badge-icon">${done ? a.icon : "🔒"}</div>
              <div class="ach-badge-name">${a.title}</div>
              <div class="ach-badge-desc">${a.desc}</div>
              ${done ? `<div class="ach-badge-xp">+${a.xp} XP</div>` : ""}
            </div>`;
        }).join("")}
      </div>
    </div>`;

  document.body.appendChild(el);
  el.querySelector("#ach-close").addEventListener("click", () => el.remove());
  el.addEventListener("click", e => { if (e.target === el) el.remove(); });
}

// ─── Toasts / popups ─────────────────────────────────────────────────────────
function showXPPopup(amount, reason) {
  const el = document.createElement("div");
  el.className = "xp-popup";
  el.innerHTML = `<span class="xp-popup-amount">+${amount} XP</span><span class="xp-popup-reason">${reason}</span>`;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 2200);
}

function showLevelUp(level) {
  const el = document.createElement("div");
  el.className = "levelup-popup";
  el.innerHTML = `
    <div class="levelup-inner">
      <div class="levelup-icon">${level.icon}</div>
      <div class="levelup-text">
        <div class="levelup-label">Level Up!</div>
        <div class="levelup-name">${level.name}</div>
      </div>
    </div>`;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 3500);
}

export function showAchievementPopup(ach) {
  const el = document.createElement("div");
  el.className = "achievement-popup";
  el.innerHTML = `
    <div class="achievement-inner">
      <div class="achievement-icon">${ach.icon}</div>
      <div class="achievement-text">
        <div class="achievement-label">🏅 Achievement Unlocked!</div>
        <div class="achievement-title">${ach.title}</div>
        <div class="achievement-desc">${ach.desc}</div>
      </div>
    </div>`;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 4000);
}

// Init HUD on load
document.addEventListener("DOMContentLoaded", renderHUD);

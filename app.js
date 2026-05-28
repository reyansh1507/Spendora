// ═══════════════════════════════════════════════════
//  SPENDORA — app.js   (Vanilla JS, no framework)
// ═══════════════════════════════════════════════════

// ── CONSTANTS ──────────────────────────────────────
const MONTHS   = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const WEEKDAYS = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
const EXP_CATS = ["🍔 Food","🚗 Transport","🛍️ Shopping","💊 Health","🎬 Entertainment","📚 Education","🏠 Housing","⚡ Utilities","📦 Other"];
const SUB_CATS = ["🎬 Streaming","🎵 Music","☁️ Cloud","🎮 Gaming","📰 News","🏋️ Fitness","💼 Productivity","🔒 Security","📦 Other"];
const SUB_CYCLES   = ["Monthly","Yearly","Quarterly","Weekly"];
const SUB_STATUSES = ["✅ Active","⏸️ Paused","❌ Cancelled"];
const CAT_COLORS   = ["#c0392b","#e74c3c","#f59e0b","#10b981","#3b82f6","#8b5cf6","#ec4899","#06b6d4","#84cc16"];

// ── STORAGE HELPERS ────────────────────────────────
const S = {
  get(k, def = null) {
    try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : def; } catch { return def; }
  },
  set(k, v) {
    try { localStorage.setItem(k, JSON.stringify(v)); } catch {}
  },
  del(k) {
    try { localStorage.removeItem(k); } catch {}
  }
};

// ── UTILITY FUNCTIONS ──────────────────────────────
function pad(n)       { return String(n).padStart(2, "0"); }
function dateKey(d)   { return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`; }
function monthKey(d)  { return `${d.getFullYear()}-${pad(d.getMonth()+1)}`; }
function inr(n)       { return "₹ " + Math.round(n).toLocaleString("en-IN"); }
function toMonthly(amt, cycle) {
  if (cycle === "Monthly")   return amt;
  if (cycle === "Yearly")    return amt / 12;
  if (cycle === "Quarterly") return amt / 3;
  if (cycle === "Weekly")    return amt * 4.33;
  return amt;
}
function el(id)       { return document.getElementById(id); }
function text(id, v)  { const e = el(id); if (e) e.textContent = v; }
function show(id)     { const e = el(id); if (e) e.classList.remove("hidden"); }
function hide(id)     { const e = el(id); if (e) e.classList.add("hidden"); }

// ── APP STATE ──────────────────────────────────────
let currentUser    = null;
let currentPage    = "dashboard";
let budget         = 0;
let expenseDate    = new Date();
let subsDate       = new Date();
let calViewDate    = new Date();
let calSelectedDate = new Date();
let authMode       = "signin";

// ── TOAST ──────────────────────────────────────────
function showToast(msg, type = "success") {
  const container = el("toast-container");
  const div = document.createElement("div");
  div.className = `toast toast-${type}`;
  div.textContent = msg;
  container.appendChild(div);
  setTimeout(() => { div.style.opacity = "0"; div.style.transform = "translateY(8px)"; div.style.transition = "0.3s"; setTimeout(() => div.remove(), 300); }, 3000);
}

// ── AUTH ───────────────────────────────────────────
function initAuth() {
  // Seed demo user
  const users = S.get("spendora_users", {});
  if (!users["demo@spendora.app"]) {
    users["demo@spendora.app"] = { name: "Demo User", pass: "demo123" };
    S.set("spendora_users", users);
  }

  el("auth-toggle").addEventListener("click", () => switchAuthMode(authMode === "signin" ? "signup" : "signin"));
  el("auth-submit").addEventListener("click", handleAuthSubmit);
  el("auth-email").addEventListener("keydown", e => { if (e.key === "Enter") handleAuthSubmit(); });
  el("auth-pass").addEventListener("keydown",  e => { if (e.key === "Enter") handleAuthSubmit(); });
  el("auth-confirm-pass").addEventListener("keydown", e => { if (e.key === "Enter") handleAuthSubmit(); });

  // Check existing session
  const session = S.get("spendora_session");
  if (session) {
    currentUser = session;
    budget = S.get("spendora_budget", 0);
    showApp();
  }
}

function switchAuthMode(mode) {
  authMode = mode;
  const card = el("auth-card");
  card.style.opacity = "0";
  card.style.transform = "scale(0.98)";
  setTimeout(() => {
    el("auth-title").textContent = mode === "signin" ? "Welcome Back" : "Create Account";
    el("auth-submit").textContent = mode === "signin" ? "Sign In" : "Sign Up";
    const nameField = el("auth-name");
    const confirmField = el("auth-confirm-pass");
    if (mode === "signup") {
      nameField.classList.remove("hidden");
      confirmField.classList.remove("hidden");
    } else {
      nameField.classList.add("hidden");
      confirmField.classList.add("hidden");
      confirmField.value = "";
    }
    el("auth-demo").style.display = mode === "signin" ? "" : "none";
    const toggle = el("auth-toggle");
    toggle.textContent = mode === "signin" ? "Sign Up" : "Sign In";
    toggle.previousSibling.textContent = mode === "signin" ? "Don't have an account? " : "Already have an account? ";
    hideAuthError();
    card.style.opacity = "1";
    card.style.transform = "scale(1)";
    card.style.transition = "opacity 0.3s, transform 0.3s";
  }, 280);
}

function showAuthError(msg) {
  const e = el("auth-error");
  e.textContent = msg;
  e.classList.remove("hidden");
}
function hideAuthError() { el("auth-error").classList.add("hidden"); }

function handleAuthSubmit() {
  hideAuthError();
  const email       = el("auth-email").value.trim();
  const pass        = el("auth-pass").value;
  const confirmPass = el("auth-confirm-pass").value;
  const name        = el("auth-name").value.trim();

  if (!email || !pass)                            return showAuthError("Please fill in all fields.");
  if (authMode === "signup" && !name)             return showAuthError("Name is required.");
  if (authMode === "signup" && pass.length < 6)   return showAuthError("Password must be at least 6 characters.");
  if (authMode === "signup" && pass !== confirmPass) return showAuthError("Passwords do not match.");

  const users = S.get("spendora_users", {});

  if (authMode === "signup") {
    if (users[email]) return showAuthError("Email already registered.");
    users[email] = { name, pass };
    S.set("spendora_users", users);
    S.set("spendora_session", { email, name });
    currentUser = { email, name };
  } else {
    if (!users[email] || users[email].pass !== pass) return showAuthError("Invalid email or password.");
    S.set("spendora_session", { email, name: users[email].name });
    currentUser = { email, name: users[email].name };
  }

  budget = S.get("spendora_budget", 0);
  showApp();
  showToast(`Welcome back, ${currentUser.name.split(" ")[0]}! 👋`);
}

function handleLogout() {
  S.del("spendora_session");
  currentUser = null;
  budget = 0;
  currentPage = "dashboard";
  hide("app");
  show("auth-page");
  el("auth-email").value = "";
  el("auth-pass").value  = "";
  el("auth-name").value  = "";
  el("auth-confirm-pass").value = "";
  switchAuthMode("signin");
}

function showApp() {
  hide("auth-page");
  show("app");
  updateNavUser();
  navigateTo("dashboard");
}

// ── NAVBAR ─────────────────────────────────────────
function initNavbar() {
  document.querySelectorAll(".nav-link").forEach(btn => {
    btn.addEventListener("click", () => navigateTo(btn.dataset.page));
  });
  el("user-pill").addEventListener("click", e => {
    e.stopPropagation();
    el("user-menu").classList.toggle("hidden");
  });
  document.addEventListener("click", () => el("user-menu").classList.add("hidden"));

  document.querySelectorAll(".um-link[data-page]").forEach(btn => {
    btn.addEventListener("click", () => { navigateTo(btn.dataset.page); el("user-menu").classList.add("hidden"); });
  });
  el("logout-btn").addEventListener("click", handleLogout);

  el("hamburger").addEventListener("click", () => el("mobile-menu").classList.toggle("hidden"));
  document.querySelectorAll(".mobile-link[data-page]").forEach(btn => {
    btn.addEventListener("click", () => { navigateTo(btn.dataset.page); el("mobile-menu").classList.add("hidden"); });
  });

  el("set-budget-btn").addEventListener("click", openBudgetModal);
  el("mobile-budget-btn").addEventListener("click", () => { el("mobile-menu").classList.add("hidden"); openBudgetModal(); });
  el("nav-brand").addEventListener("click", () => navigateTo("dashboard"));

  // Alert bell scrolls to alert panel
  const bell = el("nav-alert-bell");
  if (bell) {
    bell.addEventListener("click", () => {
      navigateTo("dashboard");
      setTimeout(() => {
        const panel = document.querySelector(".alerts-panel");
        if (panel) panel.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 200);
    });
  }
}

function updateNavUser() {
  if (!currentUser) return;
  el("nav-avatar").textContent   = currentUser.name ? currentUser.name[0].toUpperCase() : "U";
  el("nav-username").textContent = currentUser.name ? currentUser.name.split(" ")[0] : "User";
  el("um-email").textContent     = currentUser.email || "";
}

function navigateTo(page) {
  currentPage = page;
  document.querySelectorAll(".page").forEach(p => p.classList.add("hidden"));
  show(`page-${page}`);
  document.querySelectorAll(".nav-link").forEach(b => {
    b.classList.toggle("active", b.dataset.page === page);
  });
  document.querySelectorAll(".mobile-link").forEach(b => {
    b.classList.toggle("active", b.dataset.page === page);
  });
  // Update body class for per-page reactive bg
  document.body.className = document.body.className.replace(/\bpage-\S+/g, "").trim();
  document.body.classList.add(`page-${page}`);

  if (page === "dashboard")  renderDashboard();
  if (page === "expenses")   renderExpensesPage();
  if (page === "subs")       renderSubsPage();
  if (page === "analytics")  renderAnalyticsPage();
}

// ── BUDGET MODAL ───────────────────────────────────
function initBudgetModal() {
  el("budget-modal-close").addEventListener("click", closeBudgetModal);
  el("budget-modal").addEventListener("click", e => { if (e.target === el("budget-modal")) closeBudgetModal(); });
  el("budget-confirm-btn").addEventListener("click", confirmBudget);
  el("budget-input").addEventListener("keydown", e => { if (e.key === "Enter") confirmBudget(); });
}
function openBudgetModal() {
  el("budget-input").value = budget ? String(budget) : "";
  show("budget-modal");
  setTimeout(() => el("budget-input").focus(), 50);
}
function closeBudgetModal() { hide("budget-modal"); }
function confirmBudget() {
  const val = parseFloat(el("budget-input").value);
  if (!isNaN(val) && val > 0) {
    budget = val;
    S.set("spendora_budget", val);
    showToast(`Budget set to ${inr(val)} 💰`);
    if (currentPage === "dashboard")  renderDashboard();
    if (currentPage === "analytics")  renderAnalyticsPage();
  }
  closeBudgetModal();
}

// ══════════════════════════════════════════════════
//  SMART ALERT ENGINE
// ══════════════════════════════════════════════════

/**
 * Generates an array of alert objects based on:
 * - Budget status (exceeded / critical / warning / caution / not set)
 * - Subscriptions renewing in ≤5 days
 * - High subscription cost relative to budget
 * - All-clear status
 *
 * Each alert: { type, icon, title, msg, color }
 * Types: critical | danger | warning | caution | info | success
 */
function generateAlerts(today) {
  const y = today.getFullYear(), m = today.getMonth();
  const todayDay = today.getDate();
  const mk = `${y}-${pad(m+1)}`;
  const subsRows = S.get(`spendora_subs_${mk}`, []);
  const activeSubs = subsRows.filter(r => r.status !== "❌ Cancelled");

  // Monthly personal spending
  let monthlyPersonal = 0;
  for (let d = 1; d <= new Date(y, m+1, 0).getDate(); d++) {
    S.get(`spendora_personal_${y}-${pad(m+1)}-${pad(d)}`, [])
     .forEach(r => { monthlyPersonal += parseFloat(r.amt) || 0; });
  }

  const monthlySubs  = activeSubs.reduce((a, r) => a + toMonthly(parseFloat(r.amt)||0, r.cycle), 0);
  const totalSpent   = monthlyPersonal + monthlySubs;
  const budgetPct    = budget > 0 ? (totalSpent / budget) * 100 : 0;
  const daysInMonth  = new Date(y, m+1, 0).getDate();

  const alerts = [];

  // ── Budget alerts ──────────────────────────────
  if (budget > 0) {
    if (totalSpent > budget) {
      const overBy = totalSpent - budget;
      alerts.push({
        type: "critical", icon: "🚨",
        title: "Budget Exceeded!",
        msg: `Over by ${inr(Math.round(overBy))} — reduce spending now`,
        color: "#ef4444"
      });
    } else if (budgetPct >= 90) {
      alerts.push({
        type: "danger", icon: "⚠️",
        title: "Budget Almost Gone",
        msg: `${budgetPct.toFixed(0)}% used · Only ${inr(Math.round(budget - totalSpent))} left`,
        color: "#f97316"
      });
    } else if (budgetPct >= 75) {
      alerts.push({
        type: "warning", icon: "📊",
        title: "Budget Running Low",
        msg: `${budgetPct.toFixed(0)}% of budget used this month`,
        color: "#f59e0b"
      });
    }

    // High subscription share of budget
    const subPct = (monthlySubs / budget) * 100;
    if (subPct >= 40 && budget > 0) {
      alerts.push({
        type: "caution", icon: "📋",
        title: "High Subscription Load",
        msg: `Subscriptions use ${subPct.toFixed(0)}% of your budget (${inr(Math.round(monthlySubs))}/mo)`,
        color: "#8b5cf6"
      });
    }
  } else {
    alerts.push({
      type: "info", icon: "💡",
      title: "No Budget Set",
      msg: "Click 'Set Budget' to start tracking your spending limits",
      color: "#3b82f6"
    });
  }

  // ── Subscription renewal alerts (≤ 5 days) ────
  const renewingSoon = [];
  activeSubs.forEach(s => {
    if (!s.due || s.cycle !== "Monthly") return; // Only monthly has meaningful due-day tracking
    const due = parseInt(s.due);
    if (isNaN(due)) return;

    let daysLeft;
    if (due >= todayDay) {
      daysLeft = due - todayDay;
    } else {
      // Next month's renewal
      daysLeft = daysInMonth - todayDay + due;
    }

    if (daysLeft <= 5) {
      renewingSoon.push({ sub: s, daysLeft });
    }
  });

  // Sort renewals: soonest first
  renewingSoon.sort((a, b) => a.daysLeft - b.daysLeft);

  renewingSoon.forEach(({ sub, daysLeft }) => {
    const isToday = daysLeft === 0;
    const icon  = isToday ? "🔴" : daysLeft <= 2 ? "🟠" : "🟡";
    const color = isToday ? "#ef4444" : daysLeft <= 2 ? "#f97316" : "#eab308";
    const type  = isToday ? "critical" : daysLeft <= 2 ? "danger" : "warning";
    const name  = sub.name || "Subscription";
    const amt   = inr(parseFloat(sub.amt) || 0);
    alerts.push({
      type, icon,
      title: `${name} renews ${isToday ? "today!" : `in ${daysLeft} day${daysLeft === 1 ? "" : "s"}`}`,
      msg: `${amt} will be charged${isToday ? " today" : ` on day ${sub.due}`}`,
      color
    });
  });

  // ── Today's spending spike alert ──────────────
  const todayRows = S.get(`spendora_personal_${dateKey(today)}`, []);
  const todayTotal = todayRows.reduce((a, r) => a + (parseFloat(r.amt) || 0), 0);
  if (budget > 0) {
    const dailyBudget = budget / daysInMonth;
    if (todayTotal > dailyBudget * 2 && todayTotal > 0) {
      alerts.push({
        type: "caution", icon: "💸",
        title: "High Spending Today",
        msg: `Today: ${inr(Math.round(todayTotal))} · Daily avg budget: ${inr(Math.round(dailyBudget))}`,
        color: "#ec4899"
      });
    }
  }

  // ── All clear ─────────────────────────────────
  const isProblematic = alerts.some(a => ["critical","danger","warning"].includes(a.type));
  if (!isProblematic && budget > 0) {
    alerts.push({
      type: "success", icon: "✅",
      title: "All Clear — Finances on Track",
      msg: `${budgetPct.toFixed(0)}% of budget used · ${inr(Math.round(budget - totalSpent))} remaining`,
      color: "#10b981"
    });
  }

  return { alerts, monthlySubs, urgentCount: alerts.filter(a => ["critical","danger"].includes(a.type)).length };
}

// ── Render the Smart Alerts Panel ─────────────────
function renderAlertPanel() {
  const today = new Date();
  const { alerts, monthlySubs, urgentCount } = generateAlerts(today);

  // Update navbar bell badge
  const bellBadge = el("bell-badge");
  const navBell   = el("nav-alert-bell");
  if (bellBadge && navBell) {
    if (urgentCount > 0) {
      bellBadge.textContent = urgentCount;
      bellBadge.classList.remove("hidden");
      navBell.classList.add("has-alerts");
    } else {
      bellBadge.classList.add("hidden");
      navBell.classList.remove("has-alerts");
    }
  }

  // Update panel badge
  const panelBadge = el("alert-count-badge");
  if (panelBadge) {
    if (urgentCount > 0) {
      panelBadge.textContent = urgentCount;
      panelBadge.classList.remove("hidden");
    } else {
      panelBadge.classList.add("hidden");
    }
  }

  // Render alert items
  const alertsList = el("alerts-list-dash");
  if (!alertsList) return;
  alertsList.innerHTML = "";

  alerts.forEach((alert, i) => {
    const div = document.createElement("div");
    div.className = `alert-item alert-${alert.type}`;
    div.style.setProperty("--alert-color", alert.color);
    div.style.animationDelay = `${i * 0.06}s`;
    div.innerHTML = `
      <span class="alert-icon">${alert.icon}</span>
      <div class="alert-content">
        <div class="alert-title">${escHtml(alert.title)}</div>
        <div class="alert-msg">${escHtml(alert.msg)}</div>
      </div>`;
    alertsList.appendChild(div);
  });

  // Subscriptions mini-list below alerts
  const mk = monthKey(today);
  const subsRows = S.get(`spendora_subs_${mk}`, []);
  const activeSubs = subsRows.filter(r => r.status !== "❌ Cancelled");

  if (activeSubs.length > 0) {
    const subHeader = document.createElement("div");
    subHeader.className = "alerts-sub-header";
    subHeader.textContent = `Active Subscriptions (${activeSubs.length})`;
    alertsList.appendChild(subHeader);

    const todayDay = today.getDate();
    const daysInMonth = new Date(today.getFullYear(), today.getMonth()+1, 0).getDate();

    activeSubs.slice(0, 5).forEach(s => {
      let daysLeft = null;
      if (s.due && s.cycle === "Monthly") {
        const due = parseInt(s.due);
        daysLeft = due >= todayDay ? due - todayDay : daysInMonth - todayDay + due;
      }

      const isTodayDue  = daysLeft === 0;
      const isSoon      = daysLeft !== null && daysLeft > 0 && daysLeft <= 5;

      const div = document.createElement("div");
      div.className = "sub-row";
      let badgeClass = "sub-badge-normal";
      let badgeText  = inr(parseFloat(s.amt) || 0);
      if (isTodayDue) { badgeClass = "sub-badge-today";  badgeText = "⚡ Today"; }
      else if (isSoon){ badgeClass = "sub-badge-soon";   badgeText = `⏰ ${daysLeft}d`; }

      div.innerHTML = `
        <span class="sub-row-name">${escHtml(s.name || "Unnamed")}</span>
        <span class="sub-row-badge ${badgeClass}">${badgeText}</span>`;
      alertsList.appendChild(div);
    });

    if (activeSubs.length > 5) {
      const more = document.createElement("div");
      more.style.cssText = "font-size:0.68rem;color:#444;text-align:center;padding:4px 0;";
      more.textContent = `+${activeSubs.length - 5} more in Subscriptions tab`;
      alertsList.appendChild(more);
    }
  }

  text("subs-total-dash", inr(Math.round(monthlySubs)));
}

// ══════════════════════════════════════════════════
//  DASHBOARD
// ══════════════════════════════════════════════════
function renderDashboard() {
  if (!currentUser) return;

  const today   = new Date();
  const dk      = dateKey(calSelectedDate);
  const mk      = monthKey(calSelectedDate);
  const dailyRows  = S.get(`spendora_personal_${dk}`, []);
  const subsRows   = S.get(`spendora_subs_${mk}`, []);

  const dailyTotal = dailyRows.reduce((a, r) => a + (parseFloat(r.amt) || 0), 0);

  const y = calSelectedDate.getFullYear(), m = calSelectedDate.getMonth();
  let monthlyPersonal = 0;
  for (let d = 1; d <= new Date(y, m+1, 0).getDate(); d++) {
    S.get(`spendora_personal_${y}-${pad(m+1)}-${pad(d)}`, [])
     .forEach(r => { monthlyPersonal += parseFloat(r.amt) || 0; });
  }

  const monthlySubs  = subsRows.filter(r => r.status !== "❌ Cancelled")
    .reduce((a, r) => a + toMonthly(parseFloat(r.amt)||0, r.cycle), 0);
  const totalSpent   = monthlyPersonal + monthlySubs;
  const budgetPct    = budget > 0 ? (totalSpent / budget) * 100 : 0;
  const spentPct     = totalSpent > 0 ? (monthlyPersonal / totalSpent) * 100 : 0;
  const remaining    = budget - totalSpent;
  const activeSubs   = subsRows.filter(r => r.status !== "❌ Cancelled");

  // Greeting
  const hour = today.getHours();
  text("time-of-day", hour < 12 ? "Morning" : hour < 17 ? "Afternoon" : "Evening");
  text("greeting-name", currentUser.name.split(" ")[0]);
  text("greeting-sub", `${MONTHS[today.getMonth()]} ${today.getFullYear()} — Financial Overview`);

  // Stat cards
  const statGrid = el("dash-stat-grid");
  statGrid.innerHTML = "";
  const cards = [
    { label:"Monthly Budget", value: budget > 0 ? inr(budget) : "Not Set", sub: budget > 0 ? `${budgetPct.toFixed(0)}% used` : "Click Set Budget", accent:"#3b82f6" },
    { label:"Total Spent",    value: inr(totalSpent),     sub:"Personal + Subs",    accent:"#c0392b" },
    { label:"Remaining",      value: remaining >= 0 ? inr(Math.abs(remaining)) : `${inr(Math.abs(remaining))} over!`,
      sub: remaining < 0 ? "⚠ Over budget" : "Available", accent: remaining < 0 ? "#ef4444" : "#10b981" },
    { label:"Daily Expenses", value: dailyTotal > 0 ? inr(dailyTotal) : "₹ 0", sub: dateKey(calSelectedDate) === dateKey(today) ? "Today" : dk, accent:"#f59e0b" },
    { label:"Active Subs",    value: activeSubs.length, sub:`${inr(Math.round(monthlySubs))}/mo`, accent:"#8b5cf6" },
  ];
  cards.forEach(c => statGrid.appendChild(createStatCard(c)));

  // Calendar
  renderCalendar();

  // Day info
  const isToday = dateKey(calSelectedDate) === dateKey(today);
  text("day-info-label", isToday ? "Today" : dk);
  text("day-info-total", inr(dailyTotal));
  text("day-info-sub",   `${dailyRows.length} expense${dailyRows.length !== 1 ? "s" : ""} recorded`);

  // Day donut
  const catMap = {};
  dailyRows.forEach(r => { const k = r.cat||"📦 Other"; catMap[k] = (catMap[k]||0) + (parseFloat(r.amt)||0); });
  const donutData = Object.entries(catMap).map(([k,v],i) => ({ label:k, value:v, color:CAT_COLORS[i%CAT_COLORS.length] }));
  const dayDonut = el("day-donut-area");
  dayDonut.innerHTML = "";
  if (donutData.length > 0) {
    const wrap = document.createElement("div");
    wrap.style.cssText = "display:flex;align-items:center;gap:16px;margin-top:14px;";
    wrap.appendChild(buildDonutSVG(donutData, 100, 18));
    const legend = document.createElement("div");
    legend.style.cssText = "flex:1;display:flex;flex-direction:column;gap:5px;";
    donutData.slice(0,4).forEach(d => {
      legend.innerHTML += `<div style="display:flex;align-items:center;gap:7px;">
        <div style="width:7px;height:7px;border-radius:50%;background:${d.color};flex-shrink:0;"></div>
        <div style="font-size:0.7rem;color:#888;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${d.label.split(" ").slice(1).join(" ")}</div>
        <div style="font-family:Rajdhani,sans-serif;font-size:0.72rem;font-weight:700;color:#f0f0f0;">${inr(d.value)}</div>
      </div>`;
    });
    wrap.appendChild(legend);
    dayDonut.appendChild(wrap);
  }

  // Progress bars
  el("dash-budget-value").textContent  = budget > 0 ? `${inr(totalSpent)} / ${inr(budget)}` : "No budget set";
  setBar("dash-budget-bar", budgetPct,  budgetPct > 100 ? "over-budget" : "blue-fill");
  el("dash-budget-sub").textContent    = budget > 0
    ? (remaining >= 0 ? `${inr(remaining)} remaining` : `${inr(Math.abs(remaining))} over budget!`)
    : "Set a monthly budget to track spending";
  el("dash-spent-value").textContent   = inr(totalSpent);
  setBar("dash-spent-bar", spentPct, "red-fill");
  el("dash-spent-sub").textContent     = `Personal: ${inr(monthlyPersonal)} · Subs: ${inr(Math.round(monthlySubs))}`;

  // Last 7 days bar chart
  const last7 = Array.from({length:7}, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() - (6-i));
    const rows = S.get(`spendora_personal_${dateKey(d)}`, []);
    return { v: rows.reduce((a,r) => a+(parseFloat(r.amt)||0), 0), l: WEEKDAYS[d.getDay()] };
  });
  el("last7-chart").innerHTML = "";
  el("last7-chart").appendChild(buildBarChart(last7, "#c0392b", "Last 7 Days Spending"));

  // ── Smart Alerts Panel ──
  renderAlertPanel();
}

// ── CALENDAR RENDER ────────────────────────────────
function renderCalendar() {
  const y = calViewDate.getFullYear(), m = calViewDate.getMonth();
  const firstDay = new Date(y, m, 1).getDay();
  const lastDate = new Date(y, m+1, 0).getDate();
  const today    = new Date();

  const widget = el("calendar-widget");
  widget.innerHTML = `
    <div class="calendar-widget">
      <div class="cal-header">
        <button class="cal-nav-btn" id="cal-prev">‹</button>
        <span class="cal-month-title">${MONTHS[m].slice(0,3)} ${y}</span>
        <button class="cal-nav-btn" id="cal-next">›</button>
      </div>
      <div class="cal-body">
        <div class="cal-weekdays">${WEEKDAYS.map(d=>`<div class="cal-wd">${d[0]}</div>`).join("")}</div>
        <div class="cal-days" id="cal-days"></div>
      </div>
    </div>`;

  el("cal-prev").addEventListener("click", () => {
    const d = new Date(calViewDate); d.setMonth(d.getMonth()-1); calViewDate = d; renderCalendar();
  });
  el("cal-next").addEventListener("click", () => {
    const d = new Date(calViewDate); d.setMonth(d.getMonth()+1); calViewDate = d; renderCalendar();
  });

  const grid = el("cal-days");
  for (let i = 0; i < firstDay; i++) {
    const e = document.createElement("div"); e.className = "cal-empty"; grid.appendChild(e);
  }
  for (let d = 1; d <= lastDate; d++) {
    const cell  = document.createElement("div");
    const thisD = new Date(y, m, d);
    const dk    = dateKey(thisD);
    const rows  = S.get(`spendora_personal_${dk}`, []);
    const isT   = dk === dateKey(today);
    const isSel = dk === dateKey(calSelectedDate);

    cell.className = ["cal-day", isT?"today":"", isSel?"selected":"", rows.length>0?"has-data":""].filter(Boolean).join(" ");
    cell.textContent = d;
    cell.addEventListener("click", () => {
      calSelectedDate = thisD;
      renderDashboard();
    });
    grid.appendChild(cell);
  }
}

// ══════════════════════════════════════════════════
//  EXPENSES PAGE
// ══════════════════════════════════════════════════
function renderExpensesPage() {
  expenseDate = expenseDate || new Date();
  updateExpDateUI();
  loadExpenseRows();

  el("exp-prev").onclick = () => { const d = new Date(expenseDate); d.setDate(d.getDate()-1); expenseDate = d; updateExpDateUI(); loadExpenseRows(); };
  el("exp-next").onclick = () => { const d = new Date(expenseDate); d.setDate(d.getDate()+1); expenseDate = d; updateExpDateUI(); loadExpenseRows(); };
  el("add-exp-btn").onclick  = addExpenseRow;
  el("clear-exp-btn").onclick = clearExpenses;
}

function updateExpDateUI() {
  const isToday = dateKey(expenseDate) === dateKey(new Date());
  text("exp-day-label",  isToday ? "TODAY" : WEEKDAYS[expenseDate.getDay()].toUpperCase());
  text("exp-date-title", `${expenseDate.getDate()} ${MONTHS[expenseDate.getMonth()].slice(0,3)} ${expenseDate.getFullYear()}`);
}

function getExpKey()  { return `spendora_personal_${dateKey(expenseDate)}`; }
function getExpRows() { return S.get(getExpKey(), []); }
function saveExpRows(rows) { S.set(getExpKey(), rows); }

function loadExpenseRows() {
  const rows = getExpRows();
  const tbody = el("expenses-tbody");
  tbody.innerHTML = "";
  if (rows.length === 0) { show("exp-empty"); }
  else { hide("exp-empty"); rows.forEach(row => tbody.appendChild(createExpRow(row))); }
  updateExpSummary(rows);
}

function createExpRow(row) {
  const tr = document.createElement("tr");
  tr.dataset.id = row.id;
  tr.innerHTML = `
    <td><input class="table-input" placeholder="Description" value="${escHtml(row.desc||"")}" data-field="desc"/></td>
    <td><select class="table-select">${EXP_CATS.map(c => `<option${c===row.cat?" selected":""}>${c}</option>`).join("")}</select></td>
    <td><input class="table-input table-input-right" type="number" placeholder="0" min="0" value="${row.amt||""}" data-field="amt"/></td>
    <td><button class="del-btn">✕</button></td>`;
  tr.querySelector("[data-field=desc]").addEventListener("input",  e => updateExpRow(row.id, "desc", e.target.value));
  tr.querySelector("select").addEventListener("change",            e => updateExpRow(row.id, "cat",  e.target.value));
  tr.querySelector("[data-field=amt]").addEventListener("input",   e => updateExpRow(row.id, "amt",  e.target.value));
  tr.querySelector(".del-btn").addEventListener("click", () => deleteExpRow(row.id));
  return tr;
}

function addExpenseRow() {
  const rows = getExpRows();
  rows.push({ id: Date.now(), desc: "", cat: EXP_CATS[0], amt: "" });
  saveExpRows(rows);
  loadExpenseRows();
}
function updateExpRow(id, field, val) {
  const rows = getExpRows().map(r => r.id === id ? {...r, [field]: val} : r);
  saveExpRows(rows);
  updateExpSummary(rows);
}
function deleteExpRow(id) {
  const rows = getExpRows().filter(r => r.id !== id);
  saveExpRows(rows);
  loadExpenseRows();
  showToast("Row deleted");
}
function clearExpenses() {
  if (getExpRows().length === 0) return;
  saveExpRows([]);
  loadExpenseRows();
  showToast("All rows cleared");
}

function updateExpSummary(rows) {
  const total   = rows.reduce((a,r) => a+(parseFloat(r.amt)||0), 0);
  const largest = rows.length ? Math.max(...rows.map(r => parseFloat(r.amt)||0)) : 0;
  text("exp-count",   rows.length);
  text("exp-total",   inr(total));
  text("exp-largest", inr(largest));

  const catMap = {};
  rows.forEach(r => { const k = r.cat||"📦 Other"; catMap[k] = (catMap[k]||0) + (parseFloat(r.amt)||0); });
  const donutData = Object.entries(catMap).map(([k,v],i) => ({ label:k, value:v, color:CAT_COLORS[i%CAT_COLORS.length] }));
  const area = el("exp-donut-summary");
  area.innerHTML = "";
  if (donutData.length > 0) area.appendChild(buildDonutSVG(donutData, 72, 14));
}

// ══════════════════════════════════════════════════
//  SUBSCRIPTIONS PAGE
// ══════════════════════════════════════════════════
function renderSubsPage() {
  subsDate = subsDate || new Date();
  updateSubsDateUI();
  loadSubsRows();

  el("subs-prev").onclick = () => { const d = new Date(subsDate); d.setMonth(d.getMonth()-1); subsDate = d; updateSubsDateUI(); loadSubsRows(); };
  el("subs-next").onclick = () => { const d = new Date(subsDate); d.setMonth(d.getMonth()+1); subsDate = d; updateSubsDateUI(); loadSubsRows(); };
  el("add-sub-btn").onclick  = addSubRow;
  el("clear-sub-btn").onclick = clearSubs;
}

function updateSubsDateUI() {
  el("subs-month-title").textContent = `${MONTHS[subsDate.getMonth()]} ${subsDate.getFullYear()}`;
}

function getSubsKey()  { return `spendora_subs_${monthKey(subsDate)}`; }
function getSubsRows() { return S.get(getSubsKey(), []); }
function saveSubsRows(rows) { S.set(getSubsKey(), rows); }

function loadSubsRows() {
  const rows = getSubsRows();
  renderSubsTable(rows);
  updateSubsSummary(rows);
}

function renderSubsTable(rows) {
  const tbody = el("subs-tbody");
  tbody.innerHTML = "";
  if (rows.length === 0) { show("subs-empty"); return; }
  hide("subs-empty");
  rows.forEach(row => tbody.appendChild(createSubRow(row)));
}

function createSubRow(row) {
  const tr = document.createElement("tr");
  tr.dataset.id = row.id;
  tr.innerHTML = `
    <td><input class="table-input amber" placeholder="Service name" value="${escHtml(row.name||"")}" data-field="name"/></td>
    <td><select class="table-select">${SUB_CATS.map(c    => `<option${c===row.cat   ?" selected":""}>${c}</option>`).join("")}</select></td>
    <td><select class="table-select cycle-select">${SUB_CYCLES.map(c => `<option${c===row.cycle ?" selected":""}>${c}</option>`).join("")}</select></td>
    <td><input class="table-input amber" type="number" placeholder="1–31" min="1" max="31" value="${row.due||""}" data-field="due"/></td>
    <td><input class="table-input amber table-input-right" type="number" placeholder="0" min="0" value="${row.amt||""}" data-field="amt"/></td>
    <td><select class="table-select status-select">${SUB_STATUSES.map(s => `<option${s===row.status?" selected":""}>${s}</option>`).join("")}</select></td>
    <td><button class="del-btn">✕</button></td>`;
  tr.querySelector("[data-field=name]").addEventListener("input", e => updateSubRow(row.id,"name",e.target.value));
  tr.querySelectorAll("select")[0].addEventListener("change",     e => updateSubRow(row.id,"cat",e.target.value));
  tr.querySelector(".cycle-select").addEventListener("change",    e => updateSubRow(row.id,"cycle",e.target.value));
  tr.querySelector("[data-field=due]").addEventListener("input",  e => updateSubRow(row.id,"due",e.target.value));
  tr.querySelector("[data-field=amt]").addEventListener("input",  e => updateSubRow(row.id,"amt",e.target.value));
  tr.querySelector(".status-select").addEventListener("change",   e => updateSubRow(row.id,"status",e.target.value));
  tr.querySelector(".del-btn").addEventListener("click", () => deleteSubRow(row.id));
  return tr;
}

function addSubRow() {
  const rows = getSubsRows();
  rows.push({ id:Date.now(), name:"", cat:SUB_CATS[0], cycle:"Monthly", due:"", amt:"", status:"✅ Active" });
  saveSubsRows(rows);
  loadSubsRows();
}
function updateSubRow(id, field, val) {
  const rows = getSubsRows().map(r => r.id === id ? {...r,[field]:val} : r);
  saveSubsRows(rows);
  updateSubsSummary(rows);
}
function deleteSubRow(id) {
  const rows = getSubsRows().filter(r => r.id !== id);
  saveSubsRows(rows);
  loadSubsRows();
  showToast("Subscription deleted");
}
function clearSubs() {
  if (getSubsRows().length === 0) return;
  saveSubsRows([]);
  loadSubsRows();
  showToast("All subscriptions cleared");
}

function updateSubsSummary(rows) {
  const active  = rows.filter(r => r.status !== "❌ Cancelled");
  const monthly = active.reduce((a,r) => a + toMonthly(parseFloat(r.amt)||0, r.cycle), 0);
  const yearly  = active.reduce((a,r) => a + (r.cycle === "Yearly" ? parseFloat(r.amt)||0 : toMonthly(parseFloat(r.amt)||0,r.cycle)*12), 0);
  text("subs-active-count", active.length);
  text("subs-monthly-total", inr(Math.round(monthly)));
  text("subs-yearly-total",  inr(Math.round(yearly)));
}

// ══════════════════════════════════════════════════
//  ANALYTICS PAGE
// ══════════════════════════════════════════════════
function renderAnalyticsPage() {
  const now = new Date();
  const y = now.getFullYear(), m = now.getMonth();

  const last6 = Array.from({length:6}, (_,i) => {
    const d = new Date(y, m-5+i, 1);
    const dy = d.getFullYear(), dm = d.getMonth();
    let total = 0;
    for (let day = 1; day <= new Date(dy,dm+1,0).getDate(); day++) {
      S.get(`spendora_personal_${dy}-${pad(dm+1)}-${pad(day)}`, [])
       .forEach(r => { total += parseFloat(r.amt)||0; });
    }
    return { v: total, l: MONTHS[dm].slice(0,3) };
  });

  const catMap = {};
  for (let day = 1; day <= new Date(y,m+1,0).getDate(); day++) {
    S.get(`spendora_personal_${y}-${pad(m+1)}-${pad(day)}`, [])
     .forEach(r => { const k = r.cat||"📦 Other"; catMap[k]=(catMap[k]||0)+(parseFloat(r.amt)||0); });
  }
  const donutData = Object.entries(catMap).map(([k,v],i) => ({ label:k, value:v, color:CAT_COLORS[i%CAT_COLORS.length] }));
  const totalMonth = Object.values(catMap).reduce((a,b) => a+b, 0);

  const subsRows = S.get(`spendora_subs_${y}-${pad(m+1)}`, []);
  const activeSubs = subsRows.filter(r => r.status !== "❌ Cancelled");
  const subDonut   = activeSubs.map((r,i) => ({ label:r.name||"Unnamed", value:toMonthly(parseFloat(r.amt)||0,r.cycle), color:CAT_COLORS[(i+3)%CAT_COLORS.length] }));
  const monthlySubsTotal = subDonut.reduce((a,b) => a+b.value, 0);
  const dailyAvg   = totalMonth / (now.getDate() || 1);

  const sg = el("analytics-stat-grid");
  sg.innerHTML = "";
  [
    { label:"This Month",    value:inr(totalMonth),   sub:"Personal expenses",            accent:"#c0392b" },
    { label:"Daily Average", value:inr(dailyAvg),     sub:`Based on ${now.getDate()} days`,accent:"#3b82f6" },
    { label:"Subscriptions", value:inr(Math.round(monthlySubsTotal)), sub:"Monthly recurring", accent:"#f59e0b" },
    { label:"Budget Left",   value:budget > 0 ? inr(Math.max(0,budget-totalMonth-monthlySubsTotal)) : "—",
      sub: budget > 0 ? "Remaining" : "Set a budget", accent:"#10b981" },
  ].forEach(c => sg.appendChild(createStatCard(c)));

  el("analytics-monthly-chart").innerHTML = "";
  el("analytics-monthly-chart").appendChild(buildBarChart(last6, "#c0392b"));
  el("analytics-monthly-footer").innerHTML = `
    <span>Avg: ${inr(last6.reduce((a,b)=>a+b.v,0)/6)}/mo</span>
    <span>Peak: ${inr(Math.max(...last6.map(d=>d.v)))}</span>`;

  const subLast6 = Array.from({length:6}, (_,i) => {
    const d = new Date(y, m-5+i, 1);
    const rows = S.get(`spendora_subs_${d.getFullYear()}-${pad(d.getMonth()+1)}`, []);
    const v    = rows.filter(r => r.status !== "❌ Cancelled")
                     .reduce((a,r) => a + toMonthly(parseFloat(r.amt)||0, r.cycle), 0);
    return { v: Math.round(v), l: MONTHS[d.getMonth()].slice(0,3) };
  });
  el("analytics-subs-chart").innerHTML = "";
  el("analytics-subs-chart").appendChild(buildBarChart(subLast6, "#f59e0b"));

  el("analytics-donut-title").textContent = `Expense Breakdown — ${MONTHS[m]}`;
  const expDonut = el("analytics-exp-donut");
  expDonut.innerHTML = "";
  if (donutData.length === 0) {
    expDonut.innerHTML = `<div style="text-align:center;color:#555;font-size:0.85rem;padding:2rem;">No expenses this month</div>`;
  } else {
    expDonut.appendChild(buildDonutSection(donutData, totalMonth, v => `${totalMonth>0?(v/totalMonth*100).toFixed(0):0}%`));
  }

  const subDonutEl = el("analytics-sub-donut");
  subDonutEl.innerHTML = "";
  if (subDonut.length === 0) {
    subDonutEl.innerHTML = `<div style="text-align:center;color:#555;font-size:0.85rem;padding:2rem;">No active subscriptions</div>`;
  } else {
    subDonutEl.appendChild(buildDonutSection(subDonut, monthlySubsTotal, v => inr(Math.round(v))));
  }

  if (budget > 0) {
    show("analytics-budget-section");
    const pctP = (totalMonth / budget) * 100;
    const pctT = ((totalMonth + monthlySubsTotal) / budget) * 100;
    el("a-personal-pct").textContent = `${pctP.toFixed(0)}%`;
    setBar("a-personal-bar", pctP, totalMonth > budget ? "over-budget" : "red-fill");
    el("a-personal-sub").textContent = `${inr(totalMonth)} of ${inr(budget)}`;
    el("a-total-pct").textContent = `${pctT.toFixed(0)}%`;
    setBar("a-total-bar", pctT, (totalMonth+monthlySubsTotal) > budget ? "over-budget" : "amber-fill");
    el("a-total-sub").textContent = `${inr(Math.round(totalMonth+monthlySubsTotal))} of ${inr(budget)}`;
  } else {
    hide("analytics-budget-section");
  }
}

// ══════════════════════════════════════════════════
//  SHARED UI BUILDERS
// ══════════════════════════════════════════════════

/* Stat Card */
function createStatCard({ label, value, sub, accent = "#c0392b" }) {
  const div = document.createElement("div");
  div.className = "stat-card";
  div.style.setProperty("--accent", accent);
  div.innerHTML = `
    <div class="stat-card-label">${label}</div>
    <div class="stat-card-value">${value}</div>
    ${sub ? `<div class="stat-card-sub">${sub}</div>` : ""}`;
  return div;
}

/* Progress bar helper */
function setBar(id, pct, fillClass) {
  const bar = el(id);
  if (!bar) return;
  bar.style.width = Math.min(pct, 100) + "%";
  bar.className   = `progress-fill ${fillClass}`;
}

/* Donut SVG */
function buildDonutSVG(data, size = 130, thick = 22) {
  const total = data.reduce((a,b) => a+b.value, 0);
  const ns  = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(ns, "svg");
  svg.setAttribute("width",  size);
  svg.setAttribute("height", size);
  svg.style.transform = "rotate(-90deg)";
  svg.style.flexShrink = "0";

  const r    = (size - thick) / 2;
  const circ = 2 * Math.PI * r;
  const cx = size/2, cy = size/2;

  const bg = document.createElementNS(ns,"circle");
  bg.setAttribute("cx",cx); bg.setAttribute("cy",cy); bg.setAttribute("r",r);
  bg.setAttribute("fill","none"); bg.setAttribute("stroke","#1a1a22"); bg.setAttribute("stroke-width",thick);
  svg.appendChild(bg);

  if (!total) {
    const t = document.createElementNS(ns,"text");
    t.setAttribute("x",cx); t.setAttribute("y",cy+5); t.setAttribute("text-anchor","middle");
    t.setAttribute("fill","#444"); t.setAttribute("font-size","11");
    t.style.transform = "rotate(90deg)";
    t.textContent = "No data";
    svg.appendChild(t);
    return svg;
  }

  let offset = 0;
  data.forEach(d => {
    const pct  = d.value / total;
    const dash = pct * circ;
    const gap  = circ - dash;
    const c    = document.createElementNS(ns,"circle");
    c.setAttribute("cx",cx); c.setAttribute("cy",cy); c.setAttribute("r",r);
    c.setAttribute("fill","none"); c.setAttribute("stroke",d.color); c.setAttribute("stroke-width",thick);
    c.setAttribute("stroke-dasharray",`${dash} ${gap}`);
    c.setAttribute("stroke-dashoffset", -offset);
    c.style.transition = "stroke-dasharray 0.6s cubic-bezier(0.16,1,0.3,1)";
    svg.appendChild(c);
    offset += dash;
  });
  return svg;
}

/* Donut + legend section */
function buildDonutSection(data, total, valFn) {
  const wrap = document.createElement("div");
  wrap.className = "donut-wrap";

  const svgWrap = document.createElement("div");
  svgWrap.style.flexShrink = "0";
  svgWrap.appendChild(buildDonutSVG(data, 150, 28));
  const sub = document.createElement("div");
  sub.style.cssText = "text-align:center;margin-top:7px;font-family:Rajdhani,sans-serif;font-size:0.7rem;color:#555;letter-spacing:1px;";
  sub.textContent = `Total: ${inr(total)}`;
  svgWrap.appendChild(sub);
  wrap.appendChild(svgWrap);

  const legend = document.createElement("div");
  legend.className = "donut-legend";
  data.forEach(d => {
    legend.innerHTML += `<div class="legend-row">
      <div class="legend-dot" style="background:${d.color};"></div>
      <div class="legend-name">${d.label}</div>
      <div class="legend-val">${valFn(d.value)}</div>
    </div>`;
  });
  wrap.appendChild(legend);
  return wrap;
}

/* Bar Chart */
function buildBarChart(data, color = "#c0392b", label = "") {
  const max = Math.max(...data.map(d => d.v), 1);
  const wrap = document.createElement("div");
  wrap.className = "barchart";
  if (label) {
    const lbl = document.createElement("div");
    lbl.className = "barchart-label";
    lbl.textContent = label;
    wrap.appendChild(lbl);
  }
  const bars = document.createElement("div");
  bars.className = "barchart-bars";
  data.forEach((d, i) => {
    const col = document.createElement("div");
    col.className = "barchart-col";
    const pct = (d.v / max) * 52;
    const isLast = i === data.length - 1;
    col.innerHTML = `
      <div class="barchart-bar" style="background:${color};height:${Math.max(pct,d.v?3:0)}px;opacity:${isLast?1:0.45};"></div>
      <div class="barchart-tick">${d.l}</div>`;
    bars.appendChild(col);
  });
  wrap.appendChild(bars);
  return wrap;
}

/* HTML escape */
function escHtml(str) {
  return String(str).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
}

// ══════════════════════════════════════════════════
//  RIPPLE EFFECT (applied to .ripple-btn)
// ══════════════════════════════════════════════════
function initRipple() {
  document.addEventListener("click", e => {
    const btn = e.target.closest(".ripple-btn");
    if (!btn) return;
    const rect = btn.getBoundingClientRect();
    const size = Math.max(rect.width, rect.height) * 2;
    const span = document.createElement("span");
    span.className = "ripple-circle";
    span.style.cssText = `
      width: ${size}px; height: ${size}px;
      left: ${e.clientX - rect.left}px;
      top:  ${e.clientY - rect.top}px;
    `;
    btn.appendChild(span);
    setTimeout(() => span.remove(), 700);
  });
}

// ══════════════════════════════════════════════════
//  SCROLL REVEAL (IntersectionObserver)
// ══════════════════════════════════════════════════
function initScrollReveal() {
  const io = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (e.isIntersecting) { e.target.classList.add("visible"); io.unobserve(e.target); }
    });
  }, { threshold: 0.08 });

  function attach() {
    document.querySelectorAll(
      ".section-card, .panel-card, .table-card, .day-info, .summary-bar, .date-nav, .stat-card, .about-feature-card, .about-privacy-card"
    ).forEach(el => {
      if (!el.classList.contains("reveal")) {
        el.classList.add("reveal");
        io.observe(el);
      }
    });
  }
  attach();
  // Re-attach after page navigation
  window._attachReveal = attach;
}

// ══════════════════════════════════════════════════
//  NAVBAR SCROLL SHADOW
// ══════════════════════════════════════════════════
function initNavScroll() {
  const nav = el("navbar");
  if (!nav) return;
  window.addEventListener("scroll", () => {
    nav.style.boxShadow = window.scrollY > 10
      ? "0 2px 0 rgba(192,57,43,0.35), 0 12px 50px rgba(0,0,0,0.7)"
      : "";
  }, { passive: true });
}


function initStatCardTilt() {
  document.addEventListener("mousemove", e => {
    document.querySelectorAll(".stat-card").forEach(card => {
      const rect = card.getBoundingClientRect();
      const cx = rect.left + rect.width  / 2;
      const cy = rect.top  + rect.height / 2;
      const dx = (e.clientX - cx) / rect.width;
      const dy = (e.clientY - cy) / rect.height;
      const dist = Math.sqrt(dx*dx + dy*dy);
      if (dist < 1.4) {
        card.style.transform = `perspective(600px) rotateX(${-dy*7}deg) rotateY(${dx*7}deg) translateZ(12px) translateY(-4px)`;
        card.style.boxShadow = `0 20px 50px rgba(0,0,0,0.55)`;
      } else {
        card.style.transform = "";
        card.style.boxShadow = "";
      }
    });
  });
  document.addEventListener("mouseleave", () => {
    document.querySelectorAll(".stat-card").forEach(c => { c.style.transform = ""; c.style.boxShadow = ""; });
  });
}

// ══════════════════════════════════════════════════
//  PARTICLE CANVAS
// ══════════════════════════════════════════════════
function initParticles() {
  const canvas = el("particle-canvas");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  let W, H, particles = [];

  function resize() { W = canvas.width = window.innerWidth; H = canvas.height = window.innerHeight; }
  resize();
  window.addEventListener("resize", resize, { passive: true });

  const COLORS = ["rgba(192,57,43,","rgba(231,76,60,","rgba(245,158,11,","rgba(59,130,246,","rgba(16,185,129,"];

  function Particle() {
    this.reset = function() {
      this.x = Math.random() * W; this.y = Math.random() * H;
      this.vx = (Math.random() - 0.5) * 0.28; this.vy = (Math.random() - 0.5) * 0.28 - 0.08;
      this.r = Math.random() * 1.1 + 0.3;
      this.alpha = Math.random() * 0.35 + 0.08;
      this.color = COLORS[Math.floor(Math.random() * COLORS.length)];
      this.life = 0; this.maxLife = 200 + Math.random() * 320;
    };
    this.reset();
  }

  const COUNT = window.innerWidth < 600 ? 35 : 70;
  for (let i = 0; i < COUNT; i++) { const p = new Particle(); p.life = Math.random() * p.maxLife; particles.push(p); }

  function draw() {
    ctx.clearRect(0, 0, W, H);
    particles.forEach(p => {
      p.x += p.vx; p.y += p.vy; p.life++;
      const t = p.life / p.maxLife;
      const a = t < 0.1 ? t * 10 * p.alpha : t > 0.9 ? (1 - t) * 10 * p.alpha : p.alpha;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = p.color + a + ")"; ctx.fill();
      if (p.life >= p.maxLife) p.reset();
    });
    requestAnimationFrame(draw);
  }
  draw();
}

// ══════════════════════════════════════════════════
//  BOOT
// ══════════════════════════════════════════════════
document.addEventListener("DOMContentLoaded", () => {
  initParticles();
  initAuth();
  initNavbar();
  initBudgetModal();
  initStatCardTilt();
  initRipple();
  initScrollReveal();
  initNavScroll();
});

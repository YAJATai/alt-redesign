/* ==========================================================================
   Alt. — application core
   State, derived metrics, navigation, router, shared components and charts.
   ========================================================================== */
"use strict";

var D = window.ALT_DATA;
var TOOLS = D.tools;
var TOOL_BY_ID = D.toolById;
var CATEGORIES = D.categories;
var WORK_NEEDS = D.workNeeds;
var CAPABILITY_LABELS = D.capabilityLabels;
var DAY = D.DAY;
var STORAGE_KEY = "alt.workspace.v2";

var NAV_SECTIONS = [
  {
    id: "overview", label: "Overview", icon: "home", route: "/overview",
    tabs: [{ key: "overview", label: "Overview", route: "/overview" }]
  },
  {
    id: "subscriptions", label: "Subscriptions", icon: "layers", route: "/subscriptions",
    tabs: [
      { key: "all", label: "All subscriptions", route: "/subscriptions" },
      { key: "waste", label: "Waste detector", route: "/subscriptions/waste", badge: "waste" },
      { key: "cancel", label: "Cancellation", route: "/subscriptions/cancel" },
      { key: "compare", label: "Compare plans", route: "/subscriptions/compare" },
      { key: "history", label: "History", route: "/subscriptions/history" }
    ]
  },
  {
    id: "savings", label: "Savings", icon: "wallet", route: "/savings",
    tabs: [
      { key: "overview", label: "Overview", route: "/savings" },
      { key: "goals", label: "Goals", route: "/savings/goals" },
      { key: "calculator", label: "Calculator", route: "/savings/calculator" },
      { key: "summary", label: "Monthly summary", route: "/savings/summary" }
    ]
  },
  {
    id: "discover", label: "Discover", icon: "compass", route: "/discover",
    tabs: [
      { key: "alternatives", label: "Free alternatives", route: "/discover" },
      { key: "finder", label: "Alternative finder", route: "/discover/finder" },
      { key: "compare", label: "Compare features", route: "/discover/compare" },
      { key: "needs", label: "By work needs", route: "/discover/needs" },
      { key: "assistant", label: "Ask Alt.", route: "/discover/assistant" }
    ]
  },
  {
    id: "workflows", label: "Workflows", icon: "workflow", route: "/workflows",
    tabs: [
      { key: "builder", label: "Rebuild workflow", route: "/workflows" },
      { key: "compatibility", label: "Compatibility score", route: "/workflows/compatibility" },
      { key: "simulator", label: "Switch simulator", route: "/workflows/simulator" },
      { key: "help", label: "Switching help", route: "/workflows/help" }
    ]
  },
  {
    id: "usage", label: "Software usage", icon: "activity", route: "/usage",
    tabs: [
      { key: "overview", label: "Usage overview", route: "/usage" },
      { key: "unused", label: "Unused software", route: "/usage/unused", badge: "waste" },
      { key: "preferences", label: "Preferences", route: "/usage/preferences" }
    ]
  }
];

var LEGACY_ROUTES = {
  discover: "/discover",
  "savings-section": "/savings",
  artefacts: "/workflows",
  "discover/ask": "/discover/assistant",
  "discover/chat": "/discover/assistant",
  "/discover/ask": "/discover/assistant",
  "/discover/chat": "/discover/assistant",
  ask: "/discover/assistant",
  chat: "/discover/assistant",
  "card-switchsim": "/workflows/simulator",
  "card-workflow": "/workflows",
  "card-waste": "/subscriptions/waste",
  "card-skill": "/workflows/compatibility",
  "card-scenario": "/savings/calculator"
};

var CHART_COLORS = ["#41d18c", "#6c9bf5", "#ae8ff7", "#e7ae5b", "#56cfd9", "#e87373"];

/* ---------------------------------- state --------------------------------- */

function loadState() {
  var base = D.buildInitialState();
  try {
    var stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
    if (stored && stored.version === 2) {
      Object.keys(base).forEach(function (key) {
        if (stored[key] === undefined) stored[key] = base[key];
      });
      stored.preferences = Object.assign({}, base.preferences, stored.preferences || {});
      stored.meta = Object.assign({}, base.meta, stored.meta || {});
      return stored;
    }
  } catch (error) {
    /* Corrupt storage should never block the app. */
  }
  return base;
}

var state = loadState();

function saveState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (error) {
    /* Local storage may be unavailable (private mode); the session still works. */
  }
}

var ui = {
  route: null,
  lastAppliedHash: null,
  sidebarOpen: false,
  chartRange: 6,
  subSearch: "",
  subCategory: "All",
  subStatus: "All",
  subSort: "name",
  discoverQuery: "",
  discoverCategory: "All",
  freeOnly: true,
  discoverSort: "match",
  finder: { step: 1, category: null, constraints: [], loading: false, results: null },
  needs: { selected: [], built: false, loading: false },
  compare: { a: "adobe-cc", b: "davinci" },
  compareSub: null,
  sim: { from: "premiere-pro", to: "davinci", seats: 1, result: null, loading: false },
  compat: { from: "premiere-pro", to: "davinci", result: null },
  calc: { subId: "", current: 1675.6, alt: 0, seats: 1, months: 12, preset: null },
  summaryMonth: monthKey(new Date()),
  chat: null,
  notificationsOpen: false,
  lastFocus: null
};

function makeChatState() {
  return {
    messages: [
      {
        role: "bot",
        text: "Hi Yajat. Tell me what you need to get done and I'll match free tools from the Alt catalogue. You can also start with a quick context below."
      }
    ],
    recs: null,
    category: null,
    count: 0,
    chips: [],
    typing: false,
    dna: {
      creative: "High",
      budget: "Max",
      hardware: "High",
      skill: "Intermediate",
      student: "Student",
      learning: "Medium"
    },
    completeness: 65
  };
}
ui.chat = makeChatState();

/* ---------------------------------- utils --------------------------------- */

function esc(value) {
  return String(value == null ? "" : value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function attr(value) {
  return esc(value);
}

function money(value, forceDecimals) {
  var number = Number(value) || 0;
  var abs = Math.abs(number);
  var decimals = forceDecimals ? 2 : (Math.abs(abs % 1) > 0.001 ? 2 : 0);
  return (number < 0 ? "−" : "") + "₹" + abs.toLocaleString("en-IN", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

function money0(value) {
  var number = Math.round(Number(value) || 0);
  var abs = Math.abs(number);
  return (number < 0 ? "−" : "") + "₹" + abs.toLocaleString("en-IN", { maximumFractionDigits: 0 });
}

function moneyCompact(value) {
  var number = Number(value) || 0;
  var abs = Math.abs(number);
  var sign = number < 0 ? "−" : "";
  if (abs >= 10000000) return sign + "₹" + (abs / 10000000).toFixed(1) + "Cr";
  if (abs >= 100000) return sign + "₹" + (abs / 100000).toFixed(1) + "L";
  if (abs >= 1000) return sign + "₹" + (abs / 1000).toFixed(abs % 1000 === 0 ? 0 : 1) + "k";
  return sign + "₹" + Math.round(abs);
}

function number(value) {
  return (Number(value) || 0).toLocaleString("en-IN");
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function percent(part, total) {
  if (!total) return 0;
  return clamp(Math.round((part / total) * 100), 0, 100);
}

function parseDate(value) {
  if (!value) return new Date();
  var parts = String(value).split("-").map(Number);
  if (parts.length === 3) return new Date(parts[0], parts[1] - 1, parts[2], 12, 0, 0);
  var date = new Date(value);
  return isNaN(date.getTime()) ? new Date() : date;
}

function isoDate(date) {
  var d = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return d.toISOString().slice(0, 10);
}

function daysBetween(from, to) {
  return Math.floor((parseDate(to).getTime() - parseDate(from).getTime()) / DAY);
}

function daysSince(value) {
  return Math.max(0, daysBetween(value, isoDate(new Date())));
}

function fmtDate(value, includeYear) {
  var date = parseDate(value);
  try {
    return date.toLocaleDateString("en-GB", {
      day: "numeric", month: "short", year: includeYear === false ? undefined : "numeric"
    });
  } catch (error) {
    return value;
  }
}

function fmtMonth(value) {
  return parseDate(value).toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

function relDate(value) {
  var days = daysBetween(value, isoDate(new Date()));
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 0 && days > -30) return "In " + Math.abs(days) + " days";
  if (days < 0) return fmtDate(value);
  if (days < 30) return days + " days ago";
  if (days < 365) return Math.round(days / 30) + " months ago";
  return fmtDate(value);
}

function renewalLabel(value) {
  var days = daysBetween(isoDate(new Date()), value);
  if (days < 0) return "Overdue";
  if (days === 0) return "Today";
  if (days === 1) return "Tomorrow";
  return "In " + days + " days";
}

function uid(prefix) {
  return prefix + "-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

function monthKey(date) {
  return date.getFullYear() + "-" + String(date.getMonth() + 1).padStart(2, "0");
}

function monthStart(key) {
  var parts = key.split("-").map(Number);
  return new Date(parts[0], parts[1] - 1, 1, 12, 0, 0);
}

function daysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate();
}

function lastNMonths(count) {
  var result = [];
  var now = new Date();
  for (var i = count - 1; i >= 0; i--) {
    var date = new Date(now.getFullYear(), now.getMonth() - i, 1, 12, 0, 0);
    result.push({
      key: monthKey(date),
      label: date.toLocaleDateString("en-US", { month: "short" }),
      longLabel: date.toLocaleDateString("en-US", { month: "long", year: "numeric" }),
      date: date,
      current: i === 0
    });
  }
  return result;
}

function icon(name, className) {
  return '<svg class="icon ' + (className || "") + '" aria-hidden="true"><use href="#i-' + name + '"></use></svg>';
}

function logoHtml(item, size) {
  var color = item.color || "#8a8f9c";
  var initials = item.initials || (item.name || "?").slice(0, 2);
  return '<span class="logo ' + (size || "") + '" style="--logo-color:' + attr(color) + '" aria-hidden="true">' +
    esc(initials) + "</span>";
}

function toolLogo(tool, size) {
  return logoHtml(tool, size);
}

function toolById(id) {
  return TOOL_BY_ID[id] || null;
}

function subById(id) {
  return state.subscriptions.filter(function (sub) { return sub.id === id; })[0] || null;
}

function goalById(id) {
  return state.goals.filter(function (goal) { return goal.id === id; })[0] || null;
}

function capitalize(value) {
  return String(value || "").charAt(0).toUpperCase() + String(value || "").slice(1);
}

function pluck(list, key) {
  return list.map(function (item) { return item[key]; });
}

/* -------------------------------- derived --------------------------------- */

function activeSubs() {
  return state.subscriptions.filter(function (sub) { return sub.status === "active"; });
}

function cancelledSubs() {
  return state.subscriptions.filter(function (sub) { return sub.status === "cancelled"; });
}

function isSnoozed(sub) {
  return !!(sub.snoozedUntil && daysBetween(isoDate(new Date()), sub.snoozedUntil) >= 0);
}

function flaggedSubs() {
  return activeSubs().filter(function (sub) {
    return sub.usageScore < 40 && sub.potentialSaving > 0 && !isSnoozed(sub);
  });
}

function snoozedSubs() {
  return activeSubs().filter(isSnoozed);
}

function monthlySpend() {
  return activeSubs().reduce(function (sum, sub) { return sum + sub.cost; }, 0);
}

function potentialSavings() {
  return flaggedSubs().reduce(function (sum, sub) { return sum + sub.potentialSaving; }, 0);
}

function savingsEvents() {
  var events = state.switchHistory.map(function (item) {
    return {
      id: item.id, type: "switch", from: item.from, to: item.to,
      monthlySaving: item.monthlySaving, date: item.date, category: item.category
    };
  });
  state.cancellations.forEach(function (item) {
    events.push({
      id: item.id, type: "cancellation", from: item.name, to: "Cancelled",
      monthlySaving: item.monthlySaving, date: item.date, category: item.category
    });
  });
  return events.sort(function (a, b) { return parseDate(b.date) - parseDate(a.date); });
}

function savingsRate() {
  return savingsEvents().reduce(function (sum, event) { return sum + event.monthlySaving; }, 0);
}

function cumulativeAt(date) {
  var target = parseDate(date).getTime();
  var total = 0;
  savingsEvents().forEach(function (event) {
    var start = parseDate(event.date).getTime();
    if (target > start) {
      total += event.monthlySaving * ((target - start) / DAY) / 30.44;
    }
  });
  return total;
}

function savedToDate() {
  return cumulativeAt(new Date());
}

function monthAccrual(year, month) {
  var start = new Date(year, month, 1, 12, 0, 0);
  var end = new Date(year, month + 1, 0, 12, 0, 0);
  var today = new Date();
  if (start.getFullYear() === today.getFullYear() && start.getMonth() === today.getMonth()) {
    end = today;
  }
  if (end < start) return 0;
  var totalDays = daysInMonth(year, month);
  var total = 0;
  savingsEvents().forEach(function (event) {
    var eventDate = parseDate(event.date);
    var from = eventDate > start ? eventDate : start;
    if (from <= end) {
      var activeDays = Math.floor((end - from) / DAY) + 1;
      total += event.monthlySaving * (clamp(activeDays, 0, totalDays) / totalDays);
    }
  });
  return total;
}

function monthlySeries(months) {
  return lastNMonths(months).map(function (month) {
    var parts = month.key.split("-").map(Number);
    return {
      label: month.label,
      longLabel: month.longLabel,
      key: month.key,
      current: month.current,
      value: monthAccrual(parts[0], parts[1] - 1)
    };
  });
}

function savingsSeries(months) {
  return lastNMonths(months).map(function (month) {
    var parts = month.key.split("-").map(Number);
    var end = month.current ? new Date() : new Date(parts[0], parts[1], 0, 12, 0, 0);
    return {
      label: month.label,
      longLabel: month.longLabel,
      current: month.current,
      value: cumulativeAt(end)
    };
  });
}

function annualSavings() {
  return savingsRate() * 12;
}

function totalSavedThisYear() {
  var now = new Date();
  var total = 0;
  for (var month = 0; month <= now.getMonth(); month++) {
    total += monthAccrual(now.getFullYear(), month);
  }
  return total;
}

function goalCurrent(goal) {
  return goal.auto ? savedToDate() : (Number(goal.saved) || 0);
}

function goalProgress(goal) {
  if (!goal || !goal.target) return 0;
  return clamp(Math.round((goalCurrent(goal) / goal.target) * 100), 0, 100);
}

function annualGoal() {
  return state.goals.filter(function (goal) { return goal.auto; })[0] || state.goals[0] || null;
}

function categorySpend() {
  var totals = {};
  activeSubs().forEach(function (sub) {
    totals[sub.category] = (totals[sub.category] || 0) + sub.cost;
  });
  var total = monthlySpend();
  var colors = { Design: "#ae8ff7", Productivity: "#6c9bf5", Communication: "#41d18c", Writing: "#e7ae5b", Video: "#56cfd9", Audio: "#e87373", Presentations: "#8fa0ff", CRM: "#f0b763", "Project management": "#7fd1ae", Code: "#56cfd9" };
  return Object.keys(totals).map(function (name, index) {
    return {
      label: name,
      value: totals[name],
      pct: percent(totals[name], total),
      color: colors[name] || CHART_COLORS[index % CHART_COLORS.length]
    };
  }).sort(function (a, b) { return b.value - a.value; });
}

function usageTotal() {
  return activeSubs().reduce(function (sum, sub) { return sum + (sub.weeklyHours || 0); }, 0);
}

function mostUsedSub() {
  return activeSubs().slice().sort(function (a, b) { return (b.weeklyHours || 0) - (a.weeklyHours || 0); })[0] || null;
}

function upcomingRenewals(limit) {
  return activeSubs().slice().sort(function (a, b) {
    return daysBetween(isoDate(new Date()), a.renewal) - daysBetween(isoDate(new Date()), b.renewal);
  }).slice(0, limit || 3);
}

function freeTools() {
  return TOOLS.filter(function (tool) { return tool.free; });
}

function paidTools() {
  return TOOLS.filter(function (tool) { return !tool.free; });
}

function paidToolForName(name) {
  return TOOLS.filter(function (tool) {
    return !tool.free && tool.name.toLowerCase() === String(name || "").toLowerCase();
  })[0] || null;
}

function searchableTool(tool) {
  return [
    tool.name, tool.category, tool.desc, tool.replaces, (tool.features || []).join(" "),
    (tool.capabilities || []).map(function (cap) { return CAPABILITY_LABELS[cap] || cap; }).join(" ")
  ].join(" ").toLowerCase();
}

function toolMatches(tool, query) {
  if (!query) return true;
  var terms = query.toLowerCase().split(/\s+/).filter(Boolean);
  var haystack = searchableTool(tool);
  return terms.every(function (term) { return haystack.indexOf(term) !== -1; });
}

function continuityScore(fromId, toId) {
  var source = toolById(fromId);
  var target = toolById(toId);
  if (!source || !target) return null;
  var sourceCaps = source.capabilities || [];
  var targetCaps = target.capabilities || [];
  var covered = sourceCaps.filter(function (cap) { return targetCaps.indexOf(cap) !== -1; });
  var missing = sourceCaps.filter(function (cap) { return targetCaps.indexOf(cap) === -1; });
  var coverage = sourceCaps.length ? (covered.length / sourceCaps.length) * 100 : 0;
  var learningMap = { Low: 100, Medium: 72, High: 45, "Very low": 100 };
  var hardwareMap = { "Very low": 100, Low: 90, Medium: 75, High: 55 };
  var learning = learningMap[target.learning] || 70;
  var hardware = hardwareMap[target.hardware] || 75;
  var skill = target.skillTransfer || 70;
  var score = Math.round(coverage * 0.55 + learning * 0.2 + hardware * 0.15 + skill * 0.1);
  var base = target.category === source.category ? 4 : 0;
  score = clamp(score + base, 5, 99);
  return {
    score: score,
    source: source,
    target: target,
    covered: covered,
    missing: missing,
    coverage: Math.round(coverage),
    learning: learning,
    hardware: hardware,
    skill: skill,
    label: score >= 85 ? "Strong fit" : score >= 70 ? "Good fit" : score >= 55 ? "Partial fit" : "Limited fit",
    tone: score >= 85 ? "accent" : score >= 70 ? "accent" : score >= 55 ? "amber" : "red"
  };
}

function skillRowsFor(target, score) {
  var rows = {
    Video: ["Timeline editing", "Colour grading", "Motion & keyframes", "Audio mixing", "Plugin workflows"],
    Design: ["Vector editing", "Prototyping", "Component systems", "Real-time collaboration", "Plugin workflows"],
    Audio: ["Multi-track editing", "Noise reduction", "Effects & mixing", "Recording", "Plugin workflows"],
    CRM: ["Contact management", "Pipeline hygiene", "Reporting", "Email workflows", "Automation"],
    Presentations: ["Layout & hierarchy", "Storytelling", "Data visuals", "Collaboration", "Template systems"],
    Communication: ["Channel setup", "Async writing", "File sharing", "Integrations", "Moderation"],
    "Project management": ["Task setup", "Daily planning", "Timelines", "Collaboration", "Automation"],
    Writing: ["Editing", "Tone & clarity", "Research", "Publishing", "Style systems"],
    Code: ["Code navigation", "Git workflow", "Debugging", "Extensions", "Automation"],
    Productivity: ["Page structure", "Databases", "Templates", "Collaboration", "Automation"]
  }[target.category] || ["Task setup", "Daily workflow", "Collaboration", "Integrations", "Advanced features"];
  var offsets = [8, 3, -5, -10, -25];
  var base = score || target.skillTransfer || 75;
  return rows.map(function (label, index) {
    return { label: label, value: clamp(base + offsets[index], 20, 98) };
  });
}

function notifications() {
  var items = [];
  var flagged = flaggedSubs();
  if (flagged.length) {
    items.push({
      icon: "alert", tone: "warn",
      title: flagged.length + (flagged.length === 1 ? " subscription may be" : " subscriptions may be") + " wasting money",
      detail: money(potentialSavings()) + "/mo could be recovered",
      route: "/subscriptions/waste"
    });
  }
  var renewals = upcomingRenewals(1);
  if (renewals.length) {
    items.push({
      icon: "calendar", tone: "",
      title: renewals[0].name + " renews " + renewalLabel(renewals[0].renewal).toLowerCase(),
      detail: money(renewals[0].cost) + "/mo · " + fmtDate(renewals[0].renewal),
      route: "/subscriptions"
    });
  }
  var goal = annualGoal();
  if (goal) {
    items.push({
      icon: "target", tone: "accent",
      title: goalProgress(goal) + "% of your annual savings goal",
      detail: money0(goalCurrent(goal)) + " of " + money0(goal.target) + " saved",
      route: "/savings/goals"
    });
  }
  return items;
}

/* --------------------------------- route ---------------------------------- */

function parseRoute() {
  var raw = (location.hash || "").replace(/^#/, "");
  if (!raw) return { section: "overview", tab: "overview", query: new URLSearchParams() };
  if (LEGACY_ROUTES[raw]) raw = LEGACY_ROUTES[raw];
  if (raw.charAt(0) !== "/") {
    if (LEGACY_ROUTES[raw]) raw = LEGACY_ROUTES[raw];
    else return { section: "overview", tab: "overview", query: new URLSearchParams() };
  }
  var pieces = raw.split("?");
  var path = pieces[0];
  var query = new URLSearchParams(pieces[1] || "");
  var segments = path.split("/").filter(Boolean);
  var section = segments[0] || "overview";
  var config = NAV_SECTIONS.filter(function (item) { return item.id === section; })[0];
  if (!config) {
    if (LEGACY_ROUTES[section]) return parseRouteFrom(LEGACY_ROUTES[section], query);
    return { section: "overview", tab: "overview", query: query };
  }
  var tab = segments[1] || config.tabs[0].key;
  var valid = config.tabs.filter(function (item) { return item.key === tab; })[0];
  if (!valid) tab = config.tabs[0].key;
  return { section: section, tab: tab, query: query };
}

function parseRouteFrom(path, query) {
  var segments = path.split("/").filter(Boolean);
  var section = segments[0] || "overview";
  var config = NAV_SECTIONS.filter(function (item) { return item.id === section; })[0];
  return { section: section, tab: segments[1] || (config ? config.tabs[0].key : "overview"), query: query || new URLSearchParams() };
}

function sectionConfig(id) {
  return NAV_SECTIONS.filter(function (item) { return item.id === id; })[0] || NAV_SECTIONS[0];
}

function sectionTab(route) {
  var config = sectionConfig(route.section);
  return config.tabs.filter(function (tab) { return tab.key === route.tab; })[0] || config.tabs[0];
}

function routeHref(route) {
  return "#" + route;
}

function navigate(path) {
  if (location.hash === "#" + path) {
    render();
    return;
  }
  location.hash = path;
}

function applyQuery(route) {
  var q = route.query;
  if (route.section === "discover") {
    if (q.has("q")) {
      ui.discoverQuery = q.get("q");
      ui.discoverCategory = "All";
      ui.freeOnly = true;
    }
    if (q.has("category")) {
      ui.discoverCategory = q.get("category");
    }
  }
  if (route.section === "subscriptions" && route.tab === "compare" && q.has("sub")) {
    ui.compareSub = q.get("sub");
  }
  if (route.section === "savings" && route.tab === "calculator" && q.has("sub")) {
    var sub = subById(q.get("sub"));
    if (sub) {
      var alt = sub.altToolId ? toolById(sub.altToolId) : null;
      ui.calc.subId = sub.id;
      ui.calc.current = sub.cost;
      ui.calc.alt = alt ? alt.price : 0;
      ui.calc.seats = 1;
      ui.calc.months = 12;
      ui.calc.preset = null;
    }
  }
  if (route.section === "workflows") {
    if (q.has("from") && toolById(q.get("from"))) ui.sim.from = q.get("from");
    if (q.has("to") && toolById(q.get("to"))) ui.sim.to = q.get("to");
    if (q.has("from") && toolById(q.get("from"))) ui.compat.from = q.get("from");
    if (q.has("to") && toolById(q.get("to"))) ui.compat.to = q.get("to");
    if (route.tab === "simulator") ui.sim.result = null;
    if (route.tab === "compatibility") ui.compat.result = null;
  }
  if (route.section === "discover" && route.tab === "compare") {
    if (q.has("a") && toolById(q.get("a"))) ui.compare.a = q.get("a");
    if (q.has("b") && toolById(q.get("b"))) ui.compare.b = q.get("b");
  }
}

/* -------------------------------- components ------------------------------- */

function pageHeader(options) {
  return '<header class="page-head">' +
    '<div class="page-head-main">' +
      (options.eyebrow ? '<div class="page-eyebrow">' + icon(options.eyebrowIcon || "sparkles") + esc(options.eyebrow) + "</div>" : "") +
      '<h1 class="page-title">' + esc(options.title) + "</h1>" +
      (options.subtitle ? '<p class="page-sub">' + options.subtitle + "</p>" : "") +
    "</div>" +
    (options.actions ? '<div class="page-actions">' + options.actions + "</div>" : "") +
  "</header>";
}

function tabsBar(route) {
  var config = sectionConfig(route.section);
  if (!config.tabs || config.tabs.length < 2) return "";
  var flagged = flaggedSubs().length;
  var links = config.tabs.map(function (tab) {
    var active = route.tab === tab.key;
    var badge = "";
    if (tab.badge === "waste" && flagged) {
      badge = '<span class="tab-badge warn">' + flagged + "</span>";
    }
    return '<a class="tab' + (active ? " active" : "") + '" href="#' + tab.route + '"' +
      (active ? ' aria-current="page"' : "") + ">" + esc(tab.label) + badge + "</a>";
  }).join("");
  return '<div class="tabs-bar"><nav class="tabs" aria-label="' + attr(config.label) + ' sections">' + links + "</nav></div>";
}

function statCard(options) {
  var tag = options.href ? "a" : "div";
  var attrs = options.href ? ' href="' + attr(options.href) + '"' : "";
  var progress = "";
  if (options.progress !== undefined && options.progress !== null) {
    progress = '<div class="stat-progress"><div class="progress"><div class="progress-bar ' + (options.progressTone || "") + '" style="width:' +
      clamp(options.progress, 0, 100) + '%"></div></div>' +
      (options.progressLabel ? '<div class="stat-progress-label">' + options.progressLabel + "</div>" : "") + "</div>";
  }
  return "<" + tag + ' class="stat"' + attrs + ">" +
    '<div class="stat-top"><span class="stat-label">' + esc(options.label) + "</span>" +
      '<span class="stat-icon ' + (options.iconTone || "") + '">' + icon(options.icon || "activity") + "</span></div>" +
    '<div class="stat-value">' + options.value +
      (options.unit ? '<span class="stat-unit">' + esc(options.unit) + "</span>" : "") + "</div>" +
    (options.meta ? '<div class="stat-meta">' + (options.metaIcon ? icon(options.metaIcon) : "") + options.meta + "</div>" : "") +
    progress +
  "</" + tag + ">";
}

function emptyState(options) {
  var action = "";
  if (options.actionLabel) {
    if (options.actionRoute) {
      action = '<a class="btn btn-secondary btn-sm" href="' + attr(options.actionRoute) + '">' + esc(options.actionLabel) + "</a>";
    } else if (options.actionAction) {
      action = '<button class="btn btn-secondary btn-sm" data-action="' + attr(options.actionAction) + '"' +
        (options.actionId ? ' data-id="' + attr(options.actionId) + '"' : "") + ">" + esc(options.actionLabel) + "</button>";
    }
  }
  return '<div class="empty' + (options.inline ? " empty-inline" : "") + '">' +
    '<div class="empty-icon">' + icon(options.icon || "search") + "</div>" +
    '<div class="empty-title">' + esc(options.title) + "</div>" +
    '<p class="empty-text">' + options.text + "</p>" + action + "</div>";
}

function badge(text, tone, iconName) {
  return '<span class="badge ' + (tone ? "badge-" + tone : "") + '">' +
    (iconName ? icon(iconName) : "") + esc(text) + "</span>";
}

function usageTone(score) {
  if (score < 20) return "red";
  if (score < 40) return "amber";
  if (score < 70) return "blue";
  return "accent";
}

function usageLabel(sub) {
  if (sub.status === "cancelled") return "Cancelled";
  if (isSnoozed(sub)) return "Snoozed";
  if (sub.usageScore < 20) return "Unused";
  if (sub.usageScore < 40) return "Low use";
  return "Active";
}

function statusBadge(sub) {
  if (sub.status === "cancelled") return '<span class="badge badge-neutral">Cancelled</span>';
  if (isSnoozed(sub)) return '<span class="badge badge-info">Snoozed</span>';
  if (sub.usageScore < 20) return '<span class="badge badge-danger">Unused</span>';
  if (sub.usageScore < 40) return '<span class="badge badge-warn">Low use</span>';
  return '<span class="badge badge-accent">Active</span>';
}

/* ---------------------------------- charts --------------------------------- */

function smoothPath(points) {
  if (!points.length) return "";
  if (points.length === 1) return "M" + points[0].x + "," + points[0].y;
  var path = "M" + points[0].x + "," + points[0].y;
  for (var i = 0; i < points.length - 1; i++) {
    var p0 = points[i - 1] || points[i];
    var p1 = points[i];
    var p2 = points[i + 1];
    var p3 = points[i + 2] || p2;
    var cp1x = p1.x + (p2.x - p0.x) / 6;
    var cp1y = p1.y + (p2.y - p0.y) / 6;
    var cp2x = p2.x - (p3.x - p1.x) / 6;
    var cp2y = p2.y - (p3.y - p1.y) / 6;
    path += "C" + cp1x.toFixed(1) + "," + cp1y.toFixed(1) + " " + cp2x.toFixed(1) + "," + cp2y.toFixed(1) +
      " " + p2.x.toFixed(1) + "," + p2.y.toFixed(1);
  }
  return path;
}

function areaChart(series, options) {
  options = options || {};
  var width = 720;
  var height = 248;
  var pad = { left: 45, right: 14, top: 16, bottom: 30 };
  var innerW = width - pad.left - pad.right;
  var innerH = height - pad.top - pad.bottom;
  var maxValue = Math.max.apply(null, series.map(function (point) { return point.value; }).concat([1]));
  var niceMax = Math.ceil(maxValue / 1000) * 1000;
  if (niceMax === 0) niceMax = 1000;
  var points = series.map(function (point, index) {
    return {
      x: pad.left + (series.length === 1 ? innerW / 2 : (index / (series.length - 1)) * innerW),
      y: pad.top + innerH - (point.value / niceMax) * innerH,
      label: point.label,
      longLabel: point.longLabel || point.label,
      value: point.value,
      current: point.current
    };
  });
  var linePath = smoothPath(points);
  var areaPath = linePath + "L" + points[points.length - 1].x + "," + (pad.top + innerH) +
    "L" + points[0].x + "," + (pad.top + innerH) + "Z";
  var grid = "";
  var yLabels = "";
  for (var i = 0; i <= 4; i++) {
    var y = pad.top + (innerH / 4) * i;
    var tickValue = niceMax - (niceMax / 4) * i;
    grid += '<line class="chart-grid" x1="' + pad.left + '" y1="' + y + '" x2="' + (width - pad.right) + '" y2="' + y + '"/>';
    yLabels += '<text x="' + (pad.left - 8) + '" y="' + (y + 3.5) + '" text-anchor="end">' + moneyCompact(tickValue) + "</text>";
  }
  var xLabels = "";
  var xStep = series.length > 8 ? 2 : 1;
  series.forEach(function (point, index) {
    if (index % xStep !== 0 && index !== series.length - 1) return;
    xLabels += '<text x="' + points[index].x + '" y="' + (height - 8) + '" text-anchor="middle">' +
      (point.current ? "Now" : point.label) + "</text>";
  });
  var dots = points.map(function (point) {
    return '<g class="chart-point" data-cx="' + point.x + '" data-cy="' + point.y + '" data-tip-label="' +
      attr(point.longLabel) + '" data-tip-value="' + attr(money0(point.value)) + '">' +
      '<circle class="chart-hit" cx="' + point.x + '" cy="' + point.y + '" r="14"/>' +
      '<circle class="chart-dot" cx="' + point.x + '" cy="' + point.y + '" r="' + (point.current ? 4.2 : 2.6) + '"/>' +
    "</g>";
  }).join("");
  var label = options.label || "Cumulative savings";
  return '<div class="chart-wrap" data-chart-wrap>' +
    '<svg class="chart-svg" viewBox="0 0 ' + width + " " + height + '" role="img" aria-label="' + attr(label) + '">' +
      '<defs><linearGradient id="savingsGrad" x1="0" y1="0" x2="0" y2="1">' +
        '<stop offset="0%" stop-color="#41d18c" stop-opacity="0.22"/>' +
        '<stop offset="100%" stop-color="#41d18c" stop-opacity="0"/>' +
      "</linearGradient></defs>" +
      grid + yLabels + xLabels +
      '<path class="chart-area" d="' + areaPath + '"/>' +
      '<path class="chart-line" d="' + linePath + '"/>' +
      dots +
    "</svg>" +
    '<div class="chart-tooltip" data-chart-tooltip></div>' +
  "</div>";
}

function donutChart(items, total) {
  var radius = 52;
  var circumference = 2 * Math.PI * radius;
  var offset = 0;
  var segments = items.map(function (item) {
    var length = total ? (item.value / total) * circumference : 0;
    var circle = '<circle class="donut-seg" cx="74" cy="74" r="' + radius + '" stroke="' + item.color +
      '" stroke-dasharray="' + Math.max(length - 2.5, 0) + " " + circumference +
      '" stroke-dashoffset="' + (-offset) + '"/>';
    offset += length;
    return circle;
  }).join("");
  return '<div class="donut"><svg viewBox="0 0 148 148" role="img" aria-label="Spending by category">' +
    '<circle class="donut-track" cx="74" cy="74" r="' + radius + '"/>' + segments + "</svg>" +
    '<div class="donut-center"><span>Monthly spend</span><strong>' + money0(total) + "</strong></div></div>";
}

function scoreRing(score, tone) {
  var radius = 46;
  var circumference = 2 * Math.PI * radius;
  var dash = circumference * (clamp(score, 0, 100) / 100);
  var color = tone === "amber" ? "#e7ae5b" : tone === "red" ? "#e87373" : "#41d18c";
  return '<div class="score-ring"><svg viewBox="0 0 108 108" aria-hidden="true">' +
    '<circle class="track" cx="54" cy="54" r="' + radius + '"/>' +
    '<circle class="value" cx="54" cy="54" r="' + radius + '" stroke="' + color +
      '" stroke-dasharray="' + dash + " " + circumference + '"/>' +
    "</svg><div class=\"score-center\"><strong>" + score + "</strong><span>Score</span></div></div>";
}

function monthlyBarChart(series) {
  var max = Math.max.apply(null, series.map(function (item) { return item.value; }).concat([1]));
  return '<div class="savings-bar-chart" role="img" aria-label="Monthly savings">' +
    series.map(function (item) {
      var height = clamp((item.value / max) * 100, 2, 100);
      return '<div class="savings-bar-col' + (item.current ? " current" : "") + '" title="' +
        attr(item.longLabel + ": " + money0(item.value)) + '">' +
        '<div class="bar-value">' + (item.value ? moneyCompact(item.value) : "") + "</div>" +
        '<div class="savings-bar-track"><div class="savings-bar-fill" style="height:' + height + '%"></div></div>' +
        '<div class="bar-label">' + (item.current ? "Now" : esc(item.label)) + "</div>" +
      "</div>";
    }).join("") + "</div>";
}

function bindChartHovers(root) {
  (root || document).querySelectorAll("[data-chart-wrap]").forEach(function (wrap) {
    if (wrap.dataset.bound) return;
    wrap.dataset.bound = "1";
    var svg = wrap.querySelector("svg");
    var tip = wrap.querySelector("[data-chart-tooltip]");
    if (!svg || !tip) return;
    wrap.querySelectorAll(".chart-point").forEach(function (point) {
      point.addEventListener("pointerenter", function () {
        var svgRect = svg.getBoundingClientRect();
        var wrapRect = wrap.getBoundingClientRect();
        var x = Number(point.dataset.cx) / 720 * svgRect.width + (svgRect.left - wrapRect.left);
        var y = Number(point.dataset.cy) / 248 * svgRect.height + (svgRect.top - wrapRect.top);
        tip.innerHTML = "<strong>" + esc(point.dataset.tipValue) + "</strong><span>" + esc(point.dataset.tipLabel) + "</span>";
        tip.style.left = clamp(x, 54, wrapRect.width - 54) + "px";
        tip.style.top = Math.max(y, 32) + "px";
        tip.classList.add("visible");
      });
      point.addEventListener("pointerleave", function () {
        tip.classList.remove("visible");
      });
    });
  });
}

/* ---------------------------------- shell --------------------------------- */

function renderSidebar() {
  var config = ui.route ? sectionConfig(ui.route.section) : sectionConfig("overview");
  var active = activeSubs();
  var flagged = flaggedSubs().length;
  var goal = annualGoal();
  var rate = savingsRate();
  var goalPct = goal ? goalProgress(goal) : 0;
  var user = state.preferences;
  var initials = (user.name || "Y").trim().charAt(0).toUpperCase();

  var nav = NAV_SECTIONS.map(function (section) {
    var badge = "";
    if (section.id === "subscriptions") badge = '<span class="nav-badge">' + active.length + "</span>";
    if (section.id === "usage" && flagged) badge = '<span class="nav-badge alert">' + flagged + "</span>";
    return '<a class="side-link' + (ui.route && ui.route.section === section.id ? " active" : "") +
      '" href="#' + section.route + '"' + (ui.route && ui.route.section === section.id ? ' aria-current="page"' : "") + ">" +
      icon(section.icon) + "<span>" + esc(section.label) + "</span>" + badge + "</a>";
  }).join("");

  var savingsCard = '<div class="side-savings">' +
    '<div class="side-savings-label"><span>Saved every month</span>' + icon("trending-up", "icon-sm") + "</div>" +
    '<div class="side-savings-value">' + money0(rate) + ' <small>/mo</small></div>' +
    (goal ? '<div class="progress"><div class="progress-bar" style="width:' + goalPct + '%"></div></div>' +
      '<div class="side-savings-foot"><span>' + goalPct + "% of annual goal</span><strong>" + moneyCompact(goal.target) + "</strong></div>" : "") +
    '<a href="#/savings" class="side-savings-link">View savings ' + icon("arrow-right") + "</a>" +
  "</div>";

  document.getElementById("sidebar").innerHTML =
    '<a class="brand" href="#/overview" aria-label="Alt. home">ALT<span class="brand-dot">.</span></a>' +
    '<div class="brand-sub">Software savings</div>' +
    '<div class="workspace-chip" title="This is a local demo workspace with sample data."><span class="dot"></span><span>Demo workspace</span><span>Sample data</span></div>' +
    '<nav class="side-nav" aria-label="Sections">' +
      '<div class="nav-group-label">Workspace</div>' + nav +
    "</nav>" +
    savingsCard +
    '<div class="side-user">' +
      '<span class="avatar">' + esc(initials) + "</span>" +
      '<div class="side-user-main"><div class="side-user-name">' + esc(user.name) + '</div><div class="side-user-plan">' + esc(user.role || "Student") + " plan</div></div>" +
      '<a href="#/usage/preferences" aria-label="Account preferences">' + icon("settings") + "</a>" +
    "</div>";

  document.getElementById("topAvatar").textContent = initials;
  document.getElementById("sidebar").classList.toggle("open", ui.sidebarOpen);
  document.getElementById("mobileScrim").hidden = !ui.sidebarOpen;
  document.getElementById("menuBtn").setAttribute("aria-expanded", String(ui.sidebarOpen));
}

function renderBottomNav() {
  var items = [
    { id: "overview", label: "Overview", icon: "home", route: "/overview" },
    { id: "subscriptions", label: "Subscriptions", icon: "layers", route: "/subscriptions" },
    { id: "savings", label: "Savings", icon: "wallet", route: "/savings" },
    { id: "discover", label: "Discover", icon: "compass", route: "/discover" }
  ];
  var html = items.map(function (item) {
    var active = ui.route && ui.route.section === item.id;
    return '<a class="bottom-link' + (active ? " active" : "") + '" href="#' + item.route + '"' +
      (active ? ' aria-current="page"' : "") + ">" + icon(item.icon) + "<span>" + esc(item.label) + "</span></a>";
  }).join("");
  var moreActive = ui.route && (ui.route.section === "workflows" || ui.route.section === "usage");
  html += '<button class="bottom-link' + (moreActive ? " active" : "") + '" data-action="toggle-sidebar" aria-label="Open all sections">' +
    icon("menu") + "<span>More</span></button>";
  document.getElementById("bottomNav").innerHTML = html;
}

function syncChrome(route) {
  var section = sectionConfig(route.section);
  var tab = sectionTab(route);
  document.getElementById("crumbSection").textContent = section.label;
  document.getElementById("crumbTab").textContent = route.section === "overview" ? "" : tab.label;
  var title = route.section === "overview" ? "Overview" : (route.tab === "overview" ? section.label : tab.label);
  document.title = title + " — Alt.";
  document.getElementById("notifDot").hidden = state.meta.notificationsRead || notifications().length === 0;
}

function render(options) {
  options = options || {};
  var y = window.scrollY;
  var route = parseRoute();
  var hash = location.hash || "#/overview";
  if (ui.lastAppliedHash !== hash) {
    applyQuery(route);
    ui.lastAppliedHash = hash;
  }
  ui.route = route;
  var pageRenderers = {
    overview: renderOverview,
    subscriptions: renderSubscriptions,
    savings: renderSavings,
    discover: renderDiscover,
    workflows: renderWorkflows,
    usage: renderUsage
  };
  var renderer = pageRenderers[route.section] || renderOverview;
  renderSidebar();
  renderBottomNav();
  syncChrome(route);
  document.getElementById("view").innerHTML = renderer(route);
  if (!options.keepScroll) window.scrollTo({ top: 0, behavior: "auto" });
  else window.scrollTo({ top: y, behavior: "auto" });
  bindChartHovers();
  if (typeof afterPageRender === "function") afterPageRender(route);
  ui.sidebarOpen = false;
  document.getElementById("sidebar").classList.remove("open");
  document.getElementById("mobileScrim").hidden = true;
  document.getElementById("menuBtn").setAttribute("aria-expanded", "false");
  closeNotifications();
}

function refreshRoute() {
  render({ keepScroll: true });
}

function recordActivity(type, title, detail) {
  state.activity.unshift({
    id: uid("act"),
    type: type,
    title: title,
    detail: detail,
    date: isoDate(new Date())
  });
  state.activity = state.activity.slice(0, 40);
}

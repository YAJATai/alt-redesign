/* ==========================================================================
   Alt. — Software usage
   Usage signals, unused software review and workspace preferences.
   ========================================================================== */
"use strict";

function usageActive() {
  return activeSubs().slice().sort(function (a, b) { return (b.weeklyHours || 0) - (a.weeklyHours || 0); });
}

function usageLow() {
  return activeSubs().filter(function (sub) { return sub.usageScore < 40; })
    .sort(function (a, b) { return a.usageScore - b.usageScore; });
}

function usageLowCost() {
  return usageLow().reduce(function (sum, sub) { return sum + sub.cost; }, 0);
}

function usageUnusedCost() {
  return activeSubs().filter(function (sub) { return sub.usageScore < 20; })
    .reduce(function (sum, sub) { return sum + sub.cost; }, 0);
}

function usageByCategory() {
  var totals = {};
  activeSubs().forEach(function (sub) {
    totals[sub.category] = (totals[sub.category] || 0) + (sub.weeklyHours || 0);
  });
  var total = usageTotal();
  var colors = { Design: "#ae8ff7", Productivity: "#6c9bf5", Communication: "#41d18c", Writing: "#e7ae5b", Video: "#56cfd9", Audio: "#e87373" };
  return Object.keys(totals).map(function (name, index) {
    return {
      label: name,
      value: totals[name],
      pct: percent(totals[name], total),
      color: colors[name] || ["#6c9bf5", "#ae8ff7", "#41d18c", "#e7ae5b"][index % 4]
    };
  }).sort(function (a, b) { return b.value - a.value; });
}

function usageCostPerHour(sub) {
  if (!sub.weeklyHours) return null;
  return sub.cost / (sub.weeklyHours * 4.33);
}

function usageTableRow(sub) {
  var tone = usageTone(sub.usageScore);
  var compareUrl = "#/discover/compare?a=" + encodeURIComponent(sub.altToolId || "") + "&b=" + encodeURIComponent(sub.id);
  return "<tr>" +
    '<td data-label="Software"><div class="cell-name">' + logoHtml(sub) +
      "<div><div class='cell-name-main'>" + esc(sub.name) + '</div><div class="cell-name-sub">' + esc(sub.plan) + " · " + esc(sub.category) + "</div></div></div></td>" +
    '<td data-label="Status">' + statusBadge(sub) + "</td>" +
    '<td data-label="Usage"><div class="usage-cell"><div class="usage-cell-top"><strong>' + esc(sub.usageScore) + "%</strong><span>" + esc(sub.weeklyHours) + " h/wk</span></div>" +
      '<div class="progress"><div class="progress-bar ' + attr(tone === "accent" ? "" : tone) + '" style="width:' + clamp(sub.usageScore, 0, 100) + '%"></div></div></div></td>' +
    '<td data-label="Sessions · 30d" class="num">' + esc(sub.sessions30) + "</td>" +
    '<td data-label="Last used"><div class="num">' + esc(relDate(sub.lastUsed)) + "</div></td>" +
    '<td data-label="Monthly" class="num">' + money(sub.cost) + "</td>" +
    '<td data-label="" class="right"><div class="cell-actions">' +
      '<button class="icon-btn-sm" data-action="open-sub" data-id="' + attr(sub.id) + '" title="View details" aria-label="View ' + attr(sub.name) + '">' + icon("eye") + "</button>" +
      '<a class="icon-btn-sm" href="' + attr(compareUrl) + '" title="Find an alternative" aria-label="Find an alternative for ' + attr(sub.name) + '">' + icon("compass") + "</a>" +
    "</div></td>" +
  "</tr>";
}

function renderUsageOverview() {
  var active = usageActive();
  var low = usageLow();
  var maxHours = active.reduce(function (max, sub) { return Math.max(max, sub.weeklyHours || 0); }, 0.1);
  var total = usageTotal();
  var most = mostUsedSub();
  var categories = usageByCategory();

  var bars = active.map(function (sub) {
    var value = sub.weeklyHours || 0;
    return '<div class="usage-bar-row">' +
      '<div class="usage-bar-name">' + logoHtml(sub, "logo-sm") + "<span>" + esc(sub.name) + "</span></div>" +
      '<div class="usage-bar-track"><div class="usage-bar-fill ' + (sub.usageScore < 40 ? "low" : "") + '" style="width:' + clamp((value / maxHours) * 100, value ? 3 : 0, 100) + '%"></div></div>' +
      '<div class="usage-hours">' + value.toFixed(1) + " h</div></div>";
  }).join("");

  var categoryBars = categories.map(function (cat) {
    return '<div class="breakdown-row"><div class="breakdown-label"><span>' + esc(cat.label) + "</span><strong>" + cat.pct + "%</strong></div>" +
      '<div class="breakdown-track"><div class="breakdown-fill" style="width:' + cat.pct + "%;background:" + attr(cat.color) + '"></div></div></div>';
  }).join("");

  var costRows = active.slice().map(function (sub) {
    return { sub: sub, perHour: usageCostPerHour(sub) };
  }).sort(function (a, b) {
    if (a.perHour == null) return 1;
    if (b.perHour == null) return -1;
    return b.perHour - a.perHour;
  }).slice(0, 5).map(function (row) {
    return '<div class="summary-row"><span class="history-icon ' + (row.perHour == null ? "cancel" : "") + '" style="width:28px;height:28px">' + icon(row.perHour == null ? "clock" : "credit-card") + "</span>" +
      '<div class="summary-row-main"><div class="summary-row-name">' + esc(row.sub.name) + '</div>' +
        '<div class="summary-row-sub">' + (row.perHour == null ? "No recorded usage" : esc(row.sub.weeklyHours) + " h/week average") + "</div></div>" +
      '<div class="summary-row-amount">' + (row.perHour == null ? "—" : money(row.perHour) + "/h") + "</div></div>";
  }).join("");

  return '<div class="page">' +
    pageHeader({
      eyebrow: "Usage signals", eyebrowIcon: "activity",
      title: "Software usage",
      subtitle: "See where your time actually goes, which tools earn their subscription, and which ones are quietly costing you money.",
      actions: '<button class="btn btn-secondary" data-action="export-usage">' + icon("download") + "Export usage</button>" +
        '<a class="btn btn-primary" href="#/usage/unused">' + icon("alert") + "Review unused</a>"
    }) +
    '<div class="stats-grid">' +
      statCard({ label: "Tracked hours", value: Number(total.toFixed(1)), unit: "h/wk", icon: "clock", iconTone: "blue", meta: icon("layers") + " " + active.length + " active subscriptions" }) +
      statCard({ label: "Most used", value: most ? esc(most.name) : "—", unit: "", icon: "trending-up", iconTone: "accent", meta: most ? icon("clock") + " " + esc(most.weeklyHours) + " h/week · " + esc(most.sessions30) + " sessions" : "No usage recorded" }) +
      statCard({ label: "Low-use software", value: low.length, unit: "", icon: "alert", iconTone: "amber", href: "#/usage/unused", meta: icon("wallet") + " " + money(low.reduce(function (sum, sub) { return sum + sub.cost; }, 0)) + "/mo at stake" }) +
      statCard({ label: "Truly unused", value: money(usageUnusedCost()), unit: "/mo", icon: "x", iconTone: "amber", href: "#/subscriptions/waste", meta: icon("alert") + " Under 20% usage score" }) +
    "</div>" +
    '<div class="grid-12">' +
      '<div class="span-7"><section class="card card-pad">' +
        '<div class="section-head"><div><h2 class="section-title">Weekly hours by software</h2>' +
          '<div class="section-sub">Sample usage from the demo workspace. Sorted by time spent.</div></div>' +
          '<span class="pill-note">' + icon("activity") + " Sample data</span></div>" +
        '<div class="usage-chart-list">' + bars + "</div>" +
        '<div class="usage-legend"><span><i></i>Regular use</span><span><i class="low"></i>Under 40% usage score</span></div>' +
        '<div class="source-note">' + icon("info") + " Hours are illustrative. A production integration would read activity from connected tools with your permission." + "</div>" +
      "</section></div>" +
      '<div class="span-5"><div class="stack">' +
        '<section class="card card-pad"><div class="section-head"><div><h2 class="section-title">Where time goes</h2>' +
          '<div class="section-sub">Share of tracked weekly hours by category.</div></div></div>' +
          '<div class="breakdown">' + (categoryBars || '<div class="field-hint">No usage recorded yet.</div>') + "</div></section>" +
        '<section class="card card-pad"><div class="section-head"><div><h2 class="section-title">Cost per used hour</h2>' +
          '<div class="section-sub">The highest cost-per-hour tools are the best review candidates.</div></div></div>' +
          '<div class="summary-breakdown">' + (costRows || '<div class="field-hint">No cost data yet.</div>') + "</div>" +
          '<div class="source-note">' + icon("info") + " Monthly cost ÷ (weekly hours × 4.33). Estimate only." + "</div></section>" +
      "</div></div>" +
    "</div>" +
    '<section class="card mt-16"><div class="card-head bordered"><div><h2 class="card-title">All tracked software</h2>' +
      '<div class="card-sub">Active subscriptions with their latest usage signal.</div></div>' +
      '<a class="section-link" href="#/subscriptions">Manage subscriptions ' + icon("arrow-right") + "</a></div>" +
      (active.length ? '<div class="table-wrap"><table class="data-table"><thead><tr>' +
        "<th>Software</th><th>Status</th><th>Usage</th><th>Sessions · 30d</th><th>Last used</th><th>Monthly</th><th></th>" +
        "</tr></thead><tbody>" + active.map(usageTableRow).join("") + "</tbody></table></div>" :
        emptyState({ icon: "activity", title: "No active software", text: "Add a subscription to start tracking usage.", actionLabel: "Add subscription", actionAction: "open-add-sub" })) +
      '<div class="card-foot"><span class="card-note">' + icon("info") + " All usage values are sample data." + "</span>" +
        '<span class="card-note">' + icon("shield-check") + " No device or account is monitored." + "</span></div>" +
    "</section>" +
  "</div>";
}

function unusedCard(sub) {
  var alt = sub.altToolId ? toolById(sub.altToolId) : null;
  var compareUrl = "#/discover/compare?a=" + encodeURIComponent(sub.altToolId || "") + "&b=" + encodeURIComponent(sub.id);
  var snoozed = isSnoozed(sub);
  return '<article class="card unused-card">' +
    '<div class="unused-head">' +
      '<div><div class="unused-name">' + esc(sub.name) + '</div><div class="unused-sub">' + esc(sub.plan) + " · " + esc(sub.category) + "</div></div>" +
      '<div class="unused-cost">' + money(sub.cost) + "<span>/mo</span></div>" +
    "</div>" +
    '<div class="unused-evidence">' +
      '<div class="evidence-item"><div class="evidence-label">Usage score</div><div class="evidence-value">' + esc(sub.usageScore) + "%</div></div>" +
      '<div class="evidence-item"><div class="evidence-label">Sessions · 30d</div><div class="evidence-value">' + esc(sub.sessions30) + "</div></div>" +
      '<div class="evidence-item"><div class="evidence-label">Last used</div><div class="evidence-value">' + esc(relDate(sub.lastUsed)) + "</div></div>" +
    "</div>" +
    (alt ? '<div class="unused-alt">Free alternative: <strong>' + esc(alt.name) + "</strong> · keep " + money(sub.potentialSaving) + "/mo</div>" : "") +
    '<div class="unused-actions">' +
      '<button class="btn btn-secondary btn-sm" data-action="open-sub" data-id="' + attr(sub.id) + '">' + icon("eye") + "Review</button>" +
      '<a class="btn btn-ghost btn-sm" href="' + attr(compareUrl) + '">' + icon("grid") + "Compare</a>" +
      (snoozed ?
        '<button class="btn btn-ghost btn-sm" data-action="unsnooze-sub" data-id="' + attr(sub.id) + '">' + icon("clock") + "Unsnooze</button>" :
        '<button class="btn btn-ghost btn-sm" data-action="snooze-sub" data-id="' + attr(sub.id) + '">' + icon("clock") + "Snooze 30d</button>") +
      '<button class="btn btn-danger btn-sm" data-action="open-cancel" data-id="' + attr(sub.id) + '">' + icon("x") + "Cancel in demo</button>" +
    "</div>" +
  "</article>";
}

function renderUsageUnused() {
  var low = usageLow();
  var flagged = flaggedSubs();
  var lowCost = usageLowCost();
  var recoverable = flagged.reduce(function (sum, sub) { return sum + sub.potentialSaving; }, 0);
  var longUnused = low.filter(function (sub) { return daysSince(sub.lastUsed) >= 14; });

  return '<div class="page">' +
    pageHeader({
      eyebrow: "Usage evidence · sample data", eyebrowIcon: "alert",
      title: "Unused software",
      subtitle: "The tools with the weakest usage signal relative to what they cost. Review the evidence, then decide — nothing is cancelled automatically.",
      actions: '<button class="btn btn-secondary" data-action="open-waste-method">' + icon("help") + "How this is measured</button>" +
        '<a class="btn btn-primary" href="#/subscriptions/waste">' + icon("alert") + "Waste detector</a>"
    }) +
    '<div class="stats-grid">' +
      statCard({ label: "Low-use spend", value: money(lowCost), unit: "/mo", icon: "wallet", iconTone: "amber", meta: icon("layers") + " " + low.length + " of " + activeSubs().length + " active subscriptions" }) +
      statCard({ label: "Recoverable", value: money(recoverable), unit: "/mo", icon: "trending-up", iconTone: "accent", meta: icon("alert") + " " + flagged.length + " flagged by the waste detector" }) +
      statCard({ label: "Untouched for 14+ days", value: longUnused.length, unit: "", icon: "clock", iconTone: "blue", meta: icon("calendar") + " Based on last-used dates" }) +
      statCard({ label: "Annual value at stake", value: money0(recoverable * 12), unit: "/yr", icon: "target", iconTone: "purple", meta: icon("info") + " Recoverable monthly × 12 · estimate" }) +
    "</div>" +
    (low.length ? '<div class="unused-grid">' + low.map(unusedCard).join("") + "</div>" :
      '<div class="card">' + emptyState({
        icon: "check-circle", title: "No low-use software",
        text: "Every active subscription clears the 40% usage threshold. Review upcoming renewals to keep it that way.",
        actionLabel: "View subscriptions", actionRoute: "#/subscriptions"
      }) + "</div>") +
    '<div class="grid-12 mt-16">' +
      '<div class="span-7"><div class="callout warn">' + icon("alert") + "<div><strong>Low usage is a signal, not proof of waste.</strong> Seasonal tools and shared team tools can look idle. Check the last-used date and talk to anyone who shares the account before cancelling.</div></div></div>" +
      '<div class="span-5"><div class="callout">' + icon("info") + "<div>Never cancels automatically. Every action here updates this browser's demo workspace only.</div></div></div>" +
    "</div>" +
    '<div class="source-note">' + icon("info") + " Flagged when usage score is below 40, potential saving is above zero and the subscription is not snoozed." + "</div>" +
  "</div>";
}

function renderUsagePreferences() {
  var prefs = state.preferences;
  var currencies = ["INR"];
  var roleOptions = ["Student", "Freelancer", "Creator", "Small team", "Other"];

  var integrations = [
    { id: "accounting", icon: "database", name: "Accounting export", desc: "Push recorded savings to an accounting tool as expenses recovered." },
    { id: "workspace", icon: "grid", name: "Google Workspace", desc: "Read license seats and usage from your team directory." },
    { id: "slack", icon: "message", name: "Slack", desc: "Send renewal reminders and waste alerts to a channel." },
    { id: "extension", icon: "compass", name: "Browser extension", desc: "Flag paid tools while you browse and suggest alternatives." }
  ];

  return '<div class="page">' +
    pageHeader({
      eyebrow: "Preferences", eyebrowIcon: "settings",
      title: "Workspace preferences",
      subtitle: "Your profile, notifications and data controls. This is a local demo workspace — nothing is connected to a provider or email service.",
      actions: '<button class="btn btn-secondary" data-action="export-workspace">' + icon("download") + "Export workspace</button>"
    }) +
    '<div class="settings-grid">' +
      '<section class="card settings-card">' +
        '<div class="settings-head"><span class="settings-icon">' + icon("user") + "</span>" +
          '<div><div class="settings-title">Profile</div><div class="settings-sub">Used for greetings and summaries.</div></div></div>' +
        '<form data-form="profile" novalidate>' +
          '<div class="form-grid">' +
            '<div class="field" data-field="name"><label class="label" for="prefName">Your name <span class="req">*</span></label>' +
              '<input class="input" id="prefName" name="name" value="' + attr(prefs.name) + '" autocomplete="name">' +
              '<div class="field-error"></div></div>' +
            '<div class="field" data-field="email"><label class="label" for="prefEmail">Email <span class="req">*</span></label>' +
              '<input class="input" id="prefEmail" name="email" type="email" value="' + attr(prefs.email) + '" autocomplete="email">' +
              '<div class="field-error"></div></div>' +
            '<div class="field" data-field="role"><label class="label" for="prefRole">I am a</label>' +
              '<select class="select" id="prefRole" name="role">' + roleOptions.map(function (role) {
                return '<option value="' + attr(role) + '"' + (prefs.role === role ? " selected" : "") + ">" + esc(role) + "</option>";
              }).join("") + "</select></div>" +
            '<div class="field" data-field="currency"><label class="label" for="prefCurrency">Currency</label>' +
              '<select class="select" id="prefCurrency" name="currency" disabled>' + currencies.map(function (currency) {
                return '<option value="' + attr(currency) + '" selected>' + esc(currency) + " (₹) · demo</option>";
              }).join("") + "</select>" +
              '<div class="field-hint">All sample values are in Indian rupees.</div></div>' +
          "</div>" +
          '<div class="form-actions"><button class="btn btn-primary btn-sm" type="submit">' + icon("check") + "Save profile</button></div>" +
        "</form>" +
      "</section>" +
      '<section class="card settings-card">' +
        '<div class="settings-head"><span class="settings-icon">' + icon("bell") + "</span>" +
          '<div><div class="settings-title">Notifications</div><div class="settings-sub">Choose what this demo would surface if delivery existed.</div></div></div>' +
        '<div class="toggle-row"><div><strong>Weekly savings digest</strong><p>A summary of savings, renewals and new waste signals.</p></div>' +
          '<label class="switch"><input type="checkbox" data-change="pref-toggle" data-key="digest"' + (prefs.digest ? " checked" : "") + '><span class="sr-only">Weekly savings digest</span></label></div>' +
        '<div class="toggle-row"><div><strong>Savings alerts</strong><p>Tell me when a recorded switch could be worth more.</p></div>' +
          '<label class="switch"><input type="checkbox" data-change="pref-toggle" data-key="savingsAlerts"' + (prefs.savingsAlerts ? " checked" : "") + '><span class="sr-only">Savings alerts</span></label></div>' +
        '<div class="toggle-row"><div><strong>Renewal reminders</strong><p>Remind me before an active renewal date.</p></div>' +
          '<label class="switch"><input type="checkbox" data-change="pref-toggle" data-key="renewalReminders"' + (prefs.renewalReminders ? " checked" : "") + '><span class="sr-only">Renewal reminders</span></label></div>' +
        '<div class="callout mt-16">' + icon("info") + "<div>Notification delivery is not implemented. These preferences are stored locally so the prototype remembers your choice.</div></div>" +
      "</section>" +
      '<section class="card settings-card">' +
        '<div class="settings-head"><span class="settings-icon">' + icon("database") + "</span>" +
          '<div><div class="settings-title">Integrations</div><div class="settings-sub">Preview capabilities. None of these are connected.</div></div></div>' +
        integrations.map(function (item) {
          return '<div class="integration-row"><span class="integration-icon">' + icon(item.icon) + "</span>" +
            '<div class="integration-main"><div class="integration-name">' + esc(item.name) + '</div><div class="integration-desc">' + esc(item.desc) + "</div></div>" +
            badge("Preview", "outline") +
            '<button class="btn btn-ghost btn-sm" data-action="integration-preview" data-id="' + attr(item.id) + '">Details</button></div>';
        }).join("") +
        '<div class="source-note">' + icon("info") + " A production build would need OAuth, read scopes and a clear data-retention policy." + "</div>" +
      "</section>" +
      '<section class="card settings-card">' +
        '<div class="settings-head"><span class="settings-icon">' + icon("lock") + "</span>" +
          '<div><div class="settings-title">Workspace data</div><div class="settings-sub">Everything lives in this browser&rsquo;s local storage.</div></div></div>' +
        '<div class="result-stats" style="grid-template-columns:1fr 1fr">' +
          '<div class="result-stat"><span>Subscriptions</span><strong>' + state.subscriptions.length + "</strong></div>" +
          '<div class="result-stat"><span>Recorded actions</span><strong>' + savingsEvents().length + "</strong></div>" +
          '<div class="result-stat"><span>Goals</span><strong>' + state.goals.length + "</strong></div>" +
          '<div class="result-stat"><span>Storage</span><strong>Local only</strong></div>' +
        "</div>" +
        '<div class="calc-actions"><button class="btn btn-secondary btn-sm" data-action="export-workspace">' + icon("download") + "Export JSON</button>" +
          '<button class="btn btn-ghost btn-sm" data-action="export-subs">' + icon("file-text") + "Export CSV</button></div>" +
        '<div class="danger-zone"><div class="danger-zone-title">Reset demo workspace</div>' +
          "<p>Restores the sample subscriptions, goals, workflow and history. Saved changes in this browser will be removed.</p>" +
          '<button class="btn btn-danger btn-sm" data-action="reset-workspace">' + icon("rotate") + "Reset workspace</button></div>" +
      "</section>" +
    "</div>" +
    '<div class="source-note">' + icon("shield-check") + " No account, billing or provider data is stored or transmitted by this demo." + "</div>" +
  "</div>";
}

function renderUsage(route) {
  var body;
  if (route.tab === "unused") body = renderUsageUnused();
  else if (route.tab === "preferences") body = renderUsagePreferences();
  else body = renderUsageOverview();
  return body.replace("</header>", "</header>" + tabsBar(route));
}

/* ==========================================================================
   Alt. — Subscriptions
   All subscriptions, waste detection, cancellation planning, plan comparison
   and the workspace history timeline.
   ========================================================================== */
"use strict";

function subsFiltered() {
  var list = state.subscriptions.slice();
  var query = (ui.subSearch || "").trim().toLowerCase();
  if (query) {
    list = list.filter(function (sub) {
      return (sub.name + " " + sub.vendor + " " + sub.category + " " + sub.plan).toLowerCase().indexOf(query) !== -1;
    });
  }
  if (ui.subCategory && ui.subCategory !== "All") {
    list = list.filter(function (sub) { return sub.category === ui.subCategory; });
  }
  if (ui.subStatus && ui.subStatus !== "All") {
    list = list.filter(function (sub) { return usageLabel(sub) === ui.subStatus; });
  }
  var sort = ui.subSort || "name";
  list.sort(function (a, b) {
    if (sort === "cost") return b.cost - a.cost;
    if (sort === "renewal") return parseDate(a.renewal) - parseDate(b.renewal);
    if (sort === "usage") return a.usageScore - b.usageScore;
    return a.name.localeCompare(b.name);
  });
  return list;
}

function subsCategories() {
  var seen = {};
  state.subscriptions.forEach(function (sub) { seen[sub.category] = true; });
  return Object.keys(seen).sort();
}

function subsStatusOptions() {
  return ["All", "Active", "Low use", "Unused", "Snoozed", "Cancelled"];
}

function subsPlanFeatures(tool) {
  return (tool.features || []).slice(0, 5).map(function (feature) {
    return '<div class="feature-line">' + icon("check") + "<span>" + esc(feature) + "</span></div>";
  }).join("");
}

function subsPlanCompare(sub, alt) {
  var currentFeatures = (sub.planFeatures || []).slice(0, 5).map(function (feature) {
    return '<div class="feature-line">' + icon("check") + "<span>" + esc(feature) + "</span></div>";
  }).join("");
  var losses = (sub.loseOnFree || []).slice(0, 4).map(function (feature) {
    return '<div class="feature-line lose">' + icon("alert") + "<span>" + esc(feature) + "</span></div>";
  }).join("");
  return '<div class="plan-compare">' +
    '<div class="plan-card">' +
      '<div class="plan-card-head"><span class="plan-card-title">' + esc(sub.name) + "</span>" +
        '<span class="plan-card-price">' + money(sub.cost) + "/mo</span></div>" +
      '<div class="plan-card-price">Current plan · billed ' + esc((sub.cycle || "monthly").toLowerCase()) + "</div>" +
      currentFeatures +
    "</div>" +
    '<div class="plan-card free">' +
      '<div class="plan-card-head"><span class="plan-card-title">' + esc(alt ? alt.name : sub.altLabel || "Free alternative") + "</span>" +
        '<span class="plan-card-price free">' + (alt && alt.price ? money(alt.price) + "/mo" : "Free") + "</span></div>" +
      '<div class="plan-card-price free">Suggested replacement</div>' +
      (alt ? subsPlanFeatures(alt) : '<div class="feature-line">' + icon("check") + "<span>Free plan covers the core workflow.</span></div>") +
      (losses ? '<div class="plan-losses"><div class="plan-losses-title">What you give up</div>' + losses + "</div>" : "") +
    "</div>" +
  "</div>";
}

function subsDecision(sub) {
  if (sub.usageScore < 20) {
    return {
      tone: "", icon: "check-circle",
      text: "You used <strong>" + esc(sub.name) + "</strong> only " + esc(sub.sessions30) + " times in 30 days. Cancelling looks low risk — export your work first, then try the free alternative for a week."
    };
  }
  if (sub.usageScore < 40) {
    return {
      tone: "", icon: "info",
      text: "Usage is low but not zero. Keep the paid plan for one more cycle while you test the free alternative on a real project."
    };
  }
  return {
    tone: "keep", icon: "shield-check",
    text: "You are actively using <strong>" + esc(sub.name) + "</strong> — " + esc(sub.weeklyHours) + " h/week. Keep it unless the free plan covers everything you need."
  };
}

function subsRow(sub) {
  var tone = usageTone(sub.usageScore);
  var compareUrl = "#/discover/compare?a=" + encodeURIComponent(sub.altToolId || "") + "&b=" + encodeURIComponent(sub.id);
  return "<tr>" +
    '<td data-label="Software"><div class="cell-name">' + logoHtml(sub) +
      "<div><div class='cell-name-main'>" + esc(sub.name) + '</div><div class="cell-name-sub">' + esc(sub.vendor) + " · " + esc(sub.plan) + "</div></div>" +
    "</div></td>" +
    '<td data-label="Category"><span class="badge badge-neutral">' + esc(sub.category) + "</span></td>" +
    '<td data-label="Status">' + statusBadge(sub) + "</td>" +
    '<td data-label="Usage"><div class="usage-cell"><div class="usage-cell-top"><strong>' + esc(sub.usageScore) + "%</strong>" +
      "<span>" + esc(sub.weeklyHours) + " h/wk</span></div>" +
      '<div class="progress"><div class="progress-bar ' + attr(tone === "accent" ? "" : tone) + '" style="width:' + clamp(sub.usageScore, 0, 100) + '%"></div></div>' +
    "</div></td>" +
    '<td data-label="Monthly" class="num">' + money(sub.cost) + "</td>" +
    '<td data-label="Renews"><div class="num">' + (sub.status === "cancelled" ? "—" : fmtDate(sub.renewal, false)) + "</div>" +
      '<div class="table-soft">' + (sub.status === "cancelled" ? "Cancelled" : renewalLabel(sub.renewal)) + "</div></td>" +
    '<td data-label="" class="right"><div class="cell-actions">' +
      '<button class="icon-btn-sm" data-action="open-sub" data-id="' + attr(sub.id) + '" title="View details" aria-label="View ' + attr(sub.name) + '">' + icon("eye") + "</button>" +
      (sub.status === "active" ? '<a class="icon-btn-sm" href="' + attr(compareUrl) + '" title="Find an alternative" aria-label="Find an alternative for ' + attr(sub.name) + '">' + icon("compass") + "</a>" :
        '<button class="icon-btn-sm" data-action="restore-cancel" data-id="' + attr(sub.id) + '" title="Restore cancelled subscription" aria-label="Restore ' + attr(sub.name) + '">' + icon("rotate") + "</button>") +
    "</div></td>" +
  "</tr>";
}

function renderSubscriptionsAll() {
  var list = subsFiltered();
  var total = state.subscriptions.length;
  var flagged = flaggedSubs();
  var categoryOptions = ['<option value="All">All categories</option>'].concat(subsCategories().map(function (category) {
    return '<option value="' + attr(category) + '"' + (ui.subCategory === category ? " selected" : "") + ">" + esc(category) + "</option>";
  })).join("");
  var statusOptions = subsStatusOptions().map(function (status) {
    return '<option value="' + attr(status) + '"' + (ui.subStatus === status ? " selected" : "") + ">" + esc(status) + "</option>";
  }).join("");
  var sortOptions = [
    { id: "name", label: "Sort: name" },
    { id: "cost", label: "Sort: cost" },
    { id: "renewal", label: "Sort: renewal" },
    { id: "usage", label: "Sort: usage" }
  ].map(function (option) {
    return '<option value="' + option.id + '"' + (ui.subSort === option.id ? " selected" : "") + ">" + esc(option.label) + "</option>";
  }).join("");

  return '<div class="page">' +
    pageHeader({
      eyebrow: "Subscription control", eyebrowIcon: "layers",
      title: "Subscriptions",
      subtitle: "Every recurring tool in one place, with usage evidence, renewal dates and a mapped free alternative.",
      actions: '<button class="btn btn-secondary" data-action="export-subs">' + icon("download") + "Export CSV</button>" +
        '<button class="btn btn-primary" data-action="open-add-sub">' + icon("plus") + "Add subscription</button>"
    }) +
    '<section class="card">' +
      '<div class="sub-summarybar">' +
        "<span><strong>" + activeSubs().length + "</strong> active</span><span class=\"sep\"></span>" +
        "<span><strong>" + money(monthlySpend()) + "/mo</strong> total</span><span class=\"sep\"></span>" +
        "<span><strong>" + flagged.length + "</strong> need review</span>" +
        '<a class="section-link" href="#/subscriptions/waste">Waste detector ' + icon("arrow-right") + "</a>" +
      "</div>" +
      '<div class="table-toolbar">' +
        '<div class="toolbar-search">' + icon("search") +
          '<input class="input" type="search" placeholder="Search subscriptions" aria-label="Search subscriptions" data-live="sub-search" value="' + attr(ui.subSearch) + '">' +
        "</div>" +
        '<select class="select toolbar-select" aria-label="Filter by category" data-change="sub-category">' + categoryOptions + "</select>" +
        '<select class="select toolbar-select" aria-label="Filter by status" data-change="sub-status">' + statusOptions + "</select>" +
        '<select class="select toolbar-select" aria-label="Sort subscriptions" data-change="sub-sort">' + sortOptions + "</select>" +
        '<span class="result-count">' + list.length + " of " + total + "</span>" +
      "</div>" +
      (list.length ? '<div class="table-wrap"><table class="data-table"><thead><tr>' +
        "<th>Software</th><th>Category</th><th>Status</th><th>Usage</th><th>Monthly</th><th>Renews</th><th></th>" +
        "</tr></thead><tbody>" + list.map(subsRow).join("") + "</tbody></table></div>" :
        emptyState({
          icon: "search", title: "No subscriptions match those filters",
          text: "Try a broader search, a different category or clear the filters.",
          actionLabel: "Clear filters", actionAction: "clear-sub-filters"
        })) +
      '<div class="card-foot"><span class="card-note">' + icon("info") + " Sample data · renewals and usage are demo values.</span>" +
        '<span class="card-note">' + icon("shield-check") + " Nothing is connected to a provider.</span></div>" +
    "</section>" +
  "</div>";
}

function subsWasteCard(sub) {
  var alt = sub.altToolId ? toolById(sub.altToolId) : null;
  var compareUrl = "#/discover/compare?a=" + encodeURIComponent(sub.altToolId || "") + "&b=" + encodeURIComponent(sub.id);
  return '<article class="card waste-card">' +
    '<div class="waste-card-head">' +
      '<div class="waste-card-identity">' + logoHtml(sub) +
        "<div><div class=\"waste-card-name\">" + esc(sub.name) + '</div><div class="waste-card-sub">' + esc(sub.plan) + " · " + esc(sub.category) + "</div></div></div>" +
      '<div class="waste-card-cost"><strong>' + money(sub.potentialSaving) + '</strong><span>recoverable /mo</span></div>' +
    "</div>" +
    '<div class="waste-evidence">' +
      '<div class="evidence-item"><div class="evidence-label">Usage score</div><div class="evidence-value">' + esc(sub.usageScore) + "%</div></div>" +
      '<div class="evidence-item"><div class="evidence-label">Sessions · 30d</div><div class="evidence-value">' + esc(sub.sessions30) + "</div></div>" +
      '<div class="evidence-item"><div class="evidence-label">Last used</div><div class="evidence-value">' + esc(relDate(sub.lastUsed)) + "</div></div>" +
    "</div>" +
    (alt ? '<a class="waste-alt" href="' + attr(compareUrl) + '">' + icon("compass") + "<span>Free alternative: <strong>" + esc(alt.name) + "</strong> · keep " + money(sub.potentialSaving) + "/mo</span></a>" : "") +
    '<div class="waste-actions">' +
      '<button class="btn btn-secondary btn-sm" data-action="open-sub" data-id="' + attr(sub.id) + '">' + icon("eye") + "Review</button>" +
      '<button class="btn btn-danger btn-sm" data-action="open-cancel" data-id="' + attr(sub.id) + '">' + icon("x") + "Cancel in demo</button>" +
      '<button class="btn btn-ghost btn-sm" data-action="snooze-sub" data-id="' + attr(sub.id) + '">' + icon("clock") + "Snooze 30d</button>" +
    "</div>" +
  "</article>";
}

function renderSubscriptionsWaste() {
  var flagged = flaggedSubs().slice().sort(function (a, b) { return b.potentialSaving - a.potentialSaving; });
  var snoozed = snoozedSubs();
  var waste = potentialSavings();
  var pct = monthlySpend() ? percent(waste, monthlySpend()) : 0;

  var hero = '<section class="waste-hero">' +
    "<div>" +
      '<div class="waste-hero-label">' + icon("alert") + "Waste detector · sample data</div>" +
      '<div class="waste-hero-value">' + money(waste) + ' <small>/mo potentially recoverable</small></div>' +
      '<div class="waste-hero-desc">' + (flagged.length ?
        esc(flagged.length) + (flagged.length === 1 ? " subscription shows" : " subscriptions show") + " low engagement relative to cost. Usage is measured from the demo workspace, not from a live integration." :
        "No active subscriptions are currently flagged. Low-use subscriptions you snooze are excluded until the snooze ends.") + "</div>" +
    "</div>" +
    '<div class="waste-hero-side">' +
      '<div class="waste-hero-stat">' + (monthlySpend() ? pct + "% of active spend" : "No active spend") + "</div>" +
      '<button class="btn btn-secondary btn-sm" data-action="open-waste-method">' + icon("help") + "How we calculate this</button>" +
    "</div>" +
  "</section>";

  var grid = flagged.length ?
    '<div class="waste-grid mt-16">' + flagged.map(subsWasteCard).join("") + "</div>" :
    '<div class="card mt-16">' + emptyState({
      icon: "check-circle", title: "No waste detected",
      text: "Every active subscription is either used regularly or snoozed. Review the full stack for upcoming renewals.",
      actionLabel: "View all subscriptions", actionRoute: "#/subscriptions"
    }) + "</div>";

  var snoozedCard = snoozed.length ? '<section class="card mt-16">' +
    '<div class="card-head bordered"><div><h2 class="card-title">Snoozed subscriptions</h2>' +
      '<div class="card-sub">Hidden from waste alerts until the snooze ends.</div></div></div>' +
    '<div class="card-body">' + snoozed.map(function (sub) {
      return '<div class="renewal-item"><span class="logo logo-sm" style="--logo-color:' + attr(sub.color) + '">' + esc(sub.initials) + "</span>" +
        '<div class="renewal-main"><div class="renewal-name">' + esc(sub.name) + '</div><div class="renewal-date">Snoozed until ' + esc(fmtDate(sub.snoozedUntil)) + "</div></div>" +
        '<button class="btn btn-ghost btn-sm" data-action="unsnooze-sub" data-id="' + attr(sub.id) + '">Unsnooze</button></div>';
    }).join("") + "</div></section>" : "";

  return '<div class="page">' +
    pageHeader({
      eyebrow: "Usage evidence", eyebrowIcon: "alert",
      title: "Waste detector",
      subtitle: "Find subscriptions that cost more than the value they return — before the next renewal.",
      actions: '<a class="btn btn-secondary" href="#/usage/unused">' + icon("activity") + "Open usage view</a>"
    }) +
    hero + grid + snoozedCard +
    '<div class="source-note">' + icon("info") + " Flagged when usage score is below 40, potential saving is above zero and the subscription is not snoozed.</div>" +
  "</div>";
}

function renderSubscriptionsCancel() {
  var options = activeSubs();
  var selected = subById(ui.cancelSub) || flaggedSubs()[0] || options[0] || null;
  var alt = selected && selected.altToolId ? toolById(selected.altToolId) : null;
  var compareUrl = selected ? "#/discover/compare?a=" + encodeURIComponent(selected.altToolId || "") + "&b=" + encodeURIComponent(selected.id) : "#/discover";

  var steps = [
    { title: "Export your work", desc: "Download projects, fonts, presets and shared files from the provider." },
    { title: "Check the billing page", desc: "Confirm the renewal date, plan and any cancellation fees." },
    { title: "Cancel with the provider", desc: "Alt. does not cancel for you. This demo records the decision only." },
    { title: "Import into the alternative", desc: "Test one real project in the free tool before you rely on it." }
  ].map(function (step, index) {
    return '<div class="cancel-step"><div class="cancel-step-num">' + (index + 1) + '</div><div class="cancel-step-title">' + esc(step.title) +
      '</div><div class="cancel-step-desc">' + esc(step.desc) + "</div></div>";
  }).join("");

  if (!selected) {
    return '<div class="page">' +
      pageHeader({ eyebrow: "Cancellation", eyebrowIcon: "x", title: "Cancellation", subtitle: "A careful, reversible path out of software you no longer use." }) +
      '<div class="card">' + emptyState({
        icon: "check-circle", title: "Nothing active to cancel",
        text: "All subscriptions in this demo workspace are already cancelled. Add a subscription to plan a cancellation.",
        actionLabel: "Add subscription", actionAction: "open-add-sub"
      }) + "</div></div>";
  }

  var decision = subsDecision(selected);
  var activeOptions = options.map(function (sub) {
    return '<option value="' + attr(sub.id) + '"' + (selected.id === sub.id ? " selected" : "") + ">" + esc(sub.name) + " · " + money(sub.cost) + "/mo</option>";
  }).join("");

  return '<div class="page">' +
    pageHeader({
      eyebrow: "Cancellation planner", eyebrowIcon: "x",
      title: "Cancellation",
      subtitle: "Prepare a clean exit before you cancel. This demo records actions in your workspace — it never contacts a provider.",
      actions: '<a class="btn btn-secondary" href="' + attr(compareUrl) + '">' + icon("compass") + "Compare first</a>"
    }) +
    '<div class="card card-pad">' +
      '<div class="field"><label class="label" for="cancelSubSelect">Subscription to review</label>' +
        '<select class="select" id="cancelSubSelect" data-change="cancel-sub">' + activeOptions + "</select></div>" +
      '<div class="divider divider-spaced"></div>' +
      subsPlanCompare(selected, alt) +
      '<div class="decision ' + attr(decision.tone) + '">' + icon(decision.icon) + "<div>" + decision.text + "</div></div>" +
      '<div class="calc-actions">' +
        '<button class="btn btn-danger" data-action="open-cancel" data-id="' + attr(selected.id) + '">' + icon("x") + "Mark cancelled in demo</button>" +
        (alt ? '<a class="btn btn-secondary" href="' + attr(compareUrl) + '">' + icon("compass") + "See free alternative</a>" : "") +
        '<a class="btn btn-ghost" href="#/workflows/help">' + icon("lifebuoy") + "Switching checklist</a>" +
      "</div>" +
    "</div>" +
    '<div class="section-head mt-24"><div><h2 class="section-title">Four steps before you cancel</h2>' +
      '<div class="section-sub">Do these in order so nothing gets lost.</div></div></div>' +
    '<div class="cancel-steps">' + steps + "</div>" +
    '<div class="callout warn mt-16">' + icon("alert") + "<div><strong>Demo only.</strong> Alt. cannot cancel or modify a real subscription. In this workspace the action only updates sample data and adds a record to your history.</div></div>" +
  "</div>";
}

function renderSubscriptionsCompare() {
  var options = activeSubs().filter(function (sub) { return sub.altToolId; });
  var selected = subById(ui.compareSub) || flaggedSubs()[0] || options[0] || null;
  var alt = selected && selected.altToolId ? toolById(selected.altToolId) : null;
  var paidTool = selected ? paidToolForName(selected.name) : null;
  var monthlySaving = selected && alt ? Math.max(0, selected.cost - (alt.price || 0)) : 0;
  var costPerHour = selected && selected.weeklyHours > 0 ? selected.cost / (selected.weeklyHours * 4.33) : null;
  var altCostPerHour = alt ? 0 : null;
  var simUrl = "#/workflows/simulator?from=" + encodeURIComponent(paidTool ? paidTool.id : (selected ? selected.id : "")) + "&to=" + encodeURIComponent(alt ? alt.id : "");
  var decision = selected ? subsDecision(selected) : null;

  if (!selected) {
    return '<div class="page">' +
      pageHeader({ eyebrow: "Plan comparison", eyebrowIcon: "grid", title: "Compare plans", subtitle: "See exactly what you gain and give up before switching." }) +
      '<div class="card">' + emptyState({
        icon: "layers", title: "No comparable subscriptions", text: "Add an active subscription with a mapped alternative to compare plans.",
        actionLabel: "Add subscription", actionAction: "open-add-sub"
      }) + "</div></div>";
  }

  var optionHtml = options.map(function (sub) {
    return '<option value="' + attr(sub.id) + '"' + (selected.id === sub.id ? " selected" : "") + ">" + esc(sub.name) + "</option>";
  }).join("");

  return '<div class="page">' +
    pageHeader({
      eyebrow: "Plan comparison", eyebrowIcon: "grid",
      title: "Compare plans",
      subtitle: "A side-by-side view of the paid plan you have and the free plan that could replace it.",
      actions: '<a class="btn btn-secondary" href="#/subscriptions/waste">' + icon("alert") + "Review waste</a>"
    }) +
    '<div class="card card-pad">' +
      '<div class="form-grid">' +
        '<div class="field"><label class="label" for="compareSubSelect">Subscription</label>' +
          '<select class="select" id="compareSubSelect" data-change="compare-sub">' + optionHtml + "</select></div>" +
        '<div class="field"><label class="label">Current monthly cost</label>' +
          '<div class="input-affix"><span class="affix">₹</span><input class="input" value="' + esc(selected.cost) + '" readonly aria-label="Current monthly cost"></div></div>' +
      "</div>" +
      '<div class="divider divider-spaced"></div>' +
      subsPlanCompare(selected, alt) +
      '<div class="result-stats mt-16">' +
        '<div class="result-stat"><span>Est. monthly saving</span><strong class="text-accent">' + money(monthlySaving) + "</strong></div>" +
        '<div class="result-stat"><span>Cost per used hour</span><strong>' + (costPerHour == null ? "—" : money(costPerHour)) + "</strong></div>" +
        '<div class="result-stat"><span>Free plan cost/hour</span><strong>' + (alt ? (altCostPerHour == null ? "—" : "₹0") : "—") + "</strong></div>" +
      "</div>" +
      (decision ? '<div class="decision ' + attr(decision.tone) + ' mt-16">' + icon(decision.icon) + "<div>" + decision.text + "</div></div>" : "") +
      '<div class="calc-actions">' +
        '<a class="btn btn-primary" href="' + attr(simUrl) + '">' + icon("play") + "Simulate the switch</a>" +
        (alt ? '<a class="btn btn-secondary" href="' + attr("#/discover/compare?a=" + encodeURIComponent(paidTool ? paidTool.id : selected.id) + "&b=" + encodeURIComponent(alt.id)) + '">' + icon("grid") + "Feature comparison</a>" : "") +
        '<button class="btn btn-ghost" data-action="open-sub" data-id="' + attr(selected.id) + '">' + icon("eye") + "Subscription details</button>" +
      "</div>" +
    "</div>" +
    '<div class="callout mt-16">' + icon("info") + "<div>Cost per used hour is calculated from the sample weekly usage in this workspace. It is an illustration, not a billable metric.</div></div>" +
  "</div>";
}

function renderSubscriptionsHistory() {
  var events = savingsEvents();
  var rate = savingsRate();
  var saved = savedToDate();
  var activityItems = state.activity.slice(0, 6).map(function (item) {
    var meta = overviewActivityIcon(item.type);
    return '<div class="activity-item">' +
      '<span class="activity-icon ' + attr(meta.tone) + '">' + icon(meta.icon) + "</span>" +
      '<div class="activity-body"><div class="activity-title">' + esc(item.title) + "</div>" +
        '<div class="activity-detail">' + esc(item.detail) + "</div></div>" +
      '<span class="activity-time">' + esc(relDate(item.date)) + "</span></div>";
  }).join("");

  var timeline = events.map(function (event) {
    var isCancel = event.type === "cancellation";
    return '<div class="history-item">' +
      '<span class="history-icon' + (isCancel ? " cancel" : "") + '">' + icon(isCancel ? "x" : "repeat") + "</span>" +
      '<div class="history-main">' +
        '<div class="history-title">' + esc(event.from) + icon("arrow-right") + esc(event.to) +
          '<span class="badge badge-neutral">' + esc(event.category) + "</span></div>" +
        '<div class="history-sub">' + (isCancel ? "Subscription cancelled in demo workspace" : "Switched to a free alternative") + "</div>" +
      "</div>" +
      '<div class="history-right"><div class="history-saving">-' + money0(event.monthlySaving) + "/mo</div>" +
        '<div class="history-date">' + esc(fmtDate(event.date)) + "</div></div>" +
    "</div>";
  }).join("");

  return '<div class="page">' +
    pageHeader({
      eyebrow: "Recorded actions", eyebrowIcon: "clock",
      title: "History",
      subtitle: "Every switch and cancellation recorded in this demo workspace, with the monthly value of each decision.",
      actions: '<button class="btn btn-secondary" data-action="export-subs">' + icon("download") + "Export records</button>"
    }) +
    '<div class="stats-grid">' +
      statCard({ label: "Monthly savings rate", value: money0(rate), unit: "/mo", icon: "trending-up", iconTone: "accent", meta: icon("repeat") + " " + events.length + " recorded actions" }) +
      statCard({ label: "Saved to date", value: money0(saved), unit: "", icon: "wallet", iconTone: "blue", meta: icon("calendar") + " Accrued since your first switch" }) +
      statCard({ label: "Annualised savings", value: money0(rate * 12), unit: "/yr", icon: "target", iconTone: "purple", meta: icon("info") + " Monthly rate × 12 · estimate" }) +
      statCard({ label: "Switches", value: state.switchHistory.length, unit: "", icon: "workflow", iconTone: "accent", meta: icon("x") + " " + state.cancellations.length + " cancellations" }) +
    "</div>" +
    '<div class="grid-12">' +
      '<div class="span-7"><section class="card card-pad"><div class="section-head"><div><h2 class="section-title">Savings timeline</h2>' +
        '<div class="section-sub">Newest first. Amounts are monthly estimates.</div></div></div>' +
        (timeline ? '<div class="history-list">' + timeline + "</div>" : emptyState({
          icon: "clock", title: "No history yet", text: "Record a switch or cancellation to start your savings timeline.",
          actionLabel: "Find an alternative", actionRoute: "#/discover"
        })) + "</section></div>" +
      '<div class="span-5"><section class="card card-pad"><div class="section-head"><div><h2 class="section-title">Workspace activity</h2>' +
        '<div class="section-sub">Recent changes and insights.</div></div></div>' +
        (activityItems ? '<div class="activity-list">' + activityItems + "</div>" : emptyState({ inline: true, icon: "activity", title: "No activity", text: "Workspace actions will appear here." })) +
      "</section></div>" +
    "</div>" +
    '<div class="source-note">' + icon("info") + " History is stored locally in this browser. Clearing the demo workspace removes it.</div>" +
  "</div>";
}

function renderSubscriptions(route) {
  var body;
  if (route.tab === "waste") body = renderSubscriptionsWaste();
  else if (route.tab === "cancel") body = renderSubscriptionsCancel();
  else if (route.tab === "compare") body = renderSubscriptionsCompare();
  else if (route.tab === "history") body = renderSubscriptionsHistory();
  else body = renderSubscriptionsAll();

  if (body.indexOf('<div class="page">') === 0) {
    return body.replace("</header>", "</header>" + tabsBar(route));
  }
  return body;
}

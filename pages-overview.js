/* ==========================================================================
   Alt. — Overview
   One screen that answers: what am I paying, what is wasted, what changed,
   and what should I do next.
   ========================================================================== */
"use strict";

function overviewGreeting() {
  var hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

function overviewActivityIcon(type) {
  var map = {
    switch: { icon: "repeat", tone: "accent" },
    cancellation: { icon: "x", tone: "amber" },
    insight: { icon: "sparkles", tone: "blue" },
    workflow: { icon: "workflow", tone: "purple" },
    goal: { icon: "target", tone: "amber" },
    snooze: { icon: "clock", tone: "amber" },
    subscription: { icon: "plus", tone: "accent" }
  };
  return map[type] || { icon: "activity", tone: "" };
}

function overviewActionItem(item) {
  return '<a class="action-item" href="' + attr(item.href) + '">' +
    '<span class="action-icon ' + attr(item.tone || "") + '">' + icon(item.icon) + "</span>" +
    '<span class="action-main"><span class="action-title">' + esc(item.title) + "</span>" +
      '<span class="action-detail">' + esc(item.detail) + "</span></span>" +
    '<span class="action-cta">' + esc(item.cta) + icon("arrow-right") + "</span>" +
  "</a>";
}

function renderOverview(route) {
  var spend = monthlySpend();
  var waste = potentialSavings();
  var rate = savingsRate();
  var goal = annualGoal();
  var subs = activeSubs();
  var flagged = flaggedSubs();
  var cats = categorySpend();
  var catTotal = cats.reduce(function (sum, item) { return sum + item.value; }, 0);
  var series = savingsSeries(ui.chartRange);
  var lastValue = series.length ? series[series.length - 1].value : 0;
  var now = new Date();
  var thisMonth = monthAccrual(now.getFullYear(), now.getMonth());
  var most = mostUsedSub();
  var renewal = upcomingRenewals(1)[0];
  var bestWaste = flagged.slice().sort(function (a, b) { return b.potentialSaving - a.potentialSaving; })[0];
  var bestAlt = bestWaste && bestWaste.altToolId ? toolById(bestWaste.altToolId) : null;
  var goalPct = goal ? goalProgress(goal) : 0;
  var user = state.preferences.name || "there";

  var actions = [];
  if (bestWaste) {
    actions.push({
      icon: "alert", tone: "warn",
      title: "Pause " + bestWaste.name,
      detail: "Used " + bestWaste.sessions30 + (bestWaste.sessions30 === 1 ? " time" : " times") + " in 30 days · " + money(bestWaste.potentialSaving) + "/mo recoverable",
      cta: "Review", href: "#/subscriptions/waste"
    });
  }
  if (renewal) {
    actions.push({
      icon: "calendar", tone: "blue",
      title: renewal.name + " renews " + renewalLabel(renewal.renewal).toLowerCase(),
      detail: fmtDate(renewal.renewal) + " · " + money(renewal.cost) + "/mo",
      cta: "Manage", href: "#/subscriptions"
    });
  }
  if (bestWaste && bestAlt) {
    actions.push({
      icon: "compass", tone: "accent",
      title: "Try " + bestAlt.name + " instead of " + bestWaste.name,
      detail: "Capability match " + bestAlt.match + "% · free alternative",
      cta: "Compare", href: "#/discover/compare?a=" + encodeURIComponent(bestWaste.altToolId) + "&b=" + encodeURIComponent(bestWaste.id)
    });
  }
  actions.push({
    icon: "calculator", tone: "blue",
    title: "Model your next switch",
    detail: "Seats, months and annual impact before you commit.",
    cta: "Calculate", href: "#/savings/calculator"
  });

  var stats = '<div class="stats-grid">' +
    statCard({
      label: "Monthly software spend", value: money(spend), unit: "/mo",
      icon: "credit-card", iconTone: "blue", href: "#/subscriptions",
      meta: icon("layers") + " " + subs.length + " active subscriptions"
    }) +
    statCard({
      label: "Recoverable waste", value: money(waste), unit: "/mo",
      icon: "alert", iconTone: "amber", href: "#/subscriptions/waste",
      meta: flagged.length ? icon("alert") + " " + flagged.length + " flagged by usage" : icon("check-circle") + " Nothing flagged right now"
    }) +
    statCard({
      label: "Saved every month", value: money0(rate), unit: "/mo",
      icon: "trending-up", iconTone: "accent", href: "#/savings",
      meta: icon("repeat") + " Across " + savingsEvents().length + " recorded actions"
    }) +
    statCard({
      label: "Annual savings goal", value: goalPct + "%", unit: "",
      icon: "target", iconTone: "purple", href: "#/savings/goals",
      meta: goal ? money0(goalCurrent(goal)) + " of " + money0(goal.target) + " saved" : "Set a goal to track progress",
      progress: goalPct, progressLabel: "<span>" + (goal ? escapePercent(goalCurrent(goal), goal.target) : "0") + " of target</span><strong>" + (goal ? moneyCompact(goal.target) : "—") + "</strong>"
    }) +
  "</div>";

  var rangeButtons = [6, 12].map(function (value) {
    return '<button class="seg-btn' + (ui.chartRange === value ? " active" : "") + '" data-action="chart-range" data-range="' +
      value + '" aria-pressed="' + (ui.chartRange === value) + '">' + value + "M</button>";
  }).join("");

  var chartCard = '<section class="card chart-card">' +
    '<div class="card-head">' +
      '<div><h2 class="card-title">Savings growth</h2>' +
        '<div class="card-sub">Cumulative savings from switches and cancellations in this demo workspace.</div></div>' +
      '<div class="chart-range segmented" role="group" aria-label="Chart range">' + rangeButtons + "</div>" +
    "</div>" +
    '<div class="card-body">' +
      '<div class="chart-metric"><strong>' + money0(lastValue) + "</strong><span>saved to date · estimate</span></div>" +
      '<div class="chart-metric-sub">' + money0(thisMonth) + " accrued this month across " + savingsEvents().length + " actions</div>" +
      '<div class="chart-body">' + areaChart(series, { label: "Cumulative savings over the last " + ui.chartRange + " months" }) + "</div>" +
    "</div>" +
  "</section>";

  var actionsCard = '<section class="card">' +
    '<div class="card-head"><div><h2 class="card-title">Recommended next actions</h2>' +
      '<div class="card-sub">Ranked from your usage and renewal data.</div></div>' +
      '<a class="section-link" href="#/subscriptions/waste">All waste ' + icon("arrow-right") + "</a></div>" +
    (waste ? '<div class="action-summary">' + icon("alert") + "<span><strong>" + money(waste) + "/mo</strong> is recoverable across " + flagged.length + " subscriptions.</span></div>" : "") +
    '<div class="action-list">' + actions.slice(0, 4).map(overviewActionItem).join("") + "</div>" +
  "</section>";

  var legend = cats.map(function (cat) {
    return '<div class="legend-row"><span class="legend-dot" style="background:' + attr(cat.color) + '"></span>' +
      '<span class="legend-label">' + esc(cat.label) + '</span><span class="legend-value">' + money0(cat.value) + " · " + cat.pct + "%</span></div>";
  }).join("");

  var biggest = cats[0];
  var donutCard = '<section class="card">' +
    '<div class="card-head"><div><h2 class="card-title">Spend by category</h2>' +
      '<div class="card-sub">Active subscriptions only, billed monthly.</div></div>' +
      '<a class="section-link" href="#/subscriptions">Subscriptions ' + icon("arrow-right") + "</a></div>" +
    '<div class="card-body"><div class="donut-layout">' + donutChart(cats, catTotal) +
      '<div class="legend">' + legend + "</div></div>" +
      (biggest ? '<div class="donut-insight">' + icon("info") + "<span><strong>" + esc(biggest.label) + "</strong> is your largest category at " +
        biggest.pct + "% of spend. Reviewing it first has the biggest impact.</span></div>" : "") +
    "</div>" +
  "</section>";

  var activityItems = state.activity.slice(0, 5).map(function (item) {
    var meta = overviewActivityIcon(item.type);
    return '<div class="activity-item">' +
      '<span class="activity-icon ' + attr(meta.tone) + '">' + icon(meta.icon) + "</span>" +
      '<div class="activity-body"><div class="activity-title">' + esc(item.title) + "</div>" +
        '<div class="activity-detail">' + esc(item.detail) + "</div></div>" +
      '<span class="activity-time">' + esc(relDate(item.date)) + "</span>" +
    "</div>";
  }).join("");

  var activityCard = '<section class="card">' +
    '<div class="card-head"><div><h2 class="card-title">Recent activity</h2>' +
      '<div class="card-sub">Changes recorded in this workspace.</div></div>' +
      '<a class="section-link" href="#/subscriptions/history">History ' + icon("arrow-right") + "</a></div>" +
    (activityItems ? '<div class="activity-list">' + activityItems + "</div>" : emptyState({
      icon: "activity", title: "No activity yet", inline: true,
      text: "Switch or cancel a tool and it will appear here.", actionLabel: "Find an alternative", actionRoute: "#/discover"
    })) +
  "</section>";

  var insightCols = "";
  if (most) {
    insightCols += '<div class="insight-col"><span class="insight-col-icon">' + icon("trending-up") + "</span>" +
      '<div><div class="insight-col-title">Most used</div><div class="insight-col-text"><strong>' + esc(most.name) + "</strong> takes " +
      esc(most.weeklyHours) + " h/week across " + esc(most.sessions30) + " sessions.</div></div></div>";
  }
  if (bestWaste && bestAlt) {
    insightCols += '<div class="insight-col"><span class="insight-col-icon">' + icon("compass") + "</span>" +
      '<div><div class="insight-col-title">Best switch candidate</div><div class="insight-col-text"><strong>' + esc(bestWaste.name) + "</strong> → " +
      '<a href="#/discover/compare?a=' + encodeURIComponent(bestWaste.altToolId) + "&b=" + encodeURIComponent(bestWaste.id) + '">' + esc(bestAlt.name) + "</a> could save " +
      money0(bestWaste.potentialSaving) + "/mo.</div></div></div>";
  }
  if (renewal) {
    insightCols += '<div class="insight-col"><span class="insight-col-icon">' + icon("calendar") + "</span>" +
      '<div><div class="insight-col-title">Next renewal</div><div class="insight-col-text"><strong>' + esc(renewal.name) + "</strong> renews " +
      esc(renewalLabel(renewal.renewal).toLowerCase()) + " · " + money0(renewal.cost) + "/mo. <a href=\"#/subscriptions\">Review</a></div></div></div>";
  }

  var insightsCard = insightCols ? '<section class="card insights-card"><div class="insights-grid">' + insightCols + "</div></section>" : "";

  return '<div class="page">' +
    pageHeader({
      eyebrow: "Workspace overview", eyebrowIcon: "sparkles",
      title: overviewGreeting() + ", " + user + ".",
      subtitle: "Here is what your software stack looks like today — spend, waste, savings and the next best move. <span class=\"demo-note\">" + icon("info") + " Demo workspace · sample data</span>",
      actions: '<a class="btn btn-secondary" href="#/subscriptions/waste">' + icon("alert") + "Review waste</a>" +
        '<button class="btn btn-primary" data-action="open-add-sub">' + icon("plus") + "Add subscription</button>"
    }) +
    stats +
    '<div class="grid-12">' +
      '<div class="span-8">' + chartCard + "</div>" +
      '<div class="span-4">' + actionsCard + "</div>" +
      '<div class="span-7">' + donutCard + "</div>" +
      '<div class="span-5">' + activityCard + "</div>" +
      '<div class="span-12">' + insightsCard + "</div>" +
    "</div>" +
  "</div>";
}

function escapePercent(part, total) {
  if (!total) return "0%";
  return Math.round((Number(part) || 0) / Number(total) * 100) + "%";
}

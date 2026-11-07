/* ==========================================================================
   Alt. — Savings
   Savings overview, goals, the scenario calculator and the monthly summary
   preview capability.
   ========================================================================== */
"use strict";

function savingsGoalCard(goal) {
  var current = goalCurrent(goal);
  var pct = goalProgress(goal);
  var color = goal.color || "#41D18C";
  var remaining = Math.max(0, goal.target - current);
  var actions;
  if (goal.auto) {
    actions = '<button class="btn btn-secondary btn-sm" data-action="open-goal" data-id="' + attr(goal.id) + '">' + icon("edit") + "Edit target</button>" +
      '<span class="goal-deadline">' + icon("refresh") + " Auto-tracked</span>";
  } else {
    actions = '<button class="btn btn-secondary btn-sm" data-action="open-goal-fund" data-id="' + attr(goal.id) + '">' + icon("plus") + "Add funds</button>" +
      '<button class="btn btn-ghost btn-sm" data-action="open-goal" data-id="' + attr(goal.id) + '">' + icon("edit") + "Edit</button>" +
      '<span class="goal-deadline">' + esc(fmtDate(goal.deadline)) + "</span>";
  }
  return '<article class="card goal-card" style="--goal-color:' + attr(color) + '">' +
    '<div class="goal-head">' +
      '<div class="goal-identity"><span class="goal-icon">' + icon(goal.auto ? "target" : "wallet") + "</span>" +
        "<div><div class=\"goal-name\">" + esc(goal.name) + '</div><div class="goal-note">' + esc(goal.note || "A personal savings target.") + "</div></div>" +
      "</div>" +
      (goal.auto ? badge("Auto", "accent", "refresh") : '<span class="badge badge-neutral">Manual</span>') +
    "</div>" +
    '<div class="goal-amount"><strong>' + money0(current) + "</strong><span>of " + money0(goal.target) + "</span></div>" +
    '<div class="goal-progress"><div class="progress"><div class="progress-bar" style="width:' + pct + "%;background:" + attr(color) + '"></div></div>' +
      '<div class="goal-progress-meta"><span><strong>' + pct + "%</strong> complete</span><span>" +
        (remaining ? money0(remaining) + " to go" : "Target reached") + "</span></div></div>" +
    '<div class="goal-actions">' + actions +
      (goal.auto ? "" : '<button class="btn btn-ghost btn-sm text-red" data-action="delete-goal" data-id="' + attr(goal.id) + '">' + icon("trash") + "Delete</button>") +
    "</div>" +
  "</article>";
}

function savingsEventsTimeline(limit) {
  var events = savingsEvents().slice(0, limit || 4);
  if (!events.length) {
    return emptyState({ inline: true, icon: "clock", title: "No savings recorded", text: "Switch or cancel a tool to start the timeline.", actionLabel: "Find an alternative", actionRoute: "#/discover" });
  }
  return '<div class="history-list">' + events.map(function (event) {
    var isCancel = event.type === "cancellation";
    return '<div class="history-item">' +
      '<span class="history-icon' + (isCancel ? " cancel" : "") + '">' + icon(isCancel ? "x" : "repeat") + "</span>" +
      '<div class="history-main"><div class="history-title">' + esc(event.from) + icon("arrow-right") + esc(event.to) + "</div>" +
        '<div class="history-sub">' + esc(event.category) + " · " + esc(fmtDate(event.date)) + "</div></div>" +
      '<div class="history-right"><div class="history-saving">' + money0(event.monthlySaving) + "/mo</div>" +
        '<div class="history-date">' + esc(relDate(event.date)) + "</div></div>" +
    "</div>";
  }).join("") + "</div>";
}

function renderSavingsOverview() {
  var rate = savingsRate();
  var saved = savedToDate();
  var goal = annualGoal();
  var pct = goal ? goalProgress(goal) : 0;
  var flagged = flaggedSubs().slice().sort(function (a, b) { return b.potentialSaving - a.potentialSaving; });
  var best = flagged[0] || null;
  var bestAlt = best && best.altToolId ? toolById(best.altToolId) : null;
  var thisMonth = monthAccrual(new Date().getFullYear(), new Date().getMonth());
  var series = monthlySeries(ui.chartRange);

  var rangeButtons = [6, 12].map(function (value) {
    return '<button class="seg-btn' + (ui.chartRange === value ? " active" : "") + '" data-action="chart-range" data-range="' + value + '" aria-pressed="' + (ui.chartRange === value) + '">' + value + "M</button>";
  }).join("");

  var nextMove = best ? '<section class="card card-pad">' +
    '<div class="waste-hero-label">' + icon("zap") + "Next best move</div>" +
    '<div class="goal-amount" style="margin-top:10px"><strong class="text-accent">' + money0(best.potentialSaving) + '</strong><span>/mo recoverable</span></div>' +
    "<p style=\"margin-top:6px;font-size:11.5px;color:var(--text-2);line-height:1.55\">Cancelling <strong>" + esc(best.name) + "</strong>" +
      (bestAlt ? " and moving to " + esc(bestAlt.name) : "") + " would cover the next " + Math.max(1, Math.round(best.potentialSaving / Math.max(rate, 1) * 10) / 10) + "× your current monthly savings rate.</p>" +
    '<div class="waste-evidence">' +
      '<div class="evidence-item"><div class="evidence-label">Usage</div><div class="evidence-value">' + esc(best.usageScore) + "%</div></div>" +
      '<div class="evidence-item"><div class="evidence-label">Sessions 30d</div><div class="evidence-value">' + esc(best.sessions30) + "</div></div>" +
      '<div class="evidence-item"><div class="evidence-label">Last used</div><div class="evidence-value">' + esc(relDate(best.lastUsed)) + "</div></div>" +
    "</div>" +
    '<div class="calc-actions"><a class="btn btn-primary btn-sm" href="#/savings/calculator?sub=' + encodeURIComponent(best.id) + '">' + icon("calculator") + "Model this switch</a>" +
      '<a class="btn btn-secondary btn-sm" href="#/subscriptions/waste">' + icon("alert") + "Review waste</a></div>" +
  "</section>" : '<section class="card card-pad">' +
    '<div class="waste-hero-label">' + icon("check-circle") + "All clear</div>" +
    '<div class="goal-amount" style="margin-top:10px"><strong>' + money0(rate) + '</strong><span>/mo still saving</span></div>' +
    "<p style=\"margin-top:6px;font-size:11.5px;color:var(--text-2);line-height:1.55\">No flagged waste remains. Explore free alternatives to find the next reduction.</p>" +
    '<div class="calc-actions"><a class="btn btn-secondary btn-sm" href="#/discover">' + icon("compass") + "Browse alternatives</a></div>" +
  "</section>";

  return '<div class="page">' +
    pageHeader({
      eyebrow: "Savings", eyebrowIcon: "wallet",
      title: "Savings",
      subtitle: "What you have saved, what is still accruing, and the next decision worth making.",
      actions: '<a class="btn btn-secondary" href="#/savings/summary">' + icon("file-text") + "Monthly summary</a>" +
        '<button class="btn btn-primary" data-action="open-goal">' + icon("plus") + "New goal</button>"
    }) +
    '<div class="stats-grid">' +
      statCard({ label: "Saved to date", value: money0(saved), unit: "", icon: "trending-up", iconTone: "accent", meta: icon("calendar") + " Cumulative · estimate" }) +
      statCard({ label: "Monthly savings rate", value: money0(rate), unit: "/mo", icon: "repeat", iconTone: "blue", meta: icon("repeat") + " " + savingsEvents().length + " active actions" }) +
      statCard({ label: "Annualised", value: money0(rate * 12), unit: "/yr", icon: "target", iconTone: "purple", meta: icon("info") + " Monthly rate × 12" }) +
      statCard({
        label: "Annual goal", value: pct + "%", unit: "", icon: "gauge", iconTone: "accent",
        meta: goal ? money0(goalCurrent(goal)) + " of " + money0(goal.target) : "No annual goal set",
        progress: pct, progressLabel: "<span>Auto-tracked</span><strong>" + (goal ? moneyCompact(goal.target) : "—") + "</strong>"
      }) +
    "</div>" +
    '<div class="grid-12">' +
      '<div class="span-8"><section class="card">' +
        '<div class="card-head"><div><h2 class="card-title">Monthly savings</h2>' +
          '<div class="card-sub">Savings accrued each month from active switches and cancellations.</div></div>' +
          '<div class="chart-range segmented" role="group" aria-label="Chart range">' + rangeButtons + "</div></div>" +
        '<div class="card-body">' +
          '<div class="chart-metric"><strong>' + money0(thisMonth) + '</strong><span>accrued this month</span></div>' +
          '<div class="chart-metric-sub">' + money0(totalSavedThisYear()) + " saved this year · estimate</div>" +
          '<div style="margin-top:14px">' + monthlyBarChart(series) + "</div>" +
        "</div></section></div>" +
      '<div class="span-4">' + nextMove + "</div>" +
      '<div class="span-12"><div class="section-head" style="margin-bottom:10px"><div><h2 class="section-title">Goals</h2>' +
        '<div class="section-sub">Automatic goals follow every recorded saving; manual goals are yours to fund.</div></div>' +
        '<a class="section-link" href="#/savings/goals">Manage goals ' + icon("arrow-right") + "</a></div>" +
        '<div class="goal-grid">' + state.goals.map(savingsGoalCard).join("") + "</div></div>" +
      '<div class="span-7"><section class="card card-pad"><div class="section-head"><div><h2 class="section-title">Recent savings</h2>' +
        '<div class="section-sub">The latest recorded decisions.</div></div><a class="section-link" href="#/subscriptions/history">All history ' + icon("arrow-right") + "</a></div>" +
        savingsEventsTimeline(4) + "</section></div>" +
      '<div class="span-5"><section class="card card-pad"><div class="section-head"><div><h2 class="section-title">This month, in one view</h2>' +
        '<div class="section-sub">A printable summary is available as a preview.</div></div></div>' +
        '<div class="goal-amount" style="margin-top:0"><strong>' + money0(thisMonth) + '</strong><span>saved in ' + esc(fmtMonth(isoDate(new Date())).split(" ")[0]) + "</span></div>" +
        '<div class="result-stats mt-16">' +
          '<div class="result-stat"><span>Active rate</span><strong>' + money0(rate) + "</strong></div>" +
          '<div class="result-stat"><span>Goal progress</span><strong>' + (goal ? goalProgress(goal) : 0) + "%</strong></div>" +
          '<div class="result-stat"><span>Actions</span><strong>' + savingsEvents().length + "</strong></div>" +
        "</div>" +
        '<div class="calc-actions"><a class="btn btn-secondary btn-sm" href="#/savings/summary">' + icon("file-text") + "Open summary</a>" +
          '<button class="btn btn-ghost btn-sm" data-action="email-summary">' + icon("mail") + "Email preview</button></div>" +
      "</section></div>" +
    "</div>" +
  "</div>";
}

function renderSavingsGoals() {
  var goal = annualGoal();
  return '<div class="page">' +
    pageHeader({
      eyebrow: "Savings goals", eyebrowIcon: "target",
      title: "Goals",
      subtitle: "Turn monthly savings into something concrete. Automatic goals update whenever you switch or cancel a tool.",
      actions: '<button class="btn btn-primary" data-action="open-goal">' + icon("plus") + "Create goal</button>"
    }) +
    '<div class="goal-grid">' + state.goals.map(savingsGoalCard).join("") + "</div>" +
    (goal ? '<div class="callout accent mt-16">' + icon("refresh") + "<div><strong>" + esc(goal.name) + "</strong> is automatic: it adds " +
      money0(savingsRate()) + " per month as you record switches and cancellations. Your other goals can be funded manually.</div></div>" : "") +
    '<div class="card card-pad mt-16"><div class="section-head"><div><h2 class="section-title">How goals work</h2>' +
      '<div class="section-sub">Three principles keep this honest.</div></div></div>' +
      '<div class="insights-grid">' +
        '<div class="insight-col"><span class="insight-col-icon">' + icon("refresh") + "</span><div><div class=\"insight-col-title\">Automatic</div><div class=\"insight-col-text\">The annual goal tracks recorded savings. It never counts money twice.</div></div></div>" +
        '<div class="insight-col"><span class="insight-col-icon">' + icon("calculator") + "</span><div><div class=\"insight-col-title\">Estimates</div><div class=\"insight-col-text\">Saving amounts are monthly estimates, not bank transactions.</div></div></div>" +
        '<div class="insight-col"><span class="insight-col-icon">' + icon("lock") + "</span><div><div class=\"insight-col-title\">Local only</div><div class=\"insight-col-text\">Goals live in this browser's demo workspace and can be reset any time.</div></div></div>" +
      "</div></div>" +
    '<div class="source-note">' + icon("info") + " Goal progress updates instantly when you record a switch, cancellation or manual contribution.</div>" +
  "</div>";
}

function savingsPresets() {
  return [
    { id: "adobe", title: "Replace Adobe CC", desc: "Core creative work on free tools", current: 1675.6, alt: 0, seats: 1, months: 12 },
    { id: "waste", title: "Cancel flagged waste", desc: "Every low-use subscription", current: potentialSavings(), alt: 0, seats: 1, months: 12 },
    { id: "team", title: "Right-size Loom seats", desc: "3 seats down to the free plan", current: 1280, alt: 0, seats: 3, months: 12 }
  ];
}

function renderSavingsCalculator() {
  var calc = ui.calc;
  var presets = savingsPresets();
  var current = Math.max(0, Number(calc.current) || 0);
  var alt = Math.max(0, Number(calc.alt) || 0);
  var seats = clamp(Number(calc.seats) || 1, 1, 100);
  var months = clamp(Number(calc.months) || 12, 1, 60);
  var monthly = (current - alt) * seats;
  var total = monthly * months;
  var oneYear = monthly * 12;
  var perSeat = current - alt;
  var maxBar = Math.max(current * seats, alt * seats, 1);
  var subOptions = ['<option value="">Custom amount</option>'].concat(activeSubs().map(function (sub) {
    return '<option value="' + attr(sub.id) + '"' + (calc.subId === sub.id ? " selected" : "") + ">" + esc(sub.name) + " · " + money(sub.cost) + "/mo</option>";
  })).join("");
  var monthOptions = [3, 6, 12, 24].map(function (value) {
    return '<option value="' + value + '"' + (months === value ? " selected" : "") + ">" + value + " months</option>";
  }).join("");

  var presetCards = presets.map(function (preset) {
    var annual = (preset.current - preset.alt) * preset.seats * 12;
    return '<button class="preset-card' + (calc.preset === preset.id ? " active" : "") + '" data-action="calc-preset" data-preset="' + attr(preset.id) + '">' +
      '<div class="preset-title">' + esc(preset.title) + '</div><div class="preset-desc">' + esc(preset.desc) + "</div>" +
      '<div class="preset-saving">≈ ' + money0(annual) + "/yr</div></button>";
  }).join("");

  var currentTotal = current * seats;
  var altTotal = alt * seats;

  return '<div class="page">' +
    pageHeader({
      eyebrow: "Scenario simulator", eyebrowIcon: "calculator",
      title: "Savings calculator",
      subtitle: "Estimate the annual value of cancelling or switching. Every number here is a clearly labelled estimate.",
      actions: '<a class="btn btn-secondary" href="#/discover/finder">' + icon("compass") + "Find alternatives</a>"
    }) +
    '<div class="preset-grid">' + presetCards + "</div>" +
    '<div class="calc-grid">' +
      '<section class="card calc-form-card">' +
        '<div class="section-head"><div><h2 class="section-title">Model a change</h2>' +
          '<div class="section-sub">Pick a subscription or enter your own numbers.</div></div></div>' +
        '<div class="field"><label class="label" for="calcSub">Subscription</label>' +
          '<select class="select" id="calcSub" data-change="calc-sub">' + subOptions + "</select>" +
          '<div class="field-hint">Choosing a subscription fills in its current cost and mapped free alternative.</div></div>' +
        '<div class="form-grid mt-16">' +
          '<div class="field"><label class="label" for="calcCurrent">Current cost <span class="req">*</span></label>' +
            '<div class="input-affix"><span class="affix">₹</span><input class="input" id="calcCurrent" type="number" min="0" step="0.01" inputmode="decimal" data-live="calc-current" value="' + attr(current) + '" aria-label="Current monthly cost"></div></div>' +
          '<div class="field"><label class="label" for="calcAlt">Alternative cost</label>' +
            '<div class="input-affix"><span class="affix">₹</span><input class="input" id="calcAlt" type="number" min="0" step="0.01" inputmode="decimal" data-live="calc-alt" value="' + attr(alt) + '" aria-label="Alternative monthly cost"></div></div>' +
          '<div class="field"><label class="label" for="calcSeats">Seats</label>' +
            '<input class="input" id="calcSeats" type="number" min="1" max="100" step="1" data-live="calc-seats" value="' + attr(seats) + '" aria-label="Number of seats"></div>' +
          '<div class="field"><label class="label" for="calcMonths">Timeframe</label>' +
            '<select class="select" id="calcMonths" data-change="calc-months">' + monthOptions + "</select></div>" +
        "</div>" +
        '<div class="calc-actions"><button class="btn btn-secondary btn-sm" data-action="calc-reset">' + icon("rotate") + "Reset</button>" +
          '<button class="btn btn-ghost btn-sm" data-action="calc-scenario">' + icon("sparkles") + "Try a scenario</button></div>" +
        '<div class="source-note">' + icon("info") + " Taxes, annual discounts and provider price changes are not modelled.</div>" +
      "</section>" +
      '<section class="card calc-results">' +
        '<div class="calc-result-label">Estimated saving over <span data-calc-months>' + months + "</span> months</div>" +
        '<div class="calc-result-value"><span data-calc-total>' + money0(total) + "</span><small>≈ <span data-calc-monthly>" + money0(monthly) + "</span>/mo</small></div>" +
        '<div class="calc-result-note" data-calc-note>' + (monthly >= 0 ?
          "Based on " + money0(currentTotal) + " now vs " + money0(altTotal) + " after the change." :
          "This combination costs more each month. Adjust the alternative or seats.") + "</div>" +
        '<div class="result-stats">' +
          '<div class="result-stat"><span>Monthly</span><strong data-calc-stat="monthly" class="' + (monthly >= 0 ? "text-accent" : "text-amber") + '">' + money0(monthly) + "</strong></div>" +
          '<div class="result-stat"><span>Per seat / mo</span><strong data-calc-stat="perSeat">' + money0(perSeat) + "</strong></div>" +
          '<div class="result-stat"><span>1 year</span><strong data-calc-stat="oneYear">' + money0(oneYear) + "</strong></div>" +
        "</div>" +
        '<div class="calc-bars">' +
          '<div class="calc-bar-row"><div class="calc-bar-label"><span>Current stack</span><strong data-calc-label="current">' + money0(currentTotal) + "/mo</strong></div>" +
            '<div class="calc-bar-track"><div class="calc-bar-fill" data-calc-bar="current" style="width:' + clamp((currentTotal / maxBar) * 100, 2, 100) + '%"></div></div></div>' +
          '<div class="calc-bar-row"><div class="calc-bar-label"><span>After the change</span><strong data-calc-label="alt">' + money0(altTotal) + "/mo</strong></div>" +
            '<div class="calc-bar-track"><div class="calc-bar-fill accent" data-calc-bar="alt" style="width:' + clamp((altTotal / maxBar) * 100, altTotal ? 2 : 0, 100) + '%"></div></div></div>' +
        "</div>" +
        '<div class="calc-disclaimer">' + icon("info") + "<span>Estimate only. Alt. does not verify provider pricing, and no billing changes are made from this demo.</span></div>" +
        '<div class="calc-actions"><button class="btn btn-primary btn-sm" data-action="calc-to-goal">' + icon("target") + "Save as a goal</button>" +
          '<a class="btn btn-secondary btn-sm" href="#/workflows/simulator">' + icon("play") + "Run a switch simulation</a></div>" +
      "</section>" +
    "</div>" +
  "</div>";
}

function renderSavingsSummary() {
  var months = lastNMonths(6);
  var selected = months.filter(function (month) { return month.key === ui.summaryMonth; })[0] || months[months.length - 1];
  var parts = selected.key.split("-").map(Number);
  var accrual = monthAccrual(parts[0], parts[1] - 1);
  var prevDate = new Date(parts[0], parts[1] - 2, 1, 12, 0, 0);
  var prevAccrual = monthAccrual(prevDate.getFullYear(), prevDate.getMonth());
  var delta = accrual - prevAccrual;
  var monthEnd = selected.current ? new Date() : new Date(parts[0], parts[1], 0, 12, 0, 0);
  var events = savingsEvents().filter(function (event) {
    return parseDate(event.date) <= monthEnd;
  });
  var goal = annualGoal();
  var options = months.map(function (month) {
    return '<option value="' + attr(month.key) + '"' + (selected.key === month.key ? " selected" : "") + ">" + esc(month.longLabel) + "</option>";
  }).join("");

  return '<div class="page">' +
    pageHeader({
      eyebrow: "Preview capability", eyebrowIcon: "file-text",
      title: "Monthly summary",
      subtitle: "A clean, printable record of what this demo workspace saved in a chosen month.",
      actions: '<button class="btn btn-secondary" data-action="export-summary">' + icon("download") + "Export</button>" +
        '<button class="btn btn-primary" data-action="email-summary">' + icon("mail") + "Email preview</button>"
    }) +
    '<div class="summary-toolbar">' +
      '<div class="summary-month"><span class="field-hint">Showing</span>' +
        '<select class="select" aria-label="Summary month" data-change="summary-month">' + options + "</select></div>" +
      '<span class="pill-note">' + icon("sparkles") + " Preview capability · not connected</span>" +
    "</div>" +
    '<div class="stats-grid">' +
      statCard({ label: "Saved in " + selected.label, value: money0(accrual), unit: "", icon: "wallet", iconTone: "accent", meta: icon("calendar") + " " + esc(selected.longLabel) }) +
      statCard({ label: "Previous month", value: money0(prevAccrual), unit: "", icon: delta >= 0 ? "trending-up" : "trending-down", iconTone: delta >= 0 ? "blue" : "amber", meta: (delta >= 0 ? icon("trending-up") : icon("trending-down")) + " " + (delta >= 0 ? "+" : "") + money0(delta) + " vs previous" }) +
      statCard({ label: "Recurring monthly rate", value: money0(savingsRate()), unit: "/mo", icon: "repeat", iconTone: "purple", meta: icon("repeat") + " " + events.length + " actions contributing" }) +
      statCard({ label: "Annual goal", value: (goal ? goalProgress(goal) : 0) + "%", unit: "", icon: "target", iconTone: "amber", meta: goal ? money0(goalCurrent(goal)) + " of " + money0(goal.target) : "No goal set", progress: goal ? goalProgress(goal) : 0 }) +
    "</div>" +
    '<div class="grid-12">' +
      '<div class="span-7"><section class="card card-pad">' +
        '<div class="section-head"><div><h2 class="section-title">Where the savings came from</h2>' +
          '<div class="section-sub">Recurring monthly value of each recorded action.</div></div></div>' +
        '<div class="summary-breakdown">' + (events.length ? events.map(function (event) {
          var isCancel = event.type === "cancellation";
          return '<div class="summary-row"><span class="history-icon' + (isCancel ? " cancel" : "") + '" style="width:28px;height:28px">' + icon(isCancel ? "x" : "repeat") + "</span>" +
            '<div class="summary-row-main"><div class="summary-row-name">' + esc(event.from) + (isCancel ? " cancelled" : " → " + esc(event.to)) + "</div>" +
              '<div class="summary-row-sub">' + esc(event.category) + " · recorded " + esc(fmtDate(event.date)) + "</div></div>" +
            '<div class="summary-row-amount">' + money0(event.monthlySaving) + "/mo</div></div>";
        }).join("") : emptyState({ inline: true, icon: "clock", title: "No actions in this month", text: "Pick a later month or record a switch to populate the summary." })) + "</div>" +
        '<div class="card-foot" style="padding-left:0;padding-right:0;margin-top:12px"><span class="card-note">' + icon("info") + " Amounts are monthly estimates, prorated for the current month.</span></div>" +
      "</section></div>" +
      '<div class="span-5"><div class="stack">' +
        '<section class="card card-pad"><div class="section-head"><div><h2 class="section-title">' + esc(selected.longLabel) + "</h2>" +
          '<div class="section-sub">A snapshot you could share with a team or keep for yourself.</div></div></div>' +
          '<div class="goal-amount" style="margin-top:0"><strong>' + money0(accrual) + '</strong><span>saved</span></div>' +
          '<div class="result-stats mt-16">' +
            '<div class="result-stat"><span>Approx. daily</span><strong>' + money0(accrual / (selected.current ? new Date().getDate() : new Date(parts[0], parts[1], 0).getDate())) + "</strong></div>" +
            '<div class="result-stat"><span>Actions</span><strong>' + events.length + "</strong></div>" +
            '<div class="result-stat"><span>Rate</span><strong>' + money0(savingsRate()) + "</strong></div>" +
          "</div></section>" +
        '<div class="callout accent">' + icon("sparkles") + "<div><strong>Preview capability.</strong> This screen shows how a monthly summary would look. Email delivery and provider exports are not implemented — nothing is sent.</div></div>" +
        '<div class="callout">' + icon("shield-check") + "<div>All values come from this browser's demo workspace. Reset the workspace from Preferences to start again.</div></div>" +
      "</div></div>" +
    "</div>" +
  "</div>";
}

function renderSavings(route) {
  var body;
  if (route.tab === "goals") body = renderSavingsGoals();
  else if (route.tab === "calculator") body = renderSavingsCalculator();
  else if (route.tab === "summary") body = renderSavingsSummary();
  else body = renderSavingsOverview();
  return body.replace("</header>", "</header>" + tabsBar(route));
}

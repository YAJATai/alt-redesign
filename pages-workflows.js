/* ==========================================================================
   Alt. — Workflows
   Rebuild a workflow, score compatibility, simulate a switch and follow a
   practical switching checklist.
   ========================================================================== */
"use strict";

function workflowsSortedTools(list) {
  return list.slice().sort(function (a, b) { return a.name.localeCompare(b.name); });
}

function workflowsEnabled() {
  return state.workflow.filter(function (item) { return item.enabled; });
}

function workflowsCurrentTotal() {
  return workflowsEnabled().reduce(function (sum, item) { return sum + (Number(item.currentCost) || 0); }, 0);
}

function workflowsNextTotal() {
  return workflowsEnabled().reduce(function (sum, item) { return sum + (Number(item.alternativeCost) || 0); }, 0);
}

function workflowsSaving() {
  return Math.max(0, workflowsCurrentTotal() - workflowsNextTotal());
}

function workflowRow(item, index) {
  var outgoing = paidToolForName(item.currentTool);
  var incoming = TOOLS.filter(function (tool) {
    return tool.name.toLowerCase() === String(item.alternative || "").toLowerCase();
  })[0] || null;
  return '<div class="wf-item' + (item.enabled ? "" : " off") + '">' +
    '<span class="wf-step-num">' + (index + 1) + "</span>" +
    '<div class="wf-main">' +
      '<div class="wf-task">' + esc(item.task) + "</div>" +
      '<div class="wf-note">' + esc(item.note || "Part of the sample creative workflow") + "</div>" +
      '<div class="wf-tools">' +
        '<span class="wf-tool">' + (outgoing ? logoHtml(outgoing, "logo-sm") : "") + " <strong>" + esc(item.currentTool) + "</strong> · " + money(item.currentCost) + "/mo</span>" +
        icon("arrow-right", "wf-arrow") +
        '<span class="wf-tool">' + (incoming ? logoHtml(incoming, "logo-sm") : "") + " <strong>" + esc(item.alternative) + "</strong> · " + (item.alternativeCost ? money(item.alternativeCost) + "/mo" : "Free") + "</span>" +
      "</div>" +
    "</div>" +
    '<div class="wf-cost"><div class="wf-cost-price' + (item.alternativeCost ? "" : " free") + '">' +
      (item.alternativeCost ? money(item.alternativeCost) : "₹0") + '</div><div class="wf-cost-label">after change</div></div>' +
    '<label class="switch wf-toggle" title="Include this step">' +
      '<input type="checkbox" data-change="wf-toggle" data-id="' + attr(item.id) + '"' + (item.enabled ? " checked" : "") + ">" +
      '<span class="sr-only">Include ' + attr(item.task) + " in the rebuild</span></label>" +
  "</div>";
}

function renderWorkflowsBuilder() {
  var current = workflowsCurrentTotal();
  var next = workflowsNextTotal();
  var saving = workflowsSaving();
  var enabled = workflowsEnabled().length;
  var total = state.workflow.length;

  var list = state.workflow.length ? '<div class="workflow-list">' + state.workflow.map(workflowRow).join("") + "</div>" :
    emptyState({
      icon: "workflow", title: "Your workflow is empty",
      text: "Add the tasks you do every week and map each one to a cheaper tool.",
      actionLabel: "Add first step", actionAction: "wf-add"
    });

  return '<div class="page">' +
    pageHeader({
      eyebrow: "Workflow rebuilder", eyebrowIcon: "workflow",
      title: "Rebuild workflow",
      subtitle: "Map each recurring task to the tool that actually does the job. Toggle steps to see the cost of the rebuild before you commit.",
      actions: '<button class="btn btn-ghost" data-action="wf-reset">' + icon("rotate") + "Reset toggles</button>" +
        '<button class="btn btn-primary" data-action="wf-add">' + icon("plus") + "Add step</button>"
    }) +
    '<div class="workflow-summary">' +
      '<div class="summary-stat"><div class="summary-stat-label">Current monthly stack</div>' +
        '<div class="summary-stat-value">' + money0(current) + ' <small>/mo</small></div></div>' +
      '<div class="summary-stat"><div class="summary-stat-label">Rebuilt monthly stack</div>' +
        '<div class="summary-stat-value">' + money0(next) + ' <small>/mo</small></div></div>' +
      '<div class="summary-stat"><div class="summary-stat-label">Monthly saving</div>' +
        '<div class="summary-stat-value accent">' + money0(saving) + ' <small>/mo · ' + money0(saving * 12) + "/yr</small></div></div>" +
    "</div>" +
    '<section class="card">' +
      '<div class="card-head bordered"><div><h2 class="card-title">Workflow steps</h2>' +
        '<div class="card-sub">' + enabled + " of " + total + " steps included in this plan. Turn a step off to keep the paid tool for that task.</div></div>" +
        '<span class="pill-note">' + icon("info") + " Demo workflow</span></div>" +
      list +
      '<div class="wf-footer">' +
        '<span class="wf-footer-text">' + icon("shield-check") + " Applying a plan only records it in this workspace. No tool is switched or billed." + "</span>" +
        '<div class="wf-footer-actions">' +
          '<a class="btn btn-secondary btn-sm" href="#/workflows/simulator">' + icon("play") + "Test one switch</a>" +
          '<button class="btn btn-primary btn-sm" data-action="wf-apply"' + (saving ? "" : " disabled") + ">" + icon("check") + "Apply rebuild plan</button>" +
        "</div>" +
      "</div>" +
    "</section>" +
    '<div class="grid-12 mt-16">' +
      '<div class="span-7"><div class="callout">' + icon("info") + "<div><strong>Why map tasks instead of tools?</strong> A tool can be cheap and still be wrong for the work. This view starts from the task, then checks whether a free alternative covers it.</div></div></div>" +
      '<div class="span-5"><div class="callout accent">' + icon("trending-up") + "<div><strong>" + money0(saving) + " per month</strong> is the estimated value of the steps you have enabled. It is a plan, not a recorded saving yet.</div></div></div>" +
    "</div>" +
  "</div>";
}

function compatOptions(list, selected) {
  return workflowsSortedTools(list).map(function (tool) {
    return '<option value="' + attr(tool.id) + '"' + (tool.id === selected ? " selected" : "") + ">" +
      esc(tool.name) + (tool.price ? " · " + money(tool.price) + "/mo" : " · Free") + "</option>";
  }).join("");
}

function compatChips(result) {
  var covered = (result.covered || []).map(function (cap) {
    return '<span class="cap-chip covered">' + icon("check") + esc(CAPABILITY_LABELS[cap] || cap) + "</span>";
  }).join("");
  var missing = (result.missing || []).map(function (cap) {
    return '<span class="cap-chip missing">' + icon("circle") + esc(CAPABILITY_LABELS[cap] || cap) + "</span>";
  }).join("");
  return covered + missing || '<span class="cap-chip">No shared capabilities recorded</span>';
}

function compatResultHtml(result) {
  if (!result) {
    return '<div class="compat-result card">' + emptyState({
      icon: "gauge", title: "Choose two tools",
      text: "Pick the tool you use today and a free alternative to see a compatibility breakdown."
    }) + "</div>";
  }
  var skills = skillRowsFor(result.target, result.score);
  var saving = Math.max(0, (result.source.price || 0) - (result.target.price || 0));
  var breakdown = [
    { label: "Capability coverage", value: result.coverage, cls: "" },
    { label: "Learning effort", value: result.learning, cls: "blue" },
    { label: "Hardware fit", value: result.hardware, cls: "purple" },
    { label: "Skill transfer", value: result.skill, cls: "amber" }
  ].map(function (row) {
    return '<div class="breakdown-row"><div class="breakdown-label"><span>' + esc(row.label) + "</span><strong>" + row.value + '%</strong></div>' +
      '<div class="breakdown-track"><div class="breakdown-fill ' + row.cls + '" style="width:' + clamp(row.value, 0, 100) + '%"></div></div></div>';
  }).join("");

  return '<section class="card compat-result">' +
    '<div class="score-wrap">' + scoreRing(result.score, result.tone) +
      '<div class="score-copy"><h3>' + esc(result.label) + "</h3>" +
        "<p><strong>" + esc(result.target.name) + "</strong> covers " + result.coverage + "% of the capabilities Alt. tracks for <strong>" + esc(result.source.name) + "</strong>.</p>" +
        (saving ? '<p class="text-accent" style="margin-top:6px">' + money(saving) + "/mo cheaper at catalogue prices.</p>" : "") +
      "</div>" +
    "</div>" +
    '<div class="breakdown">' + breakdown + "</div>" +
    '<div class="drawer-section" style="margin-top:18px"><div class="drawer-section-title">Capability map</div>' +
      '<div class="cap-chips">' + compatChips(result) + "</div></div>" +
    '<div class="skill-panel"><div class="drawer-section-title">Skill transfer</div>' +
      skills.map(function (row) {
        return '<div class="skill-row"><span class="skill-name">' + esc(row.label) + '</span>' +
          '<span class="skill-track"><span class="skill-fill" style="width:' + row.value + '%"></span></span>' +
          '<span class="skill-pct">' + row.value + "%</span></div>";
      }).join("") +
    "</div>" +
    '<div class="sim-recommendation">' + (result.score >= 85 ?
      "<strong>Strong match.</strong> Trial one real project in the free tool before cancelling anything." :
      result.score >= 70 ?
      "<strong>Good match with gaps.</strong> Check the missing capabilities against your edge cases, then run a one-project trial." :
      result.score >= 55 ?
      "<strong>Partial match.</strong> Keep the paid tool for complex work and use the free tool for the routine 80%." :
      "<strong>Limited match.</strong> Do not switch yet — the capability gap is likely to cost more time than the subscription.") + "</div>" +
    '<div class="sim-actions">' +
      '<a class="btn btn-primary btn-sm" href="#/workflows/simulator?from=' + encodeURIComponent(result.source.id) + "&to=" + encodeURIComponent(result.target.id) + '">' + icon("play") + "Simulate this switch</a>" +
      '<a class="btn btn-secondary btn-sm" href="#/discover/compare?a=' + encodeURIComponent(result.source.id) + "&b=" + encodeURIComponent(result.target.id) + '">' + icon("grid") + "Compare features</a>" +
    "</div>" +
  "</section>";
}

function renderWorkflowsCompatibility() {
  var result = ui.compat.result || continuityScore(ui.compat.from, ui.compat.to);
  var source = toolById(ui.compat.from);
  var target = toolById(ui.compat.to);
  var monthly = source && target ? Math.max(0, (source.price || 0) - (target.price || 0)) : 0;

  return '<div class="page">' +
    pageHeader({
      eyebrow: "Compatibility score", eyebrowIcon: "gauge",
      title: "Will it actually work?",
      subtitle: "A transparent score built from capability coverage, learning effort, hardware needs and skill transfer. It is a guide, not a guarantee.",
      actions: '<a class="btn btn-secondary" href="#/discover/compare?a=' + encodeURIComponent((source || {}).id || "") + "&b=" + encodeURIComponent((target || {}).id || "") + '">' + icon("grid") + "Full comparison</a>"
    }) +
    '<div class="compat-layout">' +
      '<section class="card compat-form">' +
        '<div class="section-head"><div><h2 class="section-title">Choose the switch</h2>' +
          '<div class="section-sub">Compare the paid tool you use today with a free alternative.</div></div></div>' +
        '<div class="field"><label class="label" for="compatFrom">Currently using</label>' +
          '<select class="select" id="compatFrom" data-change="compat-from">' + compatOptions(paidTools(), ui.compat.from) + "</select></div>" +
        '<div class="field"><label class="label" for="compatTo">Free alternative</label>' +
          '<select class="select" id="compatTo" data-change="compat-to">' + compatOptions(freeTools(), ui.compat.to) + "</select></div>" +
        '<div class="result-stats" style="grid-template-columns:1fr 1fr">' +
          '<div class="result-stat"><span>Monthly difference</span><strong class="text-accent">' + money(monthly) + "</strong></div>" +
          '<div class="result-stat"><span>Catalogue price</span><strong>' + (target ? (target.price ? money(target.price) : "Free") : "—") + "</strong></div>" +
        "</div>" +
        '<div class="calc-actions"><button class="btn btn-primary btn-sm" data-action="compat-run">' + icon("gauge") + "Recalculate score</button>" +
          '<button class="btn btn-ghost btn-sm" data-action="compat-suggest">' + icon("sparkles") + "Suggest a pair</button></div>" +
        '<div class="field-hint" style="margin-top:12px">Scores use the sample capability catalogue in this demo. Always trial a tool on real work.</div>' +
        '<div class="source-note">' + icon("info") + " Learning effort and hardware fit are sample estimates, not measured performance." + "</div>" +
      "</section>" +
      compatResultHtml(result) +
    "</div>" +
    '<div class="callout mt-16">' + icon("info") + "<div><strong>How the score works.</strong> Capability coverage contributes 55%, learning effort 20%, hardware fit 15% and skill transfer 10%. A same-category alternative gets a small 4-point bonus. The formula is shown so you can challenge it.</div></div>" +
  "</div>";
}

function simOptions(list, selected) {
  return workflowsSortedTools(list).map(function (tool) {
    return '<option value="' + attr(tool.id) + '"' + (tool.id === selected ? " selected" : "") + ">" +
      esc(tool.name) + " · " + (tool.price ? money(tool.price) + "/mo" : "Free") + "</option>";
  }).join("");
}

function simRisk(score) {
  if (score >= 85) return { label: "Low", cls: "low" };
  if (score >= 70) return { label: "Moderate", cls: "medium" };
  return { label: "High", cls: "medium" };
}

function simEffort(tool) {
  if (!tool) return "—";
  if (tool.learning === "Low") return "About 1–2 weeks";
  if (tool.learning === "Medium") return "About 2–4 weeks";
  return "4+ weeks";
}

function simResultHtml() {
  if (ui.sim.loading) {
    return '<section class="card sim-result">' +
      '<div class="skeleton skeleton-heading" style="width:180px"></div>' +
      '<div class="skeleton" style="height:38px;width:210px;margin-top:12px"></div>' +
      '<div class="skeleton" style="height:90px;margin-top:18px"></div>' +
      '<div class="skeleton" style="height:58px;margin-top:12px"></div>' +
      '<div class="skeleton" style="height:76px;margin-top:12px"></div>' +
    "</section>";
  }
  var result = ui.sim.result;
  if (!result) {
    return '<section class="card sim-result">' + emptyState({
      icon: "play", title: "Run a simulation",
      text: "Pick the tool you are on and a free alternative. Alt. estimates the monthly and annual value of the switch.",
      inline: true
    }) + "</section>";
  }
  var from = toolById(result.from);
  var to = toolById(result.to);
  if (!from || !to) return "";
  var risk = simRisk(result.score);
  var breakEven = result.monthlySaving > 0 ? "Immediate" : "No saving yet";
  return '<section class="card sim-result">' +
    '<div class="sim-result-head"><div><div class="drawer-section-title" style="margin-bottom:0">Estimated saving over ' + result.months + " months</div>" +
      '<div class="sim-result-value">' + money0(result.total) + " <small>≈ " + money0(result.monthlySaving) + "/mo</small></div>" +
      '<div class="sim-result-note">Based on catalogue prices for ' + result.seats + (result.seats === 1 ? " seat" : " seats") + ".</div></div>" +
      '<span class="pill-note">' + icon("sparkles") + " Estimate</span></div>" +
    '<div class="sim-tools-compare">' +
      '<div class="sim-tool-card"><div class="sim-tool-card-label">Today</div>' +
        '<div class="sim-tool-card-name">' + esc(from.name) + '</div><div class="sim-tool-card-price">' + (from.price ? money(from.price) + "/mo / seat" : "Free") + "</div></div>" +
      '<div class="sim-tool-card to"><div class="sim-tool-card-label">After switch</div>' +
        '<div class="sim-tool-card-name">' + esc(to.name) + '</div><div class="sim-tool-card-price">' + (to.price ? money(to.price) + "/mo / seat" : "Free") + "</div></div>" +
    "</div>" +
    '<div class="sim-facts">' +
      '<div class="sim-fact"><span>Monthly before</span><strong>' + money(result.before) + "</strong></div>" +
      '<div class="sim-fact"><span>Monthly after</span><strong>' + money(result.after) + "</strong></div>" +
      '<div class="sim-fact"><span>Break-even</span><strong>' + esc(breakEven) + "</strong></div>" +
      '<div class="sim-fact"><span>Switch effort</span><strong>' + esc(simEffort(to)) + "</strong></div>" +
      '<div class="sim-fact"><span>Compatibility</span><strong>' + result.score + "%</strong></div>" +
      '<div class="sim-fact"><span>Risk</span><strong class="risk ' + risk.cls + '">' + icon("shield-check") + esc(risk.label) + "</strong></div>" +
    "</div>" +
    '<div class="sim-recommendation">' + (result.score >= 85 ?
      "<strong>Worth doing.</strong> The workflows line up. Export your current projects, trial " + esc(to.name) + " for a week, then cancel if nothing blocks you." :
      result.score >= 70 ?
      "<strong>Worth a trial.</strong> Check edge cases first. Keep the paid plan for one more cycle while you test " + esc(to.name) + " on a real project." :
      "<strong>Do not cancel yet.</strong> Capability gaps make this risky. Test the free tool on routine work before committing.") +
    "</div>" +
    '<div class="sim-actions">' +
      '<button class="btn btn-primary btn-sm" data-action="sim-save">' + icon("check") + "Save switch plan</button>" +
      '<a class="btn btn-secondary btn-sm" href="#/workflows/help">' + icon("lifebuoy") + "Switching help</a>" +
      '<a class="btn btn-ghost btn-sm" href="#/discover/compare?a=' + encodeURIComponent(from.id) + "&b=" + encodeURIComponent(to.id) + '">' + icon("grid") + "Compare features</a>" +
    "</div>" +
    '<div class="source-note">' + icon("info") + " Simulation only. No tool is purchased, cancelled or contacted." + "</div>" +
  "</section>";
}

function renderWorkflowsSimulator() {
  var months = [3, 6, 12, 24];
  var monthOptions = months.map(function (value) {
    return '<option value="' + value + '"' + (Number(ui.sim.months) === value ? " selected" : "") + ">" + value + " months</option>";
  }).join("");

  return '<div class="page">' +
    pageHeader({
      eyebrow: "Switch simulator", eyebrowIcon: "play",
      title: "Switch simulator",
      subtitle: "Model the monthly and annual value of a switch before you touch a billing page. Numbers come from the sample catalogue.",
      actions: '<a class="btn btn-secondary" href="#/discover/finder">' + icon("compass") + "Find alternatives</a>"
    }) +
    '<div class="sim-layout">' +
      '<section class="card sim-form">' +
        '<div class="section-head"><div><h2 class="section-title">Set up the switch</h2>' +
          '<div class="section-sub">Choose what you use today and what you would move to.</div></div></div>' +
        '<div class="field"><label class="label" for="simFrom">Currently using</label>' +
          '<select class="select" id="simFrom" data-change="sim-from">' + simOptions(paidTools(), ui.sim.from) + "</select></div>" +
        '<div class="field"><label class="label" for="simTo">Move to</label>' +
          '<select class="select" id="simTo" data-change="sim-to">' + simOptions(freeTools(), ui.sim.to) + "</select></div>" +
        '<div class="form-grid mt-16">' +
          '<div class="field"><label class="label" for="simSeats">Seats</label>' +
            '<input class="input" id="simSeats" type="number" min="1" max="50" step="1" data-live="sim-seats" value="' + clamp(Number(ui.sim.seats) || 1, 1, 50) + '" aria-label="Number of seats"></div>' +
          '<div class="field"><label class="label" for="simMonths">Timeframe</label>' +
            '<select class="select" id="simMonths" data-change="sim-months">' + monthOptions + "</select></div>" +
        "</div>" +
        '<div class="calc-actions"><button class="btn btn-primary" data-action="sim-run">' + icon("play") + "Run simulation</button>" +
          '<button class="btn btn-ghost" data-action="sim-reset">' + icon("rotate") + "Reset</button></div>" +
        '<div class="callout mt-16">' + icon("info") + "<div><strong>What this does not model:</strong> taxes, annual billing discounts, refunds or migration time. Treat the result as a directional estimate.</div></div>" +
      "</section>" +
      simResultHtml() +
    "</div>" +
    '<div class="source-note">' + icon("info") + " Catalogue prices are illustrative monthly list prices. Alt. does not check current provider pricing." + "</div>" +
  "</div>";
}

function helpSteps() {
  return [
    { id: "export", title: "Export your work", desc: "Download projects, fonts, presets and shared files from the current provider." },
    { id: "inventory", title: "List what you actually use", desc: "Note the features and files you rely on. Anything not on the list is optional." },
    { id: "trial", title: "Trial the free tool on one project", desc: "Use real work, not a demo file. The friction shows up in the first hour." },
    { id: "import", title: "Import one real project", desc: "Check file compatibility, fonts, audio sync and export quality." },
    { id: "team", title: "Tell collaborators", desc: "Share new links and confirm nobody is blocked by the change." },
    { id: "billing", title: "Check the renewal date", desc: "Cancel after a successful trial and before the next charge. Alt. cannot cancel for you." },
    { id: "review", title: "Set a 30-day review", desc: "Keep the free tool only if it still fits after the novelty wears off." }
  ];
}

function helpPlan() {
  return state.switchPlan || null;
}

function renderWorkflowsHelp() {
  var plan = helpPlan();
  var steps = helpSteps();
  var done = steps.filter(function (step) { return state.checklist && state.checklist[step.id]; }).length;
  var pct = percent(done, steps.length);
  var from = plan ? toolById(plan.from) : null;
  var to = plan ? toolById(plan.to) : null;

  var planHead = plan && from && to ? '<div class="help-plan">' +
    '<div class="help-plan-head"><div><div class="help-plan-title">' + esc(from.name) + icon("arrow-right") + esc(to.name) +
      badge("Saved plan", "accent", "check") + "</div>" +
      '<div class="help-plan-sub">Saved ' + esc(relDate(plan.date)) + " · " + money0(plan.monthlySaving) + "/mo estimated saving · " + esc(plan.seats) + (plan.seats === 1 ? " seat" : " seats") + "</div></div>" +
      '<a class="btn btn-secondary btn-sm" href="#/workflows/simulator?from=' + encodeURIComponent(plan.from) + "&to=" + encodeURIComponent(plan.to) + '">' + icon("play") + "Re-run simulation</a></div>" +
    '<div class="help-plan-progress" data-help-progress><div class="progress"><div class="progress-bar" data-help-bar style="width:' + pct + '%"></div></div>' +
      '<div class="help-plan-meta"><span data-help-done>' + done + " of " + steps.length + " steps complete</span><span data-help-pct>" + pct + "%</span></div></div>" +
  "</div>" : '<div class="help-plan">' +
    '<div class="help-plan-head"><div><div class="help-plan-title">Universal switching checklist ' + badge("General", "neutral") + "</div>" +
      '<div class="help-plan-sub">No saved switch plan yet. Use this checklist for any tool change, or save a plan from the simulator.</div></div>' +
      '<a class="btn btn-secondary btn-sm" href="#/workflows/simulator">' + icon("play") + "Simulate a switch</a></div>" +
    '<div class="help-plan-progress" data-help-progress><div class="progress"><div class="progress-bar" data-help-bar style="width:' + pct + '%"></div></div>' +
      '<div class="help-plan-meta"><span data-help-done>' + done + " of " + steps.length + " steps complete</span><span data-help-pct>" + pct + "%</span></div></div>" +
  "</div>";

  var checklist = '<section class="card card-pad">' +
    '<div class="section-head"><div><h2 class="section-title">Before you cancel</h2>' +
      '<div class="section-sub">Tick each step as you complete it. Progress is stored in this browser only.</div></div>' +
      '<button class="btn btn-ghost btn-sm" data-action="help-reset">' + icon("rotate") + "Reset</button></div>" +
    '<div class="checklist">' + steps.map(function (step, index) {
      var checked = !!(state.checklist && state.checklist[step.id]);
      return '<label class="check-row' + (checked ? " done" : "") + '">' +
        '<input type="checkbox" data-change="help-check" data-id="' + attr(step.id) + '"' + (checked ? " checked" : "") + ">" +
        '<span class="check-row-main"><span class="check-row-title">' + esc(step.title) + '</span>' +
          '<span class="check-row-desc">' + esc(step.desc) + "</span></span>" +
        '<span class="check-row-step">' + String(index + 1).padStart(2, "0") + "</span></label>";
    }).join("") + "</div>" +
  "</section>";

  var support = '<section class="card card-pad mt-16">' +
    '<div class="section-head"><div><h2 class="section-title">Help while you switch</h2>' +
      '<div class="section-sub">Practical resources for the messy middle of a migration.</div></div>' +
      '<span class="pill-note">' + icon("info") + " Preview resources</span></div>" +
    '<div class="support-grid">' +
      '<div class="support-card"><div class="support-icon">' + icon("download") + '</div><div class="support-title">Export guide</div>' +
        '<div class="support-desc">What to download from Adobe, Figma, Notion and other common tools before cancelling.</div>' +
        '<button class="btn btn-secondary btn-sm" data-action="help-resource" data-id="export">Open guide</button></div>' +
      '<div class="support-card"><div class="support-icon">' + icon("lifebuoy") + '</div><div class="support-title">Migration walkthrough</div>' +
        '<div class="support-desc">A 20-minute walkthrough for moving one real project without losing work.</div>' +
        '<button class="btn btn-secondary btn-sm" data-action="help-resource" data-id="walkthrough">Preview walkthrough</button></div>' +
      '<div class="support-card"><div class="support-icon">' + icon("users") + '</div><div class="support-title">Community notes</div>' +
        '<div class="support-desc">Sample notes from people who made the same switch. Not live community content.</div>' +
        '<button class="btn btn-secondary btn-sm" data-action="help-resource" data-id="community">Read sample notes</button></div>' +
    "</div>" +
  "</section>";

  var faq = '<section class="card card-pad mt-16">' +
    '<div class="section-head"><div><h2 class="section-title">Questions before you cancel</h2>' +
      '<div class="section-sub">The honest answers, including what Alt. cannot do.</div></div></div>' +
    '<details class="disclosure"><summary>Does Alt. cancel the subscription for me?</summary>' +
      "<p>No. This demo never contacts a provider. It records the decision in your local workspace so you can track the saving. You still cancel from the provider's billing page.</p></details>" +
    '<details class="disclosure"><summary>What happens to my files when I switch?</summary>' +
      "<p>They stay with the original provider until you export them. Download source files before cancelling, and check that the free tool can open the formats you rely on.</p></details>" +
    '<details class="disclosure"><summary>Is the saving guaranteed?</summary>' +
      "<p>No. Savings are monthly estimates based on sample prices. Annual discounts, taxes and plan changes are not modelled. Use the calculator to test your own numbers.</p></details>" +
    '<details class="disclosure"><summary>Can I undo a cancellation in the demo?</summary>' +
      "<p>Yes. After marking a subscription cancelled, use Undo in the confirmation toast. After the toast disappears, reset the workspace from Preferences to restore sample data.</p></details>" +
  "</section>";

  return '<div class="page">' +
    pageHeader({
      eyebrow: "Switching help", eyebrowIcon: "lifebuoy",
      title: "Switch without losing work",
      subtitle: "A checklist, export guidance and honest answers. No provider is contacted and nothing is cancelled from here.",
      actions: '<a class="btn btn-secondary" href="#/subscriptions/cancel">' + icon("x") + "Cancellation planner</a>"
    }) +
    planHead +
    '<div class="grid-12">' +
      '<div class="span-7">' + checklist + "</div>" +
      '<div class="span-5"><div class="stack">' +
        '<div class="callout accent">' + icon("shield-check") + "<div><strong>Keep the paid plan until the trial works.</strong> A free plan is only free if it does not cost you a client deadline.</div></div>" +
        '<div class="callout warn">' + icon("alert") + "<div><strong>Cancel after a successful trial, before renewal.</strong> Set a calendar reminder for two days before the billing date.</div></div>" +
        '<div class="card card-pad"><h2 class="section-title">Plan status</h2>' +
          '<div class="result-stats mt-16" style="grid-template-columns:1fr 1fr">' +
            '<div class="result-stat"><span>Steps done</span><strong data-help-steps>' + done + " / " + steps.length + "</strong></div>" +
            '<div class="result-stat"><span>Plan</span><strong>' + (plan ? "Saved" : "General") + "</strong></div>" +
          "</div>" +
          '<div class="calc-actions"><a class="btn btn-secondary btn-sm" href="#/savings/calculator">' + icon("calculator") + "Model the saving</a></div>" +
        "</div>" +
      "</div></div>" +
    "</div>" +
    support + faq +
    '<div class="source-note">' + icon("info") + " Guides and community notes are static sample content. No support request is sent." + "</div>" +
  "</div>";
}

function renderWorkflows(route) {
  var body;
  if (route.tab === "compatibility") body = renderWorkflowsCompatibility();
  else if (route.tab === "simulator") body = renderWorkflowsSimulator();
  else if (route.tab === "help") body = renderWorkflowsHelp();
  else body = renderWorkflowsBuilder();
  return body.replace("</header>", "</header>" + tabsBar(route));
}

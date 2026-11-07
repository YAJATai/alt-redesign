/* ==========================================================================
   Alt. — Discover
   Free alternatives catalogue, alternative finder, feature comparison,
   work-need recommendations and the Ask Alt. keyword prototype.
   ========================================================================== */
"use strict";

var ASSISTANT_KEYWORDS = [
  { category: "Video", words: ["video", "edit", "film", "youtube", "reel", "shorts", "premiere", "colour", "color", "vlog"] },
  { category: "Design", words: ["design", "figma", "logo", "ui", "ux", "photoshop", "illustrator", "graphic", "thumbnail", "brand"] },
  { category: "Writing", words: ["write", "writing", "grammar", "essay", "blog", "copy", "proofread", "document", "email"] },
  { category: "Code", words: ["code", "coding", "develop", "program", "ide", "editor", "git", "debug"] },
  { category: "Audio", words: ["audio", "podcast", "music", "sound", "mix", "voice", "record"] },
  { category: "Presentations", words: ["present", "presentation", "slide", "deck", "pitch", "keynote"] },
  { category: "CRM", words: ["crm", "lead", "sales", "follow", "client", "customer", "pipeline"] },
  { category: "Communication", words: ["team", "chat", "message", "meeting", "loom", "screen", "update", "slack"] },
  { category: "Project management", words: ["project", "task", "kanban", "sprint", "plan", "manage", "deadline"] },
  { category: "Productivity", words: ["notes", "notion", "organise", "organize", "database", "workspace", "wiki"] }
];

var FINDER_CONSTRAINTS = [
  { id: "hardware", label: "Runs on older hardware", desc: "Low or very low system requirements", test: function (tool) { return tool.hardware === "Low" || tool.hardware === "Very low"; } },
  { id: "easy", label: "Quick to learn", desc: "Low learning curve", test: function (tool) { return tool.learning === "Low"; } },
  { id: "offline", label: "Works offline", desc: "Desktop app or offline access", test: function (tool) { return (tool.capabilities || []).indexOf("offline") !== -1 || tool.category === "Video" || tool.category === "Audio"; } },
  { id: "mobile", label: "Mobile version", desc: "A companion mobile app", test: function (tool) { return (tool.capabilities || []).indexOf("mobile") !== -1; } },
  { id: "team", label: "Team collaboration", desc: "Shared files and comments", test: function (tool) { return (tool.capabilities || []).indexOf("collaboration") !== -1; } },
  { id: "browser", label: "No install needed", desc: "Runs in the browser", test: function (tool) { return tool.hardware === "Very low"; } }
];

function discoverCategoryIcon(category) {
  var item = CATEGORIES.filter(function (cat) { return cat.id === category; })[0];
  return item ? item.icon : "tool";
}

function discoverCompareHref(tool) {
  var partner = null;
  if (tool.free) {
    partner = paidToolForName(tool.replaces);
  } else {
    partner = freeTools().filter(function (candidate) { return candidate.replaces === tool.name; })[0] || null;
  }
  if (!partner) return "#/discover/compare";
  if (tool.free) return "#/discover/compare?a=" + encodeURIComponent(partner.id) + "&b=" + encodeURIComponent(tool.id);
  return "#/discover/compare?a=" + encodeURIComponent(tool.id) + "&b=" + encodeURIComponent(partner.id);
}

function discoverSimHref(tool) {
  var partner = null;
  if (tool.free) {
    partner = paidToolForName(tool.replaces);
    return "#/workflows/simulator?from=" + encodeURIComponent(partner ? partner.id : ui.sim.from) + "&to=" + encodeURIComponent(tool.id);
  }
  partner = freeTools().filter(function (candidate) { return candidate.replaces === tool.name; })[0] || null;
  return "#/workflows/simulator?from=" + encodeURIComponent(tool.id) + "&to=" + encodeURIComponent(partner ? partner.id : ui.sim.to);
}

function discoverToolCard(tool) {
  var price = tool.free ? "Free" : money(tool.price) + "/mo";
  return '<article class="tool-card">' +
    '<div class="tool-top">' +
      '<div class="tool-identity">' + logoHtml(tool) +
        "<div><div class=\"tool-name\">" + esc(tool.name) + '</div><div class="tool-category">' + esc(tool.category) + "</div></div></div>" +
      (tool.free ? '<span class="match-pill">' + icon("sparkles") + tool.match + "%</span>" : badge("Paid reference", "warn")) +
    "</div>" +
    (tool.replaces ? '<div class="tool-replaces">' + icon("repeat") + "Replaces " + esc(tool.replaces) + "</div>" : "") +
    '<div class="tool-desc">' + esc(tool.desc) + "</div>" +
    '<div class="tool-metrics">' +
      '<div class="tool-metric"><span>Match</span><strong>' + (tool.free ? tool.match + "%" : "—") + "</strong></div>" +
      '<div class="tool-metric"><span>Saves</span><strong>' + (tool.saves ? moneyCompact(tool.saves) + "/mo" : "—") + "</strong></div>" +
      '<div class="tool-metric"><span>Learning</span><strong>' + esc(tool.learning) + "</strong></div>" +
    "</div>" +
    '<div class="tool-foot"><span class="tool-price' + (tool.free ? "" : " paid") + '">' + esc(price) + "</span>" +
      '<div class="tool-actions">' +
        '<button class="icon-btn-sm" data-action="open-tool" data-id="' + attr(tool.id) + '" title="View details" aria-label="View ' + attr(tool.name) + '">' + icon("eye") + "</button>" +
        '<a class="icon-btn-sm" href="' + attr(discoverCompareHref(tool)) + '" title="Compare features" aria-label="Compare ' + attr(tool.name) + '">' + icon("grid") + "</a>" +
        (tool.free ? '<a class="icon-btn-sm" href="' + attr(discoverSimHref(tool)) + '" title="Simulate a switch" aria-label="Simulate switching to ' + attr(tool.name) + '">' + icon("play") + "</a>" : "") +
      "</div>" +
    "</div>" +
  "</article>";
}

function renderDiscoverAlternatives() {
  var list = (ui.freeOnly ? freeTools() : TOOLS.slice()).filter(function (tool) {
    if (ui.discoverCategory !== "All" && tool.category !== ui.discoverCategory) return false;
    return toolMatches(tool, ui.discoverQuery);
  });
  var sort = ui.discoverSort || "match";
  list.sort(function (a, b) {
    if (sort === "name") return a.name.localeCompare(b.name);
    if (sort === "savings") return (b.saves || 0) - (a.saves || 0);
    if (sort === "learning") return String(a.learning).localeCompare(String(b.learning));
    return (b.match || 0) - (a.match || 0);
  });

  var chips = ['<button class="chip' + (ui.discoverCategory === "All" ? " selected" : "") + '" data-action="discover-category" data-category="All" aria-pressed="' + (ui.discoverCategory === "All") + '">All</button>']
    .concat(CATEGORIES.map(function (cat) {
      return '<button class="chip' + (ui.discoverCategory === cat.id ? " selected" : "") + '" data-action="discover-category" data-category="' + attr(cat.id) + '" aria-pressed="' + (ui.discoverCategory === cat.id) + '">' +
        icon(cat.icon) + esc(cat.id) + "</button>";
    })).join("");

  var sortOptions = [
    { id: "match", label: "Best match" },
    { id: "savings", label: "Biggest saving" },
    { id: "learning", label: "Easiest to learn" },
    { id: "name", label: "Name A–Z" }
  ].map(function (option) {
    return '<option value="' + option.id + '"' + (sort === option.id ? " selected" : "") + ">" + esc(option.label) + "</option>";
  }).join("");

  return '<div class="page">' +
    pageHeader({
      eyebrow: "Free alternatives", eyebrowIcon: "compass",
      title: "Discover",
      subtitle: "Replace paid tools with software that covers the work. Every card is matched against your stack using the sample catalogue.",
      actions: '<a class="btn btn-secondary" href="#/discover/finder">' + icon("sliders") + "Alternative finder</a>" +
        '<a class="btn btn-primary" href="#/discover/assistant">' + icon("bot") + "Ask Alt.</a>"
    }) +
    '<div class="discover-toolbar">' +
      '<div class="discover-search-row">' +
        '<div class="discover-search">' + icon("search") +
          '<input class="input" type="search" placeholder="Search tools, categories or replaced software" aria-label="Search alternatives" data-live="discover-query" value="' + attr(ui.discoverQuery) + '">' +
        "</div>" +
        '<label class="switch"><input type="checkbox" data-change="discover-free"' + (ui.freeOnly ? " checked" : "") + "><span>Free tools only</span></label>" +
        '<select class="select toolbar-select" aria-label="Sort alternatives" data-change="discover-sort">' + sortOptions + "</select>" +
        '<span class="discover-count">' + list.length + (list.length === 1 ? " tool" : " tools") + "</span>" +
      "</div>" +
      '<div class="category-chips" role="group" aria-label="Filter by category">' + chips + "</div>" +
    "</div>" +
    (list.length ? '<div class="tools-grid">' + list.map(discoverToolCard).join("") + "</div>" : '<div class="card">' + emptyState({
      icon: "search", title: "No tools match that search",
      text: "Try a different phrase, another category or include paid reference tools to compare against.",
      actionLabel: "Clear search", actionAction: "clear-discover"
    }) + "</div>") +
    '<div class="source-note">' + icon("info") + " Match percentages and savings are sample estimates from the local catalogue. Always trial a tool on a real project before switching.</div>" +
  "</div>";
}

function discoverFinderResults(category, constraintIds) {
  var list = freeTools().filter(function (tool) { return !category || tool.category === category; });
  var results = list.map(function (tool) {
    var matched = [];
    var score = tool.match || 0;
    constraintIds.forEach(function (id) {
      var constraint = FINDER_CONSTRAINTS.filter(function (item) { return item.id === id; })[0];
      if (constraint && constraint.test(tool)) {
        matched.push(constraint);
        score += 4;
      }
    });
    return { tool: tool, score: Math.min(score, 99), matched: matched };
  });
  results.sort(function (a, b) { return b.score - a.score; });
  return results.slice(0, 4);
}

function discoverFinderSteps(step) {
  var steps = [
    { num: 1, label: "Choose the work" },
    { num: 2, label: "Set constraints" },
    { num: 3, label: "Review matches" }
  ];
  return '<div class="finder-steps">' + steps.map(function (item, index) {
    var stateClass = step === item.num ? " active" : step > item.num ? " done" : "";
    return (index ? '<span class="finder-step-sep"></span>' : "") +
      '<div class="finder-step' + stateClass + '"><span class="finder-step-num">' +
      (step > item.num ? icon("check") : item.num) + "</span>" + esc(item.label) + "</div>";
  }).join("") + "</div>";
}

function renderDiscoverFinder() {
  var finder = ui.finder;
  var step = finder.step || 1;
  var body = "";

  if (step === 1) {
    body = '<div class="wizard-panel">' +
      '<div class="wizard-title">What kind of work is this for?</div>' +
      '<div class="wizard-sub">Pick the closest category. You can refine it with constraints next.</div>' +
      '<div class="category-grid">' + CATEGORIES.map(function (cat) {
        var count = freeTools().filter(function (tool) { return tool.category === cat.id; }).length;
        return '<button class="category-card' + (finder.category === cat.id ? " selected" : "") + '" data-action="finder-category" data-category="' + attr(cat.id) + '">' +
          '<span class="category-icon">' + icon(cat.icon) + "</span>" +
          '<span><span class="category-name">' + esc(cat.id) + '</span><span class="category-blurb">' + esc(cat.blurb) + " · " + count + " tools</span></span></button>";
      }).join("") + "</div>" +
      '<div class="wizard-actions"><span class="field-hint">Step 1 of 3 · ' + (finder.category ? esc(finder.category) + " selected" : "Choose a category to continue") + "</span>" +
        '<button class="btn btn-primary" data-action="finder-next"' + (finder.category ? "" : " disabled") + ">Next: constraints " + icon("arrow-right") + "</button></div>" +
    "</div>";
  } else if (step === 2) {
    body = '<div class="wizard-panel">' +
      '<div class="wizard-title">Anything the tool must support?</div>' +
      '<div class="wizard-sub">Optional. We will rank ' + esc(finder.category || "all") + " tools against these constraints.</div>" +
      '<div class="constraint-grid">' + FINDER_CONSTRAINTS.map(function (constraint) {
        var checked = finder.constraints.indexOf(constraint.id) !== -1;
        return '<label class="constraint-card' + (checked ? " checked" : "") + '">' +
          '<input type="checkbox" data-change="finder-constraint" data-id="' + attr(constraint.id) + '"' + (checked ? " checked" : "") + ">" +
          "<span><span class=\"constraint-card-title\">" + esc(constraint.label) + '</span><span class="constraint-card-desc">' + esc(constraint.desc) + "</span></span></label>";
      }).join("") + "</div>" +
      '<div class="wizard-actions"><button class="btn btn-ghost" data-action="finder-back">' + icon("arrow-left") + "Back</button>" +
        '<button class="btn btn-primary" data-action="finder-next">See matches ' + icon("arrow-right") + "</button></div>" +
    "</div>";
  } else {
    var results = finder.results || [];
    body = '<div class="wizard-panel">' +
      '<div class="wizard-title">' + (finder.loading ? "Ranking free tools…" : "Best matches for " + (finder.category || "your work")) + "</div>" +
      '<div class="wizard-sub">' + (finder.loading ? "Comparing capabilities against your constraints." :
        results.length + " tools scored by capability match, learning curve and the constraints you selected.") + "</div>" +
      (finder.loading ? '<div class="finder-results"><div class="skeleton skeleton-result"></div><div class="skeleton skeleton-result"></div><div class="skeleton skeleton-result"></div></div>' :
        (results.length ? '<div class="finder-results">' + results.map(function (result, index) {
          var tool = result.tool;
          return '<div class="finder-result">' +
            '<span class="finder-result-rank">' + (index + 1) + "</span>" +
            '<div class="finder-result-main"><div class="finder-result-head">' + logoHtml(tool, "logo-sm") +
              '<span class="finder-result-name">' + esc(tool.name) + "</span>" + badge(result.score + "% match", "accent") + "</div>" +
              '<div class="finder-result-desc">' + esc(tool.desc) + "</div>" +
              '<div class="why-chips">' + result.matched.map(function (constraint) {
                return '<span class="why-chip">' + icon("check") + esc(constraint.label) + "</span>";
              }).join("") + '<span class="why-chip">' + icon("wallet") + "Free</span></div></div>" +
            '<div class="finder-result-side"><strong>' + (tool.saves ? "Save " + moneyCompact(tool.saves) + "/mo" : "Free") + "</strong>" +
              '<div class="row gap-6"><button class="btn btn-secondary btn-sm" data-action="open-tool" data-id="' + attr(tool.id) + '">Details</button>' +
                '<a class="btn btn-primary btn-sm" href="' + attr(discoverCompareHref(tool)) + '">Compare</a></div></div>' +
          "</div>";
        }).join("") + "</div>" : emptyState({
          icon: "search", title: "No tools fit all constraints",
          text: "Relax a constraint and try again — the catalogue has free tools for every category.",
          actionLabel: "Adjust constraints", actionAction: "finder-back"
        }))) +
      '<div class="wizard-actions"><button class="btn btn-ghost" data-action="finder-back">' + icon("arrow-left") + "Adjust constraints</button>" +
        '<button class="btn btn-secondary" data-action="finder-restart">' + icon("rotate") + "Start over</button></div>" +
    "</div>";
  }

  return '<div class="page">' +
    pageHeader({
      eyebrow: "Alternative finder", eyebrowIcon: "sliders",
      title: "Find a free alternative",
      subtitle: "Three steps: describe the work, add constraints, review ranked matches from the catalogue.",
      actions: '<a class="btn btn-secondary" href="#/discover">' + icon("grid") + "Browse all tools</a>"
    }) +
    '<div class="finder-shell">' + discoverFinderSteps(step) + '<section class="card">' + body + "</section></div>" +
    '<div class="source-note">' + icon("info") + " The finder runs locally against sample capabilities. It does not inspect your device or files.</div>" +
  "</div>";
}

function discoverCompareRow(label, a, b) {
  return '<div class="cmp-row">' +
    '<div class="cmp-feature">' + esc(label) + "</div>" +
    '<div class="cmp-val ' + (a ? "cmp-yes" : "cmp-no") + '">' + icon(a ? "check" : "circle") + "<span>" + (a ? "Included" : "Not included") + "</span></div>" +
    '<div class="cmp-val ' + (b ? "cmp-yes" : "cmp-no") + '">' + icon(b ? "check" : "circle") + "<span>" + (b ? "Included" : "Not included") + "</span></div>" +
  "</div>";
}

function renderDiscoverCompare() {
  var a = toolById(ui.compare.a) || TOOLS[0];
  var b = toolById(ui.compare.b) || TOOLS[1];
  var options = TOOLS.slice().sort(function (x, y) { return x.name.localeCompare(y.name); }).map(function (tool) {
    return '<option value="' + attr(tool.id) + '"' + (tool.id === a.id ? " selected" : "") + ">" + esc(tool.name) + (tool.free ? " · Free" : " · Paid") + "</option>";
  }).join("");
  var optionsB = TOOLS.slice().sort(function (x, y) { return x.name.localeCompare(y.name); }).map(function (tool) {
    return '<option value="' + attr(tool.id) + '"' + (tool.id === b.id ? " selected" : "") + ">" + esc(tool.name) + (tool.free ? " · Free" : " · Paid") + "</option>";
  }).join("");
  var caps = [];
  [a, b].forEach(function (tool) {
    (tool.capabilities || []).forEach(function (cap) {
      if (caps.indexOf(cap) === -1) caps.push(cap);
    });
  });
  caps.sort(function (x, y) { return (CAPABILITY_LABELS[x] || x).localeCompare(CAPABILITY_LABELS[y] || y); });
  var paid = !a.free ? a : !b.free ? b : null;
  var free = a.free ? a : b.free ? b : null;
  var saving = paid && free ? Math.max(0, paid.price - free.price) : 0;

  var rows = [
    { label: "Monthly cost", av: a.price ? money(a.price) : "Free", bv: b.price ? money(b.price) : "Free" },
    { label: "Learning curve", av: a.learning, bv: b.learning },
    { label: "Hardware needs", av: a.hardware, bv: b.hardware },
    { label: "Best for", av: a.bestFor, bv: b.bestFor }
  ].map(function (row) {
    return '<div class="cmp-row"><div class="cmp-feature">' + esc(row.label) + '</div><div class="cmp-val"><span>' + esc(row.av) + '</span></div><div class="cmp-val"><span>' + esc(row.bv) + "</span></div></div>";
  }).join("");

  var capRows = caps.map(function (cap) {
    return discoverCompareRow(CAPABILITY_LABELS[cap] || cap, (a.capabilities || []).indexOf(cap) !== -1, (b.capabilities || []).indexOf(cap) !== -1);
  }).join("");

  return '<div class="page">' +
    pageHeader({
      eyebrow: "Feature comparison", eyebrowIcon: "grid",
      title: "Compare features",
      subtitle: "Check capability coverage before committing to a switch. Rows show what each tool actually includes in the sample catalogue.",
      actions: '<a class="btn btn-secondary" href="#/discover/finder">' + icon("sliders") + "Use the finder</a>"
    }) +
    '<div class="compare-controls">' +
      '<div class="compare-selects">' +
        '<div class="field"><label class="label" for="compareA">Tool A</label><select class="select" id="compareA" data-change="compare-a">' + options + "</select></div>" +
        '<button class="swap-btn" data-action="compare-swap" title="Swap tools" aria-label="Swap tools">' + icon("repeat") + "</button>" +
        '<div class="field"><label class="label" for="compareB">Tool B</label><select class="select" id="compareB" data-change="compare-b">' + optionsB + "</select></div>" +
      "</div>" +
      '<a class="btn btn-secondary" href="' + attr("#/workflows/simulator?from=" + encodeURIComponent(paid ? paid.id : a.id) + "&to=" + encodeURIComponent(free ? free.id : b.id)) + '">' + icon("play") + "Simulate</a>" +
    "</div>" +
    '<section class="card compare-card">' +
      '<div class="compare-head">' +
        '<div class="compare-tool"><div class="compare-tool-top">' + logoHtml(a, "logo-lg") + "<div><div class=\"compare-tool-name\">" + esc(a.name) + '</div><div class="compare-tool-sub">' + esc(a.category) + "</div></div></div>" +
          '<div class="compare-tool-price' + (a.free ? "" : " paid") + '">' + (a.free ? "Free" : money(a.price) + "/mo") + "</div></div>" +
        '<div class="compare-tool"><div class="compare-tool-top">' + logoHtml(b, "logo-lg") + "<div><div class=\"compare-tool-name\">" + esc(b.name) + '</div><div class="compare-tool-sub">' + esc(b.category) + "</div></div></div>" +
          '<div class="compare-tool-price' + (b.free ? "" : " paid") + '">' + (b.free ? "Free" : money(b.price) + "/mo") + "</div></div>" +
      "</div>" +
      '<div class="compare-rows">' +
        '<div class="cmp-row head"><div>Attribute</div><div>' + esc(a.name) + "</div><div>" + esc(b.name) + "</div></div>" +
        rows + capRows +
      "</div>" +
      '<div class="compare-foot"><span class="card-note">' + icon(saving ? "trending-up" : "info") + (saving ?
        "Replacing " + esc(paid.name) + " with " + esc(free.name) + " could save " + money(saving) + "/mo." :
        "Both tools are free. Compare workflow fit rather than price.") + "</span>" +
        '<div class="row gap-6"><button class="btn btn-ghost btn-sm" data-action="open-tool" data-id="' + attr(a.id) + '">Details A</button>' +
          '<button class="btn btn-ghost btn-sm" data-action="open-tool" data-id="' + attr(b.id) + '">Details B</button></div></div>' +
    "</section>" +
    '<div class="source-note">' + icon("info") + " Capability data is illustrative. A trial project is the only reliable compatibility test.</div>" +
  "</div>";
}

function renderDiscoverNeeds() {
  var needs = ui.needs;
  var selected = needs.selected || [];
  var results = needs.results || [];
  var toolIds = [];
  results.forEach(function (result) {
    if (toolIds.indexOf(result.toolId) === -1) toolIds.push(result.toolId);
  });
  var saving = toolIds.reduce(function (sum, id) {
    var tool = toolById(id);
    return sum + (tool && tool.saves ? tool.saves : 0);
  }, 0);

  var cards = WORK_NEEDS.map(function (need) {
    var checked = selected.indexOf(need.id) !== -1;
    return '<label class="need-card' + (checked ? " checked" : "") + '">' +
      '<input type="checkbox" data-change="needs-toggle" data-id="' + attr(need.id) + '"' + (checked ? " checked" : "") + ">" +
      '<span class="need-check">' + icon("check") + "</span>" +
      '<span class="need-icon">' + icon(need.icon) + "</span>" +
      '<span class="need-name">' + esc(need.label) + '</span><span class="need-desc">' + esc(need.desc) + "</span></label>";
  }).join("");

  var resultsHtml = "";
  if (needs.loading) {
    resultsHtml = '<div class="needs-results"><div class="skeleton skeleton-result"></div><div class="skeleton skeleton-result"></div></div>';
  } else if (needs.built) {
    if (results.length) {
      resultsHtml = '<div class="needs-results"><div class="section-head"><div><h2 class="section-title">Recommended free tools</h2>' +
        '<div class="section-sub">One primary recommendation per selected need.</div></div></div>' +
        results.map(function (result) {
          var need = WORK_NEEDS.filter(function (item) { return item.id === result.needId; })[0];
          var tool = toolById(result.toolId);
          if (!need || !tool) return "";
          return '<div class="need-result"><span class="need-result-icon">' + icon(need.icon) + "</span>" +
            '<div class="need-result-main"><div class="need-result-task">' + esc(need.label) + "</div>" +
              '<div class="need-result-tool">' + logoHtml(tool, "logo-sm") + esc(tool.name) + badge(tool.match + "% match", "accent") + "</div>" +
              '<div class="need-result-reason">' + esc(need.reason) + "</div></div>" +
            '<div class="need-result-actions"><button class="btn btn-ghost btn-sm" data-action="open-tool" data-id="' + attr(tool.id) + '">Details</button>' +
              '<a class="btn btn-secondary btn-sm" href="' + attr(discoverCompareHref(tool)) + '">Compare</a></div></div>';
        }).join("") +
        (saving ? '<div class="callout accent mt-16">' + icon("trending-up") + "<div><strong>Up to " + money0(saving) + "/mo</strong> could be replaced by this free stack, based on the paid tools these alternatives reference. Estimate only.</div></div>" : "") +
        "</div>";
    } else {
      resultsHtml = emptyState({ icon: "compass", title: "No recommendations yet", text: "Select at least one work need, then ask Alt. to match tools." });
    }
  } else {
    resultsHtml = '<div class="needs-results">' + emptyState({
      icon: "sparkles", title: "Recommendations will appear here",
      text: "Select the work you need to get done. Alt. will match a free tool and explain why it fits.",
      inline: true
    }) + "</div>";
  }

  return '<div class="page">' +
    pageHeader({
      eyebrow: "Work-need recommendations", eyebrowIcon: "sparkles",
      title: "By work needs",
      subtitle: "Start from the job to be done, not the software. These recommendations use a sample taxonomy and are a preview capability.",
      actions: '<a class="btn btn-secondary" href="#/discover/assistant">' + icon("bot") + "Ask Alt. instead</a>"
    }) +
    '<div class="card card-pad">' +
      '<div class="section-head"><div><h2 class="section-title">What do you need to get done?</h2>' +
        '<div class="section-sub">Choose one or more needs. Nothing leaves this browser.</div></div>' +
        '<span class="pill-note">' + icon("sparkles") + " Preview capability</span></div>" +
      '<div class="needs-grid">' + cards + "</div>" +
      '<div class="calc-actions"><button class="btn btn-primary" data-action="needs-recommend">' + icon("sparkles") + "Recommend free tools</button>" +
        '<button class="btn btn-ghost" data-action="needs-clear">' + icon("rotate") + "Clear</button></div>" +
      resultsHtml +
    "</div>" +
    '<div class="callout mt-16">' + icon("info") + "<div><strong>Prototype behaviour.</strong> A production version would learn from your role, calendar and files. This demo only maps your selection to the sample work-need taxonomy.</div></div>" +
  "</div>";
}

function discoverChatAvatar(message) {
  if (message.role === "bot") return '<span class="chat-avatar bot">Alt</span>';
  var initial = (state.preferences.name || "Y").trim().charAt(0).toUpperCase();
  return '<span class="chat-avatar user">' + esc(initial) + "</span>";
}

function renderDiscoverAssistant() {
  var chat = ui.chat;
  var messages = chat.messages.map(function (message) {
    return '<div class="chat-msg ' + attr(message.role) + '">' + discoverChatAvatar(message) +
      '<div class="chat-bubble">' + esc(message.text).replace(/\n/g, "<br>") +
      (message.chips && message.chips.length ? '<div class="quick-chips">' + message.chips.map(function (chip) {
        return '<button class="chip" data-action="chat-chip" data-text="' + attr(chip) + '">' + esc(chip) + "</button>";
      }).join("") + "</div>" : "") +
      "</div></div>";
  }).join("");
  if (chat.typing) {
    messages += '<div class="chat-msg bot"><span class="chat-avatar bot">Alt</span><div class="chat-bubble"><span class="typing"><span></span><span></span><span></span></span></div></div>';
  }

  var quick = ["Edit a video", "Design a landing page", "Clean up podcast audio", "Track client follow-ups", "Build a pitch deck"];
  var recs = (chat.recs || []).map(function (id) {
    var tool = toolById(id);
    if (!tool) return "";
    return '<article class="reco-card">' +
      '<div class="reco-head">' + logoHtml(tool, "logo-sm") + badge(tool.match + "% match", "accent") + "</div>" +
      '<div class="reco-name mt-16">' + esc(tool.name) + '</div><div class="reco-desc">' + esc(tool.desc) + "</div>" +
      '<div class="reco-metrics"><span class="reco-metric">' + esc(tool.category) + '</span><span class="reco-metric">' + esc(tool.learning) + ' learning</span><span class="reco-metric">' + esc(tool.hardware) + ' hardware</span></div>' +
      (tool.saves ? '<div class="reco-savings">Save ' + money0(tool.saves) + "/mo</div>" : "") +
      '<div class="reco-actions"><button class="btn btn-secondary btn-sm" data-action="open-tool" data-id="' + attr(tool.id) + '">Details</button>' +
        '<a class="btn btn-ghost btn-sm" href="' + attr(discoverCompareHref(tool)) + '">Compare</a></div>' +
    "</article>";
  }).join("");

  var dna = [
    { key: "creative", label: "Creative work", value: chat.dna.creative },
    { key: "budget", label: "Budget", value: chat.dna.budget },
    { key: "hardware", label: "Hardware", value: chat.dna.hardware },
    { key: "skill", label: "Skill level", value: chat.dna.skill },
    { key: "student", label: "Context", value: chat.dna.student },
    { key: "learning", label: "Learning time", value: chat.dna.learning }
  ];

  return '<div class="page">' +
    pageHeader({
      eyebrow: "Ask Alt.", eyebrowIcon: "bot",
      title: "Ask Alt.",
      subtitle: "Describe what you need to get done. Alt. matches free tools from the catalogue and explains the fit. Keyword matching prototype — not a live AI.",
      actions: '<button class="btn btn-secondary" data-action="chat-reset">' + icon("rotate") + "Reset chat</button>"
    }) +
    '<div class="chat-layout">' +
      '<section class="card chat-card">' +
        '<div class="chat-head">' +
          '<div class="chat-title"><span class="chat-avatar bot">Alt</span><div>Alt. assistant<div class="chat-status"><span class="dot dot-accent"></span>Matching across ' + TOOLS.length + " catalogue tools · demo</div></div></div>" +
          '<span class="pill-note">' + icon("sparkles") + " Keyword prototype</span>" +
        "</div>" +
        '<div class="chat-messages" aria-live="polite">' + messages + "</div>" +
        '<div class="quick-context"><div class="quick-label">Start with a prompt</div><div class="quick-chips">' +
          quick.map(function (text) {
            return '<button class="chip" data-action="chat-chip" data-text="' + attr(text) + '">' + esc(text) + "</button>";
          }).join("") +
        "</div></div>" +
        '<form data-form="chat" class="chat-input-area">' +
          '<input class="chat-input" name="message" placeholder="Describe what you need to get done…" aria-label="Message Alt." autocomplete="off"' + (chat.typing ? " disabled" : "") + ">" +
          '<button class="chat-send" type="submit" aria-label="Send message"' + (chat.typing ? " disabled" : "") + ">" + icon("send") + "</button>" +
        "</form>" +
        '<div class="chat-meta">' + icon("info") + " Replies are generated by local keyword rules. No message is sent anywhere.</div>" +
      "</section>" +
      '<div class="stack">' +
        '<section class="card profile-panel">' +
          '<div class="profile-head"><span class="profile-icon">' + icon("user") + "</span>" +
            '<div><div class="profile-title">Your creative DNA</div><div class="profile-sub">Context used to shape matches</div></div></div>' +
          dna.map(function (row) {
            var tone = String(row.value).toLowerCase();
            var cls = tone === "max" ? "max" : tone === "high" ? "high" : tone === "medium" ? "medium" : tone === "advanced" ? "advanced" : tone === "student" ? "student" : "";
            return '<div class="profile-row"><span class="profile-key">' + esc(row.label) + '</span><span class="profile-val ' + cls + '">' + esc(row.value) + "</span></div>";
          }).join("") +
          '<div class="profile-bar"><div class="profile-bar-label"><span>Profile completeness</span><strong>' + esc(chat.completeness) + "%</strong></div>" +
            '<div class="progress"><div class="progress-bar" style="width:' + clamp(chat.completeness, 0, 100) + '%"></div></div></div>' +
        "</section>" +
        '<div class="callout">' + icon("info") + "<div>Ask about video, design, writing, code, audio, presentations, CRM, communication, projects or productivity. Alt. uses those words to pick a category.</div></div>" +
      "</div>" +
    "</div>" +
    '<div class="assistant-recs">' +
      '<div class="section-head"><div><h2 class="section-title">Your matches</h2>' +
        '<div class="section-sub">' + (recs ? "Recommended from the free catalogue. Always trial on a real project." : "Send a message or pick a prompt to see recommendations.") + "</div></div>" +
        (recs ? '<a class="section-link" href="#/discover">Browse all ' + icon("arrow-right") + "</a>" : "") + "</div>" +
      (recs ? '<div class="reco-grid">' + recs + "</div>" : emptyState({
        icon: "bot", title: "No matches yet", inline: true,
        text: "Tell Alt. what you need to do — for example, “edit a 4K video” or “track client follow-ups”."
      })) +
      '<div class="assistant-disclaimer">' + icon("info") + " Recommendations are based on sample match scores and may not reflect the latest pricing or features.</div>" +
    "</div>" +
  "</div>";
}

function assistantMatch(text) {
  var lower = String(text || "").toLowerCase();
  var match = ASSISTANT_KEYWORDS.filter(function (entry) {
    return entry.words.some(function (word) { return lower.indexOf(word) !== -1; });
  })[0];
  if (!match) return { category: null, tools: [] };
  var tools = freeTools().filter(function (tool) { return tool.category === match.category; })
    .sort(function (a, b) { return b.match - a.match; })
    .slice(0, 3);
  return { category: match.category, tools: tools };
}

function renderDiscover(route) {
  var body;
  if (route.tab === "finder") body = renderDiscoverFinder();
  else if (route.tab === "compare") body = renderDiscoverCompare();
  else if (route.tab === "needs") body = renderDiscoverNeeds();
  else if (route.tab === "assistant") body = renderDiscoverAssistant();
  else body = renderDiscoverAlternatives();
  return body.replace("</header>", "</header>" + tabsBar(route));
}

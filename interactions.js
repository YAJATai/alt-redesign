/* ==========================================================================
   Alt. — interactions
   Delegated actions, forms, live inputs, overlays and the command palette.
   Every mutation stays inside this browser's demo workspace.
   ========================================================================== */
"use strict";

ui.cancelSub = ui.cancelSub || null;
ui.needs.results = ui.needs.results || [];
if (!ui.sim.months) ui.sim.months = 12;

var pendingFocus = null;
var pendingChangeFocus = null;
var paletteState = { query: "", active: 0, items: [], groups: [] };

var CATEGORY_COLORS = {
  Design: "#6A4F7A",
  Productivity: "#3D5F8A",
  Communication: "#2F6D54",
  Writing: "#8A5A14",
  Video: "#2C6B6E",
  Audio: "#A03A2E",
  Presentations: "#5A6D9A",
  CRM: "#96662A",
  "Project management": "#4F7F6A",
  Code: "#2C6B6E"
};

var HELP_RESOURCES = {
  export: {
    title: "Export guide",
    icon: "download",
    body: "<p>Download the things you cannot recreate quickly: source files, fonts, presets, brand assets and shared links. Check that the formats open in the free alternative before cancelling anything.</p>" +
      "<div class=\"modal-list mt-16\"><div class=\"modal-list-item\"><span>Creative files</span><strong>Native + PDF/SVG</strong></div>" +
      "<div class=\"modal-list-item\"><span>Video projects</span><strong>Project + XML/EDL</strong></div>" +
      "<div class=\"modal-list-item\"><span>Docs & boards</span><strong>Markdown + CSV</strong></div>" +
      "<div class=\"modal-list-item\"><span>Accounts</span><strong>Billing page screenshot</strong></div></div>"
  },
  walkthrough: {
    title: "Migration walkthrough",
    icon: "lifebuoy",
    body: "<p>Move one real project first. A 20-minute trial on actual work surfaces format problems, missing fonts and audio sync issues far faster than a demo file.</p>" +
      "<div class=\"modal-section mt-16\"><div class=\"modal-section-title\">Suggested sequence</div><div class=\"modal-list\">" +
      "<div class=\"modal-list-item\"><span>1. Export a small project</span><strong>Keep the original</strong></div>" +
      "<div class=\"modal-list-item\"><span>2. Open it in the free tool</span><strong>Check every asset</strong></div>" +
      "<div class=\"modal-list-item\"><span>3. Recreate one deliverable</span><strong>Time yourself</strong></div>" +
      "<div class=\"modal-list-item\"><span>4. Ask a collaborator to review</span><strong>Confirm access</strong></div></div></div>"
  },
  community: {
    title: "Sample community notes",
    icon: "users",
    body: "<p>These are static sample notes, not live community posts.</p>" +
      "<div class=\"modal-callout mt-16\">“The hardest part was relinking fonts. Export a PDF reference before you move anything.”<br><span class=\"field-hint\">Sample note · video editor</span></div>" +
      "<div class=\"modal-callout mt-16\">“I kept the paid tool for one month while testing. The trial project made the decision obvious.”<br><span class=\"field-hint\">Sample note · designer</span></div>"
  }
};

var INTEGRATION_PREVIEWS = {
  accounting: {
    title: "Accounting export",
    icon: "database",
    body: "<p>In a production build, recorded savings could be exported as recovered expenses to an accounting tool. This demo does not connect to any accounting provider.</p>" +
      "<div class=\"modal-list mt-16\"><div class=\"modal-list-item\"><span>Provider</span><strong>Not connected</strong></div>" +
      "<div class=\"modal-list-item\"><span>Required access</span><strong>Write access to expenses</strong></div>" +
      "<div class=\"modal-list-item\"><span>Data leaving this device</span><strong>None</strong></div></div>"
  },
  workspace: {
    title: "Google Workspace",
    icon: "grid",
    body: "<p>Workspace access would let Alt. read seat counts and directory usage. This demo never asks for an account, token or scope.</p>" +
      "<div class=\"modal-callout warn mt-16\">OAuth, read scopes and a retention policy would be required before this could be enabled.</div>"
  },
  slack: {
    title: "Slack alerts",
    icon: "message",
    body: "<p>A production integration could post renewal reminders and waste alerts into a channel. Nothing is sent from this demo.</p>" +
      "<div class=\"modal-list mt-16\"><div class=\"modal-list-item\"><span>Channel</span><strong>Not selected</strong></div>" +
      "<div class=\"modal-list-item\"><span>Messages sent</span><strong>0</strong></div></div>"
  },
  extension: {
    title: "Browser extension",
    icon: "compass",
    body: "<p>A browser extension would flag paid tools while you browse and suggest catalogue alternatives. It is a preview only and is not installed by this page.</p>" +
      "<div class=\"modal-callout mt-16\">A real extension would need explicit install consent, per-site permissions and a clear privacy policy.</div>"
  }
};

/* ---------------------------------- helpers -------------------------------- */

function formField(form, name) {
  return form ? form.querySelector('[name="' + name + '"]') : null;
}

function fieldValue(form, name) {
  var field = formField(form, name);
  return field ? String(field.value == null ? "" : field.value).trim() : "";
}

function fieldNumber(form, name, fallback) {
  var value = parseFloat(fieldValue(form, name));
  return isNaN(value) ? (fallback || 0) : value;
}

function validEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || "").trim());
}

function clearFormErrors(form) {
  if (!form) return;
  form.querySelectorAll(".field.has-error").forEach(function (field) { field.classList.remove("has-error"); });
  form.querySelectorAll(".field-error").forEach(function (error) { error.textContent = ""; });
}

function setFieldError(form, name, message) {
  var field = form.querySelector('[data-field="' + name + '"]');
  if (!field) return;
  field.classList.add("has-error");
  var error = field.querySelector(".field-error");
  if (error) error.textContent = message;
}

function focusFirstError(form) {
  var field = form.querySelector(".field.has-error input, .field.has-error select, .field.has-error textarea");
  if (field) field.focus();
}

function initialsFor(name) {
  var parts = String(name || "").trim().split(/\s+/).filter(Boolean);
  var initials = parts.map(function (part) { return part.charAt(0); }).join("").slice(0, 2).toUpperCase();
  return initials || String(name || "?").slice(0, 2).toUpperCase();
}

function detailCell(label, value) {
  return '<div class="detail-cell"><div class="detail-label">' + esc(label) + '</div><div class="detail-value">' + value + "</div></div>";
}

function featureLines(features, lose) {
  return (features || []).map(function (feature) {
    return '<div class="feature-line' + (lose ? " lose" : "") + '">' + icon(lose ? "alert" : "check") + "<span>" + esc(feature) + "</span></div>";
  }).join("");
}

function rememberFocus() {
  var active = document.activeElement;
  if (active && active !== document.body && active !== document.documentElement) ui.lastFocus = active;
}

function restoreFocus() {
  var target = ui.lastFocus;
  ui.lastFocus = null;
  if (target && document.documentElement.contains(target) && typeof target.focus === "function") {
    try { target.focus({ preventScroll: true }); } catch (error) { target.focus(); }
  }
}

function activeLayer() {
  return document.querySelector(".palette-backdrop") ||
    document.querySelector(".modal-backdrop") ||
    document.querySelector(".drawer-backdrop");
}

function syncOverlayState() {
  document.body.classList.toggle("overlay-open", !!activeLayer());
}

function trapTab(event, layer) {
  var focusable = Array.prototype.slice.call(layer.querySelectorAll(
    'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
  )).filter(function (element) { return element.offsetParent !== null; });
  if (!focusable.length) {
    event.preventDefault();
    return;
  }
  var first = focusable[0];
  var last = focusable[focusable.length - 1];
  var inside = layer.contains(document.activeElement);
  if (event.shiftKey && (!inside || document.activeElement === first)) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && (!inside || document.activeElement === last)) {
    event.preventDefault();
    first.focus();
  }
}

/* --------------------------------- overlays -------------------------------- */

function removeModal(restore) {
  var root = document.getElementById("modalRoot");
  if (!root) return;
  var hadContent = !!root.firstElementChild;
  root.innerHTML = "";
  syncOverlayState();
  if (restore && hadContent) restoreFocus();
}

function closeModal() {
  removeModal(true);
}

function openModal(options) {
  options = options || {};
  removeModal(false);
  if (document.querySelector(".drawer-backdrop")) closeDrawer();
  if (document.querySelector(".palette-backdrop")) closePalette();
  rememberFocus();
  var root = document.getElementById("modalRoot");
  var size = options.size === "lg" ? " modal-lg" : options.size === "sm" ? " modal-sm" : "";
  root.innerHTML = '<div class="modal-backdrop">' +
    '<div class="modal' + size + '" role="dialog" aria-modal="true" aria-labelledby="modalTitle">' +
      '<div class="modal-head"><div><div class="modal-title" id="modalTitle">' + esc(options.title || "") + "</div>" +
        (options.subtitle ? '<div class="modal-sub">' + options.subtitle + "</div>" : "") +
      "</div>" +
      '<button class="modal-close" type="button" data-action="close-modal" aria-label="Close">' + icon("x") + "</button></div>" +
      '<div class="modal-body">' + (options.body || "") + "</div>" +
      (options.footer ? '<div class="modal-foot">' + options.footer + "</div>" : "") +
    "</div></div>";
  syncOverlayState();
  var backdrop = root.querySelector(".modal-backdrop");
  var modal = root.querySelector(".modal");
  backdrop.addEventListener("mousedown", function (event) {
    if (event.target === backdrop) closeModal();
  });
  if (options.onMount) options.onMount(modal, closeModal);
  var focusTarget = modal.querySelector(options.initialFocus || "[data-autofocus]") ||
    modal.querySelector("input:not([type=hidden]), select, textarea, .btn-primary, button");
  if (focusTarget) {
    try { focusTarget.focus({ preventScroll: true }); } catch (error) { focusTarget.focus(); }
  }
  return modal;
}

function closeDrawer() {
  var root = document.getElementById("overlayRoot");
  if (!root) return;
  var hadContent = !!root.firstElementChild;
  root.innerHTML = "";
  syncOverlayState();
  if (hadContent) restoreFocus();
}

function openDrawer(options) {
  options = options || {};
  removeModal(false);
  closeDrawer();
  if (document.querySelector(".palette-backdrop")) closePalette();
  rememberFocus();
  var root = document.getElementById("overlayRoot");
  root.innerHTML = '<div class="drawer-backdrop">' +
    '<aside class="drawer" role="dialog" aria-modal="true" aria-label="' + attr(options.title || "Details") + '">' +
      '<div class="drawer-head"><div class="drawer-head-main">' + (options.headMain || "") +
        '<div><div class="drawer-title">' + esc(options.title || "") + "</div>" +
        (options.subtitle ? '<div class="drawer-sub">' + options.subtitle + "</div>" : "") +
        "</div></div>" +
        '<button class="modal-close drawer-close" type="button" data-action="close-drawer" aria-label="Close">' + icon("x") + "</button></div>" +
      '<div class="drawer-body">' + (options.body || "") + "</div>" +
      (options.footer ? '<div class="drawer-foot">' + options.footer + "</div>" : "") +
    "</aside></div>";
  syncOverlayState();
  var backdrop = root.querySelector(".drawer-backdrop");
  backdrop.addEventListener("mousedown", function (event) {
    if (event.target === backdrop) closeDrawer();
  });
  var focusTarget = backdrop.querySelector(options.initialFocus || ".drawer-close");
  if (focusTarget) {
    try { focusTarget.focus({ preventScroll: true }); } catch (error) { focusTarget.focus(); }
  }
  return backdrop.querySelector(".drawer");
}

function confirmDialog(options) {
  var footer = '<button class="btn btn-secondary" type="button" data-confirm-cancel>' + esc(options.cancelLabel || "Cancel") + "</button>" +
    '<button class="btn ' + (options.danger ? "btn-danger-solid" : "btn-primary") + '" type="button" data-confirm-ok>' +
    esc(options.confirmLabel || "Confirm") + "</button>";
  return openModal({
    title: options.title,
    subtitle: options.subtitle,
    body: options.body || "",
    size: "sm",
    footer: footer,
    initialFocus: "[data-confirm-cancel]",
    onMount: function (root, close) {
      root.querySelector("[data-confirm-cancel]").addEventListener("click", close);
      root.querySelector("[data-confirm-ok]").addEventListener("click", function () {
        close();
        if (typeof options.onConfirm === "function") options.onConfirm();
      });
    }
  });
}

function dismissToast(element) {
  if (!element || element.dataset.leaving) return;
  element.dataset.leaving = "1";
  element.classList.add("leaving");
  window.setTimeout(function () {
    if (element.parentNode) element.parentNode.removeChild(element);
  }, 220);
}

function toast(message, options) {
  options = options || {};
  var root = document.getElementById("toastRoot");
  if (!root) return null;
  var element = document.createElement("div");
  element.className = "toast";
  element.setAttribute("role", "status");
  element.innerHTML = '<span class="toast-icon">' + icon(options.icon || "check") + "</span>" +
    '<div class="toast-body">' + message + "</div>" +
    (options.actionLabel ? '<button class="toast-action" type="button" data-toast-action>' + esc(options.actionLabel) + "</button>" : "") +
    '<button class="toast-close" type="button" data-toast-close aria-label="Dismiss">' + icon("x") + "</button>";
  root.appendChild(element);
  element.querySelector("[data-toast-close]").addEventListener("click", function () { dismissToast(element); });
  var actionButton = element.querySelector("[data-toast-action]");
  if (actionButton) {
    actionButton.addEventListener("click", function () {
      dismissToast(element);
      if (typeof options.onAction === "function") options.onAction();
    });
  }
  var duration = options.duration || (options.actionLabel ? 8000 : 5500);
  window.setTimeout(function () { dismissToast(element); }, duration);
  return element;
}

/* ------------------------------- notifications ----------------------------- */

function closeNotifications() {
  var popover = document.getElementById("notifPopover");
  var button = document.getElementById("notifBtn");
  if (popover) popover.hidden = true;
  if (button) button.setAttribute("aria-expanded", "false");
  ui.notificationsOpen = false;
}

function renderNotificationsPopover() {
  var popover = document.getElementById("notifPopover");
  if (!popover) return;
  var items = notifications();
  popover.innerHTML = '<div class="popover-head"><span class="popover-title">Notifications</span>' +
    (items.length ? '<button class="btn-link" type="button" data-action="notif-read-all">Mark all read</button>' : "") + "</div>" +
    (items.length ? items.map(function (item) {
      return '<a class="notif-item" href="#' + attr(item.route) + '">' +
        '<span class="notif-icon ' + attr(item.tone || "") + '">' + icon(item.icon) + "</span>" +
        "<span><span class=\"notif-title\">" + esc(item.title) + '</span><span class="notif-detail">' + esc(item.detail) + "</span></span></a>";
    }).join("") : '<div class="notif-empty">Nothing needs attention right now.</div>');
}

function openNotifications() {
  renderNotificationsPopover();
  var popover = document.getElementById("notifPopover");
  var button = document.getElementById("notifBtn");
  if (!popover) return;
  popover.hidden = false;
  if (button) button.setAttribute("aria-expanded", "true");
  ui.notificationsOpen = true;
}

function toggleNotifications() {
  if (ui.notificationsOpen) closeNotifications();
  else openNotifications();
}

/* ------------------------------- command palette --------------------------- */

function paletteMatch(text, query) {
  return !query || String(text || "").toLowerCase().indexOf(query) !== -1;
}

function buildPaletteGroups(query) {
  query = String(query || "").trim().toLowerCase();
  var groups = [];
  var navigation = [];
  NAV_SECTIONS.forEach(function (section) {
    section.tabs.forEach(function (tab) {
      var title = tab.route === section.route ? section.label : section.label + " · " + tab.label;
      var sub = tab.route === section.route ? "Section" : "Tab · " + section.label;
      if (paletteMatch(title + " " + sub + " " + tab.route, query)) {
        navigation.push({ title: title, sub: sub, icon: section.icon, href: "#" + tab.route });
      }
    });
  });
  if (navigation.length) groups.push({ label: "Navigate", items: navigation });

  var actions = [
    { title: "Add subscription", sub: "Open the new subscription form", icon: "plus", action: "open-add-sub" },
    { title: "Create a savings goal", sub: "Open the goal form", icon: "target", action: "open-goal" },
    { title: "Find a free alternative", sub: "Open the alternative finder", icon: "sliders", href: "#/discover/finder" },
    { title: "Model a switch", sub: "Open the savings calculator", icon: "calculator", href: "#/savings/calculator" },
    { title: "Export workspace", sub: "Download this demo workspace as JSON", icon: "download", action: "export-workspace" },
    { title: "Reset demo workspace", sub: "Restore the sample data", icon: "rotate", action: "reset-workspace" }
  ].filter(function (item) { return paletteMatch(item.title + " " + item.sub, query); });
  if (actions.length) groups.push({ label: "Actions", items: actions });

  var toolList = query ? TOOLS.filter(function (tool) { return toolMatches(tool, query); }) :
    freeTools().slice().sort(function (a, b) { return (b.match || 0) - (a.match || 0); });
  toolList = toolList.slice(0, 6).map(function (tool) {
    return {
      title: tool.name,
      sub: tool.category + " · " + (tool.free ? "Free" : money(tool.price) + "/mo"),
      icon: "tool",
      action: "open-tool",
      id: tool.id
    };
  });
  if (toolList.length) groups.push({ label: query ? "Tools" : "Popular tools", items: toolList });
  return groups;
}

function renderPalette() {
  var list = document.querySelector("#paletteRoot .palette-list");
  if (!list) return;
  paletteState.groups = buildPaletteGroups(paletteState.query);
  paletteState.items = [];
  var html = "";
  paletteState.groups.forEach(function (group) {
    html += '<div class="palette-group-label">' + esc(group.label) + "</div>";
    group.items.forEach(function (item) {
      var index = paletteState.items.length;
      paletteState.items.push(item);
      html += '<button type="button" class="palette-item' + (index === paletteState.active ? " active" : "") +
        '" data-palette-index="' + index + '">' + icon(item.icon || "arrow-right") +
        '<span class="palette-item-main"><span class="palette-item-title">' + esc(item.title) + "</span>" +
        '<span class="palette-item-sub">' + esc(item.sub || "") + "</span></span></button>";
    });
  });
  list.innerHTML = html || '<div class="palette-empty">No matches for “' + esc(paletteState.query) + '”.</div>';
  if (paletteState.active >= paletteState.items.length) {
    paletteState.active = Math.max(0, paletteState.items.length - 1);
  }
  var active = list.querySelector(".palette-item.active");
  if (active) active.scrollIntoView({ block: "nearest" });
}

function activatePalette(index) {
  var item = paletteState.items[index];
  if (!item) return;
  closePalette();
  if (item.href) {
    navigate(item.href.replace(/^#/, ""));
  } else if (item.action) {
    runAction(item.action, { dataset: item.id ? { id: item.id } : {} });
  }
}

function closePalette() {
  var root = document.getElementById("paletteRoot");
  if (!root) return;
  var hadContent = !!root.firstElementChild;
  root.innerHTML = "";
  syncOverlayState();
  if (hadContent) restoreFocus();
}

function openPalette() {
  closeModal();
  closeDrawer();
  rememberFocus();
  paletteState.query = "";
  paletteState.active = 0;
  var root = document.getElementById("paletteRoot");
  root.innerHTML = '<div class="palette-backdrop">' +
    '<div class="palette" role="dialog" aria-modal="true" aria-label="Search or jump to">' +
      '<div class="palette-input-row">' + icon("search") +
        '<input class="palette-search" type="text" placeholder="Search sections, actions or tools…" aria-label="Search Alt." autocomplete="off">' +
        "<kbd>esc</kbd></div>" +
      '<div class="palette-list" role="listbox" aria-label="Results"></div>' +
      '<div class="palette-foot"><span><kbd>↑</kbd><kbd>↓</kbd> navigate</span><span><kbd>↵</kbd> open</span><span><kbd>⌘K</kbd> toggle</span></div>' +
    "</div></div>";
  syncOverlayState();
  var backdrop = root.querySelector(".palette-backdrop");
  var input = root.querySelector(".palette-search");
  backdrop.addEventListener("mousedown", function (event) {
    if (event.target === backdrop) closePalette();
  });
  input.addEventListener("input", function () {
    paletteState.query = input.value;
    paletteState.active = 0;
    renderPalette();
  });
  backdrop.addEventListener("keydown", function (event) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      paletteState.active = Math.min(paletteState.active + 1, Math.max(0, paletteState.items.length - 1));
      renderPalette();
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      paletteState.active = Math.max(0, paletteState.active - 1);
      renderPalette();
    } else if (event.key === "Enter") {
      event.preventDefault();
      activatePalette(paletteState.active);
    } else if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      closePalette();
    }
  });
  root.querySelector(".palette-list").addEventListener("click", function (event) {
    var item = event.target.closest("[data-palette-index]");
    if (item) activatePalette(Number(item.getAttribute("data-palette-index")));
  });
  renderPalette();
  input.focus();
}

/* --------------------------------- exports --------------------------------- */

function csvCell(value) {
  var text = value == null ? "" : String(value);
  if (/[",\r\n]/.test(text)) return '"' + text.replace(/"/g, '""') + '"';
  return text;
}

function csvText(rows) {
  return rows.map(function (row) { return row.map(csvCell).join(","); }).join("\r\n");
}

function downloadFile(filename, content, mime) {
  var blob = new Blob([content], { type: mime || "text/plain;charset=utf-8" });
  var url = URL.createObjectURL(blob);
  var link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(function () { URL.revokeObjectURL(url); }, 1200);
}

function exportSubscriptions() {
  var rows = [["Software", "Vendor", "Category", "Plan", "Status", "Monthly (INR)", "Renewal", "Usage score", "Last used"]];
  state.subscriptions.forEach(function (sub) {
    rows.push([
      sub.name, sub.vendor, sub.category, sub.plan, usageLabel(sub),
      Number(sub.cost || 0).toFixed(2), sub.renewal, sub.usageScore, sub.lastUsed
    ]);
  });
  downloadFile("alt-subscriptions-" + isoDate(new Date()) + ".csv", csvText(rows), "text/csv;charset=utf-8");
  toast("Subscription CSV downloaded. Values are sample data.", { icon: "download" });
}

function exportHistory() {
  var rows = [["Type", "From", "To", "Category", "Monthly saving (INR)", "Date"]];
  savingsEvents().forEach(function (event) {
    rows.push([
      event.type === "cancellation" ? "Cancellation (demo)" : "Switch",
      event.from, event.to, event.category, Number(event.monthlySaving || 0).toFixed(2), event.date
    ]);
  });
  downloadFile("alt-history-" + isoDate(new Date()) + ".csv", csvText(rows), "text/csv;charset=utf-8");
  toast("Savings history CSV downloaded.", { icon: "download" });
}

function exportUsage() {
  var rows = [["Software", "Category", "Plan", "Weekly hours", "Sessions 30d", "Usage score", "Monthly (INR)"]];
  activeSubs().forEach(function (sub) {
    rows.push([sub.name, sub.category, sub.plan, sub.weeklyHours, sub.sessions30, sub.usageScore, Number(sub.cost || 0).toFixed(2)]);
  });
  downloadFile("alt-usage-" + isoDate(new Date()) + ".csv", csvText(rows), "text/csv;charset=utf-8");
  toast("Usage CSV downloaded. All values are sample data.", { icon: "download" });
}

function summaryMonthData() {
  var months = lastNMonths(6);
  var selected = months.filter(function (month) { return month.key === ui.summaryMonth; })[0] || months[months.length - 1];
  var parts = selected.key.split("-").map(Number);
  var monthEnd = selected.current ? new Date() : new Date(parts[0], parts[1], 0, 12, 0, 0);
  var events = savingsEvents().filter(function (event) { return parseDate(event.date) <= monthEnd; });
  return {
    month: selected,
    accrual: monthAccrual(parts[0], parts[1] - 1),
    events: events,
    monthEnd: monthEnd
  };
}

function exportSummary() {
  var data = summaryMonthData();
  var rows = [
    ["Alt. demo monthly summary"],
    ["Month", data.month.longLabel],
    ["Saved in month (INR)", data.accrual.toFixed(2)],
    ["Recurring monthly rate (INR)", savingsRate().toFixed(2)],
    ["Annual goal progress (%)", annualGoal() ? String(goalProgress(annualGoal())) : "0"],
    ["Source", "Local demo workspace · sample data"],
    [],
    ["Date", "Type", "From", "To", "Category", "Monthly saving (INR)"]
  ];
  data.events.forEach(function (event) {
    rows.push([
      event.date,
      event.type === "cancellation" ? "Cancellation (demo)" : "Switch",
      event.from, event.to, event.category, Number(event.monthlySaving || 0).toFixed(2)
    ]);
  });
  downloadFile("alt-summary-" + data.month.key + ".csv", csvText(rows), "text/csv;charset=utf-8");
  toast("Monthly summary downloaded for " + esc(data.month.longLabel) + ".", { icon: "download" });
}

/* --------------------------------- drawers --------------------------------- */

function openToolDrawer(id) {
  var tool = toolById(id);
  if (!tool) {
    toast("That tool is not in the sample catalogue.", { icon: "info", tone: "warn" });
    return;
  }
  var compareHref = discoverCompareHref(tool);
  var simHref = discoverSimHref(tool);
  var capabilities = (tool.capabilities || []).map(function (cap) {
    return '<span class="cap-chip covered">' + icon("check") + esc(CAPABILITY_LABELS[cap] || cap) + "</span>";
  }).join("");
  var body = '<div class="detail-grid">' +
    detailCell("Monthly price", tool.free ? "Free" : money(tool.price)) +
    detailCell("Category", esc(tool.category)) +
    detailCell("Learning curve", esc(tool.learning || "—")) +
    detailCell("Hardware needs", esc(tool.hardware || "—")) +
    detailCell("Match score", tool.free ? (tool.match || 0) + "%" : "Paid reference") +
    detailCell("Best for", esc(tool.bestFor || "—")) +
    "</div>" +
    '<div class="drawer-section"><div class="drawer-section-title">Overview</div><p>' + esc(tool.desc) + "</p>" +
    (tool.replaces ? '<div class="tool-replaces mt-16">' + icon("repeat") + "Replaces " + esc(tool.replaces) + "</div>" : "") + "</div>" +
    (capabilities ? '<div class="drawer-section"><div class="drawer-section-title">Capabilities</div><div class="cap-chips">' + capabilities + "</div></div>" : "") +
    ((tool.features || []).length ? '<div class="drawer-section"><div class="drawer-section-title">Included features</div>' + featureLines(tool.features) + "</div>" : "") +
    (tool.free && tool.saves ? '<div class="modal-callout accent mt-16"><strong>Sample saving:</strong> ' + moneyCompact(tool.saves) + "/mo versus " + esc(tool.replaces || "the paid tool") + ".</div>" : "") +
    '<div class="source-note">' + icon("info") + " Catalogue data is illustrative. Pricing and capabilities are not live.</div>";
  openDrawer({
    title: tool.name,
    subtitle: esc(tool.category) + " · " + (tool.free ? "Free alternative" : "Paid reference"),
    headMain: logoHtml(tool, "logo-lg"),
    body: body,
    footer: '<a class="btn btn-secondary btn-sm" href="' + attr(compareHref) + '">' + icon("grid") + "Compare features</a>" +
      (tool.free ? '<a class="btn btn-primary btn-sm" href="' + attr(simHref) + '">' + icon("play") + "Simulate switch</a>" :
        '<a class="btn btn-primary btn-sm" href="' + attr(simHref) + '">' + icon("compass") + "Find an alternative</a>") +
      '<button class="btn btn-ghost btn-sm" type="button" data-action="close-drawer">Close</button>'
  });
}

function openSubscriptionDrawer(id) {
  var sub = subById(id);
  if (!sub) {
    toast("That subscription is no longer in this demo workspace.", { icon: "info", tone: "warn" });
    return;
  }
  var alt = sub.altToolId ? toolById(sub.altToolId) : null;
  var compareUrl = "#/discover/compare?a=" + encodeURIComponent(sub.altToolId || "") + "&b=" + encodeURIComponent(sub.id);
  var snoozed = isSnoozed(sub);
  var body = '<div class="detail-grid">' +
    detailCell("Monthly cost", money(sub.cost)) +
    detailCell("Status", statusBadge(sub)) +
    detailCell("Category", esc(sub.category)) +
    detailCell("Plan", esc(sub.plan)) +
    detailCell("Renews", sub.status === "cancelled" ? "—" : esc(fmtDate(sub.renewal)) + " · " + esc(renewalLabel(sub.renewal))) +
    detailCell("Billing cycle", esc(sub.cycle || "Monthly")) +
    detailCell("Started", esc(fmtDate(sub.started))) +
    detailCell("Last used", esc(relDate(sub.lastUsed))) +
    "</div>" +
    '<div class="drawer-section"><div class="drawer-section-title">Usage evidence</div><div class="detail-grid">' +
      detailCell("Usage score", esc(sub.usageScore) + "%") +
      detailCell("Sessions · 30 days", esc(sub.sessions30)) +
      detailCell("Weekly hours", esc(sub.weeklyHours) + " h") +
      detailCell("Recoverable", money(sub.potentialSaving) + "/mo") +
    "</div></div>" +
    (alt ? '<div class="drawer-section"><div class="drawer-section-title">Mapped free alternative</div>' +
      '<div class="renewal-item"><span class="logo logo-sm" style="--logo-color:' + attr(alt.color) + '">' + esc(alt.initials) + "</span>" +
      '<div class="renewal-main"><div class="renewal-name">' + esc(alt.name) + '</div><div class="renewal-date">' + esc(alt.category) + " · " + (alt.price ? money(alt.price) + "/mo" : "Free") + "</div></div>" +
      '<a class="btn btn-ghost btn-sm" href="' + attr(compareUrl) + '">Compare</a></div></div>' : "") +
    ((sub.planFeatures || []).length ? '<div class="drawer-section"><div class="drawer-section-title">Current plan includes</div>' + featureLines(sub.planFeatures) + "</div>" : "") +
    ((sub.loseOnFree || []).length ? '<div class="drawer-section"><div class="drawer-section-title">What you give up</div>' + featureLines(sub.loseOnFree, true) + "</div>" : "") +
    '<div class="modal-callout mt-16">' + icon("shield-check") + " Sample data only. Nothing here is connected to " + esc(sub.vendor || "a provider") + ".</div>";
  var footer = '<button class="btn btn-secondary btn-sm" type="button" data-action="close-drawer">Close</button>' +
    '<a class="btn btn-ghost btn-sm" href="#/savings/calculator?sub=' + encodeURIComponent(sub.id) + '">' + icon("calculator") + "Model saving</a>";
  if (sub.status === "active") {
    footer += snoozed ?
      '<button class="btn btn-ghost btn-sm" type="button" data-action="unsnooze-sub" data-id="' + attr(sub.id) + '">' + icon("clock") + "Unsnooze</button>" :
      '<button class="btn btn-ghost btn-sm" type="button" data-action="snooze-sub" data-id="' + attr(sub.id) + '">' + icon("clock") + "Snooze 30d</button>";
    footer += '<button class="btn btn-danger btn-sm" type="button" data-action="open-cancel" data-id="' + attr(sub.id) + '">' + icon("x") + "Cancel in demo</button>";
  } else {
    footer += '<button class="btn btn-secondary btn-sm" type="button" data-action="restore-cancel" data-id="' + attr(sub.id) + '">' + icon("rotate") + "Restore in demo</button>";
  }
  openDrawer({
    title: sub.name,
    subtitle: esc(sub.vendor) + " · " + esc(sub.plan),
    headMain: logoHtml(sub, "logo-lg"),
    body: body,
    footer: footer
  });
}

/* ---------------------------------- modals --------------------------------- */

function openWasteMethod() {
  openModal({
    title: "How the waste detector works",
    subtitle: "One transparent rule, applied to sample data.",
    body: '<div class="modal-list">' +
      '<div class="modal-list-item"><span>Usage score</span><strong>Below 40</strong></div>' +
      '<div class="modal-list-item"><span>Potential saving</span><strong>Above ₹0</strong></div>' +
      '<div class="modal-list-item"><span>Snoozed subscriptions</span><strong>Excluded until expiry</strong></div>' +
      '<div class="modal-list-item"><span>Live monitoring</span><strong>Not connected</strong></div>' +
      "</div>" +
      '<p class="mt-16">The recoverable amount is the sample monthly cost of each flagged subscription. It is an estimate of money you could stop spending — not a refund or a bank transaction.</p>' +
      '<div class="modal-callout warn mt-16"><strong>Low usage is a signal, not proof of waste.</strong> Seasonal tools and shared team accounts can look idle. Check the last-used date and ask anyone who shares the account before cancelling.</div>' +
      '<div class="source-note">' + icon("info") + " A production build would need explicit, revocable integrations to measure real usage.</div>",
    footer: '<button class="btn btn-secondary" type="button" data-action="close-modal">Close</button>'
  });
}

function openAddSubscription() {
  var categoryOptions = CATEGORIES.map(function (category) {
    return '<option value="' + attr(category.id) + '">' + esc(category.id) + "</option>";
  }).join("");
  var altOptions = ['<option value="">No mapped alternative</option>'].concat(workflowsSortedTools(freeTools()).map(function (tool) {
    return '<option value="' + attr(tool.id) + '">' + esc(tool.name) + " · Free</option>";
  })).join("");
  var body = '<form data-form="add-sub" novalidate>' +
    '<div class="form-grid">' +
      '<div class="field" data-field="name"><label class="label" for="addSubName">Software name <span class="req">*</span></label>' +
        '<input class="input" id="addSubName" name="name" placeholder="e.g. Figma Professional" autocomplete="off"><div class="field-error"></div></div>' +
      '<div class="field" data-field="vendor"><label class="label" for="addSubVendor">Vendor</label>' +
        '<input class="input" id="addSubVendor" name="vendor" placeholder="e.g. Figma" autocomplete="organization"></div>' +
      '<div class="field" data-field="category"><label class="label" for="addSubCategory">Category</label>' +
        '<select class="select" id="addSubCategory" name="category">' + categoryOptions + "</select></div>" +
      '<div class="field" data-field="plan"><label class="label" for="addSubPlan">Plan</label>' +
        '<input class="input" id="addSubPlan" name="plan" value="Professional" autocomplete="off"></div>' +
      '<div class="field" data-field="cost"><label class="label" for="addSubCost">Monthly cost <span class="req">*</span></label>' +
        '<div class="input-affix"><span class="affix">₹</span><input class="input" id="addSubCost" name="cost" type="number" min="0" step="0.01" inputmode="decimal" placeholder="0.00"></div>' +
        '<div class="field-error"></div></div>' +
      '<div class="field" data-field="cycle"><label class="label" for="addSubCycle">Billing cycle</label>' +
        '<select class="select" id="addSubCycle" name="cycle"><option>Monthly</option><option>Annual</option></select></div>' +
      '<div class="field" data-field="renewal"><label class="label" for="addSubRenewal">Next renewal <span class="req">*</span></label>' +
        '<input class="input" id="addSubRenewal" name="renewal" type="date" value="' + attr(isoDate(new Date(Date.now() + 30 * 86400000))) + '"><div class="field-error"></div></div>' +
      '<div class="field" data-field="lastUsed"><label class="label" for="addSubLastUsed">Last used</label>' +
        '<input class="input" id="addSubLastUsed" name="lastUsed" type="date" value="' + attr(isoDate(new Date())) + '"></div>' +
      '<div class="field" data-field="usageScore"><label class="label" for="addSubUsage">Usage score · 0–100</label>' +
        '<input class="input" id="addSubUsage" name="usageScore" type="number" min="0" max="100" step="1" value="50"></div>' +
      '<div class="field" data-field="sessions30"><label class="label" for="addSubSessions">Sessions · 30 days</label>' +
        '<input class="input" id="addSubSessions" name="sessions30" type="number" min="0" step="1" value="0"></div>' +
      '<div class="field" data-field="weeklyHours"><label class="label" for="addSubHours">Weekly hours</label>' +
        '<input class="input" id="addSubHours" name="weeklyHours" type="number" min="0" step="0.1" value="0"></div>' +
      '<div class="field" data-field="altToolId" style="grid-column:1/-1"><label class="label" for="addSubAlt">Mapped free alternative</label>' +
        '<select class="select" id="addSubAlt" name="altToolId">' + altOptions + "</select>" +
        '<div class="field-hint">Used for compare links, the savings calculator and waste checks.</div></div>' +
    "</div>" +
    '<div class="modal-callout mt-16">This only adds a record to the local demo workspace. No provider is connected and no payment is made.</div>' +
    '<div class="form-actions"><button class="btn btn-ghost" type="button" data-action="close-modal">Cancel</button>' +
      '<button class="btn btn-primary" type="submit">' + icon("plus") + "Add subscription</button></div>" +
  "</form>";
  openModal({
    title: "Add a subscription",
    subtitle: "A sample record for this demo workspace.",
    size: "lg",
    body: body,
    initialFocus: "#addSubName"
  });
}

function openGoalModal(goal, defaults) {
  defaults = defaults || {};
  var editing = !!goal;
  var name = editing ? goal.name : (defaults.name || "");
  var target = editing ? goal.target : (defaults.target || "");
  var deadline = editing ? goal.deadline : (defaults.deadline || isoDate(new Date(Date.now() + 365 * 86400000)));
  var note = editing ? goal.note : (defaults.note || "");
  var body = '<form data-form="goal" data-mode="' + (editing ? "edit" : "create") + '"' +
    (editing ? ' data-goal-id="' + attr(goal.id) + '"' : "") + " novalidate>" +
    '<div class="form-grid">' +
      '<div class="field" data-field="name" style="grid-column:1/-1"><label class="label" for="goalName">Goal name <span class="req">*</span></label>' +
        '<input class="input" id="goalName" name="name" value="' + attr(name) + '" placeholder="e.g. Annual software savings"><div class="field-error"></div></div>' +
      '<div class="field" data-field="target"><label class="label" for="goalTarget">Target amount <span class="req">*</span></label>' +
        '<div class="input-affix"><span class="affix">₹</span><input class="input" id="goalTarget" name="target" type="number" min="1" step="1" inputmode="decimal" value="' + attr(target) + '"></div><div class="field-error"></div></div>' +
      '<div class="field" data-field="deadline"><label class="label" for="goalDeadline">Review date</label>' +
        '<input class="input" id="goalDeadline" name="deadline" type="date" value="' + attr(deadline) + '"></div>' +
      '<div class="field" data-field="note" style="grid-column:1/-1"><label class="label" for="goalNote">Note</label>' +
        '<input class="input" id="goalNote" name="note" value="' + attr(note || "") + '" placeholder="What is this saving for?"></div>' +
    "</div>" +
    (editing && goal.auto ? '<div class="modal-callout accent mt-16"><strong>Automatic goal.</strong> Progress follows the savings recorded in this workspace. You can change the target, but manual funding is disabled.</div>' :
      '<div class="modal-callout mt-16">Manual goals start at zero. Add funds as you put money aside.</div>') +
    '<div class="form-actions"><button class="btn btn-ghost" type="button" data-action="close-modal">Cancel</button>' +
      '<button class="btn btn-primary" type="submit">' + icon("target") + (editing ? "Save goal" : "Create goal") + "</button></div>" +
  "</form>";
  openModal({
    title: editing ? "Edit savings goal" : "Create a savings goal",
    subtitle: "Goals stay in this browser's demo workspace.",
    body: body,
    initialFocus: "#goalName"
  });
}

function openFundModal(goalId) {
  var goal = goalById(goalId);
  if (!goal || goal.auto) {
    toast("Automatic goals are funded by recorded savings, not manual contributions.", { icon: "info" });
    return;
  }
  var current = goalCurrent(goal);
  var remaining = Math.max(0, goal.target - current);
  var body = '<form data-form="fund" data-goal-id="' + attr(goal.id) + '" novalidate>' +
    '<div class="result-stats">' +
      '<div class="result-stat"><span>Saved</span><strong>' + money0(current) + "</strong></div>" +
      '<div class="result-stat"><span>Remaining</span><strong>' + money0(remaining) + "</strong></div>" +
    "</div>" +
    '<div class="field mt-16" data-field="amount"><label class="label" for="fundAmount">Amount to add <span class="req">*</span></label>' +
      '<div class="input-affix"><span class="affix">₹</span><input class="input" id="fundAmount" name="amount" type="number" min="1" step="1" inputmode="decimal" placeholder="0"></div>' +
      '<div class="field-error"></div></div>' +
    '<div class="modal-callout mt-16">A manual contribution in this demo. No bank account or payment provider is involved.</div>' +
    '<div class="form-actions"><button class="btn btn-ghost" type="button" data-action="close-modal">Cancel</button>' +
      '<button class="btn btn-primary" type="submit">' + icon("plus") + "Add funds</button></div>" +
  "</form>";
  openModal({
    title: "Add funds to " + goal.name,
    subtitle: "A local demo contribution.",
    body: body,
    initialFocus: "#fundAmount"
  });
}

function openEmailSummary() {
  var data = summaryMonthData();
  var subject = "Your Alt. savings summary — " + data.month.longLabel;
  var message = "Saved in " + data.month.longLabel + ": " + money0(data.accrual) + ".\n" +
    "Recurring monthly rate: " + money0(savingsRate()) + ".\n" +
    "Actions contributing: " + data.events.length + ".\n\n" +
    "This is a preview generated from the local demo workspace. No email is sent.";
  var body = '<form data-form="summary-email" novalidate>' +
    '<div class="field" data-field="email"><label class="label" for="summaryEmailTo">To <span class="req">*</span></label>' +
      '<input class="input" id="summaryEmailTo" name="email" type="email" value="' + attr(state.preferences.email || "") + '" autocomplete="email"><div class="field-error"></div></div>' +
    '<div class="field"><label class="label" for="summarySubject">Subject</label>' +
      '<input class="input" id="summarySubject" name="subject" value="' + attr(subject) + '"></div>' +
    '<div class="field"><label class="label" for="summaryBody">Preview</label>' +
      '<textarea class="textarea" id="summaryBody" name="body" rows="7">' + esc(message) + "</textarea></div>" +
    '<div class="modal-callout warn mt-16"><strong>Preview only.</strong> Email delivery is not implemented. Submitting this form does not send anything.</div>' +
    '<div class="form-actions"><button class="btn btn-ghost" type="button" data-action="close-modal">Cancel</button>' +
      '<button class="btn btn-primary" type="submit">' + icon("mail") + "Preview email</button></div>" +
  "</form>";
  openModal({
    title: "Email summary preview",
    subtitle: "Preview capability · not connected",
    body: body,
    initialFocus: "#summaryEmailTo"
  });
}

function openHelpResource(id) {
  var resource = HELP_RESOURCES[id] || HELP_RESOURCES.export;
  openModal({
    title: resource.title,
    subtitle: "Static sample resource",
    body: resource.body + '<div class="modal-callout warn mt-16"><strong>Preview resource.</strong> This is static sample content. No support request or download is generated.</div>',
    footer: '<button class="btn btn-secondary" type="button" data-action="close-modal">Close</button>'
  });
}

function openIntegrationPreview(id) {
  var preview = INTEGRATION_PREVIEWS[id] || INTEGRATION_PREVIEWS.workspace;
  openModal({
    title: preview.title,
    subtitle: "Preview capability · not connected",
    body: preview.body + '<div class="modal-callout accent mt-16"><strong>Preview only.</strong> There is nothing to connect and no credentials are requested.</div>',
    footer: '<button class="btn btn-secondary" type="button" data-action="close-modal">Close</button>'
  });
}

function openAddWorkflowStep() {
  var body = '<form data-form="workflow" novalidate>' +
    '<div class="form-grid">' +
      '<div class="field" data-field="task" style="grid-column:1/-1"><label class="label" for="wfTask">Task <span class="req">*</span></label>' +
        '<input class="input" id="wfTask" name="task" placeholder="e.g. Weekly newsletter"><div class="field-error"></div></div>' +
      '<div class="field" data-field="currentTool"><label class="label" for="wfCurrent">Current tool <span class="req">*</span></label>' +
        '<input class="input" id="wfCurrent" name="currentTool" list="paidToolNames" placeholder="e.g. Adobe Premiere Pro"><div class="field-error"></div></div>' +
      '<div class="field" data-field="currentCost"><label class="label" for="wfCurrentCost">Current monthly cost</label>' +
        '<div class="input-affix"><span class="affix">₹</span><input class="input" id="wfCurrentCost" name="currentCost" type="number" min="0" step="0.01" value="0"></div></div>' +
      '<div class="field" data-field="alternative"><label class="label" for="wfAlternative">Free alternative <span class="req">*</span></label>' +
        '<input class="input" id="wfAlternative" name="alternative" list="freeToolNames" placeholder="e.g. DaVinci Resolve"><div class="field-error"></div></div>' +
      '<div class="field" data-field="alternativeCost"><label class="label" for="wfAltCost">Alternative monthly cost</label>' +
        '<div class="input-affix"><span class="affix">₹</span><input class="input" id="wfAltCost" name="alternativeCost" type="number" min="0" step="0.01" value="0"></div></div>' +
      '<div class="field" data-field="note" style="grid-column:1/-1"><label class="label" for="wfNote">Note</label>' +
        '<input class="input" id="wfNote" name="note" placeholder="What does this step cover?"></div>' +
    "</div>" +
    '<datalist id="paidToolNames">' + workflowsSortedTools(paidTools()).map(function (tool) { return '<option value="' + attr(tool.name) + '"></option>'; }).join("") + "</datalist>" +
    '<datalist id="freeToolNames">' + workflowsSortedTools(freeTools()).map(function (tool) { return '<option value="' + attr(tool.name) + '"></option>'; }).join("") + "</datalist>" +
    '<div class="modal-callout mt-16">Adding a step only changes this demo workflow. No software is purchased or connected.</div>' +
    '<div class="form-actions"><button class="btn btn-ghost" type="button" data-action="close-modal">Cancel</button>' +
      '<button class="btn btn-primary" type="submit">' + icon("plus") + "Add step</button></div>" +
  "</form>";
  openModal({
    title: "Add a workflow step",
    subtitle: "Map one recurring task to a cheaper tool.",
    size: "lg",
    body: body,
    initialFocus: "#wfTask"
  });
}

/* --------------------------------- actions --------------------------------- */

function toggleSidebar(force) {
  ui.sidebarOpen = typeof force === "boolean" ? force : !ui.sidebarOpen;
  renderSidebar();
  if (ui.sidebarOpen) {
    var first = document.querySelector("#sidebar .side-link");
    if (first) first.focus();
  } else if (window.innerWidth <= 1024) {
    var menuButton = document.getElementById("menuBtn");
    if (menuButton) menuButton.focus();
  }
}

function performCancel(sub) {
  if (!sub || sub.status !== "active") return;
  var record = {
    id: uid("can"),
    name: sub.name,
    category: sub.category,
    monthlySaving: Number(sub.cost) || 0,
    date: isoDate(new Date()),
    subscriptionId: sub.id
  };
  sub.status = "cancelled";
  state.cancellations.push(record);
  recordActivity("cancellation", "Cancelled " + sub.name, "Saving " + money(record.monthlySaving) + "/mo · demo only");
  var activityId = state.activity[0] ? state.activity[0].id : null;
  saveState();
  refreshRoute();
  toast("<strong>" + esc(sub.name) + "</strong> is marked cancelled in this demo. No provider was contacted.", {
    icon: "x",
    actionLabel: "Undo",
    onAction: function () {
      var current = subById(sub.id);
      if (current) current.status = "active";
      state.cancellations = state.cancellations.filter(function (item) { return item.id !== record.id; });
      if (activityId) state.activity = state.activity.filter(function (item) { return item.id !== activityId; });
      saveState();
      refreshRoute();
      toast("Cancellation undone. " + esc(sub.name) + " is active again.", { icon: "rotate" });
    }
  });
}

function restoreCancellation(id) {
  var sub = subById(id);
  if (!sub) {
    toast("That subscription is no longer in this demo workspace.", { icon: "info", tone: "warn" });
    return;
  }
  if (sub.status === "active") {
    toast("That subscription is already active in this demo.", { icon: "info" });
    return;
  }
  sub.status = "active";
  state.cancellations = state.cancellations.filter(function (item) { return item.subscriptionId !== sub.id; });
  recordActivity("cancellation", "Restored " + sub.name, "Cancellation undone · demo only");
  saveState();
  closeDrawer();
  refreshRoute();
  toast(esc(sub.name) + " restored in this demo. No provider was contacted.", { icon: "rotate" });
}

function openCancelConfirm(sub) {
  if (!sub) return;
  if (sub.status !== "active") {
    toast("That subscription is already cancelled in this demo.", { icon: "info" });
    return;
  }
  var alt = sub.altToolId ? toolById(sub.altToolId) : null;
  confirmDialog({
    title: "Mark " + sub.name + " as cancelled?",
    subtitle: "Demo action · no real provider is contacted",
    danger: true,
    confirmLabel: "Mark cancelled in demo",
    cancelLabel: "Keep subscription",
    body: '<div class="modal-callout danger"><strong>This does not cancel anything.</strong> Alt. has no connection to ' +
      esc(sub.vendor || sub.name) + ". The subscription is only marked cancelled in this browser workspace.</div>" +
      '<div class="modal-list mt-16">' +
        '<div class="modal-list-item"><span>Monthly saving recorded</span><strong>' + money(sub.cost) + "/mo</strong></div>" +
        '<div class="modal-list-item"><span>Recorded in history</span><strong>Yes, locally</strong></div>' +
        '<div class="modal-list-item"><span>Real billing changes</span><strong>None</strong></div>' +
      "</div>" +
      (alt ? '<div class="modal-callout accent mt-16">Mapped free alternative: <strong>' + esc(alt.name) + "</strong>. Trial it before cancelling for real.</div>" : "") +
      '<div class="field-hint mt-16">You can undo this from the confirmation toast.</div>',
    onConfirm: function () { performCancel(sub); }
  });
}

function snoozeSub(id) {
  var sub = subById(id);
  if (!sub) return;
  var until = isoDate(new Date(Date.now() + 30 * 86400000));
  sub.snoozedUntil = until;
  recordActivity("snooze", "Snoozed " + sub.name, "Waste alerts paused until " + fmtDate(until));
  var activityId = state.activity[0] ? state.activity[0].id : null;
  saveState();
  refreshRoute();
  toast(esc(sub.name) + " snoozed for 30 days. Waste alerts are paused.", {
    icon: "clock",
    actionLabel: "Undo",
    onAction: function () {
      var current = subById(id);
      if (current) current.snoozedUntil = null;
      if (activityId) state.activity = state.activity.filter(function (item) { return item.id !== activityId; });
      saveState();
      refreshRoute();
      toast("Snooze removed.", { icon: "rotate" });
    }
  });
}

function unsnoozeSub(id) {
  var sub = subById(id);
  if (!sub) return;
  sub.snoozedUntil = null;
  saveState();
  refreshRoute();
  toast("Snooze removed. " + esc(sub.name) + " is back in waste checks.", { icon: "rotate" });
}

function deleteGoal(id) {
  var goal = goalById(id);
  if (!goal || goal.auto) return;
  var index = state.goals.indexOf(goal);
  confirmDialog({
    title: "Delete “" + goal.name + "”?",
    subtitle: "This removes a manual goal from the demo workspace.",
    danger: true,
    confirmLabel: "Delete goal",
    body: '<p>The goal and its manual contributions will be removed from this browser. Automatic savings goals are not affected.</p>',
    onConfirm: function () {
      state.goals.splice(index, 1);
      recordActivity("goal", "Deleted goal", goal.name + " · manual goal removed");
      var activityId = state.activity[0] ? state.activity[0].id : null;
      saveState();
      refreshRoute();
      toast("Goal deleted.", {
        icon: "trash",
        actionLabel: "Undo",
        onAction: function () {
          state.goals.splice(index, 0, goal);
          if (activityId) state.activity = state.activity.filter(function (item) { return item.id !== activityId; });
          saveState();
          refreshRoute();
          toast("Goal restored.", { icon: "rotate" });
        }
      });
    }
  });
}

function resetCalculator() {
  ui.calc = { subId: "", current: 1675.6, alt: 0, seats: 1, months: 12, preset: null };
  refreshRoute();
}

function resetFinder() {
  ui.finder = { step: 1, category: null, constraints: [], loading: false, results: null };
  refreshRoute();
}

function startFinderResults() {
  if (!ui.finder.constraints) ui.finder.constraints = [];
  ui.finder.step = 3;
  ui.finder.loading = true;
  ui.finder.results = null;
  refreshRoute();
  var category = ui.finder.category;
  var constraints = ui.finder.constraints.slice();
  window.setTimeout(function () {
    ui.finder.loading = false;
    ui.finder.results = discoverFinderResults(category, constraints);
    if (ui.route && ui.route.section === "discover" && ui.route.tab === "finder" && ui.finder.step === 3) {
      refreshRoute();
    }
  }, 560);
}

function startNeedsResults() {
  if (!ui.needs.selected.length) {
    toast("Select at least one work need first.", { icon: "info" });
    return;
  }
  ui.needs.loading = true;
  ui.needs.built = true;
  ui.needs.results = [];
  refreshRoute();
  var selected = ui.needs.selected.slice();
  window.setTimeout(function () {
    var results = [];
    selected.forEach(function (id) {
      var need = WORK_NEEDS.filter(function (item) { return item.id === id; })[0];
      if (!need) return;
      var toolId = (need.toolIds || []).filter(function (candidate) {
        return freeTools().some(function (tool) { return tool.id === candidate; });
      })[0];
      if (toolId) results.push({ needId: id, toolId: toolId });
    });
    ui.needs.loading = false;
    ui.needs.results = results;
    if (ui.route && ui.route.section === "discover" && ui.route.tab === "needs") refreshRoute();
  }, 520);
}

function sendChatMessage(text) {
  text = String(text || "").trim();
  if (!text) return;
  var target = ui.chat;
  target.messages.push({ role: "user", text: text });
  target.typing = true;
  refreshRoute();
  window.setTimeout(function () {
    if (ui.chat !== target) return;
    target.typing = false;
    var match = assistantMatch(text);
    target.count += 1;
    if (match.category && match.tools.length) {
      target.category = match.category;
      target.recs = match.tools.map(function (tool) { return tool.id; });
      target.completeness = Math.min(96, 65 + target.count * 7);
      if (/student/i.test(text)) target.dna.student = "Student";
      if (/(advanced|professional|pro)\b/i.test(text)) target.dna.skill = "Advanced";
      if (/(free|cheap|budget)/i.test(text)) target.dna.budget = "Max";
      if (/(quick|easy|beginner|simple)/i.test(text)) target.dna.learning = "Low";
      var names = match.tools.map(function (tool) { return tool.name; });
      var readable = names.length === 1 ? names[0] : names.slice(0, -1).join(", ") + " or " + names[names.length - 1];
      target.messages.push({
        role: "bot",
        text: "For " + match.category.toLowerCase() + " work, start with " + readable + ". The catalogue rates them highly against the workflow you described. Trial one on a real project before cancelling anything."
      });
    } else {
      target.recs = null;
      target.messages.push({
        role: "bot",
        text: "I could not map that to a category yet. Mention the work itself — video, design, writing, code, audio, presentations, CRM, communication, projects or notes.",
        chips: ["Edit a video", "Design a landing page", "Build a pitch deck"]
      });
    }
    if (ui.route && ui.route.section === "discover" && ui.route.tab === "assistant") refreshRoute();
  }, 520);
}

function runSimulation() {
  var seats = clamp(Number(ui.sim.seats) || 1, 1, 50);
  var months = clamp(Number(ui.sim.months) || 12, 1, 60);
  var fromId = ui.sim.from;
  var toId = ui.sim.to;
  ui.sim.seats = seats;
  ui.sim.months = months;
  ui.sim.loading = true;
  ui.sim.result = null;
  refreshRoute();
  window.setTimeout(function () {
    if (ui.sim.from !== fromId || ui.sim.to !== toId || Number(ui.sim.months) !== months) return;
    var from = toolById(fromId);
    var to = toolById(toId);
    ui.sim.loading = false;
    if (!from || !to) {
      toast("Choose both tools before running a simulation.", { icon: "info" });
      refreshRoute();
      return;
    }
    var score = continuityScore(fromId, toId);
    var before = (Number(from.price) || 0) * seats;
    var after = (Number(to.price) || 0) * seats;
    var monthlySaving = before - after;
    ui.sim.result = {
      from: fromId,
      to: toId,
      seats: seats,
      months: months,
      before: before,
      after: after,
      monthlySaving: monthlySaving,
      total: monthlySaving * months,
      score: score ? score.score : 0
    };
    if (ui.route && ui.route.section === "workflows" && ui.route.tab === "simulator") refreshRoute();
  }, 620);
}

function saveSimulation() {
  var result = ui.sim.result;
  if (!result) {
    toast("Run the simulation before saving a switch plan.", { icon: "info" });
    return;
  }
  var from = toolById(result.from);
  var to = toolById(result.to);
  state.switchPlan = {
    from: result.from,
    to: result.to,
    seats: result.seats,
    months: result.months,
    monthlySaving: result.monthlySaving,
    total: result.total,
    score: result.score,
    date: isoDate(new Date())
  };
  recordActivity("workflow", "Saved switch plan", (from ? from.name : result.from) + " → " + (to ? to.name : result.to) +
    " · " + money0(result.monthlySaving) + "/mo estimate");
  saveState();
  toast("Switch plan saved locally. No tool was purchased or cancelled.", { icon: "check" });
  navigate("/workflows/help");
}

function suggestCompatibilityPair() {
  var pairs = paidTools().map(function (paid) {
    var free = freeTools().filter(function (tool) { return tool.replaces === paid.name; })[0];
    return free ? { from: paid.id, to: free.id } : null;
  }).filter(Boolean);
  if (!pairs.length) {
    toast("No sample pairs are available.", { icon: "info" });
    return;
  }
  var index = -1;
  pairs.forEach(function (pair, pairIndex) {
    if (pair.from === ui.compat.from && pair.to === ui.compat.to) index = pairIndex;
  });
  var next = pairs[(index + 1) % pairs.length];
  ui.compat.from = next.from;
  ui.compat.to = next.to;
  ui.compat.result = continuityScore(ui.compat.from, ui.compat.to);
  refreshRoute();
  var source = toolById(ui.compat.from);
  var target = toolById(ui.compat.to);
  toast("Suggested pair: " + esc(source.name) + " → " + esc(target.name) + ".", { icon: "sparkles" });
}

function resetWorkspace() {
  confirmDialog({
    title: "Reset the demo workspace?",
    subtitle: "This cannot be undone after the confirmation.",
    danger: true,
    confirmLabel: "Reset workspace",
    body: '<p>This restores the sample subscriptions, goals, workflow, preferences and history. Any changes saved in this browser will be lost.</p>' +
      '<div class="modal-callout danger mt-16"><strong>Local data only.</strong> This demo never stored account or billing data.</div>',
    onConfirm: function () {
      state = D.buildInitialState();
      ui.chartRange = 6;
      ui.subSearch = "";
      ui.subCategory = "All";
      ui.subStatus = "All";
      ui.subSort = "name";
      ui.discoverQuery = "";
      ui.discoverCategory = "All";
      ui.freeOnly = true;
      ui.discoverSort = "match";
      ui.finder = { step: 1, category: null, constraints: [], loading: false, results: null };
      ui.needs = { selected: [], built: false, loading: false, results: [] };
      ui.compare = { a: "adobe-cc", b: "davinci" };
      ui.compareSub = null;
      ui.cancelSub = null;
      ui.sim = { from: "premiere-pro", to: "davinci", seats: 1, months: 12, result: null, loading: false };
      ui.compat = { from: "premiere-pro", to: "davinci", result: null };
      ui.calc = { subId: "", current: 1675.6, alt: 0, seats: 1, months: 12, preset: null };
      ui.summaryMonth = monthKey(new Date());
      ui.chat = makeChatState();
      saveState();
      refreshRoute();
      toast("Demo workspace reset to sample data.", { icon: "rotate" });
    }
  });
}

function runAction(name, source) {
  var data = (source && source.dataset) || {};
  switch (name) {
    case "close-modal": closeModal(); break;
    case "close-drawer": closeDrawer(); break;
    case "toggle-sidebar": toggleSidebar(); break;
    case "notif-read-all":
      state.meta.notificationsRead = true;
      saveState();
      closeNotifications();
      var dot = document.getElementById("notifDot");
      if (dot) dot.hidden = true;
      break;
    case "open-add-sub": openAddSubscription(); break;
    case "open-sub": openSubscriptionDrawer(data.id); break;
    case "open-tool": openToolDrawer(data.id); break;
    case "open-cancel":
      closeDrawer();
      openCancelConfirm(subById(data.id));
      break;
    case "snooze-sub": snoozeSub(data.id); break;
    case "unsnooze-sub": unsnoozeSub(data.id); break;
    case "restore-cancel": restoreCancellation(data.id); break;
    case "open-waste-method": openWasteMethod(); break;
    case "open-goal": openGoalModal(data.id ? goalById(data.id) : null); break;
    case "open-goal-fund": openFundModal(data.id); break;
    case "delete-goal": deleteGoal(data.id); break;
    case "chart-range":
      ui.chartRange = Number(data.range) === 12 ? 12 : 6;
      refreshRoute();
      break;
    case "export-subs":
      if (ui.route && ui.route.section === "subscriptions" && ui.route.tab === "history") exportHistory();
      else exportSubscriptions();
      break;
    case "export-usage": exportUsage(); break;
    case "export-summary": exportSummary(); break;
    case "export-workspace":
      downloadFile("alt-workspace-" + isoDate(new Date()) + ".json", JSON.stringify(state, null, 2), "application/json");
      toast("Workspace JSON downloaded. It contains this browser's demo state.", { icon: "download" });
      break;
    case "email-summary": openEmailSummary(); break;
    case "clear-sub-filters":
      ui.subSearch = "";
      ui.subCategory = "All";
      ui.subStatus = "All";
      ui.subSort = "name";
      refreshRoute();
      break;
    case "calc-preset":
      var preset = savingsPresets().filter(function (item) { return item.id === data.preset; })[0];
      if (preset) {
        ui.calc = { subId: "", current: preset.current, alt: preset.alt, seats: preset.seats, months: preset.months, preset: preset.id };
        refreshRoute();
      }
      break;
    case "calc-reset": resetCalculator(); break;
    case "calc-scenario":
      var presets = savingsPresets();
      var currentIndex = -1;
      presets.forEach(function (item, index) { if (item.id === ui.calc.preset) currentIndex = index; });
      var scenario = presets[(currentIndex + 1) % presets.length];
      ui.calc = { subId: "", current: scenario.current, alt: scenario.alt, seats: scenario.seats, months: scenario.months, preset: scenario.id };
      refreshRoute();
      break;
    case "calc-to-goal":
      var monthly = (Math.max(0, Number(ui.calc.current) || 0) - Math.max(0, Number(ui.calc.alt) || 0)) * (Number(ui.calc.seats) || 1);
      var total = monthly * (Number(ui.calc.months) || 12);
      if (total <= 0) {
        toast("This scenario has no saving to turn into a goal yet.", { icon: "info" });
        break;
      }
      openGoalModal(null, {
        name: "Savings from calculator",
        target: Math.max(1, Math.round(total)),
        note: "Modelled in the savings calculator over " + (Number(ui.calc.months) || 12) + " months."
      });
      break;
    case "discover-category":
      ui.discoverCategory = data.category || "All";
      refreshRoute();
      break;
    case "clear-discover":
      ui.discoverQuery = "";
      ui.discoverCategory = "All";
      ui.freeOnly = true;
      refreshRoute();
      break;
    case "finder-category":
      ui.finder.category = data.category || null;
      refreshRoute();
      break;
    case "finder-next":
      if (ui.finder.step === 1) {
        if (!ui.finder.category) {
          toast("Choose a category to continue.", { icon: "info" });
          break;
        }
        ui.finder.step = 2;
        refreshRoute();
      } else if (ui.finder.step === 2) {
        startFinderResults();
      }
      break;
    case "finder-back":
      ui.finder.loading = false;
      ui.finder.step = Math.max(1, (ui.finder.step || 1) - 1);
      refreshRoute();
      break;
    case "finder-restart": resetFinder(); break;
    case "compare-swap":
      var swap = ui.compare.a;
      ui.compare.a = ui.compare.b;
      ui.compare.b = swap;
      refreshRoute();
      break;
    case "needs-clear":
      ui.needs = { selected: [], built: false, loading: false, results: [] };
      refreshRoute();
      break;
    case "needs-recommend": startNeedsResults(); break;
    case "chat-chip": sendChatMessage(data.text); break;
    case "chat-reset":
      ui.chat = makeChatState();
      refreshRoute();
      toast("Chat reset. No conversation was sent anywhere.", { icon: "rotate" });
      break;
    case "sim-run": runSimulation(); break;
    case "sim-save": saveSimulation(); break;
    case "sim-reset":
      ui.sim = { from: "premiere-pro", to: "davinci", seats: 1, months: 12, result: null, loading: false };
      refreshRoute();
      break;
    case "compat-run":
      ui.compat.result = continuityScore(ui.compat.from, ui.compat.to);
      if (!ui.compat.result) toast("Choose two catalogue tools to score.", { icon: "info" });
      refreshRoute();
      break;
    case "compat-suggest":
    case "compat-swap":
      suggestCompatibilityPair();
      break;
    case "wf-add": openAddWorkflowStep(); break;
    case "wf-apply":
      if (!workflowsSaving()) {
        toast("There is no estimated saving in the enabled steps yet.", { icon: "info" });
        break;
      }
      recordActivity("workflow", "Applied rebuild plan", money0(workflowsSaving()) + "/mo across " + workflowsEnabled().length + " steps · plan only");
      saveState();
      refreshRoute();
      toast("<strong>Rebuild plan recorded.</strong> No tools were switched or billed.", { icon: "check" });
      break;
    case "wf-reset":
      state.workflow.forEach(function (item) { item.enabled = true; });
      saveState();
      refreshRoute();
      toast("All workflow steps included again.", { icon: "rotate" });
      break;
    case "help-reset":
      state.checklist = {};
      saveState();
      refreshRoute();
      toast("Switching checklist reset.", { icon: "rotate" });
      break;
    case "help-resource": openHelpResource(data.id); break;
    case "integration-preview": openIntegrationPreview(data.id); break;
    case "reset-workspace": resetWorkspace(); break;
    default:
      toast("That action is not available in this demo.", { icon: "info" });
  }
}

/* --------------------------------- changes --------------------------------- */

function paintChecklist() {
  var steps = helpSteps();
  var done = steps.filter(function (step) { return state.checklist && state.checklist[step.id]; }).length;
  var pct = percent(done, steps.length);
  document.querySelectorAll("[data-help-bar]").forEach(function (bar) { bar.style.width = pct + "%"; });
  document.querySelectorAll("[data-help-done]").forEach(function (text) { text.textContent = done + " of " + steps.length + " steps complete"; });
  document.querySelectorAll("[data-help-pct]").forEach(function (text) { text.textContent = pct + "%"; });
  document.querySelectorAll("[data-help-steps]").forEach(function (text) { text.textContent = done + " / " + steps.length; });
}

function syncSimSeats() {
  var result = ui.sim.result;
  if (!result) return;
  var from = toolById(result.from);
  var to = toolById(result.to);
  if (!from || !to) return;
  var seats = clamp(Number(ui.sim.seats) || 1, 1, 50);
  var before = (Number(from.price) || 0) * seats;
  var after = (Number(to.price) || 0) * seats;
  var monthlySaving = before - after;
  result.seats = seats;
  result.before = before;
  result.after = after;
  result.monthlySaving = monthlySaving;
  result.total = monthlySaving * result.months;
  var root = document.querySelector(".sim-result");
  if (root) root.outerHTML = simResultHtml();
}

function handleChange(type, element) {
  switch (type) {
    case "sub-category":
      ui.subCategory = element.value || "All";
      refreshRoute();
      break;
    case "sub-status":
      ui.subStatus = element.value || "All";
      refreshRoute();
      break;
    case "sub-sort":
      ui.subSort = element.value || "name";
      refreshRoute();
      break;
    case "compare-sub":
      ui.compareSub = element.value || null;
      refreshRoute();
      break;
    case "cancel-sub":
      ui.cancelSub = element.value || null;
      refreshRoute();
      break;
    case "calc-sub":
      ui.calc.subId = element.value || "";
      if (ui.calc.subId) {
        var sub = subById(ui.calc.subId);
        if (sub) {
          ui.calc.current = sub.cost;
          var alt = sub.altToolId ? toolById(sub.altToolId) : null;
          ui.calc.alt = alt ? alt.price || 0 : 0;
          ui.calc.seats = 1;
        }
      } else {
        ui.calc.alt = 0;
      }
      ui.calc.preset = null;
      refreshRoute();
      break;
    case "calc-months":
      ui.calc.months = clamp(Number(element.value) || 12, 1, 60);
      ui.calc.preset = null;
      refreshRoute();
      break;
    case "summary-month":
      ui.summaryMonth = element.value;
      refreshRoute();
      break;
    case "discover-free":
      ui.freeOnly = element.checked;
      refreshRoute();
      break;
    case "discover-sort":
      ui.discoverSort = element.value || "match";
      refreshRoute();
      break;
    case "compare-a":
      ui.compare.a = element.value;
      refreshRoute();
      break;
    case "compare-b":
      ui.compare.b = element.value;
      refreshRoute();
      break;
    case "finder-constraint":
      var constraint = element.getAttribute("data-id");
      if (element.checked) {
        if (ui.finder.constraints.indexOf(constraint) === -1) ui.finder.constraints.push(constraint);
      } else {
        ui.finder.constraints = ui.finder.constraints.filter(function (id) { return id !== constraint; });
      }
      refreshRoute();
      break;
    case "needs-toggle":
      var need = element.getAttribute("data-id");
      if (element.checked) {
        if (ui.needs.selected.indexOf(need) === -1) ui.needs.selected.push(need);
      } else {
        ui.needs.selected = ui.needs.selected.filter(function (id) { return id !== need; });
      }
      ui.needs.built = false;
      ui.needs.results = [];
      refreshRoute();
      break;
    case "sim-from":
      ui.sim.from = element.value;
      ui.sim.result = null;
      ui.sim.loading = false;
      refreshRoute();
      break;
    case "sim-to":
      ui.sim.to = element.value;
      ui.sim.result = null;
      ui.sim.loading = false;
      refreshRoute();
      break;
    case "sim-months":
      ui.sim.months = clamp(Number(element.value) || 12, 1, 60);
      ui.sim.result = null;
      ui.sim.loading = false;
      refreshRoute();
      break;
    case "compat-from":
      ui.compat.from = element.value;
      ui.compat.result = null;
      refreshRoute();
      break;
    case "compat-to":
      ui.compat.to = element.value;
      ui.compat.result = null;
      refreshRoute();
      break;
    case "wf-toggle":
      var row = state.workflow.filter(function (item) { return item.id === element.getAttribute("data-id"); })[0];
      if (row) {
        row.enabled = element.checked;
        saveState();
        refreshRoute();
      }
      break;
    case "help-check":
      if (!state.checklist) state.checklist = {};
      var stepId = element.getAttribute("data-id");
      state.checklist[stepId] = element.checked;
      var label = element.closest(".check-row");
      if (label) label.classList.toggle("done", element.checked);
      saveState();
      paintChecklist();
      if (helpSteps().every(function (step) { return state.checklist[step.id]; })) {
        toast("Every switching step is complete. Cancel only after a successful trial.", { icon: "check-circle" });
      }
      break;
    case "pref-toggle":
      state.preferences[element.getAttribute("data-key")] = element.checked;
      saveState();
      break;
    default:
      break;
  }
}

/* ----------------------------------- live ---------------------------------- */

function paintCalculator() {
  var totalEl = document.querySelector("[data-calc-total]");
  if (!totalEl) return;
  var current = Math.max(0, Number(ui.calc.current) || 0);
  var alt = Math.max(0, Number(ui.calc.alt) || 0);
  var seats = clamp(Number(ui.calc.seats) || 1, 1, 100);
  var months = clamp(Number(ui.calc.months) || 12, 1, 60);
  var monthly = (current - alt) * seats;
  var total = monthly * months;
  var currentTotal = current * seats;
  var altTotal = alt * seats;
  var maxBar = Math.max(currentTotal, altTotal, 1);

  totalEl.textContent = money0(total);
  var monthlyEl = document.querySelector("[data-calc-monthly]");
  if (monthlyEl) monthlyEl.textContent = money0(monthly);
  var monthsEl = document.querySelector("[data-calc-months]");
  if (monthsEl) monthsEl.textContent = months;
  var noteEl = document.querySelector("[data-calc-note]");
  if (noteEl) {
    noteEl.textContent = monthly >= 0 ?
      "Based on " + money0(currentTotal) + " now vs " + money0(altTotal) + " after the change." :
      "This combination costs more each month. Adjust the alternative or seats.";
  }
  var statMonthly = document.querySelector('[data-calc-stat="monthly"]');
  if (statMonthly) {
    statMonthly.textContent = money0(monthly);
    statMonthly.classList.toggle("text-accent", monthly >= 0);
    statMonthly.classList.toggle("text-amber", monthly < 0);
  }
  var statPerSeat = document.querySelector('[data-calc-stat="perSeat"]');
  if (statPerSeat) statPerSeat.textContent = money0(current - alt);
  var statYear = document.querySelector('[data-calc-stat="oneYear"]');
  if (statYear) statYear.textContent = money0(monthly * 12);
  var labelCurrent = document.querySelector('[data-calc-label="current"]');
  if (labelCurrent) labelCurrent.textContent = money0(currentTotal) + "/mo";
  var labelAlt = document.querySelector('[data-calc-label="alt"]');
  if (labelAlt) labelAlt.textContent = money0(altTotal) + "/mo";
  var barCurrent = document.querySelector('[data-calc-bar="current"]');
  if (barCurrent) barCurrent.style.width = clamp((currentTotal / maxBar) * 100, 2, 100) + "%";
  var barAlt = document.querySelector('[data-calc-bar="alt"]');
  if (barAlt) barAlt.style.width = clamp((altTotal / maxBar) * 100, altTotal ? 2 : 0, 100) + "%";
  if (ui.calc.preset) {
    ui.calc.preset = null;
    document.querySelectorAll(".preset-card.active").forEach(function (card) { card.classList.remove("active"); });
  }
}

function refreshWithFocus(element) {
  pendingFocus = {
    key: element.getAttribute("data-live"),
    start: typeof element.selectionStart === "number" ? element.selectionStart : null,
    end: typeof element.selectionEnd === "number" ? element.selectionEnd : null
  };
  refreshRoute();
}

function handleLive(type, element) {
  switch (type) {
    case "sub-search":
      ui.subSearch = element.value;
      refreshWithFocus(element);
      break;
    case "discover-query":
      ui.discoverQuery = element.value;
      refreshWithFocus(element);
      break;
    case "calc-current":
      ui.calc.current = Math.max(0, parseFloat(element.value) || 0);
      ui.calc.preset = null;
      paintCalculator();
      break;
    case "calc-alt":
      ui.calc.alt = Math.max(0, parseFloat(element.value) || 0);
      ui.calc.preset = null;
      paintCalculator();
      break;
    case "calc-seats":
      ui.calc.seats = clamp(parseInt(element.value, 10) || 1, 1, 100);
      ui.calc.preset = null;
      paintCalculator();
      break;
    case "sim-seats":
      ui.sim.seats = clamp(parseInt(element.value, 10) || 1, 1, 50);
      syncSimSeats();
      break;
    default:
      break;
  }
}

/* ---------------------------------- forms ---------------------------------- */

function handleFormSubmit(form) {
  var type = form.getAttribute("data-form");
  clearFormErrors(form);

  if (type === "chat") {
    var message = formField(form, "message");
    var text = message ? message.value : "";
    if (!String(text || "").trim()) {
      if (message) message.focus();
      return;
    }
    if (message) message.value = "";
    sendChatMessage(text);
    return;
  }

  if (type === "profile") {
    var name = fieldValue(form, "name");
    var email = fieldValue(form, "email");
    var valid = true;
    if (!name) { setFieldError(form, "name", "Enter your name."); valid = false; }
    if (!validEmail(email)) { setFieldError(form, "email", "Enter a valid email address."); valid = false; }
    if (!valid) { focusFirstError(form); return; }
    state.preferences.name = name;
    state.preferences.email = email;
    state.preferences.role = fieldValue(form, "role") || state.preferences.role;
    saveState();
    renderSidebar();
    toast("Profile saved locally. Nothing was sent to a server.", { icon: "check" });
    return;
  }

  if (type === "add-sub") {
    var subName = fieldValue(form, "name");
    var cost = fieldNumber(form, "cost", NaN);
    var renewal = fieldValue(form, "renewal");
    var validSub = true;
    if (!subName) { setFieldError(form, "name", "Enter the software name."); validSub = false; }
    if (isNaN(cost) || cost < 0) { setFieldError(form, "cost", "Enter a monthly cost of zero or more."); validSub = false; }
    if (!renewal || isNaN(new Date(renewal + "T12:00:00").getTime())) { setFieldError(form, "renewal", "Choose the next renewal date."); validSub = false; }
    if (!validSub) { focusFirstError(form); return; }
    var category = fieldValue(form, "category") || CATEGORIES[0].id;
    var plan = fieldValue(form, "plan") || "Professional";
    var altToolId = fieldValue(form, "altToolId");
    var altTool = altToolId ? toolById(altToolId) : null;
    var usageScore = clamp(Math.round(fieldNumber(form, "usageScore", 50)), 0, 100);
    var sessions = Math.max(0, Math.round(fieldNumber(form, "sessions30", 0)));
    var hours = Math.max(0, fieldNumber(form, "weeklyHours", 0));
    var newSub = {
      id: uid("sub"),
      name: subName,
      vendor: fieldValue(form, "vendor") || subName,
      category: category,
      plan: plan,
      cost: cost,
      cycle: fieldValue(form, "cycle") || "Monthly",
      renewal: renewal,
      started: isoDate(new Date()),
      lastUsed: fieldValue(form, "lastUsed") || isoDate(new Date()),
      sessions30: sessions,
      usageScore: usageScore,
      weeklyHours: hours,
      status: "active",
      potentialSaving: altTool ? Math.max(0, cost - (Number(altTool.price) || 0)) : 0,
      altToolId: altTool ? altTool.id : "",
      altLabel: altTool ? altTool.name : "",
      initials: initialsFor(subName),
      color: CATEGORY_COLORS[category] || "#3D5F8A",
      planFeatures: [plan + " plan", "Sample plan added in this workspace"],
      loseOnFree: altTool ? ["Capabilities not covered by the free plan"] : []
    };
    state.subscriptions.push(newSub);
    recordActivity("subscription", "Added " + subName, money(cost) + "/mo · " + category);
    saveState();
    closeModal();
    refreshRoute();
    toast("<strong>" + esc(subName) + "</strong> added to this demo workspace.", { icon: "plus" });
    return;
  }

  if (type === "goal") {
    var goalName = fieldValue(form, "name");
    var target = fieldNumber(form, "target", NaN);
    var validGoal = true;
    if (!goalName) { setFieldError(form, "name", "Give the goal a name."); validGoal = false; }
    if (isNaN(target) || target <= 0) { setFieldError(form, "target", "Enter a target above zero."); validGoal = false; }
    if (!validGoal) { focusFirstError(form); return; }
    var goalId = form.getAttribute("data-goal-id");
    var goal = goalId ? goalById(goalId) : null;
    var deadline = fieldValue(form, "deadline") || isoDate(new Date(Date.now() + 365 * 86400000));
    var note = fieldValue(form, "note");
    if (goal) {
      goal.name = goalName;
      goal.target = target;
      goal.deadline = deadline;
      goal.note = note;
      recordActivity("goal", "Updated goal", goalName + " · target " + money0(target));
    } else {
      state.goals.push({
        id: uid("goal"),
        name: goalName,
        target: target,
        saved: 0,
        auto: false,
        deadline: deadline,
        color: ["#2F6D54", "#3D5F8A", "#6A4F7A", "#8A5A14"][state.goals.length % 4],
        note: note
      });
      recordActivity("goal", "Created goal", goalName + " · target " + money0(target));
    }
    saveState();
    closeModal();
    refreshRoute();
    toast("Goal saved in this demo workspace.", { icon: "target" });
    return;
  }

  if (type === "fund") {
    var goalId2 = form.getAttribute("data-goal-id");
    var fundGoal = goalId2 ? goalById(goalId2) : null;
    var amount = fieldNumber(form, "amount", NaN);
    if (!fundGoal || fundGoal.auto) {
      toast("This goal cannot be funded manually.", { icon: "info" });
      return;
    }
    if (isNaN(amount) || amount <= 0) {
      setFieldError(form, "amount", "Enter an amount above zero.");
      focusFirstError(form);
      return;
    }
    fundGoal.saved = (Number(fundGoal.saved) || 0) + amount;
    recordActivity("goal", "Added funds to " + fundGoal.name, money0(amount) + " · demo contribution");
    saveState();
    closeModal();
    refreshRoute();
    toast(money0(amount) + " added to " + esc(fundGoal.name) + " in this demo.", { icon: "plus" });
    return;
  }

  if (type === "workflow") {
    var task = fieldValue(form, "task");
    var currentTool = fieldValue(form, "currentTool");
    var alternative = fieldValue(form, "alternative");
    var validWorkflow = true;
    if (!task) { setFieldError(form, "task", "Describe the task."); validWorkflow = false; }
    if (!currentTool) { setFieldError(form, "currentTool", "Name the tool you use today."); validWorkflow = false; }
    if (!alternative) { setFieldError(form, "alternative", "Choose a cheaper alternative."); validWorkflow = false; }
    if (!validWorkflow) { focusFirstError(form); return; }
    var altTool2 = TOOLS.filter(function (tool) { return tool.name.toLowerCase() === alternative.toLowerCase(); })[0];
    state.workflow.push({
      id: uid("wf"),
      task: task,
      currentTool: currentTool,
      currentCost: Math.max(0, fieldNumber(form, "currentCost", 0)),
      alternative: alternative,
      alternativeCost: altTool2 ? Number(altTool2.price) || 0 : Math.max(0, fieldNumber(form, "alternativeCost", 0)),
      enabled: true,
      note: fieldValue(form, "note")
    });
    recordActivity("workflow", "Added workflow step", task + " · " + currentTool + " → " + alternative);
    saveState();
    closeModal();
    refreshRoute();
    toast("Workflow step added. Toggle it to see the rebuild cost.", { icon: "workflow" });
    return;
  }

  if (type === "summary-email") {
    var to = fieldValue(form, "email");
    if (!validEmail(to)) {
      setFieldError(form, "email", "Enter a valid email address.");
      focusFirstError(form);
      return;
    }
    closeModal();
    toast("<strong>Preview only.</strong> No email was sent to " + esc(to) + ". Delivery is not implemented.", { icon: "mail" });
    return;
  }
}

/* ------------------------------- page lifecycle ---------------------------- */

function afterPageRender() {
  if (pendingFocus) {
    var target = Array.prototype.slice.call(document.querySelectorAll("[data-live]")).filter(function (element) {
      return element.getAttribute("data-live") === pendingFocus.key;
    })[0];
    if (target) {
      try {
        target.focus({ preventScroll: true });
        if (pendingFocus.start !== null && typeof target.setSelectionRange === "function") {
          target.setSelectionRange(pendingFocus.start, pendingFocus.end === null ? pendingFocus.start : pendingFocus.end);
        }
      } catch (error) {
        target.focus();
      }
    }
    pendingFocus = null;
  }
  if (pendingChangeFocus) {
    var changed = Array.prototype.slice.call(document.querySelectorAll("[data-change]")).filter(function (element) {
      if (element.getAttribute("data-change") !== pendingChangeFocus.change) return false;
      if (pendingChangeFocus.id && element.getAttribute("data-id") !== pendingChangeFocus.id) return false;
      if (pendingChangeFocus.key && element.getAttribute("data-key") !== pendingChangeFocus.key) return false;
      return true;
    })[0];
    if (changed) {
      try { changed.focus({ preventScroll: true }); } catch (error) { changed.focus(); }
    }
    pendingChangeFocus = null;
  }
  var chat = document.querySelector(".chat-messages");
  if (chat) chat.scrollTop = chat.scrollHeight;
}

/* ---------------------------------- wiring --------------------------------- */

function onDocumentClick(event) {
  var actionElement = event.target.closest("[data-action]");
  if (actionElement) {
    event.preventDefault();
    runAction(actionElement.getAttribute("data-action"), actionElement);
    return;
  }

  if (ui.notificationsOpen && !event.target.closest(".popover-wrap")) closeNotifications();

  var link = event.target.closest("a[href]");
  if (link) {
    var href = link.getAttribute("href") || "";
    if (href.indexOf("#/") === 0) {
      closeNotifications();
      closeDrawer();
      closeModal();
      if (href === location.hash) {
        event.preventDefault();
        render();
      }
    }
  }
}

function onDocumentChange(event) {
  var element = event.target.closest("[data-change]");
  if (!element) return;
  pendingChangeFocus = {
    change: element.getAttribute("data-change"),
    id: element.getAttribute("data-id"),
    key: element.getAttribute("data-key")
  };
  handleChange(element.getAttribute("data-change"), element);
  pendingChangeFocus = null;
}

function onDocumentInput(event) {
  var element = event.target.closest("[data-live]");
  if (!element) return;
  var field = element.closest(".field");
  if (field && field.classList.contains("has-error")) {
    field.classList.remove("has-error");
    var error = field.querySelector(".field-error");
    if (error) error.textContent = "";
  }
  handleLive(element.getAttribute("data-live"), element);
}

function onDocumentSubmit(event) {
  var form = event.target.closest("[data-form]");
  if (!form) return;
  event.preventDefault();
  handleFormSubmit(form);
}

function onKeyDown(event) {
  if ((event.metaKey || event.ctrlKey) && String(event.key).toLowerCase() === "k") {
    event.preventDefault();
    if (document.querySelector(".palette-backdrop")) closePalette();
    else openPalette();
    return;
  }
  if (event.key === "Escape") {
    if (document.querySelector(".palette-backdrop")) { closePalette(); return; }
    if (document.querySelector(".modal-backdrop")) { closeModal(); return; }
    if (document.querySelector(".drawer-backdrop")) { closeDrawer(); return; }
    if (ui.notificationsOpen) { closeNotifications(); return; }
    if (ui.sidebarOpen) { toggleSidebar(false); return; }
  }
  if (event.key === "Tab") {
    var layer = activeLayer();
    if (layer) trapTab(event, layer);
  }
}

function initApp() {
  if (!location.hash) {
    try { history.replaceState(null, "", "#/overview"); } catch (error) { location.hash = "/overview"; }
  }
  render();
  document.addEventListener("click", onDocumentClick);
  document.addEventListener("change", onDocumentChange);
  document.addEventListener("input", onDocumentInput);
  document.addEventListener("submit", onDocumentSubmit);
  document.addEventListener("keydown", onKeyDown);
  window.addEventListener("hashchange", function () {
    closeModal();
    closeDrawer();
    closeNotifications();
    render();
    var view = document.getElementById("view");
    if (view) {
      try { view.focus({ preventScroll: true }); } catch (error) { view.focus(); }
    }
  });
  var commandButton = document.getElementById("commandBtn");
  if (commandButton) commandButton.addEventListener("click", openPalette);
  var notifButton = document.getElementById("notifBtn");
  if (notifButton) {
    notifButton.addEventListener("click", function (event) {
      event.stopPropagation();
      toggleNotifications();
    });
  }
  var menuButton = document.getElementById("menuBtn");
  if (menuButton) menuButton.addEventListener("click", function () { toggleSidebar(); });
  var scrim = document.getElementById("mobileScrim");
  if (scrim) scrim.addEventListener("click", function () { toggleSidebar(false); });
  var skipLink = document.querySelector(".skip-link");
  if (skipLink) {
    skipLink.addEventListener("click", function (event) {
      event.preventDefault();
      var view = document.getElementById("view");
      if (view) view.focus();
    });
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initApp);
} else {
  initApp();
}

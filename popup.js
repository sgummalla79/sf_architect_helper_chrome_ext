// ============================================================
// Popup UI Logic
// ============================================================

const $ = (sel) => document.querySelector(sel);

// ---- Toast ----
let toastTimer;
function showToast(type, msg) {
  const toast = $("#toast");
  const colors = { ok: ["#0a2e1f", "#3dd68c"], error: ["#2e0f12", "#f05e6b"], info: ["#0d1f3c", "#4f8ff7"] };
  const [bg, color] = colors[type] || colors.info;
  toast.style.background = bg;
  toast.style.color = color;
  toast.textContent = msg;
  toast.style.display = "block";
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { toast.style.display = "none"; }, 3000);
}

// ---- Send message to background ----
function sendMsg(payload) {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage(payload, (resp) => resolve(resp));
  });
}

// ---- Theme ----
function applyTheme(isLight) {
  document.documentElement.classList.toggle("light", isLight);
  $("#btnTheme").textContent = isLight ? "🌕" : "🌙";
}

$("#btnTheme").addEventListener("click", async () => {
  const isLight = !document.documentElement.classList.contains("light");
  applyTheme(isLight);
  await sendMsg({ action: "saveConfig", config: { scheduledTime: $("#scheduledTime").value, isActive: $("#btnToggle").classList.contains("active"), theme: isLight ? "light" : "dark" } });
});

// ---- Toggle ----
function applyToggleState(isActive) {
  const btn = $("#btnToggle");
  if (isActive) {
    btn.textContent = "● Active";
    btn.className = "btn btn-toggle active";
  } else {
    btn.textContent = "○ Inactive";
    btn.className = "btn btn-toggle inactive";
  }
}

$("#btnToggle").addEventListener("click", async () => {
  const isActive = $("#btnToggle").classList.contains("inactive");
  applyToggleState(isActive);
  const config = { scheduledTime: $("#scheduledTime").value, isActive };
  await sendMsg({ action: "saveConfig", config });
  showToast("info", isActive ? "Updates activated." : "Updates deactivated — SOQL will still run.");
});

// ---- Tabs ----
document.querySelectorAll(".tab-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".tab-btn").forEach((b) => b.classList.remove("active"));
    document.querySelectorAll(".tab-panel").forEach((p) => p.classList.remove("active"));
    btn.classList.add("active");
    document.getElementById(`tab-${btn.dataset.tab}`).classList.add("active");
    if (btn.dataset.tab === "engagements") loadEngagements();
    if (btn.dataset.tab === "logs") loadLogs();
  });
});

// ---- Session User ----
async function loadSessionUser() {
  const resp = await sendMsg({ action: "getSession" });
  const el = $("#sessionUser");
  if (resp?.hasSession && resp.userName) {
    el.textContent = 'Connected as : ' + resp.userName;
    el.classList.remove("no-session");
  } else {
    el.textContent = "Not signed in";
    el.classList.add("no-session");
  }
}

// ---- Engagements ----
async function loadEngagements(force = false) {
  const list = $("#engList");
  if (force) list.innerHTML = '<div class="eng-loading">Loading engagements…</div>';

  const [resp, schedResp] = await Promise.all([
    sendMsg({ action: "getEngagements", force }),
    sendMsg({ action: "getScheduledCalls" }),
  ]);
  const scheduledCalls = schedResp?.scheduledCalls || {};

  if (!resp?.hasSession) {
    list.innerHTML = '<div class="empty-msg">No Engagements</div>';
    return;
  }
  if (!resp.success) {
    list.innerHTML = `<div class="empty-msg">Error: ${escHtml(resp.error || "Unknown error")}</div>`;
    return;
  }
  if (!resp.records.length) {
    list.innerHTML = '<div class="empty-msg">No Engagements</div>';
    return;
  }

  const { nameField, titleField, statusField, stageField } = resp.view;
  const durations = resp.durations?.length ? resp.durations : ["30s","1m","5m","15m","30m","45m","1h"];
  const scheduledStatus = resp.scheduledStatus || "";
  const buttons = resp.buttons || [];

  const monthNames = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const monthOpts = monthNames.map((m, i) => `<option value="${i+1}">${m}</option>`).join("");
  const dayOpts   = Array.from({length:31}, (_, i) => `<option value="${i+1}">${i+1}</option>`).join("");
  const nowYear   = new Date().getFullYear();
  const yearOpts  = [nowYear, nowYear+1].map(y => `<option value="${y}">${y}</option>`).join("");

  const phoneIconDefault = `<svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" style="vertical-align:middle;margin-right:3px"><path d="M6.6 10.8c1.4 2.8 3.8 5.1 6.6 6.6l2.2-2.2c.27-.27.68-.35 1.04-.2 1.1.4 2.3.6 3.6.6.55 0 1 .45 1 1V20c0 .55-.45 1-1 1C9.61 21 3 14.39 3 6c0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.3.2 2.5.6 3.6.14.36.06.77-.2 1.04L6.6 10.8z"/></svg>`;
  const phoneIconComplete = `<svg width="12" height="12" viewBox="0 0 24 24" fill="white" style="transform:rotate(135deg);vertical-align:middle;margin-right:3px"><path d="M6.6 10.8c1.4 2.8 3.8 5.1 6.6 6.6l2.2-2.2c.27-.27.68-.35 1.04-.2 1.1.4 2.3.6 3.6.6.55 0 1 .45 1 1V20c0 .55-.45 1-1 1C9.61 21 3 14.39 3 6c0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.3.2 2.5.6 3.6.14.36.06.77-.2 1.04L6.6 10.8z"/></svg>`;
  const clockIcon = `<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M15 1H9v2h6V1zm-4 13h2V8h-2v6zm8.03-6.61 1.42-1.42c-.43-.51-.9-.99-1.41-1.41l-1.42 1.42C16.07 4.74 14.12 4 12 4c-4.97 0-9 4.03-9 9s4.02 9 9 9 9-4.03 9-9c0-2.12-.74-4.07-1.97-5.61zM12 20c-3.87 0-7-3.13-7-7s3.13-7 7-7 7 3.13 7 7-3.13 7-7 7z"/></svg>`;
  const opts = durations.map(d => `<option value="${d}">${d}</option>`).join("");

  list.innerHTML = resp.records.map((r) => {
    const name        = escHtml(r[nameField]   || "—");
    const title       = escHtml(r[titleField]  || "—");
    const status      = escHtml(r[statusField] || "—");
    const stage       = escHtml(r[stageField]  || "—");
    const currentStatus = r[statusField] || "";
    const titlePart   = nameField !== titleField ? ` — <span class="eng-title">${title}</span>` : "";
    const isScheduled = currentStatus === scheduledStatus;

    const activeButtons = buttons.filter(b => {
      if (b.showWhen === "always")     return true;
      if (b.showWhen === "scheduled")  return isScheduled;
      if (b.showWhen === "default")    return !isScheduled;
      return b.showWhen === currentStatus;
    });
    const line3Buttons = activeButtons.filter(b => b.id !== "setToWorking" && b.id !== "setToWaiting");
    const hasDuration = line3Buttons.some(b => b.hasDurationPicker);

    // Status toggle buttons in title row (icon-only, tooltip on hover)
    // Running person — Set To Working (In Progress)
    const runningIcon = `<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M13.5 5.5c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zM9.8 8.9L7 23h2.1l1.8-8 2.1 2v6h2v-7.5l-2.1-2 .6-3C14.8 12 16.8 13 19 13v-2c-1.9 0-3.5-1-4.3-2.4l-1-1.6c-.4-.6-1-1-1.7-1-.3 0-.5.1-.8.1L6 8.3V13h2V9.6l1.8-.7z"/></svg>`;
    // Idle/stale person — Set To Waiting On Customer
    const idleIcon = `<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="4" r="2"/><path d="M10 22v-6H8v-6c0-1.1.9-2 2-2h4c1.1 0 2 .9 2 2v6h-2v6h-4z"/></svg>`;
    const setToWorkingBtn = currentStatus === "Waiting on Customer"
      ? `<button class="btn-set-working" data-button-id="setToWorking" title="Set To Working">${runningIcon}</button>`
      : "";
    const setToWaitingBtn = currentStatus === "In Progress"
      ? `<button class="btn-set-working" data-button-id="setToWaiting" title="Set To Waiting On Customer">${idleIcon}</button>`
      : "";

    // Title-row schedule section
    const schedCall = scheduledCalls[r.Id];
    const scheduleSection = schedCall
      ? `<span class="scheduled-pill">${clockIcon} ${escHtml(formatScheduledTime(schedCall.scheduledAt))} · ${escHtml(schedCall.duration)} <button class="btn-cancel-scheduled" title="Cancel scheduled call">×</button></span>`
      : `<button class="btn-schedule" title="Schedule a call">${clockIcon}</button>
         <button class="btn-schedule-save" title="Save" style="display:none">✓</button>
         <button class="btn-schedule-discard" title="Discard" style="display:none">✕</button>`;

    const scheduledLabel  = isScheduled ? `<span class="eng-scheduled-label">✓ Scheduled</span>` : "";
    const durationSelect  = hasDuration ? `<select class="eng-duration">${opts}</select>` : "";
    const buttonsHtml = line3Buttons.map(b => {
      const isComplete = b.showWhen === "scheduled";
      const icon = isComplete ? phoneIconComplete : phoneIconDefault;
      return `<button class="btn-action${isComplete ? " btn-action-complete" : ""}" data-button-id="${escHtml(b.id)}">${icon}${escHtml(b.label)}</button>`;
    }).join("");

    return `<div class="eng-card${isScheduled ? " scheduled" : ""}" data-id="${r.Id}">
      <div class="eng-line1">
        <span class="eng-name-group">
          <span class="eng-name-text">${name}${titlePart}</span>
          ${setToWorkingBtn}${setToWaitingBtn}
        </span>
        ${scheduleSection}
      </div>
      <div class="eng-line2">
        <span class="eng-badge stage">${stage}</span>
        <span class="eng-badge status">${status}</span>
      </div>
      <div class="eng-schedule-form">
        <select class="schedule-month">${monthOpts}</select>
        <select class="schedule-day">${dayOpts}</select>
        <select class="schedule-year">${yearOpts}</select>
        <input type="time" class="schedule-time" />
        <select class="eng-duration schedule-duration">${opts}</select>
      </div>
      <div class="eng-line3">${scheduledLabel}${durationSelect}${buttonsHtml}</div>
    </div>`;
  }).join("");

  // Clock icon → toggle inline schedule form
  list.querySelectorAll(".btn-schedule").forEach(btn => {
    btn.addEventListener("click", () => {
      const card = btn.closest(".eng-card");
      const form = card.querySelector(".eng-schedule-form");
      const now = new Date();
      const p = n => String(n).padStart(2, "0");
      form.querySelector(".schedule-month").value = String(now.getMonth() + 1);
      form.querySelector(".schedule-day").value   = String(now.getDate());
      form.querySelector(".schedule-year").value  = String(now.getFullYear());
      form.querySelector(".schedule-time").value  = `${p(now.getHours())}:${p(now.getMinutes())}`;
      form.classList.toggle("open");
      const isOpen = form.classList.contains("open");
      btn.style.display = isOpen ? "none" : "";
      card.querySelector(".btn-schedule-save").style.display    = isOpen ? "" : "none";
      card.querySelector(".btn-schedule-discard").style.display = isOpen ? "" : "none";
      card.querySelector(".eng-line3").style.display            = isOpen ? "none" : "";
      if (isOpen) card.scrollIntoView({ block: "nearest", behavior: "instant" });
    });
  });

  // Schedule form — Save
  list.querySelectorAll(".btn-schedule-save").forEach(btn => {
    btn.addEventListener("click", async () => {
      const card = btn.closest(".eng-card");
      const recordId = card.dataset.id;
      const month    = card.querySelector(".schedule-month").value.padStart(2, "0");
      const day      = card.querySelector(".schedule-day").value.padStart(2, "0");
      const year     = card.querySelector(".schedule-year").value;
      const timeVal  = card.querySelector(".schedule-time").value;
      const duration = card.querySelector(".schedule-duration").value;
      if (!timeVal) { showToast("error", "Please pick a time."); return; }
      const scheduledAt = new Date(`${year}-${month}-${day}T${timeVal}`).getTime();
      if (scheduledAt <= Date.now()) { showToast("error", "Scheduled time must be in the future."); return; }
      card.querySelectorAll(".btn-schedule-save, .btn-schedule-discard").forEach(el => { el.disabled = true; });
      const resp = await sendMsg({ action: "scheduleCall", recordId, scheduledAt, duration });
      if (resp?.success) {
        loadEngagements(true);
      } else {
        showToast("error", resp?.error || "Failed to schedule call.");
        card.querySelectorAll(".btn-schedule-save, .btn-schedule-discard").forEach(el => { el.disabled = false; });
      }
    });
  });

  // Schedule form — Discard
  list.querySelectorAll(".btn-schedule-discard").forEach(btn => {
    btn.addEventListener("click", () => {
      const card = btn.closest(".eng-card");
      card.querySelector(".eng-schedule-form").classList.remove("open");
      btn.style.display = "none";
      card.querySelector(".btn-schedule-save").style.display = "none";
      card.querySelector(".btn-schedule").style.display = "";
      card.querySelector(".eng-line3").style.display = "";
    });
  });

  // Scheduled pill — cancel (×)
  list.querySelectorAll(".btn-cancel-scheduled").forEach(btn => {
    btn.addEventListener("click", async () => {
      if (!confirm("Cancel the scheduled call for this engagement?")) return;
      const card = btn.closest(".eng-card");
      btn.disabled = true;
      const resp = await sendMsg({ action: "cancelScheduledCall", recordId: card.dataset.id });
      if (resp?.success) {
        loadEngagements(true);
      } else {
        showToast("error", resp?.error || "Failed to cancel scheduled call.");
        btn.disabled = false;
      }
    });
  });

  // Status toggle buttons in title row (Set To Working / Set To Waiting)
  list.querySelectorAll(".btn-set-working").forEach(btn => {
    btn.addEventListener("click", async () => {
      const card = btn.closest(".eng-card");
      btn.disabled = true;
      const resp = await sendMsg({ action: "buttonAction", buttonId: btn.dataset.buttonId, recordId: card.dataset.id, duration: "" });
      if (resp?.success) { loadEngagements(true); loadLogs(); }
      else { showToast("error", resp?.error || "Action failed."); btn.disabled = false; }
    });
  });

  // Action buttons (Customer Call, Set To Waiting, End Call, etc.)
  list.querySelectorAll(".btn-action[data-button-id]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const card = btn.closest(".eng-card");
      const recordId = card.dataset.id;
      const buttonId = btn.dataset.buttonId;
      const duration = card.querySelector(".eng-duration:not(.schedule-duration)")?.value || "";
      card.querySelectorAll(".btn-action[data-button-id], .eng-duration:not(.schedule-duration)").forEach(el => { el.disabled = true; });
      const resp = await sendMsg({ action: "buttonAction", buttonId, recordId, duration });
      if (resp?.success) {
        loadEngagements(true);
        loadLogs();
      } else {
        showToast("error", resp?.error || "Action failed.");
        card.querySelectorAll(".btn-action[data-button-id], .eng-duration:not(.schedule-duration)").forEach(el => { el.disabled = false; });
      }
    });
  });
}

// ---- Auto-refresh when panel becomes visible ----
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") loadEngagements(true);
});

chrome.runtime.onMessage.addListener((msg) => {
  if (msg.action === "refreshEngagements") loadEngagements(true);
});

// ---- Init ----
document.addEventListener("DOMContentLoaded", async () => {
  const resp = await sendMsg({ action: "getConfig" });
  if (resp?.config) {
    $("#scheduledTime").value = resp.config.scheduledTime || "17:00";
    applyToggleState(resp.config.isActive !== false);
    applyTheme(resp.config.theme === "light");
  }
  loadLogs();
  loadSessionUser();
  loadEngagements();
});

// ---- Auto-save on time change ----
$("#scheduledTime").addEventListener("change", async () => {
  const config = { scheduledTime: $("#scheduledTime").value, isActive: $("#btnToggle").classList.contains("active") };
  const resp = await sendMsg({ action: "saveConfig", config });
  showToast(
    resp.success ? "ok" : "error",
    resp.success ? `Scheduled time saved — daily run at ${config.scheduledTime}.` : resp.error
  );
});

// ---- Open Config ----
$("#btnOpenConfig").addEventListener("click", () => {
  window.open(chrome.runtime.getURL("config.json"), "_blank");
});

// ---- Run Now ----
$("#btnRunNow").addEventListener("click", async () => {
  const config = { scheduledTime: $("#scheduledTime").value, isActive: $("#btnToggle").classList.contains("active") };
  await sendMsg({ action: "saveConfig", config });
  showToast("info", "Running update now...");
  const resp = await sendMsg({ action: "runNow" });
  showToast(
    resp.success ? "ok" : "error",
    resp.success ? "Run complete. Check logs below for details." : resp.error
  );
  loadLogs();
});

// ---- Accordion ----
document.querySelectorAll(".acc-header").forEach((header) => {
  header.addEventListener("click", (e) => {
    if (e.target.closest("button")) return;
    header.closest(".acc-section").classList.toggle("open");
  });
});

// ---- Logs ----
function renderLogEntries(logs) {
  if (!logs.length) return '<div class="empty-msg">No logs yet.</div>';
  return logs.map((l) => {
    const ts = new Date(l.ts).toLocaleString();
    return `<div class="log-entry">
      <div><span class="log-ts">${ts}</span> <span class="log-level ${l.level}">${l.level}</span></div>
      <div class="log-msg">${escHtml(l.message)}</div>
    </div>`;
  }).join("");
}

async function loadLogs() {
  const [engResp, schedResp] = await Promise.all([
    sendMsg({ action: "getEngagementLogs" }),
    sendMsg({ action: "getLogs" }),
  ]);

  const engLogs = engResp?.logs || [];
  const schedLogs = schedResp?.logs || [];

  $("#engLogList").innerHTML = renderLogEntries(engLogs);
  $("#schedLogList").innerHTML = renderLogEntries(schedLogs);
  $("#engLogCount").textContent = engLogs.length;
  $("#schedLogCount").textContent = schedLogs.length;
}

$("#btnRefreshEngagements").addEventListener("click", () => loadEngagements(true));

$("#btnClearEngLogs").addEventListener("click", async () => {
  await sendMsg({ action: "clearEngagementLogs" });
  loadLogs();
});

$("#btnClearSchedLogs").addEventListener("click", async () => {
  await sendMsg({ action: "clearLogs" });
  loadLogs();
});

function escHtml(s) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function formatScheduledTime(ts) {
  return new Date(ts).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

(() => {
  "use strict";

  const STORAGE_KEY = "tacit.logs.v1";
  const SETTINGS_KEY = "tacit.settings.v1";
  const GHOST_MIN = 0;
  const GHOST_MAX = 10;
  const GHOST_DEFAULT = 3;

  // ----- DOM -----
  const graph = document.getElementById("graph");
  const dot = document.getElementById("dot");
  const toast = document.getElementById("toast");
  const todayCount = document.getElementById("todayCount");
  const historyList = document.getElementById("historyList");
  const emptyState = document.getElementById("emptyState");
  const countEl = document.getElementById("count");
  const exportBtn = document.getElementById("exportBtn");
  const importBtn = document.getElementById("importBtn");
  const exportDialog = document.getElementById("exportDialog");
  const exportClose = document.getElementById("exportClose");
  const exportSummary = document.getElementById("exportSummary");
  const exportCopyBtn = document.getElementById("exportCopyBtn");
  const exportDownloadBtn = document.getElementById("exportDownloadBtn");
  const importFile = document.getElementById("importFile");
  const importDialog = document.getElementById("importDialog");
  const importClose = document.getElementById("importClose");
  const importSummary = document.getElementById("importSummary");
  const importMerge = document.getElementById("importMerge");
  const importReplace = document.getElementById("importReplace");
  const infoBtn = document.getElementById("infoBtn");
  const infoPanel = document.getElementById("infoPanel");
  const settingsBtn = document.getElementById("settingsBtn");
  const settingsDialog = document.getElementById("settingsDialog");
  const settingsClose = document.getElementById("settingsClose");
  const ghostCountValue = document.getElementById("ghostCountValue");
  const ghostMinus = document.getElementById("ghostMinus");
  const ghostPlus = document.getElementById("ghostPlus");
  const clearDataBtn = document.getElementById("clearDataBtn");
  const confirmDialog = document.getElementById("confirmDialog");
  const confirmCancel = document.getElementById("confirmCancel");
  const confirmDelete = document.getElementById("confirmDelete");

  // ----- State -----
  let logs = load();
  let settings = loadSettings();
  let editingId = null; // id of the entry whose note is being edited
  let dotId = null; // id of the entry the live dot currently represents

  // ----- Storage -----
  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const data = raw ? JSON.parse(raw) : [];
      return Array.isArray(data) ? data : [];
    } catch {
      return [];
    }
  }
  function persist() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(logs));
    } catch (e) {
      console.warn("保存に失敗しました", e);
    }
  }

  function loadSettings() {
    try {
      const raw = localStorage.getItem(SETTINGS_KEY);
      const data = raw ? JSON.parse(raw) : {};
      const n = Math.round(Number(data.ghostCount));
      return {
        ghostCount: Number.isFinite(n) ? clamp(n, GHOST_MIN, GHOST_MAX) : GHOST_DEFAULT,
      };
    } catch {
      return { ghostCount: GHOST_DEFAULT };
    }
  }
  function persistSettings() {
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    } catch (e) {
      console.warn("設定の保存に失敗しました", e);
    }
  }

  // ----- Graph input → record instantly on tap -----
  function pickPoint(evt) {
    const rect = graph.getBoundingClientRect();
    const px = clamp(evt.clientX - rect.left, 0, rect.width);
    const py = clamp(evt.clientY - rect.top, 0, rect.height);

    // X: left=0(bad) -> right=100(good)
    const x = Math.round((px / rect.width) * 100);
    // Y: bottom=0(suppress) -> top=100(assert) — screen Y is inverted
    const y = Math.round((1 - py / rect.height) * 100);

    renderDot(x, y);
    save(x, y);
  }

  function renderDot(x, y) {
    dot.hidden = false;
    dot.style.left = x + "%";
    dot.style.top = 100 - y + "%";
    dot.classList.remove("pulse");
    // restart the pulse animation to confirm the tap landed
    void dot.offsetWidth;
    dot.classList.add("pulse");
  }

  // Show the previous records as faint echoes; older ones fade more. How many
  // are shown is configurable in settings. When the live dot is visible it
  // already represents logs[0], so start past it.
  function renderGhosts() {
    graph.querySelectorAll(".ghost-dot").forEach((el) => el.remove());
    const start = dot.hidden ? 0 : 1;
    const recent = logs.slice(start, start + settings.ghostCount);
    const TOP = 0.45, BOTTOM = 0.1; // opacity of newest → oldest ghost
    const step = recent.length > 1 ? (TOP - BOTTOM) / (recent.length - 1) : 0;
    recent.forEach((item, i) => {
      const g = document.createElement("span");
      g.className = "ghost-dot";
      g.style.left = item.x + "%";
      g.style.top = 100 - item.y + "%";
      g.style.opacity = String(TOP - i * step);
      graph.insertBefore(g, dot); // keep the live dot painted on top
    });
  }

  graph.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    pickPoint(e);
  });

  // ----- Save (called immediately on tap) -----
  function save(x, y) {
    const entry = {
      id: String(Date.now()),
      timestamp: new Date().toISOString().replace(/\.\d{3}Z$/, "Z"),
      x,
      y,
      note: "",
    };
    logs.unshift(entry);
    dotId = entry.id; // the live dot now represents this entry
    persist();
    renderHistory();
    renderGhosts();
    const nth = logs.filter((l) => isToday(l.timestamp)).length;
    showToast(`記録しました（今日 ${nth} 件目）`);
  }

  // ----- Toast -----
  let toastTimer = null;
  function showToast(msg, icon = "check") {
    toast.innerHTML = `<i data-lucide="${icon}"></i><span>${escapeHtml(msg)}</span>`;
    toast.hidden = false;
    refreshIcons();
    // restart enter animation
    toast.classList.remove("show");
    void toast.offsetWidth;
    toast.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      toast.classList.remove("show");
      toast.hidden = true;
    }, 1600);
  }

  // ----- History -----
  function formatTime(iso) {
    const d = new Date(iso);
    if (isNaN(d)) return iso;
    const p = (n) => String(n).padStart(2, "0");
    return (
      d.getFullYear() + "-" + p(d.getMonth() + 1) + "-" + p(d.getDate()) +
      " " + p(d.getHours()) + ":" + p(d.getMinutes())
    );
  }

  function isToday(iso) {
    const d = new Date(iso);
    if (isNaN(d)) return false;
    const now = new Date();
    return d.getFullYear() === now.getFullYear() &&
           d.getMonth() === now.getMonth() &&
           d.getDate() === now.getDate();
  }

  function renderHistory() {
    historyList.innerHTML = "";
    countEl.textContent = String(logs.length);
    todayCount.textContent = String(logs.filter((l) => isToday(l.timestamp)).length);
    exportBtn.disabled = logs.length === 0;
    emptyState.hidden = logs.length > 0;

    for (const item of logs) {
      historyList.appendChild(renderItem(item));
    }
    refreshIcons();
  }

  function renderItem(item) {
    const li = document.createElement("li");
    li.className = "history-item";

    const coords = document.createElement("div");
    coords.className = "hi-coords";
    coords.innerHTML =
      `<span class="hi-xy"><i data-lucide="${item.x >= 50 ? "smile" : "frown"}"></i>${item.x}</span>` +
      `<span class="hi-xy"><i data-lucide="${item.y >= 50 ? "megaphone" : "megaphone-off"}"></i>${item.y}</span>`;

    const body = document.createElement("div");
    body.className = "hi-body";
    const time = document.createElement("span");
    time.className = "hi-time";
    time.textContent = formatTime(item.timestamp);
    body.append(time, editingId === item.id ? noteEditor(item) : noteDisplay(item));

    const del = document.createElement("button");
    del.className = "hi-del";
    del.type = "button";
    del.setAttribute("aria-label", "削除");
    del.innerHTML = '<i data-lucide="trash-2"></i>';
    del.addEventListener("click", () => removeLog(item.id));

    li.append(coords, body, del);
    return li;
  }

  // A tappable note line; clicking it opens the inline editor.
  function noteDisplay(item) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = item.note ? "hi-note" : "hi-note empty";
    btn.innerHTML = item.note
      ? `<span>${escapeHtml(item.note)}</span><i data-lucide="pencil"></i>`
      : `<i data-lucide="plus"></i><span>メモを追加</span>`;
    btn.addEventListener("click", () => startEdit(item.id));
    return btn;
  }

  // Inline text input replacing the note line while editing.
  function noteEditor(item) {
    const input = document.createElement("input");
    input.type = "text";
    input.className = "hi-note-input";
    input.value = item.note;
    input.placeholder = "メモを入力…";
    input.maxLength = 140;
    input.autocomplete = "off";

    const commit = () => commitEdit(item.id, input.value);
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") { e.preventDefault(); commit(); }
      else if (e.key === "Escape") { editingId = null; renderHistory(); }
    });
    input.addEventListener("blur", commit);
    // focus after it's inserted into the DOM
    requestAnimationFrame(() => { input.focus(); });
    return input;
  }

  function startEdit(id) {
    editingId = id;
    renderHistory();
  }

  function commitEdit(id, value) {
    if (editingId !== id) return; // already committed/cancelled
    const entry = logs.find((l) => l.id === id);
    if (entry) {
      entry.note = value.trim();
      persist();
    }
    editingId = null;
    renderHistory();
  }

  function removeLog(id) {
    if (editingId === id) editingId = null;
    // if the deleted entry is the one shown by the live dot, clear the dot too
    if (dotId === id) {
      dotId = null;
      dot.hidden = true;
    }
    logs = logs.filter((l) => l.id !== id);
    persist();
    renderHistory();
    renderGhosts();
  }

  // ----- Export / Import -----
  // Build the count + date-range summary shown before exporting or importing.
  function summaryHTML(arr) {
    const count = arr.length;
    const times = arr
      .map((l) => new Date(l.timestamp).getTime())
      .filter((t) => Number.isFinite(t));
    const fmt = (t) => formatTime(new Date(t).toISOString());
    const oldest = times.length ? fmt(Math.min(...times)) : "—";
    const newest = times.length ? fmt(Math.max(...times)) : "—";
    return (
      `<div class="summary-row"><dt>件数</dt><dd>${count} 件</dd></div>` +
      `<div class="summary-row"><dt>最も古い記録</dt><dd>${oldest}</dd></div>` +
      `<div class="summary-row"><dt>最も新しい記録</dt><dd>${newest}</dd></div>`
    );
  }

  function exportText() {
    return JSON.stringify(logs, null, 2);
  }

  async function copyJSON() {
    const text = exportText();
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // fallback for non-secure contexts
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand("copy"); } catch {}
      document.body.removeChild(ta);
    }
    showCopied();
  }

  let copyTimer = null;
  function showCopied() {
    exportCopyBtn.classList.add("copied");
    exportCopyBtn.innerHTML = '<i data-lucide="check"></i>コピーしました';
    refreshIcons();
    clearTimeout(copyTimer);
    copyTimer = setTimeout(() => {
      exportCopyBtn.classList.remove("copied");
      exportCopyBtn.innerHTML = '<i data-lucide="copy"></i>コピー';
      refreshIcons();
    }, 1800);
  }

  function downloadJSON() {
    const blob = new Blob([exportText()], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `tacit-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  exportBtn.addEventListener("click", () => {
    exportSummary.innerHTML = summaryHTML(logs);
    refreshIcons();
    exportDialog.showModal();
  });
  exportClose.addEventListener("click", () => exportDialog.close());
  exportDialog.addEventListener("click", (e) => {
    if (e.target === exportDialog) exportDialog.close();
  });
  exportCopyBtn.addEventListener("click", copyJSON);
  exportDownloadBtn.addEventListener("click", downloadJSON);

  // --- Import ---
  let pendingImport = null;

  // Accept only well-formed entries, coercing them to the canonical shape so a
  // hand-edited or partial file can't corrupt storage.
  function sanitizeEntry(e) {
    if (!e || typeof e !== "object") return null;
    const x = Math.round(Number(e.x));
    const y = Math.round(Number(e.y));
    if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
    if (typeof e.timestamp !== "string" || isNaN(new Date(e.timestamp))) return null;
    return {
      id: e.id != null ? String(e.id) : String(Date.now()) + Math.random().toString(36).slice(2, 7),
      timestamp: e.timestamp,
      x: clamp(x, 0, 100),
      y: clamp(y, 0, 100),
      note: typeof e.note === "string" ? e.note : "",
    };
  }

  function parseImport(text) {
    const data = JSON.parse(text);
    if (!Array.isArray(data)) throw new Error("JSON配列ではありません");
    const cleaned = data.map(sanitizeEntry).filter(Boolean);
    if (cleaned.length === 0) throw new Error("有効な記録が見つかりません");
    return cleaned;
  }

  // logs are kept newest-first
  function sortLogs(arr) {
    return arr.slice().sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  }

  function applyImport(mode) {
    if (!pendingImport) return;
    if (mode === "replace") {
      logs = sortLogs(pendingImport);
    } else {
      const map = new Map();
      for (const l of logs) map.set(l.id, l);
      for (const l of pendingImport) if (!map.has(l.id)) map.set(l.id, l);
      logs = sortLogs([...map.values()]);
    }
    const added = pendingImport.length;
    pendingImport = null;
    editingId = null;
    persist();
    dotId = null;
    dot.hidden = true; // the live dot no longer matches logs[0]
    renderHistory();
    renderGhosts();
    importDialog.close();
    showToast(mode === "replace" ? `${added} 件で置き換えました` : `${added} 件を読み込みました`);
  }

  importBtn.addEventListener("click", () => importFile.click());
  importFile.addEventListener("change", async () => {
    const file = importFile.files[0];
    importFile.value = ""; // allow re-selecting the same file later
    if (!file) return;
    try {
      pendingImport = parseImport(await file.text());
      importSummary.innerHTML = summaryHTML(pendingImport);
      refreshIcons();
      importDialog.showModal();
    } catch (err) {
      showToast("読み込めませんでした（" + (err.message || "不正なファイル") + "）", "alert-triangle");
    }
  });
  importClose.addEventListener("click", () => { pendingImport = null; importDialog.close(); });
  importDialog.addEventListener("click", (e) => {
    if (e.target === importDialog) { pendingImport = null; importDialog.close(); }
  });
  importMerge.addEventListener("click", () => applyImport("merge"));
  importReplace.addEventListener("click", () => applyImport("replace"));

  // ----- Info toggle -----
  infoBtn.addEventListener("click", () => {
    const open = infoPanel.hidden;
    infoPanel.hidden = !open;
    infoBtn.setAttribute("aria-expanded", String(open));
  });

  // ----- Settings dialog -----
  function syncSettingsUI() {
    ghostCountValue.textContent = String(settings.ghostCount);
    ghostMinus.disabled = settings.ghostCount <= GHOST_MIN;
    ghostPlus.disabled = settings.ghostCount >= GHOST_MAX;
  }
  function changeGhostCount(delta) {
    settings.ghostCount = clamp(settings.ghostCount + delta, GHOST_MIN, GHOST_MAX);
    persistSettings();
    syncSettingsUI();
    renderGhosts();
  }
  settingsBtn.addEventListener("click", () => {
    syncSettingsUI();
    settingsDialog.showModal();
  });
  settingsClose.addEventListener("click", () => settingsDialog.close());
  ghostMinus.addEventListener("click", () => changeGhostCount(-1));
  ghostPlus.addEventListener("click", () => changeGhostCount(1));
  // click on the backdrop (outside the body) closes the dialog
  settingsDialog.addEventListener("click", (e) => {
    if (e.target === settingsDialog) settingsDialog.close();
  });

  // ----- Delete all data (with confirmation) -----
  function clearAllLogs() {
    logs = [];
    editingId = null;
    persist();
    dotId = null;
    dot.hidden = true;
    renderHistory();
    renderGhosts();
  }
  clearDataBtn.addEventListener("click", () => confirmDialog.showModal());
  confirmCancel.addEventListener("click", () => confirmDialog.close());
  confirmDelete.addEventListener("click", () => {
    clearAllLogs();
    confirmDialog.close();
    settingsDialog.close();
    showToast("すべての記録を削除しました");
  });
  // click on the backdrop closes (cancels) the confirmation
  confirmDialog.addEventListener("click", (e) => {
    if (e.target === confirmDialog) confirmDialog.close();
  });

  // ----- Helpers -----
  function clamp(v, lo, hi) { return Math.min(hi, Math.max(lo, v)); }
  function escapeHtml(s) {
    return s.replace(/[&<>"']/g, (c) => (
      { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]
    ));
  }
  function refreshIcons() {
    if (window.lucide && typeof window.lucide.createIcons === "function") {
      window.lucide.createIcons();
    }
  }

  // ----- Init -----
  renderHistory();
  renderGhosts();
  refreshIcons();

  // ----- PWA service worker -----
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("./sw.js").catch(() => {});
    });
    // When a new SW takes control (after an asset/cache-version update),
    // reload once so a normal reload shows the latest assets too.
    let refreshing = false;
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (refreshing) return;
      refreshing = true;
      window.location.reload();
    });
  }
})();

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
  const copyBtn = document.getElementById("copyBtn");
  const infoBtn = document.getElementById("infoBtn");
  const infoPanel = document.getElementById("infoPanel");
  const settingsBtn = document.getElementById("settingsBtn");
  const settingsDialog = document.getElementById("settingsDialog");
  const settingsClose = document.getElementById("settingsClose");
  const ghostCountValue = document.getElementById("ghostCountValue");
  const ghostMinus = document.getElementById("ghostMinus");
  const ghostPlus = document.getElementById("ghostPlus");

  // ----- State -----
  let logs = load();
  let settings = loadSettings();
  let editingId = null; // id of the entry whose note is being edited

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
    persist();
    renderHistory();
    renderGhosts();
    const nth = logs.filter((l) => isToday(l.timestamp)).length;
    showToast(`記録しました（今日 ${nth} 件目）`);
  }

  // ----- Toast -----
  let toastTimer = null;
  function showToast(msg) {
    toast.innerHTML = `<i data-lucide="check"></i><span>${escapeHtml(msg)}</span>`;
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
    copyBtn.disabled = logs.length === 0;
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
    logs = logs.filter((l) => l.id !== id);
    persist();
    renderHistory();
    renderGhosts();
  }

  // ----- Export -----
  async function copyJSON() {
    const text = JSON.stringify(logs, null, 2);
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
    copyBtn.classList.add("copied");
    copyBtn.innerHTML = '<i data-lucide="check"></i><span id="copyLabel">Copied!</span>';
    refreshIcons();
    clearTimeout(copyTimer);
    copyTimer = setTimeout(() => {
      copyBtn.classList.remove("copied");
      copyBtn.innerHTML =
        '<i data-lucide="copy"></i><span id="copyLabel">JSONとしてコピー</span>';
      refreshIcons();
    }, 1800);
  }

  copyBtn.addEventListener("click", copyJSON);

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

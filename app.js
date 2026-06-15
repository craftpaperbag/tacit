(() => {
  "use strict";

  const STORAGE_KEY = "tacit.logs.v1";

  // ----- DOM -----
  const graph = document.getElementById("graph");
  const dot = document.getElementById("dot");
  const valX = document.getElementById("valX");
  const valY = document.getElementById("valY");
  const note = document.getElementById("note");
  const saveBtn = document.getElementById("saveBtn");
  const saveHint = document.getElementById("saveHint");
  const historyList = document.getElementById("historyList");
  const emptyState = document.getElementById("emptyState");
  const countEl = document.getElementById("count");
  const copyBtn = document.getElementById("copyBtn");
  const infoBtn = document.getElementById("infoBtn");
  const infoPanel = document.getElementById("infoPanel");

  // ----- State -----
  let current = null; // { x, y } in 0..100, or null
  let logs = load();

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

  // ----- Graph input -----
  function pickPoint(evt) {
    const rect = graph.getBoundingClientRect();
    const px = clamp(evt.clientX - rect.left, 0, rect.width);
    const py = clamp(evt.clientY - rect.top, 0, rect.height);

    // X: left=0(bad) -> right=100(good)
    const x = Math.round((px / rect.width) * 100);
    // Y: bottom=0(suppress) -> top=100(assert) — screen Y is inverted
    const y = Math.round((1 - py / rect.height) * 100);

    current = { x, y };
    renderDot();
    updateSaveState();
  }

  function renderDot() {
    if (!current) {
      dot.hidden = true;
      valX.textContent = "—";
      valY.textContent = "—";
      return;
    }
    dot.hidden = false;
    dot.style.left = current.x + "%";
    dot.style.top = 100 - current.y + "%";
    valX.textContent = current.x;
    valY.textContent = current.y;
  }

  graph.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    pickPoint(e);
  });

  // ----- Save -----
  function updateSaveState() {
    const ready = current !== null;
    saveBtn.disabled = !ready;
    if (ready) {
      saveHint.textContent = "保存できます";
      saveHint.classList.add("ok");
    } else {
      saveHint.textContent = "グラフ上の点を選択してください";
      saveHint.classList.remove("ok");
    }
  }

  function save() {
    if (!current) return;
    const entry = {
      id: String(Date.now()),
      timestamp: new Date().toISOString().replace(/\.\d{3}Z$/, "Z"),
      x: current.x,
      y: current.y,
      note: note.value.trim(),
    };
    logs.unshift(entry);
    persist();
    renderHistory();

    // reset input affordances
    current = null;
    note.value = "";
    renderDot();
    updateSaveState();
    saveHint.textContent = "記録しました";
    saveHint.classList.add("ok");
  }

  saveBtn.addEventListener("click", save);
  note.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !saveBtn.disabled) save();
  });

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

  function renderHistory() {
    historyList.innerHTML = "";
    countEl.textContent = String(logs.length);
    copyBtn.disabled = logs.length === 0;
    emptyState.hidden = logs.length > 0;

    for (const item of logs) {
      const li = document.createElement("li");
      li.className = "history-item";

      const coords = document.createElement("div");
      coords.className = "hi-coords";
      coords.innerHTML =
        `<span class="hi-xy">${item.x}<span class="hi-xy-key">X</span></span>` +
        `<span class="hi-xy">${item.y}<span class="hi-xy-key">Y</span></span>`;

      const body = document.createElement("div");
      body.className = "hi-body";
      const time = document.createElement("span");
      time.className = "hi-time";
      time.textContent = formatTime(item.timestamp);
      const noteEl = document.createElement("span");
      if (item.note) {
        noteEl.className = "hi-note";
        noteEl.textContent = item.note;
      } else {
        noteEl.className = "hi-note empty";
        noteEl.textContent = "メモなし";
      }
      body.append(time, noteEl);

      const del = document.createElement("button");
      del.className = "hi-del";
      del.type = "button";
      del.setAttribute("aria-label", "削除");
      del.innerHTML = '<i data-lucide="trash-2"></i>';
      del.addEventListener("click", () => removeLog(item.id));

      li.append(coords, body, del);
      historyList.appendChild(li);
    }
    refreshIcons();
  }

  function removeLog(id) {
    logs = logs.filter((l) => l.id !== id);
    persist();
    renderHistory();
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

  // ----- Helpers -----
  function clamp(v, lo, hi) { return Math.min(hi, Math.max(lo, v)); }
  function refreshIcons() {
    if (window.lucide && typeof window.lucide.createIcons === "function") {
      window.lucide.createIcons();
    }
  }

  // ----- Init -----
  renderDot();
  updateSaveState();
  renderHistory();
  refreshIcons();

  // ----- PWA service worker -----
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("./sw.js").catch(() => {});
    });
  }
})();

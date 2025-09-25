const quickEntry = document.getElementById("quick-entry");
const suggestionsList = document.getElementById("suggestions");
const overlay = document.getElementById("session-overlay");
const taskNameInput = document.getElementById("task-name-input");
const timerDisplay = document.getElementById("timer-display");
const pauseBtn = document.getElementById("pause-btn");
const stopBtn = document.getElementById("stop-btn");
const nudgeButtons = document.querySelectorAll(".nudge-buttons button");
const detailsToggle = document.getElementById("details-toggle");
const detailsPanel = document.getElementById("details-panel");
const startSlider = document.getElementById("start-slider");
const sliderValue = document.getElementById("slider-value");
const naturalInput = document.getElementById("natural-start");
const naturalHint = document.getElementById("natural-hint");
const applyNaturalBtn = document.getElementById("apply-natural");
const undoBtn = document.getElementById("undo-btn");
const tagInput = document.getElementById("tag-input");
const addTagBtn = document.getElementById("add-tag");
const tagSuggestionsEl = document.getElementById("tag-suggestions");
const selectedTagsEl = document.getElementById("selected-tags");
const noteInput = document.getElementById("note-input");
const logList = document.getElementById("log-list");

const templates = [
  {
    title: "ギター基礎フレーズ",
    tags: ["ギター", "基礎"],
    intensity: "Focus",
    preferredSlots: ["morning", "evening"],
  },
  {
    title: "英語スピーキング Shadowing",
    tags: ["英語", "スピーキング"],
    intensity: "High",
    preferredSlots: ["morning"],
  },
  {
    title: "SwiftUI コーディング",
    tags: ["iOS", "コーディング"],
    intensity: "Deep",
    preferredSlots: ["afternoon", "night"],
  },
  {
    title: "ピアノ スケール練習",
    tags: ["ピアノ", "基礎"],
    intensity: "Warm-up",
    preferredSlots: ["morning"],
  },
  {
    title: "論文サマリー",
    tags: ["リサーチ", "RAGメモ"],
    intensity: "Deep",
    preferredSlots: ["night"],
  },
  {
    title: "ポモドーロ - LeetCode",
    tags: ["アルゴリズム", "ポモドーロ"],
    intensity: "High",
    preferredSlots: ["afternoon"],
  },
];

const tagCatalog = [
  "ギター",
  "ピアノ",
  "英語",
  "SwiftUI",
  "iOS",
  "アウトプット",
  "RAG",
  "理論",
  "筋トレ",
  "フォームチェック",
  "作曲",
];

let sessions = [];
let currentSession = null;
let timerInterval = null;
let suggestionIndex = -1;
let undoSnapshot = null;

function getTimeSlot(date = new Date()) {
  const hour = date.getHours();
  if (hour < 6) return "late-night";
  if (hour < 11) return "morning";
  if (hour < 15) return "afternoon";
  if (hour < 19) return "evening";
  return "night";
}

function buildSuggestions(query = "") {
  const slot = getTimeSlot();

  const historyTemplates = sessions
    .slice(-8)
    .reverse()
    .map((session) => ({
      title: session.title,
      tags: session.tags,
      intensity: session.intensity ?? "",
      preferredSlots: [session.timeSlot],
      lastPlayed: session.endedAt,
    }));

  const merged = [...historyTemplates, ...templates];

  const filtered = merged
    .filter((item, index, array) => {
      const duplicateIndex = array.findIndex((x) => x.title === item.title);
      return duplicateIndex === index;
    })
    .filter((item) => {
      if (!query) return true;
      const lower = query.toLowerCase();
      return (
        item.title.toLowerCase().includes(lower) ||
        (item.tags ?? []).some((tag) => tag.toLowerCase().includes(lower))
      );
    })
    .sort((a, b) => {
      const aMatch = a.preferredSlots?.includes(slot) ? 1 : 0;
      const bMatch = b.preferredSlots?.includes(slot) ? 1 : 0;
      if (aMatch !== bMatch) return bMatch - aMatch;
      if (a.lastPlayed && b.lastPlayed) {
        return b.lastPlayed - a.lastPlayed;
      }
      if (a.lastPlayed) return -1;
      if (b.lastPlayed) return 1;
      return 0;
    });

  return filtered.slice(0, 6);
}

function renderSuggestions(query = "") {
  const results = buildSuggestions(query);
  suggestionsList.innerHTML = "";

  if (!results.length) {
    suggestionsList.classList.remove("show");
    return;
  }

  results.forEach((item, idx) => {
    const li = document.createElement("li");
    li.setAttribute("role", "option");
    li.dataset.index = idx;
    li.innerHTML = `
      <span class="suggestion-title">${item.title}</span>
      <span class="suggestion-meta">${
        item.tags?.join(" · ") ?? ""
      }${item.intensity ? ` ｜ ${item.intensity}` : ""}</span>
    `;
    li.addEventListener("mousedown", (event) => {
      event.preventDefault();
      startSession(item.title, item.tags ?? []);
    });
    suggestionsList.appendChild(li);
  });

  suggestionsList.classList.add("show");
}

function hideSuggestions() {
  suggestionsList.classList.remove("show");
  suggestionIndex = -1;
}

function startSession(title, tags = []) {
  if (currentSession) {
    stopSession();
  }
  const now = Date.now();
  currentSession = {
    title,
    tags: [...new Set(tags)],
    note: "",
    originalStart: now,
    adjustedStart: now,
    pausedDuration: 0,
    pauseStartedAt: null,
    isPaused: false,
    timeSlot: getTimeSlot(),
    intensity: undefined,
  };
  undoSnapshot = null;
  updateUndoState();
  taskNameInput.value = title;
  selectedTagsEl.innerHTML = "";
  currentSession.tags.forEach(addTagChip);
  noteInput.value = "";
  naturalHint.textContent = "";
  overlay.hidden = false;
  overlay.focus?.();
  detailsPanel.hidden = true;
  detailsToggle.textContent = "＋ 詳細編集";
  detailsToggle.setAttribute("aria-expanded", "false");
  startSlider.min = "-120";
  startSlider.max = "60";
  startSlider.value = "0";
  updateTimer();
  if (timerInterval) clearInterval(timerInterval);
  timerInterval = setInterval(updateTimer, 1000);
  quickEntry.value = "";
  hideSuggestions();
  renderTagSuggestions();
  syncSlider();
}

function updateTimer() {
  if (!currentSession) return;
  const now = Date.now();
  let effectiveNow = now;
  if (currentSession.isPaused && currentSession.pauseStartedAt) {
    effectiveNow = currentSession.pauseStartedAt;
  }
  const elapsed =
    effectiveNow - currentSession.adjustedStart - currentSession.pausedDuration;
  const clamped = Math.max(0, elapsed);
  timerDisplay.textContent = formatDuration(clamped);
}

function formatDuration(ms) {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600)
    .toString()
    .padStart(2, "0");
  const minutes = Math.floor((totalSeconds % 3600) / 60)
    .toString()
    .padStart(2, "0");
  const seconds = (totalSeconds % 60).toString().padStart(2, "0");
  return `${hours}:${minutes}:${seconds}`;
}

function shiftStart(minutes) {
  if (!currentSession) return;
  saveUndo();
  currentSession.adjustedStart += minutes * 60 * 1000;
  currentSession.pausedDuration = Math.max(
    0,
    currentSession.pausedDuration
  );
  syncSlider();
  updateTimer();
}

function saveUndo() {
  if (!currentSession) return;
  undoSnapshot = {
    adjustedStart: currentSession.adjustedStart,
  };
  updateUndoState();
}

function updateUndoState() {
  undoBtn.disabled = !undoSnapshot;
}

function syncSlider() {
  if (!currentSession) return;
  const diffMinutes = Math.round(
    (currentSession.adjustedStart - currentSession.originalStart) / 60000
  );
  ensureSliderRange(diffMinutes);
  startSlider.value = diffMinutes;
  sliderValue.textContent = `開始: ${formatTime(
    new Date(currentSession.adjustedStart)
  )}（差 ${formatDiff(diffMinutes)}）`;
}

function ensureSliderRange(diffMinutes) {
  let min = Number(startSlider.min);
  let max = Number(startSlider.max);
  if (diffMinutes < min) {
    startSlider.min = String(diffMinutes - 30);
  }
  if (diffMinutes > max) {
    startSlider.max = String(diffMinutes + 30);
  }
}

function formatDiff(mins) {
  if (mins === 0) return "±0分";
  return mins > 0 ? `+${mins}分` : `${mins}分`;
}

function formatTime(date) {
  const label = `${date.getHours().toString().padStart(2, "0")}:${date
    .getMinutes()
    .toString()
    .padStart(2, "0")}`;
  const today = new Date();
  const startOfToday = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate()
  );
  const startOfDate = new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate()
  );
  const diff = (startOfDate - startOfToday) / (1000 * 60 * 60 * 24);
  if (diff === -1) return `昨日 ${label}`;
  if (diff === 1) return `明日 ${label}`;
  if (diff === 0) return `今日 ${label}`;
  return `${date.getMonth() + 1}/${date.getDate()} ${label}`;
}

function applySlider(value) {
  if (!currentSession) return;
  saveUndo();
  const minutes = Number(value);
  currentSession.adjustedStart =
    currentSession.originalStart + minutes * 60 * 1000;
  syncSlider();
  updateTimer();
}

function parseNaturalInput(value) {
  if (!currentSession) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;

  const now = new Date();

  const relativeMatch = trimmed.match(/^([+-]?\d+)\s*(m|min|分|h|時間)$/i);
  if (relativeMatch) {
    const amount = Number(relativeMatch[1]);
    const unit = relativeMatch[2].toLowerCase();
    const minutes = unit.startsWith("h") || unit.includes("時間") ? amount * 60 : amount;
    return new Date(currentSession.adjustedStart + minutes * 60000);
  }

  const minutesAgo = trimmed.match(/^(\d+)\s*分前$/);
  if (minutesAgo) {
    const minutes = Number(minutesAgo[1]);
    return new Date(now.getTime() - minutes * 60000);
  }

  const hoursAgo = trimmed.match(/^(\d+)\s*時間前$/);
  if (hoursAgo) {
    const hours = Number(hoursAgo[1]);
    return new Date(now.getTime() - hours * 3600000);
  }

  const yesterdayMatch = trimmed.match(/^昨日\s*(\d{1,2}):(\d{2})$/);
  if (yesterdayMatch) {
    const [_, h, m] = yesterdayMatch;
    const date = new Date(now);
    date.setDate(date.getDate() - 1);
    date.setHours(Number(h), Number(m), 0, 0);
    return date;
  }

  const timeMatch = trimmed.match(/^(今日)?\s*(\d{1,2}):(\d{2})$/);
  if (timeMatch) {
    const [, , h, m] = timeMatch;
    const date = new Date(now);
    date.setHours(Number(h), Number(m), 0, 0);
    if (date.getTime() > now.getTime()) {
      naturalHint.textContent = "未来の時刻です。開始時刻として適用しますか？";
    }
    return date;
  }

  return null;
}

function applyNatural() {
  if (!currentSession) return;
  const parsed = parseNaturalInput(naturalInput.value);
  if (!parsed) {
    naturalHint.textContent = "認識できませんでした";
    return;
  }
  if (parsed.getTime() > Date.now()) {
    naturalHint.textContent = "未来の時刻は反映されません";
    return;
  }
  if (parsed.getTime() < currentSession.originalStart - 24 * 3600000) {
    naturalHint.textContent = "過去にさかのぼり過ぎています";
    return;
  }
  saveUndo();
  currentSession.adjustedStart = parsed.getTime();
  naturalHint.textContent = `開始時刻を ${formatTime(parsed)} に更新しました`;
  naturalInput.value = "";
  syncSlider();
  updateTimer();
}

function pauseSession() {
  if (!currentSession) return;
  if (currentSession.isPaused) {
    const pausedTime = Date.now() - currentSession.pauseStartedAt;
    currentSession.pausedDuration += pausedTime;
    currentSession.pauseStartedAt = null;
    currentSession.isPaused = false;
    pauseBtn.textContent = "⏸ 一時停止";
    pauseBtn.setAttribute("aria-pressed", "false");
  } else {
    currentSession.pauseStartedAt = Date.now();
    currentSession.isPaused = true;
    pauseBtn.textContent = "▶ 再開";
    pauseBtn.setAttribute("aria-pressed", "true");
  }
  updateTimer();
}

function stopSession() {
  if (!currentSession) return;
  const endTime = Date.now();
  if (currentSession.isPaused && currentSession.pauseStartedAt) {
    currentSession.pausedDuration += endTime - currentSession.pauseStartedAt;
  }
  const duration = Math.max(
    0,
    endTime - currentSession.adjustedStart - currentSession.pausedDuration
  );

  const record = {
    title: taskNameInput.value.trim() || currentSession.title,
    tags: [...currentSession.tags],
    note: (currentSession.note ?? noteInput.value).trim(),
    startedAt: currentSession.adjustedStart,
    endedAt: endTime,
    duration,
    paused: currentSession.isPaused,
    timeSlot: currentSession.timeSlot,
  };
  sessions.push(record);
  renderLog();
  cleanupSession();
  renderSuggestions();
}

function cleanupSession() {
  currentSession = null;
  clearInterval(timerInterval);
  timerInterval = null;
  overlay.hidden = true;
  pauseBtn.textContent = "⏸ 一時停止";
  pauseBtn.setAttribute("aria-pressed", "false");
  naturalInput.value = "";
  naturalHint.textContent = "";
  undoSnapshot = null;
  updateUndoState();
}

function renderLog() {
  logList.innerHTML = "";
  sessions
    .slice()
    .reverse()
    .forEach((session) => {
      const li = document.createElement("li");
      li.className = "log-item";
      li.innerHTML = `
        <div class="log-item-header">
          <strong>${session.title}</strong>
          <span>${formatDuration(session.duration)}</span>
        </div>
        <div class="log-item-meta">${formatTime(
          new Date(session.startedAt)
        )} → ${formatTime(new Date(session.endedAt))}</div>
      `;
      if (session.paused) {
        const paused = document.createElement("span");
        paused.className = "pause-indicator";
        paused.textContent = "一時停止含む";
        li.querySelector(".log-item-header").appendChild(paused);
      }
      if (session.tags.length) {
        const tagsEl = document.createElement("div");
        tagsEl.className = "log-item-tags";
        session.tags.forEach((tag) => {
          const span = document.createElement("span");
          span.className = "tag";
          span.textContent = tag;
          tagsEl.appendChild(span);
        });
        li.appendChild(tagsEl);
      }
      if (session.note) {
        const note = document.createElement("p");
        note.textContent = session.note;
        li.appendChild(note);
      }
      logList.appendChild(li);
    });
}

function renderTagSuggestions() {
  tagSuggestionsEl.innerHTML = "";
  const used = new Set(currentSession?.tags ?? []);
  tagCatalog
    .filter((tag) => !used.has(tag))
    .slice(0, 12)
    .forEach((tag) => {
      const button = document.createElement("button");
      button.className = "chip";
      button.type = "button";
      button.textContent = tag;
      button.addEventListener("click", () => addTag(tag));
      tagSuggestionsEl.appendChild(button);
    });
}

function addTag(tag) {
  if (!currentSession) return;
  if (!tag) return;
  const trimmed = tag.trim();
  if (!trimmed) return;
  if (currentSession.tags.includes(trimmed)) return;
  currentSession.tags.push(trimmed);
  addTagChip(trimmed);
  renderTagSuggestions();
}

function addTagChip(tag) {
  const tagEl = document.createElement("span");
  tagEl.className = "tag";
  tagEl.textContent = tag;
  const removeBtn = document.createElement("button");
  removeBtn.type = "button";
  removeBtn.setAttribute("aria-label", `${tag} を外す`);
  removeBtn.textContent = "×";
  removeBtn.addEventListener("click", () => removeTag(tag));
  tagEl.appendChild(removeBtn);
  selectedTagsEl.appendChild(tagEl);
}

function removeTag(tag) {
  if (!currentSession) return;
  currentSession.tags = currentSession.tags.filter((t) => t !== tag);
  renderSelectedTags();
  renderTagSuggestions();
}

function renderSelectedTags() {
  selectedTagsEl.innerHTML = "";
  currentSession.tags.forEach(addTagChip);
}

function undoStart() {
  if (!currentSession || !undoSnapshot) return;
  currentSession.adjustedStart = undoSnapshot.adjustedStart;
  undoSnapshot = null;
  updateUndoState();
  syncSlider();
  updateTimer();
}

quickEntry.addEventListener("input", (event) => {
  const value = event.target.value.trim();
  renderSuggestions(value);
});

quickEntry.addEventListener("focus", () => {
  if (quickEntry.value.trim()) {
    renderSuggestions(quickEntry.value.trim());
  } else {
    renderSuggestions();
  }
});

quickEntry.addEventListener("keydown", (event) => {
  if (!suggestionsList.classList.contains("show")) return;
  const items = Array.from(suggestionsList.children);
  if (event.key === "ArrowDown") {
    event.preventDefault();
    suggestionIndex = (suggestionIndex + 1) % items.length;
    updateActiveSuggestion(items);
  } else if (event.key === "ArrowUp") {
    event.preventDefault();
    suggestionIndex = (suggestionIndex - 1 + items.length) % items.length;
    updateActiveSuggestion(items);
  } else if (event.key === "Enter" && suggestionIndex >= 0) {
    event.preventDefault();
    const item = items[suggestionIndex];
    item.dispatchEvent(new Event("mousedown"));
  }
});

quickEntry.addEventListener("keyup", (event) => {
  if (event.key === "Enter" && quickEntry.value.trim() && suggestionIndex < 0) {
    startSession(quickEntry.value.trim());
  } else if (event.key === "Escape") {
    hideSuggestions();
  }
});

function updateActiveSuggestion(items) {
  items.forEach((item, idx) => {
    if (idx === suggestionIndex) {
      item.classList.add("active");
      item.setAttribute("aria-selected", "true");
    } else {
      item.classList.remove("active");
      item.removeAttribute("aria-selected");
    }
  });
}

pauseBtn.addEventListener("click", pauseSession);
stopBtn.addEventListener("click", stopSession);

detailsToggle.addEventListener("click", () => {
  const isExpanded = detailsPanel.hidden;
  detailsPanel.hidden = !isExpanded;
  detailsToggle.textContent = isExpanded ? "－ 詳細を隠す" : "＋ 詳細編集";
  detailsToggle.setAttribute("aria-expanded", String(isExpanded));
});

nudgeButtons.forEach((button) => {
  button.addEventListener("click", () => {
    const minutes = Number(button.dataset.shift);
    shiftStart(minutes);
  });
});

startSlider.addEventListener("input", (event) => {
  if (!currentSession) return;
  const minutes = Number(event.target.value);
  const preview = new Date(
    currentSession.originalStart + minutes * 60 * 1000
  );
  sliderValue.textContent = `予定: ${formatTime(preview)}（差 ${formatDiff(
    minutes
  )}）`;
});

startSlider.addEventListener("change", (event) => {
  applySlider(event.target.value);
});

applyNaturalBtn.addEventListener("click", applyNatural);
naturalInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    event.preventDefault();
    applyNatural();
  }
});

undoBtn.addEventListener("click", undoStart);

tagInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    event.preventDefault();
    addTag(tagInput.value);
    tagInput.value = "";
  }
});

addTagBtn.addEventListener("click", () => {
  addTag(tagInput.value);
  tagInput.value = "";
});

noteInput.addEventListener("input", () => {
  if (!currentSession) return;
  currentSession.note = noteInput.value;
});

taskNameInput.addEventListener("input", () => {
  if (!currentSession) return;
  currentSession.title = taskNameInput.value;
});

document.addEventListener("keydown", (event) => {
  if (!currentSession) return;
  const key = event.key;
  if (event.target === quickEntry || event.target === naturalInput) return;
  if (key === "[") {
    shiftStart(-5);
  } else if (key === "]") {
    shiftStart(5);
  } else if (key === "{") {
    shiftStart(-10);
  } else if (key === "}") {
    shiftStart(10);
  } else if (key.toLowerCase() === "e") {
    detailsToggle.click();
  } else if (key === "Escape" && !detailsPanel.hidden) {
    detailsToggle.click();
  }
});

renderSuggestions();
renderTagSuggestions();

window.addEventListener("click", (event) => {
  if (!suggestionsList.contains(event.target) && event.target !== quickEntry) {
    hideSuggestions();
  }
});

function stopSessionWithoutLog() {
  cleanupSession();
}

window.addEventListener("beforeunload", stopSessionWithoutLog);

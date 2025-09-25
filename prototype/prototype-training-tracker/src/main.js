const STORAGE_KEY = "training-tracker-state-v1";

const elements = {
  taskInput: document.querySelector("#taskInput"),
  startButton: document.querySelector("#startButton"),
  suggestions: document.querySelector("#suggestions"),
  activeSection: document.querySelector("#activeSession"),
  activeTitle: document.querySelector("#activeTaskTitle"),
  timerDisplay: document.querySelector("#timerDisplay"),
  quickButtons: document.querySelectorAll(".quick-adjust button[data-adjust]"),
  undoAdjust: document.querySelector("#undoAdjust"),
  toggleDetails: document.querySelector("#toggleDetails"),
  detailPanel: document.querySelector("#detailPanel"),
  startSlider: document.querySelector("#startSlider"),
  startDelta: document.querySelector("#startDelta"),
  startClock: document.querySelector("#startClock"),
  naturalStartInput: document.querySelector("#naturalStartInput"),
  applyNatural: document.querySelector("#applyNatural"),
  stopSession: document.querySelector("#stopSession"),
  skillInput: document.querySelector("#skillInput"),
  tagsInput: document.querySelector("#tagsInput"),
  intensitySelect: document.querySelector("#intensitySelect"),
  notesInput: document.querySelector("#notesInput"),
  timelineList: document.querySelector("#timelineList"),
  timelineTemplate: document.querySelector("#sessionItemTemplate"),
  clearHistory: document.querySelector("#clearHistory"),
  editorDialog: document.querySelector("#sessionEditor"),
  streakChip: document.querySelector("#streakChip"),
  weeklyTotalChip: document.querySelector("#weeklyTotalChip")
};

const state = {
  sessions: [],
  currentSessionId: null,
  undoStack: []
};

let timerHandle = null;
let isDetailOpen = false;
let sliderPreviewMinutes = null;

function loadState() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return;
    const parsed = JSON.parse(saved);
    if (parsed.sessions && Array.isArray(parsed.sessions)) {
      state.sessions = parsed.sessions;
    }
    if (parsed.currentSessionId) {
      const session = state.sessions.find((s) => s.id === parsed.currentSessionId && !s.end);
      if (session) {
        state.currentSessionId = session.id;
      }
    }
  } catch (error) {
    console.error("Failed to load state", error);
  }
}

function persistState() {
  const payload = {
    sessions: state.sessions,
    currentSessionId: state.currentSessionId
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
}

function getCurrentSession() {
  if (!state.currentSessionId) return null;
  return state.sessions.find((s) => s.id === state.currentSessionId) || null;
}

function startSession(title) {
  if (!title.trim()) return;
  const now = new Date();
  const session = {
    id: `sess-${now.getTime()}`,
    title: title.trim(),
    start: now.toISOString(),
    end: null,
    tags: [],
    skill: "",
    intensity: "",
    notes: "",
    adjustments: []
  };

  state.sessions.push(session);
  state.currentSessionId = session.id;
  state.undoStack = [];
  persistState();
  elements.taskInput.value = "";
  renderAll();
  startTimer();
  elements.taskInput.focus();
}

function stopSession() {
  const session = getCurrentSession();
  if (!session) return;
  session.end = new Date().toISOString();
  state.currentSessionId = null;
  state.undoStack = [];
  persistState();
  clearTimer();
  renderAll();
}

function adjustStart(minutes) {
  const session = getCurrentSession();
  if (!session) return;
  const current = new Date(session.start);
  const target = new Date(current.getTime() + minutes * 60000);
  const now = new Date();
  if (target > now) {
    target.setTime(now.getTime());
  }
  pushUndo(current.toISOString());
  session.start = target.toISOString();
  session.adjustments.push({ type: "quick", minutes, at: now.toISOString() });
  persistState();
  syncDetailInputs();
  renderAll();
}

function pushUndo(previousStartISO) {
  state.undoStack.push(previousStartISO);
  elements.undoAdjust.disabled = state.undoStack.length === 0;
}

function undoStartAdjust() {
  const session = getCurrentSession();
  if (!session) return;
  const previous = state.undoStack.pop();
  if (!previous) return;
  session.start = previous;
  persistState();
  syncDetailInputs();
  renderAll();
  elements.undoAdjust.disabled = state.undoStack.length === 0;
}

function renderAll() {
  renderActiveSession();
  renderSuggestions();
  renderTimeline();
  updateMetrics();
}

function renderActiveSession() {
  const session = getCurrentSession();
  if (!session) {
    elements.activeSection.hidden = true;
    elements.undoAdjust.disabled = true;
    return;
  }

  elements.activeSection.hidden = false;
  elements.activeTitle.textContent = session.title;
  syncDetailInputs();
  elements.undoAdjust.disabled = state.undoStack.length === 0;
  updateTimerDisplay();
  elements.skillInput.value = session.skill || "";
  elements.tagsInput.value = (session.tags || []).join(", ");
  elements.intensitySelect.value = session.intensity || "";
  elements.notesInput.value = session.notes || "";
}

function syncDetailInputs() {
  const session = getCurrentSession();
  if (!session) return;
  const start = new Date(session.start);
  const now = new Date();
  const diffMinutes = Math.round((start.getTime() - now.getTime()) / 60000);
  const clamped = clamp(diffMinutes, Number(elements.startSlider.min), Number(elements.startSlider.max));
  sliderPreviewMinutes = clamped;
  elements.startSlider.value = String(clamped);
  updateStartHints(clamped, start);
}

function startTimer() {
  clearTimer();
  timerHandle = window.setInterval(updateTimerDisplay, 1000);
  updateTimerDisplay();
}

function clearTimer() {
  if (timerHandle) {
    clearInterval(timerHandle);
    timerHandle = null;
  }
}

function updateTimerDisplay() {
  const session = getCurrentSession();
  if (!session) return;
  const start = new Date(session.start);
  const endReference = session.end ? new Date(session.end) : new Date();
  const deltaMs = Math.max(endReference.getTime() - start.getTime(), 0);
  elements.timerDisplay.textContent = formatDuration(deltaMs);
}

function renderSuggestions() {
  const recentTitles = [];
  const seen = new Set();
  [...state.sessions]
    .reverse()
    .forEach((session) => {
      if (!seen.has(session.title)) {
        recentTitles.push(session.title);
        seen.add(session.title);
      }
    });
  const items = recentTitles.slice(0, 8);
  elements.suggestions.innerHTML = "";
  items.forEach((title) => {
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = "suggestion-chip";
    chip.textContent = title;
    chip.addEventListener("click", () => {
      elements.taskInput.value = title;
      elements.taskInput.focus();
    });
    elements.suggestions.appendChild(chip);
  });
}

function renderTimeline() {
  const todaySessions = state.sessions.filter((session) => session.end && isSameDay(new Date(session.end), new Date()));
  elements.timelineList.innerHTML = "";
  if (!todaySessions.length) {
    const placeholder = document.createElement("div");
    placeholder.textContent = "今日の記録はまだありません";
    placeholder.className = "empty";
    elements.timelineList.appendChild(placeholder);
    return;
  }

  todaySessions
    .sort((a, b) => new Date(a.start) - new Date(b.start))
    .forEach((session) => {
      const clone = elements.timelineTemplate.content.firstElementChild.cloneNode(true);
      clone.dataset.sessionId = session.id;
      clone.querySelector(".session-title").textContent = session.title;
      clone.querySelector(".session-duration").textContent = formatDuration(sessionDuration(session));
      clone.querySelector(".session-meta").textContent = buildMeta(session);
      clone.querySelector(".edit-session").addEventListener("click", () => openEditor(session.id));
      elements.timelineList.appendChild(clone);
    });
}

function buildMeta(session) {
  const parts = [];
  if (session.skill) parts.push(`Skill: ${session.skill}`);
  if (Array.isArray(session.tags) && session.tags.length) parts.push(`#${session.tags.join(" #")}`);
  if (session.intensity) {
    const label = intensityLabel(session.intensity);
    parts.push(`強度: ${label}`);
  }
  return parts.join(" / ") || "メタ情報なし";
}

function intensityLabel(value) {
  switch (value) {
    case "light":
      return "軽め";
    case "medium":
      return "標準";
    case "intense":
      return "追い込み";
    default:
      return "未設定";
  }
}

function sessionDuration(session) {
  const end = session.end ? new Date(session.end) : new Date();
  const start = new Date(session.start);
  return Math.max(end.getTime() - start.getTime(), 0);
}

function formatDuration(ms) {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) {
    return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${seconds
      .toString()
      .padStart(2, "0")}`;
  }
  return `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
}

function clamp(value, min, max) {
  return Math.max(Math.min(value, max), min);
}

function isSameDay(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function updateStartHints(minutes, absoluteDate) {
  const delta = minutes;
  elements.startDelta.textContent = delta === 0 ? "±0分" : delta > 0 ? `+${delta}分` : `${delta}分`;
  const basis = absoluteDate || new Date(Date.now() + delta * 60000);
  elements.startClock.textContent = `${basis.getHours().toString().padStart(2, "0")}:${basis
    .getMinutes()
    .toString()
    .padStart(2, "0")}`;
}

function commitSliderChange(minutes) {
  const session = getCurrentSession();
  if (!session) return;
  const target = new Date(Date.now() + minutes * 60000);
  const previous = new Date(session.start);
  if (Math.abs(target.getTime() - previous.getTime()) < 30000) {
    syncDetailInputs();
    return;
  }
  pushUndo(previous.toISOString());
  session.start = target.toISOString();
  session.adjustments.push({ type: "slider", minutes, at: new Date().toISOString() });
  persistState();
  syncDetailInputs();
  renderAll();
}

function applyNaturalInput() {
  const raw = elements.naturalStartInput.value.trim();
  if (!raw) return;
  const parsed = parseNaturalStart(raw);
  if (!parsed) {
    elements.naturalStartInput.classList.add("invalid");
    window.setTimeout(() => elements.naturalStartInput.classList.remove("invalid"), 1200);
    return;
  }
  const session = getCurrentSession();
  if (!session) return;
  const previous = new Date(session.start);
  pushUndo(previous.toISOString());
  session.start = parsed.toISOString();
  session.adjustments.push({ type: "natural", raw, at: new Date().toISOString() });
  persistState();
  elements.naturalStartInput.value = "";
  syncDetailInputs();
  renderAll();
}

function parseNaturalStart(input) {
  const now = new Date();
  const normalized = input
    .replace(/：/g, ":")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();

  if (!normalized) return null;

  const relativeMatch = normalized.match(/^(-?\d+)(m|min|分)$/);
  if (relativeMatch) {
    const value = Number(relativeMatch[1]);
    return new Date(now.getTime() + value * 60000);
  }

  const relativeHours = normalized.match(/^(-?\d+)(h|時間)$/);
  if (relativeHours) {
    const value = Number(relativeHours[1]);
    return new Date(now.getTime() + value * 3600000);
  }

  if (normalized === "now" || normalized === "いま") {
    return now;
  }

  const todayTime = normalized.match(/^(?:今日\s*)?(\d{1,2}):(\d{2})$/);
  if (todayTime) {
    const [_, hour, minute] = todayTime;
    const target = new Date(now);
    target.setHours(Number(hour), Number(minute), 0, 0);
    if (target > now) {
      return null;
    }
    return target;
  }

  const yesterdayTime = normalized.match(/^昨日\s*(\d{1,2}):(\d{2})$/);
  if (yesterdayTime) {
    const [_, hour, minute] = yesterdayTime;
    const target = new Date(now);
    target.setDate(target.getDate() - 1);
    target.setHours(Number(hour), Number(minute), 0, 0);
    return target;
  }

  const minutesAgo = normalized.match(/^(\d+)分前$/);
  if (minutesAgo) {
    const value = Number(minutesAgo[1]);
    return new Date(now.getTime() - value * 60000);
  }

  const hoursAgo = normalized.match(/^(\d+)時間前$/);
  if (hoursAgo) {
    const value = Number(hoursAgo[1]);
    return new Date(now.getTime() - value * 3600000);
  }

  return null;
}

function applyMetadataUpdates() {
  const session = getCurrentSession();
  if (!session) return;
  session.skill = elements.skillInput.value.trim();
  session.tags = elements.tagsInput.value
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
  session.intensity = elements.intensitySelect.value;
  session.notes = elements.notesInput.value.trim();
  persistState();
  renderTimeline();
}

function openEditor(sessionId) {
  const session = state.sessions.find((s) => s.id === sessionId);
  if (!session) return;
  const form = elements.editorDialog.querySelector("form");
  form.dataset.sessionId = session.id;
  form.title.value = session.title;
  form.start.value = isoToInput(session.start);
  form.end.value = session.end ? isoToInput(session.end) : isoToInput(new Date().toISOString());
  form.skill.value = session.skill || "";
  form.tags.value = (session.tags || []).join(", ");
  form.intensity.value = session.intensity || "";
  form.notes.value = session.notes || "";
  elements.editorDialog.showModal();
}

function handleEditorClose(event) {
  const value = event.target.returnValue;
  const form = elements.editorDialog.querySelector("form");
  const sessionId = form.dataset.sessionId;
  if (!sessionId) return;
  const sessionIndex = state.sessions.findIndex((s) => s.id === sessionId);
  if (sessionIndex === -1) return;
  const session = state.sessions[sessionIndex];

  if (value === "delete") {
    state.sessions.splice(sessionIndex, 1);
    if (state.currentSessionId === sessionId) {
      state.currentSessionId = null;
      clearTimer();
    }
    persistState();
    renderAll();
    return;
  }

  if (value === "save") {
    const start = form.start.valueAsNumber;
    const end = form.end.valueAsNumber;
    if (!start || !end || end <= start) {
      alert("終了時刻は開始時刻より後である必要があります");
      return;
    }
    session.title = form.title.value.trim();
    session.start = new Date(start).toISOString();
    session.end = new Date(end).toISOString();
    session.skill = form.skill.value.trim();
    session.tags = form.tags.value
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean);
    session.intensity = form.intensity.value;
    session.notes = form.notes.value.trim();
    persistState();
    renderAll();
  }
}

function isoToInput(isoString) {
  const date = new Date(isoString);
  const offset = date.getTimezoneOffset();
  const local = new Date(date.getTime() - offset * 60000);
  return local.toISOString().slice(0, 16);
}

function updateMetrics() {
  const completed = state.sessions.filter((session) => session.end);
  elements.streakChip.textContent = `Streak: ${computeStreak(completed)}日`;
  elements.weeklyTotalChip.textContent = `今週: ${formatHoursMinutes(totalThisWeek(completed))}`;
}

function computeStreak(completed) {
  if (!completed.length) return 0;
  const dates = Array.from(
    new Set(
      completed.map((session) => {
        const end = new Date(session.end);
        return end.toISOString().slice(0, 10);
      })
    )
  )
    .map((date) => new Date(date))
    .sort((a, b) => b - a);

  let streak = 0;
  let cursor = new Date();
  cursor.setHours(0, 0, 0, 0);

  for (const day of dates) {
    const dayStart = new Date(day);
    if (dayStart.getTime() === cursor.getTime()) {
      streak += 1;
      cursor.setDate(cursor.getDate() - 1);
    } else if (dayStart.getTime() === cursor.getTime() - 86400000) {
      streak += 1;
      cursor.setDate(cursor.getDate() - 1);
    } else if (dayStart.getTime() < cursor.getTime() - 86400000) {
      break;
    }
  }
  return streak;
}

function totalThisWeek(completed) {
  const now = new Date();
  const weekAgo = new Date(now.getTime() - 6 * 86400000);
  return completed
    .filter((session) => {
      const end = new Date(session.end);
      return end >= startOfDay(weekAgo);
    })
    .reduce((sum, session) => sum + sessionDuration(session), 0);
}

function startOfDay(date) {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function formatHoursMinutes(ms) {
  const totalMinutes = Math.floor(ms / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours}h ${minutes.toString().padStart(2, "0")}m`;
}

function clearHistory() {
  if (!state.sessions.length) return;
  if (!confirm("保存済みの履歴をすべて削除しますか？")) return;
  state.sessions = [];
  state.currentSessionId = null;
  state.undoStack = [];
  persistState();
  clearTimer();
  renderAll();
}

function handleStartButton() {
  const value = elements.taskInput.value.trim();
  if (!value) return;
  const session = getCurrentSession();
  if (session) {
    session.title = value;
    persistState();
    renderAll();
    elements.taskInput.select();
    return;
  }
  startSession(value);
}

// Event wiring

elements.startButton.addEventListener("click", handleStartButton);

elements.taskInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    event.preventDefault();
    handleStartButton();
  }
});

elements.quickButtons.forEach((button) => {
  button.addEventListener("click", () => {
    const minutes = Number(button.dataset.adjust);
    adjustStart(minutes);
  });
});

elements.undoAdjust.addEventListener("click", undoStartAdjust);

elements.toggleDetails.addEventListener("click", () => {
  isDetailOpen = !isDetailOpen;
  elements.detailPanel.hidden = !isDetailOpen;
  elements.toggleDetails.textContent = isDetailOpen ? "詳細を閉じる" : "詳細編集";
  if (isDetailOpen) {
    syncDetailInputs();
  }
});

elements.startSlider.addEventListener("input", (event) => {
  const value = Number(event.target.value);
  sliderPreviewMinutes = value;
  updateStartHints(value);
});

elements.startSlider.addEventListener("change", (event) => {
  const value = Number(event.target.value);
  commitSliderChange(value);
});

["skillInput", "tagsInput", "intensitySelect", "notesInput"].forEach((key) => {
  elements[key].addEventListener("change", applyMetadataUpdates);
  elements[key].addEventListener("blur", applyMetadataUpdates);
});

elements.applyNatural.addEventListener("click", applyNaturalInput);

elements.naturalStartInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    event.preventDefault();
    applyNaturalInput();
  }
});

elements.stopSession.addEventListener("click", stopSession);

elements.clearHistory.addEventListener("click", clearHistory);

elements.editorDialog.addEventListener("close", handleEditorClose);

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") {
    updateTimerDisplay();
  }
});

// Initial load
loadState();
renderAll();

if (getCurrentSession()) {
  startTimer();
}

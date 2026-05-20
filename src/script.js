/* =============================================
   FOCAL POINT — Pomodoro App
   script.js
   ============================================= */

// ---- STATE ----
const DEFAULT_SETTINGS = {
  pomodoro: 25,
  short: 5,
  long: 15,
  interval: 4,
  soundEnabled: true,
  autoStart: false
};

let settings = loadSettings();
let tasks = loadTasks();
let stats = loadStats();

let mode = 'pomodoro';
let sessionCount = 0;       // completed pomodoros since last long break
let totalInCycle = 0;       // total completed today
let timerInterval = null;
let secondsLeft = settings.pomodoro * 60;
let isRunning = false;
let totalSeconds = settings.pomodoro * 60;
let activeTaskId = null;

// ---- DOM REFS ----
const timeDisplay  = document.getElementById('timeDisplay');
const sessionLabel = document.getElementById('sessionLabel');
const sessionDots  = document.getElementById('sessionDots');
const sessionCount_el = document.getElementById('sessionCount');
const ringProgress = document.getElementById('ringProgress');
const startBtn     = document.getElementById('startBtn');
const resetBtn     = document.getElementById('resetBtn');
const skipBtn      = document.getElementById('skipBtn');
const taskList     = document.getElementById('taskList');
const emptyState   = document.getElementById('emptyState');
const taskInputWrap = document.getElementById('taskInputWrap');
const taskInput    = document.getElementById('taskInput');

// ---- TABS ----
document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', () => {
    pauseTimer();
    setMode(tab.dataset.mode);
    document.querySelectorAll('.tab').forEach(t => {
      t.classList.remove('active');
      t.setAttribute('aria-selected', 'false');
    });
    tab.classList.add('active');
    tab.setAttribute('aria-selected', 'true');
  });
});

function setMode(m) {
  mode = m;
  document.body.dataset.mode = m;
  const durations = { pomodoro: settings.pomodoro, short: settings.short, long: settings.long };
  const labels    = { pomodoro: 'Odaklan', short: 'Dinlen', long: 'Uzun Mola' };
  secondsLeft = durations[m] * 60;
  totalSeconds = secondsLeft;
  sessionLabel.textContent = labels[m];
  updateDisplay();
}

// ---- TIMER CORE ----
function startTimer() {
  isRunning = true;
  startBtn.textContent = 'Duraklat';
  startBtn.classList.add('running');
  timerInterval = setInterval(tick, 1000);
}

function pauseTimer() {
  isRunning = false;
  startBtn.textContent = 'Devam';
  startBtn.classList.remove('running');
  clearInterval(timerInterval);
}

function resetTimer() {
  pauseTimer();
  startBtn.textContent = 'Başlat';
  const durations = { pomodoro: settings.pomodoro, short: settings.short, long: settings.long };
  secondsLeft = durations[mode] * 60;
  totalSeconds = secondsLeft;
  updateDisplay();
}

function skipSession() {
  pauseTimer();
  if (mode === 'pomodoro') {
    completePomodoro(true);
  } else {
    setMode('pomodoro');
    document.querySelectorAll('.tab').forEach(t => {
      t.classList.toggle('active', t.dataset.mode === 'pomodoro');
    });
    startBtn.textContent = 'Başlat';
  }
}

function tick() {
  if (secondsLeft <= 0) {
    clearInterval(timerInterval);
    onTimerEnd();
    return;
  }
  secondsLeft--;
  updateDisplay();
}

function onTimerEnd() {
  playSound();
  if (mode === 'pomodoro') {
    completePomodoro(false);
  } else {
    // Break ended → back to pomodoro
    setMode('pomodoro');
    updateTabUI('pomodoro');
    if (settings.autoStart) startTimer();
    else { startBtn.textContent = 'Başlat'; startBtn.classList.remove('running'); isRunning = false; }
  }
}

function completePomodoro(skipped) {
  if (!skipped) {
    sessionCount++;
    totalInCycle++;
    stats.today++;
    stats.total++;
    saveStats();
    if (activeTaskId) bumpTaskPomodoro(activeTaskId);
    updateStats();
  }

  updateDots();

  const longBreakDue = sessionCount >= settings.interval;

  if (!skipped) {
    if (longBreakDue) {
      sessionCount = 0;
      setMode('long');
      updateTabUI('long');
    } else {
      setMode('short');
      updateTabUI('short');
    }
    if (settings.autoStart) startTimer();
    else { startBtn.textContent = 'Başlat'; startBtn.classList.remove('running'); isRunning = false; }
  } else {
    // skipped: decide next break
    if (longBreakDue) {
      sessionCount = 0;
      setMode('long');
      updateTabUI('long');
    } else {
      setMode('short');
      updateTabUI('short');
    }
    startBtn.textContent = 'Başlat';
    startBtn.classList.remove('running');
    isRunning = false;
  }

  sessionCount_el.textContent = Math.min(totalInCycle + 1, 99);
}

function updateTabUI(m) {
  document.querySelectorAll('.tab').forEach(t => {
    t.classList.toggle('active', t.dataset.mode === m);
    t.setAttribute('aria-selected', t.dataset.mode === m ? 'true' : 'false');
  });
}

// ---- DISPLAY ----
function updateDisplay() {
  const m = String(Math.floor(secondsLeft / 60)).padStart(2, '0');
  const s = String(secondsLeft % 60).padStart(2, '0');
  timeDisplay.textContent = `${m}:${s}`;
  document.title = `${m}:${s} — Focal Point`;

  // Ring
  const circumference = 2 * Math.PI * 100; // r=100
  const progress = secondsLeft / totalSeconds;
  ringProgress.style.strokeDashoffset = circumference * (1 - progress);
}

function updateDots() {
  sessionDots.innerHTML = '';
  for (let i = 0; i < settings.interval; i++) {
    const dot = document.createElement('span');
    dot.className = 'dot' + (i < sessionCount ? ' filled' : '');
    sessionDots.appendChild(dot);
  }
}

// ---- CONTROLS ----
startBtn.addEventListener('click', () => {
  if (isRunning) pauseTimer();
  else startTimer();
});

resetBtn.addEventListener('click', resetTimer);
skipBtn.addEventListener('click', skipSession);

// ---- SOUND ----
function playSound() {
  if (!settings.soundEnabled) return;
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    [0, 0.15, 0.3].forEach((delay, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = i === 0 ? 880 : i === 1 ? 1100 : 660;
      osc.type = 'sine';
      gain.gain.setValueAtTime(0.3, ctx.currentTime + delay);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + delay + 0.3);
      osc.start(ctx.currentTime + delay);
      osc.stop(ctx.currentTime + delay + 0.35);
    });
  } catch(e) { /* AudioContext not available */ }
}

// ---- TASKS ----
document.getElementById('addTaskBtn').addEventListener('click', () => {
  taskInputWrap.hidden = false;
  taskInput.focus();
});

document.getElementById('confirmTask').addEventListener('click', addTask);
document.getElementById('cancelTask').addEventListener('click', () => {
  taskInputWrap.hidden = true;
  taskInput.value = '';
});

taskInput.addEventListener('keydown', e => {
  if (e.key === 'Enter') addTask();
  if (e.key === 'Escape') {
    taskInputWrap.hidden = true;
    taskInput.value = '';
  }
});

function addTask() {
  const name = taskInput.value.trim();
  if (!name) return;
  const task = {
    id: Date.now().toString(),
    name,
    done: false,
    pomodoros: 0,
    createdAt: Date.now()
  };
  tasks.push(task);
  saveTasks();
  taskInput.value = '';
  taskInputWrap.hidden = true;
  renderTasks();
}

function bumpTaskPomodoro(id) {
  const task = tasks.find(t => t.id === id);
  if (task) { task.pomodoros++; saveTasks(); renderTasks(); }
}

function renderTasks() {
  taskList.innerHTML = '';
  const visible = tasks.filter(t => !t.done).concat(tasks.filter(t => t.done));

  emptyState.style.display = visible.length === 0 ? '' : 'none';

  visible.forEach(task => {
    const li = document.createElement('li');
    li.className = 'task-item' + (task.done ? ' done' : '') + (task.id === activeTaskId ? ' active-task' : '');
    li.innerHTML = `
      <span class="task-check">${task.done ? '✓' : ''}</span>
      <span class="task-name">${escHtml(task.name)}${task.pomodoros > 0 ? `<span style="opacity:.4;font-size:.75rem;margin-left:.5rem">🍅×${task.pomodoros}</span>` : ''}</span>
      <button class="task-delete" title="Sil" aria-label="Görevi sil">✕</button>
    `;

    // Toggle done
    li.querySelector('.task-check').addEventListener('click', e => {
      e.stopPropagation();
      task.done = !task.done;
      if (task.done && activeTaskId === task.id) activeTaskId = null;
      if (task.done) stats.tasksCompleted++;
      else stats.tasksCompleted = Math.max(0, stats.tasksCompleted - 1);
      saveTasks(); saveStats(); renderTasks(); updateStats();
    });

    // Set active
    li.addEventListener('click', () => {
      if (task.done) return;
      activeTaskId = activeTaskId === task.id ? null : task.id;
      renderTasks();
    });

    // Delete
    li.querySelector('.task-delete').addEventListener('click', e => {
      e.stopPropagation();
      tasks = tasks.filter(t => t.id !== task.id);
      if (activeTaskId === task.id) activeTaskId = null;
      saveTasks(); renderTasks();
    });

    taskList.appendChild(li);
  });
}

// ---- SETTINGS MODAL ----
document.getElementById('settingsBtn').addEventListener('click', () => {
  document.getElementById('setPomodoro').value = settings.pomodoro;
  document.getElementById('setShort').value    = settings.short;
  document.getElementById('setLong').value     = settings.long;
  document.getElementById('setInterval').value = settings.interval;
  document.getElementById('setSoundEnabled').checked = settings.soundEnabled;
  document.getElementById('setAutoStart').checked    = settings.autoStart;
  document.getElementById('settingsModal').hidden = false;
});

document.getElementById('closeSettings').addEventListener('click', () => {
  document.getElementById('settingsModal').hidden = true;
});

document.getElementById('saveSettings').addEventListener('click', () => {
  settings.pomodoro     = parseInt(document.getElementById('setPomodoro').value) || 25;
  settings.short        = parseInt(document.getElementById('setShort').value) || 5;
  settings.long         = parseInt(document.getElementById('setLong').value) || 15;
  settings.interval     = parseInt(document.getElementById('setInterval').value) || 4;
  settings.soundEnabled = document.getElementById('setSoundEnabled').checked;
  settings.autoStart    = document.getElementById('setAutoStart').checked;
  saveSettings();
  document.getElementById('settingsModal').hidden = true;
  pauseTimer();
  setMode(mode);
  updateDots();
});

document.getElementById('settingsModal').addEventListener('click', e => {
  if (e.target === e.currentTarget) e.currentTarget.hidden = true;
});

// ---- STATS MODAL ----
document.getElementById('statsBtn').addEventListener('click', () => {
  updateStats();
  document.getElementById('statsModal').hidden = false;
});

document.getElementById('closeStats').addEventListener('click', () => {
  document.getElementById('statsModal').hidden = true;
});

document.getElementById('statsModal').addEventListener('click', e => {
  if (e.target === e.currentTarget) e.currentTarget.hidden = true;
});

document.getElementById('resetStats').addEventListener('click', () => {
  if (!confirm('İstatistikler sıfırlansın mı?')) return;
  stats = { today: 0, total: 0, streak: 0, tasksCompleted: 0, lastDate: null };
  saveStats();
  updateStats();
});

function updateStats() {
  document.getElementById('statToday').textContent  = stats.today;
  document.getElementById('statTotal').textContent  = stats.total;
  document.getElementById('statStreak').textContent = stats.streak;
  document.getElementById('statTasks').textContent  = stats.tasksCompleted;
}

// ---- PERSISTENCE ----
function loadSettings() {
  try { return { ...DEFAULT_SETTINGS, ...JSON.parse(localStorage.getItem('fp_settings') || '{}') }; }
  catch(e) { return { ...DEFAULT_SETTINGS }; }
}

function saveSettings() {
  localStorage.setItem('fp_settings', JSON.stringify(settings));
}

function loadTasks() {
  try { return JSON.parse(localStorage.getItem('fp_tasks') || '[]'); }
  catch(e) { return []; }
}

function saveTasks() {
  localStorage.setItem('fp_tasks', JSON.stringify(tasks));
}

function loadStats() {
  try {
    const s = JSON.parse(localStorage.getItem('fp_stats') || '{}');
    // Reset 'today' if it's a new day
    const today = new Date().toDateString();
    if (s.lastDate !== today) {
      s.today = 0;
      // Streak logic
      if (s.lastDate) {
        const last = new Date(s.lastDate);
        const now  = new Date();
        const diff = Math.round((now - last) / 86400000);
        if (diff === 1) s.streak = (s.streak || 0) + 1;
        else if (diff > 1) s.streak = 0;
      }
      s.lastDate = today;
    }
    return { today: 0, total: 0, streak: 0, tasksCompleted: 0, lastDate: today, ...s };
  } catch(e) {
    return { today: 0, total: 0, streak: 0, tasksCompleted: 0, lastDate: new Date().toDateString() };
  }
}

function saveStats() {
  stats.lastDate = new Date().toDateString();
  localStorage.setItem('fp_stats', JSON.stringify(stats));
}

// ---- UTILS ----
function escHtml(str) {
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ---- INIT ----
(function init() {
  document.body.dataset.mode = mode;
  updateDisplay();
  updateDots();
  renderTasks();
  updateStats();
  sessionCount_el.textContent = 1;
})();
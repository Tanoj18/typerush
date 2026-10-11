/**
 * TypeRush — Responsive Typing Speed Platform
 * Core Engine, State Management, and Shuffled Passage Queues
 * 
 * Formulas:
 * - Net WPM = Math.max(0, Math.round((correctCharacters / 5) / (elapsedSeconds / 60)))
 * - Accuracy = totalTyped > 0 ? Math.round((correctCharacters / totalTyped) * 100) : 100
 */

(function () {
  'use strict';

  // --- PASSAGE LIBRARY INITIALIZATION ---
  const LIBRARY = (typeof window !== 'undefined' && window.PASSAGE_LIBRARY)
    ? window.PASSAGE_LIBRARY
    : (typeof PASSAGE_LIBRARY !== 'undefined' ? PASSAGE_LIBRARY : {
        beginner: [],
        intermediate: [],
        advanced: []
      });

  const PASSAGE_MAP = new Map();
  ['beginner', 'intermediate', 'advanced'].forEach(lvl => {
    (LIBRARY[lvl] || []).forEach(item => {
      PASSAGE_MAP.set(item.id, item);
    });
  });

  const LEVEL_CONFIG = {
    1: { goalWpm: 15, minAcc: 90, nextLevel: 2, label: "Level 1 (Beginner)", key: "beginner" },
    2: { goalWpm: 30, minAcc: 90, nextLevel: 3, label: "Level 2 (Intermediate)", key: "intermediate" },
    3: { goalWpm: 45, minAcc: 90, nextLevel: null, label: "Level 3 (Advanced)", key: "advanced" }
  };

  const STORAGE_KEY = 'typerush_user_stats';
  const QUEUES_STORAGE_KEY = 'typerush_passage_queues';

  // --- FISHER-YATES SHUFFLE ALGORITHM ---
  function fisherYatesShuffle(array) {
    const arr = array.slice();
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const temp = arr[i];
      arr[i] = arr[j];
      arr[j] = temp;
    }
    return arr;
  }

  function normalizeLevel(level) {
    if (level === 1 || level === '1' || level === 'beginner') return 'beginner';
    if (level === 2 || level === '2' || level === 'intermediate') return 'intermediate';
    if (level === 3 || level === '3' || level === 'advanced') return 'advanced';
    return 'beginner';
  }

  // --- PASSAGE QUEUE MANAGER ---
  class PassageQueueManager {
    constructor() {
      this.queues = {
        practice_beginner: { queue: [], currentIndex: 0, lastId: null },
        practice_intermediate: { queue: [], currentIndex: 0, lastId: null },
        practice_advanced: { queue: [], currentIndex: 0, lastId: null },
        competitive_beginner: { queue: [], currentIndex: 0, lastId: null },
        competitive_intermediate: { queue: [], currentIndex: 0, lastId: null },
        competitive_advanced: { queue: [], currentIndex: 0, lastId: null }
      };
      this.loadFromStorage();
    }

    loadFromStorage() {
      try {
        const raw = localStorage.getItem(QUEUES_STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed && typeof parsed === 'object') {
            Object.keys(this.queues).forEach(key => {
              if (parsed[key] && Array.isArray(parsed[key].queue)) {
                const parts = key.split('_');
                const level = parts[1];
                const pool = LIBRARY[level] || [];
                const validIds = new Set(pool.map(p => p.id));
                const savedQueue = parsed[key].queue;

                // Validate that all IDs exist in current library
                if (savedQueue.length > 0 && savedQueue.every(id => validIds.has(id))) {
                  const idx = Number(parsed[key].currentIndex) || 0;
                  this.queues[key] = {
                    queue: savedQueue,
                    currentIndex: Math.max(0, Math.min(idx, savedQueue.length)),
                    lastId: parsed[key].lastId || null
                  };
                }
              }
            });
          }
        }
      } catch (e) {
        console.warn("TypeRush: Unable to load stored passage queues. Resetting fresh.", e);
      }

      // Initialize any empty queue
      Object.keys(this.queues).forEach(key => {
        if (!this.queues[key].queue || this.queues[key].queue.length === 0) {
          this.refillQueue(key);
        }
      });
    }

    saveToStorage() {
      try {
        localStorage.setItem(QUEUES_STORAGE_KEY, JSON.stringify(this.queues));
      } catch (e) {
        console.warn("TypeRush: Failed saving passage queues to localStorage.", e);
      }
    }

    refillQueue(key) {
      const parts = key.split('_');
      const level = parts[1];
      const pool = LIBRARY[level] || [];
      const allIds = pool.map(p => p.id);

      if (allIds.length === 0) {
        this.queues[key] = { queue: [], currentIndex: 0, lastId: null };
        return;
      }

      let shuffled = fisherYatesShuffle(allIds);

      // Prevent boundary repeats across cycle boundaries
      const previousLastId = this.queues[key]?.lastId;
      if (previousLastId && shuffled.length > 1 && shuffled[0] === previousLastId) {
        const swapIdx = 1 + Math.floor(Math.random() * (shuffled.length - 1));
        const temp = shuffled[0];
        shuffled[0] = shuffled[swapIdx];
        shuffled[swapIdx] = temp;
      }

      this.queues[key] = {
        queue: shuffled,
        currentIndex: 0,
        lastId: previousLastId || null
      };
    }

    getNextPassage(mode, level) {
      const normLevel = normalizeLevel(level);
      const key = `${mode}_${normLevel}`;

      let qState = this.queues[key];
      if (!qState || !qState.queue || qState.currentIndex >= qState.queue.length) {
        this.refillQueue(key);
        qState = this.queues[key];
      }

      const nextId = qState.queue[qState.currentIndex];
      qState.currentIndex += 1;
      qState.lastId = nextId;

      this.saveToStorage();

      const passageObj = PASSAGE_MAP.get(nextId);
      if (passageObj) {
        return passageObj;
      }

      // Fallback safeguard
      const fallbackPool = LIBRARY[normLevel] || LIBRARY.beginner;
      return fallbackPool[0] || { id: "fallback", text: "Practice typing with steady rhythm and focus." };
    }

    resetAll() {
      Object.keys(this.queues).forEach(key => {
        this.refillQueue(key);
      });
      try {
        localStorage.removeItem(QUEUES_STORAGE_KEY);
      } catch (e) {}
    }
  }

  const passageManager = new PassageQueueManager();

  // --- APPLICATION STATE ---
  const state = {
    currentView: 'home',

    // Practice state
    practice: {
      level: 1,
      targetTimeSeconds: 0, // 0 = untimed
      passage: '',
      passageId: null,
      startTime: null,
      timerInterval: null,
      isActive: false,
      isFinished: false,
      correctChars: 0,
      incorrectChars: 0,
      totalTyped: 0,
      elapsedSeconds: 0
    },

    // Competitive state
    comp: {
      difficulty: 'beginner', // 'beginner' | 'intermediate' | 'advanced'
      durationSeconds: 30,
      passage: '',
      passageId: null,
      startTime: null,
      timerInterval: null,
      isActive: false,
      isFinished: false,
      correctChars: 0,
      incorrectChars: 0,
      totalTyped: 0,
      remainingSeconds: 30,
      elapsedSeconds: 0
    },

    // User persistent records
    stats: {
      totalTests: 0,
      personalBestWpm: 0,
      bestAccuracy: 0,
      unlockedLevels: [1],
      bestByMode: {
        practice: { wpm: 0, acc: 0 },
        comp30: { wpm: 0, acc: 0 },
        comp60: { wpm: 0, acc: 0 },
        comp120: { wpm: 0, acc: 0 }
      },
      history: []
    }
  };

  // --- DOM ELEMENT REFERENCES ---
  const dom = {
    // Nav links
    navLinks: document.querySelectorAll('.nav-link'),
    views: {
      home: document.getElementById('view-home'),
      practice: document.getElementById('view-practice'),
      competitive: document.getElementById('view-competitive'),
      stats: document.getElementById('view-stats')
    },
    logoLink: document.getElementById('logoLink'),
    btnHeroPractice: document.getElementById('btnHeroPractice'),
    btnHeroCompetitive: document.getElementById('btnHeroCompetitive'),

    // Home snapshot
    homeBestWpm: document.getElementById('homeBestWpm'),
    homeBestAccuracy: document.getElementById('homeBestAccuracy'),
    homeTestsCompleted: document.getElementById('homeTestsCompleted'),

    // Practice Mode elements
    btnLevel1: document.getElementById('btnLevel1'),
    btnLevel2: document.getElementById('btnLevel2'),
    btnLevel3: document.getElementById('btnLevel3'),
    lockLevel2: document.getElementById('lockLevel2'),
    lockLevel3: document.getElementById('lockLevel3'),
    practiceGoalTarget: document.getElementById('practiceGoalTarget'),
    practiceTimeBtns: [
      document.getElementById('btnPracticeUntimed'),
      document.getElementById('btnPractice30'),
      document.getElementById('btnPractice60'),
      document.getElementById('btnPractice120')
    ],
    practiceTimerLabel: document.getElementById('practiceTimerLabel'),
    practiceTimerDisplay: document.getElementById('practiceTimerDisplay'),
    practiceWpmDisplay: document.getElementById('practiceWpmDisplay'),
    practiceAccuracyDisplay: document.getElementById('practiceAccuracyDisplay'),
    practiceProgressDisplay: document.getElementById('practiceProgressDisplay'),
    practiceTypingCard: document.getElementById('practiceTypingCard'),
    practiceStatusHint: document.getElementById('practiceStatusHint'),
    practiceTextDisplay: document.getElementById('practiceTextDisplay'),
    practiceInput: document.getElementById('practiceInput'),
    btnPracticeRestart: document.getElementById('btnPracticeRestart'),
    btnPracticeNewPassage: document.getElementById('btnPracticeNewPassage'),

    // Practice Results Modal
    practiceResultsModal: document.getElementById('practiceResultsModal'),
    practiceUnlockBanner: document.getElementById('practiceUnlockBanner'),
    practiceUnlockTitle: document.getElementById('practiceUnlockTitle'),
    practiceUnlockDesc: document.getElementById('practiceUnlockDesc'),
    resPracticeWpm: document.getElementById('resPracticeWpm'),
    resPracticeAccuracy: document.getElementById('resPracticeAccuracy'),
    resPracticeTime: document.getElementById('resPracticeTime'),
    resPracticeCorrect: document.getElementById('resPracticeCorrect'),
    resPracticeIncorrect: document.getElementById('resPracticeIncorrect'),
    practiceTargetStatus: document.getElementById('practiceTargetStatus'),
    btnPracticeModalRetry: document.getElementById('btnPracticeModalRetry'),
    btnPracticeModalNext: document.getElementById('btnPracticeModalNext'),

    // Competitive Mode elements
    btnCompLevelBeginner: document.getElementById('btnCompLevelBeginner'),
    btnCompLevelIntermediate: document.getElementById('btnCompLevelIntermediate'),
    btnCompLevelAdvanced: document.getElementById('btnCompLevelAdvanced'),
    compTimeBtns: [
      document.getElementById('btnComp30'),
      document.getElementById('btnComp60'),
      document.getElementById('btnComp120')
    ],
    compStatusText: document.getElementById('compStatusText'),
    compTimerDisplay: document.getElementById('compTimerDisplay'),
    compWpmDisplay: document.getElementById('compWpmDisplay'),
    compAccuracyDisplay: document.getElementById('compAccuracyDisplay'),
    compCharsDisplay: document.getElementById('compCharsDisplay'),
    compTypingCard: document.getElementById('compTypingCard'),
    compStatusHint: document.getElementById('compStatusHint'),
    compTextDisplay: document.getElementById('compTextDisplay'),
    compInput: document.getElementById('compInput'),
    btnCompRestart: document.getElementById('btnCompRestart'),
    btnCompNewPassage: document.getElementById('btnCompNewPassage'),

    // Competitive Results Modal
    compResultsModal: document.getElementById('compResultsModal'),
    compPbTag: document.getElementById('compPbTag'),
    compPbText: document.getElementById('compPbText'),
    resCompWpm: document.getElementById('resCompWpm'),
    resCompAccuracy: document.getElementById('resCompAccuracy'),
    resCompDuration: document.getElementById('resCompDuration'),
    resCompCorrect: document.getElementById('resCompCorrect'),
    resCompIncorrect: document.getElementById('resCompIncorrect'),
    btnCompModalRetry: document.getElementById('btnCompModalRetry'),
    btnCompModalPractice: document.getElementById('btnCompModalPractice'),
    btnCompModalShare: document.getElementById('btnCompModalShare'),
    compShareToast: document.getElementById('compShareToast'),

    // Stats View
    statsTotalTests: document.getElementById('statsTotalTests'),
    statsPbWpm: document.getElementById('statsPbWpm'),
    statsPbAccuracy: document.getElementById('statsPbAccuracy'),
    statsUnlockedLevels: document.getElementById('statsUnlockedLevels'),
    statsPracticeBestWpm: document.getElementById('statsPracticeBestWpm'),
    statsPracticeBestAcc: document.getElementById('statsPracticeBestAcc'),
    statsComp30BestWpm: document.getElementById('statsComp30BestWpm'),
    statsComp30BestAcc: document.getElementById('statsComp30BestAcc'),
    statsComp60BestWpm: document.getElementById('statsComp60BestWpm'),
    statsComp60BestAcc: document.getElementById('statsComp60BestAcc'),
    statsComp120BestWpm: document.getElementById('statsComp120BestWpm'),
    statsComp120BestAcc: document.getElementById('statsComp120BestAcc'),
    historyTableBody: document.getElementById('historyTableBody'),
    historyEmptyState: document.getElementById('historyEmptyState'),
    btnResetStats: document.getElementById('btnResetStats'),
    resetConfirmModal: document.getElementById('resetConfirmModal'),
    btnConfirmReset: document.getElementById('btnConfirmReset'),
    btnCancelReset: document.getElementById('btnCancelReset')
  };

  // --- STORAGE UTILITIES ---
  function loadStoredStats() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        state.stats.totalTests = Number(parsed.totalTests) || 0;
        state.stats.personalBestWpm = Number(parsed.personalBestWpm) || 0;
        state.stats.bestAccuracy = Number(parsed.bestAccuracy) || 0;
        if (Array.isArray(parsed.unlockedLevels) && parsed.unlockedLevels.length > 0) {
          state.stats.unlockedLevels = parsed.unlockedLevels;
        }
        if (parsed.bestByMode) {
          state.stats.bestByMode = {
            practice: {
              wpm: Number(parsed.bestByMode.practice?.wpm) || 0,
              acc: Number(parsed.bestByMode.practice?.acc) || 0
            },
            comp30: {
              wpm: Number(parsed.bestByMode.comp30?.wpm) || 0,
              acc: Number(parsed.bestByMode.comp30?.acc) || 0
            },
            comp60: {
              wpm: Number(parsed.bestByMode.comp60?.wpm) || 0,
              acc: Number(parsed.bestByMode.comp60?.acc) || 0
            },
            comp120: {
              wpm: Number(parsed.bestByMode.comp120?.wpm) || 0,
              acc: Number(parsed.bestByMode.comp120?.acc) || 0
            }
          };
        }
        if (Array.isArray(parsed.history)) {
          state.stats.history = parsed.history.slice(0, 30);
        }
      }
    } catch (e) {
      console.warn("TypeRush: Unable to load localStorage statistics, using clean defaults.", e);
    }
  }

  function saveStats() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state.stats));
    } catch (e) {
      console.warn("TypeRush: Failed saving statistics to localStorage.", e);
    }
  }

  function resetAllStats() {
    state.stats = {
      totalTests: 0,
      personalBestWpm: 0,
      bestAccuracy: 0,
      unlockedLevels: [1],
      bestByMode: {
        practice: { wpm: 0, acc: 0 },
        comp30: { wpm: 0, acc: 0 },
        comp60: { wpm: 0, acc: 0 },
        comp120: { wpm: 0, acc: 0 }
      },
      history: []
    };
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (e) {}

    passageManager.resetAll();
    updateLevelLocksUI();
    renderStatsView();
    renderHomeStats();
  }

  // --- CALCULATION HELPERS ---
  function calculateWpm(correctChars, elapsedSeconds) {
    if (elapsedSeconds <= 0.5 || correctChars <= 0) return 0;
    const minutes = elapsedSeconds / 60;
    const wpm = Math.round((correctChars / 5) / minutes);
    return isFinite(wpm) ? Math.max(0, wpm) : 0;
  }

  function calculateAccuracy(correctChars, totalTyped) {
    if (totalTyped <= 0) return 100;
    const acc = Math.round((correctChars / totalTyped) * 100);
    return isFinite(acc) ? Math.min(100, Math.max(0, acc)) : 100;
  }

  function formatTime(totalSeconds) {
    const s = Math.max(0, Math.floor(totalSeconds));
    const mins = Math.floor(s / 60);
    const secs = s % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  }

  // --- NAVIGATION & VIEW ROUTING ---
  function switchView(targetView) {
    state.currentView = targetView;

    dom.navLinks.forEach(link => {
      const view = link.getAttribute('data-view');
      if (view === targetView) {
        link.classList.add('active');
        link.setAttribute('aria-current', 'page');
      } else {
        link.classList.remove('active');
        link.removeAttribute('aria-current');
      }
    });

    Object.keys(dom.views).forEach(key => {
      if (key === targetView) {
        dom.views[key].removeAttribute('hidden');
        dom.views[key].classList.add('active');
      } else {
        dom.views[key].setAttribute('hidden', '');
        dom.views[key].classList.remove('active');
      }
    });

    if (targetView !== 'practice') resetPracticeTest(false);
    if (targetView !== 'competitive') resetCompTest(false);

    if (targetView === 'home') {
      renderHomeStats();
    } else if (targetView === 'practice') {
      initPracticeMode();
    } else if (targetView === 'competitive') {
      initCompMode();
    } else if (targetView === 'stats') {
      renderStatsView();
    }

    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // --- HOME VIEW RENDERING ---
  function renderHomeStats() {
    dom.homeBestWpm.innerHTML = `${state.stats.personalBestWpm} <abbr title="Words Per Minute" class="stat-unit">WPM</abbr>`;
    dom.homeBestAccuracy.textContent = `${state.stats.bestAccuracy}%`;
    dom.homeTestsCompleted.textContent = state.stats.totalTests;
  }

  // --- PRACTICE MODE ENGINE ---
  function updateLevelLocksUI() {
    const isL2Unlocked = state.stats.unlockedLevels.includes(2);
    const isL3Unlocked = state.stats.unlockedLevels.includes(3);

    dom.btnLevel2.disabled = !isL2Unlocked;
    if (dom.lockLevel2) dom.lockLevel2.style.display = isL2Unlocked ? 'none' : 'inline';

    dom.btnLevel3.disabled = !isL3Unlocked;
    if (dom.lockLevel3) dom.lockLevel3.style.display = isL3Unlocked ? 'none' : 'inline';

    [dom.btnLevel1, dom.btnLevel2, dom.btnLevel3].forEach((btn, idx) => {
      const lvl = idx + 1;
      if (lvl === state.practice.level) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });

    const cfg = LEVEL_CONFIG[state.practice.level];
    if (cfg.nextLevel) {
      const nextUnlocked = state.stats.unlockedLevels.includes(cfg.nextLevel);
      if (nextUnlocked) {
        dom.practiceGoalTarget.textContent = `${cfg.goalWpm} WPM with ${cfg.minAcc}%+ accuracy (Unlocked ${LEVEL_CONFIG[cfg.nextLevel].label})`;
      } else {
        dom.practiceGoalTarget.textContent = `${cfg.goalWpm} WPM with ${cfg.minAcc}%+ accuracy to unlock ${LEVEL_CONFIG[cfg.nextLevel].label}`;
      }
    } else {
      dom.practiceGoalTarget.textContent = `${cfg.goalWpm} WPM with ${cfg.minAcc}%+ accuracy (Master Level)`;
    }
  }

  function renderPassageText(container, passageText, typedValue) {
    container.innerHTML = '';
    const passageChars = passageText.split('');
    const typedChars = typedValue.split('');

    const fragment = document.createDocumentFragment();

    for (let i = 0; i < passageChars.length; i++) {
      const span = document.createElement('span');
      span.className = 'char';
      span.textContent = passageChars[i];

      if (i < typedChars.length) {
        if (typedChars[i] === passageChars[i]) {
          span.classList.add('correct');
        } else {
          span.classList.add('incorrect');
        }
      } else if (i === typedChars.length) {
        span.classList.add('current');
      }

      fragment.appendChild(span);
    }

    container.appendChild(fragment);
  }

  function initPracticeMode() {
    updateLevelLocksUI();
    resetPracticeTest(true);
  }

  function resetPracticeTest(getNewPassage = false) {
    if (state.practice.timerInterval) {
      clearInterval(state.practice.timerInterval);
      state.practice.timerInterval = null;
    }

    state.practice.isActive = false;
    state.practice.isFinished = false;
    state.practice.startTime = null;
    state.practice.elapsedSeconds = 0;
    state.practice.correctChars = 0;
    state.practice.incorrectChars = 0;
    state.practice.totalTyped = 0;

    dom.practiceInput.value = '';
    dom.practiceInput.disabled = false;
    dom.practiceTypingCard.classList.remove('in-progress');
    dom.practiceResultsModal.setAttribute('hidden', '');

    if (getNewPassage || !state.practice.passage) {
      const nextPassageObj = passageManager.getNextPassage('practice', state.practice.level);
      state.practice.passage = nextPassageObj.text;
      state.practice.passageId = nextPassageObj.id;
    }

    renderPassageText(dom.practiceTextDisplay, state.practice.passage, '');

    dom.practiceWpmDisplay.textContent = '0';
    dom.practiceAccuracyDisplay.textContent = '100%';
    dom.practiceProgressDisplay.textContent = '0%';

    if (state.practice.targetTimeSeconds > 0) {
      dom.practiceTimerLabel.textContent = 'Time Left';
      dom.practiceTimerDisplay.textContent = `${state.practice.targetTimeSeconds}s`;
      dom.practiceStatusHint.textContent = `Timed (${state.practice.targetTimeSeconds}s): Type the first character to begin`;
    } else {
      dom.practiceTimerLabel.textContent = 'Time';
      dom.practiceTimerDisplay.textContent = '0:00';
      dom.practiceStatusHint.textContent = 'Untimed: Click here or start typing to begin';
    }

    setTimeout(() => {
      dom.practiceInput.focus();
    }, 50);
  }

  function startPracticeTimer() {
    state.practice.isActive = true;
    state.practice.startTime = performance.now();
    dom.practiceTypingCard.classList.add('in-progress');
    dom.practiceStatusHint.textContent = 'Practice in progress... Focus on rhythm and posture.';

    state.practice.timerInterval = setInterval(() => {
      const now = performance.now();
      const elapsedSec = (now - state.practice.startTime) / 1000;
      state.practice.elapsedSeconds = elapsedSec;

      if (state.practice.targetTimeSeconds > 0) {
        const remaining = Math.max(0, Math.ceil(state.practice.targetTimeSeconds - elapsedSec));
        dom.practiceTimerDisplay.textContent = `${remaining}s`;

        if (remaining <= 0) {
          finishPracticeTest();
          return;
        }
      } else {
        dom.practiceTimerDisplay.textContent = formatTime(elapsedSec);
      }

      const wpm = calculateWpm(state.practice.correctChars, elapsedSec);
      const acc = calculateAccuracy(state.practice.correctChars, state.practice.totalTyped);
      dom.practiceWpmDisplay.textContent = wpm;
      dom.practiceAccuracyDisplay.textContent = `${acc}%`;
    }, 150);
  }

  function handlePracticeInput() {
    if (state.practice.isFinished) return;

    const val = dom.practiceInput.value;
    const passage = state.practice.passage;

    if (!state.practice.isActive && val.length > 0) {
      startPracticeTimer();
    }

    let correct = 0;
    let incorrect = 0;
    for (let i = 0; i < val.length; i++) {
      if (i < passage.length) {
        if (val[i] === passage[i]) correct++;
        else incorrect++;
      } else {
        incorrect++;
      }
    }

    state.practice.correctChars = correct;
    state.practice.incorrectChars = incorrect;
    state.practice.totalTyped = val.length;

    const progress = Math.min(100, Math.round((val.length / passage.length) * 100));
    dom.practiceProgressDisplay.textContent = `${progress}%`;

    if (state.practice.isActive) {
      const elapsed = Math.max(0.5, (performance.now() - state.practice.startTime) / 1000);
      const wpm = calculateWpm(correct, elapsed);
      const acc = calculateAccuracy(correct, val.length);
      dom.practiceWpmDisplay.textContent = wpm;
      dom.practiceAccuracyDisplay.textContent = `${acc}%`;
    }

    renderPassageText(dom.practiceTextDisplay, passage, val);

    if (val.length >= passage.length) {
      finishPracticeTest();
    }
  }

  function finishPracticeTest() {
    if (state.practice.isFinished) return;
    state.practice.isFinished = true;
    state.practice.isActive = false;

    if (state.practice.timerInterval) {
      clearInterval(state.practice.timerInterval);
      state.practice.timerInterval = null;
    }

    dom.practiceInput.disabled = true;
    dom.practiceTypingCard.classList.remove('in-progress');

    const totalElapsedSec = state.practice.startTime
      ? Math.max(1, (performance.now() - state.practice.startTime) / 1000)
      : Math.max(1, state.practice.elapsedSeconds);

    const finalWpm = calculateWpm(state.practice.correctChars, totalElapsedSec);
    const finalAcc = calculateAccuracy(state.practice.correctChars, state.practice.totalTyped);

    const currentLvlCfg = LEVEL_CONFIG[state.practice.level];
    const isGoalAchieved = finalWpm >= currentLvlCfg.goalWpm && finalAcc >= currentLvlCfg.minAcc;

    let newlyUnlocked = false;
    let nextTierName = '';

    if (isGoalAchieved && currentLvlCfg.nextLevel) {
      if (!state.stats.unlockedLevels.includes(currentLvlCfg.nextLevel)) {
        state.stats.unlockedLevels.push(currentLvlCfg.nextLevel);
        state.stats.unlockedLevels.sort((a, b) => a - b);
        newlyUnlocked = true;
        nextTierName = LEVEL_CONFIG[currentLvlCfg.nextLevel].label;
      }
    }

    state.stats.totalTests += 1;
    if (finalWpm > state.stats.personalBestWpm) state.stats.personalBestWpm = finalWpm;
    if (finalAcc > state.stats.bestAccuracy) state.stats.bestAccuracy = finalAcc;

    if (finalWpm > state.stats.bestByMode.practice.wpm) {
      state.stats.bestByMode.practice.wpm = finalWpm;
    }
    if (finalAcc > state.stats.bestByMode.practice.acc) {
      state.stats.bestByMode.practice.acc = finalAcc;
    }

    state.stats.history.unshift({
      date: new Date().toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }),
      mode: 'Practice',
      config: `L${state.practice.level} • ${state.practice.targetTimeSeconds > 0 ? state.practice.targetTimeSeconds + 's' : 'Untimed'}`,
      wpm: finalWpm,
      acc: finalAcc
    });
    if (state.stats.history.length > 30) state.stats.history.pop();

    saveStats();
    updateLevelLocksUI();

    dom.resPracticeWpm.textContent = finalWpm;
    dom.resPracticeAccuracy.textContent = `${finalAcc}%`;
    dom.resPracticeTime.textContent = `${Math.round(totalElapsedSec)}s`;
    dom.resPracticeCorrect.textContent = state.practice.correctChars;
    dom.resPracticeIncorrect.textContent = state.practice.incorrectChars;

    if (newlyUnlocked) {
      dom.practiceUnlockBanner.removeAttribute('hidden');
      dom.practiceUnlockTitle.textContent = `${nextTierName} Unlocked!`;
      dom.practiceUnlockDesc.textContent = `You reached ${finalWpm} WPM with ${finalAcc}% accuracy.`;
    } else {
      dom.practiceUnlockBanner.setAttribute('hidden', '');
    }

    if (isGoalAchieved) {
      dom.practiceTargetStatus.className = 'result-target-status achieved';
      dom.practiceTargetStatus.textContent = `Target Achieved: ${currentLvlCfg.goalWpm} WPM goal surpassed at ${finalAcc}% accuracy.`;
    } else {
      dom.practiceTargetStatus.className = 'result-target-status';
      dom.practiceTargetStatus.textContent = `Target Remaining: Goal is ${currentLvlCfg.goalWpm} WPM with ${currentLvlCfg.minAcc}% accuracy.`;
    }

    dom.practiceResultsModal.removeAttribute('hidden');
    dom.btnPracticeModalRetry.focus();
  }

  // --- COMPETITIVE MODE ENGINE ---
  function initCompMode() {
    updateCompDifficultyUI();
    resetCompTest(true);
  }

  function updateCompDifficultyUI() {
    const diff = state.comp.difficulty;
    [
      { btn: dom.btnCompLevelBeginner, key: 'beginner' },
      { btn: dom.btnCompLevelIntermediate, key: 'intermediate' },
      { btn: dom.btnCompLevelAdvanced, key: 'advanced' }
    ].forEach(item => {
      if (item.btn) {
        if (item.key === diff) {
          item.btn.classList.add('active');
        } else {
          item.btn.classList.remove('active');
        }
      }
    });
  }

  function resetCompTest(getNewPassage = false) {
    if (state.comp.timerInterval) {
      clearInterval(state.comp.timerInterval);
      state.comp.timerInterval = null;
    }

    state.comp.isActive = false;
    state.comp.isFinished = false;
    state.comp.startTime = null;
    state.comp.elapsedSeconds = 0;
    state.comp.remainingSeconds = state.comp.durationSeconds;
    state.comp.correctChars = 0;
    state.comp.incorrectChars = 0;
    state.comp.totalTyped = 0;

    dom.compInput.value = '';
    dom.compInput.disabled = false;
    dom.compTypingCard.classList.remove('in-progress');
    dom.compResultsModal.setAttribute('hidden', '');
    dom.compShareToast.setAttribute('hidden', '');

    if (getNewPassage || !state.comp.passage) {
      const nextPassageObj = passageManager.getNextPassage('competitive', state.comp.difficulty);
      state.comp.passage = nextPassageObj.text;
      state.comp.passageId = nextPassageObj.id;
    }

    renderPassageText(dom.compTextDisplay, state.comp.passage, '');

    dom.compTimerDisplay.textContent = `${state.comp.durationSeconds}s`;
    dom.compWpmDisplay.textContent = '0';
    dom.compAccuracyDisplay.textContent = '100%';
    dom.compCharsDisplay.textContent = '0';

    const diffName = state.comp.difficulty.charAt(0).toUpperCase() + state.comp.difficulty.slice(1);
    dom.compStatusText.textContent = `${diffName} Challenge (${state.comp.durationSeconds}s limit): Timer begins on the first keystroke.`;
    dom.compStatusHint.textContent = 'Click here or start typing to begin the challenge';

    setTimeout(() => {
      dom.compInput.focus();
    }, 50);
  }

  function startCompTimer() {
    state.comp.isActive = true;
    state.comp.startTime = performance.now();
    dom.compTypingCard.classList.add('in-progress');
    dom.compStatusText.textContent = 'Challenge active! Maintain smooth pacing and avoid backspace delays.';
    dom.compStatusHint.textContent = 'Challenge running...';

    state.comp.timerInterval = setInterval(() => {
      const now = performance.now();
      const elapsedSec = (now - state.comp.startTime) / 1000;
      state.comp.elapsedSeconds = elapsedSec;

      const remaining = Math.max(0, Math.ceil(state.comp.durationSeconds - elapsedSec));
      state.comp.remainingSeconds = remaining;
      dom.compTimerDisplay.textContent = `${remaining}s`;

      const wpm = calculateWpm(state.comp.correctChars, elapsedSec);
      const acc = calculateAccuracy(state.comp.correctChars, state.comp.totalTyped);
      dom.compWpmDisplay.textContent = wpm;
      dom.compAccuracyDisplay.textContent = `${acc}%`;

      if (remaining <= 0) {
        finishCompTest();
      }
    }, 150);
  }

  function handleCompInput() {
    if (state.comp.isFinished) return;

    const val = dom.compInput.value;
    const passage = state.comp.passage;

    if (!state.comp.isActive && val.length > 0) {
      startCompTimer();
    }

    let correct = 0;
    let incorrect = 0;
    for (let i = 0; i < val.length; i++) {
      if (i < passage.length) {
        if (val[i] === passage[i]) correct++;
        else incorrect++;
      } else {
        incorrect++;
      }
    }

    state.comp.correctChars = correct;
    state.comp.incorrectChars = incorrect;
    state.comp.totalTyped = val.length;
    dom.compCharsDisplay.textContent = val.length;

    if (state.comp.isActive) {
      const elapsed = Math.max(0.5, (performance.now() - state.comp.startTime) / 1000);
      const wpm = calculateWpm(correct, elapsed);
      const acc = calculateAccuracy(correct, val.length);
      dom.compWpmDisplay.textContent = wpm;
      dom.compAccuracyDisplay.textContent = `${acc}%`;
    }

    renderPassageText(dom.compTextDisplay, passage, val);

    if (val.length >= passage.length) {
      finishCompTest();
    }
  }

  function finishCompTest() {
    if (state.comp.isFinished) return;
    state.comp.isFinished = true;
    state.comp.isActive = false;

    if (state.comp.timerInterval) {
      clearInterval(state.comp.timerInterval);
      state.comp.timerInterval = null;
    }

    dom.compInput.disabled = true;
    dom.compTypingCard.classList.remove('in-progress');
    dom.compStatusText.textContent = 'Challenge finished. Review your official local metrics below.';

    const totalElapsedSec = state.comp.startTime
      ? Math.min(state.comp.durationSeconds, Math.max(1, (performance.now() - state.comp.startTime) / 1000))
      : state.comp.durationSeconds;

    const finalWpm = calculateWpm(state.comp.correctChars, totalElapsedSec);
    const finalAcc = calculateAccuracy(state.comp.correctChars, state.comp.totalTyped);

    const modeKey = `comp${state.comp.durationSeconds}`;
    const previousModePb = state.stats.bestByMode[modeKey]?.wpm || 0;
    const isNewModePb = finalWpm > previousModePb;
    const isNewGlobalPb = finalWpm > state.stats.personalBestWpm;

    state.stats.totalTests += 1;
    if (finalWpm > state.stats.personalBestWpm) state.stats.personalBestWpm = finalWpm;
    if (finalAcc > state.stats.bestAccuracy) state.stats.bestAccuracy = finalAcc;

    if (state.stats.bestByMode[modeKey]) {
      if (finalWpm > state.stats.bestByMode[modeKey].wpm) {
        state.stats.bestByMode[modeKey].wpm = finalWpm;
      }
      if (finalAcc > state.stats.bestByMode[modeKey].acc) {
        state.stats.bestByMode[modeKey].acc = finalAcc;
      }
    }

    const diffLabel = state.comp.difficulty.charAt(0).toUpperCase() + state.comp.difficulty.slice(1);
    state.stats.history.unshift({
      date: new Date().toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }),
      mode: 'Competitive',
      config: `${state.comp.durationSeconds}s • ${diffLabel}`,
      wpm: finalWpm,
      acc: finalAcc
    });
    if (state.stats.history.length > 30) state.stats.history.pop();

    saveStats();

    dom.resCompWpm.textContent = finalWpm;
    dom.resCompAccuracy.textContent = `${finalAcc}%`;
    dom.resCompDuration.textContent = `${state.comp.durationSeconds}s`;
    dom.resCompCorrect.textContent = state.comp.correctChars;
    dom.resCompIncorrect.textContent = state.comp.incorrectChars;

    if (isNewGlobalPb && previousModePb > 0) {
      dom.compPbTag.textContent = "New Record!";
      dom.compPbText.textContent = `All-time Personal Best! +${finalWpm - previousModePb} WPM increase.`;
    } else if (isNewModePb && previousModePb > 0) {
      dom.compPbTag.textContent = "Challenge PB!";
      dom.compPbText.textContent = `Best for ${state.comp.durationSeconds}s! Beat previous by ${finalWpm - previousModePb} WPM.`;
    } else if (previousModePb > 0) {
      dom.compPbTag.textContent = "Previous Best";
      dom.compPbText.textContent = `Current record for this challenge is ${previousModePb} WPM.`;
    } else {
      dom.compPbTag.textContent = "First Challenge";
      dom.compPbText.textContent = `Initial baseline recorded for ${state.comp.durationSeconds}s challenge.`;
    }

    dom.compResultsModal.removeAttribute('hidden');
    dom.btnCompModalRetry.focus();
  }

  // --- SHARING COMP RESULT ---
  function shareCompetitiveResult() {
    const wpm = dom.resCompWpm.textContent;
    const acc = dom.resCompAccuracy.textContent;
    const dur = dom.resCompDuration.textContent;
    const diff = state.comp.difficulty.charAt(0).toUpperCase() + state.comp.difficulty.slice(1);

    const shareText = `TypeRush Challenge Result:\n` +
      `Difficulty: ${diff}\n` +
      `Duration: ${dur}\n` +
      `Speed: ${wpm} WPM\n` +
      `Accuracy: ${acc}\n` +
      `Tested locally on TypeRush typing platform.`;

    if (navigator.share) {
      navigator.share({
        title: 'TypeRush Challenge Result',
        text: shareText
      }).catch(err => {
        copyTextToClipboard(shareText);
      });
    } else {
      copyTextToClipboard(shareText);
    }
  }

  function copyTextToClipboard(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(() => {
        showShareToast();
      }).catch(() => {
        fallbackCopy(text);
      });
    } else {
      fallbackCopy(text);
    }
  }

  function fallbackCopy(text) {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try {
      document.execCommand('copy');
      showShareToast();
    } catch (e) {
      alert("Result:\n" + text);
    }
    document.body.removeChild(ta);
  }

  function showShareToast() {
    dom.compShareToast.removeAttribute('hidden');
    setTimeout(() => {
      dom.compShareToast.setAttribute('hidden', '');
    }, 2500);
  }

  // --- STATS VIEW RENDERING ---
  function renderStatsView() {
    dom.statsTotalTests.textContent = state.stats.totalTests;
    dom.statsPbWpm.textContent = state.stats.personalBestWpm;
    dom.statsPbAccuracy.textContent = `${state.stats.bestAccuracy}%`;
    dom.statsUnlockedLevels.textContent = `${state.stats.unlockedLevels.length} / 3`;

    dom.statsPracticeBestWpm.textContent = `${state.stats.bestByMode.practice.wpm} WPM`;
    dom.statsPracticeBestAcc.textContent = `${state.stats.bestByMode.practice.acc}%`;

    dom.statsComp30BestWpm.textContent = `${state.stats.bestByMode.comp30.wpm} WPM`;
    dom.statsComp30BestAcc.textContent = `${state.stats.bestByMode.comp30.acc}%`;

    dom.statsComp60BestWpm.textContent = `${state.stats.bestByMode.comp60.wpm} WPM`;
    dom.statsComp60BestAcc.textContent = `${state.stats.bestByMode.comp60.acc}%`;

    dom.statsComp120BestWpm.textContent = `${state.stats.bestByMode.comp120.wpm} WPM`;
    dom.statsComp120BestAcc.textContent = `${state.stats.bestByMode.comp120.acc}%`;

    dom.historyTableBody.innerHTML = '';
    if (state.stats.history.length === 0) {
      dom.historyEmptyState.removeAttribute('hidden');
    } else {
      dom.historyEmptyState.setAttribute('hidden', '');
      state.stats.history.forEach(item => {
        const tr = document.createElement('tr');
        const isComp = item.mode === 'Competitive';
        tr.innerHTML = `
          <td>${item.date}</td>
          <td><span class="history-mode-tag ${isComp ? 'tag-competitive' : 'tag-practice'}">${item.mode}</span></td>
          <td>${item.config}</td>
          <td><strong>${item.wpm}</strong> WPM</td>
          <td>${item.acc}%</td>
        `;
        dom.historyTableBody.appendChild(tr);
      });
    }
  }

  // --- EVENT LISTENERS INITIALIZATION ---
  function setupEventListeners() {
    // Nav items
    dom.navLinks.forEach(link => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        const view = link.getAttribute('data-view');
        switchView(view);
      });
    });

    dom.logoLink.addEventListener('click', (e) => {
      e.preventDefault();
      switchView('home');
    });

    dom.btnHeroPractice.addEventListener('click', () => switchView('practice'));
    dom.btnHeroCompetitive.addEventListener('click', () => switchView('competitive'));

    // Practice Level buttons
    [dom.btnLevel1, dom.btnLevel2, dom.btnLevel3].forEach(btn => {
      btn.addEventListener('click', () => {
        const lvl = parseInt(btn.getAttribute('data-level'), 10);
        if (state.stats.unlockedLevels.includes(lvl)) {
          state.practice.level = lvl;
          updateLevelLocksUI();
          resetPracticeTest(true);
        }
      });
    });

    // Practice Time pills
    dom.practiceTimeBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        dom.practiceTimeBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        state.practice.targetTimeSeconds = parseInt(btn.getAttribute('data-time'), 10);
        resetPracticeTest(false);
      });
    });

    // Practice typing input
    dom.practiceTypingCard.addEventListener('click', () => {
      dom.practiceInput.focus();
    });

    dom.practiceInput.addEventListener('focus', () => {
      dom.practiceTypingCard.classList.add('focused');
    });

    dom.practiceInput.addEventListener('blur', () => {
      dom.practiceTypingCard.classList.remove('focused');
    });

    dom.practiceInput.addEventListener('input', handlePracticeInput);

    dom.btnPracticeRestart.addEventListener('click', () => resetPracticeTest(false));
    dom.btnPracticeNewPassage.addEventListener('click', () => resetPracticeTest(true));

    dom.btnPracticeModalRetry.addEventListener('click', () => {
      dom.practiceResultsModal.setAttribute('hidden', '');
      resetPracticeTest(false);
    });

    dom.btnPracticeModalNext.addEventListener('click', () => {
      dom.practiceResultsModal.setAttribute('hidden', '');
      resetPracticeTest(true);
    });

    // Competitive Difficulty pills
    [
      { btn: dom.btnCompLevelBeginner, key: 'beginner' },
      { btn: dom.btnCompLevelIntermediate, key: 'intermediate' },
      { btn: dom.btnCompLevelAdvanced, key: 'advanced' }
    ].forEach(item => {
      if (item.btn) {
        item.btn.addEventListener('click', () => {
          if (state.comp.difficulty !== item.key) {
            state.comp.difficulty = item.key;
            updateCompDifficultyUI();
            resetCompTest(true);
          }
        });
      }
    });

    // Competitive Duration pills
    dom.compTimeBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        dom.compTimeBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        state.comp.durationSeconds = parseInt(btn.getAttribute('data-comp-time'), 10);
        resetCompTest(false);
      });
    });

    // Competitive Typing card & input
    dom.compTypingCard.addEventListener('click', () => {
      dom.compInput.focus();
    });

    dom.compInput.addEventListener('focus', () => {
      dom.compTypingCard.classList.add('focused');
    });

    dom.compInput.addEventListener('blur', () => {
      dom.compTypingCard.classList.remove('focused');
    });

    // Prevent paste during competitive tests
    dom.compInput.addEventListener('paste', (e) => {
      e.preventDefault();
      alert("Pasting is disabled during competitive typing challenges.");
    });

    dom.compInput.addEventListener('input', handleCompInput);

    dom.btnCompRestart.addEventListener('click', () => resetCompTest(false));
    if (dom.btnCompNewPassage) {
      dom.btnCompNewPassage.addEventListener('click', () => resetCompTest(true));
    }

    dom.btnCompModalRetry.addEventListener('click', () => {
      dom.compResultsModal.setAttribute('hidden', '');
      resetCompTest(false);
    });

    dom.btnCompModalPractice.addEventListener('click', () => {
      dom.compResultsModal.setAttribute('hidden', '');
      switchView('practice');
    });

    dom.btnCompModalShare.addEventListener('click', shareCompetitiveResult);

    // Reset Statistics modal
    dom.btnResetStats.addEventListener('click', () => {
      dom.resetConfirmModal.removeAttribute('hidden');
      dom.btnConfirmReset.focus();
    });

    dom.btnCancelReset.addEventListener('click', () => {
      dom.resetConfirmModal.setAttribute('hidden', '');
    });

    dom.btnConfirmReset.addEventListener('click', () => {
      dom.resetConfirmModal.setAttribute('hidden', '');
      resetAllStats();
    });

    // Escape key modal handling
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        if (!dom.practiceResultsModal.hasAttribute('hidden')) {
          dom.practiceResultsModal.setAttribute('hidden', '');
          resetPracticeTest(false);
        }
        if (!dom.compResultsModal.hasAttribute('hidden')) {
          dom.compResultsModal.setAttribute('hidden', '');
          resetCompTest(false);
        }
        if (!dom.resetConfirmModal.hasAttribute('hidden')) {
          dom.resetConfirmModal.setAttribute('hidden', '');
        }
      }
    });
  }

  // --- INITIALIZATION ---
  function init() {
    loadStoredStats();
    setupEventListeners();
    renderHomeStats();
    updateLevelLocksUI();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

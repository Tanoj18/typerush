# TypeRush — Responsive Typing Speed Platform

TypeRush is a minimalist, responsive, and distraction-free typing platform built with pure HTML5, CSS3, and Vanilla JavaScript. It offers targeted practice tiers and timed competitive challenges, running completely client-side with zero backend dependencies.

---

## Features

### 1. Expanded 150+ Passage Library
Organized in a modular catalog ([passages.js](file:///C:/Users/saivi/.gemini/antigravity-ide/scratch/typerush/passages.js)):
- **Beginner (50 unique passages):** 40–80 words each. Short, natural sentences focusing on daily life, hobbies, friends, school, nature, and everyday activities.
- **Intermediate (50 unique passages):** 80–130 words each. Broader vocabulary, commas, apostrophes, quotation marks, and numbers covering science, college, sports, travel, and teamwork.
- **Advanced (50 unique passages):** 120–180 words each. Challenging vocabulary, semicolons, colons, parentheses, dates, and technical terminology covering software engineering, quantum physics, cryptography, and artificial intelligence.

### 2. Fisher–Yates Shuffled Queue & No-Repeat Guarantee
- **Independent Queues:** Maintained separately across all 6 modes/difficulties (`practice_beginner`, `practice_intermediate`, `practice_advanced`, `competitive_beginner`, `competitive_intermediate`, `competitive_advanced`). Practicing a passage in Practice Mode does not affect the order of Competitive Mode.
- **No Early Repeats:** A passage is never repeated until all 50 passages in that level's queue have been consumed.
- **Boundary Repeat Protection:** When a queue is exhausted and reshuffled for a new cycle, the first passage of the new cycle is verified and swapped if necessary so it never immediately repeats the final passage of the previous cycle.
- **Queue State Persistence:** Queues and pointers persist in `localStorage` under `typerush_passage_queues` with automatic validation and fallback recovery.

### 3. Practice Mode
- **Progressive Unlocks:** Level 2 and Level 3 unlock dynamically when achieving target WPM (15 WPM for L1, 30 WPM for L2) with at least 90% accuracy.
- **Format Flexibility:** Untimed practice for relaxed muscle-memory training, or timed intervals (30s, 60s, 120s).
- **Smooth Feedback:** Character-by-character coloring, wavy underline for errors, and blinking active caret. Timer starts strictly on the first keystroke.

### 4. Competitive Mode
- **Difficulty Selection:** Choose between **Beginner**, **Intermediate**, or **Advanced** challenge passages.
- **Timed Challenges:** 30-second, 60-second, or 120-second official intervals.
- **Integrity Safeguard:** Clipboard text pasting is strictly disabled during competitive tests.
- **Results & Sharing:** Real-time net WPM, accuracy, character counts, personal best comparisons, and instant sharing via the Web Share API (with clipboard fallback).

### 5. Local Statistics & Persistence
- **Zero Cloud Tracking:** All records, personal bests (PBs), unlock milestones, and recent test history are saved privately in your browser's `localStorage`.
- **Breakdown by Mode:** Individual tracking for Practice, 30s Challenge, 60s Challenge, and 120s Challenge.
- **Safe Reset:** Built-in statistics reset with a confirmation modal step.

---

## Mathematical Formulas

- **Net Words Per Minute (WPM):**
  $$\text{WPM} = \max\left(0, \text{round}\left(\frac{\text{Correct Characters} / 5}{\text{Elapsed Seconds} / 60}\right)\right)$$
  *(Standard international convention: 5 characters equal 1 word)*

- **Keystroke Accuracy:**
  $$\text{Accuracy} = \begin{cases} \text{round}\left(\frac{\text{Correct Characters}}{\text{Total Typed Characters}} \times 100\right) & \text{if Total Typed} > 0 \\ 100\% & \text{otherwise} \end{cases}$$

---

## File Structure

```text
typerush/
├── index.html     # Semantic single-page application structure & views
├── style.css      # Design system, typography tokens, responsive layouts
├── passages.js    # Curated library of 150 unique passages across 3 tiers
├── script.js      # Typing engine, Fisher-Yates queue manager, and localStorage
└── README.md      # Documentation, launch instructions, and deployment guide
```

---

## Running Locally

Because TypeRush is a pure static web application, you do not need any build tools or bundlers.

### Option A: Open Directly in Any Browser
```powershell
Start-Process "http://localhost:3030"
```
Or open [index.html](file:///C:/Users/saivi/.gemini/antigravity-ide/scratch/typerush/index.html) directly in any modern web browser.

### Option B: Local HTTP Server
```bash
# Python 3
python -m http.server 3030

# Or Node.js
npx serve .
```

---

## Deploying to Production

### Deploying to Vercel
1. Push this repository to GitHub:
   ```bash
   git add .
   git commit -m "Expand passage library and add competitive difficulty selection"
   git push origin main
   ```
2. Navigate to [vercel.com/new](https://vercel.com/new) and import the repository.
3. Deploy with default settings.

### Deploying to GitHub Pages
1. Go to repository **Settings** &gt; **Pages**.
2. Select **Source** as `Deploy from a branch` (`main` / `/root`).
3. Save to deploy.

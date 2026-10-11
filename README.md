# TypeRush — Responsive Typing Speed Platform

TypeRush is a minimalist, responsive, and distraction-free typing platform built with pure HTML5, CSS3, and Vanilla JavaScript. It offers targeted practice tiers and timed competitive challenges, running completely client-side with zero backend dependencies.

---

## Features

### 1. Practice Mode
- **Three Progressive Tiers:**
  - **Level 1 (Beginner):** Short, accessible vocabulary and fundamental sentence structures. Suggested goal: 15 WPM.
  - **Level 2 (Intermediate):** Varied punctuation, capitalization, and sentence variety. Suggested goal: 30 WPM.
  - **Level 3 (Advanced):** Technical vocabulary, numbers, and complex syntax. Suggested goal: 45 WPM.
- **Unlocking Mechanism:** Tier 2 and Tier 3 unlock once the user achieves the preceding level's suggested WPM target with at least 90% accuracy.
- **Flexible Timing:** Untimed mode for stress-free rhythm building, or timed practice (30s, 60s, 120s).
- **Passage Pool:** Multiple authentic passages per tier selected randomly without immediate repeats.

### 2. Competitive Mode
- **Timed Challenges:** 30-second, 60-second, or 120-second official intervals.
- **Anti-Shortcut Protection:** Clipboard pasting is disabled during challenges.
- **Live Metrics:** Real-time net WPM, keystroke accuracy, and countdown indicator.
- **Instant Sharing:** Uses the Web Share API with an automatic fallback to clipboard copy for showcasing personal results.

### 3. Local Statistics & Persistence
- **Zero Cloud Tracking:** All records, personal bests (PBs), unlock milestones, and recent test history are saved privately in your browser's `localStorage`.
- **Breakdown by Mode:** Individual tracking for Practice, 30s Challenge, 60s Challenge, and 120s Challenge.
- **Safe Reset:** Built-in statistics reset with a confirmation modal step.
- **Resilience:** Gracefully defaults if `localStorage` is disabled or corrupted.

### 4. Human-Designed Aesthetics & Usability
- **Design Tokens:** Warm neutral backdrop, high-contrast readable typography (`Plus Jakarta Sans` & `JetBrains Mono`), and restrained indigo accents.
- **Character Highlighting:** Clear character-by-character color and underline feedback with a blinking caret.
- **Fully Responsive:** Optimized across mobile (320px+), tablets, laptops, and ultra-wide screens.
- **Accessibility:** Semantic HTML elements, accessible keyboard shortcuts (Escape closes modals), visible focus rings, and `@media (prefers-reduced-motion)` support.

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
├── style.css      # Design system, layout, responsive queries, and animations
├── script.js       # Typing engine, timer, calculations, and localStorage state
└── README.md      # Documentation, launch instructions, and deployment guide
```

---

## Running Locally

Because TypeRush is a pure static web application, you do not need any build tools, bundlers, or package managers.

### Option A: Open Directly in Any Browser
Double-click `index.html` or open it in your browser of choice (Chrome, Firefox, Safari, Edge):
```bash
# On Windows PowerShell
Start-Process index.html
```

### Option B: Local HTTP Server (Python or Node)
Using Python:
```bash
# Python 3
python -m http.server 8080
```
Then visit `http://localhost:8080` in your web browser.

Using Node.js:
```bash
npx serve .
```

---

## Deploying to Production

### Deploying to GitHub Pages
1. Push this directory to a GitHub repository.
2. In your repository on GitHub, navigate to **Settings** &gt; **Pages**.
3. Under **Build and deployment**, select **Source** as `Deploy from a branch`.
4. Choose `main` (or `master`) branch and the `/root` folder, then click **Save**.
5. Your platform will be live within seconds at `https://<username>.github.io/<repo-name>/`.

### Deploying to Netlify
1. Drag and drop the `typerush` folder directly into the Netlify dashboard at [app.netlify.com/drop](https://app.netlify.com/drop).
2. Or link your Git repository with build command left empty and publish directory set to `.`.

---

## Limitations

- **Browser Storage Scope:** Results are tied to the local device and browser profile; they do not synchronize across devices since there is no centralized database or user authentication system.
- **Passage Pool:** Pre-configured with curated offline passages. Custom user-uploaded passages can be added in future iterations.

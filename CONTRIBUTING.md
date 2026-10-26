# Contributing to Pretty FitGirl

Thank you for your interest in improving **Pretty FitGirl**! We welcome bug fixes, documentation improvements, and thoughtful feature enhancements.

To ensure the extension remains lightweight, fast, and privacy-respecting, please take a moment to review these guidelines before submitting a contribution.

---

## 🧭 Core Principles

1. **Zero Runtime Dependencies** — No frameworks, UI libraries, or bundlers. The extension runs on vanilla JavaScript and standard CSS.
2. **Privacy First** — No telemetry, analytics, cookies, remote script execution, or third-party API calls.
3. **Strict Reversibility** — Every styling change must be cleanly scoped so that disabling the theme completely restores the original website DOM and layout.
4. **Lightweight & Fast** — Keep DOM manipulation minimal, avoid unnecessary layout thrashing, and preserve browser performance.

---

## 🛠️ Local Development Workflow

### 1. Prerequisites

- [Node.js](https://nodejs.org/) (v18 or higher recommended)
- A modern Chromium-based browser (Chrome, Edge, Brave, etc.)

### 2. Setup

```bash
# Clone your fork
git clone https://github.com/<your-username>/pretty-fitgirl.git
cd pretty-fitgirl

# Install dev dependencies (used only for automated testing)
npm install
```

### 3. Load the Extension in Your Browser

1. Navigate to `chrome://extensions` or `edge://extensions`.
2. Enable **Developer mode**.
3. Click **Load unpacked** and select the `pretty-fitgirl` directory.
4. Visit [fitgirl-repacks.site](https://fitgirl-repacks.site/) to test your changes live.
5. Click the **Reload** button on the extension card in `chrome://extensions` whenever you modify content scripts or manifest.

---

## 🧪 Testing and Verification

Before submitting a Pull Request, make sure all automated checks pass:

```bash
# 1. Run quick manifest & script syntax check
npm run check

# 2. Run full rendering regression test (Playwright)
npm test

# 3. Test packaging
npm run pack
```

---

## 📐 Project Structure

```text
pretty-fitgirl/
├── assets/             # Icons, logos, and bundled offline fonts
│   ├── fonts/          # Inter and Manrope variable WOFF2 fonts
│   └── *.png           # Extension icon sizes (16, 32, 48, 128)
├── scripts/            # Modular content scripts & popup logic
│   ├── comments-frame.js
│   ├── directory.js    # A–Z card transformation and lazy covers
│   ├── enhancements.js # Preferences, DOM wiring, reversibility
│   ├── navigation.js   # Sidebars and layout navigation
│   ├── popup.js        # Extension toolbar popup controls
│   └── repack.js       # Game card formatting and metadata parser
├── styles/             # Scoped modular stylesheets
│   ├── cards.css
│   ├── layout.css
│   ├── navigation.css
│   ├── variables.css
│   └── ...
├── manifest.json       # Manifest V3 configuration
├── popup.html          # Toolbar popup UI
└── popup.css           # Toolbar popup styles
qa/                     # Automated QA harness and regression tests
scripts/                # Build and packaging utilities
```

---

## 📝 Code Style Guidelines

- **JavaScript**: Use modern vanilla JavaScript (`const`/`let`, arrow functions, `async`/`await`). Maintain clean, readable code with comments explaining non-trivial DOM parsing.
- **CSS**: Scoped to `html.mfg-on` or relevant components. Use CSS custom properties defined in `styles/variables.css`.
- **Manifest**: Follow Chrome Extension Manifest V3 specifications. Keep requested permissions to an absolute minimum (currently only `storage`).

---

## 🔀 Submitting a Pull Request

1. Create a feature branch: `git checkout -b feature/your-feature-name` or `fix/issue-description`.
2. Commit your changes with clear, descriptive commit messages.
3. Push to your fork: `git push origin feature/your-feature-name`.
4. Open a Pull Request against the `main` branch of `MuhammedZohaib/pretty-fitgirl`.
5. Fill out the PR template with a summary of changes, motivation, and verification steps.

---

## 🐛 Reporting Issues

- Search existing issues before creating a new one to avoid duplicates.
- Provide clear steps to reproduce, including your browser version, OS, and screenshots if applicable.
- For website layout bugs, mention the specific page URL (e.g., homepage, a specific repack page, or A–Z directory).

Thank you for helping make Pretty FitGirl better for everyone!

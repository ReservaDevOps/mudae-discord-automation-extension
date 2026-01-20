# Repository Guidelines

## Project Structure & Module Organization
- `manifest.json`: Chrome MV3 extension manifest and version.
- `src/`: core automation logic.
  - `src/core/`: scheduling, claim rules, cooldowns, policy decisions.
  - `src/adapters/`: Discord DOM parsing, actions, and observers.
  - `src/config.js`: runtime configuration (limits, timings, commands).
  - `src/state.js`: shared in-memory state for the session.
- `docs/`: reference notes such as HTML examples.
- `README.md`: feature overview and setup notes.

## Build, Test, and Development Commands
- `npm test`: placeholder script; currently exits with an error.
- No build step is required. Load the extension as unpacked:
  - Chrome/Edge: `chrome://extensions` → Developer Mode → Load unpacked → repo root.
- To apply config changes, reload the extension or refresh the Discord tab.

## Coding Style & Naming Conventions
- JavaScript only; follow existing patterns in `src/`.
- 4-space indentation, semicolons, and `const`/`let` style.
- Modules are wrapped in IIFEs and attach to `globalThis.DiscordAutomation`.
- Prefer descriptive Portuguese/English identifiers as already used (e.g., `claimLimits`, `rollSession`).

## Testing Guidelines
- There is no automated test suite at present.
- Manual verification: load the extension and observe console logs with `[Discord Automação]` while interacting with the Mudae bot.

## Commit & Pull Request Guidelines
- Commit messages in history are short, imperative (e.g., “Add…”, “Fix…”, “Restrict…”), sometimes with “and bump version”.
- Before every commit, bump the extension version in `manifest.json` (see `AGENT.md`). If `package.json` is kept in sync, bump it too.
- PRs should include: summary of changes, any config updates (`src/config.js`), and manual verification steps (Discord channel used, commands exercised).

## Agent Instructions
- Before every commit, increment the version number in `manifest.json` (semver patch at minimum).
- If `package.json` is kept in sync, bump it to match the manifest.
- Do not commit without a version bump.

## Configuration & Safety Notes
- Key limits and timings live in `src/config.js`. Keep defaults conservative and document notable changes in `README.md` if behavior changes.
- Automation may violate Discord/Mudae terms; contributors should avoid adding risky features without clear opt-in.

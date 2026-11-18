# DeskOS

Your Computer, Reinvented. A local-first browser desktop built with React, TypeScript, Vite and Tailwind CSS.

## Run

```sh
npm install
npm run dev
```

Open the URL printed by Vite. Double-click desktop shortcuts, use the dock, or press Ctrl+K to search apps and commands. Right-click shortcuts, desktop space, title bars or dock apps for contextual actions. Drag title bars to move windows and edges/corners to resize. Title-bar buttons support snap, minimize, maximize/restore and close.

## Verify

```sh
npm test
npm run test:e2e
npm run lint
npm run build
```

Browser tests default to installed Google Chrome (`channel: 'chrome'` in playwright.config.ts). Install Chrome or adjust the channel for your environment. `npm run preview` serves the production build locally.

## Shortcuts

- Ctrl+K (Cmd+K on macOS): command palette.
- Ctrl+Alt+T / N / S: Terminal / Notes / Settings.
- Ctrl+Alt+D: minimize/restore desktop windows.
- Alt+Tab: cycle visible DeskOS windows when the host permits it.
- Escape: close an overlay. Arrow keys and Enter navigate launcher/search and context menus.
- Terminal: Up/Down for history, Ctrl+L clears output.

## Phase 1 scope

Includes desktop personalization, six built-in wallpapers, functional window management, application search, notifications, Notes with autosave, safe arithmetic Calculator, allowlisted DeskShell and an honest Files shell. No host-machine shell access or virtual file storage yet. Preferences, notes and eligible layouts save on this browser. Terminal history and calculator input are session-only. Clearing browser site data deletes saved content; storage availability is not guaranteed.

Architecture, decisions, roadmap and verification status are in `docs/`.

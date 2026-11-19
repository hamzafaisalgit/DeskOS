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

## Integrated desktop

Phases 1?3 provide window management, themes, desktop shortcuts, Files, filesystem-backed Notes, DeskShell, Code Studio and Calculator. All document apps share the same IndexedDB files. Right-click files in Explorer or on the desktop to choose **Open with**. Explorer also retains its quick preview editor.

Notes edits plain text or Markdown, with formatting tools, a reading view, favorites, recent files, search and export. Use **Copy legacy notes to Documents** to copy original scratchpads into files; originals are retained. Save explicitly with Ctrl/Cmd+S. Dirty tabs prompt before closing, and conflicting saves require Reload or Save As.

Code Studio offers Monaco editing, tabs, language support, search/replace, formatting, diagnostics, folders and isolated web preview. Run a saved HTML file with relative local CSS and classic JavaScript. The preview blocks network access and cannot access DeskOS storage or the parent page.

DeskShell operates only on virtual files. Type `help` for commands, use quoted paths with spaces, and Tab for completion. For example:

```sh
cd Documents
echo "Hello DeskOS" > hello.txt
cat hello.txt
open hello.txt
```

Calculator includes scientific functions, DEG/RAD modes, keyboard input, and persistent calculation history. Expressions are parsed without JavaScript evaluation.

## Limits

Virtual folders are not host-machine folders. Browser site data can be cleared or evicted; export important files. Imports/exports are capped at 200 MB per batch and text opening at 2 MB. Saved active documents restore with their windows; unsaved buffers and all tab layouts do not persist after refresh. Terminal history is per window/session.

Web preview supports static HTML, inline or relative linked CSS, classic scripts and relative images up to 5 MB. It does not compile TypeScript/JSX, resolve npm packages or ES modules, run servers, or resolve CSS asset URLs. Monaco and its language workers load locally on demand and increase first editor load time. Broader cross-browser and performance validation remains Phase 8.

See [architecture](docs/ARCHITECTURE.md), [progress](docs/PROGRESS.md) and [roadmap](docs/ROADMAP.md). No manual migration is required to use new files; legacy note copying is optional.

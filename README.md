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

Phases 1-5 provide window management, themes, desktop shortcuts, Files, filesystem-backed Notes, DeskShell, Code Studio and Calculator. All document apps share the same IndexedDB files. Right-click files in Explorer or on the desktop to choose **Open with**. Explorer also retains its quick preview editor.

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

## Creative and media suite

- **Music:** real audio playback, seeking, volume, shuffle/repeat, queue reordering, playlists, favorites, history, embedded metadata/artwork, live frequency visualization and compact Now Playing. Playback continues while minimized; closing Music stops playback.
- **Photos:** thumbnail gallery, albums, favorites, zoom/pan, fullscreen and non-destructive editing. Adjust light/color, rotate/flip, crop with presets or percentage bounds, compare the original, undo/redo, and save/export PNG, JPEG or WebP copies.
- **Cinema:** video library, playlists, favorites, resume positions, speed, seeking, fullscreen, theater view, picture-in-picture where supported and external WebVTT captions.
- **PDF Studio:** locally bundled PDF.js pages, selectable text, search, thumbnails, outline, bookmarks, saved reading position/zoom, continuous/single-page modes and original download. Print opens the original in the browser PDF viewer.
- **Canvas:** brush, pencil, object eraser, shapes, editable text, color picker, selection/move/resize, pan/zoom, object layers, bounded undo/redo and native `.deskcanvas` projects. Import images and save/export PNG/JPEG artwork.

Open compatible files from Explorer, desktop icons or Terminal. Libraries can scan all virtual folders or a chosen folder. Collection membership references stable IDs and never duplicates the original media. Settings includes playback volume, photo export quality and PDF zoom.

## Limits

Virtual folders are not host-machine folders. Browser site data can be cleared or evicted; export important files. Imports/exports are capped at 200 MB per batch and text opening at 2 MB. Saved active documents restore with their windows; unsaved buffers and all tab layouts do not persist after refresh. Terminal history is per window/session.

Web preview supports static HTML, inline or relative linked CSS, classic scripts and relative images up to 5 MB. It does not compile TypeScript/JSX, resolve npm packages or ES modules, run servers, or resolve CSS asset URLs. Monaco and its language workers load locally on demand and increase first editor load time. Broader cross-browser and performance validation remains Phase 8.

See [architecture](docs/ARCHITECTURE.md), [progress](docs/PROGRESS.md) and [roadmap](docs/ROADMAP.md). No manual migration is required to use new files; legacy note copying is optional.

Media decoding depends on browser codecs. Audio tags are read locally on request in batches of 200 tracks. No remote artwork or fake library items are added. WebVTT is supported; SRT and embedded subtitle extraction are not. PDF search does not perform OCR. Photo processing caps output at 4096 pixels on its longest side and accepts images below 40 MB/40 megapixels. Animated GIF browsing is preserved, but edited GIF output is a still image. Canvas uses vector objects as layers; eraser strokes composite across lower objects. Canvas documents are limited to 4096 x 4096, projects to 24 MB and history to 20 snapshots/32 MB. Unsaved edits do not survive browser reload. External storage backups remain the user's responsibility.

## Spaces and workspaces

Use the Space switcher in the dock or Ctrl+Alt+O to open the overview. Create, rename, reorder or duplicate Spaces; choose independent wallpapers/accents; drag actual window representations between Spaces or use the title-bar/dock context menu. All application instances stay mounted while switching, including unsaved editors and music playback. Desktop shortcuts and virtual Desktop files are shared across Spaces.

Ctrl+Alt+Left/Right switches Spaces; Ctrl+Alt+1 through 9 selects a Space. Browser and operating-system shortcuts can take precedence. The global search also offers Space and arrangement commands.

Arrange windows with cascade, grid, side-by-side, center and bounds recovery, or use the title-bar arrangement picker for half/quadrant snaps. Snaps too small for an app show a warning. Dense tiling adapts to application minimum sizes and may overlap.

Save named snapshots or custom templates in the overview. Built-in Developer, Study, Creative and Entertainment templates create new Spaces with real applications. Globally single-instance apps already running elsewhere stay in their existing Space and are not duplicated. Layout-only restore repositions matching current windows; layout + windows also opens eligible missing apps. Existing windows remain open, and document contents are never restored from a layout. Missing files open no document and produce a warning.

Spaces, ordering, appearance and layouts persist locally. Window restoration follows Settings > Windows. Unsaved buffers are not recovered after refresh. Up to 24 Spaces, 80 restored windows and 100 saved layouts are supported. Layouts are not file backups; Phase 6 remains unimplemented.

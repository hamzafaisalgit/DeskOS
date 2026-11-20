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

Phases 1-6 provide window management, themes, desktop shortcuts, Files, filesystem-backed Notes, DeskShell, Code Studio and Calculator. All document apps share the same IndexedDB files. Right-click files in Explorer or on the desktop to choose **Open with**. Explorer also retains its quick preview editor.

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

## Capsule, Time Machine and Recovery Center

Open these utilities from the launcher, global search or Settings > Recovery. Explorer file menus open history or restrict a Capsule to that file/folder.

Capsule creates ZIP-compatible `.deskpack` files with a versioned manifest, actual binary files and SHA-256 checksums. Choose supported categories, review the scope, then generate the download. A download being initiated does not verify that it was saved to your computer. Capsules are unencrypted; checksums detect corruption, not sender identity.

Imports inspect the package before planning changes. File merge preserves existing content, assigns fresh imported IDs, merges matching directories, and either renames or skips name collisions. Select individual files using the archive tree. Settings/application metadata are explicitly replace-only; they are not universally merged. Full replacement retains archived IDs and supports file cross-references. Missing imported file references are removed where supported and reported. Merge restores imported Trash files as ordinary live files; full filesystem replacement preserves archived Trash metadata.

Replacement requires confirmation and a verified automatic checkpoint. It uses an IndexedDB transaction for filesystem records and a recovery journal plus compensating rollback for localStorage. These stores cannot be updated atomically together. Save/close dirty editors before restoring. During application, writes are paused; restoring settings requires the **Reload DeskOS** button. Avoid simultaneous restores or writes in another browser tab.

Time Machine captures previous committed text content up to 2 MB; it does not snapshot every keystroke. Compare a retained version with current saved content, restore it through revision-checked saves, or recover a separate copy. Unsaved buffers are never silently replaced. Version history survives Trash and permanent file deletion until retention/cleanup removes it. Restore points contain independent archived bytes and are unaffected by version cleanup.

Defaults: 10 versions per file, up to 30 configurable, a 50 MB global version cap, 250 MB restore-point cap, and a 100 MB compressed/expanded Capsule limit. Oldest eligible versions are pruned at saves. Restore points are manually deleted with confirmation. Large backups must be split into smaller exports. Local recovery data shares browser storage and cannot protect against site-data deletion or device loss. Export independent copies.

Coverage: virtual file metadata/content/favorites/Trash, persisted system/appearance preferences, Spaces/order/layouts/templates/snapshots/window references, legacy scratchpads, media collections/resume/PDF bookmarks/preferences/tag cache, calculator history and editor/Explorer preferences. Saved Notes/code/Canvas documents and imported media are files. Fixed wallpapers and associations are bundled application code. Historical version blobs, local restore-point archives/journals, unsaved buffers, runtime playback/Terminal scrollback, transient UI, Blob URLs, credentials and browser/host data are excluded. Historical archives can be downloaded individually from Restore Points.

See docs/ARCHITECTURE.md for the archive schema, coverage registry and restore safety model. No account, server, encryption, scheduled/background backup or remote upload is involved.

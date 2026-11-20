# DeskOS progress

The Phase 1 record below is historical; the Phase 2 section supersedes its Files/storage limitations.

Phase 1 is implemented. Phases 2–8 have not been started.

## Delivered

- Original Midnight Glass desktop with centralized design tokens, light/dark/system themes, accents, real clock, transparency and motion preferences.
- Six locally bundled wallpaper artworks with preview, apply, crossfade and persistence.
- Selectable, keyboard-accessible, draggable desktop shortcuts with saved positions, viewport clamping, visibility control and layout reset.
- Central application registry with icons, lazy component loading, dimensions, categories and single-instance policies.
- Central window lifecycle, bounded stacking, focus, drag, edge/corner resizing, minimum sizes, minimize, maximize/restore, left/right snapping and previous-bounds recovery. Eligible layouts restore after reload.
- Floating/full-width dock, pinned apps, active/running indicators, unpinned distinction and multiple-window selection.
- Searchable launcher and typed command actions, keyboard navigation, empty states, focus containment and Escape/outside dismissal.
- Desktop, app, title-bar and taskbar context menus. Shortcut application information opens a real information panel.
- In-app toasts and session notification center with read state, dismiss controls and clear action. No notification permission request or fake device statistics.
- Settings for actual implemented appearance, desktop, taskbar, window and system preferences, including 12/24-hour clock and shortcut reference.
- Honest Files shell with navigation but no pretend filesystem operations.
- DeskShell: help, clear, date, echo, whoami, version, apps, open and theme; history and Ctrl+L; browser-only execution boundary.
- Plain-text Notes: create, select, rename, edit, autosave, reload and confirmed deletion. Stable note records support future migration.
- Safe arithmetic Calculator: precedence, unary signs, parentheses, decimals, keyboard input, clear/backspace and invalid-expression/division-by-zero errors.
- Versioned local persistence with validation and visible storage-failure recovery; app error boundaries; responsive layouts and reduced-motion support.

## Verification

- `npm test`: 28 core tests passed.
- `npm run test:e2e`: 11 real Google Chrome browser tests passed.
- `npm run lint`: passed without errors or warnings.
- `npm run build`: passed, including TypeScript strict checking and production asset generation.
- Desktop and Settings screenshots were captured and visually inspected. Previews are in this directory.

The browser suite covers dock/launcher/desktop/search launch paths; pointer movement and resizing; snap/maximize/minimize/close and restored bounds; note save/reload/delete; terminal commands/history and calculator keyboard; settings and wallpaper persistence; context menus, pinning and notifications; malformed storage and narrow viewport recovery; search action execution and focus return; desktop shortcut movement; multiple instances; and storage quota failure.

The 32 Phase 1 acceptance areas are represented in the delivered implementation. Build/test gates pass. This is Phase 1 completion, not the broader production-readiness work scheduled for Phase 8.

## Known limits

- Alt+Tab and some Ctrl+Alt combinations may be intercepted by the operating system/browser or keyboard layout. All core actions also have visible controls.
- Browser automation was performed in installed Chrome, including a 600×700 viewport. Full cross-browser, assistive-technology and low-end-device testing remains Phase 8 work.
- Files intentionally has no virtual storage until Phase 2. Scratchpad notes do not yet appear in Files.
- Only Notes data, appearance/preferences and eligible window layouts persist. Terminal history, calculator input, notifications and overlays are session-only.
- Browser storage can be cleared or unavailable. Copy important notes elsewhere; failures retain current in-memory content and display a warning.
- Notes are plain text; optional Markdown formatting and custom wallpaper uploads are not included.

## Next

Phase 2: shared virtual filesystem, IndexedDB, honest Files operations, import/export, trash and file associations. Preserve existing scratchpad records for Phase 3 migration.

## Phase 2 — Virtual Computer (2026-11-19)

Delivered a persistent IndexedDB filesystem and fully integrated File Explorer. Includes protected default folders; transactional create/read/update/rename/move/copy/duplicate; recursive Trash/restore/permanent deletion; stable paths; per-window history; grid/list/details views; sorting/filtering/global metadata search; multiselect and keyboard operations; shared cut/copy/paste; drag/drop; Favorites and Recent; details; and loading, empty, missing-location and operation-error states.

Imports support multiple files, external drop and folder picker paths. Exports support individual downloads, folder/multi-file ZIPs with hierarchy and progress. Preview handlers support text editing with conflict detection, PNG/JPEG/WebP/GIF, browser PDF, audio and video, plus unsupported-file download fallback. Desktop virtual files support create, rename, open, trash and saved placement. Changes synchronize through the same database. Existing app shortcuts and scratchpad notes remain intact. Storage settings show real content totals, browser estimates, type distribution, largest files and access to Trash cleanup.

Verification:

- 33 unit/service tests pass: the existing 28 plus five critical filesystem tests.
- One new Chrome integration test passes: folder/file creation, editing, export, Trash, restore and reload.
- Existing Phase 1 browser regression suite reused: all 11 tests passed. Total browser checks: 12 passing automated tests.
- Additional Chrome check verified exact imported text, exact ZIP contents and directory hierarchy, desktop synchronization, and no page exceptions during those workflows.
- Dark/light screenshots inspected: `files-dark-preview.png`, `files-light-preview.png`.
- TypeScript production build and ESLint pass.

Practical limits:

- Import/export batches are capped at 200 MB; text preview/edit at 2 MB; thumbnails are loaded only for supported raster images at most 10 MB.
- Folder picker, PDF rendering and media codecs depend on browser support. Multi-file import and download are fallback paths. Empty directories in external folder-picker selections cannot be recovered because browsers supply files, not empty folders.
- Imports commit each file independently; if a later file fails, already imported files remain. Failed operations are reported and existing data is preserved.
- Explorer displays up to 200 items at a time with a Show next control; metadata remains in memory. Very large library optimization is later production-readiness work.
- Notes scratchpads are preserved separately. The file preview's text editor provides real shared-file editing until Phase 3 integrates Notes fully.
- Browser storage is local to the site/browser and may be cleared or evicted. ZIP export is the available filesystem backup path; complete DeskOS Capsule remains Phase 6.
- Browser validation here used Chrome. Wider cross-browser/accessibility testing remains Phase 8.

Next: Phase 3 core integrated applications and shared-file workflows.

## Phase 3: Core Integrated Applications

Implemented filesystem-backed Markdown/text Notes, copy-only legacy note migration, favorites/recent/search, formatting and reading mode, explicit save/Save As, duplicate/export and recoverable deletion. Code Studio includes locally bundled Monaco, language modes, tabs, expandable project folders, rename/Trash, formatting, find/replace, diagnostics, editor preferences and saved web preview. DeskShell now resolves real virtual paths and supports file commands, quoted arguments, redirection, completion and independent sessions. Calculator adds scientific functions, DEG/RAD and persistent history.

All document apps share stable file IDs and content revisions. Conflicts cannot silently overwrite another save; deleted files retain open buffers for Save As. Dirty windows and tabs offer Save/Discard/Cancel. Explorer quick editing also uses revision-checked saves. Explorer and desktop expose compatible Open with actions and path copying.

Verification on 2026-11-19:

- 36 unit/service tests pass, including three focused Phase 3 tests.
- 14 Chrome integration tests pass against the production build: desktop regressions, persistence/Trash, Notes-to-Terminal-to-Code sharing, external-change reload, dirty-close cancellation, linked CSS/JavaScript preview and blocked parent-page access.
- ESLint and TypeScript/Vite production build pass.
- Preview and Notes screenshots saved in this folder.
- Fixed a terminal scroll effect cleanup issue and a production focus race after launching another app.
- Monaco uses its textarea input mode for reliable browser keyboard handling.
- Dependency audit after the DOMPurify override reported no vulnerabilities.

Main implementation: `src/core/documents/`, `src/applications/editor/`, `src/applications/terminal/`, the filesystem service, shared associations, registry, window launch context and close guards.

Installed dependencies: monaco-editor, @monaco-editor/react, react-markdown and remark-gfm. DOMPurify is overridden to patched 3.4.17.

Limits: text opening is capped at 2 MB. Notes saves explicitly; unsaved buffers and complete tab sessions do not survive reload. Legacy note copying is optional and repeatable, with originals preserved. Preview runs static HTML, relative CSS and classic scripts; no modules, TypeScript/JSX compilation, npm, backend, remote resources or CSS asset URL resolution. Monaco chunks/workers remain large and Vite reports a bundle-size warning; editor loading is lazy. Browser validation used Chrome.

No manual actions are required beyond starting the app. Optional legacy copying is available inside Notes. Next: Phase 4.

## Phase 4: Creative & Media Suite (2026-11-20)

Implemented Music, Photos, Cinema, PDF Studio and Canvas in the existing application registry and desktop lifecycle. All media and saved projects use the shared filesystem. Explorer, desktop and Terminal open compatible files by stable ID. Existing user data and database schema are preserved.

Music includes real audio controls, queue ordering/removal, playlists, favorites, recent playback, metadata-based album/artist browsing, embedded cover art, responsive Now Playing/mini views, real Web Audio frequency visualization and Media Session play/pause. Playback continues while minimized; close stops playback. Metadata is read explicitly in batches of 200 tracks and falls back to filenames.

Photos includes lazy generated thumbnails, albums, multiselection, favorites, sorting/search, fullscreen, zoom/pan and actual Canvas-based color adjustments, exposure, warmth, crop presets/bounds, rotate/flip, before/after and bounded undo/redo. Save Copy and exports preserve originals. GIF viewing preserves animation; editing exports a still frame.

Cinema includes video playback controls, speed, fullscreen/theater/PiP, WebVTT captions, queues/playlists, favorites, continue watching and persisted resume prompts. Browser codec and autoplay failures are reported.

PDF Studio bundles PDF.js with local worker/CMaps/fonts/WASM assets. It supports lazy rendered pages/thumbnails, text selection, search with highlighting, outline navigation, bookmarks, reading progress, zoom/fit/rotation and continuous/single-page modes. Download preserves the original; printing opens the browser PDF viewer.

Canvas uses Fabric.js for freehand/pencil, compositing eraser, line/rectangle/ellipse, editable text, selection/move/resize, fill/stroke/opacity, picker, pan/zoom, object layers and bounded undo/redo. Native versioned .deskcanvas files embed images and reject external sources. Save checks filesystem revisions. PNG/JPEG export respects artwork dimensions independently of viewport zoom/pan. Dirty editors prompt before close or document replacement.

Settings adds default volume, photo export quality and PDF zoom.

Verification:

- Production TypeScript/Vite build passes.
- ESLint passes without warnings.
- 38 unit/service tests pass: existing 36 plus two focused tests for media associations and native project validation/serialization.
- All 17 Chrome browser tests pass against the production build, including all prior desktop/document/files regressions and three new media workflows.
- Browser checks use generated real image/audio/video/PDF data. Verified changed photo pixels and crop output, saved image copy, image-to-Canvas launch, native project save/reopen, audio continuing while minimized, playlist membership, PDF text search/bookmark reopen, video playback, WebVTT cues and resume after reopening.
- Screenshots: phase4-canvas.png, phase4-pdf.png and phase4-cinema.png.
- npm dependency audit reported zero vulnerabilities after installation.

Main files: src/applications/media/, src/core/media/, registry, shared associations, filesystem read limits, Explorer/desktop launch actions and Settings. Dependencies added: fabric, pdfjs-dist and music-metadata.

Practical limits:

- Browser decoding determines codec support. WebVTT is supported; no SRT conversion or embedded subtitle extraction.
- PDF supports up to 100 MB/2,000 pages, with no OCR or PDF annotation editing. Printing uses the original in the browser viewer. Password-protected documents request a password.
- Photo editing accepts images below 40 MB/40 megapixels and caps rendered output at 4096 pixels on the longest side. GIF edits export still images. Sharpening and EXIF editing are not included.
- Canvas object layers are vector objects, with compositing eraser strokes rather than a full raster-layer painting model. Canvas dimensions cap at 4096 x 4096, project JSON at 24 MB, image imports at 25 MB/40 megapixels, and undo history at 20 snapshots/32 MB.
- Collections and reading/playback metadata persist locally; unsaved editor buffers do not survive refresh. Browser storage may be cleared/evicted. Export important work.
- Heavy engines are lazy loaded. Existing Monaco/language worker bundle-size warnings remain.
- Verification used Chrome. Broader browser/accessibility/performance validation remains Phase 8.

No manual migration or other setup is required after npm install. Import personal media through Files or each application's Import control. Next implementation phase: Phase 5.

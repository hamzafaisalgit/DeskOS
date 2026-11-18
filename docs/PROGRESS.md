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

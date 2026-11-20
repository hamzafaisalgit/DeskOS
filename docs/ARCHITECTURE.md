# DeskOS architecture

The existing React, TypeScript, Vite and Tailwind setup remains. Zustand owns desktop preferences, notifications and windows. The application registry supplies lazy components, dimensions, icons and launch metadata. Window chrome, resizing, focus, dock and application shortcuts are shared.

## Files and documents

The Dexie `deskos-files-v1` database separates indexed metadata from Blob content. Stable entry IDs, parent IDs, protected system folders, transactional operations and recoverable Trash are shared by every app. Live queries synchronize Explorer, desktop files, storage settings and open documents.

`src/core/documents/useDocuments.ts` manages editable tabs and saved snapshots. Every content write increments an optional revision (old records start at zero). `saveDocument` atomically checks the expected revision and writes content. External changes, renames and deletion update open editors without replacing unsaved buffers. Reload and Save As provide explicit recovery. Explorer's quick editor uses the same revision checks.

`guards.ts` connects dirty windows to the existing window manager's close action. Save/Discard/Cancel applies to dirty tabs and windows; browser refresh gets a native unsaved warning. Active file IDs persist with window layouts. Unsaved buffers do not persist.

## Applications

- Notes and Code Studio share `DocumentEditor.tsx` and document services. Notes keeps valid Markdown/plain text, rendered with react-markdown and remark-gfm. Legacy localStorage notes remain intact and can be copied to Documents.
- Code Studio lazily loads locally bundled Monaco and workers. Its folders, tabs, diagnostics, formatting and preferences use the existing desktop UI.
- `webPreview.ts` resolves saved relative CSS, classic JavaScript and images into an HTML document. A sandboxed iframe allows scripts but has an opaque origin, no same-origin capability and restrictive CSP. Network, parent storage access and form submissions are blocked. There is no privileged message bridge.
- DeskShell parses commands, quotes, paths and output redirection. All operations call the virtual filesystem; there is no host shell, process execution or backend.
- Calculator uses a recursive parser for arithmetic and scientific functions, never eval/Function. History is bounded to 50 localStorage entries.
- Explorer and desktop Open with actions use shared associations. Other file formats retain their browser preview/download handlers.

## Persistence and limits

Small validated preferences, layouts, legacy notes and calculator history use versioned localStorage keys. Files use IndexedDB. Storage errors are visible. File imports/exports are capped at 200 MB, text opening at 2 MB and preview images at 5 MB. Clearing browser site data removes stored content.

Vitest covers core state, filesystem operations, revisions, shell integration and arithmetic. Playwright covers desktop regressions, saved documents, conflicts, dirty-close protection and preview isolation. See PROGRESS.md for verification results.

## Phase 4 media architecture

The registry lazily loads Music, Photos, Cinema, PDF Studio and Canvas. The existing Open With service routes media by actual file type; desktop, Explorer and Terminal share these associations. No database reset or schema migration was required.

`src/core/media` provides validated collection/progress/bookmark preferences, Blob URL lifecycle, metadata extraction, photo rendering and native project validation. Collections reference stable IDs; binary media stays in the filesystem. Libraries use live metadata and image thumbnails are generated only when approaching the viewport.

Music owns one audio element per single application instance, with Web Audio frequency visualization and Media Session play/pause. Minimized windows remain mounted. Cinema owns its video element and persists positions at intervals and on pause/close. Both report decoding/autoplay errors.

Photos renders adjustments into a Canvas before saving/exporting copies. Canvas uses Fabric object layers, embedded images, versioned JSON projects and revision-checked saves. Project validation rejects external image sources. Dirty-close protection reuses desktop close guards. History is bounded by snapshot count and size.

PDF.js workers, CMaps, fonts and WASM assets are bundled locally. Page rendering uses viewport observers and cancels obsolete tasks. Text layers support selection and search; bookmarks and progress remain app metadata linked to source IDs. Original PDF printing uses the browser viewer.

## Phase 5 Spaces

The existing Zustand desktop store owns Space metadata, active Space, window ownership, snapshots and templates. Windows retain their instance IDs when moved. Inactive windows stay mounted and use display:none, preserving application state. Focus activates the owning Space; single-instance apps remain global. Alt+Tab, Show Desktop and arrangement actions operate on the active Space.

The versioned deskos.v1.spaces.v1 record adds Space metadata/layouts without changing IndexedDB or resetting legacy data. Legacy windows migrate into Desktop 1. Invalid ownership falls back to the first valid Space. Space persistence is debounced and flushed on pagehide; window geometry uses existing drag/resize completion commits.

The overview renders lightweight app-name/geometry representations instead of cloning engines or capturing document content. Context menus and selects provide alternatives to drag-and-drop. Snapshot restoration matches existing IDs or app/file references, keeps unrelated windows, validates file references and opens only eligible missing apps. Templates store launch/layout references, never file content. Deletion defaults to moving windows; close mode invokes existing dirty-close guards and retains the Space if windows remain.

All desktop shortcuts/files are shared across Spaces. Appearance is per Space with optional accent. Settings and global commands expose the same centralized actions.

## Phase 6: portability and recovery

`src/core/backup/coverage.ts` is the audited adapter registry driving category export/import/coverage. It enumerates every persisted source found in src: preferences, windows, spaces.v1, notes, media, music-tags, calculator-history, editor-font/editor-wrap, files-view/files-details and history-count. Categories declare replacement/merge support and file dependencies. IndexedDB entries/contents supply files. Runtime state, fixed bundled assets/code, history blobs/points/journals and recovery status are excluded from Capsules.

Capsule schema 1 is a ZIP-compatible .deskpack: manifest.json, settings.json, optional filesystem/metadata.json and filesystem/blobs/<stable-id>. The manifest declares format/version, app version, UTC creation time, scope, counts, logical size and per-payload SHA-256/byte counts. JSON has prototype-property rejection; archive parsing validates central-directory names/counts/decompression limits before expansion, bounds streamed entry output, verifies inventory/checksums and validates the filesystem graph/protected folders. Limits: 100 MB compressed/expanded, 10,000 filesystem records and 8 MB per JSON payload. Checksums are integrity checks, not signatures. No encryption is advertised.

File merge is a single IndexedDB transaction with fresh user-entry IDs, shared matching folders and deterministic keep-both/skip collisions. Application metadata is replace-only. Replacement creates and revalidates an independent full supported checkpoint first, rechecks the preview's filesystem stamp, applies filesystem records transactionally, then applies localStorage with compensating rollback and a durable journal. Interrupted journals surface at startup and in Recovery Status; checkpoints remain available. This is not cross-storage atomicity. File mutation writes are paused during apply. Metadata restoration pauses old in-memory preference persistence until reload, preventing pagehide from overwriting imported preferences. Multiple-tab coordination is not guaranteed.

Database schema 2 adds versions, points and journals without touching existing file records. Shared content saves retain previous eligible text content, deduplicate unchanged saves and prune per-file/global limits. Blob reads use Dexie.waitFor to keep write transactions alive. History survives file deletion until retention or explicit cleanup. Native Canvas/media binaries are not automatically versioned; explicit restore points contain their real bytes.

Manual restore points reuse verified Capsules and store immutable archives with explicit scope/name/description/size. Workspace-only points preserve Spaces/windows metadata, not file content; full points contain actual files. Version restoration uses the normal filesystem revision check, retaining the replaced current text where eligible. Restore-as-copy also works when the original was permanently deleted. Timeline comparison is a bounded line-index side-by-side comparison, not a syntax-aware merge engine.

The three lazy recovery utilities share the existing desktop/notifications/dialogs/themes. Explorer, Settings and global commands expose them. No dependency was added; JSZip and browser SHA-256 are reused.

# Technical decisions

- Preserve the existing React/Vite/TypeScript/Tailwind configuration. Extend package scripts and add only dependencies needed by Phase 1.
- Use Zustand for the window manager and shared services. All window operations go through one API; applications never implement their own chrome.
- Use react-rnd for mature mouse/touch dragging and resizing. Keep resize handles outside the clipped rounded content. Animate opacity, because transform animation conflicts with react-rnd positioning.
- Keep icons and lazy component definitions in the same registry as dimensions and launch metadata. Lazy imports avoid a registry/application initialization cycle.
- Use localStorage only for small preferences, layouts and temporary scratchpad notes. Use a versioned key namespace and validate decoded data. Surface quota failures rather than promising successful persistence.
- Use original CSS wallpapers and Lucide icons; no remote media, paid assets or proprietary OS artwork.
- Use plain text Notes in Phase 1. Preserve IDs and content for migration to the future shared filesystem; Markdown rendering is optional and not included.
- Use a safe recursive descent calculator supporting precedence, parentheses and unary signs. Do not execute user input as JavaScript.
- Use custom in-app notifications. Do not request browser notification permissions or show fabricated device status.
- Add Vitest for service/state tests and Playwright for real browser integration tests. Tests use installed Chrome; no separate browser download is required here. Prettier keeps application code readable.
- Keep all future phases explicitly unimplemented until requested.

## Phase 2 decisions

- Dexie provides IndexedDB transactions, schema versioning and live subscriptions. Existing settings and Notes namespaces are preserved without migration.
- Metadata and file Blobs are separate so listings do not load content. Stable entry IDs support future app integrations.
- Reuse the existing window manager, themes, notification service and context menus. System panels are portaled to the desktop so window clipping does not hide them; focus trapping includes text editors and disabled controls are skipped.
- Native HTML drag-and-drop handles file movement, multiple selections, sidebar targets and external import. Move/copy destination dialogs provide a pointer/touch fallback.
- ZIP creation stays client-side and is lazy-loaded. Use explicit 200 MB limits for imports/exports to bound browser memory. Folder picker support depends on the browser; ordinary multi-file import remains available.
- Imported source and HTML are treated as text. Raster-only image preview avoids executing SVG content. PDF/media preview uses browser capabilities and reports unsupported formats.
- Preserve Phase 1 Notes; provide a functional basic filesystem text editor now. Phase 3 can bridge Notes without destructive migration.
- Add only five focused filesystem tests and one end-to-end filesystem workflow; reuse the existing Phase 1 regression suite.

## Phase 3 decisions

- Keep Markdown serialization as plain text; use react-markdown/remark-gfm for a safe reading view instead of storing opaque editor JSON.
- Use explicit saves and revision conflicts. Preserve legacy scratchpads through copy-only migration.
- Bundle Monaco and workers locally; lazy-load the editor. Override Monaco's pinned DOMPurify dependency with patched 3.4.17.
- Share files through existing Dexie services and stable IDs, including shell commands and Explorer quick editing.
- Preview only saved static browser projects in an opaque-origin iframe with restrictive CSP. No host shell, backend, compiler, npm runtime or parent-page bridge.
- Add three focused unit tests and two integration workflows; adapt existing regression tests for explicit saves and file associations.

## Phase 4 decisions

- Use browser audio/video decoding and honest format errors. Keep media playback within existing window lifecycle; minimize preserves Music, close stops it.
- Use PDF.js for rendered pages/text and Fabric.js for practical editable vector objects. Read embedded audio tags with music-metadata. All engines load lazily.
- Store playlists, albums, bookmarks, progress and small preferences in existing versioned storage; retain binary content in the shared filesystem.
- Save photo edits as copies. Use revision conflicts for native Canvas saves and bounded snapshots for history.
- Use object layers for Canvas. Erasing creates compositing strokes; this is not a full raster-layer painting engine.
- Bundle PDF support assets locally with their license; no CDN dependency. Browser PDF printing is the fallback workflow.

## Phase 5 decisions

- Extend the existing window store rather than introduce another window manager. Use stable Space IDs and retain mounted app instances across switching.
- Keep single-instance applications global. Dock focus switches to their owning Space; templates skip conflicting instances with feedback.
- Restore layouts additively, preserving existing/dirty windows. Layout records contain saved file references and geometry, not unsaved buffers.
- Use lightweight actual geometry previews with app labels; avoid document snapshots and duplicate heavy engines.
- Preserve shared Desktop files/shortcuts. Store Space appearance separately from global preferences and support applying wallpaper to all Spaces.
- Bound Spaces/layouts/restored windows and adapt dense arrangement to application minima. Unsupported snap sizes report the limitation.

## Phase 6 decisions

- Add version/point/journal tables to the existing Dexie database with a non-destructive schema upgrade.
- Retain prior text at committed shared saves; use a count and byte budget. Keep immutable point archives independent from version pruning.
- Use a registry of actual persistence keys. Exclude historical archives from full Capsules to avoid recursive backups; individual points remain exportable.
- Offer safe file-only merge and explicit replacement for metadata. Preserve original IDs during replacement; remapping all app metadata during file merge is intentionally unsupported and explained.
- Validate ZIP metadata and bound streamed decompression, check graph integrity and SHA-256 bytes before plans/mutations.
- Require a verified checkpoint for replacement, journal cross-storage progress and compensate failed writes. Never promise atomic localStorage/IndexedDB restoration.
- Require dirty editors to be saved or closed. Pause mutation writes during application and require reload after settings replacement.
- Omit optional encryption rather than represent ordinary ZIP compression as password protection.

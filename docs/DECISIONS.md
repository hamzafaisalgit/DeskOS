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

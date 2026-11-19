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

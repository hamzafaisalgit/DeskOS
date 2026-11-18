# DeskOS architecture

DeskOS is a local-first browser desktop built on the existing React 19, Vite, TypeScript and Tailwind v4 installation. No backend, authentication, remote wallpaper requests or telemetry are used.

## Modules

- `src/core/registry.ts` owns the typed application catalog: icons, lazy components, category, descriptions, dimensions, single-instance policy, resizability and future file-type declarations. Desktop, dock, launcher, search and DeskShell consume this catalog.
- `src/core/store.ts` is the Zustand window manager and preferences/notification service. Window array order supplies bounded stacking indices. Runtime IDs identify instances. Exactly one visible window is active. Minimized applications remain mounted. Previous bounds allow restoration from snapping and maximization.
- `src/components/Window.tsx` supplies shared chrome, react-rnd pointer interactions, focus handling, lazy loading and an application error boundary.
- `src/App.tsx` composes the desktop, icons, dock and system panels. `Launcher.tsx` handles application and command search; `Overlays.tsx` handles focus containment, dismissal and context menus.
- `src/core/commands.ts` defines typed system commands; `shortcuts.ts` owns a single keyboard listener with cleanup.
- `src/applications/Apps.tsx` implements the initial Files shell, DeskShell, Notes and Calculator. `Settings.tsx` implements system preferences.
- `src/App.css` defines centralized surface/text/border/accent tokens, responsive layouts, light theme, opacity and motion preferences. Six bundled CSS artworks crossfade without external assets.

## Persistence

Small data uses `deskos.v1.*` localStorage keys: preferences, window layouts and scratchpad notes. Preference fields, note records and restored windows are validated. Duplicate window IDs and single-instance records are filtered. Layouts are clamped to the viewport; previous bounds survive reload. Browser storage exceptions produce visible warnings; notes retain in-memory edits and show an unsaved warning.

This is a Phase 1 scratchpad, not a filesystem. Each note has a stable ID, title, text and update timestamp so a future migration can preserve content. Phase 2 introduces a shared filesystem and IndexedDB. Phase 3 migrates scratchpad records through an explicit, lossless adapter; old storage should only be retired after successful migration.

## Boundaries and limitations

Files deliberately has no pretend file operations. DeskShell executes only allowlisted browser commands and cannot access host OS processes. Calculator uses a recursive descent arithmetic parser and never eval/Function. Notifications are in-app and session-only. Terminal history and calculator input do not persist across reload, although their windows can restore. Clearing site data removes saved information. Alt+Tab remains subject to host/browser interception.

## Verification

Vitest tests state transitions, registry validity, arithmetic, commands, persistence validation, quota errors and note mutation. Playwright exercises real Chrome interactions: launch paths, dragging/resizing, layouts, notes, terminal, calculator, settings, context menus, notification center, shortcut movement and storage recovery. See PROGRESS.md for the latest run results.

## Phase 2 filesystem architecture

`src/core/filesystem` contains the typed Entry/Content models, Dexie database, centralized Filesystem service, live-query subscription, clipboard, associations and import/export operations. Database `deskos-files-v1` uses schema version 1 with separate indexed metadata and Blob tables. Components never write database records directly. Default Home and protected system folders are created once in a transaction; Phase 1 storage is untouched.

Metadata uses stable IDs and parent IDs. Mutations transact across metadata and content. Copy operations allocate independent IDs and preserve content; names are case-insensitively unique per live directory. Cycle checks, protected-folder rules and expected-modification checks prevent invalid moves and stale text-editor saves. Trash retains descendants, original parents and group IDs; restore resolves name collisions and falls back to Home when the original parent is unavailable. Permanent deletion removes both records and content.

`FileExplorer.tsx` owns only per-window navigation/selection/view state. Dexie live queries update all Explorer windows, desktop files and Storage settings after mutations. `FilePreview.tsx`, `FileThumbnail.tsx`, `OperationDialog.tsx` and `StorageSettings.tsx` separate preview, thumbnail, modal and storage UI. The shared launch context carries an entry ID through the existing window manager so desktop folders open in Files. System application shortcuts remain separate from filesystem entries.

File associations choose real in-process viewer/editor handlers: text, raster image, PDF, audio, video or download/details fallback. Text edits write through the filesystem service. HTML/source files are displayed as text, never executed. The existing Notes scratchpad remains unchanged; its full shared-file bridge belongs to Phase 3.

JSZip is loaded only during archive export. Imports/exports have a 200 MB batch limit, previews cap text at 2 MB, and thumbnail loading excludes images above 10 MB. Explorer reads metadata separately from Blobs and renders entries in batches of 200. Object URLs are revoked. Browser quota estimates are presented as estimates, not physical disk information.

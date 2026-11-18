import { FileThumbnail } from "./FileThumbnail";
import { useCallback, useMemo, useRef, useState } from "react";
import type { DragEvent } from "react";
import {
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  RefreshCw,
  Search,
  FolderPlus,
  Upload,
  LayoutGrid,
  List,
  Columns3,
  PanelRight,
  Folder,
  Star,
  Clock,
  Trash2,
  Download,
  Copy,
  Scissors,
  ClipboardPaste,
  X,
} from "lucide-react";
import { useFilesystem } from "../../core/filesystem/hooks";
import { filesystem as fs } from "../../core/filesystem/service";
import {
  HOME,
  folders,
  folderId,
  formatBytes,
} from "../../core/filesystem/types";
import type { Entry } from "../../core/filesystem/types";
import { useFileClipboard, dragType } from "../../core/filesystem/clipboard";
import { importFiles, exportFiles } from "../../core/filesystem/transfers";
import { handlerName } from "../../core/filesystem/associations";
import { useLaunchData } from "../../core/launch";
import { useDesk } from "../../core/store";
import { readStorage, writeStorage } from "../../core/storage";
import { ContextMenu } from "../../components/Overlays";
import type { MenuItem } from "../../components/Overlays";
import { FileIcon, FilePreview } from "./FilePreview";
import { OperationDialog } from "./OperationDialog";
import type { FileDialog } from "./OperationDialog";
import "./files.css";
export function FileExplorer() {
  const { entries, error, loading, retry } = useFilesystem();
  const launch = useLaunchData();
  const [history, setHistory] = useState([launch.entryId ?? HOME]);
  const [index, setIndex] = useState(0);
  const location = history[index];
  const current = entries.find((e) => e.id === location && !e.trashed);
  const virtual = ["recent", "favorites", "trash"].includes(location);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [selected, setSelected] = useState<string[]>([]);
  const [anchor, setAnchor] = useState<string>();
  const [view, setView] = useState(() => {
    const v = readStorage("files-view");
    return v === "list" || v === "details" ? v : "grid";
  });
  const [details, setDetails] = useState(
    () => readStorage("files-details") === true,
  );
  const [sort, setSort] = useState("name");
  const [descending, setDescending] = useState(false);
  const [foldersFirst, setFoldersFirst] = useState(true);
  const [dialog, setDialog] = useState<FileDialog | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [menu, setMenu] = useState<{
    x: number;
    y: number;
    items: MenuItem[];
  } | null>(null);
  const [busy, setBusy] = useState("");
  const [progress, setProgress] = useState(0);
  const [operationError, setOperationError] = useState("");
  const [dropTarget, setDropTarget] = useState<string | null>(null);
  const [limit, setLimit] = useState(200);
  const picker = useRef<HTMLInputElement>(null);
  const folderPicker = useRef<HTMLInputElement>(null);
  const search = useRef<HTMLInputElement>(null);
  const clipboard = useFileClipboard();
  const closeMenu = useCallback(() => setMenu(null), []);
  const closeDialog = useCallback(() => setDialog(null), []);
  const closePreview = useCallback(() => setPreview(null), []);
  const path = useMemo(() => {
    const result: Entry[] = [];
    let e = current;
    const seen = new Set<string>();
    while (e && !seen.has(e.id)) {
      seen.add(e.id);
      result.unshift(e);
      e = entries.find((p) => p.id === e!.parentId);
    }
    return result;
  }, [current, entries]);
  const selectedEntries = entries.filter((e) => selected.includes(e.id));
  const activeSelected = selectedEntries.filter((e) =>
    location === "trash" ? e.trashed : !e.trashed,
  );
  const target = current?.kind === "directory" ? current.id : HOME;
  function entryPath(id: string) {
    const parts: string[] = [];
    const seen = new Set<string>();
    let e = entries.find((e) => e.id === id);
    while (e && !seen.has(e.id)) {
      seen.add(e.id);
      parts.unshift(e.name);
      e = entries.find((p) => p.id === e!.parentId);
    }
    return parts.join(" / ");
  }

  const visible = useMemo(
    () =>
      entries
        .filter((e) => {
          if (location === "trash")
            return (
              e.trashed &&
              e.trashRoot === e.id &&
              e.name.toLowerCase().includes(query.toLowerCase())
            );
          if (e.trashed || e.id === HOME) return false;
          const scope = query
            ? true
            : location === "recent"
              ? e.kind === "file" && Boolean(e.accessed)
              : location === "favorites"
                ? e.favorite
                : e.parentId === location;
          const match =
            `${e.name} ${e.extension} ${e.mime} ${e.kind} ${entries.find((p) => p.id === e.parentId)?.name ?? ""}`
              .toLowerCase()
              .includes(query.toLowerCase());
          return (
            scope &&
            match &&
            (filter === "all" ||
              (filter === "folders"
                ? e.kind === "directory"
                : filter === "files"
                  ? e.kind === "file"
                  : e.mime.startsWith(filter + "/")))
          );
        })
        .sort((a, b) => {
          if (foldersFirst && a.kind !== b.kind)
            return a.kind === "directory" ? -1 : 1;
          const delta =
            sort === "size"
              ? a.size - b.size
              : sort === "modified"
                ? a.modified - b.modified
                : sort === "created"
                  ? a.created - b.created
                  : sort === "type"
                    ? a.mime.localeCompare(b.mime)
                    : sort === "recent"
                      ? (a.accessed ?? 0) - (b.accessed ?? 0)
                      : a.name.localeCompare(b.name, undefined, {
                          numeric: true,
                        });
          return descending ? -delta : delta;
        }),
    [entries, location, query, filter, sort, descending, foldersFirst],
  );
  function navigate(id: string) {
    setHistory((h) => [...h.slice(0, index + 1), id]);
    setIndex(index + 1);
    setSelected([]);
    setQuery("");
    setLimit(200);
    if (id === "recent") {
      setSort("recent");
      setDescending(true);
    }
  }
  async function run(label: string, action: () => Promise<unknown>) {
    if (busy) return;
    setBusy(label);
    setProgress(0);
    setOperationError("");
    try {
      await action();
      useDesk.getState().notify(label + " completed", "success");
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      setOperationError(message);
      useDesk.getState().notify(message, "error");
    } finally {
      setBusy("");
    }
  }
  function open(e: Entry) {
    if (e.kind === "directory") navigate(e.id);
    else setPreview(e.id);
  }
  function create(kind: "directory" | "txt" | "md" | "json") {
    setDialog({
      title: kind === "directory" ? "New folder" : "New document",
      label: "Name",
      initial: kind === "directory" ? "Untitled folder" : `Untitled.${kind}`,
      run: async (name) => {
        if (kind === "directory") await fs.createDirectory(target, name);
        else
          await fs.createFile(
            target,
            name,
            new Blob([kind === "json" ? "{}\n" : ""], {
              type: kind === "json" ? "application/json" : "text/plain",
            }),
          );
      },
    });
  }
  function rename(e: Entry) {
    setDialog({
      title: "Rename item",
      label: "Name (including extension)",
      initial: e.name,
      run: (name) => fs.renameEntry(e.id, name),
    });
  }
  function transfer(copy: boolean, ids = activeSelected.map((e) => e.id)) {
    setDialog({
      title: copy ? "Copy to folder" : "Move to folder",
      label: "Destination",
      initial: HOME,
      destinations: entries.filter((e) => e.kind === "directory" && !e.trashed),
      run: (dest) => fs.transfer(ids, dest, copy),
    });
  }
  function remove(ids = activeSelected.map((e) => e.id)) {
    void run("Move to Trash", () => fs.deleteEntries(ids));
    setSelected([]);
  }
  function permanent(ids: string[]) {
    setDialog({
      title: "Delete permanently?",
      confirm:
        "These items and all their contents will be removed from this browser. This cannot be undone.",
      run: async () => {
        for (const id of ids) await fs.permanentlyDeleteEntry(id);
      },
    });
  }
  function paste() {
    void run(clipboard.cut ? "Move" : "Copy", async () => {
      await fs.transfer(clipboard.ids, target, !clipboard.cut);
      if (clipboard.cut) clipboard.set([], false);
    });
  }
  function context(e: React.MouseEvent, item?: Entry) {
    e.preventDefault();
    e.stopPropagation();
    const ids = item
      ? selected.includes(item.id)
        ? activeSelected.map((e) => e.id)
        : [item.id]
      : activeSelected.map((e) => e.id);
    if (item && !selected.includes(item.id)) setSelected([item.id]);
    const actions: MenuItem[] =
      location === "trash"
        ? [
            {
              label: "Restore",
              run: () =>
                void run("Restore", async () => {
                  for (const id of ids) await fs.restoreEntry(id);
                }),
            },
            { label: "Delete permanently", run: () => permanent(ids) },
          ]
        : item
          ? [
              {
                label:
                  item.kind === "directory"
                    ? "Open folder"
                    : `Open with ${handlerName(item)}`,
                run: () => open(item),
              },
              ...(item.protected
                ? []
                : [
                    { label: "Rename", run: () => rename(item) },
                    { label: "Cut", run: () => clipboard.set(ids, true) },
                  ]),
              { label: "Copy", run: () => clipboard.set(ids, false) },
              { label: "Copy to…", run: () => transfer(true, ids) },
              ...(item.protected
                ? []
                : [
                    { label: "Move to…", run: () => transfer(false, ids) },
                    {
                      label: "Duplicate",
                      run: () =>
                        void run("Duplicate", () =>
                          fs.transfer(ids, item.parentId!, true),
                        ),
                    },
                    { label: "Move to Trash", run: () => remove(ids) },
                  ]),
              {
                label: item.favorite ? "Remove favorite" : "Add to Favorites",
                run: () =>
                  void run("Favorite update", () =>
                    fs.favorite(item.id, !item.favorite),
                  ),
              },
              {
                label: "Export / ZIP",
                run: () =>
                  void run("Export", () => exportFiles(ids, setProgress)),
              },
              {
                label: "Show details",
                run: () => {
                  setDetails(true);
                  writeStorage("files-details", true);
                },
              },
            ]
          : [
              { label: "New folder", run: () => create("directory") },
              { label: "New text document", run: () => create("txt") },
              { label: "Import files", run: () => picker.current?.click() },
              ...(clipboard.ids.length ? [{ label: "Paste", run: paste }] : []),
            ];
    setMenu({ x: e.clientX, y: e.clientY, items: actions });
  }
  async function drop(e: DragEvent, destination: string) {
    e.preventDefault();
    e.stopPropagation();
    setDropTarget(null);
    const data = e.dataTransfer.getData(dragType);
    if (data) {
      try {
        const ids: unknown = JSON.parse(data);
        if (!Array.isArray(ids) || !ids.every((id) => typeof id === "string"))
          throw Error("Invalid drag data");
        await run(e.ctrlKey ? "Copy" : "Move", () =>
          fs.transfer(ids, destination, e.ctrlKey),
        );
      } catch {
        setOperationError("Invalid drop.");
      }
    } else if (e.dataTransfer.files.length)
      await run("Import", () =>
        importFiles(destination, Array.from(e.dataTransfer.files), setProgress),
      );
  }
  const dropProps = (id: string) => ({
    onDragOver: (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setDropTarget(id);
    },
    onDragLeave: () => setDropTarget(null),
    onDrop: (e: DragEvent) => void drop(e, id),
  });
  function select(e: React.MouseEvent, item: Entry) {
    if (e.shiftKey && anchor) {
      const a = visible.findIndex((x) => x.id === anchor);
      const b = visible.findIndex((x) => x.id === item.id);
      setSelected(
        visible.slice(Math.min(a, b), Math.max(a, b) + 1).map((x) => x.id),
      );
    } else if (e.ctrlKey || e.metaKey)
      setSelected((s) =>
        s.includes(item.id)
          ? s.filter((id) => id !== item.id)
          : [...s, item.id],
      );
    else setSelected([item.id]);
    setAnchor(item.id);
  }
  return (
    <div
      className="file-explorer"
      tabIndex={0}
      onKeyDown={(e) => {
        if (dialog || preview || menu) return;
        if ((e.ctrlKey || e.metaKey) && e.key === "f") {
          e.preventDefault();
          search.current?.focus();
          return;
        }
        if ((e.target as HTMLElement).matches("input,textarea,select")) return;
        const key = e.key.toLowerCase();
        const modifier = e.ctrlKey || e.metaKey;
        if (modifier && ["a", "c", "x", "v"].includes(key)) {
          e.preventDefault();
          if (key === "a") setSelected(visible.map((x) => x.id));
          if (key === "c" || key === "x")
            clipboard.set(
              activeSelected.map((x) => x.id),
              key === "x",
            );
          if (key === "v" && !virtual) paste();
        } else if (key === "escape") setSelected([]);
        else if (key === "delete" && location !== "trash") remove();
        else if (key === "f2" && activeSelected.length === 1) {
          e.preventDefault();
          rename(activeSelected[0]);
        } else if (key === "enter" && activeSelected.length === 1)
          open(activeSelected[0]);
        else if (key === "backspace" || (e.altKey && key === "arrowleft")) {
          e.preventDefault();
          if (index > 0) setIndex(index - 1);
        } else if (e.altKey && key === "arrowright") {
          e.preventDefault();
          if (index < history.length - 1) setIndex(index + 1);
        } else if (
          ["arrowdown", "arrowup", "arrowleft", "arrowright"].includes(key)
        ) {
          e.preventDefault();
          const at = visible.findIndex((x) => x.id === selected.at(-1));
          const next = Math.max(
            0,
            Math.min(
              visible.length - 1,
              at + (key === "arrowup" || key === "arrowleft" ? -1 : 1),
            ),
          );
          if (visible[next]) {
            setSelected([visible[next].id]);
            setLimit((n) => Math.max(n, next + 1));
            (
              e.currentTarget.querySelector(
                `[data-entry-id="${visible[next].id}"]`,
              ) as HTMLElement
            )?.focus();
          }
        }
      }}
    >
      <aside className="file-sidebar">
        <div className="files-brand">
          <Folder size={22} />
          <strong>Files</strong>
        </div>
        <small>YOUR WORKSPACE</small>
        {[
          { id: HOME, name: "Home" },
          ...folders.map((name) => ({ id: folderId(name), name })),
        ].map((e) => (
          <button
            key={e.id}
            className={`${location === e.id ? "selected" : ""} ${dropTarget === e.id ? "drop-target" : ""}`}
            onClick={() => navigate(e.id)}
            {...dropProps(e.id)}
          >
            <Folder size={16} />
            {e.name}
          </button>
        ))}
        <small>COLLECTIONS</small>
        {[
          { id: "recent", name: "Recent", icon: Clock },
          { id: "favorites", name: "Favorites", icon: Star },
          { id: "trash", name: "Trash", icon: Trash2 },
        ].map((e) => (
          <button
            key={e.id}
            className={location === e.id ? "selected" : ""}
            onClick={() => navigate(e.id)}
          >
            <e.icon size={16} />
            {e.name}
            {e.id === "trash" && (
              <span className="file-count">
                {
                  entries.filter((e) => e.trashed && e.trashRoot === e.id)
                    .length
                }
              </span>
            )}
          </button>
        ))}
        {entries
          .filter((e) => e.favorite && e.kind === "directory" && !e.trashed)
          .map((e) => (
            <button
              key={e.id}
              className={dropTarget === e.id ? "drop-target" : ""}
              onClick={() => navigate(e.id)}
              {...dropProps(e.id)}
            >
              <Star size={14} />
              {e.name}
            </button>
          ))}
        <div className="file-storage">
          <small>ON THIS BROWSER</small>
          <strong>
            {formatBytes(entries.reduce((n, e) => n + e.size, 0))}
          </strong>
          <span>Virtual storage · Local to DeskOS</span>
        </div>
      </aside>
      <section className="file-main">
        <header className="file-navigation">
          <button
            aria-label="Back"
            title="Back"
            disabled={index === 0}
            onClick={() => {
              setIndex(index - 1);
              setSelected([]);
              setQuery("");
            }}
          >
            <ArrowLeft size={16} />
          </button>
          <button
            aria-label="Forward"
            title="Forward"
            disabled={index === history.length - 1}
            onClick={() => {
              setIndex(index + 1);
              setSelected([]);
              setQuery("");
            }}
          >
            <ArrowRight size={16} />
          </button>
          <button
            aria-label="Up"
            title="Parent folder"
            disabled={!current?.parentId}
            onClick={() => navigate(current!.parentId!)}
          >
            <ArrowUp size={16} />
          </button>
          <button aria-label="Refresh files" onClick={retry}>
            <RefreshCw size={15} />
          </button>
          <nav aria-label="Folder path" className="file-breadcrumbs">
            {path.map((e) => (
              <button
                key={e.id}
                aria-current={e.id === location ? "page" : undefined}
                onClick={() => navigate(e.id)}
              >
                {e.name}
                <span>/</span>
              </button>
            ))}
            {virtual && <strong>{location}</strong>}
          </nav>
        </header>
        <div className="file-heading">
          <div>
            <small>PERSONAL WORKSPACE</small>
            <h2>
              {query
                ? "Search results"
                : (current?.name ??
                  location.charAt(0).toUpperCase() + location.slice(1))}
            </h2>
          </div>
          <div className="file-search">
            <Search size={16} />
            <input
              ref={search}
              aria-label="Search files"
              placeholder="Search all files…"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setLimit(200);
              }}
            />
            {query && (
              <button
                aria-label="Clear file search"
                onClick={() => setQuery("")}
              >
                <X size={14} />
              </button>
            )}
          </div>
        </div>
        <div className="file-toolbar">
          <button
            title={virtual ? "Open a folder to create items" : "New folder"}
            disabled={virtual || busy !== ""}
            onClick={() => create("directory")}
          >
            <FolderPlus size={16} />
            <span>New folder</span>
          </button>
          <select
            aria-label="New file type"
            disabled={virtual || busy !== ""}
            value=""
            onChange={(e) => create(e.target.value as "txt" | "md" | "json")}
          >
            <option value="" disabled>
              New file
            </option>
            <option value="txt">Text document</option>
            <option value="md">Markdown</option>
            <option value="json">JSON</option>
          </select>
          <button
            disabled={virtual || busy !== ""}
            onClick={() => picker.current?.click()}
          >
            <Upload size={16} />
            <span>Import</span>
          </button>
          <button
            disabled={virtual || busy !== ""}
            title="Import folder (requires browser folder-picker support)"
            onClick={() => folderPicker.current?.click()}
          >
            Import folder
          </button>
          <div className="file-toolbar-spacer" />
          {(["grid", "list", "details"] as const).map((v, i) => {
            const Icon = [LayoutGrid, List, Columns3][i];
            return (
              <button
                key={v}
                aria-label={`${v} view`}
                aria-pressed={view === v}
                className={view === v ? "selected" : ""}
                onClick={() => {
                  setView(v);
                  writeStorage("files-view", v);
                }}
              >
                <Icon size={16} />
              </button>
            );
          })}
          <button
            aria-label="Toggle details pane"
            aria-pressed={details}
            onClick={() => {
              setDetails(!details);
              writeStorage("files-details", !details);
            }}
          >
            <PanelRight size={16} />
          </button>
        </div>
        <div className="file-sortbar">
          <span>{visible.length} items</span>
          <select
            aria-label="Filter file type"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          >
            {["all", "folders", "files", "image", "audio", "video"].map((v) => (
              <option key={v} value={v}>
                {v === "all" ? "All types" : v}
              </option>
            ))}
          </select>
          <select
            aria-label="Sort files"
            value={sort}
            onChange={(e) => setSort(e.target.value)}
          >
            {["name", "type", "size", "modified", "created", "recent"].map(
              (v) => (
                <option key={v} value={v}>
                  Sort: {v}
                </option>
              ),
            )}
          </select>
          <button
            aria-label="Reverse sort order"
            onClick={() => setDescending(!descending)}
          >
            {descending ? "↓" : "↑"}
          </button>
          <label>
            <input
              type="checkbox"
              checked={foldersFirst}
              onChange={(e) => setFoldersFirst(e.target.checked)}
            />{" "}
            Folders first
          </label>
        </div>
        {activeSelected.length > 0 && (
          <div className="file-selection-bar">
            <strong>{activeSelected.length} selected</strong>
            {location === "trash" ? (
              <>
                <button
                  onClick={() =>
                    void run("Restore", async () => {
                      for (const e of activeSelected)
                        await fs.restoreEntry(e.id);
                    })
                  }
                >
                  Restore
                </button>
                <button
                  onClick={() => permanent(activeSelected.map((e) => e.id))}
                >
                  Delete permanently
                </button>
              </>
            ) : (
              <>
                <button
                  title="Copy"
                  aria-label="Copy selection"
                  onClick={() =>
                    clipboard.set(
                      activeSelected.map((e) => e.id),
                      false,
                    )
                  }
                >
                  <Copy size={15} />
                </button>
                <button
                  title="Cut"
                  aria-label="Cut selection"
                  onClick={() =>
                    clipboard.set(
                      activeSelected.map((e) => e.id),
                      true,
                    )
                  }
                >
                  <Scissors size={15} />
                </button>
                <button onClick={() => transfer(false)}>Move to…</button>
                <button onClick={() => transfer(true)}>Copy to…</button>
                <button aria-label="Trash selection" onClick={() => remove()}>
                  <Trash2 size={15} />
                </button>
                <button
                  aria-label="Export selection"
                  onClick={() =>
                    void run("Export", () =>
                      exportFiles(
                        activeSelected.map((e) => e.id),
                        setProgress,
                      ),
                    )
                  }
                >
                  <Download size={15} />
                </button>
              </>
            )}
          </div>
        )}
        {clipboard.ids.length > 0 && !virtual && (
          <button className="file-paste" onClick={paste}>
            <ClipboardPaste size={14} />
            Paste {clipboard.ids.length} {clipboard.cut ? "cut" : "copied"}{" "}
            items here
          </button>
        )}
        {location === "trash" && visible.length > 0 && (
          <button
            className="file-paste"
            onClick={() =>
              setDialog({
                title: "Empty Trash?",
                confirm:
                  "All trashed items will be permanently deleted. This cannot be undone.",
                run: () => fs.emptyTrash(),
              })
            }
          >
            Empty Trash
          </button>
        )}
        {(error || operationError) && (
          <div className="file-alert" role="alert">
            {error || operationError}
            <button
              onClick={() => {
                setOperationError("");
                retry();
              }}
            >
              Retry / refresh
            </button>
          </div>
        )}
        {busy && (
          <div className="file-progress" role="status">
            {busy}… {Math.round(progress)}%
            <progress max="100" value={progress} />
          </div>
        )}
        <div className="file-body">
          <div
            className={`file-listing ${view} ${dropTarget === target ? "drop-target" : ""}`}
            onContextMenu={(e) => context(e)}
            {...(!virtual ? dropProps(target) : {})}
          >
            {loading ? (
              <div className="empty" role="status">
                Opening your workspace…
              </div>
            ) : !virtual && !current ? (
              <div className="empty">
                <Folder size={40} />
                <h2>This folder is unavailable.</h2>
                <button onClick={() => navigate(HOME)}>Return Home</button>
              </div>
            ) : !visible.length ? (
              <div className="empty">
                <Folder size={50} />
                <h2>
                  {query
                    ? "Nothing found."
                    : location === "trash"
                      ? "A clean slate."
                      : "Room for something new."}
                </h2>
                <p>
                  {query
                    ? "Try a name, extension, type, or folder."
                    : location === "trash"
                      ? "Deleted items will appear here."
                      : "Create a folder or import files to make this space yours."}
                </p>
                {!virtual && !query && (
                  <button
                    className="primary"
                    onClick={() => picker.current?.click()}
                  >
                    <Upload size={16} />
                    Import files
                  </button>
                )}
              </div>
            ) : (
              <>
                {view === "details" && (
                  <div className="file-table-heading">
                    {["name", "type", "size", "modified"].map((s) => (
                      <button
                        key={s}
                        onClick={() => {
                          setSort(s);
                          setDescending(sort === s ? !descending : false);
                        }}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                )}
                {visible.slice(0, limit).map((item) => (
                  <button
                    key={item.id}
                    data-entry-id={item.id}
                    className={`file-item ${selected.includes(item.id) ? "selected" : ""} ${clipboard.cut && clipboard.ids.includes(item.id) ? "cut" : ""} ${dropTarget === item.id ? "drop-target" : ""}`}
                    aria-pressed={selected.includes(item.id)}
                    draggable={!item.protected && location !== "trash"}
                    onClick={(e) => select(e, item)}
                    onDoubleClick={() => {
                      if (location !== "trash") open(item);
                    }}
                    onContextMenu={(e) => context(e, item)}
                    onDragStart={(e) => {
                      const ids = selected.includes(item.id)
                        ? activeSelected.map((e) => e.id)
                        : [item.id];
                      e.dataTransfer.setData(dragType, JSON.stringify(ids));
                      e.dataTransfer.effectAllowed = "copyMove";
                    }}
                    {...(item.kind === "directory" && !item.trashed
                      ? dropProps(item.id)
                      : {})}
                  >
                    {view === "grid" ? (
                      <FileThumbnail entry={item} />
                    ) : (
                      <FileIcon entry={item} size={21} />
                    )}
                    <span className="file-name">
                      {item.name}
                      {item.favorite && <Star size={10} />}
                    </span>
                    <span className="file-type">
                      {item.kind === "directory"
                        ? "Folder"
                        : item.extension.toUpperCase() || "File"}
                    </span>
                    <span className="file-size">
                      {item.kind === "directory"
                        ? `${entries.filter((e) => e.parentId === item.id && !e.trashed).length} items`
                        : formatBytes(item.size)}
                    </span>
                    <span className="file-date">
                      {new Date(item.modified).toLocaleDateString()}
                    </span>
                    {query && (
                      <span className="file-location">
                        {entries.find((e) => e.id === item.parentId)?.name}
                      </span>
                    )}
                  </button>
                ))}
                {visible.length > limit && (
                  <button onClick={() => setLimit((n) => n + 200)}>
                    Show next 200 items
                  </button>
                )}
              </>
            )}
          </div>
          {details && (
            <aside className="file-details">
              {activeSelected.length === 1 ? (
                <>
                  <FileThumbnail entry={activeSelected[0]} />
                  <h3>{activeSelected[0].name}</h3>
                  <dl>
                    {[
                      ["Kind", activeSelected[0].kind],
                      ["Size", formatBytes(activeSelected[0].size)],
                      [
                        "Location",
                        entryPath(activeSelected[0].parentId ?? HOME),
                      ],
                      [
                        "Created",
                        new Date(activeSelected[0].created).toLocaleString(),
                      ],
                      [
                        "Modified",
                        new Date(activeSelected[0].modified).toLocaleString(),
                      ],
                      ["Extension", activeSelected[0].extension || "—"],
                      ["MIME", activeSelected[0].mime || "—"],
                    ].map(([k, v]) => (
                      <div key={k}>
                        <dt>{k}</dt>
                        <dd>{v}</dd>
                      </div>
                    ))}
                  </dl>
                  {activeSelected[0].kind === "file" &&
                    !activeSelected[0].trashed && (
                      <button onClick={() => open(activeSelected[0])}>
                        Preview / edit
                      </button>
                    )}
                </>
              ) : (
                <>
                  <PanelRight size={36} />
                  <h3>
                    {activeSelected.length
                      ? `${activeSelected.length} items`
                      : "A closer look."}
                  </h3>
                  <p>
                    {activeSelected.length
                      ? formatBytes(
                          activeSelected.reduce((n, e) => n + e.size, 0),
                        )
                      : "Select a file to see its details."}
                  </p>
                </>
              )}
            </aside>
          )}
        </div>
        <footer className="file-footer">
          <span>
            {activeSelected.length
              ? `${activeSelected.length} selected`
              : `${visible.length} items`}{" "}
            · {formatBytes(visible.reduce((n, e) => n + e.size, 0))}
          </span>
          <span>Stored in this browser</span>
        </footer>
      </section>
      <input
        ref={picker}
        hidden
        type="file"
        multiple
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []);
          void run("Import", () => importFiles(target, files, setProgress));
          e.target.value = "";
        }}
      />
      <input
        ref={folderPicker}
        hidden
        type="file"
        multiple
        {...{ webkitdirectory: "" }}
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []);
          void run("Folder import", () =>
            importFiles(target, files, setProgress),
          );
          e.target.value = "";
        }}
      />
      {menu && <ContextMenu {...menu} close={closeMenu} />}
      {dialog && (
        <OperationDialog
          key={dialog.title + dialog.initial}
          dialog={dialog}
          close={closeDialog}
        />
      )}
      {preview && entries.find((e) => e.id === preview && !e.trashed) && (
        <FilePreview
          key={preview}
          entry={entries.find((e) => e.id === preview)!}
          close={closePreview}
        />
      )}
    </div>
  );
}

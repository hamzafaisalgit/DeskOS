import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  FileText,
  Code2,
  Plus,
  Save,
  FolderOpen,
  X,
  PanelLeft,
  Eye,
  Star,
  Download,
  Copy,
  Trash2,
  Play,
  Settings2,
} from "lucide-react";
import { useDocuments } from "../../core/documents/useDocuments";
import { registerCloseGuard } from "../../core/documents/guards";
import { useFilesystem } from "../../core/filesystem/hooks";
import { filesystem as fs } from "../../core/filesystem/service";
import { folderId } from "../../core/filesystem/types";
import { useLaunchData } from "../../core/launch";
import { useDesk } from "../../core/store";
import { useNotes } from "../../core/notes";
import { readStorage, writeStorage } from "../../core/storage";
import { exportFiles } from "../../core/filesystem/transfers";
import { buildWebPreview } from "../../core/documents/webPreview";
import { OperationDialog } from "../files/OperationDialog";
import type { FileDialog } from "../files/OperationDialog";
import { FocusPanel } from "../../components/Overlays";
import type { editor } from "monaco-editor";
import "./editor.css";
import { ProjectTree } from "./ProjectTree";
const Monaco = lazy(() => import("./Monaco"));
const language = (name: string) =>
  ({
    js: "javascript",
    jsx: "javascript",
    ts: "typescript",
    tsx: "typescript",
    html: "html",
    css: "css",
    json: "json",
    md: "markdown",
    py: "python",
  })[name.split(".").at(-1) ?? ""] ?? "plaintext";
export function NotesApp() {
  return <DocumentEditor mode="notes" />;
}
export function CodeStudio() {
  return <DocumentEditor mode="code" />;
}
function DocumentEditor({ mode }: { mode: "notes" | "code" }) {
  const d = useDocuments();
  const { entries } = useFilesystem();
  const launch = useLaunchData();
  const prefs = useDesk((s) => s.prefs);
  const legacy = useNotes((s) => s.notes);
  const [project, setProject] = useState(
    mode === "notes" ? folderId("Documents") : folderId("Projects"),
  );
  const [search, setSearch] = useState("");
  const [collection, setCollection] = useState("folder");
  const [sidebar, setSidebar] = useState(true);
  const [rendered, setRendered] = useState(false);
  const [bottom, setBottom] = useState(false);
  const [dialog, setDialog] = useState<FileDialog | null>(null);
  const [closing, setClosing] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [fontSize, setFontSize] = useState(() => {
    const n = Number(readStorage("editor-font"));
    return n >= 10 && n <= 24 ? n : 14;
  });
  const [wrap, setWrap] = useState(() => readStorage("editor-wrap") !== false);
  const [position, setPosition] = useState({ lineNumber: 1, column: 1 });
  const [problems, setProblems] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [systemDark, setSystemDark] = useState(
    () => matchMedia("(prefers-color-scheme: dark)").matches,
  );
  useEffect(() => {
    const media = matchMedia("(prefers-color-scheme: dark)");
    const change = () => setSystemDark(media.matches);
    media.addEventListener("change", change);
    return () => media.removeEventListener("change", change);
  }, []);
  const textarea = useRef<HTMLTextAreaElement>(null);
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const closeDialog = useCallback(() => setDialog(null), []);
  const closePreview = useCallback(() => setPreview(null), []);
  const dirty = d.tabs.some((t) => t.text !== t.saved);
  const current = d.current;
  const initialized = useRef("");
  const bypass = useRef(false);
  const openDocument = d.open;
  const reportError = d.setError;
  useEffect(() => {
    if (launch.entryId && initialized.current !== launch.entryId) {
      initialized.current = launch.entryId;
      void fs
        .getEntry(launch.entryId)
        .then((e) => {
          if (e.kind === "directory") setProject(e.id);
          else void openDocument(e.id);
        })
        .catch((e) => reportError(String(e)));
    }
  }, [launch.entryId, openDocument, reportError]);
  useEffect(() => {
    if (!launch.windowId || !dirty) return;
    const unregister = registerCloseGuard(launch.windowId, () => {
      if (!bypass.current) setClosing("window");
    });
    const before = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", before);
    return () => {
      unregister();
      window.removeEventListener("beforeunload", before);
    };
  }, [dirty, launch.windowId]);
  async function act(work: () => Promise<unknown>) {
    try {
      d.setError("");
      await work();
    } catch (e) {
      d.setError(String(e));
    }
  }
  async function save(id?: string) {
    setSaving(true);
    try {
      await d.save(id);
    } finally {
      setSaving(false);
    }
  }
  function newFile() {
    setDialog({
      title: mode === "notes" ? "Create a note" : "New project file",
      label: "Name",
      initial: mode === "notes" ? "Untitled.md" : "untitled.txt",
      run: async (name) => {
        const e = await fs.createFile(project, name);
        await d.open(e.id);
      },
    });
  }
  function saveAs() {
    if (!current) return;
    setDialog({
      title: "Save As in selected folder",
      label: "Name",
      initial: current.entry.name,
      run: async (name) => {
        const e = await fs.createFile(
          project,
          name,
          new Blob([current.text], { type: current.entry.mime }),
          false,
        );
        await d.open(e.id);
      },
    });
  }
  function requestClose(id: string) {
    const t = d.tabs.find((t) => t.id === id);
    if (t && t.text !== t.saved) setClosing(id);
    else d.close(id);
  }
  async function finishClose(saveFirst: boolean) {
    if (saveFirst) {
      if (closing === "window") {
        for (const tab of d.tabs.filter((t) => t.text !== t.saved))
          await save(tab.id);
      } else await save(closing!);
    }
    if (closing === "window") {
      bypass.current = true;
      const unregister = registerCloseGuard(launch.windowId!, () => {});
      unregister();
      useDesk.getState().close(launch.windowId!);
    } else d.close(closing!);
    setClosing(null);
  }
  function format(before: string, after = "") {
    const field = textarea.current;
    if (!field || !current) return;
    const start = field.selectionStart,
      end = field.selectionEnd;
    d.edit(
      current.text.slice(0, start) +
        before +
        current.text.slice(start, end) +
        after +
        current.text.slice(end),
    );
    requestAnimationFrame(() => {
      field.focus();
      field.setSelectionRange(start + before.length, end + before.length);
    });
  }
  const folder = entries.find((e) => e.id === project);
  const isDescendant = (id: string) => {
    const seen = new Set<string>();
    let e = entries.find((e) => e.id === id);
    while (e && !seen.has(e.id)) {
      if (e.parentId === project) return true;
      seen.add(e.id);
      e = entries.find((p) => p.id === e!.parentId);
    }
    return false;
  };
  const files = entries
    .filter(
      (e) =>
        !e.trashed &&
        e.kind === "file" &&
        (mode === "code" || /^(md|txt|markdown)$/.test(e.extension)) &&
        (collection === "all" || search
          ? true
          : collection === "favorites"
            ? e.favorite
            : collection === "recent"
              ? Boolean(e.accessed)
              : isDescendant(e.id)),
    )
    .filter((e) => e.name.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) =>
      collection === "recent"
        ? (b.accessed ?? 0) - (a.accessed ?? 0)
        : a.name.localeCompare(b.name),
    );
  const directories = entries.filter(
    (e) => e.kind === "directory" && !e.trashed,
  );
  return (
    <div
      className={`document-app ${mode}`}
      onKeyDown={(e) => {
        if (dialog || closing || preview) return;
        const mod = e.ctrlKey || e.metaKey;
        if (!mod) return;
        const key = e.key.toLowerCase();
        if (["s", "o", "n", "w", "p"].includes(key)) {
          e.preventDefault();
          e.stopPropagation();
          if (key === "s") {
            if (e.shiftKey) saveAs();
            else void act(() => save());
          }
          if (key === "o" || key === "p") {
            setSidebar(true);
            setCollection("all");
            requestAnimationFrame(() => searchRef.current?.focus());
          }
          if (key === "n") newFile();
          if (key === "w" && current) requestClose(current.id);
        }
      }}
    >
      <div className="document-activity">
        <button
          title="Toggle sidebar"
          aria-label="Toggle document sidebar"
          onClick={() => setSidebar(!sidebar)}
        >
          <PanelLeft size={19} />
        </button>
        <button title="New document" onClick={newFile}>
          <Plus size={19} />
        </button>
        <button
          title="Recent files"
          onClick={() => {
            setSidebar(true);
            setCollection("recent");
          }}
        >
          <FolderOpen size={19} />
        </button>
        <button title="Editor settings" onClick={() => setBottom(!bottom)}>
          <Settings2 size={19} />
        </button>
      </div>
      {sidebar && (
        <aside className="document-sidebar">
          <div className="document-brand">
            {mode === "notes" ? <FileText size={20} /> : <Code2 size={20} />}
            <strong>{mode === "notes" ? "Notes" : "Code Studio"}</strong>
          </div>
          <small>
            {mode === "notes" ? "YOUR NOTEBOOK" : "PROJECT EXPLORER"}
          </small>
          <select
            aria-label="Project folder"
            value={project}
            onChange={(e) => {
              setProject(e.target.value);
              setCollection("folder");
            }}
          >
            {directories.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name}
              </option>
            ))}
          </select>
          <div className="document-collections">
            {["folder", "all", "recent", "favorites"].map((c) => (
              <button
                key={c}
                className={collection === c ? "selected" : ""}
                onClick={() => setCollection(c)}
              >
                {c}
              </button>
            ))}
          </div>
          <input
            ref={searchRef}
            aria-label="Search documents"
            placeholder="Find a document…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <div className="project-folders">
            {directories
              .filter((e) => e.parentId === project)
              .map((e) => (
                <button key={e.id} onClick={() => setProject(e.id)}>
                  <FolderOpen size={14} />
                  {e.name}
                </button>
              ))}
            {folder?.parentId && (
              <button onClick={() => setProject(folder.parentId!)}>
                ← Parent folder
              </button>
            )}
          </div>
          <div className="document-file-list">
            {mode === "code" && collection === "folder" && !search ? (
              <ProjectTree
                entries={entries}
                root={project}
                active={d.active}
                open={(id) => {
                  void d.open(id);
                }}
                folder={setProject}
                rename={(e) =>
                  setDialog({
                    title: "Rename item",
                    label: "Name",
                    initial: e.name,
                    run: (name) => fs.renameEntry(e.id, name),
                  })
                }
                trash={(e) =>
                  setDialog({
                    title: "Move to Trash?",
                    confirm:
                      "Saved files can be restored in Files. Unsaved tabs remain open.",
                    run: () => fs.deleteEntry(e.id),
                  })
                }
              />
            ) : (
              files.map((e) => (
                <button
                  key={e.id}
                  className={d.active === e.id ? "selected" : ""}
                  onClick={() => void d.open(e.id)}
                >
                  <FileText size={15} />
                  <span>{e.name}</span>
                  {e.favorite && <Star size={11} />}
                </button>
              ))
            )}
            {!files.length && <p>No documents here yet.</p>}
          </div>
          <button onClick={newFile}>
            <Plus size={14} />
            New {mode === "notes" ? "note" : "file"}
          </button>
          <button
            onClick={() =>
              setDialog({
                title: "New folder",
                label: "Folder name",
                initial: "New folder",
                run: (name) => fs.createDirectory(project, name),
              })
            }
          >
            New folder
          </button>
          {mode === "notes" && legacy.length > 0 && (
            <button
              onClick={() =>
                setDialog({
                  title: "Copy legacy scratchpads to Documents",
                  confirm: `Copy ${legacy.length} original notes into the filesystem. Originals remain preserved. Repeating this creates additional copies.`,
                  run: async () => {
                    for (const note of legacy) {
                      const safe =
                        (note.title || "Untitled")
                          .replace(/[\\/]/g, "-")
                          .trim()
                          .slice(0, 150) || "Untitled";
                      await fs.createFile(
                        folderId("Documents"),
                        safe + ".md",
                        new Blob([note.text], { type: "text/markdown" }),
                        true,
                      );
                    }
                  },
                })
              }
            >
              Import {legacy.length} legacy notes
            </button>
          )}
        </aside>
      )}
      <section className="document-main">
        <div className="document-tabs">
          {d.tabs.map((t) => (
            <div key={t.id} className={t.id === d.active ? "active-tab" : ""}>
              <button onClick={() => d.setActive(t.id)}>
                {t.entry.name}
                {t.text !== t.saved && <span className="dirty-dot">●</span>}
              </button>
              <button
                aria-label={`Close tab ${t.entry.name}`}
                onClick={() => requestClose(t.id)}
              >
                <X size={12} />
              </button>
            </div>
          ))}
          <button aria-label="New document" onClick={newFile}>
            <Plus size={15} />
          </button>
        </div>
        <div className="document-toolbar">
          <button
            disabled={!current || saving}
            onClick={() => void act(() => save())}
          >
            <Save size={15} />
            {saving ? "Saving…" : "Save"}
          </button>
          <button disabled={!current} onClick={saveAs}>
            Save As
          </button>
          {current && (
            <>
              <button
                title="Rename"
                onClick={() =>
                  setDialog({
                    title: "Rename document",
                    label: "Name",
                    initial: current.entry.name,
                    run: (name) => fs.renameEntry(current.id, name),
                  })
                }
              >
                Rename
              </button>
              <button
                title="Favorite"
                aria-label="Favorite document"
                onClick={() =>
                  void act(() =>
                    fs.favorite(current.id, !current.entry.favorite),
                  )
                }
              >
                <Star
                  size={14}
                  fill={current.entry.favorite ? "currentColor" : "none"}
                />
              </button>
              <button
                title="Duplicate saved document"
                onClick={() =>
                  void act(() =>
                    fs.copyEntry(current.id, current.entry.parentId!),
                  )
                }
              >
                <Copy size={14} />
              </button>
              <button
                title="Export saved document"
                onClick={() => void act(() => exportFiles([current.id]))}
              >
                <Download size={14} />
              </button>
              <button
                title="Move to Trash"
                aria-label="Trash document"
                onClick={() =>
                  setDialog({
                    title: "Move document to Trash?",
                    confirm:
                      "Saved content can be restored from Files. Unsaved edits remain open until you close the tab.",
                    run: () => fs.deleteEntry(current.id),
                  })
                }
              >
                <Trash2 size={14} />
              </button>
            </>
          )}
          {mode === "notes" ? (
            <button
              onClick={() => setRendered(!rendered)}
              aria-pressed={rendered}
            >
              <Eye size={15} />
              {rendered ? "Edit" : "Read"}
            </button>
          ) : (
            <>
              <button
                disabled={!current}
                onClick={() =>
                  void act(async () => {
                    if (current?.text !== current?.saved)
                      throw Error("Save this document before previewing.");
                    setPreview(await buildWebPreview(current!.id));
                  })
                }
              >
                <Play size={15} />
                Run preview
              </button>
              <button
                onClick={() =>
                  void editorRef.current
                    ?.getAction("editor.action.formatDocument")
                    ?.run()
                }
              >
                Format
              </button>
            </>
          )}
        </div>
        {d.error && (
          <div className="document-warning" role="alert">
            {d.error}
            <button onClick={() => d.setError("")}>Dismiss</button>
          </div>
        )}
        {current?.missing && (
          <div className="document-warning">
            This file was deleted or moved to Trash. Use Save As to preserve
            your edits.
          </div>
        )}
        {current?.external && !current.missing && (
          <div className="document-warning">
            This file changed in another application. Your edits are preserved.
            <button
              onClick={() =>
                setDialog({
                  title: "Reload latest content?",
                  confirm:
                    "This replaces this tab’s unsaved text with the latest saved file.",
                  run: () => d.reload(),
                })
              }
            >
              Reload latest
            </button>
            <button onClick={saveAs}>Save As copy</button>
          </div>
        )}
        {current ? (
          <>
            {mode === "notes" && (
              <div className="format-toolbar">
                {[
                  ["H1", "# "],
                  ["H2", "## "],
                  ["Bold", "**", "**"],
                  ["Italic", "*", "*"],
                  ["Strike", "~~", "~~"],
                  ["Bullets", "- "],
                  ["Numbered", "1. "],
                  ["Task", "- [ ] "],
                  ["Quote", "> "],
                  ["Code", "```\n", "\n```"],
                  ["Link", "[", "](https://example.com)"],
                  ["Rule", "\n---\n"],
                ].map(([label, before, after]) => (
                  <button
                    key={label}
                    disabled={rendered}
                    onClick={() => format(before, after)}
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}
            <div className="document-editor">
              {mode === "notes" ? (
                rendered ? (
                  <article className="markdown-document">
                    <Markdown remarkPlugins={[remarkGfm]}>
                      {current.text}
                    </Markdown>
                  </article>
                ) : (
                  <textarea
                    ref={textarea}
                    aria-label="Note text"
                    spellCheck
                    value={current.text}
                    onChange={(e) => d.edit(e.target.value)}
                    placeholder="A little space to think…"
                    style={{ fontSize }}
                  />
                )
              ) : (
                <Suspense
                  fallback={
                    <div className="empty">Loading Code Studio editor…</div>
                  }
                >
                  <Monaco
                    path={`${launch.windowId}/${current.id}/${current.entry.name}`}
                    language={language(current.entry.name)}
                    value={current.text}
                    onChange={(value) => d.edit(value ?? "")}
                    theme={
                      prefs.theme === "light" ||
                      (prefs.theme === "system" && !systemDark)
                        ? "vs"
                        : "vs-dark"
                    }
                    options={{
                      editContext: false,
                      fontSize,
                      wordWrap: wrap ? "on" : "off",
                      minimap: { enabled: false },
                      automaticLayout: true,
                      scrollBeyondLastLine: false,
                      padding: { top: 18 },
                      tabSize: 2,
                    }}
                    onMount={(instance) => {
                      editorRef.current = instance;
                      const subscription = instance.onDidChangeCursorPosition(
                        (e) => setPosition(e.position),
                      );
                      instance.onDidDispose(() => subscription.dispose());
                    }}
                    onValidate={(markers) =>
                      setProblems(
                        markers.map(
                          (m) =>
                            `${m.startLineNumber}:${m.startColumn} ${m.message}`,
                        ),
                      )
                    }
                  />
                </Suspense>
              )}
            </div>
          </>
        ) : (
          <div className="empty document-welcome">
            {mode === "notes" ? <FileText size={48} /> : <Code2 size={48} />}
            <small>
              {mode === "notes"
                ? "ROOM FOR YOUR IDEAS"
                : "BUILD SOMETHING YOURS"}
            </small>
            <h2>
              {mode === "notes"
                ? "Every thought starts somewhere."
                : "Your next project starts here."}
            </h2>
            <p>
              Open a document from the sidebar or create one.
              <br />
              Files are shared across your DeskOS workspace.
            </p>
            <button className="primary" onClick={newFile}>
              <Plus size={16} />
              Create {mode === "notes" ? "a note" : "a file"}
            </button>
          </div>
        )}
        {bottom && (
          <div className="document-bottom">
            <label>
              Font size{" "}
              <input
                type="range"
                min="10"
                max="24"
                value={fontSize}
                onChange={(e) => {
                  setFontSize(Number(e.target.value));
                  writeStorage("editor-font", Number(e.target.value));
                }}
              />
            </label>
            <label>
              <input
                type="checkbox"
                checked={wrap}
                onChange={(e) => {
                  setWrap(e.target.checked);
                  writeStorage("editor-wrap", e.target.checked);
                }}
              />
              Word wrap
            </label>
            {mode === "code" && (
              <>
                <strong>Problems ({problems.length})</strong>
                {problems.length ? (
                  problems.map((p, i) => <pre key={i}>{p}</pre>)
                ) : (
                  <p>No reported editor diagnostics.</p>
                )}
              </>
            )}
          </div>
        )}
        <footer className="document-status">
          <span>
            {current
              ? current.text !== current.saved
                ? "Unsaved changes"
                : "Saved to filesystem"
              : "Ready"}{" "}
            · {folder?.name ?? "Folder unavailable"}
          </span>
          <span>
            {current
              ? `${current.text.trim().split(/\s+/).filter(Boolean).length} words · ${current.text.length} characters`
              : ""}
            {mode === "code" && current
              ? ` · ${language(current.entry.name)} · Ln ${position.lineNumber}, Col ${position.column}`
              : ""}
          </span>
          {current && (
            <time>{new Date(current.entry.modified).toLocaleTimeString()}</time>
          )}
        </footer>
      </section>
      {dialog && (
        <OperationDialog
          key={dialog.title + dialog.initial}
          dialog={dialog}
          close={closeDialog}
        />
      )}
      {closing && (
        <FocusPanel close={() => setClosing(null)} className="file-dialog">
          <h2>Save your changes?</h2>
          <p>Your unsaved edits will be lost if discarded.</p>
          <div className="document-close-actions">
            <button onClick={() => setClosing(null)}>Cancel</button>
            <button onClick={() => void act(() => finishClose(false))}>
              Discard
            </button>
            <button
              className="primary"
              onClick={() => void act(() => finishClose(true))}
            >
              Save and close
            </button>
          </div>
          {d.error && <p role="alert">{d.error}</p>}
        </FocusPanel>
      )}
      {preview && (
        <FocusPanel close={closePreview} className="web-preview">
          <header>
            <strong>Isolated web preview</strong>
            <span>Saved local files · network blocked</span>
            <button
              onClick={() =>
                void act(async () =>
                  setPreview(await buildWebPreview(current!.id)),
                )
              }
            >
              Refresh
            </button>
            <button aria-label="Close web preview" onClick={closePreview}>
              <X size={18} />
            </button>
          </header>
          <iframe
            title="Project preview"
            sandbox="allow-scripts"
            srcDoc={preview}
          />
        </FocusPanel>
      )}
    </div>
  );
}

import { lazy, Suspense, useRef, useState } from "react";
import {
  Blocks,
  Play,
  Download,
  Save,
  Package,
  FolderOpen,
  RefreshCw,
} from "lucide-react";
import { starters } from "../../core/platform/catalog";
import { validatePackage, packageApp } from "../../core/platform/package";
import type { AppPackage } from "../../core/platform/types";
import { installPackage } from "../../core/platform/state";
import { SandboxRuntime } from "./Sandbox";
import { download } from "../../core/filesystem/transfers";
import { filesystem as fs } from "../../core/filesystem/service";
import { folderId } from "../../core/filesystem/types";
import { useDesk } from "../../core/store";
import { useDirtyGuard } from "../media/DirtyGuard";
import { OperationDialog } from "../files/OperationDialog";
import type { FileDialog } from "../files/OperationDialog";
import { safeJson } from "../../core/backup/validation";
import "./platform.css";
const Monaco = lazy(() => import("../editor/Monaco"));
const filenames = ["manifest.json", "index.html", "styles.css", "app.js"];
export default function AppBuilder() {
  const theme = useDesk((s) => s.prefs.theme);
  const [project, setProject] = useState<AppPackage>(() =>
      structuredClone(starters[0]),
    ),
    [active, setActive] = useState("app.js"),
    [preview, setPreview] = useState<AppPackage | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [dirty, setDirty] = useState(false),
    [name, setName] = useState("My app"),
    [id, setId] = useState("local.my-app"),
    [description, setDescription] = useState("A small app for my desktop."),
    [category, setCategory] = useState("Utilities"),
    [icon, setIcon] = useState("\u25c7"),
    [template, setTemplate] = useState(0),
    [dialog, setDialog] = useState<FileDialog | null>(null);
  const [hasFolder, setHasFolder] = useState(false);
  const projectFolder = useRef(""),
    savedRefs = useRef<Record<string, { id: string; revision: number }>>({});
  const parse = () =>
    validatePackage({
      manifest: safeJson(project.files["manifest.json"]),
      files: project.files,
    });
  const run = async (work: () => Promise<void>) => {
    setBusy(true);
    setError("");
    try {
      await work();
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  };
  const save = async () => {
    const p = parse();
    if (!projectFolder.current) {
      let n = 1,
        folder;
      while (!folder) {
        try {
          folder = await fs.createDirectory(
            folderId("Projects"),
            p.manifest.name.slice(0, 80) + (n === 1 ? "" : " " + n),
          );
        } catch (e) {
          if (n++ > 100) throw e;
        }
      }
      projectFolder.current = folder.id;
      setHasFolder(true);
    }
    for (const filename of filenames) {
      const ref = savedRefs.current[filename];
      if (ref) {
        const updated = await fs.saveDocument(
          ref.id,
          p.files[filename],
          ref.revision,
        );
        savedRefs.current[filename] = {
          id: ref.id,
          revision: updated.revision ?? 0,
        };
      } else {
        const e = await fs.createFile(
          projectFolder.current,
          filename,
          new Blob([p.files[filename]], {
            type: filename.endsWith("json")
              ? "application/json"
              : filename.endsWith("html")
                ? "text/html"
                : "text/plain",
          }),
        );
        savedRefs.current[filename] = { id: e.id, revision: e.revision ?? 0 };
      }
    }
    setDirty(false);
    useDesk.getState().notify("App project saved to Projects");
  };
  const guard = useDirtyGuard(dirty, save);
  return (
    <div className="builder-app">
      <header className="platform-toolbar">
        <Blocks size={20} />
        <strong>App Builder</strong>
        <button
          onClick={() =>
            guard.request(() =>
              setDialog({
                title: "Create a new app project?",
                confirm:
                  "Use the name, ID, icon, category and template currently selected in the setup panel.",
                run: async () => {
                  const starter = structuredClone(starters[template]);
                  starter.manifest = {
                    ...starter.manifest,
                    name,
                    id,
                    description,
                    category,
                    icon,
                    developer: "Local developer",
                  };
                  starter.files["manifest.json"] = JSON.stringify(
                    starter.manifest,
                    null,
                    2,
                  );
                  validatePackage(starter);
                  projectFolder.current = "";
                  setHasFolder(false);
                  savedRefs.current = {};
                  setProject(starter);
                  setPreview(null);
                  setDirty(true);
                },
              }),
            )
          }
        >
          New project
        </button>
        <button disabled={busy} onClick={() => void run(save)}>
          <Save size={15} />
          Save project
        </button>
        <button
          disabled={busy}
          onClick={() =>
            void run(async () => {
              await save();
              useDesk.getState().open("code", projectFolder.current);
            })
          }
        >
          <FolderOpen size={15} />
          Code Studio
        </button>
        <button
          disabled={!hasFolder || busy}
          onClick={() =>
            guard.request(() => {
              void run(async () => {
                const list = await fs.listDirectory(projectFolder.current);
                const next = structuredClone(project);
                for (const filename of filenames) {
                  const e = list.find((e) => e.name === filename);
                  if (!e) throw Error("Missing " + filename);
                  const doc = await fs.readDocument(e.id);
                  next.files[filename] = await doc.blob.text();
                  savedRefs.current[filename] = {
                    id: e.id,
                    revision: doc.entry.revision ?? 0,
                  };
                }
                next.manifest = safeJson(
                  next.files["manifest.json"],
                ) as AppPackage["manifest"];
                setProject(validatePackage(next));
                setDirty(false);
                setPreview(null);
              });
            })
          }
        >
          <RefreshCw size={15} />
          Reload saved project
        </button>
      </header>
      <div className="builder-layout">
        <aside className="builder-setup">
          <small>PROJECT SETUP</small>
          <label>
            Name
            <input value={name} onChange={(e) => setName(e.target.value)} />
          </label>
          <label>
            App ID
            <input value={id} onChange={(e) => setId(e.target.value)} />
          </label>
          <label>
            Description
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </label>
          <label>
            Category
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              {[
                "Utilities",
                "Productivity",
                "Development",
                "Creativity",
                "Entertainment",
                "Education",
              ].map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </label>
          <label>
            Icon
            <input
              aria-label="App icon"
              value={icon}
              maxLength={4}
              onChange={(e) => setIcon(e.target.value)}
            />
          </label>
          <label>
            Starter
            <select
              value={template}
              onChange={(e) => setTemplate(Number(e.target.value))}
            >
              {starters.map((p, i) => (
                <option key={p.manifest.id} value={i}>
                  {p.manifest.name}
                </option>
              ))}
            </select>
          </label>
          <p>
            Setup fields apply when you create a new project. Edit manifest.json
            to change the current project.
          </p>
          <h3>SDK 1</h3>
          <p>
            Use deskos.app, theme, storage, files, notifications and window.
            Declare capabilities in the manifest. Preview permissions never
            become installed-app grants.
          </p>
          <p>
            Classic JavaScript only. No npm, module imports, remote assets or
            backend. Preview is the same restricted execution model as installed
            apps.
          </p>
        </aside>
        <section className="builder-editor">
          <div className="builder-tabs">
            {filenames.map((file) => (
              <button
                key={file}
                className={active === file ? "selected" : ""}
                onClick={() => setActive(file)}
              >
                {file}
              </button>
            ))}
            <small>{dirty ? "Unsaved" : "Saved / template"}</small>
          </div>
          <div className="builder-code">
            <Suspense fallback={<div className="empty">Loading editor...</div>}>
              <Monaco
                path={"builder/" + active}
                language={
                  active === "manifest.json"
                    ? "json"
                    : active === "index.html"
                      ? "html"
                      : active === "styles.css"
                        ? "css"
                        : "javascript"
                }
                value={project.files[active]}
                onChange={(text) => {
                  setProject((p) => ({
                    ...p,
                    files: { ...p.files, [active]: text || "" },
                  }));
                  setDirty(true);
                }}
                theme={
                  theme === "light" ||
                  (theme === "system" &&
                    matchMedia("(prefers-color-scheme: dark)").matches ===
                      false)
                    ? "vs"
                    : "vs-dark"
                }
                options={{
                  automaticLayout: true,
                  minimap: { enabled: false },
                  fontSize: 13,
                  wordWrap: "on",
                  editContext: false,
                }}
              />
            </Suspense>
          </div>
          {error && (
            <p className="platform-alert" role="alert">
              {error}
            </p>
          )}
          <footer className="platform-toolbar">
            <button
              className="primary"
              disabled={busy}
              onClick={() =>
                void run(async () => {
                  setPreview(parse());
                })
              }
            >
              <Play size={15} />
              Run sandboxed preview
            </button>
            <button
              disabled={busy}
              onClick={() =>
                void run(async () => {
                  const p = parse();
                  download(await packageApp(p), p.manifest.id + ".deskapp");
                })
              }
            >
              <Download size={15} />
              Export .deskapp
            </button>
            <button
              disabled={busy}
              onClick={() => {
                try {
                  const p = parse();
                  setDialog({
                    title: "Install this app?",
                    confirm:
                      "Install " +
                      p.manifest.name +
                      " " +
                      p.manifest.version +
                      " with declared capabilities: " +
                      (p.manifest.capabilities.join(", ") || "none") +
                      ". Existing app windows close on update; data is preserved and grants reset.",
                    run: async () => {
                      installPackage(p);
                      useDesk.getState().notify("App installed from Builder");
                    },
                  });
                } catch (e) {
                  setError(String(e));
                }
              }}
            >
              <Package size={15} />
              Install app
            </button>
          </footer>
        </section>
        {preview && (
          <section className="builder-preview">
            <header>
              <strong>Restricted preview</strong>
              <button onClick={() => setPreview(null)}>Close preview</button>
            </header>
            <SandboxRuntime
              key={JSON.stringify(preview)}
              app={preview}
              preview
            />
          </section>
        )}
      </div>
      {dialog && (
        <OperationDialog dialog={dialog} close={() => setDialog(null)} />
      )}{" "}
      {guard.dialog}
    </div>
  );
}

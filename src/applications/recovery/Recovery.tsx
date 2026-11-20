import { useEffect, useRef, useState } from "react";
import {
  Archive,
  History,
  ShieldCheck,
  Download,
  Upload,
  Clock,
  FileText,
  CheckCircle2,
  ArrowRight,
  Trash2,
  Search,
  HardDrive,
} from "lucide-react";
import { liveQuery } from "dexie";
import { db } from "../../core/filesystem/database";
import { filesystem as fs } from "../../core/filesystem/service";
import { formatBytes } from "../../core/filesystem/types";
import { useFilesystem } from "../../core/filesystem/hooks";
import { useLaunchData } from "../../core/launch";
import {
  readStorage,
  writeStorage,
  persistencePaused,
} from "../../core/storage";
import { coverage } from "../../core/backup/coverage";
import { exportCapsule, inspectCapsule } from "../../core/backup/capsule";
import { planRestore, executeRestore } from "../../core/backup/restore";
import type { CapsuleData, RestorePlan } from "../../core/backup/types";
import {
  createPoint,
  restoreVersion,
  historyUsage,
} from "../../core/history/service";
import type {
  FileVersion,
  RestorePoint,
  RecoveryJournal,
} from "../../core/history/types";
import { download } from "../../core/filesystem/transfers";
import { OperationDialog } from "../files/OperationDialog";
import type { FileDialog } from "../files/OperationDialog";
import "./recovery.css";
export function CapsuleApp() {
  return <Recovery initial="export" />;
}
export function TimeMachineApp() {
  return <Recovery initial="versions" />;
}
export function RecoveryApp() {
  return <Recovery initial="status" />;
}
function Recovery({ initial }: { initial: string }) {
  const { entries } = useFilesystem(),
    launch = useLaunchData();
  const [tab, setTab] = useState(initial),
    [selected, setSelected] = useState<string[]>(coverage.map((c) => c.id)),
    [step, setStep] = useState(1),
    [busy, setBusy] = useState(false),
    [stage, setStage] = useState(""),
    [error, setError] = useState(""),
    [result, setResult] = useState(""),
    [data, setData] = useState<CapsuleData | null>(null),
    [plan, setPlan] = useState<RestorePlan | null>(null),
    [mode, setMode] = useState<"merge" | "replace">("merge"),
    [conflict, setConflict] = useState<"copy" | "skip">("copy"),
    [fileIds, setFileIds] = useState<string[] | null>(null),
    [versions, setVersions] = useState<FileVersion[]>([]),
    [points, setPoints] = useState<RestorePoint[]>([]),
    [journals, setJournals] = useState<RecoveryJournal[]>([]),
    [activeVersion, setActiveVersion] = useState(""),
    [currentText, setCurrentText] = useState(""),
    [pastText, setPastText] = useState(""),
    [revision, setRevision] = useState<number | undefined>(),
    [query, setQuery] = useState(""),
    [dialog, setDialog] = useState<FileDialog | null>(null),
    [pointName, setPointName] = useState("Restore point"),
    [description, setDescription] = useState(""),
    [retention, setRetention] = useState(
      Number(readStorage("history-count")) || 10,
    ),
    [quota, setQuota] = useState<{ usage?: number; quota?: number }>({}),
    [reload, setReload] = useState(persistencePaused),
    [pointPreview, setPointPreview] = useState<RestorePoint | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const last = readStorage("recovery-status") as {
    time?: number;
    message?: string;
  } | null;
  useEffect(() => {
    const sub = liveQuery(async () => ({
      ...(await historyUsage()),
      journals: await db.journals
        .orderBy("created")
        .reverse()
        .limit(20)
        .toArray(),
    })).subscribe((value) => {
      setVersions(value.versions);
      setPoints(value.points);
      setJournals(value.journals);
    });
    void navigator.storage?.estimate?.().then(setQuota);
    return () => sub.unsubscribe();
  }, []);
  const pastLines = pastText.split("\n"),
    currentLines = currentText.split("\n");
  const chosen = versions.find((v) => v.id === activeVersion);
  useEffect(() => {
    let alive = true;
    if (!chosen) return;
    void chosen.blob.text().then((text) => {
      if (alive) setPastText(text);
    });
    void fs
      .readDocument(chosen.fileId)
      .then(async (doc) => {
        const text = await doc.blob.text();
        if (alive) {
          setCurrentText(text);
          setRevision(doc.entry.revision ?? 0);
        }
      })
      .catch(() => {
        if (alive) {
          setCurrentText(
            "Current file is missing or in Trash. Restore as Copy is available.",
          );
          setRevision(undefined);
        }
      });
    return () => {
      alive = false;
    };
  }, [chosen]);
  const run = async (work: () => Promise<void>) => {
    setBusy(true);
    setError("");
    setResult("");
    try {
      await work();
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  };
  const inspect = (file: Blob) =>
    void run(async () => {
      setPlan(null);
      const d = await inspectCapsule(file, setStage);
      setData(d);
      setSelected(
        d.manifest.categories.includes("files")
          ? ["files"]
          : d.manifest.categories,
      );
      setFileIds(d.entries.filter((e) => e.kind === "file").map((e) => e.id));
      setMode(d.manifest.categories.includes("files") ? "merge" : "replace");
      setTab("import");
      setPointPreview(null);
    });
  const categoryChoices = (importing = false) => (
    <div className="coverage-grid">
      {coverage
        .filter((c) => !importing || data?.manifest.categories.includes(c.id))
        .map((c) => (
          <label key={c.id} className={selected.includes(c.id) ? "chosen" : ""}>
            <input
              type="checkbox"
              checked={selected.includes(c.id)}
              disabled={busy || (importing && mode === "merge" && !c.merge)}
              onChange={(e) => {
                setSelected(
                  e.target.checked
                    ? [...selected, c.id]
                    : selected.filter((id) => id !== c.id),
                );
                setPlan(null);
              }}
            />
            <span>
              <strong>{c.name}</strong>
              <small>{c.description}</small>
              <em>
                {c.merge
                  ? "Safe file merge supported"
                  : "Explicit replacement only"}
              </em>
            </span>
          </label>
        ))}
    </div>
  );
  const execute = () =>
    setDialog({
      title:
        mode === "replace"
          ? "Replace selected data?"
          : "Import selected files?",
      confirm:
        plan!.summary.join(" ") +
        " Save and close unsaved editors first. History and restore points remain local.",
      run: async () => {
        await run(async () => {
          const status = await executeRestore(data!, plan!, setStage);
          setReload(status.reload);
          setResult(
            status.reload
              ? "Restoration applied. Reload DeskOS to load the restored settings."
              : "File import completed. Existing files preserved.",
          );
          setPlan(null);
        });
      },
    });
  const backup = () =>
    void run(async () => {
      writeStorage("recovery-status", {
        time: Date.now(),
        message: "Export started; no download generated yet.",
      });
      const archive = await exportCapsule(
        selected,
        launch.entryId ? [launch.entryId] : undefined,
        setStage,
      );
      download(
        archive,
        "DeskOS-" + new Date().toISOString().slice(0, 10) + ".deskpack",
      );
      writeStorage("recovery-status", {
        time: Date.now(),
        message:
          "Package generated; download initiated. Saving to disk is unverified.",
      });
      setResult(
        "Package generated and download initiated. Your browser controls saving to disk.",
      );
      setStep(3);
    });
  const filesForPreview = data?.entries.filter((e) => e.kind === "file") || [];
  const filteredVersions = versions
    .filter(
      (v) =>
        (!launch.entryId || v.fileId === launch.entryId) &&
        v.name.toLowerCase().includes(query.toLowerCase()),
    )
    .sort((a, b) => b.created - a.created);
  return (
    <div className="recovery-app">
      <aside className="recovery-sidebar">
        <div className="recovery-mark">
          <ShieldCheck size={28} />
          <strong>Recovery</strong>
          <small>YOUR WORK, WITH A WAY BACK.</small>
        </div>
        {[
          ["status", "Recovery status", ShieldCheck],
          ["export", "Backup & export", Archive],
          ["import", "Import & restore", Upload],
          ["points", "Restore points", Clock],
          ["versions", "File versions", History],
          ["storage", "Storage & retention", HardDrive],
        ].map(([id, label, Icon]) => {
          const I = Icon as typeof Archive;
          return (
            <button
              key={String(id)}
              className={tab === id ? "selected" : ""}
              onClick={() => {
                setTab(String(id));
                setError("");
              }}
            >
              <I size={17} />
              {String(label)}
            </button>
          );
        })}
        <p>
          Local to this browser.
          <br />
          Export a Capsule to protect against browser data loss.
        </p>
      </aside>
      <main className="recovery-main">
        <header>
          <small>DESKOS / RECOVERY & CONTINUITY</small>
          <h2>
            {
              {
                status: "A way back to your work.",
                export: "Take your world with you.",
                import: "Restore with confidence.",
                points: "Moments worth keeping.",
                versions: "Every saved chapter.",
                storage: "Make room for what matters.",
              }[tab]
            }
          </h2>
          <p>
            {
              {
                status: "Real recovery information. No assumed backups.",
                export:
                  "A portable, verified package of selected persisted data.",
                import: "Inspect and validate before changing your desktop.",
                points: "Immutable copies with an explicit recoverable scope.",
                versions: "Previous content captured at committed text saves.",
                storage: "Local history has limits. Keep independent exports.",
              }[tab]
            }
          </p>
        </header>
        {(busy || stage) && (
          <div className="recovery-stage" role="status">
            {busy ? (
              <span className="recovery-pulse" />
            ) : (
              <CheckCircle2 size={16} />
            )}
            <span>{stage}</span>
            {busy && <span>Keep this window open</span>}
          </div>
        )}
        {error && (
          <div role="alert" className="recovery-error">
            {error}
          </div>
        )}
        {result && <div className="recovery-result">{result}</div>}
        {reload && (
          <div className="recovery-result">
            Restored preferences are staged. Current services retain their old
            in-memory state.{" "}
            <button className="primary" onClick={() => location.reload()}>
              Reload DeskOS
            </button>
          </div>
        )}
        {tab === "status" && (
          <>
            <div className="recovery-hero">
              <Archive size={64} strokeWidth={1} />
              <div>
                <h3>Your desktop is local.</h3>
                <p>
                  {last?.message ||
                    "No export attempt recorded on this browser."}
                </p>
                {last?.time && (
                  <small>{new Date(last.time).toLocaleString()}</small>
                )}
                <button className="primary" onClick={() => setTab("export")}>
                  Create a Capsule <ArrowRight size={15} />
                </button>
              </div>
            </div>
            <div className="recovery-stats">
              <button onClick={() => setTab("versions")}>
                <strong>{versions.length}</strong>Retained file versions
              </button>
              <button onClick={() => setTab("points")}>
                <strong>{points.length}</strong>Verified restore points
              </button>
              <button onClick={() => setTab("storage")}>
                <strong>
                  {formatBytes(
                    versions.reduce((n, v) => n + v.size, 0) +
                      points.reduce((n, p) => n + p.size, 0),
                  )}
                </strong>
                History storage
              </button>
            </div>
            <h3>Restore journal</h3>
            {journals.length ? (
              journals.map((j) => (
                <div className="journal-row" key={j.id}>
                  <span>{j.state}</span>
                  <p>{j.message}</p>
                  <small>{new Date(j.created).toLocaleString()}</small>
                  {j.state !== "complete" && (
                    <button
                      onClick={() =>
                        setDialog({
                          title: "Acknowledge recovery journal?",
                          confirm:
                            "Mark this journal reviewed only after inspecting or restoring its checkpoint. This does not restore data. The checkpoint stays available.",
                          run: async () => {
                            await db.journals.update(j.id, {
                              state: "complete",
                              message: "Reviewed by user. " + j.message,
                            });
                          },
                        })
                      }
                    >
                      Mark reviewed
                    </button>
                  )}
                </div>
              ))
            ) : (
              <p>No restorations recorded.</p>
            )}
            <h3>Backup coverage</h3>
            {coverage.map((c) => (
              <p key={c.id}>
                <strong>{c.name}</strong> / {c.description}
              </p>
            ))}
            <p className="recovery-note">
              Excluded: runtime state, unsaved buffers, current playback,
              temporary Blob URLs, browser/host files not imported, caches,
              credentials, and historical version/restore-point blobs. Checksums
              detect corruption, not sender authenticity. Capsules are
              unencrypted.
            </p>
          </>
        )}
        {tab === "export" && (
          <>
            <div className="recovery-steps">
              <span className={step === 1 ? "selected" : ""}>
                01 / Choose scope
              </span>
              <span className={step === 2 ? "selected" : ""}>02 / Review</span>
              <span className={step === 3 ? "selected" : ""}>
                03 / Download initiated
              </span>
            </div>
            {step === 1 && (
              <>
                <div className="recovery-toolbar">
                  <button
                    onClick={() => setSelected(coverage.map((c) => c.id))}
                  >
                    Full supported backup
                  </button>
                  <button onClick={() => setSelected(["files"])}>
                    Files only
                  </button>
                  <button
                    onClick={() => setSelected(["preferences", "editor"])}
                  >
                    Settings
                  </button>
                  <button onClick={() => setSelected(["spaces"])}>
                    Spaces
                  </button>
                </div>
                {categoryChoices()}
                <button
                  className="primary"
                  disabled={!selected.length || busy}
                  onClick={() => setStep(2)}
                >
                  Review selection <ArrowRight size={16} />
                </button>
              </>
            )}
            {step >= 2 && (
              <div className="recovery-review">
                <h3>Ready to package</h3>
                <p>
                  {coverage
                    .filter((c) => selected.includes(c.id))
                    .map((c) => c.name)
                    .join(" / ")}
                </p>
                <p>
                  {selected.includes("files")
                    ? entries.filter((e) => e.kind === "file").length +
                      " stored files / " +
                      formatBytes(entries.reduce((n, e) => n + e.size, 0))
                    : "No virtual file bytes selected."}
                  {launch.entryId
                    ? " / File scope restricted to the launched entry and its hierarchy."
                    : ""}
                </p>
                <p>
                  Maximum package: 100 MB compressed and expanded. Historical
                  version/restore-point blobs remain local.
                </p>
                <button disabled={busy} onClick={() => setStep(1)}>
                  Change scope
                </button>
                <button className="primary" disabled={busy} onClick={backup}>
                  <Download size={16} />
                  Generate .deskpack
                </button>
              </div>
            )}
          </>
        )}
        {tab === "import" && (
          <>
            <div
              className="capsule-drop"
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                if (!busy && e.dataTransfer.files[0])
                  inspect(e.dataTransfer.files[0]);
              }}
            >
              <Upload size={32} />
              <strong>Drop a .deskpack here</strong>
              <p>
                ZIP structure, inventory, sizes and every content checksum are
                verified locally.
              </p>
              <button disabled={busy} onClick={() => input.current?.click()}>
                Choose Capsule
              </button>
              <input
                hidden
                type="file"
                ref={input}
                accept=".deskpack"
                aria-label="Import Capsule"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) inspect(f);
                  e.target.value = "";
                }}
              />
            </div>
            {data && (
              <>
                <div className="recovery-review">
                  <h3>
                    {pointPreview
                      ? "Restore point: " + pointPreview.name
                      : "Validated Capsule"}
                  </h3>
                  <p>
                    {data.manifest.fileCount} files /{" "}
                    {formatBytes(data.manifest.logicalBytes)} /{" "}
                    {new Date(data.manifest.created).toLocaleString()}
                  </p>
                  <small>
                    SCHEMA {data.manifest.version} / SHA-256 CONTENT VERIFIED /
                    UNENCRYPTED
                  </small>
                </div>
                <div className="recovery-toolbar">
                  <label>
                    Restore mode
                    <select
                      aria-label="Restore mode"
                      value={mode}
                      onChange={(e) => {
                        const m = e.target.value as typeof mode;
                        setMode(m);
                        if (m === "merge") setSelected(["files"]);
                        setPlan(null);
                      }}
                    >
                      <option
                        value="merge"
                        disabled={!data.manifest.categories.includes("files")}
                      >
                        Merge / selective files
                      </option>
                      <option value="replace">
                        Replace selected categories
                      </option>
                    </select>
                  </label>
                  {mode === "merge" && (
                    <label>
                      Name conflicts
                      <select
                        aria-label="Conflict policy"
                        value={conflict}
                        onChange={(e) => {
                          setConflict(e.target.value as typeof conflict);
                          setPlan(null);
                        }}
                      >
                        <option value="copy">
                          Keep both / rename imported copy
                        </option>
                        <option value="skip">
                          Keep existing / skip colliding file
                        </option>
                      </select>
                    </label>
                  )}
                </div>
                {categoryChoices(true)}
                {selected.includes("files") && (
                  <div className="backup-tree">
                    <header>
                      <strong>Archived filesystem</strong>
                      <button
                        onClick={() => {
                          setFileIds(filesForPreview.map((e) => e.id));
                          setPlan(null);
                        }}
                      >
                        Select all
                      </button>
                      <button
                        disabled={mode === "replace"}
                        onClick={() => {
                          setFileIds([]);
                          setPlan(null);
                        }}
                      >
                        Clear
                      </button>
                    </header>
                    {data.entries.map((e) => (
                      <label
                        key={e.id}
                        style={{
                          paddingLeft: 12 + depth(e.id, data.entries) * 12,
                        }}
                      >
                        {e.kind === "file" ? (
                          <input
                            type="checkbox"
                            disabled={mode === "replace"}
                            checked={fileIds?.includes(e.id) ?? true}
                            onChange={(event) => {
                              setFileIds(
                                event.target.checked
                                  ? [...(fileIds || []), e.id]
                                  : (fileIds || []).filter((id) => id !== e.id),
                              );
                              setPlan(null);
                            }}
                          />
                        ) : (
                          <span>?</span>
                        )}
                        <span>
                          {e.name}
                          {e.trashed ? " / Trash" : ""}
                        </span>
                        <small>
                          {e.kind === "file" ? formatBytes(e.size) : "folder"}
                        </small>
                      </label>
                    ))}
                  </div>
                )}
                <p className="recovery-note">
                  Metadata is replace-only. Cross-references to missing files
                  will be removed with a warning. File merge creates new IDs, so
                  restore metadata with a full replacement when retaining
                  original references is required.
                </p>
                <button
                  className="primary"
                  disabled={busy || !selected.length}
                  onClick={() =>
                    void run(async () => {
                      const p = await planRestore(
                        data,
                        mode,
                        selected,
                        mode === "replace" ? undefined : fileIds || undefined,
                        conflict,
                      );
                      setPlan(p);
                    })
                  }
                >
                  Preview changes
                </button>
                {plan && (
                  <div className="recovery-review">
                    <h3>Restore plan</h3>
                    {plan.summary.map((line, i) => (
                      <p key={i}>{line}</p>
                    ))}
                    <button
                      className="primary"
                      disabled={busy}
                      onClick={execute}
                    >
                      Confirm restore...
                    </button>
                  </div>
                )}
              </>
            )}
          </>
        )}
        {tab === "points" && (
          <>
            <div className="point-create">
              <h3>Create a recovery point</h3>
              <label>
                Name
                <input
                  aria-label="Restore point name"
                  value={pointName}
                  onChange={(e) => setPointName(e.target.value)}
                />
              </label>
              <label>
                Description
                <input
                  aria-label="Restore point description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </label>
              <div className="recovery-toolbar">
                <button onClick={() => setSelected(coverage.map((c) => c.id))}>
                  Full supported environment
                </button>
                <button onClick={() => setSelected(["spaces"])}>
                  Workspace only
                </button>
                <button onClick={() => setSelected(["preferences", "spaces"])}>
                  Settings & Spaces
                </button>
                <button onClick={() => setSelected(["files"])}>
                  Files{launch.entryId ? " / selected file" : ""}
                </button>
              </div>
              {categoryChoices()}
              <button
                className="primary"
                disabled={busy}
                onClick={() =>
                  void run(async () => {
                    const p = await createPoint(
                      pointName,
                      description,
                      selected,
                      launch.entryId ? [launch.entryId] : undefined,
                      false,
                      setStage,
                    );
                    setResult("Verified restore point created: " + p.name);
                  })
                }
              >
                Create verified point
              </button>
            </div>
            <div className="recovery-timeline">
              {[...points]
                .sort((a, b) => b.created - a.created)
                .map((p) => (
                  <article key={p.id}>
                    <div className="timeline-date">
                      <Clock size={16} />
                      <span>
                        {new Date(p.created).toLocaleDateString()}
                        <small>
                          {new Date(p.created).toLocaleTimeString()}
                        </small>
                      </span>
                    </div>
                    <div className="point-card">
                      <small>
                        {p.automatic
                          ? "AUTOMATIC SAFETY CHECKPOINT"
                          : "MANUAL RESTORE POINT"}
                      </small>
                      <h3>{p.name}</h3>
                      <p>{p.description}</p>
                      <p>
                        {p.categories.join(" / ")} / {formatBytes(p.size)}
                      </p>
                      <button
                        disabled={busy}
                        onClick={() =>
                          void run(async () => {
                            const d = await inspectCapsule(p.archive, setStage);
                            setData(d);
                            setPointPreview(p);
                            setSelected(p.categories);
                            setMode("replace");
                            setFileIds(
                              d.entries
                                .filter((e) => e.kind === "file")
                                .map((e) => e.id),
                            );
                            setPlan(null);
                            setTab("import");
                          })
                        }
                      >
                        Inspect & restore
                      </button>
                      <button
                        onClick={() =>
                          download(p.archive, p.name + ".deskpack")
                        }
                      >
                        Export point
                      </button>
                      <button
                        onClick={() =>
                          setDialog({
                            title: "Rename restore point",
                            label: "Name",
                            initial: p.name,
                            run: async (name) => {
                              if (!name.trim()) throw Error("Enter a name");
                              await db.points.update(p.id, {
                                name: name.trim(),
                              });
                            },
                          })
                        }
                      >
                        Rename
                      </button>
                      <button
                        aria-label={"Delete point " + p.name}
                        onClick={() =>
                          setDialog({
                            title: "Permanently delete restore point?",
                            confirm:
                              "This immutable archive will be removed. Active files and other points remain intact.",
                            run: async () => {
                              if (
                                journals.some(
                                  (j) =>
                                    j.checkpoint === p.id &&
                                    j.state !== "complete",
                                )
                              )
                                throw Error(
                                  "This point is needed by an incomplete restore journal. Recover it first.",
                                );
                              await db.points.delete(p.id);
                            },
                          })
                        }
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </article>
                ))}
            </div>
            {!points.length && (
              <div className="recovery-empty">
                <Clock size={48} />
                <h3>Your timeline starts here.</h3>
                <p>Create a point to retain actual recoverable data.</p>
              </div>
            )}
          </>
        )}
        {tab === "versions" && (
          <>
            <div className="recovery-toolbar">
              <Search size={17} />
              <input
                aria-label="Search file history"
                placeholder="Find saved history..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
              <span>{filteredVersions.length} retained versions</span>
            </div>
            <div className="history-layout">
              <div className="version-list">
                {filteredVersions.map((v) => (
                  <button
                    key={v.id}
                    className={v.id === activeVersion ? "selected" : ""}
                    onClick={() => setActiveVersion(v.id)}
                  >
                    <FileText size={17} />
                    <span>
                      <strong>{v.name}</strong>
                      <small>
                        {new Date(v.created).toLocaleString()} / revision{" "}
                        {v.revision} / {formatBytes(v.size)}
                      </small>
                    </span>
                  </button>
                ))}
                {!filteredVersions.length && (
                  <p>
                    No saved history yet. Eligible text saves retain their
                    previous committed content.
                  </p>
                )}
              </div>
              <section className="version-preview">
                {chosen ? (
                  <>
                    <h3>{chosen.name}</h3>
                    <p>
                      Historical revision {chosen.revision} compared with
                      current saved content. Unsaved buffers are not shown.
                      Preview is limited to 2,000 lines and 2,000 characters per
                      line.
                    </p>
                    <div className="text-diff">
                      <div>
                        <strong>? Historical saved content</strong>
                        {pastLines.slice(0, 2000).map((line, i) => (
                          <pre key={i}>
                            <span>{i + 1}</span>
                            {line.slice(0, 2000) || " "}
                          </pre>
                        ))}
                      </div>
                      <div>
                        <strong>+ Current saved content</strong>
                        {currentLines.slice(0, 2000).map((line, i) => (
                          <pre
                            key={i}
                            className={
                              line !== pastLines[i] ? "diff-changed" : ""
                            }
                          >
                            <span>{i + 1}</span>
                            {line.slice(0, 2000) || " "}
                          </pre>
                        ))}
                      </div>
                    </div>
                    <div className="recovery-toolbar">
                      <button
                        className="primary"
                        disabled={busy || revision === undefined}
                        onClick={() =>
                          setDialog({
                            title: "Restore historical file content?",
                            confirm:
                              "The current saved content is retained as another version when eligible. Unsaved editor buffers stay open and receive a conflict notice.",
                            run: async () => {
                              await restoreVersion(chosen.id, false, revision);
                              setResult(
                                "Historical content restored through the filesystem service.",
                              );
                            },
                          })
                        }
                      >
                        Restore previous version
                      </button>
                      <button
                        disabled={busy}
                        onClick={() =>
                          void run(async () => {
                            await restoreVersion(chosen.id, true);
                            setResult(
                              "Recovered copy saved without changing the original file.",
                            );
                          })
                        }
                      >
                        Restore as Copy
                      </button>
                      <button
                        onClick={() =>
                          setDialog({
                            title: "Permanently delete version?",
                            confirm:
                              "Only this historical content is deleted. Active files and immutable restore points remain intact.",
                            run: async () => {
                              await db.versions.delete(chosen.id);
                              setActiveVersion("");
                            },
                          })
                        }
                      >
                        Delete version
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="recovery-empty">
                    <History size={48} />
                    <h3>Select a saved chapter.</h3>
                    <p>Compare historical text and recover it as a new copy.</p>
                  </div>
                )}
              </section>
            </div>
          </>
        )}
        {tab === "storage" && (
          <>
            <div className="recovery-stats">
              <div>
                <strong>
                  {formatBytes(entries.reduce((n, e) => n + e.size, 0))}
                </strong>
                Virtual files
              </div>
              <div>
                <strong>
                  {formatBytes(versions.reduce((n, e) => n + e.size, 0))}
                </strong>
                Version history
              </div>
              <div>
                <strong>
                  {formatBytes(points.reduce((n, e) => n + e.size, 0))}
                </strong>
                Restore points
              </div>
            </div>
            <p>
              Browser estimate: {formatBytes(quota.usage || 0)} used /{" "}
              {quota.quota ? formatBytes(quota.quota) : "quota unavailable"}.
              Estimates are not physical disk capacity.
            </p>
            <label>
              Versions retained per eligible file
              <select
                value={retention}
                onChange={(e) => {
                  setRetention(Number(e.target.value));
                  writeStorage("history-count", Number(e.target.value));
                }}
              >
                {[1, 5, 10, 20, 30].map((n) => (
                  <option key={n}>{n}</option>
                ))}
              </select>
            </label>
            <p>
              Text versions up to 2 MB. Global history cap: 50 MB, oldest first.
              Point cap: 250 MB. Per-file retention applies on next save.
              Restore points contain independent file bytes.
            </p>
            <button
              onClick={() =>
                setDialog({
                  title: "Permanently clear file version history?",
                  confirm:
                    versions.length +
                    " versions / " +
                    formatBytes(versions.reduce((n, v) => n + v.size, 0)) +
                    " will be removed. Active files and restore points remain.",
                  run: async () => db.versions.clear(),
                })
              }
            >
              Clear file history...
            </button>
            <button onClick={() => setTab("points")}>
              Manage restore points
            </button>
            <h3>Largest restore points</h3>
            {[...points]
              .sort((a, b) => b.size - a.size)
              .slice(0, 10)
              .map((p) => (
                <p key={p.id}>
                  {p.name} / {formatBytes(p.size)}
                </p>
              ))}
          </>
        )}
      </main>
      {dialog && (
        <OperationDialog dialog={dialog} close={() => setDialog(null)} />
      )}
    </div>
  );
}
function depth(id: string, entries: { id: string; parentId: string | null }[]) {
  let n = 0,
    e = entries.find((e) => e.id === id);
  while (e?.parentId && n < 20) {
    n++;
    e = entries.find((p) => p.id === e!.parentId);
  }
  return n;
}

import { useState } from "react";
import {
  Layers,
  Plus,
  ArrowLeft,
  ArrowRight,
  X,
  Copy,
  Trash2,
  Pencil,
  LayoutGrid,
  Save,
} from "lucide-react";
import { useDesk, viewport } from "../../core/store";
import { appById } from "../../core/registry";
import { wallpapers } from "../../core/wallpapers";
import { builtinTemplates } from "../../core/spaces/model";
import { FocusPanel } from "../Overlays";
import { OperationDialog } from "../../applications/files/OperationDialog";
import type { FileDialog } from "../../applications/files/OperationDialog";
import "./spaces.css";
export function SpaceSwitcher() {
  const spaces = useDesk((s) => s.spaces),
    active = useDesk((s) => s.activeSpace);
  const state = useDesk.getState;
  const i = spaces.findIndex((s) => s.id === active);
  return (
    <div className="space-switcher">
      <button
        aria-label="Previous Space"
        disabled={!i}
        onClick={() => state().switchSpace(spaces[i - 1].id)}
      >
        <ArrowLeft size={12} />
      </button>
      <button
        aria-label="Open Spaces overview"
        onClick={() => useDesk.setState({ overview: true })}
      >
        <Layers size={15} />
        <span>{spaces[i]?.name}</span>
      </button>
      <button
        aria-label="Next Space"
        disabled={i === spaces.length - 1}
        onClick={() => state().switchSpace(spaces[i + 1].id)}
      >
        <ArrowRight size={12} />
      </button>
    </div>
  );
}
export function SpacesOverview() {
  const s = useDesk(),
    [dialog, setDialog] = useState<FileDialog | null>(null),
    [tab, setTab] = useState("spaces"),
    [deleteId, setDeleteId] = useState(""),
    [target, setTarget] = useState(""),
    [closeWindows, setCloseWindows] = useState(false);
  const close = () => useDesk.setState({ overview: false });
  const v = viewport();
  const active = s.spaces.find((x) => x.id === s.activeSpace)!;
  const nameDialog = (
    title: string,
    initial: string,
    run: (name: string) => void,
  ) =>
    setDialog({
      title,
      label: "Name",
      initial,
      run: async (name) => run(name),
    });
  const create = () =>
    nameDialog("Create Space", "Desktop " + (s.spaces.length + 1), (name) => {
      s.createSpace(name);
    });
  const template = (name: string) => {
    const t = builtinTemplates.find((t) => t.name === name)!;
    s.createSpace(t.name, t.wallpaper);
    for (const app of t.apps) {
      const running = useDesk
        .getState()
        .windows.find((w) => w.appId === app && appById(app).single);
      if (!running) useDesk.getState().open(app);
    }
    useDesk.getState().arrange("grid");
    useDesk
      .getState()
      .notify(
        "Template applied; existing global single-instance apps remain in their Spaces",
      );
  };
  const reorder = (id: string, delta: number) => {
    const ids = s.spaces.map((s) => s.id),
      i = ids.indexOf(id),
      j = i + delta;
    if (j < 0 || j >= ids.length) return;
    [ids[i], ids[j]] = [ids[j], ids[i]];
    s.reorderSpaces(ids);
  };
  return (
    <FocusPanel close={close} className="spaces-overview">
      <header className="spaces-header">
        <div>
          <small>DESKOS / YOUR WORKING ENVIRONMENT</small>
          <h2>A little space for everything.</h2>
          <p>Switch contexts. Keep your train of thought.</p>
        </div>
        <button aria-label="Close Spaces overview" onClick={close}>
          <X size={20} />
        </button>
      </header>
      <nav className="spaces-tabs">
        {["spaces", "snapshots", "templates"].map((t) => (
          <button
            key={t}
            className={tab === t ? "selected" : ""}
            onClick={() => setTab(t)}
          >
            {t}
          </button>
        ))}
        <button onClick={create}>
          <Plus size={15} />
          New Space
        </button>
        <button
          onClick={() =>
            nameDialog("Save workspace snapshot", active.name, (name) =>
              s.saveLayout(name, "snapshot"),
            )
          }
        >
          <Save size={15} />
          Save snapshot
        </button>
        <button
          onClick={() =>
            nameDialog("Save custom template", active.name, (name) =>
              s.saveLayout(name, "template"),
            )
          }
        >
          Save template
        </button>
      </nav>
      {tab === "spaces" && (
        <>
          <div
            className="spaces-grid"
            onKeyDown={(e) => {
              if (
                e.target instanceof HTMLElement &&
                e.target.matches(".space-preview")
              ) {
                const i = s.spaces.findIndex(
                  (x) =>
                    x.id ===
                    (e.target as HTMLElement).getAttribute("data-space"),
                );
                if (["ArrowLeft", "ArrowRight"].includes(e.key)) {
                  e.preventDefault();
                  const next =
                    s.spaces[
                      (i + (e.key === "ArrowRight" ? 1 : s.spaces.length - 1)) %
                        s.spaces.length
                    ];
                  document
                    .querySelector<HTMLButtonElement>(
                      '[data-space="' + next.id + '"]',
                    )
                    ?.focus();
                }
              }
            }}
          >
            {s.spaces.map((space, i) => {
              const windows = s.windows.filter((w) => w.spaceId === space.id);
              return (
                <article
                  key={space.id}
                  className={
                    "space-card " +
                    (space.id === s.activeSpace ? "current" : "")
                  }
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    const win = e.dataTransfer.getData("text/deskos-window");
                    if (win) s.moveWindowToSpace(win, space.id);
                    else {
                      const id = e.dataTransfer.getData("text/deskos-space");
                      const ids = s.spaces
                        .map((x) => x.id)
                        .filter((x) => x !== id);
                      if (s.spaces.some((x) => x.id === id)) {
                        ids.splice(i, 0, id);
                        s.reorderSpaces(ids);
                      }
                    }
                  }}
                >
                  <button
                    className="space-preview"
                    data-space={space.id}
                    aria-label={"Switch to " + space.name}
                    onClick={() => {
                      s.switchSpace(space.id);
                      close();
                    }}
                    style={{
                      background: wallpapers[space.wallpaper].background,
                    }}
                    draggable
                    onDragStart={(e) =>
                      e.dataTransfer.setData("text/deskos-space", space.id)
                    }
                  >
                    <span className="space-number">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    {windows.map((w) => (
                      <span
                        key={w.id}
                        className={
                          "space-mini-window " +
                          (w.minimized ? "is-minimized" : "")
                        }
                        style={{
                          left: ((w.maximized ? 0 : w.x) / v.width) * 100 + "%",
                          top: ((w.maximized ? 0 : w.y) / v.height) * 100 + "%",
                          width:
                            ((w.maximized ? v.width : w.width) / v.width) *
                              100 +
                            "%",
                          height:
                            ((w.maximized ? v.height : w.height) / v.height) *
                              100 +
                            "%",
                        }}
                      >
                        <span>{appById(w.appId).name}</span>
                      </span>
                    ))}
                  </button>
                  <div className="space-card-title">
                    <strong>{space.name}</strong>
                    <small>{windows.length} windows</small>
                  </div>
                  <div className="space-card-actions">
                    <button
                      aria-label={"Rename " + space.name}
                      onClick={() =>
                        nameDialog("Rename Space", space.name, (name) =>
                          s.renameSpace(space.id, name),
                        )
                      }
                    >
                      <Pencil size={13} />
                    </button>
                    <button
                      aria-label={"Move " + space.name + " left"}
                      disabled={!i}
                      onClick={() => reorder(space.id, -1)}
                    >
                      <ArrowLeft size={13} />
                    </button>
                    <button
                      aria-label={"Move " + space.name + " right"}
                      disabled={i === s.spaces.length - 1}
                      onClick={() => reorder(space.id, 1)}
                    >
                      <ArrowRight size={13} />
                    </button>
                    <button
                      aria-label={"Duplicate " + space.name}
                      onClick={() => {
                        s.switchSpace(space.id);
                        s.saveLayout(space.name + " copy", "template");
                        const l = useDesk.getState().layouts.at(-1)!;
                        void s.restoreLayout(l.id, "windows", true);
                      }}
                    >
                      <Copy size={13} />
                    </button>
                    <button
                      aria-label={"Delete " + space.name}
                      disabled={s.spaces.length === 1}
                      onClick={() => {
                        setDeleteId(space.id);
                        setTarget(s.spaces.find((x) => x.id !== space.id)!.id);
                      }}
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                  <div className="space-window-list">
                    {windows.map((w) => (
                      <div
                        key={w.id}
                        draggable
                        onDragStart={(e) =>
                          e.dataTransfer.setData("text/deskos-window", w.id)
                        }
                      >
                        <button
                          onClick={() => {
                            s.focus(w.id);
                            close();
                          }}
                        >
                          <span style={{ color: appById(w.appId).color }}>
                            {appById(w.appId).name}
                          </span>
                          {w.minimized
                            ? " / minimized"
                            : w.id === s.active
                              ? " / active"
                              : ""}
                        </button>
                        <select
                          aria-label={
                            "Move " + appById(w.appId).name + " to Space"
                          }
                          value={space.id}
                          onChange={(e) =>
                            s.moveWindowToSpace(w.id, e.target.value)
                          }
                        >
                          {s.spaces.map((x) => (
                            <option key={x.id} value={x.id}>
                              {x.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    ))}
                  </div>
                  <label className="space-wallpaper">
                    Wallpaper
                    <select
                      aria-label={"Wallpaper for " + space.name}
                      value={space.wallpaper}
                      onChange={(e) =>
                        s.spaceAppearance(space.id, {
                          wallpaper: Number(e.target.value),
                        })
                      }
                    >
                      {wallpapers.map((w, i) => (
                        <option key={w.name} value={i}>
                          {w.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="space-wallpaper">
                    Accent
                    <input
                      type="color"
                      aria-label={"Accent for " + space.name}
                      value={space.accent || s.prefs.accent}
                      onChange={(e) =>
                        s.spaceAppearance(space.id, { accent: e.target.value })
                      }
                    />
                  </label>
                </article>
              );
            })}
          </div>
          <div className="spaces-arrange">
            <small>ARRANGE {active.name.toUpperCase()}</small>
            {(["cascade", "side", "grid", "center", "bounds"] as const).map(
              (mode) => (
                <button key={mode} onClick={() => s.arrange(mode)}>
                  <LayoutGrid size={14} />
                  {
                    {
                      cascade: "Cascade",
                      side: "Side by side",
                      grid: "Grid",
                      center: "Center active",
                      bounds: "Bring into bounds",
                    }[mode]
                  }
                </button>
              ),
            )}
            <button
              onClick={() =>
                s.spaceAppearance(
                  active.id,
                  { wallpaper: active.wallpaper },
                  true,
                )
              }
            >
              Use this wallpaper everywhere
            </button>
          </div>
        </>
      )}
      {tab === "templates" && (
        <div className="builtin-templates">
          {builtinTemplates.map((t) => (
            <button
              key={t.name}
              onClick={() => template(t.name)}
              style={{ background: wallpapers[t.wallpaper].background }}
            >
              <strong>{t.name}</strong>
              <span>{t.apps.map((id) => appById(id).name).join(" / ")}</span>
            </button>
          ))}
        </div>
      )}
      {tab !== "spaces" && (
        <div className="saved-layouts">
          {s.layouts
            .filter(
              (l) => l.kind === (tab === "snapshots" ? "snapshot" : "template"),
            )
            .map((l) => (
              <article key={l.id}>
                <div>
                  <strong>{l.name}</strong>
                  <p>
                    {l.windows.length} windows /{" "}
                    {new Date(l.created).toLocaleDateString()}
                  </p>
                </div>
                <button onClick={() => void s.restoreLayout(l.id, "layout")}>
                  Layout only
                </button>
                <button
                  onClick={() =>
                    void s.restoreLayout(l.id, "windows", tab === "templates")
                  }
                >
                  {tab === "templates" ? "New Space" : "Layout + windows"}
                </button>
                <button
                  aria-label={"Rename " + l.name}
                  onClick={() =>
                    nameDialog("Rename saved layout", l.name, (name) =>
                      s.editLayout(l.id, name),
                    )
                  }
                >
                  <Pencil size={14} />
                </button>
                <button
                  aria-label={"Duplicate " + l.name}
                  onClick={() => s.editLayout(l.id, undefined, true)}
                >
                  <Copy size={14} />
                </button>
                <button
                  aria-label={"Delete " + l.name}
                  onClick={() =>
                    setDialog({
                      title: "Delete saved layout?",
                      confirm:
                        "Only the layout record is removed. Files and open windows remain.",
                      run: async () => s.editLayout(l.id),
                    })
                  }
                >
                  <Trash2 size={14} />
                </button>
              </article>
            ))}
          <p className="muted">
            Layouts restore saved file references and geometry. Existing windows
            stay open. Unsaved buffers are not captured.
          </p>
        </div>
      )}
      {deleteId && (
        <div className="space-delete-panel">
          <h3>Delete {s.spaces.find((x) => x.id === deleteId)?.name}?</h3>
          <p>
            Files are preserved. Choose where windows should go, or close them
            with each editor's unsaved-change protection.
          </p>
          <select
            aria-label="Destination Space"
            value={target}
            onChange={(e) => setTarget(e.target.value)}
          >
            {s.spaces
              .filter((x) => x.id !== deleteId)
              .map((x) => (
                <option key={x.id} value={x.id}>
                  {x.name}
                </option>
              ))}
          </select>
          <label>
            <input
              type="checkbox"
              checked={closeWindows}
              onChange={(e) => setCloseWindows(e.target.checked)}
            />
            Close windows instead of moving
          </label>
          <button onClick={() => setDeleteId("")}>Cancel</button>
          <button
            className="primary"
            onClick={() => {
              s.deleteSpace(deleteId, target, closeWindows);
              setDeleteId("");
              close();
            }}
          >
            Delete Space
          </button>
        </div>
      )}
      {dialog && (
        <OperationDialog dialog={dialog} close={() => setDialog(null)} />
      )}
    </FocusPanel>
  );
}

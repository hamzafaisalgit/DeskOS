import { db } from "./core/filesystem/database";
import { filesystem } from "./core/filesystem/service";
import { SpaceSwitcher, SpacesOverview } from "./components/spaces/Spaces";
import { DesktopFiles } from "./components/DesktopFiles";
import { useCallback, useEffect, useRef, useState } from "react";
import type { CSSProperties, MouseEvent } from "react";
import {
  Bell,
  Search,
  Settings,
  LayoutGrid,
  Monitor,
  X,
  ArrowUpRight,
} from "lucide-react";
import { useDesk, constrain, viewport } from "./core/store";
import { apps, appById } from "./core/registry";
import type { AppId } from "./core/registry";
import { wallpapers } from "./core/wallpapers";
import { storageProblem } from "./core/storage";
import { useShortcuts } from "./core/shortcuts";
import { AppIcon } from "./components/AppIcon";
import { DesktopWindow } from "./components/Window";
import { ContextMenu, FocusPanel } from "./components/Overlays";
import type { MenuItem } from "./components/Overlays";
import { Launcher } from "./components/Launcher";
import "./App.css";
function Clock() {
  const [now, setNow] = useState(new Date());
  const hour24 = useDesk((s) => s.prefs.hour24);
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);
  return (
    <time dateTime={now.toISOString()} aria-label={now.toLocaleString()}>
      <strong>
        {now.toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
          hour12: !hour24,
        })}
      </strong>
      <span>
        {now.toLocaleDateString([], { month: "short", day: "numeric" })}
      </span>
    </time>
  );
}
function Toasts() {
  const notices = useDesk((s) => s.notices);
  const [dismissed, setDismissed] = useState<string[]>([]);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  const visible = notices
    .filter((n) => !dismissed.includes(n.id) && now - n.time < 6000)
    .slice(0, 3);
  return (
    <div className="toasts" aria-live="polite">
      {visible.map((n) => (
        <div className={`toast ${n.kind}`} key={n.id}>
          <Bell size={17} />
          <span>{n.text}</span>
          <button
            aria-label="Dismiss notification"
            onClick={() => setDismissed((s) => [...s, n.id])}
          >
            <X size={15} />
          </button>
        </div>
      ))}
    </div>
  );
}
export default function App() {
  const windows = useDesk((s) => s.windows);
  const p = useDesk((s) => s.prefs);
  const active = useDesk((s) => s.active);
  const unread = useDesk((s) => s.notices.filter((n) => !n.read).length);
  const [overlay, setOverlay] = useState<
    "launcher" | "search" | "notifications" | null
  >(null);
  const [menu, setMenu] = useState<{
    x: number;
    y: number;
    items: MenuItem[];
  } | null>(null);
  const [info, setInfo] = useState<AppId | null>(null);
  const [selected, setSelected] = useState<AppId | null>(null);
  const [systemDark, setSystemDark] = useState(
    () => matchMedia("(prefers-color-scheme: dark)").matches,
  );
  const [, resize] = useState(0);
  const drag = useRef<{ x: number; y: number; moved: boolean } | null>(null);
  const s = useDesk.getState;
  const dismiss = useCallback(() => {
    setOverlay(null);
    setMenu(null);
    setInfo(null);
  }, []);
  const palette = useCallback(() => {
    setMenu(null);
    setOverlay((o) => (o === "search" ? null : "search"));
  }, []);
  useShortcuts(palette, dismiss);
  useEffect(() => {
    const s = useDesk.getState;
    const original = s().windows.filter((w) => w.entryId);
    let alive = true;
    void filesystem
      .initialize()
      .then(async () => {
        const interrupted = (await db.journals.toArray()).some(
          (j) => j.state !== "complete",
        );
        if (alive && interrupted)
          s().notify(
            "A restore journal needs attention. Open Recovery Center to inspect status and available checkpoints.",
            "warning",
          );
        let missing = 0;
        for (const w of original) {
          try {
            const e = await filesystem.getEntry(w.entryId!);
            if (e.trashed) throw Error("Trashed");
          } catch {
            if (!alive) return;
            missing++;
            useDesk.setState((state) => ({
              windows: state.windows.map((x) =>
                x.id === w.id && x.entryId === w.entryId
                  ? { ...x, entryId: undefined }
                  : x,
              ),
            }));
          }
        }
        if (alive && missing)
          s().notify(
            "Some restored files are missing or in Trash. Their applications opened without those documents.",
            "warning",
          );
      })
      .catch(() => {});
    const m = matchMedia("(prefers-color-scheme: dark)");
    const change = () => setSystemDark(m.matches);
    m.addEventListener("change", change);
    const onResize = () => {
      resize((n) => n + 1);
      for (const w of s().windows)
        if (!w.maximized) s().bounds(w.id, constrain(w));
    };
    window.addEventListener("resize", onResize);
    const storageError = () =>
      s().notify(
        "Browser storage is unavailable or full. Changes remain in this session; copy notes before closing.",
        "error",
      );
    window.addEventListener("deskos-storage-error", storageError);
    if (storageProblem) s().notify(storageProblem, "warning");
    if (s().windows.length) s().notify("Window arrangement restored", "info");
    return () => {
      alive = false;
      m.removeEventListener("change", change);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("deskos-storage-error", storageError);
    };
  }, []);
  function pin(id: AppId) {
    const pinned = s().prefs.pinned.includes(id);
    s().setPrefs({
      pinned: pinned
        ? s().prefs.pinned.filter((a) => a !== id)
        : [...s().prefs.pinned, id],
    });
    s().notify(
      `${appById(id).name} ${pinned ? "unpinned" : "pinned"}`,
      "success",
    );
  }
  function context(e: MouseEvent, items: MenuItem[]) {
    e.preventDefault();
    e.stopPropagation();
    setOverlay(null);
    setMenu({ x: e.clientX, y: e.clientY, items });
  }
  function windowMenu(e: MouseEvent, id: string) {
    const w = s().windows.find((w) => w.id === id)!;
    context(e, [
      {
        label: "Restore / focus",
        run: () => {
          if (w.maximized || w.snapped) s().maximize(id);
          s().focus(id);
        },
      },
      { label: "Minimize", run: () => s().minimize(id) },
      { label: "Maximize / restore", run: () => s().maximize(id) },
      { label: "Close window", run: () => s().close(id) },
      {
        label: p.pinned.includes(w.appId)
          ? "Unpin application"
          : "Pin application",
        run: () => pin(w.appId),
      },
    ]);
  }
  const allSpaces = useDesk((state) => state.spaces);
  const activeSpaceId = useDesk((state) => state.activeSpace);
  const overviewOpen = useDesk((state) => state.overview);
  const currentSpace = allSpaces.find((x) => x.id === activeSpaceId)!;
  const dockApps = [...new Set([...p.pinned, ...windows.map((w) => w.appId)])];
  const v = viewport();
  return (
    <main
      className={`desktop ${p.theme === "light" || (p.theme === "system" && !systemDark) ? "light" : ""} ${!p.transparent ? "opaque" : ""} ${p.reducedMotion || !p.animations ? "no-motion" : ""}`}
      style={{ "--accent": currentSpace.accent || p.accent } as CSSProperties}
    >
      <div className="wallpaper">
        {wallpapers.map((wallpaper, i) => (
          <div
            key={wallpaper.name}
            className="wallpaper-layer"
            style={{
              background: wallpaper.background,
              opacity: currentSpace.wallpaper === i ? 1 : 0,
            }}
          />
        ))}
        <div className="orbital orbital-one" />
        <div className="orbital orbital-two" />
        <div className="wallpaper-grain" />
      </div>
      <header className="topbar">
        <div className="brand">
          <span className="brand-symbol">D</span>
          <strong>DeskOS</strong>
          <span className="top-separator" />
          <span>
            {active
              ? appById(windows.find((w) => w.id === active)!.appId).name
              : "Desktop"}
          </span>
        </div>
        <div className="top-right">
          <span className="workspace-label">
            <span /> Personal workspace
          </span>
          <button aria-label="Open command palette" onClick={palette}>
            <Search size={16} />
            <kbd>Ctrl K</kbd>
          </button>
          <button
            aria-label="Open Settings"
            onClick={() => s().open("settings")}
          >
            <Settings size={16} />
          </button>
          <button
            aria-label="Notifications"
            className="notification-button"
            onClick={() => {
              s().readNotices();
              setOverlay("notifications");
            }}
          >
            <Bell size={16} />
            {unread > 0 && <i />}
          </button>
          <Clock />
        </div>
      </header>
      <div
        className="workspace"
        onMouseDown={(e) => {
          if (e.target === e.currentTarget) setSelected(null);
        }}
        onContextMenu={(e) => {
          if (e.target !== e.currentTarget) return;
          context(e, [
            {
              label: "Refresh desktop",
              run: () => {
                resize((n) => n + 1);
                s().notify("Desktop view refreshed");
              },
            },
            { label: "Open Settings", run: () => s().open("settings") },
            {
              label: "Change wallpaper",
              run: () => {
                s().setPrefs({ wallpaper: (p.wallpaper + 1) % 6 });
                s().notify("Wallpaper changed", "success");
              },
            },
            {
              label: "Reset icon arrangement",
              run: () => {
                s().setPrefs({ positions: {} });
                s().notify("Shortcut layout reset", "success");
              },
            },
          ]);
        }}
      >
        <div
          className="desktop-greeting"
          aria-hidden="true"
          style={{ pointerEvents: "none" }}
        >
          <small>ROOM TO THINK. SPACE TO CREATE.</small>
          <h1>
            Make yourself
            <br />
            <em>at home.</em>
          </h1>
          <p>Your computer, reinvented.</p>
          <span>DESKOS — PERSONAL WORKSPACE / 01</span>
        </div>
        {p.icons &&
          apps.map((a, i) => {
            const pos = p.positions[a.id] ?? {
              x:
                24 +
                Math.floor(i / Math.max(1, Math.floor(v.height / 102))) * 100,
              y: 20 + (i % Math.max(1, Math.floor(v.height / 102))) * 102,
            };
            const x = Math.max(0, Math.min(pos.x, v.width - 90));
            const y = Math.max(0, Math.min(pos.y, v.height - 88));
            return (
              <button
                key={a.id}
                aria-pressed={selected === a.id}
                className={`desktop-icon ${selected === a.id ? "selected" : ""}`}
                style={{ left: x, top: y }}
                onClick={() => setSelected(a.id)}
                onDoubleClick={() => s().open(a.id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    s().open(a.id);
                  }
                }}
                onContextMenu={(e) =>
                  context(e, [
                    { label: `Open ${a.name}`, run: () => s().open(a.id) },
                    {
                      label: p.pinned.includes(a.id)
                        ? "Unpin from taskbar"
                        : "Pin to taskbar",
                      run: () => pin(a.id),
                    },
                    {
                      label: "Application information",
                      run: () => setInfo(a.id),
                    },
                  ])
                }
                onPointerDown={(e) => {
                  if (e.button !== 0) return;
                  drag.current = {
                    x: e.clientX - x,
                    y: e.clientY - y,
                    moved: false,
                  };
                  e.currentTarget.setPointerCapture(e.pointerId);
                }}
                onPointerMove={(e) => {
                  if (!drag.current || !e.buttons) return;
                  if (
                    Math.abs(e.clientX - drag.current.x - x) +
                      Math.abs(e.clientY - drag.current.y - y) >
                    5
                  )
                    drag.current.moved = true;
                  if (drag.current.moved) {
                    e.currentTarget.style.left = `${Math.max(0, Math.min(e.clientX - drag.current.x, v.width - 90))}px`;
                    e.currentTarget.style.top = `${Math.max(0, Math.min(e.clientY - drag.current.y, v.height - 88))}px`;
                  }
                }}
                onPointerCancel={() => {
                  drag.current = null;
                }}
                onPointerUp={(e) => {
                  if (drag.current?.moved) {
                    const nx =
                      Math.round((e.clientX - drag.current.x) / 10) * 10;
                    const ny =
                      Math.round((e.clientY - drag.current.y) / 10) * 10;
                    s().setPrefs({
                      positions: {
                        ...p.positions,
                        [a.id]: {
                          x: Math.max(0, Math.min(nx, v.width - 90)),
                          y: Math.max(0, Math.min(ny, v.height - 88)),
                        },
                      },
                    });
                  }
                  drag.current = null;
                }}
              >
                <span className="desktop-app-tile" style={{ color: a.color }}>
                  <AppIcon id={a.id} size={30} />
                </span>
                <span>{a.name}</span>
              </button>
            );
          })}
        <DesktopFiles />
        {windows.map((w, i) => (
          <DesktopWindow key={w.id} w={w} index={i} onMenu={windowMenu} />
        ))}
      </div>
      <div className="desktop-caption">
        <span>LOCAL FIRST. ENTIRELY YOURS.</span>
        <span>
          Midnight Glass collection <ArrowUpRight size={12} />
        </span>
      </div>
      <nav className={`dock ${p.dock}`} aria-label="Taskbar">
        <SpaceSwitcher />
        <button
          className="launcher-button"
          aria-label="Open application launcher"
          onClick={() =>
            setOverlay((o) => (o === "launcher" ? null : "launcher"))
          }
        >
          <LayoutGrid size={25} />
        </button>
        <button aria-label="Search" onClick={palette}>
          <Search size={23} />
        </button>
        <span className="dock-divider" />
        {dockApps.map((id) => {
          const a = appById(id);
          const running = windows.filter((w) => w.appId === id);
          return (
            <div
              className={`dock-item ${p.pinned.includes(id) ? "pinned" : "unpinned"}`}
              key={id}
            >
              <button
                aria-label={`Launch ${a.name}`}
                title={a.name}
                className={
                  running.some((w) => w.id === active) ? "dock-active" : ""
                }
                style={{
                  width: p.iconSize + 10,
                  height: p.iconSize + 10,
                  color: a.color,
                }}
                onClick={() => {
                  const w =
                    running.findLast((w) => w.id === active) ?? running.at(-1);
                  if (w) {
                    s().focus(w.id);
                  } else s().open(id);
                }}
                onContextMenu={(e) => {
                  if (running.length) windowMenu(e, running.at(-1)!.id);
                  else
                    context(e, [
                      { label: `Open ${a.name}`, run: () => s().open(id) },
                      { label: "Unpin application", run: () => pin(id) },
                    ]);
                }}
              >
                <AppIcon id={id} size={p.iconSize * 0.64} />
              </button>
              <div className="running-dots">
                {running.slice(0, 4).map((w) => (
                  <i
                    key={w.id}
                    className={
                      w.id === active
                        ? "active-dot"
                        : w.spaceId !== activeSpaceId
                          ? "other-space-dot"
                          : ""
                    }
                  />
                ))}
              </div>
              {running.length > 1 && (
                <div className="window-list">
                  {running.map((w, i) => (
                    <button key={w.id} onClick={() => s().focus(w.id)}>
                      {a.name} {i + 1} /{" "}
                      {s().spaces.find((x) => x.id === w.spaceId)?.name}
                      {w.minimized ? " · minimized" : ""}
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })}
        <span className="dock-divider" />
        <button
          aria-label="Show or restore desktop"
          title="Show desktop · Ctrl Alt D"
          onClick={() => s().showDesktop()}
        >
          <Monitor size={22} />
        </button>
      </nav>
      {(overlay === "launcher" || overlay === "search") && (
        <Launcher mode={overlay} close={dismiss} />
      )}
      {overlay === "notifications" && <NotificationCenter close={dismiss} />}
      {menu && <ContextMenu {...menu} close={dismiss} />}
      {info && (
        <FocusPanel close={dismiss} className="info-panel">
          <AppIcon id={info} size={40} />
          <h2>{appById(info).name}</h2>
          <p>{appById(info).description}</p>
          <p>{appById(info).category} · Built into DeskOS 0.1.0</p>
          <button
            className="primary"
            onClick={() => {
              s().open(info);
              dismiss();
            }}
          >
            Open application
          </button>
        </FocusPanel>
      )}
      <Toasts />
      {overviewOpen && <SpacesOverview />}
    </main>
  );
}
function NotificationCenter({ close }: { close: () => void }) {
  const notices = useDesk((s) => s.notices);
  return (
    <FocusPanel close={close} className="notification-center">
      <div className="setting-row">
        <h2>Notifications</h2>
        <button onClick={() => useDesk.getState().clearNotices()}>
          Clear all
        </button>
      </div>
      {notices.length ? (
        notices.map((n) => (
          <article key={n.id}>
            <Bell size={18} />
            <div>
              <small>
                {n.kind.toUpperCase()} ·{" "}
                {new Date(n.time).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </small>
              <p>{n.text}</p>
            </div>
          </article>
        ))
      ) : (
        <div className="empty">
          <Bell size={30} />
          <h3>All caught up.</h3>
          <p>Your session notifications will appear here.</p>
        </div>
      )}
    </FocusPanel>
  );
}

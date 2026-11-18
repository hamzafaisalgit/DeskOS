import { LaunchContext } from "../core/launch";
import { Component, Suspense, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { Rnd } from "react-rnd";
import { Minus, Maximize2, X, PanelLeft, PanelRight } from "lucide-react";
import { appById } from "../core/registry";
import { useDesk, viewport } from "../core/store";
import type { WindowState } from "../core/store";
import { AppIcon } from "./AppIcon";

class AppBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <div className="empty">
        <h2>This app encountered a problem.</h2>
        <button onClick={() => this.setState({ failed: false })}>
          Try again
        </button>
      </div>
    ) : (
      this.props.children
    );
  }
}

export function DesktopWindow({
  w,
  index,
  onMenu,
}: {
  w: WindowState;
  index: number;
  onMenu: (e: React.MouseEvent, id: string) => void;
}) {
  const active = useDesk((s) => s.active === w.id);
  const snapping = useDesk((s) => s.prefs.snapping);
  const [v, setV] = useState(viewport);
  useEffect(() => {
    const resize = () => setV(viewport());
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, []);
  const app = appById(w.appId);
  const Content = app.component;
  const s = useDesk.getState;
  return (
    <Rnd
      className={`window ${active ? "active" : ""}`}
      style={{ zIndex: index + 10, display: w.minimized ? "none" : undefined }}
      position={w.maximized ? { x: 0, y: 0 } : { x: w.x, y: w.y }}
      size={w.maximized ? v : { width: w.width, height: w.height }}
      minWidth={Math.min(app.minWidth, v.width)}
      minHeight={Math.min(app.minHeight, v.height)}
      maxWidth={v.width}
      maxHeight={v.height}
      bounds="parent"
      dragHandleClassName="window-title"
      cancel="button"
      disableDragging={w.maximized}
      enableResizing={!w.maximized}
      onMouseDown={() => {
        if (!active) s().focus(w.id);
      }}
      onFocusCapture={() => {
        if (!active) s().focus(w.id);
      }}
      onDragStop={(_, d) => {
        s().bounds(w.id, { ...w, x: d.x, y: d.y });
        if (snapping) {
          if (d.y < 8) s().maximize(w.id);
          else if (d.x < 8) s().snap(w.id, "left");
          else if (d.x + w.width > v.width - 8) s().snap(w.id, "right");
        }
      }}
      onResizeStop={(_, __, ref, ___, pos) =>
        s().bounds(w.id, {
          ...pos,
          width: ref.offsetWidth,
          height: ref.offsetHeight,
        })
      }
    >
      <section
        className="window-inner"
        role="region"
        aria-label={`${app.name} window`}
      >
        <header
          className="window-title"
          onDoubleClick={() => s().maximize(w.id)}
          onContextMenu={(e) => onMenu(e, w.id)}
        >
          <span className="window-app-icon" style={{ color: app.color }}>
            <AppIcon id={w.appId} size={16} />
          </span>
          <span>{app.name}</span>
          <div className="window-controls">
            {snapping && (
              <>
                <button
                  aria-label={`Snap ${app.name} left`}
                  onClick={() => s().snap(w.id, "left")}
                >
                  <PanelLeft size={13} />
                </button>
                <button
                  aria-label={`Snap ${app.name} right`}
                  onClick={() => s().snap(w.id, "right")}
                >
                  <PanelRight size={13} />
                </button>
              </>
            )}
            <button
              aria-label={`Minimize ${app.name}`}
              onClick={() => s().minimize(w.id)}
            >
              <Minus size={15} />
            </button>
            <button
              aria-label={`Maximize or restore ${app.name}`}
              onClick={() => s().maximize(w.id)}
            >
              <Maximize2 size={13} />
            </button>
            <button
              className="close"
              aria-label={`Close ${app.name}`}
              onClick={() => s().close(w.id)}
            >
              <X size={16} />
            </button>
          </div>
        </header>
        <div className="window-content">
          <AppBoundary>
            <Suspense
              fallback={
                <div className="empty" role="status">
                  Opening application?
                </div>
              }
            >
              <LaunchContext.Provider value={{ entryId: w.entryId }}>
                <Content />
              </LaunchContext.Provider>
            </Suspense>
          </AppBoundary>
        </div>
      </section>
    </Rnd>
  );
}

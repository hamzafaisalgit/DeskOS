import { StorageSettings } from "./files/StorageSettings";
import { useState } from "react";
import { Palette, Monitor, PanelBottom, AppWindow, Info } from "lucide-react";
import { useDesk, defaults } from "../core/store";
import { wallpapers } from "../core/wallpapers";
import { apps } from "../core/registry";
export function SettingsApp() {
  const p = useDesk((s) => s.prefs);
  const set = useDesk((s) => s.setPrefs);
  const notify = useDesk((s) => s.notify);
  const [tab, setTab] = useState("Appearance");
  const [preview, setPreview] = useState(p.wallpaper);
  function toggle(
    key:
      | "transparent"
      | "reducedMotion"
      | "animations"
      | "snapping"
      | "restore"
      | "icons"
      | "hour24",
    label: string,
  ) {
    return (
      <label className="setting-row">
        <span>{label}</span>
        <input
          type="checkbox"
          checked={p[key]}
          onChange={(e) => set({ [key]: e.target.checked })}
        />
      </label>
    );
  }
  return (
    <div className="split settings">
      <aside>
        <small>PERSONALIZE YOUR SPACE</small>
        {[
          ["Appearance", Palette],
          ["Desktop", Monitor],
          ["Taskbar", PanelBottom],
          ["Windows", AppWindow],
          ["System", Info],
          ["Storage", Monitor],
        ].map(([name, Icon]) => {
          const I = Icon as typeof Palette;
          return (
            <button
              key={String(name)}
              className={tab === name ? "selected" : ""}
              onClick={() => setTab(String(name))}
            >
              <I size={17} />
              {String(name)}
            </button>
          );
        })}
      </aside>
      <section className="settings-main">
        <small>SETTINGS</small>
        <h2>{tab}</h2>
        <p className="muted">A desktop that feels like you.</p>
        {tab === "Storage" && <StorageSettings />}
        {tab === "Appearance" && (
          <>
            <h3>Theme</h3>
            <div className="choices">
              {(["dark", "light", "system"] as const).map((theme) => (
                <button
                  key={theme}
                  aria-pressed={p.theme === theme}
                  className={p.theme === theme ? "selected" : ""}
                  onClick={() => {
                    set({ theme });
                    notify(`Theme updated to ${theme}`, "success");
                  }}
                >
                  <div className={`theme-preview ${theme}`} />
                  {theme}
                </button>
              ))}
            </div>
            <h3>Accent color</h3>
            <div className="swatches">
              {["#a49aff", "#6eacfa", "#7bd6b5", "#f4c674", "#f49da9"].map(
                (accent) => (
                  <button
                    aria-label={`Accent ${accent}`}
                    aria-pressed={p.accent === accent}
                    key={accent}
                    style={{ background: accent }}
                    onClick={() => set({ accent })}
                  >
                    {p.accent === accent ? "✓" : ""}
                  </button>
                ),
              )}
            </div>
            <h3>
              Wallpaper <small>Preview, then apply</small>
            </h3>
            <div
              className="wallpaper-preview"
              style={{ background: wallpapers[preview].background }}
            />
            <div className="wallpaper-grid">
              {wallpapers.map((w, i) => (
                <button
                  aria-label={`Preview ${w.name}`}
                  aria-pressed={preview === i}
                  title={w.name}
                  key={w.name}
                  style={{ background: w.background }}
                  onClick={() => setPreview(i)}
                />
              ))}
            </div>
            <div className="setting-row">
              <span>{wallpapers[preview].name}</span>
              <button
                className="primary"
                onClick={() => {
                  set({ wallpaper: preview });
                  notify("Wallpaper changed", "success");
                }}
              >
                Apply wallpaper
              </button>
            </div>
            {toggle("transparent", "Translucent surfaces")}
            {toggle("reducedMotion", "Reduce motion")}
          </>
        )}
        {tab === "Desktop" && (
          <>
            {toggle("icons", "Show desktop shortcuts")}
            <div className="setting-row">
              <span>Icon arrangement</span>
              <button
                onClick={() => {
                  set({ positions: {} });
                  notify("Shortcut layout reset", "success");
                }}
              >
                Reset to grid
              </button>
            </div>
            <p className="muted">
              Drag shortcuts to arrange them. Positions are saved on this
              browser.
            </p>
          </>
        )}
        {tab === "Taskbar" && (
          <>
            <label className="setting-row">
              Layout
              <select
                value={p.dock}
                onChange={(e) =>
                  set({ dock: e.target.value as "full" | "floating" })
                }
              >
                <option value="floating">Floating dock</option>
                <option value="full">Full width</option>
              </select>
            </label>
            <label className="setting-row">
              Icon size
              <input
                aria-label="Dock icon size"
                type="range"
                min="32"
                max="56"
                value={p.iconSize}
                onChange={(e) => set({ iconSize: Number(e.target.value) })}
              />
            </label>
            <h3>Pinned applications</h3>
            {apps.map((a) => (
              <label className="setting-row" key={a.id}>
                {a.name}
                <input
                  type="checkbox"
                  checked={p.pinned.includes(a.id)}
                  onChange={(e) =>
                    set({
                      pinned: e.target.checked
                        ? [...p.pinned, a.id]
                        : p.pinned.filter((id) => id !== a.id),
                    })
                  }
                />
              </label>
            ))}
          </>
        )}
        {tab === "Windows" && (
          <>
            {toggle("animations", "Window animations")}
            {toggle("snapping", "Snap windows at screen edges")}
            {toggle("restore", "Restore window layouts after reload")}
            <p className="muted">
              Terminal history and calculator input are session-only. Notes
              autosave separately.
            </p>
          </>
        )}
        {tab === "System" && (
          <>
            <div className="about-mark">
              D<span>DeskOS</span>
            </div>
            <p>Your Computer, Reinvented.</p>
            <span className="badge">Version 0.1.0 · Desktop Foundation</span>
            <p className="muted">
              Runs entirely in your browser. Pointer events, local storage, and
              a modern JavaScript browser are required. Clearing site data
              removes saved notes and preferences.
            </p>
            {toggle("hour24", "Use 24-hour clock")}
            <div className="setting-row">
              Appearance preferences
              <button
                onClick={() => {
                  set({
                    theme: defaults.theme,
                    accent: defaults.accent,
                    wallpaper: 0,
                    transparent: true,
                    reducedMotion: false,
                  });
                  setPreview(0);
                  notify("Appearance reset", "success");
                }}
              >
                Reset appearance
              </button>
            </div>
            <div className="setting-row">
              Desktop layout
              <button
                onClick={() => {
                  set({
                    positions: {},
                    dock: defaults.dock,
                    pinned: [...defaults.pinned],
                    iconSize: 42,
                    icons: true,
                  });
                  notify("Desktop layout reset", "success");
                }}
              >
                Reset layout
              </button>
            </div>
            <h3>Keyboard shortcuts</h3>
            <p className="shortcut-list">
              Ctrl K — Search commands
              <br />
              Ctrl Alt T — Terminal
              <br />
              Ctrl Alt N — Notes
              <br />
              Ctrl Alt S — Settings
              <br />
              Ctrl Alt D — Show / restore desktop
              <br />
              Alt Tab — Cycle windows (when browser permits)
              <br />
              Escape — Dismiss overlay
            </p>
          </>
        )}
      </section>
    </div>
  );
}

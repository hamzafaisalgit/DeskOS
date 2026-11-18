import { useState } from "react";
import { Search, ArrowUpRight, X, Command, Star } from "lucide-react";
import { apps, searchApps, appById } from "../core/registry";
import { useDesk } from "../core/store";
import { AppIcon } from "./AppIcon";
import { FocusPanel } from "./Overlays";
import { systemCommands } from "../core/commands";
import type { CommandEntry } from "../core/commands";
export function Launcher({
  mode,
  close,
}: {
  mode: "launcher" | "search";
  close: () => void;
}) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(0);
  const [category, setCategory] = useState("All apps");
  const recent = useDesk((s) => s.recent);
  const pinned = useDesk((s) => s.prefs.pinned);
  const s = useDesk.getState;
  const commands = systemCommands();
  const matches = searchApps(query).filter(
    (a) => category === "All apps" || a.category === category,
  );
  const results: CommandEntry[] = [
    ...matches.map((a) => ({
      id: a.id,
      name: a.name,
      group: "Applications",
      run: () => s().open(a.id),
    })),
    ...(mode === "search"
      ? commands.filter((c) =>
          c.name.toLowerCase().includes(query.toLowerCase()),
        )
      : []),
  ];
  function execute(i: number) {
    results[i]?.run();
    close();
  }
  return (
    <FocusPanel close={close} className={mode}>
      <div className="search-field">
        <Search size={21} />
        <input
          aria-label="Search applications and commands"
          placeholder={
            mode === "search"
              ? "Where would you like to go?"
              : "Search your applications…"
          }
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setSelected(0);
          }}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown" || e.key === "ArrowUp") {
              e.preventDefault();
              setSelected((i) =>
                results.length
                  ? (i + (e.key === "ArrowDown" ? 1 : -1) + results.length) %
                    results.length
                  : 0,
              );
            }
            if (e.key === "Enter") {
              e.preventDefault();
              execute(selected);
            }
          }}
        />
        {query && (
          <button
            aria-label="Clear query"
            onClick={() => {
              setQuery("");
              setSelected(0);
            }}
          >
            <X size={16} />
          </button>
        )}
        <kbd>esc</kbd>
      </div>
      {mode === "launcher" && (
        <>
          <div className="launcher-heading">
            <h2>Your workspace.</h2>
            <span>Make something good today.</span>
          </div>
          <div className="categories">
            {["All apps", ...new Set(apps.map((a) => a.category))].map((c) => (
              <button
                className={category === c ? "selected" : ""}
                key={c}
                onClick={() => {
                  setCategory(c);
                  setSelected(0);
                }}
              >
                {c}
              </button>
            ))}
          </div>
        </>
      )}
      <div className={mode === "launcher" ? "app-grid" : "command-results"}>
        {results.map((r, i) => (
          <div key={r.id}>
            {mode === "search" &&
              (i === 0 || results[i - 1].group !== r.group) && (
                <small>{r.group}</small>
              )}
            <button
              aria-pressed={selected === i}
              className={selected === i ? "chosen" : ""}
              onMouseEnter={() => setSelected(i)}
              onClick={() => execute(i)}
            >
              {apps.some((a) => a.id === r.id) ? (
                <>
                  <span
                    className="app-tile"
                    style={{
                      color: appById(r.id as (typeof apps)[number]["id"]).color,
                    }}
                  >
                    <AppIcon
                      id={r.id as (typeof apps)[number]["id"]}
                      size={mode === "launcher" ? 30 : 22}
                    />
                  </span>
                  <span>
                    <strong>{r.name}</strong>
                    {mode === "search" && (
                      <small>
                        {
                          appById(r.id as (typeof apps)[number]["id"])
                            .description
                        }
                      </small>
                    )}
                  </span>
                  {pinned.includes(r.id as (typeof apps)[number]["id"]) && (
                    <Star size={11} />
                  )}
                </>
              ) : (
                <>
                  <Command size={20} />
                  <strong>{r.name}</strong>
                </>
              )}
              <ArrowUpRight size={15} />
            </button>
          </div>
        ))}
        {!results.length && (
          <div className="empty">
            <Search size={26} />
            <h3>No matches</h3>
            <p>Try an app name, category, or action.</p>
          </div>
        )}
      </div>
      {mode === "launcher" && recent.length > 0 && (
        <div className="recent">
          <small>RECENTLY OPENED</small>
          {recent.map((id) => (
            <button
              key={id}
              onClick={() => {
                s().open(id);
                close();
              }}
            >
              <AppIcon id={id} size={16} />
              {appById(id).name}
            </button>
          ))}
        </div>
      )}
      <footer className="panel-footer">
        <span>↑ ↓ to navigate · Enter to open</span>
        <span>DeskOS / 01</span>
      </footer>
    </FocusPanel>
  );
}

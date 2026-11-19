import { useEffect, useRef, useState } from "react";
import {
  executeCommand,
  completeCommand,
  HOME,
} from "../../core/documents/shell";
import { useFilesystem } from "../../core/filesystem/hooks";
import { useLaunchData } from "../../core/launch";
import { useDesk } from "../../core/store";
export function TerminalApp() {
  const launch = useLaunchData();
  const { entries } = useFilesystem();
  const [cwd, setCwd] = useState(HOME);
  const [lines, setLines] = useState<{ text: string; error?: boolean }[]>([
    {
      text: "DeskShell 0.3.0 · Your virtual workspace\nType help for commands. No host shell access.",
    },
  ]);
  const [input, setInput] = useState("");
  const [history, setHistory] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const index = useRef(0);
  const end = useRef<HTMLDivElement>(null);
  const field = useRef<HTMLInputElement>(null);
  useEffect(() => {
    end.current?.scrollIntoView({ block: "nearest" });
  }, [lines]);
  const path = entries.find((e) => e.id === cwd)?.name ?? "Unavailable";
  async function run() {
    const command = input;
    setInput("");
    setHistory((h) => [...h, command].slice(-500));
    index.current = history.length + 1;
    setBusy(true);
    setLines((l) => [...l, { text: `${path} $ ${command}` }]);
    try {
      const result = await executeCommand(command, cwd, [...history, command]);
      setCwd(result.cwd);
      if (result.clear) setLines([]);
      else setLines((l) => [...l, { text: result.output }].slice(-2000));
    } catch (e) {
      setLines((l) => [...l, { text: String(e), error: true }]);
    } finally {
      setBusy(false);
      requestAnimationFrame(() => {
        if (useDesk.getState().active === launch.windowId)
          field.current?.focus();
      });
    }
  }
  return (
    <div className="terminal-app">
      <div className="terminal-hint">
        DESKSHELL <span>Virtual filesystem · {path}</span>
      </div>
      <div className="terminal-output">
        {lines.map((l, i) => (
          <pre key={i} style={l.error ? { color: "#f4a5a5" } : undefined}>
            {l.text}
          </pre>
        ))}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!busy) void run();
          }}
        >
          <label>
            local@deskos <span>{path} $</span>
          </label>
          <input
            ref={field}
            autoFocus
            aria-label="Terminal command"
            disabled={busy}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.ctrlKey && e.key === "l") {
                e.preventDefault();
                setLines([]);
              }
              if (e.key === "ArrowUp" || e.key === "ArrowDown") {
                e.preventDefault();
                index.current = Math.max(
                  0,
                  Math.min(
                    history.length,
                    index.current + (e.key === "ArrowUp" ? -1 : 1),
                  ),
                );
                setInput(history[index.current] ?? "");
              }
              if (e.key === "Tab") {
                e.preventDefault();
                void completeCommand(input, cwd)
                  .then((matches) => {
                    if (matches.length === 1) {
                      const prefix = input.includes(" ")
                        ? input.slice(0, input.lastIndexOf(" ") + 1)
                        : "";
                      setInput(
                        prefix +
                          (matches[0].includes(" ")
                            ? JSON.stringify(matches[0])
                            : matches[0]),
                      );
                    } else
                      setLines((l) => [
                        ...l,
                        { text: matches.join("  ") || "No completions." },
                      ]);
                  })
                  .catch((e) =>
                    setLines((l) => [...l, { text: String(e), error: true }]),
                  );
              }
            }}
          />
        </form>
        <div ref={end} />
      </div>
    </div>
  );
}

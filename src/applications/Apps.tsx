import { useEffect, useId, useRef, useState } from "react";
import {
  Folder,
  FileText,
  Download,
  Image,
  Music,
  Clock,
  Plus,
  Trash2,
  ArrowUpRight,
} from "lucide-react";
import { apps } from "../core/registry";
import type { AppId } from "../core/registry";
import { useDesk } from "../core/store";
import { useNotes } from "../core/notes";
import { calculate } from "../core/calculator";
export function Files() {
  const [place, setPlace] = useState("Home");
  return (
    <div className="split files">
      <aside>
        <small>FAVORITES</small>
        {[
          ["Home", Folder],
          ["Documents", FileText],
          ["Downloads", Download],
          ["Pictures", Image],
          ["Music", Music],
          ["Recent", Clock],
        ].map(([name, Icon]) => {
          const I = Icon as typeof Folder;
          return (
            <button
              className={place === name ? "selected" : ""}
              key={String(name)}
              onClick={() => setPlace(String(name))}
            >
              <I size={17} />
              {String(name)}
            </button>
          );
        })}
        <div className="sidebar-bottom">
          LOCAL WORKSPACE
          <br />
          <span>Phase 1 · Desktop foundation</span>
        </div>
      </aside>
      <section className="files-main">
        <div className="app-toolbar">Personal / {place}</div>
        <div className="empty">
          <div className="large-icon">
            <Folder size={42} />
          </div>
          <small>A PLACE FOR EVERYTHING</small>
          <h2>Your files, together.</h2>
          <p>
            Virtual file storage arrives in Phase 2.
            <br />
            This space will become your home for documents,
            <br />
            downloads, and everything you create.
          </p>
          <span className="badge">Desktop foundation is ready</span>
        </div>
      </section>
    </div>
  );
}
export function TerminalApp() {
  const inputId = useId();
  const [lines, setLines] = useState([
    "DeskShell 0.1.0",
    "Your browser workspace. Type help to get started.",
    "",
  ]);
  const [input, setInput] = useState("");
  const [history, setHistory] = useState<string[]>([]);
  const index = useRef(0);
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => {
    end.current?.scrollIntoView({ block: "nearest" });
  }, [lines]);
  function run() {
    const command = input.trim();
    const [cmd, ...args] = command.split(/\s+/);
    const s = useDesk.getState();
    let output = "";
    switch (cmd) {
      case "help":
        output =
          "help · clear · date · echo <text> · whoami · version\napps · open <app-id> · theme [dark|light|system]";
        break;
      case "clear":
        setLines([]);
        setInput("");
        return;
      case "date":
        output = new Date().toLocaleString();
        break;
      case "echo":
        output = command.slice(5);
        break;
      case "whoami":
        output = "local@deskos — local browser session";
        break;
      case "version":
        output = "DeskOS 0.1.0 · Desktop Foundation";
        break;
      case "apps":
        output = apps.map((a) => `${a.id.padEnd(12)} ${a.name}`).join("\n");
        break;
      case "open":
        if (apps.some((a) => a.id === args[0])) {
          s.open(args[0] as AppId);
          output = `Opened ${args[0]}`;
        } else output = "Unknown app. Use apps to list IDs.";
        break;
      case "theme":
        if (!args[0]) output = s.prefs.theme;
        else if (["dark", "light", "system"].includes(args[0])) {
          s.setPrefs({ theme: args[0] as "dark" | "light" | "system" });
          output = `Theme: ${args[0]}`;
          s.notify(output, "success");
        } else output = "Usage: theme [dark|light|system]";
        break;
      case "":
        break;
      default:
        output = `Command not found: ${cmd}. Type help.`;
    }
    setLines((l) => [...l, `local@deskos ~ $ ${input}`, output]);
    setHistory((h) => [...h, input]);
    index.current = history.length + 1;
    setInput("");
  }
  return (
    <div className="terminal-app">
      <div className="terminal-hint">
        DESKSHELL <span>Browser commands · no host machine access</span>
      </div>
      <div className="terminal-output">
        {lines.map((line, i) => (
          <pre key={i}>{line}</pre>
        ))}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            run();
          }}
        >
          <label htmlFor={inputId}>
            local@deskos <span>~ $</span>
          </label>
          <input
            id={inputId}
            autoFocus
            aria-label="Terminal command"
            autoComplete="off"
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
            }}
          />
        </form>
        <div ref={end} />
      </div>
    </div>
  );
}
export function Notes() {
  const notes = useNotes((s) => s.notes);
  const save = useNotes((s) => s.save);
  const remove = useNotes((s) => s.remove);
  const [id, setId] = useState<string | undefined>(notes[0]?.id);
  const [confirm, setConfirm] = useState(false);
  const [saved, setSaved] = useState(true);
  const note = notes.find((n) => n.id === id);
  function add() {
    const n = {
      id: crypto.randomUUID(),
      title: "Untitled note",
      text: "",
      updated: Date.now(),
    };
    setSaved(save(n));
    setId(n.id);
  }
  return (
    <div className="split notes">
      <aside>
        <div className="aside-heading">
          YOUR NOTES
          <button aria-label="New note" onClick={add}>
            <Plus size={18} />
          </button>
        </div>
        {notes.map((n) => (
          <button
            className={n.id === id ? "selected note-link" : "note-link"}
            key={n.id}
            onClick={() => {
              setId(n.id);
              setConfirm(false);
            }}
          >
            <strong>{n.title || "Untitled note"}</strong>
            <span>{n.text.slice(0, 45) || "A fresh page"}</span>
          </button>
        ))}
        {!notes.length && <p>No notes yet.</p>}
      </aside>
      <section className="note-editor">
        {note ? (
          <>
            <div className="app-toolbar">
              <small>
                {saved
                  ? "Saved on this browser"
                  : "Storage unavailable — copy your text before closing"}
              </small>
              <button aria-label="Delete note" onClick={() => setConfirm(true)}>
                <Trash2 size={16} />
              </button>
            </div>
            {confirm && (
              <div className="confirm" role="alert">
                Delete this note permanently?{" "}
                <button
                  onClick={() => {
                    setSaved(remove(note.id));
                    setId(notes.find((n) => n.id !== note.id)?.id);
                    setConfirm(false);
                  }}
                >
                  Delete
                </button>
                <button onClick={() => setConfirm(false)}>Cancel</button>
              </div>
            )}
            <input
              className="note-title"
              aria-label="Note title"
              value={note.title}
              onChange={(e) =>
                setSaved(
                  save({ ...note, title: e.target.value, updated: Date.now() }),
                )
              }
            />
            <textarea
              aria-label="Note text"
              placeholder="Let your thoughts settle here…"
              value={note.text}
              onChange={(e) =>
                setSaved(
                  save({ ...note, text: e.target.value, updated: Date.now() }),
                )
              }
            />
            <footer>
              {note.text.trim().split(/\s+/).filter(Boolean).length} words ·
              Plain text scratchpad
            </footer>
          </>
        ) : (
          <div className="empty">
            <FileText size={40} />
            <h2>A little space to think.</h2>
            <p>Notes are saved locally, as you type.</p>
            <button className="primary" onClick={add}>
              Create a note <ArrowUpRight size={16} />
            </button>
          </div>
        )}
      </section>
    </div>
  );
}
export function CalculatorApp() {
  const [expression, setExpression] = useState("");
  const [answer, setAnswer] = useState("0");
  function key(k: string) {
    if (k === "C") {
      setExpression("");
      setAnswer("0");
    } else if (k === "⌫") setExpression((s) => s.slice(0, -1));
    else if (k === "=") {
      try {
        const n = String(calculate(expression));
        setAnswer(n);
        setExpression(n);
      } catch (e) {
        setAnswer((e as Error).message);
      }
    } else setExpression((s) => s + k);
  }
  return (
    <div
      className="calculator"
      tabIndex={0}
      aria-label="Calculator keypad"
      onKeyDown={(e) => {
        if (/^[\d.+\-*/()]$/.test(e.key)) {
          e.preventDefault();
          key(e.key);
        } else if (e.key === "Enter" || e.key === "=") {
          e.preventDefault();
          key("=");
        } else if (e.key === "Backspace") key("⌫");
        else if (e.key === "Escape") key("C");
      }}
    >
      <div className="calc-display">
        <small>{expression || "Ready when you are"}</small>
        <output>{answer}</output>
      </div>
      <div className="calc-grid">
        {[
          "C",
          "(",
          ")",
          "⌫",
          "7",
          "8",
          "9",
          "/",
          "4",
          "5",
          "6",
          "*",
          "1",
          "2",
          "3",
          "-",
          "0",
          ".",
          "=",
          "+",
        ].map((k) => (
          <button
            className={
              k === "=" ? "primary" : /[/*+-]/.test(k) ? "operator" : ""
            }
            key={k}
            onClick={() => key(k)}
          >
            {k === "*" ? "×" : k === "/" ? "÷" : k}
          </button>
        ))}
      </div>
      <footer>STANDARD · Safe arithmetic</footer>
    </div>
  );
}

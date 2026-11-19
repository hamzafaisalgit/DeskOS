import { useState } from "react";
import { calculate } from "../../core/calculator";
import "./editor.css";
import { readStorage, writeStorage } from "../../core/storage";
import { useDesk } from "../../core/store";
type Calculation = { expression: string; result: string };
export function CalculatorApp() {
  const [expression, setExpression] = useState("");
  const [answer, setAnswer] = useState("0");
  const [scientific, setScientific] = useState(false);
  const [degrees, setDegrees] = useState(true);
  const [history, setHistory] = useState<Calculation[]>(() => {
    const raw = readStorage("calculator-history");
    return Array.isArray(raw)
      ? raw
          .filter(
            (v) =>
              v &&
              typeof v.expression === "string" &&
              typeof v.result === "string",
          )
          .slice(0, 50)
      : [];
  });
  const [showHistory, setShowHistory] = useState(false);
  function key(k: string) {
    if (k === "C") {
      setExpression("");
      setAnswer("0");
    } else if (k === "⌫") setExpression((s) => s.slice(0, -1));
    else if (k === "=") {
      try {
        const result = String(calculate(expression, degrees));
        setAnswer(result);
        setExpression(result);
        const next = [{ expression, result }, ...history].slice(0, 50);
        setHistory(next);
        writeStorage("calculator-history", next);
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
        if (/^[\d.+*/()^!%a-z-]$/i.test(e.key) && !e.ctrlKey && !e.metaKey) {
          e.preventDefault();
          key(e.key);
        } else if (e.key === "Enter" || e.key === "=") {
          e.preventDefault();
          key("=");
        } else if (e.key === "Backspace") {
          e.preventDefault();
          key("⌫");
        } else if (e.key === "Escape") key("C");
      }}
    >
      <div className="calc-mode">
        <button onClick={() => setScientific(!scientific)}>
          {scientific ? "Scientific" : "Standard"}
        </button>
        {scientific && (
          <button onClick={() => setDegrees(!degrees)}>
            {degrees ? "DEG" : "RAD"}
          </button>
        )}
        <button onClick={() => setShowHistory(!showHistory)}>History</button>
      </div>
      <div className="calc-display">
        <small>{expression || "Ready when you are"}</small>
        <output>{answer}</output>
      </div>
      {showHistory ? (
        <div className="calc-history">
          {history.map((h, i) => (
            <button key={i} onClick={() => setExpression(h.expression)}>
              <small>{h.expression}</small>
              <strong>{h.result}</strong>
            </button>
          ))}
          {!history.length && <p>No calculations yet.</p>}
          <button
            onClick={() => {
              setHistory([]);
              writeStorage("calculator-history", []);
            }}
          >
            Clear history
          </button>
        </div>
      ) : (
        <>
          {scientific && (
            <div className="scientific-grid">
              {[
                "sin(",
                "cos(",
                "tan(",
                "sqrt(",
                "log(",
                "ln(",
                "pi",
                "e",
                "^",
                "!",
                "%",
                "abs(",
              ].map((k) => (
                <button key={k} onClick={() => key(k)}>
                  {k}
                </button>
              ))}
            </div>
          )}
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
                key={k}
                className={k === "=" ? "primary" : ""}
                onClick={() => key(k)}
              >
                {k === "*" ? "×" : k === "/" ? "÷" : k}
              </button>
            ))}
          </div>
        </>
      )}
      <footer>
        <button
          onClick={() => {
            void navigator.clipboard
              ?.writeText(answer)
              .then(() => useDesk.getState().notify("Result copied"))
              .catch(() =>
                useDesk
                  .getState()
                  .notify(
                    "Clipboard unavailable. Select the result and copy it manually.",
                    "warning",
                  ),
              );
          }}
        >
          Copy result
        </button>
        <button onClick={() => key("%")}>%</button>
      </footer>
    </div>
  );
}

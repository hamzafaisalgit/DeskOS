import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
export type MenuItem = { label: string; run: () => void };
export function FocusPanel({
  children,
  close,
  className = "",
}: {
  children: ReactNode;
  close: () => void;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const before = document.activeElement as HTMLElement;
    const root = ref.current!;
    (root.querySelector('input,button,[tabindex="0"]') as HTMLElement)?.focus();
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        close();
      }
      if (e.key === "Tab") {
        const nodes = [
          ...root.querySelectorAll<HTMLElement>(
            'button,input,select,[tabindex="0"]',
          ),
        ];
        if (e.shiftKey && document.activeElement === nodes[0]) {
          e.preventDefault();
          nodes.at(-1)?.focus();
        } else if (!e.shiftKey && document.activeElement === nodes.at(-1)) {
          e.preventDefault();
          nodes[0]?.focus();
        }
      }
    };
    root.addEventListener("keydown", key);
    return () => {
      root.removeEventListener("keydown", key);
      before?.focus();
    };
  }, [close]);
  return (
    <div
      className="overlay-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="System panel"
        ref={ref}
        className={`overlay-panel ${className}`}
      >
        {children}
      </div>
    </div>
  );
}
export function ContextMenu({
  x,
  y,
  items,
  close,
}: {
  x: number;
  y: number;
  items: MenuItem[];
  close: () => void;
}) {
  const [selected, setSelected] = useState(0);
  return (
    <FocusPanel close={close} className="menu-panel">
      <div
        className="context-menu"
        role="menu"
        style={{
          left: Math.max(4, Math.min(x, window.innerWidth - 245)),
          top: Math.max(
            4,
            Math.min(y, window.innerHeight - items.length * 40 - 20),
          ),
        }}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown" || e.key === "ArrowUp") {
            e.preventDefault();
            const next =
              (selected + (e.key === "ArrowDown" ? 1 : -1) + items.length) %
              items.length;
            setSelected(next);
            (e.currentTarget.children[next] as HTMLElement).focus();
          }
        }}
      >
        {items.map((item, i) => (
          <button
            key={item.label}
            role="menuitem"
            tabIndex={i === selected ? 0 : -1}
            onFocus={() => setSelected(i)}
            onClick={() => {
              close();
              item.run();
            }}
          >
            {item.label}
          </button>
        ))}
      </div>
    </FocusPanel>
  );
}

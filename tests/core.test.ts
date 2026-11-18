import { beforeEach, describe, expect, it, vi } from "vitest";
const memory = new Map<string, string>();
vi.stubGlobal("localStorage", {
  getItem: (k: string) => memory.get(k) ?? null,
  setItem: (k: string, v: string) => memory.set(k, v),
});
const { useDesk, defaults, constrain, validatePreferences, restoreWindows } =
  await import("../src/core/store");
const { useNotes } = await import("../src/core/notes");
const { apps, searchApps } = await import("../src/core/registry");
const { calculate } = await import("../src/core/calculator");
const { systemCommands } = await import("../src/core/commands");
const { readStorage, writeStorage } = await import("../src/core/storage");
beforeEach(() => {
  memory.clear();
  useDesk.setState({
    windows: [],
    active: null,
    hidden: [],
    notices: [],
    prefs: { ...defaults },
  });
  useNotes.setState({ notes: [] });
});
describe("window manager", () => {
  it("opens, focuses, minimizes, restores and closes multiple windows", () => {
    const s = useDesk.getState;
    s().open("files");
    const first = s().active!;
    s().open("terminal");
    const second = s().active!;
    expect(s().windows).toHaveLength(2);
    s().focus(first);
    expect(s().windows.at(-1)?.id).toBe(first);
    s().minimize(first);
    expect(s().active).toBe(second);
    s().focus(first);
    expect(s().windows.at(-1)?.minimized).toBe(false);
    s().close(first);
    expect(s().active).toBe(second);
    s().close(second);
    expect(s().active).toBeNull();
  });
  it("enforces single instance for Notes and supports multiple Files windows", () => {
    const s = useDesk.getState;
    s().open("notes");
    s().minimize(s().active!);
    s().open("notes");
    expect(s().windows).toHaveLength(1);
    expect(s().windows[0].minimized).toBe(false);
    s().open("files");
    s().open("files");
    expect(s().windows).toHaveLength(3);
  });
  it("restores exact bounds after maximizing and snapping", () => {
    const s = useDesk.getState;
    s().open("files");
    const w = s().windows[0];
    s().maximize(w.id);
    expect(s().windows[0].maximized).toBe(true);
    s().maximize(w.id);
    expect(s().windows[0]).toMatchObject({
      x: w.x,
      y: w.y,
      width: w.width,
      height: w.height,
    });
    s().snap(w.id, "right");
    expect(s().windows[0].snapped).toBe(true);
    s().maximize(w.id);
    expect(s().windows[0]).toMatchObject({
      x: w.x,
      width: w.width,
      snapped: false,
    });
  });
  it("clamps bounds to viewport", () => {
    expect(constrain({ x: 9000, y: -40, width: 9000, height: 9000 })).toEqual({
      x: 0,
      y: 0,
      width: 1280,
      height: 720,
    });
  });
  it("show desktop restores only the windows it minimized", () => {
    const s = useDesk.getState;
    s().open("files");
    const first = s().active!;
    s().minimize(first);
    s().open("terminal");
    s().showDesktop();
    expect(s().active).toBeNull();
    s().showDesktop();
    expect(s().windows.find((w) => w.id === first)?.minimized).toBe(true);
    expect(s().windows.at(-1)?.minimized).toBe(false);
  });
});
describe("registry and search", () => {
  it("has unique, complete definitions", () => {
    expect(new Set(apps.map((a) => a.id)).size).toBe(apps.length);
    apps.forEach((a) => {
      expect(a.component).toBeTruthy();
      expect(a.icon).toBeTruthy();
      expect(a.width).toBeGreaterThanOrEqual(a.minWidth);
      expect(a.height).toBeGreaterThanOrEqual(a.minHeight);
    });
  });
  it("searches names, descriptions and categories and handles no results", () => {
    expect(searchApps("NOTES")[0].id).toBe("notes");
    expect(searchApps("thoughts")[0].id).toBe("notes");
    expect(searchApps("development")[0].id).toBe("terminal");
    expect(searchApps("nonexistent")).toEqual([]);
  });
  it("executes typed system commands", () => {
    const theme = useDesk.getState().prefs.theme;
    systemCommands()
      .find((c) => c.id === "theme")!
      .run();
    expect(useDesk.getState().prefs.theme).not.toBe(theme);
    useDesk.getState().open("files");
    systemCommands()
      .find((c) => c.id === "minimize")!
      .run();
    expect(useDesk.getState().windows[0].minimized).toBe(true);
  });
});
describe("persistence", () => {
  it("saves and reads preferences", () => {
    useDesk.getState().setPrefs({ theme: "light", wallpaper: 4 });
    expect(validatePreferences(readStorage("preferences"))).toMatchObject({
      theme: "light",
      wallpaper: 4,
    });
  });
  it("handles malformed JSON and invalid preference fields", () => {
    memory.set("deskos.v1.preferences", "{broken");
    expect(readStorage("preferences")).toBeNull();
    expect(
      validatePreferences({
        theme: "invalid",
        wallpaper: -1,
        pinned: ["notes", "notes", "invalid"],
        positions: { notes: { x: "bad", y: 0 } },
      }),
    ).toMatchObject({
      theme: "dark",
      wallpaper: 0,
      pinned: ["notes"],
      positions: {},
    });
  });
  it("restores eligible windows including previous bounds", () => {
    const s = useDesk.getState;
    s().open("files");
    const w = s().windows[0];
    s().maximize(w.id);
    const restored = restoreWindows(readStorage("windows"));
    expect(restored[0].previous).toEqual({
      x: w.x,
      y: w.y,
      width: w.width,
      height: w.height,
    });
    expect(restored[0].maximized).toBe(true);
    expect(
      restoreWindows([
        { ...w, appId: "unknown" },
        { ...w, x: NaN },
      ]),
    ).toEqual([]);
  });
  it("disables layout restoration storage when preference is off", () => {
    useDesk.getState().open("files");
    useDesk.getState().setPrefs({ restore: false });
    expect(readStorage("windows")).toEqual([]);
  });
  it("handles quota failure without throwing", () => {
    const original = localStorage.setItem;
    localStorage.setItem = () => {
      throw Error("quota");
    };
    expect(writeStorage("test", {})).toBe(false);
    localStorage.setItem = original;
  });
});
describe("notes", () => {
  it("creates, edits, autosaves and deletes without losing other notes", () => {
    const s = useNotes.getState;
    const a = { id: "a", title: "First", text: "", updated: 1 };
    s().save(a);
    s().save({ id: "b", title: "Second", text: "keep", updated: 2 });
    s().save({ ...a, text: "saved text", updated: 3 });
    expect(readStorage("notes")).toEqual(s().notes);
    expect(s().notes.find((n) => n.id === "a")?.text).toBe("saved text");
    s().remove("a");
    expect(s().notes).toHaveLength(1);
    expect(s().notes[0].text).toBe("keep");
  });
});
describe("calculator", () => {
  it.each([
    ["1+2", 3],
    ["5-8", -3],
    ["4*5", 20],
    ["8/4", 2],
    ["0.1+0.2", 0.3],
    ["(2+3)*4", 20],
    ["-2*-3", 6],
    ["2+3*4", 14],
  ])("evaluates %s", (expression, result) =>
    expect(calculate(expression)).toBe(result),
  );
  it.each(["1/0", "2+", "(3+2", "alert(1)", "", "1..2"])(
    "rejects %s",
    (expression) => expect(() => calculate(expression)).toThrow(),
  );
});

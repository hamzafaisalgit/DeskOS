import { useCallback, useEffect, useRef, useState } from "react";
import {
  Canvas as FabricCanvas,
  PencilBrush,
  Rect,
  Ellipse,
  Line,
  IText,
  FabricImage,
  FabricObject,
  Point,
} from "fabric";
import {
  Brush,
  Pencil,
  Eraser,
  MousePointer2,
  Square,
  Circle,
  Minus,
  Type,
  Hand,
  Palette,
  Save,
  Download,
  FolderOpen,
  Plus,
  Undo,
  Redo,
  Eye,
  EyeOff,
  Trash2,
  ArrowUp,
  ArrowDown,
  Pipette,
} from "lucide-react";
import { filesystem as fs } from "../../core/filesystem/service";
import { useFilesystem } from "../../core/filesystem/hooks";
import { folderId } from "../../core/filesystem/types";
import { useLaunchData } from "../../core/launch";
import { useDesk } from "../../core/store";
import { download } from "../../core/filesystem/transfers";
import { parseProject, serializeProject } from "../../core/media/canvasProject";
import { editableTarget } from "../../core/media/state";
import { report } from "../../core/media/hooks";
import { useDirtyGuard } from "./DirtyGuard";
import { OperationDialog } from "../files/OperationDialog";
import type { FileDialog } from "../files/OperationDialog";
import "./media.css";
FabricObject.customProperties = ["name"];
type NamedObject = FabricObject & { name?: string };
type Tool =
  | "select"
  | "brush"
  | "pencil"
  | "eraser"
  | "line"
  | "rectangle"
  | "ellipse"
  | "text"
  | "pan"
  | "picker";
const tools = [
  ["select", MousePointer2],
  ["brush", Brush],
  ["pencil", Pencil],
  ["eraser", Eraser],
  ["line", Minus],
  ["rectangle", Square],
  ["ellipse", Circle],
  ["text", Type],
  ["pan", Hand],
  ["picker", Pipette],
] as const;
export default function Canvas() {
  const element = useRef<HTMLCanvasElement>(null),
    instance = useRef<FabricCanvas | null>(null),
    stage = useRef<HTMLDivElement>(null),
    launch = useLaunchData(),
    { entries } = useFilesystem();
  const [tool, setTool] = useState<Tool>("brush"),
    [color, setColor] = useState("#9e91ed"),
    [fill, setFill] = useState("#c6bcef"),
    [size, setSize] = useState(6),
    [opacity, setOpacity] = useState(1),
    [background, setBackground] = useState("#ffffff"),
    [width, setWidth] = useState(1000),
    [height, setHeight] = useState(700),
    [zoom, setZoom] = useState(1),
    [layers, setLayers] = useState<NamedObject[]>([]),
    [selected, setSelected] = useState<NamedObject | null>(null),
    [dirty, setDirty] = useState(false),
    [name, setName] = useState("Untitled"),
    [file, setFile] = useState<{ id: string; revision: number } | null>(null),
    [dialog, setDialog] = useState<FileDialog | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [historyIndex, setHistoryIndex] = useState(0);
  const [historyLength, setHistoryLength] = useState(1);
  const history = useRef<string[]>([]),
    cursor = useRef(0),
    restoring = useRef(false),
    dimensions = useRef({ width: 1000, height: 700 }),
    saved = useRef(""),
    settings = useRef({ tool, color, fill, size, opacity }),
    initialized = useRef("");
  useEffect(() => {
    settings.current = { tool, color, fill, size, opacity };
  }, [tool, color, fill, size, opacity]);
  const snapshot = useCallback(() => {
    const c = instance.current;
    if (!c || restoring.current) return;
    const value = serializeProject(
      dimensions.current.width,
      dimensions.current.height,
      c.toObject() as Record<string, unknown>,
    );
    if (history.current[cursor.current] !== value) {
      history.current = [
        ...history.current.slice(0, cursor.current + 1),
        value,
      ].slice(-20);
      while (
        history.current.length > 1 &&
        history.current.reduce((n, s) => n + s.length, 0) > 32 * 1024 * 1024
      )
        history.current.shift();
      cursor.current = history.current.length - 1;
      setHistoryIndex(cursor.current);
      setHistoryLength(history.current.length);
    }
    setDirty(value !== saved.current);
    setLayers([...c.getObjects()] as NamedObject[]);
    setSelected((c.getActiveObject() as NamedObject) || null);
  }, []);
  useEffect(() => {
    if (!element.current) return;
    const c = new FabricCanvas(element.current, {
      width: 1000,
      height: 700,
      backgroundColor: "#ffffff",
      preserveObjectStacking: true,
      enablePointerEvents: true,
    });
    instance.current = c;
    const record = () => {
      try {
        snapshot();
      } catch (e) {
        setError(String(e));
      }
    };
    c.on("object:modified", record);
    c.on("path:created", ({ path }) => {
      const s = settings.current;
      path.set({
        opacity: s.opacity,
        globalCompositeOperation:
          s.tool === "eraser" ? "destination-out" : "source-over",
        objectCaching: false,
      });
      (path as NamedObject).name =
        s.tool === "eraser" ? "Eraser stroke" : "Brush stroke";
      record();
    });
    c.on("selection:created", () =>
      setSelected(c.getActiveObject() as NamedObject),
    );
    c.on("selection:updated", () =>
      setSelected(c.getActiveObject() as NamedObject),
    );
    c.on("selection:cleared", () => setSelected(null));
    let start: Point | null = null,
      shape: FabricObject | null = null,
      previous: Point | null = null;
    c.on("mouse:down", (e) => {
      const s = settings.current,
        p = c.getScenePoint(e.e);
      start = p;
      if (s.tool === "pan") {
        previous = c.getViewportPoint(e.e);
        return;
      }
      if (s.tool === "picker") {
        const point = c.getViewportPoint(e.e);
        try {
          const px = c.getContext().getImageData(point.x, point.y, 1, 1).data;
          setColor(
            "#" +
              [...px.slice(0, 3)]
                .map((n) => n.toString(16).padStart(2, "0"))
                .join(""),
          );
        } catch (err) {
          report(err);
        }
        return;
      }
      if (s.tool === "text") {
        const text = new IText("Your text", {
          left: p.x,
          top: p.y,
          originX: "left",
          originY: "top",
          fontSize: 32,
          fill: s.color,
          opacity: s.opacity,
        });
        (text as NamedObject).name = "Text";
        c.add(text);
        c.setActiveObject(text);
        setTool("select");
        record();
        return;
      }
      const options = {
        originX: "left" as const,
        originY: "top" as const,
        left: p.x,
        top: p.y,
        fill: s.fill,
        stroke: s.color,
        strokeWidth: s.size,
        opacity: s.opacity,
        objectCaching: false,
      };
      if (s.tool === "rectangle")
        shape = new Rect({ ...options, width: 1, height: 1 });
      else if (s.tool === "ellipse")
        shape = new Ellipse({ ...options, rx: 1, ry: 1 });
      else if (s.tool === "line")
        shape = new Line([p.x, p.y, p.x, p.y], {
          stroke: s.color,
          strokeWidth: s.size,
          opacity: s.opacity,
        });
      if (shape) {
        (shape as NamedObject).name = s.tool;
        c.add(shape);
      }
    });
    c.on("mouse:move", (e) => {
      if (!start) return;
      const p = c.getScenePoint(e.e);
      if (settings.current.tool === "pan" && previous) {
        const now = c.getViewportPoint(e.e);
        c.relativePan(new Point(now.x - previous.x, now.y - previous.y));
        previous = now;
        return;
      }
      if (!shape) return;
      if (shape instanceof Line) shape.set({ x2: p.x, y2: p.y });
      else {
        shape.set({
          left: Math.min(p.x, start.x),
          top: Math.min(p.y, start.y),
        });
        if (shape instanceof Ellipse)
          shape.set({
            rx: Math.abs(p.x - start.x) / 2,
            ry: Math.abs(p.y - start.y) / 2,
          });
        else
          shape.set({
            width: Math.abs(p.x - start.x),
            height: Math.abs(p.y - start.y),
          });
      }
      c.requestRenderAll();
    });
    c.on("mouse:up", () => {
      if (shape) {
        shape.setCoords();
        record();
      }
      start = null;
      shape = null;
      previous = null;
    });
    const initial = serializeProject(
      1000,
      700,
      c.toObject() as Record<string, unknown>,
    );
    saved.current = initial;
    history.current = [initial];
    cursor.current = 0;
    return () => {
      instance.current = null;
      void c.dispose();
    };
  }, [snapshot]);
  useEffect(() => {
    const c = instance.current;
    if (!c) return;
    c.isDrawingMode = ["brush", "pencil", "eraser"].includes(tool);
    c.selection = tool === "select";
    c.getObjects().forEach((o) =>
      o.set({ selectable: tool === "select", evented: tool === "select" }),
    );
    const brush = new PencilBrush(c);
    brush.color = color;
    brush.width = tool === "pencil" ? 1 : size;
    brush.decimate = tool === "pencil" ? 0 : 1;
    c.freeDrawingBrush = brush;
    c.defaultCursor =
      tool === "pan" ? "grab" : tool === "picker" ? "crosshair" : "default";
    c.requestRenderAll();
  }, [tool, color, size]);
  const restore = async (source: string, clean = false) => {
    const p = parseProject(source),
      c = instance.current;
    if (!c) return;
    restoring.current = true;
    try {
      await c.loadFromJSON(p.scene);
      dimensions.current = { width: p.width, height: p.height };
      setWidth(p.width);
      setHeight(p.height);
      c.setDimensions({ width: p.width, height: p.height });
      c.setViewportTransform([1, 0, 0, 1, 0, 0]);
      setZoom(1);
      setBackground(
        typeof c.backgroundColor === "string" ? c.backgroundColor : "#ffffff",
      );
      c.requestRenderAll();
      setLayers([...c.getObjects()] as NamedObject[]);
      if (clean) {
        saved.current = source;
        history.current = [source];
        cursor.current = 0;
        setHistoryIndex(0);
        setHistoryLength(1);
      }
      setDirty(source !== saved.current);
    } finally {
      restoring.current = false;
    }
  };
  const open = async (id: string) => {
    setBusy(true);
    try {
      const e = await fs.getEntry(id);
      if (e.trashed) throw Error("This file is in Trash.");
      if (e.extension === "deskcanvas") {
        const doc = await fs.readDocument(id, 24 * 1024 * 1024);
        await restore(await doc.blob.text(), true);
        setFile({ id, revision: doc.entry.revision ?? 0 });
        setName(e.name.replace(/\.deskcanvas$/, ""));
      } else {
        const blob = await fs.getFileContent(id);
        if (blob.size > 25 * 1024 * 1024)
          throw Error("Import images below 25 MB.");
        const url = await new Promise<string>((resolve, reject) => {
          const r = new FileReader();
          r.onload = () => resolve(String(r.result));
          r.onerror = reject;
          r.readAsDataURL(blob);
        });
        const image = await FabricImage.fromURL(url);
        if (image.width * image.height > 40_000_000)
          throw Error("Import images below 40 megapixels.");
        image.set({ originX: "left", originY: "top", left: 0, top: 0 });
        image.scaleToWidth(Math.min(image.width, dimensions.current.width));
        (image as NamedObject).name = e.name;
        instance.current!.add(image);
        snapshot();
      }
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  };
  const openRef = useRef(open);
  useEffect(() => {
    openRef.current = open;
  });
  useEffect(() => {
    if (launch.entryId && initialized.current !== launch.entryId) {
      const timer = setTimeout(() => {
        initialized.current = launch.entryId!;
        void openRef.current(launch.entryId!);
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [launch.entryId]); // launch opens once; subsequent editing stays local
  const save = async (copy = false) => {
    const c = instance.current;
    if (!c) return;
    const source = serializeProject(
      dimensions.current.width,
      dimensions.current.height,
      c.toObject() as Record<string, unknown>,
    );
    setBusy(true);
    try {
      if (file && !copy) {
        const e = await fs.saveDocument(file.id, source, file.revision);
        setFile({ id: e.id, revision: e.revision ?? 0 });
      } else {
        const e = await fs.createFile(
          folderId("Pictures"),
          (name.trim() || "Untitled") + ".deskcanvas",
          new Blob([source], { type: "application/x-deskcanvas+json" }),
          true,
        );
        setFile({ id: e.id, revision: e.revision ?? 0 });
      }
      saved.current = source;
      setDirty(
        serializeProject(
          dimensions.current.width,
          dimensions.current.height,
          c.toObject() as Record<string, unknown>,
        ) !== source,
      );
      useDesk.getState().notify("Canvas project saved to Pictures");
    } finally {
      setBusy(false);
    }
  };
  const guard = useDirtyGuard(dirty, () => save());
  const undo = async (delta: number) => {
    const n = cursor.current + delta;
    if (n < 0 || n >= history.current.length) return;
    cursor.current = n;
    setHistoryIndex(n);
    await restore(history.current[n]);
  };
  const mutate = (action: (c: FabricCanvas) => void) => {
    const c = instance.current;
    if (c) {
      action(c);
      c.requestRenderAll();
      snapshot();
    }
  };
  const applyZoom = (z: number) => {
    const c = instance.current;
    if (!c) return;
    const value = Math.max(0.1, Math.min(3, z));
    setZoom(value);
    c.setZoom(value);
    c.setDimensions({
      width: dimensions.current.width * value,
      height: dimensions.current.height * value,
    });
  };
  const exportImage = async (format: "png" | "jpeg", saveFile: boolean) => {
    const c = instance.current;
    if (!c) return;
    const viewport = [...c.viewportTransform] as typeof c.viewportTransform;
    const display = { width: c.getWidth(), height: c.getHeight() };
    let data: string;
    try {
      c.setDimensions(dimensions.current);
      c.setViewportTransform([1, 0, 0, 1, 0, 0]);
      data = c.toDataURL({
        format,
        quality: 0.92,
        multiplier: 1,
        enableRetinaScaling: false,
      });
    } finally {
      c.setDimensions(display);
      c.setViewportTransform(viewport);
      c.requestRenderAll();
    }
    const blob = await (await fetch(data)).blob();
    const filename =
      (name.trim() || "Artwork") + "." + (format === "jpeg" ? "jpg" : "png");
    if (saveFile) {
      await fs.createFile(folderId("Pictures"), filename, blob, true);
      useDesk.getState().notify("Image saved to Pictures");
    } else download(blob, filename);
  };
  const pickFile = () =>
    setDialog({
      title: "Open a project or add an image",
      label: "File",
      initial: "",
      destinations: entries.filter(
        (e) => !e.trashed && /^(deskcanvas|png|jpe?g|webp)$/.test(e.extension),
      ),
      run: async (id) => {
        if (!id) throw Error("Choose a file.");
        await open(id);
      },
    });
  const selectionChange = (patch: Record<string, unknown>) =>
    mutate((c) => {
      c.getActiveObjects().forEach((o) => o.set(patch));
    });
  return (
    <div
      className="media-app"
      tabIndex={0}
      onKeyDown={(e) => {
        if (editableTarget(e.target)) return;
        const mod = e.ctrlKey || e.metaKey;
        if (mod && e.key === "s") {
          e.preventDefault();
          void save().catch(report);
        }
        if (mod && e.key === "z") {
          e.preventDefault();
          void undo(e.shiftKey ? 1 : -1).catch(report);
        }
        if (!mod && ["b", "e", "v"].includes(e.key.toLowerCase()))
          setTool(
            ({ b: "brush", e: "eraser", v: "select" } as Record<string, Tool>)[
              e.key.toLowerCase()
            ],
          );
        if (e.key === "Delete")
          mutate((c) => {
            c.remove(...c.getActiveObjects());
            c.discardActiveObject();
          });
      }}
    >
      <header className="media-topbar">
        <Palette size={18} />
        <input
          aria-label="Project name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          style={{ width: 150 }}
        />
        <span>{dirty ? "Unsaved" : "Saved"}</span>
        <button
          disabled={busy}
          aria-label="New canvas"
          onClick={() =>
            guard.request(() => {
              void restore(
                serializeProject(1000, 700, {
                  objects: [],
                  background: "#ffffff",
                }),
                true,
              );
              setFile(null);
              setName("Untitled");
            })
          }
        >
          <Plus size={16} />
        </button>
        <button disabled={busy} onClick={() => guard.request(pickFile)}>
          <FolderOpen size={16} />
          Open
        </button>
        <button disabled={busy} onClick={() => void save().catch(report)}>
          <Save size={16} />
          Save
        </button>
        <button disabled={busy} onClick={() => void save(true).catch(report)}>
          Save As
        </button>
        <button
          disabled={!historyIndex || busy}
          aria-label="Undo canvas"
          onClick={() => void undo(-1).catch(report)}
        >
          <Undo size={16} />
        </button>
        <button
          disabled={historyIndex >= historyLength - 1 || busy}
          aria-label="Redo canvas"
          onClick={() => void undo(1).catch(report)}
        >
          <Redo size={16} />
        </button>
      </header>
      {error && (
        <div className="media-error" role="alert">
          {error}
          <button onClick={() => setError("")}>Dismiss</button>
        </div>
      )}
      <div className="media-workspace">
        <aside className="canvas-tools">
          {tools.map(([id, Icon]) => (
            <button
              key={id}
              title={id}
              aria-label={id + " tool"}
              className={tool === id ? "selected" : ""}
              onClick={() => setTool(id)}
            >
              <Icon size={18} />
            </button>
          ))}
        </aside>
        <div className="media-stage canvas-stage" ref={stage}>
          <canvas ref={element} aria-label="Drawing canvas" />
        </div>
        <aside className="media-properties">
          <small>TOOL PROPERTIES</small>
          <label>
            Stroke
            <input
              aria-label="Stroke color"
              type="color"
              value={color}
              onChange={(e) => {
                setColor(e.target.value);
                selectionChange({ stroke: e.target.value });
              }}
            />
          </label>
          <label>
            Fill
            <input
              aria-label="Fill color"
              type="color"
              value={fill}
              onChange={(e) => {
                setFill(e.target.value);
                selectionChange({ fill: e.target.value });
              }}
            />
          </label>
          <label>
            Size / {size}px
            <input
              type="range"
              min="1"
              max="80"
              value={size}
              onChange={(e) => {
                setSize(Number(e.target.value));
                selectionChange({ strokeWidth: Number(e.target.value) });
              }}
            />
          </label>
          <label>
            Opacity
            <input
              type="range"
              min=".05"
              max="1"
              step=".05"
              value={opacity}
              onChange={(e) => {
                setOpacity(Number(e.target.value));
                selectionChange({ opacity: Number(e.target.value) });
              }}
            />
          </label>
          <label>
            Background
            <input
              type="color"
              value={background}
              onChange={(e) => {
                setBackground(e.target.value);
                mutate((c) => {
                  c.backgroundColor = e.target.value;
                });
              }}
            />
          </label>
          <button
            onClick={() =>
              mutate((c) => {
                c.backgroundColor = "";
              })
            }
          >
            Transparent background
          </button>
          <details className="canvas-dimensions">
            <summary>Document size</summary>
            <select
              aria-label="Canvas preset"
              defaultValue=""
              onChange={(e) => {
                const [w, h] = e.target.value.split("x").map(Number);
                setWidth(w);
                setHeight(h);
              }}
            >
              <option value="" disabled>
                Choose preset
              </option>
              <option value="1000x700">Landscape</option>
              <option value="1080x1080">Square</option>
              <option value="1080x1920">Portrait</option>
            </select>
            <label>
              Width
              <input
                type="number"
                min="1"
                max="4096"
                value={width}
                onChange={(e) => setWidth(Number(e.target.value))}
              />
            </label>
            <label>
              Height
              <input
                type="number"
                min="1"
                max="4096"
                value={height}
                onChange={(e) => setHeight(Number(e.target.value))}
              />
            </label>
            <button
              onClick={() => {
                if (width < 1 || height < 1 || width > 4096 || height > 4096) {
                  report("Use dimensions from 1 to 4096.");
                  return;
                }
                dimensions.current = { width, height };
                mutate((c) =>
                  c.setDimensions({
                    width: width * zoom,
                    height: height * zoom,
                  }),
                );
              }}
            >
              Resize document
            </button>
          </details>
          <h3>Object layers</h3>
          <button
            onClick={() =>
              mutate((c) => {
                const o = new Rect({
                  originX: "left",
                  originY: "top",
                  width: 150,
                  height: 100,
                  left: 50,
                  top: 50,
                  fill,
                  stroke: color,
                });
                (o as NamedObject).name = "New layer";
                c.add(o);
              })
            }
          >
            <Plus size={13} />
            New layer
          </button>
          {[...layers].reverse().map((o, i) => (
            <div
              className={"layer-row " + (selected === o ? "selected" : "")}
              key={i}
            >
              <button
                onClick={() => {
                  setTool("select");
                  instance.current?.setActiveObject(o);
                  instance.current?.requestRenderAll();
                  setSelected(o);
                }}
              >
                {o.name || o.type}
              </button>
              <button
                aria-label="Toggle layer visibility"
                onClick={() => mutate(() => o.set({ visible: !o.visible }))}
              >
                {o.visible ? <Eye size={12} /> : <EyeOff size={12} />}
              </button>
            </div>
          ))}
          {selected && (
            <>
              <button
                onClick={() =>
                  setDialog({
                    title: "Rename layer",
                    label: "Name",
                    initial: selected.name || selected.type,
                    run: async (name) => {
                      selected.name = name;
                      snapshot();
                    },
                  })
                }
              >
                Rename layer
              </button>
              <button
                aria-label="Raise layer"
                onClick={() => mutate((c) => c.bringObjectForward(selected))}
              >
                <ArrowUp size={14} />
              </button>
              <button
                aria-label="Lower layer"
                onClick={() => mutate((c) => c.sendObjectBackwards(selected))}
              >
                <ArrowDown size={14} />
              </button>
              <button
                aria-label="Delete layer"
                onClick={() =>
                  mutate((c) => {
                    c.remove(selected);
                    c.discardActiveObject();
                  })
                }
              >
                <Trash2 size={14} />
              </button>
            </>
          )}
          <h3>Export</h3>
          <button onClick={() => void exportImage("png", true).catch(report)}>
            Save PNG to Pictures
          </button>
          <button onClick={() => void exportImage("png", false).catch(report)}>
            <Download size={13} />
            PNG
          </button>
          <button onClick={() => void exportImage("jpeg", false).catch(report)}>
            <Download size={13} />
            JPEG
          </button>
        </aside>
      </div>
      <footer className="media-status">
        <span>
          {width} x {height} / {tool} / {layers.length} objects
        </span>
        <span>
          <button onClick={() => applyZoom(zoom - 0.1)}>-</button>
          {Math.round(zoom * 100)}%
          <button onClick={() => applyZoom(zoom + 0.1)}>+</button>
          <button
            onClick={() => {
              if (stage.current)
                applyZoom(
                  Math.min(
                    (stage.current.clientWidth - 60) / dimensions.current.width,
                    (stage.current.clientHeight - 60) /
                      dimensions.current.height,
                  ),
                );
            }}
          >
            Fit
          </button>
        </span>
      </footer>
      {guard.dialog}
      {dialog && (
        <OperationDialog dialog={dialog} close={() => setDialog(null)} />
      )}
    </div>
  );
}
